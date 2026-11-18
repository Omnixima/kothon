//! Apply Kothon's number cleanup (Latin digits) to one text per line and time it.
//!     cargo run --release --example kothon_numbers_bench -- IN.txt OUT.txt
use std::io::Write;
use std::time::Instant;

use kothon_app_lib::kothon_numbers::{clean, Digits};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let lines: Vec<String> = std::fs::read_to_string(&a[1])
        .unwrap()
        .lines()
        .map(str::to_string)
        .collect();
    let mut out = std::fs::File::create(&a[2]).unwrap();
    let t = Instant::now();
    for l in &lines {
        writeln!(out, "{}", clean(l, Digits::Latin, true)).unwrap();
    }
    eprintln!(
        "{:.1} µs per text",
        t.elapsed().as_secs_f64() * 1e6 / lines.len() as f64
    );
}
