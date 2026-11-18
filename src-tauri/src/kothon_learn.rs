//! Kothon: learn from the user's corrections.
//!
//! When the user fixes a transcript in History, the words they changed are
//! compared with what the model wrote. Short replacements (one to three words
//! on each side, e.g. a name the model keeps mishearing) are remembered on
//! this computer and applied to every later transcription. Applying them is a
//! hash lookup per word, so it adds no noticeable time.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use specta::Type;

/// Longest phrase (in words) learned or matched on either side.
const MAX_PHRASE_WORDS: usize = 3;
/// Above this share of changed words the edit is a rewrite, not a fix.
const MAX_CHANGED_SHARE: f64 = 0.5;
/// Cap on stored corrections, oldest dropped first.
const MAX_STORED: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct LearnedCorrection {
    /// What the model wrote (punctuation stripped, words joined by spaces).
    pub from: String,
    /// What the user wants instead.
    pub to: String,
    /// How many times the user has made this fix.
    pub count: u32,
}

fn is_punct(c: char) -> bool {
    c.is_ascii_punctuation() || matches!(c, '।' | '॥' | '“' | '”' | '‘' | '’' | '…' | '—' | '–')
}

/// A word without its leading/trailing punctuation.
fn core(word: &str) -> &str {
    word.trim_matches(is_punct)
}

fn words(text: &str) -> Vec<&str> {
    text.split_whitespace()
        .filter(|w| !core(w).is_empty())
        .collect()
}

/// Word-level replacements between what the model wrote and what the user
/// kept, found with a longest-common-subsequence alignment.
pub fn diff_corrections(original: &str, corrected: &str) -> Vec<(String, String)> {
    let a: Vec<&str> = words(original).into_iter().map(core).collect();
    let b: Vec<&str> = words(corrected).into_iter().map(core).collect();
    if a.is_empty() || b.is_empty() {
        return Vec::new();
    }
    // LCS table, (n+1) x (m+1).
    let (n, m) = (a.len(), b.len());
    let mut lcs = vec![vec![0u32; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            lcs[i][j] = if a[i] == b[j] {
                lcs[i + 1][j + 1] + 1
            } else {
                lcs[i + 1][j].max(lcs[i][j + 1])
            };
        }
    }
    let changed = n.max(m) - lcs[0][0] as usize;
    if changed as f64 > MAX_CHANGED_SHARE * n.max(m) as f64 {
        return Vec::new();
    }
    // Walk the alignment, collecting each run of differing words.
    let mut out = Vec::new();
    let (mut i, mut j) = (0, 0);
    let (mut from, mut to): (Vec<&str>, Vec<&str>) = (Vec::new(), Vec::new());
    let mut flush = |from: &mut Vec<&str>, to: &mut Vec<&str>| {
        // Only substitutions: a pure insertion or deletion has no "wrong word".
        if !from.is_empty()
            && !to.is_empty()
            && from.len() <= MAX_PHRASE_WORDS
            && to.len() <= MAX_PHRASE_WORDS
        {
            out.push((from.join(" "), to.join(" ")));
        }
        from.clear();
        to.clear();
    };
    while i < n || j < m {
        if i < n && j < m && a[i] == b[j] {
            flush(&mut from, &mut to);
            i += 1;
            j += 1;
        } else if j < m && (i == n || lcs[i][j + 1] >= lcs[i + 1][j]) {
            to.push(b[j]);
            j += 1;
        } else {
            from.push(a[i]);
            i += 1;
        }
    }
    flush(&mut from, &mut to);
    out
}

/// Merge newly learned pairs into the stored list (most recent last).
pub fn merge(stored: &mut Vec<LearnedCorrection>, learned: &[(String, String)]) {
    for (from, to) in learned {
        if let Some(pos) = stored.iter().position(|c| &c.from == from) {
            let mut c = stored.remove(pos);
            if &c.to == to {
                c.count += 1;
            } else {
                c.to = to.clone();
                c.count = 1;
            }
            stored.push(c);
        } else {
            stored.push(LearnedCorrection {
                from: from.clone(),
                to: to.clone(),
                count: 1,
            });
        }
    }
    if stored.len() > MAX_STORED {
        let extra = stored.len() - MAX_STORED;
        stored.drain(..extra);
    }
}

