//! Time the English-words rewrite over a text file (one text per line).
//!     cargo run --release --example kothon_english_bench -- IN.txt
use std::time::Instant;

fn main() {
    let path = std::env::args().nth(1).expect("IN.txt");
    let lines: Vec<String> = std::fs::read_to_string(path)
        .unwrap()
        .lines()
        .map(str::to_string)
        .collect();
    let t = Instant::now();
    let mut n = 0;
    for _ in 0..100 {
        for l in &lines {
            n += kothon_app_lib::kothon_english::english_words_in_english(l).len();
        }
    }
    let per = t.elapsed().as_secs_f64() * 1e6 / (100 * lines.len()) as f64;
    println!("{} texts x100, {:.1} µs per text ({n})", lines.len(), per);
}
