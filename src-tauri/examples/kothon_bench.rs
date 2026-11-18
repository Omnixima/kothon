//! Time the Kothon Bengali models through the app's own engine path: the
//! supervised transcribe worker process, the app's audio decoder, and the
//! Bengali run settings from `kothon.rs`.
//!
//!     cargo run --release --example kothon_bench -- MODEL_ID MODEL.gguf LIST.tsv AUDIO_DIR OUT.jsonl
//!
//! LIST.tsv is `file<TAB>seconds<TAB>reference` (the FLEURS subset). Each line
//! of OUT.jsonl has the fields scripts/score.py reads.

use std::io::Write;
use std::path::PathBuf;
use std::time::Instant;

use kothon_app_lib::audio_toolkit::audio::decode_audio_file;
use kothon_app_lib::engine_supervisor::{
    is_worker_invocation, run_worker, DeviceSelector, EngineSupervisor, LoadSpec,
};
use kothon_app_lib::kothon::apply_run_overrides;
use kothon_app_lib::kothon_punct::Punctuator;
use transcribe_cpp::{Backend, RunOptions};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // The supervisor re-launches this executable as its worker.
    if is_worker_invocation() {
        std::process::exit(run_worker());
    }
    let a: Vec<String> = std::env::args().collect();
    let (model_id, model, list, audio_dir, out) = (&a[1], &a[2], &a[3], &a[4], &a[5]);

    let engine = EngineSupervisor::new(true);
    let t = Instant::now();
    let info = engine.load(LoadSpec {
        path: PathBuf::from(model),
        backend: Backend::Auto,
        device: DeviceSelector::Auto,
    })?;
    eprintln!(
        "loaded {} ({}) on {} in {:.0} ms",
        model_id,
        info.variant,
        info.device,
        t.elapsed().as_secs_f64() * 1000.0
    );

    let rows: Vec<Vec<String>> = std::fs::read_to_string(list)?
        .lines()
        .map(|l| l.split('\t').map(str::to_string).collect())
        .collect();
    let mut run = RunOptions::default();
    apply_run_overrides(model_id, &mut run);

    // Optional: KOTHON_PUNCT_DIR=<dir> also punctuates and times that step.
    let punct = match std::env::var("KOTHON_PUNCT_DIR") {
        Ok(d) => Some(Punctuator::load(std::path::Path::new(&d))?),
        Err(_) => None,
    };
    let mut punct_total = 0.0f64;

    let mut f = std::fs::File::create(out)?;
    // Warm-up on the first clip, not recorded.
    let pcm = decode_audio_file(&PathBuf::from(audio_dir).join(&rows[0][0]))?;
    engine.transcribe(pcm, run.clone())?;
    let (mut audio, mut busy) = (0.0f64, 0.0f64);
    for r in &rows {
        let pcm = decode_audio_file(&PathBuf::from(audio_dir).join(&r[0]))?;
        let dur = pcm.len() as f64 / 16000.0;
        let t = Instant::now();
        let tr = engine.transcribe(pcm, run.clone())?;
        let secs = t.elapsed().as_secs_f64();
        let (hyp, punct_ms) = match &punct {
            Some(p) => {
                let t = Instant::now();
                let h = p.punctuate(tr.text.trim())?;
                (h, t.elapsed().as_secs_f64() * 1000.0)
            }
            None => (tr.text.clone(), 0.0),
        };
        punct_total += punct_ms / 1000.0;
        audio += dur;
        busy += secs;
        let line = serde_json::json!({"file": r[0], "dur": dur, "ref": r[2], "hyp": hyp, "secs": secs, "punct_ms": punct_ms});
        writeln!(f, "{}", line)?;
    }
    eprintln!(
        "{}: {:.1} s audio in {:.1} s ({:.0}x realtime)",
        model_id,
        audio,
        busy,
        audio / busy
    );
    if punct.is_some() {
        eprintln!(
            "punctuation: {:.2} s total, {:.1} ms per clip on average ({:.0}% of transcription time)",
            punct_total,
            punct_total * 1000.0 / rows.len() as f64,
            punct_total / busy * 100.0
        );
    }
    Ok(())
}