/// Apply learned corrections to a transcript, longest phrase first, keeping
/// the punctuation around the replaced words.
pub fn apply(text: &str, corrections: &[LearnedCorrection]) -> String {
    if corrections.is_empty() || text.is_empty() {
        return text.to_string();
    }
    let map: HashMap<&str, &str> = corrections
        .iter()
        .map(|c| (c.from.as_str(), c.to.as_str()))
        .collect();
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let mut out: Vec<String> = Vec::with_capacity(tokens.len());
    let mut i = 0;
    'outer: while i < tokens.len() {
        for n in (1..=MAX_PHRASE_WORDS.min(tokens.len() - i)).rev() {
            let span = &tokens[i..i + n];
            // Don't match across punctuation inside the phrase.
            if span[..n - 1]
                .iter()
                .any(|w| w.chars().last().is_some_and(is_punct))
            {
                continue;
            }
            let key = span.iter().map(|w| core(w)).collect::<Vec<_>>().join(" ");
            if let Some(to) = map.get(key.as_str()) {
                let first = span[0];
                let last = span[n - 1];
                let lead = &first[..first.len() - first.trim_start_matches(is_punct).len()];
                let trail = &last[last.trim_end_matches(is_punct).len()..];
                out.push(format!("{lead}{to}{trail}"));
                i += n;
                continue 'outer;
            }
        }
        out.push(tokens[i].to_string());
        i += 1;
    }
    out.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn learns_single_word_fix() {
        let d = diff_corrections("আমি ঢাকায় যাব।", "আমি ঢাকা যাব।");
        assert_eq!(d, vec![("ঢাকায়".to_string(), "ঢাকা".to_string())]);
    }

    #[test]
    fn learns_multi_word_name() {
        let d = diff_corrections("মামুন রশিদ আজ আসবে", "মামুনুর রশীদ আজ আসবে");
        assert_eq!(d, vec![("মামুন রশিদ".to_string(), "মামুনুর রশীদ".to_string())]);
    }

    #[test]
    fn ignores_punctuation_only_edits_and_rewrites() {
        assert!(diff_corrections("আজ আবহাওয়া ভালো", "আজ আবহাওয়া ভালো।").is_empty());
        assert!(diff_corrections("এক দুই তিন চার", "পাঁচ ছয় সাত আট").is_empty());
    }

    #[test]
    fn ignores_pure_insertions_and_deletions() {
        assert!(diff_corrections("আমি যাব", "আমি কাল যাব").is_empty());
        assert!(diff_corrections("আমি কাল যাব", "আমি যাব").is_empty());
    }

    #[test]
    fn applies_with_punctuation_kept() {
        let mut stored = Vec::new();
        merge(&mut stored, &[("কথোন".into(), "কথন".into())]);
        assert_eq!(
            apply("আমি কথোন, ব্যবহার করি।", &stored),
            "আমি কথন, ব্যবহার করি।"
        );
        assert_eq!(apply("কথোন।", &stored), "কথন।");
    }

    #[test]
    fn longest_phrase_wins() {
        let mut stored = Vec::new();
        merge(
            &mut stored,
            &[
                ("মামুন".into(), "মামুন".into()),
                ("মামুন রশিদ".into(), "মামুনুর রশীদ".into()),
            ],
        );
        assert_eq!(apply("মামুন রশিদ এসেছে", &stored), "মামুনুর রশীদ এসেছে");
    }

    #[test]
    fn merge_counts_repeats_and_updates() {
        let mut stored = Vec::new();
        merge(&mut stored, &[("a".into(), "b".into())]);
        merge(&mut stored, &[("a".into(), "b".into())]);
        assert_eq!(stored[0].count, 2);
        merge(&mut stored, &[("a".into(), "c".into())]);
        assert_eq!((stored[0].to.as_str(), stored[0].count), ("c", 1));
    }
}
