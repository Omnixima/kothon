# Kothon phone API

A phone with Kothon can send its dictations to a computer instead of running
the model itself. This is for phones where on-device transcription is slow
(for example নিখুঁত on an Android CPU). It is off by default on both sides,
and the phone always falls back to its own model when the computer can't be
reached, so it never makes Kothon slower or less available.

Two programs serve this API:

- **The Kothon desktop app** (macOS, Windows, Linux): Settings › Advanced ›
  "Speed up your phone". It uses the model and GPU the desktop app already has
  (`src-tauri/src/kothon_phone_server.rs`).
- **The Kothon server** (Docker image, for a NAS or an always-on PC): runs both
  Bengali models with no window. Same API, same pairing link.

Audio and text go only between the phone and the computer. Nothing is stored
on the computer.

## Pairing

The computer shows a QR code holding a link:

```
kothon://pair?v=1&name=<computer name>&key=<key>&url=<url>&url=<url>
```

- `v`: API version (`1`).
- `name`: the computer's name, percent-encoded, shown on the phone.
- `key`: 32 hex characters. Every request needs it.
- `url`: one per address, best first, percent-encoded. Usually the local
  network address (`http://192.168.1.20:47821`) and, when Tailscale is running,
  the Tailscale address (`http://100.x.y.z:47821`).

The phone tries the URLs in order and keeps the first that answers
`/v1/health`. Scanning with the camera app opens Kothon directly (the
`kothon://` scheme).

## Requests

Every request carries `Authorization: Bearer <key>`. A wrong or missing key
gets `401 {"error":"unauthorized"}`. Port: `47821`.

### `GET /v1/health`

```json
{
  "app": "kothon",
  "api": 1,
  "version": "0.1.2",
  "name": "Mamuns-MacBook-Pro",
  "model": "kothon-bn-whisper-medium",
  "model_name": "Bangla Whisper Medium (নিখুঁত)",
  "bengali": true,
  "loaded": true
}
```

The phone uses the computer only when `bengali` is `true`. `loaded: false`
means the first dictation also waits for the model to load.

### `POST /v1/transcribe`

Body: the recording. Phones send 16 kHz mono 16-bit PCM WAV
(`Content-Type: audio/wav`); any format the desktop file importer reads (WAV,
M4A, MP3, Opus, ...) also works. At most 25 MB.

Query parameters, all optional, carry the phone's own text settings:

| Parameter       | Values                    | Meaning                                |
| --------------- | ------------------------- | -------------------------------------- |
| `numbers`       | `bengali`, `latin`, `off` | Spoken numbers as ০-৯, 0-9, or words   |
| `punctuation`   | `1`, `0`                  | Add Bengali punctuation (।, comma, ?)  |
| `english_words` | `1`, `0`                  | Write English words in English letters |

The computer's learned corrections are not applied; the phone applies its own
word list ("আমার শব্দ") to the text it gets back.

```json
{
  "text": "আমি আজকে অফিসে যাব।",
  "model": "kothon-bn-whisper-medium",
  "audio_ms": 4200,
  "elapsed_ms": 380
}
```

Errors (`{"error": "<code>"}`):

| Status | Code                   | Phone does                              |
| ------ | ---------------------- | --------------------------------------- |
| 400    | `bad_audio`            | Transcribes on the phone                |
| 401    | `unauthorized`         | Asks the user to scan the QR code again |
| 409    | `no_bengali_model`     | Transcribes on the phone                |
| 413    | `too_large`            | Transcribes on the phone                |
| 500    | `transcription_failed` | Transcribes on the phone                |
| 503    | `busy`                 | Transcribes on the phone                |

## Phone behavior

- Off by default. মডেল › "কম্পিউটার বা সার্ভার দিয়ে দ্রুত করুন" › "কম্পিউটার বা সার্ভার যুক্ত করুন" › scan the QR
  code, or "লিংক পেস্ট করুন" with the link from the computer's "Copy Link".
  A pair link opened from outside the app asks before it's used.
- Before each dictation the phone already knows whether the computer answered
  recently (a `/v1/health` check when the app opens and every 30 s while it's
  open, with a 1.5 s timeout). If not, it transcribes on the phone straight
  away, with no wait.
- Upload timeout: 10 s plus the length of the recording. On a timeout or any
  error the phone transcribes the same audio itself.
- The phone shows which one wrote the text ("কম্পিউটারে" or "ফোনে").

## Concurrency

Requests are handled in parallel, so `/v1/health` answers at once even while
a dictation is being written. One dictation runs at a time; a second one gets
`503 busy` straight away and its phone writes it itself.

## Platform notes

- iPhone: App Transport Security can't allow plain http to Tailscale's
  `100.x` addresses, so the app talks to the computer through Network.framework,
  which ATS doesn't cover. No ATS exception is needed.
- Android: plain http is allowed for the app, and the code only sends it to
  local-network, Tailscale, `.local` and `.ts.net` addresses.

## Security

- The key is the only credential. A new key ("Pair again" on the computer)
  unpairs every phone.
- The server listens on every network the computer is on, so the key also
  guards it on public Wi-Fi. For use outside home, Tailscale keeps it off the
  internet; don't forward the port on a router.
- Plain HTTP: traffic on the local network is not encrypted. Tailscale
  encrypts its tunnel.
