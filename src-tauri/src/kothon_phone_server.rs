//! Kothon: let a phone send its dictations to this computer.
//!
//! A phone with Kothon can be slow, above all with the নিখুঁত model on an
//! Android CPU. When the user turns this on, Kothon listens on the local
//! network (and on Tailscale, when it's running) and transcribes what a
//! paired phone sends, with this computer's model and GPU. The phone pairs by
//! scanning a QR code that holds this computer's addresses and a key, and it
//! falls back to its own model whenever this computer can't be reached.
//!
//! The HTTP API is in docs/kothon-phone-api.md. Every request needs the key
//! as `Authorization: Bearer <key>`. Audio and text never leave the two
//! devices.

use std::io::{Cursor, Read};
use std::net::{IpAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use log::{info, warn};
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

use crate::managers::transcription::TranscriptionManager;
use crate::settings::{self, AppSettings};

/// The port phones connect to.
pub const PORT: u16 = 47821;
/// Version of the API in docs/kothon-phone-api.md.
pub const API_VERSION: u32 = 1;
/// Largest upload accepted: about 13 minutes of 16 kHz 16-bit WAV.
const MAX_BODY_BYTES: usize = 25 * 1024 * 1024;

static SERVER: Mutex<Option<Arc<Server>>> = Mutex::new(None);

/// What the Settings page shows to pair a phone.
#[derive(Debug, Clone, Serialize, Type)]
pub struct PhonePairing {
    /// Whether the server is listening right now.
    pub running: bool,
    /// The addresses a phone can reach this computer at, best first.
    pub urls: Vec<String>,
    /// This computer's name, shown on the phone.
    pub name: String,
    /// The `kothon://pair?...` link the QR code holds.
    pub link: String,
    /// The QR code of `link`, as an SVG document.
    pub qr_svg: String,
}

/// Starts or stops the server to match the settings. Called at startup and
/// whenever the switch changes.
pub fn apply_settings(app: &AppHandle) {
    let mut settings = settings::get_settings(app);
    if settings.phone_server_enabled {
        if settings.phone_server_key.is_empty() {
            settings.phone_server_key = new_key();
            settings::write_settings(app, settings.clone());
        }
        start(app);
    } else {
        stop();
    }
}

/// A fresh key; phones paired with the old one have to scan again.
pub fn reset_key(app: &AppHandle) {
    let mut settings = settings::get_settings(app);
    settings.phone_server_key = new_key();
    settings::write_settings(app, settings);
}

fn new_key() -> String {
    let mut bytes = [0u8; 16];
    if getrandom::fill(&mut bytes).is_err() {
        // No OS randomness is all but impossible; still never use a fixed key.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        bytes = nanos.to_le_bytes();
    }
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn start(app: &AppHandle) {
    let mut guard = SERVER.lock().unwrap();
    if guard.is_some() {
        return;
    }
    let server = match Server::http(("0.0.0.0", PORT)) {
        Ok(server) => Arc::new(server),
        Err(e) => {
            warn!("Kothon phone server: can't listen on port {PORT}: {e}");
            return;
        }
    };
    info!("Kothon phone server: listening on port {PORT}");
    *guard = Some(server.clone());
    let app = app.clone();
    // One request at a time: the model runs one transcription at a time anyway.
    thread::spawn(move || {
        for request in server.incoming_requests() {
            handle(&app, request);
        }
        info!("Kothon phone server: stopped");
    });
}

fn stop() {
    if let Some(server) = SERVER.lock().unwrap().take() {
        server.unblock();
    }
}

pub fn is_running() -> bool {
    SERVER.lock().unwrap().is_some()
}

/// The pairing details for the Settings page.
pub fn pairing(app: &AppHandle) -> PhonePairing {
    let settings = settings::get_settings(app);
    let urls: Vec<String> = local_addresses()
        .into_iter()
        .map(|ip| format!("http://{ip}:{PORT}"))
        .collect();
    let name = computer_name();
    let mut link = format!(
        "kothon://pair?v={API_VERSION}&name={}&key={}",
        percent_encode(&name),
        settings.phone_server_key
    );
    for url in &urls {
        link.push_str("&url=");
        link.push_str(&percent_encode(url));
    }
    let qr_svg = qrcode::QrCode::new(link.as_bytes())
        .map(|code| {
            code.render::<qrcode::render::svg::Color>()
                .min_dimensions(220, 220)
                .quiet_zone(true)
                .build()
        })
        .unwrap_or_default();
    PhonePairing {
        running: is_running(),
        urls,
        name,
        link,
        qr_svg,
    }
}

/// This computer's addresses on the local network and on Tailscale. Asking
/// the OS which address it would send from finds each one without sending
/// anything.
fn local_addresses() -> Vec<IpAddr> {
    // A public address picks the network the computer is on; Tailscale's
    // fixed DNS address picks its tunnel when Tailscale is up.
    let probes = ["192.0.2.1:9", "100.100.100.100:53"];
    let mut found = Vec::new();
    for probe in probes {
        let ip = UdpSocket::bind("0.0.0.0:0")
            .and_then(|socket| socket.connect(probe).map(|_| socket))
            .and_then(|socket| socket.local_addr())
            .map(|addr| addr.ip());
        if let Ok(ip) = ip {
            if !ip.is_unspecified() && !ip.is_loopback() && !found.contains(&ip) {
                found.push(ip);
            }
        }
    }
    found
}

fn computer_name() -> String {
    #[cfg(unix)]
    {
        let mut buf = [0u8; 256];
        // SAFETY: the buffer is valid for its whole length.
        let ok = unsafe { libc::gethostname(buf.as_mut_ptr().cast(), buf.len()) } == 0;
        if ok {
            let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
            let name = String::from_utf8_lossy(&buf[..end]).to_string();
            let name = name.trim_end_matches(".local").to_string();
            if !name.is_empty() {
                return name;
            }
        }
    }
    #[cfg(windows)]
    if let Ok(name) = std::env::var("COMPUTERNAME") {
        if !name.is_empty() {
            return name;
        }
    }
    "Kothon".to_string()
}

fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn handle(app: &AppHandle, mut request: Request) {
    let settings = settings::get_settings(app);
    let (path, query) = match request.url().split_once('?') {
        Some((path, query)) => (path.to_string(), query.to_string()),
        None => (request.url().to_string(), String::new()),
    };
    if !authorized(&request, &settings.phone_server_key) {
        respond(
            request,
            401,
            &serde_json::json!({ "error": "unauthorized" }),
        );
        return;
    }
    match (request.method(), path.as_str()) {
        (Method::Get, "/v1/health") => {
            let body = health(app, &settings);
            respond(request, 200, &body);
        }
        (Method::Post, "/v1/transcribe") => {
            let mut body = Vec::new();
            let read = request
                .as_reader()
                .take(MAX_BODY_BYTES as u64 + 1)
                .read_to_end(&mut body);
            if read.is_err() {
                respond(request, 400, &serde_json::json!({ "error": "bad_body" }));
                return;
            }
            if body.len() > MAX_BODY_BYTES {
                respond(request, 413, &serde_json::json!({ "error": "too_large" }));
                return;
            }
            let (status, reply) = transcribe(app, &settings, &query, body);
            respond(request, status, &reply);
        }
        _ => respond(request, 404, &serde_json::json!({ "error": "not_found" })),
    }
}

/// Compares the bearer key in constant time.
fn authorized(request: &Request, key: &str) -> bool {
    if key.is_empty() {
        return false;
    }
    let given = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))
        .and_then(|h| h.value.as_str().strip_prefix("Bearer "))
        .unwrap_or("");
    given.len() == key.len()
        && given
            .bytes()
            .zip(key.bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0
}

fn health(app: &AppHandle, settings: &AppSettings) -> serde_json::Value {
    let tm = app.state::<Arc<TranscriptionManager>>();
    let model = tm
        .get_current_model()
        .unwrap_or_else(|| settings.selected_model.clone());
    let bengali = crate::kothon::bengali_model(&model);
    serde_json::json!({
        "app": "kothon",
        "api": API_VERSION,
        "version": env!("CARGO_PKG_VERSION"),
        "name": computer_name(),
        "model": model,
        "model_name": bengali.map(|m| m.name),
        "bengali": bengali.is_some(),
        "loaded": tm.is_model_loaded(),
    })
}

fn transcribe(
    app: &AppHandle,
    settings: &AppSettings,
    query: &str,
    body: Vec<u8>,
) -> (u16, serde_json::Value) {
    let tm = app.state::<Arc<TranscriptionManager>>();
    let model = tm
        .get_current_model()
        .unwrap_or_else(|| settings.selected_model.clone());
    if crate::kothon::bengali_model(&model).is_none() {
        // The phone dictates Bengali; an English model here would be wrong.
        return (409, serde_json::json!({ "error": "no_bengali_model" }));
    }
    if tm.ensure_model_unlocked().is_err() {
        return (503, serde_json::json!({ "error": "busy" }));
    }
    let audio = match decode(body) {
        Ok(audio) => audio,
        Err(e) => {
            warn!("Kothon phone server: unreadable audio: {e:#}");
            return (400, serde_json::json!({ "error": "bad_audio" }));
        }
    };
    let options = TextOptions::from_query(query);
    let audio_ms = audio.len() as u64 * 1000 / 16_000;
    let started = Instant::now();
    match tm.transcribe_for_phone(audio, &|s| options.apply(s)) {
        Ok(result) => {
            let elapsed_ms = started.elapsed().as_millis() as u64;
            info!("Kothon phone server: {audio_ms} ms of audio in {elapsed_ms} ms");
            (
                200,
                serde_json::json!({
                    "text": result.text,
                    "model": model,
                    "audio_ms": audio_ms,
                    "elapsed_ms": elapsed_ms,
                }),
            )
        }
        Err(e) => {
            warn!("Kothon phone server: transcription failed: {e:#}");
            (500, serde_json::json!({ "error": "transcription_failed" }))
        }
    }
}

/// The phone's own text settings, sent with each dictation.
#[derive(Debug, Default, PartialEq)]
struct TextOptions {
    numbers: Option<String>,
    punctuation: Option<bool>,
    english_words: Option<bool>,
}

impl TextOptions {
    fn from_query(query: &str) -> Self {
        let mut options = TextOptions::default();
        for pair in query.split('&') {
            let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
            match k {
                "numbers" if matches!(v, "bengali" | "latin" | "off") => {
                    options.numbers = Some(v.to_string())
                }
                "punctuation" => options.punctuation = parse_bool(v),
                "english_words" => options.english_words = parse_bool(v),
                _ => {}
            }
        }
        options
    }

    fn apply(&self, settings: &mut AppSettings) {
        if let Some(numbers) = &self.numbers {
            settings.bengali_numbers = numbers.clone();
        }
        if let Some(on) = self.punctuation {
            settings.bengali_punctuation_enabled = on;
        }
        if let Some(on) = self.english_words {
            settings.english_words_in_english = on;
        }
        // The phone has its own word list; this computer's isn't the phone's.
        settings.learn_from_corrections_enabled = false;
        // A phone dictation is never translated or post-processed here.
        settings.translate_to_english = false;
    }
}

fn parse_bool(v: &str) -> Option<bool> {
    match v {
        "1" | "true" => Some(true),
        "0" | "false" => Some(false),
        _ => None,
    }
}

/// Any audio the file importer reads (WAV, M4A, Opus, ...), as 16 kHz mono.
fn decode(body: Vec<u8>) -> anyhow::Result<Vec<f32>> {
    // 16 kHz mono 16-bit WAV, what both phone apps send, skips the importer.
    if let Ok(reader) = hound::WavReader::new(Cursor::new(&body)) {
        let spec = reader.spec();
        if spec.sample_rate == 16_000
            && spec.channels == 1
            && spec.bits_per_sample == 16
            && spec.sample_format == hound::SampleFormat::Int
        {
            return Ok(reader
                .into_samples::<i16>()
                .filter_map(Result::ok)
                .map(|s| s as f32 / 32768.0)
                .collect());
        }
    }
    let dir = std::env::temp_dir().join(format!("kothon-phone-{}", std::process::id()));
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("upload.audio");
    std::fs::write(&path, &body)?;
    let result = crate::audio_toolkit::audio::decode_audio_file(&path);
    let _ = std::fs::remove_file(&path);
    result
}

fn respond(request: Request, status: u16, body: &serde_json::Value) {
    let data = body.to_string().into_bytes();
    let response = Response::new(
        StatusCode(status),
        vec![Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap()],
        Cursor::new(data.clone()),
        Some(data.len()),
        None,
    );
    let _ = request.respond(response);
}

/// Turns the phone server on or off.
#[tauri::command]
#[specta::specta]
pub fn change_phone_server_enabled_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.phone_server_enabled = enabled;
    settings::write_settings(&app, settings);
    apply_settings(&app);
    Ok(())
}

