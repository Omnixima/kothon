//! Kothon: on-device Bengali punctuation restoration.
//!
//! Neither Bengali speech model outputs punctuation. This adds দাঁড়ি (।),
//! commas and question marks with a small token classifier: the 6-layer MuRIL
//! punctuation model from the BengaliAI competition winner (Apache-2.0),
//! with its vocab pruned to Bengali script and stored as F16 (~128 MB).
//! It runs on the CPU in candle (Accelerate on macOS), in about 15 ms for a
//! dictated sentence, and only loads once a Bengali model is in use.
//!
//! Files (in `<models dir>/bn-punct-muril6/`): `config.json`,
//! `model.safetensors`, `tokenizer.json`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{anyhow, Context, Result};
use candle_core::{DType, Device, Tensor, D};
use candle_nn::{Linear, Module, VarBuilder};
use candle_transformers::models::bert::{BertModel, Config};
use log::{info, warn};
use once_cell::sync::Lazy;
use tokenizers::Tokenizer;

pub const PUNCT_DIR: &str = "bn-punct-muril6";

/// Words per model call. Well under the 512-token limit for Bengali text.
const WINDOW_WORDS: usize = 150;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Mark {
    None,
    Danda,
    Comma,
    Question,
}

pub struct Punctuator {
    bert: BertModel,
    classifier: Linear,
    tokenizer: Tokenizer,
    labels: Vec<Mark>,
    device: Device,
}

impl Punctuator {
    pub fn load(dir: &Path) -> Result<Self> {
        let device = Device::Cpu;
        let config_text = std::fs::read_to_string(dir.join("config.json"))?;
        let config: Config = serde_json::from_str(&config_text)?;
        let raw: serde_json::Value = serde_json::from_str(&config_text)?;
        let id2label = raw["id2label"]
            .as_object()
            .ok_or_else(|| anyhow!("config.json has no id2label"))?;
        let mut labels = vec![Mark::None; id2label.len()];
        for (id, name) in id2label {
            let i: usize = id.parse()?;
            labels[i] = match name.as_str().unwrap_or("") {
                "PERIOD" => Mark::Danda,
                "COMMA" => Mark::Comma,
                "QUESTION" => Mark::Question,
                _ => Mark::None,
            };
        }
        // F16 on disk, F32 compute: candle's CPU F16 matmul is slow.
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[dir.join("model.safetensors")],
                DType::F32,
                &device,
            )?
        };
        let bert = BertModel::load(vb.pp("bert"), &config)?;
        let classifier = candle_nn::linear(config.hidden_size, labels.len(), vb.pp("classifier"))?;
        let tokenizer = Tokenizer::from_file(dir.join("tokenizer.json")).map_err(|e| anyhow!(e))?;
        Ok(Self {
            bert,
            classifier,
            tokenizer,
            labels,
            device,
        })
    }

    /// One mark per word, read from each word's first sub-token.
    fn predict(&self, words: &[&str]) -> Result<Vec<Mark>> {
        let enc = self
            .tokenizer
            .encode(tokenizers::InputSequence::from(words.to_vec()), true)
            .map_err(|e| anyhow!(e))?;
        let ids = enc.get_ids();
        let input = Tensor::new(ids, &self.device)?.unsqueeze(0)?;
        let types = input.zeros_like()?;
        let hidden = self.bert.forward(&input, &types, None)?;
        let pred: Vec<u32> = self
            .classifier
            .forward(&hidden)?
            .argmax(D::Minus1)?
            .squeeze(0)?
            .to_vec1()?;
        let mut marks = vec![Mark::None; words.len()];
        let mut prev = None;
        for (i, wid) in enc.get_word_ids().iter().enumerate() {
            if let Some(w) = wid {
                if prev != Some(*w) {
                    marks[*w as usize] = self.labels[pred[i] as usize];
                }
            }
            prev = *wid;
        }
        Ok(marks)
    }

    /// Punctuate unpunctuated Bengali text. Text that already has
    /// punctuation is returned as is.
    pub fn punctuate(&self, text: &str) -> Result<String> {
        if text
            .chars()
            .any(|c| matches!(c, '।' | '?' | ',' | '!' | '.'))
        {
            return Ok(text.to_string());
        }
        let words: Vec<&str> = text.split_whitespace().collect();
        if words.is_empty() {
            return Ok(text.to_string());
        }
        let mut marks = Vec::with_capacity(words.len());
        for chunk in words.chunks(WINDOW_WORDS) {
            marks.extend(self.predict(chunk)?);
        }
        // A dictated utterance always ends a sentence.
        if let Some(last) = marks.last_mut() {
            if *last != Mark::Question {
                *last = Mark::Danda;
            }
        }
        let mut out = String::with_capacity(text.len() + words.len());
        for (i, (w, m)) in words.iter().zip(marks).enumerate() {
            if i > 0 {
                out.push(' ');
            }
            out.push_str(w);
            match m {
                Mark::Danda => out.push('।'),
                Mark::Comma => out.push(','),
                Mark::Question => out.push('?'),
                Mark::None => {}
            }
        }
        Ok(out)
    }
}

