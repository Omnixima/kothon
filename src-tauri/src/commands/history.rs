use crate::managers::{
    history::{HistoryEntry, HistoryManager, PaginatedHistory},
    transcription_jobs::TranscriptionJobManager,
};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
#[specta::specta]
pub async fn get_history_entries(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    cursor: Option<i64>,
    limit: Option<usize>,
) -> Result<PaginatedHistory, String> {
    history_manager
        .get_history_entries(cursor, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_history_entry_saved(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .toggle_saved_status(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_audio_file_path(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    file_name: String,
) -> Result<String, String> {
    let path = history_manager.get_audio_file_path(&file_name);
    path.to_str()
        .ok_or_else(|| "Invalid file path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_history_entry(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    jobs: State<'_, Arc<TranscriptionJobManager>>,
    id: i64,
) -> Result<(), String> {
    jobs.cancel(id);
    history_manager
        .delete_entry(id)
        .await
        .map_err(|e| e.to_string())
}

/// Queues the entry to be transcribed again with the current model. Its
/// progress and outcome arrive as `TranscriptionJob` events.
#[tauri::command]
#[specta::specta]
pub fn retry_history_entry_transcription(jobs: State<'_, Arc<TranscriptionJobManager>>, id: i64) {
    jobs.retry(id);
}

/// Stops the entry's background transcription: a queued one is dropped, a
/// running one stops after the chunk it is on. The entry keeps the text it
/// had before.
#[tauri::command]
#[specta::specta]
pub fn cancel_history_entry_transcription(jobs: State<'_, Arc<TranscriptionJobManager>>, id: i64) {
    jobs.cancel(id);
}

/// Adds an audio or video file to History and queues its transcription.
/// Fails without adding anything if the file has no audio Kothon can read.
#[tauri::command]
#[specta::specta]
pub async fn transcribe_file(
    jobs: State<'_, Arc<TranscriptionJobManager>>,
    path: String,
) -> Result<HistoryEntry, String> {
    let jobs = Arc::clone(&jobs);
    tauri::async_runtime::spawn_blocking(move || jobs.transcribe_file(PathBuf::from(path)))
        .await
        .map_err(|e| format!("Failed to read the file: {}", e))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_history_limit(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    limit: usize,
) -> Result<(), String> {
    let mut settings = crate::settings::get_settings(&app);
    settings.history_limit = limit;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn update_recording_retention_period(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    period: String,
) -> Result<(), String> {
    use crate::settings::RecordingRetentionPeriod;

    let retention_period = match period.as_str() {
        "never" => RecordingRetentionPeriod::Never,
        "preserve_limit" => RecordingRetentionPeriod::PreserveLimit,
        "days3" => RecordingRetentionPeriod::Days3,
        "weeks2" => RecordingRetentionPeriod::Weeks2,
        "months3" => RecordingRetentionPeriod::Months3,
        _ => return Err(format!("Invalid retention period: {}", period)),
    };

    let mut settings = crate::settings::get_settings(&app);
    settings.recording_retention_period = retention_period;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Kothon: save the user's fix of a transcript and learn the words they
/// changed. Returns the corrections learned from this edit.
#[tauri::command]
#[specta::specta]
pub async fn save_history_correction(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
    corrected_text: String,
) -> Result<Vec<crate::kothon_learn::LearnedCorrection>, String> {
    let entry = history_manager
        .get_entry_by_id(id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("History entry {id} not found"))?;
    let original = entry.transcription_text.clone();
    let corrected = corrected_text.trim().to_string();
    history_manager
        .set_entry_text(id, corrected.clone())
        .map_err(|e| e.to_string())?;

    let mut settings = crate::settings::get_settings(&app);
    if !settings.learn_from_corrections_enabled {
        return Ok(Vec::new());
    }
    let learned = crate::kothon_learn::diff_corrections(&original, &corrected);
    if learned.is_empty() {
        return Ok(Vec::new());
    }
    crate::kothon_learn::merge(&mut settings.learned_corrections, &learned);
    let out = settings
        .learned_corrections
        .iter()
        .filter(|c| learned.iter().any(|(from, _)| from == &c.from))
        .cloned()
        .collect();
    crate::settings::write_settings(&app, settings);
    Ok(out)
}

/// Kothon: forget one learned correction.
#[tauri::command]
#[specta::specta]
pub fn remove_learned_correction(app: AppHandle, from: String) -> Result<(), String> {
    let mut settings = crate::settings::get_settings(&app);
    settings.learned_corrections.retain(|c| c.from != from);
    crate::settings::write_settings(&app, settings);
    Ok(())
}

/// Kothon: delete all history, text and audio.
#[tauri::command]
#[specta::specta]
pub fn clear_history(history_manager: State<'_, Arc<HistoryManager>>) -> Result<u32, String> {
    history_manager
        .clear_all()
        .map(|n| n as u32)
        .map_err(|e| e.to_string())
}
