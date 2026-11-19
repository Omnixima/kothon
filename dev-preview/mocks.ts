// Dev-only: run the settings UI in a plain browser with a faked Tauri
// backend, so the design can be checked in screenshots without the app.
// Open http://localhost:1420/dev-preview/index.html with `bun run dev`.
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import settings from "./settings.json";

// ?onboarding=1 shows first-run setup; ?model=whisper selects Whisper;
// ?os=windows shows the app as it looks on Windows.
const params = new URLSearchParams(location.search);
if (params.get("onboarding")) settings.onboarding_completed = false;
const windows = params.get("os") === "windows";
if (windows) {
  const keys = settings.bindings as Record<
    string,
    { current_binding: string; default_binding: string }
  >;
  for (const b of Object.values(keys)) {
    b.current_binding = b.current_binding.replace("option", "ctrl");
    b.default_binding = b.default_binding.replace("option", "ctrl");
  }
}

declare global {
  interface Window {
    __TAURI_OS_PLUGIN_INTERNALS__: Record<string, string>;
  }
}

window.__TAURI_OS_PLUGIN_INTERNALS__ = windows
  ? {
      platform: "windows",
      version: "10.0.26100",
      family: "windows",
      os_type: "windows",
      arch: "x86_64",
      exe_extension: "exe",
      eol: "\r\n",
    }
  : {
      platform: "macos",
      version: "26.2",
      family: "unix",
      os_type: "macos",
      arch: "aarch64",
      exe_extension: "",
      eol: "\n",
    };
mockWindows("main");

const model = (
  id: string,
  name: string,
  description: string,
  size_mb: number,
  accuracy_score: number,
  speed_score: number,
  repo_id: string,
  is_downloaded: boolean,
  is_recommended = false,
) => ({
  id,
  name,
  description,
  filename: `${id}.gguf`,
  source: { HuggingFace: { repo_id, revision: "main" } },
  size_mb,
  is_downloaded,
  is_downloading: false,
  partial_size: 0,
  accuracy_score,
  speed_score,
  supports_translation: false,
  is_recommended,
  supported_languages: ["bn"],
  supports_language_selection: false,
  is_custom: false,
  supports_streaming: false,
  supports_language_detection: false,
});

const models = [
  model(
    "kothon-bn-fastconformer-116m",
    "Bangla FastConformer (দ্রুত)",
    "Bengali only. 116M FastConformer CTC (kazalbrur, Apache-2.0). Very fast, about 9% WER on FLEURS.",
    131,
    0.8,
    0.98,
    "omnixima/bangla-fastconformer-ctc-116m-gguf",
    true,
    true,
  ),
  model(
    "kothon-bn-whisper-medium",
    "Bangla Whisper Medium (নিখুঁত)",
    "Bengali only. BengaliAI Whisper-medium fine-tune (Apache-2.0). Most accurate, about 8% WER on FLEURS.",
    792,
    0.85,
    0.55,
    "omnixima/bengaliai-whisper-medium-gguf",
    false,
  ),
];

const history = [
  "আজ আবহাওয়া খুব সুন্দর। তুমি কি আজ অফিসে যাবে?",
  "রিপোর্টটা আমি সন্ধ্যার মধ্যে পাঠিয়ে দেব, তারপর মিটিংয়ে কথা বলব।",
  "কিছু জাহাজ তার বৈশিষ্ট্য পুস্তিকায় বার্লিন, জার্মানি দেখায়।",
].map((text, i) => ({
  id: i + 1,
  file_name: `rec-${i}.wav`,
  timestamp: Math.floor(Date.now() / 1000) - i * 3600,
  saved: i === 0,
  title: text.slice(0, 30),
  transcription_text: text,
  post_processed_text: null,
  post_process_prompt: null,
  model_id: "kothon-bn-fastconformer-116m",
  language: "bn",
}));

const answers: Record<string, unknown> = {
  get_app_settings: settings,
  get_default_settings: settings,
  get_available_models: models,
  get_current_model: "kothon-bn-fastconformer-116m",
  get_retired_models: [],
  get_active_notices: [],
  clear_history: 3,
  save_history_correction: [{ from: "পাঠিয়ে দেব", to: "পাঠাব", count: 1 }],
  fetch_post_process_models: [],
  get_history_entries: { entries: history, next_cursor: null },
  get_available_microphones: [
    { index: "0", name: "MacBook Pro Microphone", is_default: true },
  ],
  get_available_output_devices: [
    { index: "0", name: "MacBook Pro Speakers", is_default: true },
  ],
  is_recording: false,
  get_app_dir_path: "~/Library/Application Support/com.kothon.dictation",
  get_log_dir_path: "~/Library/Logs/com.kothon.dictation",
  "plugin:app|version": "0.1.0",
  is_update_checks_locked: false,
  "plugin:app|name": "Kothon",
  "plugin:macos-permissions|check_accessibility_permission": true,
  "plugin:macos-permissions|check_microphone_permission": true,
  "plugin:autostart|is_enabled": false,
  get_windows_microphone_permission_status: {
    supported: true,
    overall_access: "allowed",
  },
};

mockIPC((cmd) => {
  if (cmd in answers) return answers[cmd];
  if (cmd.startsWith("plugin:event|")) return 0;
  return null;
});