/// Loaded on first use (or by `preload`), then kept for the app's lifetime.
static PUNCTUATOR: Lazy<Mutex<Option<(PathBuf, Punctuator)>>> = Lazy::new(|| Mutex::new(None));

pub fn is_installed(models_dir: &Path) -> bool {
    models_dir
        .join(PUNCT_DIR)
        .join("model.safetensors")
        .exists()
}

fn with_punctuator<T>(models_dir: &Path, f: impl FnOnce(&Punctuator) -> T) -> Result<T> {
    let dir = models_dir.join(PUNCT_DIR);
    let mut slot = PUNCTUATOR
        .lock()
        .map_err(|_| anyhow!("punctuator lock poisoned"))?;
    if slot.as_ref().map(|(d, _)| d != &dir).unwrap_or(true) {
        let t = std::time::Instant::now();
        let p = Punctuator::load(&dir).with_context(|| format!("loading {}", dir.display()))?;
        info!(
            "Kothon: loaded Bengali punctuator in {} ms",
            t.elapsed().as_millis()
        );
        *slot = Some((dir, p));
    }
    Ok(f(&slot.as_ref().expect("just loaded").1))
}

/// Load the model ahead of the first transcription so it adds no delay then.
pub fn preload(models_dir: &Path) {
    if is_installed(models_dir) {
        if let Err(e) = with_punctuator(models_dir, |_| ()) {
            warn!("Kothon: Bengali punctuator failed to load: {e:#}");
        }
    }
}

/// Punctuate `text`, or return it unchanged if the model is missing or fails.
pub fn punctuate_or_passthrough(models_dir: &Path, text: &str) -> String {
    if !is_installed(models_dir) {
        return text.to_string();
    }
    let t = std::time::Instant::now();
    match with_punctuator(models_dir, |p| p.punctuate(text)) {
        Ok(Ok(out)) => {
            log::debug!(
                "Kothon: punctuated {} chars in {:.1} ms",
                text.len(),
                t.elapsed().as_secs_f64() * 1000.0
            );
            out
        }
        Ok(Err(e)) | Err(e) => {
            warn!("Kothon: punctuation failed, keeping raw text: {e:#}");
            text.to_string()
        }
    }
}

static MODELS_DIR: once_cell::sync::OnceCell<PathBuf> = once_cell::sync::OnceCell::new();

/// Record the app's models directory (set once at startup).
pub fn set_models_dir(dir: &Path) {
    let _ = MODELS_DIR.set(dir.to_path_buf());
}

/// Load the punctuator in the background (when a Bengali model loads), so
/// the first dictation pays no load time. Other models never load it. If
/// it isn't on disk yet, download it first (128 MB, once).
pub fn preload_in_background() {
    if let Some(dir) = models_dir() {
        if is_installed(&dir) {
            std::thread::spawn(move || preload(&dir));
        } else {
            tauri::async_runtime::spawn(async move {
                match download(&dir).await {
                    Ok(()) => {
                        let _ = tauri::async_runtime::spawn_blocking(move || preload(&dir)).await;
                    }
                    Err(e) => warn!("Kothon: couldn't download the punctuation model: {e:#}"),
                }
            });
        }
    }
}

/// Where the punctuation model downloads from.
const PUNCT_REPO_URL: &str =
    "https://huggingface.co/omnixima/bangla-punctuation-muril6/resolve/main";
/// The model file's SHA-256, checked after download.
const PUNCT_WEIGHTS_SHA256: &str =
    "105e9d31a4a027dd2ceb8a34db2281df7e76a0da241b35f10cd7a9edc33c3c13";

static DOWNLOADING: once_cell::sync::Lazy<tokio::sync::Mutex<()>> =
    once_cell::sync::Lazy::new(|| tokio::sync::Mutex::new(()));

/// Fetch the punctuation model's files into `<models dir>/bn-punct-muril6`.
async fn download(models_dir: &Path) -> Result<()> {
    use sha2::{Digest, Sha256};
    let _one_at_a_time = DOWNLOADING.lock().await;
    if is_installed(models_dir) {
        return Ok(());
    }
    let dir = models_dir.join(PUNCT_DIR);
    std::fs::create_dir_all(&dir)?;
    let client = reqwest::Client::new();
    // Weights last: their presence marks the model as installed.
    for name in ["config.json", "tokenizer.json", "model.safetensors"] {
        let url = format!("{PUNCT_REPO_URL}/{name}");
        let bytes = client
            .get(&url)
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?;
        if name == "model.safetensors" {
            let digest = format!("{:x}", Sha256::digest(&bytes));
            if digest != PUNCT_WEIGHTS_SHA256 {
                return Err(anyhow!("checksum mismatch for {name}"));
            }
        }
        let partial = dir.join(format!("{name}.partial"));
        std::fs::write(&partial, &bytes)?;
        std::fs::rename(&partial, dir.join(name))?;
    }
    info!("Kothon: downloaded the Bengali punctuation model");
    Ok(())
}

pub fn models_dir() -> Option<PathBuf> {
    MODELS_DIR.get().cloned()
}
