//! Time Kothon's automatic Bengali/English switching the way the app runs it:
//! the language check (first seconds of speech, CPU) runs while the Bengali
//! model decodes; English dictations then go to the English model.
//!
//!     cargo run --release --example kothon_switch_bench -- \
//!         BN_MODEL.gguf EN_MODEL.gguf LID.gguf LIST.tsv OUT.jsonl
//!
//! LIST.tsv: `path<TAB>truth(bn|en)` per line.

use std::io::Write;
use std::path::PathBuf;
use std::time::Instant;

use kothon_app_lib::audio_toolkit::audio::decode_audio_file;
use kothon_app_lib::engine_supervisor::{
    is_worker_invocation, run_worker, DeviceSelector, EngineSupervisor, LoadSpec,
};
use transcribe_cpp::{Backend, LangIdOptions, Model, ModelOptions, RunOptions};

const WINDOW_SECONDS: usize = 5;

fn load(engine: &EngineSupervisor, path: &str) {
    engine
        .load(LoadSpec {
            path: PathBuf::from(path),
            backend: Backend::Auto,
            device: DeviceSelector::Auto,
        })
        .expect("load");
}

fn main() {
    if is_worker_invocation() {
        std::process::exit(run_worker());
    }
    let a: Vec<String> = std::env::args().collect();
    let (bn_model, en_model, lid_model, list, out) = (&a[1], &a[2], &a[3], &a[4], &a[5]);

    let bn = EngineSupervisor::new(true);
    let en = EngineSupervisor::new(true);
    load(&bn, bn_model);
    load(&en, en_model);
    let lid_model = Model::load_with(
        lid_model,
        &ModelOptions {
            backend: Backend::Cpu,
            device: None,
            ..Default::default()
        },
    )
    .expect("lid");
    let lid = std::sync::Mutex::new(lid_model.langid_session().expect("langid"));
    let allowed = vec!["bn".to_string(), "en".to_string()];
    let bn_run = RunOptions {
        language: Some("bn".into()),
        ..Default::default()
    };
    let en_run = RunOptions {
        language: Some("en".into()),
        ..Default::default()
    };

    let rows: Vec<(String, String)> = std::fs::read_to_string(list)
        .unwrap()
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .map(|(p, t)| (p.to_string(), t.to_string()))
        .collect();
    // Warm-up both engines and the detector.
    let pcm = decode_audio_file(std::path::Path::new(&rows[0].0)).unwrap();
    let _ = bn.transcribe(pcm.clone(), bn_run.clone());
    let _ = en.transcribe(pcm.clone(), en_run.clone());
    let _ = lid.lock().unwrap().run(
        &pcm,
        &LangIdOptions {
            allowed: Some(allowed.clone()),
        },
    );

    let mut f = std::fs::File::create(out).unwrap();
    for (path, truth) in &rows {
        let pcm = decode_audio_file(std::path::Path::new(path)).unwrap();
        let head = &pcm[..pcm.len().min(WINDOW_SECONDS * 16_000)];
        let t = Instant::now();
        let (bn_text, p_en, lid_ms, bn_ms) = std::thread::scope(|s| {
            let check = s.spawn(|| {
                let t = Instant::now();
                let r = lid
                    .lock()
                    .unwrap()
                    .run(
                        head,
                        &LangIdOptions {
                            allowed: Some(allowed.clone()),
                        },
                    )
                    .unwrap();
                let p = r
                    .candidates
                    .iter()
                    .find(|c| c.code == "en")
                    .map(|c| c.p)
                    .unwrap_or(0.0);
                (p, t.elapsed().as_secs_f64() * 1000.0)
            });
            let t = Instant::now();
            let text = bn.transcribe(pcm.clone(), bn_run.clone()).unwrap().text;
            let bn_ms = t.elapsed().as_secs_f64() * 1000.0;
            let (p, lid_ms) = check.join().unwrap();
            (text, p, lid_ms, bn_ms)
        });
        let english = p_en >= 0.8;
        let text = if english {
            en.transcribe(pcm.clone(), en_run.clone()).unwrap().text
        } else {
            bn_text
        };
        let total_ms = t.elapsed().as_secs_f64() * 1000.0;
        let line = serde_json::json!({
            "file": path, "truth": truth, "detected": if english {"en"} else {"bn"},
            "p_en": p_en, "lid_ms": lid_ms, "bn_ms": bn_ms, "total_ms": total_ms,
            "dur": pcm.len() as f64 / 16000.0, "text": text,
        });
        writeln!(f, "{line}").unwrap();
    }
    eprintln!("done");
}
