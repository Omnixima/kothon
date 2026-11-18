//! Kothon: first-class Bengali speech models.
//!
//! Two Bengali-tuned models, converted to GGUF for transcribe-cpp, are listed
//! here so they show up in the model picker with proper names, Bengali as their
//! only language, and the run settings each one needs. They download from
//! Kothon's Hugging Face repos (huggingface.co/omnixima); a copy already in
//! the models directory counts too (`scripts/kothon/install-bengali-models.sh`).

use std::collections::HashMap;
use std::path::Path;

use log::info;

use transcribe_cpp::{RunOptions, Task, TimestampKind};

use crate::managers::model::{ModelInfo, ModelSource};

/// The language every Kothon Bengali model is pinned to.
pub const BENGALI: &str = "bn";

pub struct BengaliModel {
    pub id: &'static str,
    /// Hugging Face repo the GGUF downloads from.
    pub repo_id: &'static str,
    pub filename: &'static str,
    pub size_mb: u64,
    pub name: &'static str,
    pub description: &'static str,
    pub accuracy_score: f32,
    pub speed_score: f32,
    pub is_recommended: bool,
    /// Run without timestamps. The BengaliAI Whisper fine-tune has no timestamp
    /// tokens, so Whisper's default segment-timestamp decoding must be off.
    pub no_timestamps: bool,
}

pub const BENGALI_MODELS: &[BengaliModel] = &[
    BengaliModel {
        id: "kothon-bn-fastconformer-116m",
        repo_id: "omnixima/bangla-fastconformer-ctc-116m-gguf",
        filename: "bangla-fastconformer-ctc-116m-Q8_0.gguf",
        size_mb: 132,
        name: "Bangla FastConformer (দ্রুত)",
        description: "Bengali only. 116M FastConformer CTC (kazalbrur, Apache-2.0). Very fast, about 9% WER on FLEURS.",
        accuracy_score: 0.80,
        speed_score: 0.98,
        is_recommended: true,
        no_timestamps: false,
    },
    BengaliModel {
        id: "kothon-bn-whisper-medium",
        repo_id: "omnixima/bengaliai-whisper-medium-gguf",
        filename: "bengali-whisper-medium-Q8_0.gguf",
        size_mb: 793,
        name: "Bangla Whisper Medium (নিখুঁত)",
        description: "Bengali only. BengaliAI Whisper-medium fine-tune (Apache-2.0). Most accurate, about 8% WER on FLEURS.",
        accuracy_score: 0.85,
        speed_score: 0.55,
        is_recommended: false,
        no_timestamps: true,
    },
];

pub fn bengali_model(id: &str) -> Option<&'static BengaliModel> {
    BENGALI_MODELS.iter().find(|m| m.id == id)
}

/// Add both Bengali models to the registry, downloadable from Hugging Face.
/// Runs before the custom-model scan, which then skips these filenames; the
/// download-status pass marks the ones already on disk.
pub fn seed_bengali_models(models_dir: &Path, available_models: &mut HashMap<String, ModelInfo>) {
    for m in BENGALI_MODELS {
        if available_models.contains_key(m.id) {
            continue;
        }
        let on_disk = models_dir.join(m.filename).exists();
        info!("Kothon: Bengali model {} (on disk: {})", m.id, on_disk);
        available_models.insert(
            m.id.to_string(),
            ModelInfo {
                id: m.id.to_string(),
                name: m.name.to_string(),
                description: m.description.to_string(),
                filename: m.filename.to_string(),
                source: ModelSource::HuggingFace {
                    repo_id: m.repo_id.to_string(),
                    revision: "main".to_string(),
                },
                size_mb: m.size_mb,
                is_downloaded: on_disk,
                is_downloading: false,
                partial_size: 0,
                accuracy_score: m.accuracy_score,
                speed_score: m.speed_score,
                supports_translation: false,
                is_recommended: m.is_recommended,
                supported_languages: vec![BENGALI.to_string()],
                supports_language_selection: false,
                is_custom: false,
                supports_streaming: false,
                supports_language_detection: false,
            },
        );
    }
}

/// Run settings a Bengali model needs: always Bengali, never translate, and no
/// timestamps for models without timestamp tokens. No-op for other models.
pub fn apply_run_overrides(model_id: &str, run: &mut RunOptions) {
    if let Some(bn) = bengali_model(model_id) {
        run.task = Task::Transcribe;
        run.language = Some(BENGALI.to_string());
        run.target_language = None;
        if bn.no_timestamps {
            run.timestamps = TimestampKind::None;
        }
    }
}