/// What the Settings page shows to pair a phone.
#[tauri::command]
#[specta::specta]
pub fn get_phone_pairing(app: AppHandle) -> PhonePairing {
    pairing(&app)
}

/// Makes a new key, so phones paired before have to scan again.
#[tauri::command]
#[specta::specta]
pub fn reset_phone_server_key(app: AppHandle) -> PhonePairing {
    reset_key(&app);
    pairing(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_phones_text_options() {
        let options = TextOptions::from_query("numbers=latin&punctuation=0&english_words=1&x=y");
        assert_eq!(
            options,
            TextOptions {
                numbers: Some("latin".to_string()),
                punctuation: Some(false),
                english_words: Some(true),
            }
        );
        assert_eq!(
            TextOptions::from_query("numbers=roman"),
            TextOptions::default()
        );
    }

    #[test]
    fn keys_are_random_hex() {
        let a = new_key();
        assert_eq!(a.len(), 32);
        assert!(a.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_ne!(a, new_key());
    }

    #[test]
    fn link_text_is_percent_encoded() {
        assert_eq!(
            percent_encode("http://10.0.0.2:47821"),
            "http%3A%2F%2F10.0.0.2%3A47821"
        );
        assert_eq!(percent_encode("Mamun's Mac"), "Mamun%27s%20Mac");
    }

    #[test]
    fn reads_16k_wav() {
        let mut buf = Cursor::new(Vec::new());
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut w = hound::WavWriter::new(&mut buf, spec).unwrap();
        for s in [0i16, 16384, -16384] {
            w.write_sample(s).unwrap();
        }
        w.finalize().unwrap();
        assert_eq!(decode(buf.into_inner()).unwrap(), vec![0.0, 0.5, -0.5]);
    }
}
