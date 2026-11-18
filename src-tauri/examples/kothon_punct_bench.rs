//! Punctuate one unpunctuated text per input line with the Kothon Bengali
//! punctuator and print the result, plus timing on stderr.
//!
//!     cargo run --release --example kothon_punct_bench -- MODEL_DIR IN.txt OUT.txt

use std::io::Write;
use std::time::Instant;

use kothon_app_lib::kothon_punct::Punctuator;

fn main() -> anyhow::Result<()> {
    let a: Vec<String> = std::env::args().collect();
    let t = Instant::now();
    let p = Punctuator::load(std::path::Path::new(&a[1]))?;
    eprintln!("load {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
    let lines: Vec<String> = std::fs::read_to_string(&a[2])?
        .lines()
        .map(str::to_string)
        .collect();
    p.punctuate(&lines[0])?; // warm-up
    let mut out = std::fs::File::create(&a[3])?;
    let mut lat = Vec::new();
    for l in &lines {
        let t = Instant::now();
        let r = p.punctuate(l)?;
        lat.push(t.elapsed().as_secs_f64() * 1000.0);
        writeln!(out, "{r}")?;
    }
    lat.sort_by(|a, b| a.partial_cmp(b).unwrap());
    eprintln!(
        "{} texts, median {:.1} ms, p95 {:.1} ms, max {:.1} ms",
        lat.len(),
        lat[lat.len() / 2],
        lat[lat.len() * 95 / 100],
        lat[lat.len() - 1]
    );
    Ok(())
}
