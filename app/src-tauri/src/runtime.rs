mod commands;
mod desktop;
mod domain;
mod storage;
mod timer_engine;

pub(crate) use commands::{
    acknowledge_timer_alert, bootstrap_shell, clear_app_data, complete_focus_session,
    create_manual_focus_record, create_todo_item, delete_focus_record, delete_focus_records,
    delete_todo_item, export_app_backup, export_app_backup_to_path, get_analytics_snapshot,
    get_app_preferences, get_focus_plan, get_focus_records, get_timer_preferences,
    get_timer_snapshot, get_todo_items, import_app_backup, import_app_backup_path,
    list_app_backups, open_app_backup_folder, pause_timer, preview_app_backup_path, reset_timer,
    restore_focus_record, restore_todo_item, set_countdown_minutes, start_timer, switch_timer_mode,
    toggle_todo_item, update_app_preferences, update_focus_plan, update_focus_record,
    update_focus_record_title, update_timer_context, update_timer_preferences,
    update_todo_continuation_note, update_todo_item,
};
#[cfg(target_os = "macos")]
pub(crate) use desktop::trigger_native_smoke_tray_click;
pub(crate) use desktop::{
    build_floating_window, build_system_tray, build_unlock_window, close_main_window,
    close_utility_window, ensure_focus_floating_window, ensure_focus_unlock_window,
    ensure_todo_floating_window, ensure_todo_unlock_window, flash_main_window_attention,
    hide_main_window, lock_floating_todos, lock_focus_floating, minimize_main_window,
    quit_application, refresh_system_tray_menu, restore_main_from_floating_todos,
    restore_main_from_focus_floating, show_floating_todos, show_focus_floating, show_main_window,
    show_main_window_from_tray, snapshot_from_timer_state, start_dragging_main_window,
    toggle_maximize_main_window, unlock_floating_todos, unlock_focus_floating,
};
#[cfg(windows)]
pub(crate) use desktop::{
    build_windows_tray_menu, default_tray_snapshot, initial_tray_snapshot, navigate_from_tray,
    toggle_timer_from_tray, tray_can_continue, tray_has_progress, tray_status_text, tray_task_text,
    tray_timer_action,
};
pub(crate) use domain::{
    stopwatch_next_target_ms, stopwatch_stage_index_for_elapsed, AlertKind, AlertSoundKey,
    TimerPreferences, TimerPreferencesSnapshot, DEFAULT_COUNTDOWN_MINUTES,
    DEFAULT_STOPWATCH_REMINDER_MINUTES, MAX_COUNTDOWN_MINUTES, MAX_TODO_TITLE_CHARS,
    MIN_COUNTDOWN_MINUTES, STOPWATCH_STAGE_MINUTES,
};
pub(crate) use timer_engine::{
    elapsed_since_anchor_ms, elapsed_since_anchor_ms_at, format_duration_ms,
    normalize_countdown_duration_ms, normalize_focus_plan, parse_alert_key_value, parse_mode,
    parse_mode_key_value, parse_phase_key_value, system_time_to_epoch_ms, with_timer_engine,
    CompletedSession, PersistedBundle, RunAnchor, TimerEngine, TimerEngineState,
};

use std::cmp::Reverse;
use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use chrono::{Duration as ChronoDuration, Local, NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use storage::{
    AppBackupFile, PersistedRuntimeState, PersistedState, PersistenceStore,
    CURRENT_STORAGE_SCHEMA_VERSION,
};
use tauri::{Manager, WindowEvent};

const APP_VERSION: &str = "2.12.0";
const APP_MILESTONE: &str = "v2.12.0 From capture to continuation; Windows-only release";
const APP_BACKUP_KIND: &str = "focused-moment-backup";
const APP_BACKUP_FORMAT_VERSION: u64 = 3;
const FLOATING_WORKSPACE_SYNC_EVENT: &str = "floating-workspace-sync";

const DEFAULT_THEME_ID: &str = "night-valley";
const DEFAULT_VISUAL_INTENSITY: u8 = 72;
const DEFAULT_MOTION_INTENSITY: u8 = 44;
const DEFAULT_FLOATING_OPACITY: u8 = 100;
const MIN_FLOATING_OPACITY: u8 = 45;
// A 5 MiB audio file expands to roughly 6.7 MiB when encoded as a data URL.
// Keep the persisted representation bounded to the equivalent of the UI's
// 5 MiB file limit while leaving room for the MIME header.
const MAX_CUSTOM_ALERT_SOUND_DATA_CHARS: usize = 7 * 1024 * 1024;

fn legacy_schema_version() -> u64 {
    1
}

fn default_theme_id() -> String {
    DEFAULT_THEME_ID.to_string()
}

fn default_visual_intensity() -> u8 {
    DEFAULT_VISUAL_INTENSITY
}

fn default_motion_intensity() -> u8 {
    DEFAULT_MOTION_INTENSITY
}

fn default_floating_opacity() -> u8 {
    DEFAULT_FLOATING_OPACITY
}

fn default_density() -> String {
    "roomy".to_string()
}

fn default_record_source() -> String {
    "timer".to_string()
}

fn default_record_time_basis() -> String {
    "completion_day".to_string()
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppPreferences {
    #[serde(default = "legacy_schema_version")]
    schema_version: u64,
    #[serde(default = "default_theme_id")]
    theme_id: String,
    #[serde(default = "default_visual_intensity")]
    visual_intensity: u8,
    #[serde(default = "default_motion_intensity")]
    motion_intensity: u8,
    #[serde(default = "default_density")]
    density: String,
    #[serde(default = "default_floating_opacity")]
    floating_opacity: u8,
    #[serde(default)]
    auto_mini_on_start: bool,
    #[serde(default)]
    custom_alert_sound_name: String,
    #[serde(default)]
    custom_alert_sound_data: Option<String>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            theme_id: default_theme_id(),
            visual_intensity: DEFAULT_VISUAL_INTENSITY,
            motion_intensity: DEFAULT_MOTION_INTENSITY,
            density: default_density(),
            floating_opacity: DEFAULT_FLOATING_OPACITY,
            auto_mini_on_start: false,
            custom_alert_sound_name: String::new(),
            custom_alert_sound_data: None,
        }
    }
}

impl AppPreferences {
    fn normalized(mut self) -> Result<Self, String> {
        self.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
        self.visual_intensity = self.visual_intensity.min(100);
        self.motion_intensity = self.motion_intensity.min(100);
        self.floating_opacity = self
            .floating_opacity
            .clamp(MIN_FLOATING_OPACITY, DEFAULT_FLOATING_OPACITY);
        if self.theme_id.trim().is_empty() {
            self.theme_id = default_theme_id();
        }
        self.density = if self.density == "compact" {
            "compact".to_string()
        } else {
            default_density()
        };
        if self.custom_alert_sound_name.chars().count() > 255 {
            return Err("自定义音效名称过长，无法保存。".to_string());
        }
        if let Some(data) = &self.custom_alert_sound_data {
            if data.chars().count() > MAX_CUSTOM_ALERT_SOUND_DATA_CHARS {
                return Err("自定义音效数据超过 5MB，无法保存。".to_string());
            }
        }
        if self.custom_alert_sound_data.is_none() {
            self.custom_alert_sound_name.clear();
        }
        Ok(self)
    }
}

#[derive(Clone, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FocusPlanState {
    #[serde(default)]
    current_todo_id: Option<u64>,
    #[serde(default)]
    today_pick_ids: Vec<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellPanel {
    id: &'static str,
    title: &'static str,
    phase: &'static str,
    status: &'static str,
    summary: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellSnapshot {
    product_name: &'static str,
    version: &'static str,
    milestone: &'static str,
    slogan: &'static str,
    surfaces: Vec<ShellPanel>,
    reserved_extensions: Vec<ShellPanel>,
}

struct AppLifecycleState {
    is_quitting: Mutex<bool>,
}

impl AppLifecycleState {
    fn new() -> Self {
        Self {
            is_quitting: Mutex::new(false),
        }
    }

    fn mark_quitting(&self) {
        if let Ok(mut flag) = self.is_quitting.lock() {
            *flag = true;
        }
    }

    fn is_quitting(&self) -> bool {
        self.is_quitting.lock().map(|flag| *flag).unwrap_or(false)
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerSnapshot {
    mode_key: &'static str,
    phase_key: &'static str,
    mode: &'static str,
    phase_label: &'static str,
    status: &'static str,
    is_running: bool,
    elapsed_ms: u64,
    elapsed_label: String,
    target_duration_ms: Option<u64>,
    remaining_ms: Option<u64>,
    secondary_label: &'static str,
    can_complete_session: bool,
    has_unsubmitted_progress: bool,
    active_task_title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
    current_round: u64,
    completed_focus_count: u64,
    completed_break_count: u64,
    recovered_from_last_session: bool,
    mode_switch_locked: bool,
    mode_switch_hint: Option<String>,
    alert_sequence: u64,
    alert_key: Option<&'static str>,
    alert_title: Option<&'static str>,
    alert_message: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FocusRecord {
    id: u64,
    title: String,
    duration_ms: u64,
    duration_label: String,
    mode_key: String,
    mode_label: String,
    phase_label: String,
    linked_todo_id: Option<u64>,
    linked_todo_title: Option<String>,
    #[serde(default)]
    completed_at: String,
    #[serde(default)]
    completed_date: String,
    #[serde(default)]
    completed_time: String,
    #[serde(default = "default_record_source")]
    source: String,
    #[serde(default = "default_record_time_basis")]
    time_basis: String,
    #[serde(default)]
    edited_at: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletionPayload {
    timer_snapshot: TimerSnapshot,
    records: Vec<FocusRecord>,
    todo_items: Vec<TodoItem>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupListItem {
    file_name: String,
    exported_at: String,
    app_version: String,
    format_version: u64,
    schema_version: u64,
    migration_needed: bool,
    focus_record_count: usize,
    todo_count: usize,
    has_runtime_session: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupExportResult {
    file_name: String,
    file_path: String,
    exported_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupImportResult {
    imported_file_name: String,
    rollback_file_name: String,
    focus_record_count: usize,
    todo_count: usize,
    restored_runtime_session: bool,
    migrated_from_format_version: Option<u64>,
    restored_app_preferences: bool,
}

#[derive(Clone, Copy)]
pub(crate) struct BackupImportOptions {
    pub(crate) restore_todos: bool,
    pub(crate) restore_records: bool,
    pub(crate) restore_app_preferences: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyInsight {
    date: String,
    total_duration_ms: u64,
    total_duration_label: String,
    session_count: usize,
    linked_session_count: usize,
    independent_session_count: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsSnapshot {
    total_focus_duration_ms: u64,
    total_focus_duration_label: String,
    session_count: usize,
    linked_session_count: usize,
    independent_session_count: usize,
    pending_todo_count: usize,
    completed_todo_count: usize,
    active_days: usize,
    average_daily_duration_label: String,
    today_focus_duration_label: String,
    today_session_count: usize,
    current_streak_days: usize,
    best_focus_date: Option<String>,
    best_focus_duration_label: Option<String>,
    daily_breakdown: Vec<DailyInsight>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoItem {
    id: u64,
    title: String,
    is_completed: bool,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
    #[serde(default)]
    continuation_note: String,
    #[serde(default)]
    continuation_updated_at: Option<String>,
}

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum TimerMode {
    #[default]
    Stopwatch,
    Countdown,
    Pomodoro,
}

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum PomodoroPhase {
    #[default]
    Focus,
    Break,
}

impl TimerMode {
    fn key(self) -> &'static str {
        match self {
            TimerMode::Stopwatch => "stopwatch",
            TimerMode::Countdown => "countdown",
            TimerMode::Pomodoro => "pomodoro",
        }
    }
}

impl PomodoroPhase {
    fn key(self) -> &'static str {
        match self {
            PomodoroPhase::Focus => "focus",
            PomodoroPhase::Break => "break",
        }
    }
}

fn normalize_todo_title(title: &str) -> Result<String, String> {
    let normalized = title.trim();
    if normalized.is_empty() {
        Err("\u{4efb}\u{52a1}\u{540d}\u{79f0}\u{4e0d}\u{80fd}\u{4e3a}\u{7a7a}".to_string())
    } else if normalized.chars().count() > MAX_TODO_TITLE_CHARS {
        Err(format!("任务名称不能超过 {MAX_TODO_TITLE_CHARS} 个字。"))
    } else {
        Ok(normalized.to_string())
    }
}

fn normalize_focus_record_title(title: &str) -> Result<String, String> {
    let normalized = title.trim();
    if normalized.is_empty() {
        Err("记录名称不能为空。".to_string())
    } else if normalized.chars().count() > MAX_TODO_TITLE_CHARS {
        Err(format!("记录名称不能超过 {MAX_TODO_TITLE_CHARS} 个字。"))
    } else {
        Ok(normalized.to_string())
    }
}

pub(crate) fn normalize_focus_record(
    mut record: FocusRecord,
    todo_items: &[TodoItem],
) -> Result<FocusRecord, String> {
    record.title = normalize_focus_record_title(&record.title)?;
    if record.duration_ms == 0 {
        return Err("专注记录时长必须大于 0。".to_string());
    }

    let had_completed_date = !record.completed_date.trim().is_empty();
    let had_completed_time = !record.completed_time.trim().is_empty();
    let completed_date = if !had_completed_date {
        record
            .completed_at
            .get(..10)
            .and_then(|value| normalize_scheduled_date(value).ok())
            .unwrap_or_default()
    } else {
        normalize_scheduled_date(&record.completed_date)?
    };
    if completed_date.is_empty() {
        return Err("专注记录需要填写完成日期。".to_string());
    }

    let completed_time = if !had_completed_time {
        record
            .completed_at
            .get(11..16)
            .and_then(|value| normalize_scheduled_time(value).ok())
            .unwrap_or_default()
    } else {
        normalize_scheduled_time(&record.completed_time)?
    };

    record.completed_date = completed_date;
    record.completed_time = completed_time;
    if record.completed_at.trim().is_empty() || !had_completed_date || !had_completed_time {
        record.completed_at = if record.completed_time.is_empty() {
            format!("{} 00:00:00", record.completed_date)
        } else {
            format!("{} {}:00", record.completed_date, record.completed_time)
        };
    }
    if record.duration_label.trim().is_empty() {
        record.duration_label = format_duration_ms(record.duration_ms);
    }

    record.mode_key = match record.mode_key.as_str() {
        "stopwatch" | "countdown" | "pomodoro" => record.mode_key,
        // Early 2.12 builds used `manual` as a mode key.  The public contract
        // intentionally keeps manual entry in `source`, so repair that
        // compatibility value without widening the mode union.
        "manual" if record.source == "manual" => "stopwatch".to_string(),
        _ => return Err("专注记录包含不支持的计时模式。".to_string()),
    };
    record.source = match record.source.as_str() {
        "timer" | "manual" => record.source,
        _ => return Err("专注记录包含不支持的来源。".to_string()),
    };
    record.time_basis = match record.time_basis.as_str() {
        "completion_day" => "completion_day".to_string(),
        _ => return Err("专注记录包含不支持的日期归属方式。".to_string()),
    };

    if let Some(todo_id) = record.linked_todo_id {
        if !todo_items.iter().any(|item| item.id == todo_id) {
            // Keep the historical title for review, but never keep a dangling
            // numeric reference after a selective restore or todo deletion.
            record.linked_todo_id = None;
        }
    }

    Ok(record)
}

pub(crate) fn normalize_todo_item(mut item: TodoItem) -> Result<TodoItem, String> {
    item.title = normalize_todo_title(&item.title)?;
    item.scheduled_date = normalize_scheduled_date(&item.scheduled_date)?;
    item.scheduled_time = normalize_scheduled_time(&item.scheduled_time)?;
    item.importance_key = normalize_importance_key(&item.importance_key)?;
    item.continuation_note = normalize_continuation_note(&item.continuation_note)?;
    if item.continuation_note.is_empty() {
        item.continuation_updated_at = None;
    }
    Ok(item)
}

fn normalize_persisted_collections(
    todo_items: Vec<TodoItem>,
    focus_records: Vec<FocusRecord>,
) -> Result<(Vec<TodoItem>, Vec<FocusRecord>), String> {
    let todo_items = todo_items
        .into_iter()
        .map(normalize_todo_item)
        .collect::<Result<Vec<_>, _>>()?;
    let mut todo_ids = HashSet::new();
    if todo_items.iter().any(|item| !todo_ids.insert(item.id)) {
        return Err("待办数据包含重复的 ID。".to_string());
    }
    let focus_records = focus_records
        .into_iter()
        .map(|record| normalize_focus_record(record, &todo_items))
        .collect::<Result<Vec<_>, _>>()?;
    let mut record_ids = HashSet::new();
    if focus_records
        .iter()
        .any(|record| !record_ids.insert(record.id))
    {
        return Err("专注记录包含重复的 ID。".to_string());
    }
    Ok((todo_items, focus_records))
}

fn normalize_scheduled_date(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Ok(String::new());
    }
    let is_valid = normalized.len() == 10
        && normalized
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                4 | 7 => ch == '-',
                _ => ch.is_ascii_digit(),
            });

    if is_valid && NaiveDate::parse_from_str(normalized, "%Y-%m-%d").is_ok() {
        Ok(normalized.to_string())
    } else {
        Err("\u{8bf7}\u{9009}\u{62e9}\u{6709}\u{6548}\u{7684}\u{65e5}\u{671f}".to_string())
    }
}

fn normalize_continuation_note(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.chars().count() > 1000 {
        return Err("停笔书签不能超过 1000 个字。".to_string());
    }
    Ok(normalized.to_string())
}

fn normalize_scheduled_time(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Ok(String::new());
    }

    let is_valid = normalized.len() == 5
        && normalized
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                2 => ch == ':',
                _ => ch.is_ascii_digit(),
            });

    if is_valid && NaiveTime::parse_from_str(normalized, "%H:%M").is_ok() {
        Ok(normalized.to_string())
    } else {
        Err(
            "\u{8bf7}\u{9009}\u{62e9}\u{6709}\u{6548}\u{7684}\u{5f00}\u{59cb}\u{65f6}\u{95f4}"
                .to_string(),
        )
    }
}

fn normalize_importance_key(value: &str) -> Result<String, String> {
    match value.trim() {
        "low" => Ok("low".to_string()),
        "medium" => Ok("medium".to_string()),
        "high" => Ok("high".to_string()),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{91cd}\u{8981}\u{7a0b}\u{5ea6}".to_string()),
    }
}

fn importance_rank(value: &str) -> u8 {
    match value {
        "high" => 0,
        "medium" => 1,
        "low" => 2,
        _ => 3,
    }
}

fn next_focus_record_id(records: &[FocusRecord]) -> u64 {
    records
        .iter()
        .map(|record| record.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn next_todo_id_value(items: &[TodoItem]) -> u64 {
    items
        .iter()
        .map(|item| item.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn sort_focus_records(records: &mut [FocusRecord]) {
    records.sort_by(|left, right| Reverse(left.id).cmp(&Reverse(right.id)));
}

fn scheduled_time_sort_key(value: &str) -> (bool, &str) {
    (value.trim().is_empty(), value)
}

fn sort_todo_items(items: &mut [TodoItem]) {
    items.sort_by(|left, right| {
        left.is_completed
            .cmp(&right.is_completed)
            .then_with(|| left.scheduled_date.cmp(&right.scheduled_date))
            .then_with(|| {
                scheduled_time_sort_key(&left.scheduled_time)
                    .cmp(&scheduled_time_sort_key(&right.scheduled_time))
            })
            .then_with(|| {
                importance_rank(&left.importance_key).cmp(&importance_rank(&right.importance_key))
            })
            .then_with(|| Reverse(left.id).cmp(&Reverse(right.id)))
    });
}

fn current_local_markers() -> (String, String, String) {
    let now = Local::now();
    (
        now.format("%Y-%m-%d %H:%M:%S").to_string(),
        now.format("%Y-%m-%d").to_string(),
        now.format("%H:%M").to_string(),
    )
}

fn record_completed_at(record: &FocusRecord) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(&record.completed_at, "%Y-%m-%d %H:%M:%S")
        .ok()
        .or_else(|| {
            NaiveDateTime::parse_from_str(
                &format!("{} {}", record.completed_date, record.completed_time),
                "%Y-%m-%d %H:%M",
            )
            .ok()
        })
}

fn split_record_duration_by_date(record: &FocusRecord) -> Vec<(String, u64)> {
    let fallback_date = if record.completed_date.trim().is_empty() {
        "未记录日期".to_string()
    } else {
        record.completed_date.clone()
    };
    vec![(fallback_date, record.duration_ms)]
}

fn analytics_snapshot(records: &[FocusRecord], todo_items: &[TodoItem]) -> AnalyticsSnapshot {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let total_focus_duration_ms = records.iter().map(|record| record.duration_ms).sum::<u64>();
    let session_count = records.len();
    let linked_session_count = records
        .iter()
        .filter(|record| record.linked_todo_id.is_some())
        .count();
    let independent_session_count = session_count.saturating_sub(linked_session_count);
    let pending_todo_count = todo_items.iter().filter(|item| !item.is_completed).count();
    let completed_todo_count = todo_items.iter().filter(|item| item.is_completed).count();

    let mut grouped = BTreeMap::<String, DailyInsight>::new();
    for record in records {
        for (date, duration_ms) in split_record_duration_by_date(record) {
            let day = grouped.entry(date.clone()).or_insert(DailyInsight {
                date,
                total_duration_ms: 0,
                total_duration_label: String::new(),
                session_count: 0,
                linked_session_count: 0,
                independent_session_count: 0,
            });
            day.total_duration_ms = day.total_duration_ms.saturating_add(duration_ms);
            day.session_count += 1;
            if record.linked_todo_id.is_some() {
                day.linked_session_count += 1;
            }
        }
    }

    let mut daily_breakdown = grouped
        .into_iter()
        .map(|(_, mut day)| {
            day.total_duration_label = format_duration_ms(day.total_duration_ms);
            day.independent_session_count =
                day.session_count.saturating_sub(day.linked_session_count);
            day
        })
        .collect::<Vec<_>>();

    daily_breakdown.sort_by(|left, right| right.date.cmp(&left.date));

    let active_days = daily_breakdown.len();
    let average_daily_duration_ms = if active_days == 0 {
        0
    } else {
        total_focus_duration_ms / active_days as u64
    };

    let today_summary = daily_breakdown
        .iter()
        .find(|day| day.date == today)
        .cloned()
        .unwrap_or(DailyInsight {
            date: today.clone(),
            total_duration_ms: 0,
            total_duration_label: format_duration_ms(0),
            session_count: 0,
            linked_session_count: 0,
            independent_session_count: 0,
        });

    let active_dates = daily_breakdown
        .iter()
        .filter_map(|day| NaiveDate::parse_from_str(&day.date, "%Y-%m-%d").ok())
        .collect::<HashSet<_>>();
    let current_streak_days = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
        .ok()
        .map(|mut date| {
            let mut streak = 0;
            while active_dates.contains(&date) {
                streak += 1;
                date -= ChronoDuration::days(1);
            }
            streak
        })
        .unwrap_or(0);
    let best_focus_day = daily_breakdown
        .iter()
        .filter(|day| day.date != "未记录日期" && day.total_duration_ms > 0)
        .max_by_key(|day| day.total_duration_ms);

    AnalyticsSnapshot {
        total_focus_duration_ms,
        total_focus_duration_label: format_duration_ms(total_focus_duration_ms),
        session_count,
        linked_session_count,
        independent_session_count,
        pending_todo_count,
        completed_todo_count,
        active_days,
        average_daily_duration_label: format_duration_ms(average_daily_duration_ms),
        today_focus_duration_label: today_summary.total_duration_label,
        today_session_count: today_summary.session_count,
        current_streak_days,
        best_focus_date: best_focus_day.map(|day| day.date.clone()),
        best_focus_duration_label: best_focus_day.map(|day| day.total_duration_label.clone()),
        daily_breakdown,
    }
}

pub(crate) fn migrate_backup_file(
    mut backup: AppBackupFile,
) -> Result<(AppBackupFile, Option<u64>), String> {
    if backup.kind != APP_BACKUP_KIND {
        return Err("这不是 Focused Moment 的完整备份文件。".to_string());
    }

    let highest_schema_version = backup
        .schema_version
        .max(backup.state.schema_version)
        .max(backup.runtime.schema_version);
    if highest_schema_version > CURRENT_STORAGE_SCHEMA_VERSION {
        return Err("这份备份来自更新版本，当前版本无法安全恢复。".to_string());
    }

    let original_format_version = backup.format_version;
    match original_format_version {
        1 | 2 => {
            backup.format_version = APP_BACKUP_FORMAT_VERSION;
            backup.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.state.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.runtime.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            Ok((backup, Some(original_format_version)))
        }
        APP_BACKUP_FORMAT_VERSION => {
            backup.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.state.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.runtime.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            Ok((backup, None))
        }
        _ => Err("当前版本暂不支持这个备份格式。".to_string()),
    }
}

fn with_todo_items<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut Vec<TodoItem>) -> Result<T, String>,
) -> Result<T, String> {
    state.ensure_ready()?;
    let mut items = state.todo_items.lock().map_err(|_| {
        "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    f(&mut items)
}

fn with_focus_records<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut Vec<FocusRecord>) -> Result<T, String>,
) -> Result<T, String> {
    state.ensure_ready()?;
    let mut records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;

    f(&mut records)
}

fn create_backup_file_name(prefix: &str) -> String {
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    format!("{prefix}{timestamp}.json")
}

fn normalize_imported_runtime(
    mut runtime: PersistedRuntimeState,
    todo_items: &[TodoItem],
    preferences: TimerPreferences,
) -> PersistedRuntimeState {
    if runtime.is_running {
        runtime.anchor_wall_clock_ms = Some(system_time_to_epoch_ms(SystemTime::now()));
    } else {
        runtime.anchor_wall_clock_ms = None;
    }

    if let Some(linked_todo_id) = runtime.linked_todo_id {
        if !todo_items
            .iter()
            .any(|item| item.id == linked_todo_id && !item.is_completed)
        {
            runtime.linked_todo_id = None;
        }
    }

    if parse_mode_key_value(&runtime.mode_key).is_err() {
        runtime.mode_key = TimerMode::default().key().to_string();
    }

    if parse_phase_key_value(&runtime.pomodoro_phase_key).is_err() {
        runtime.pomodoro_phase_key = PomodoroPhase::default().key().to_string();
    }

    let mut engine = TimerEngine::from_persisted_runtime(runtime, preferences);
    engine.persisted_runtime_state()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_sound_keys_round_trip_through_runtime_preferences() {
        for raw_key in [
            "soft_chime",
            "bright_bell",
            "deep_pulse",
            "wooden_tick",
            "glass_ping",
            "morning_chord",
            "viral_quote",
            "custom",
        ] {
            let parsed: AlertSoundKey =
                serde_json::from_str(&format!("\"{raw_key}\"")).expect("valid alert sound key");
            assert_eq!(parsed.key(), raw_key);
            assert_eq!(
                serde_json::to_string(&parsed).expect("serialize alert sound key"),
                format!("\"{raw_key}\"")
            );
        }

        let normalized = TimerPreferences {
            alert_sound_key: AlertSoundKey::ViralQuote,
            ..TimerPreferences::default()
        }
        .normalized()
        .expect("legacy sound key is accepted");
        assert!(matches!(
            normalized.alert_sound_key,
            AlertSoundKey::SoftChime
        ));
    }

    #[test]
    fn empty_scheduled_date_is_a_valid_inbox_value() {
        assert_eq!(
            normalize_scheduled_date("").expect("empty date is inbox"),
            ""
        );
        assert_eq!(
            normalize_scheduled_date("  ").expect("whitespace date is inbox"),
            ""
        );
        assert!(normalize_scheduled_date("2026-02-30").is_err());
    }

    #[test]
    fn legacy_focus_record_defaults_keep_completion_day_attribution() {
        let legacy = r#"{
            "id": 7,
            "title": "旧记录",
            "durationMs": 60000,
            "durationLabel": "00:01:00",
            "modeKey": "stopwatch",
            "modeLabel": "正向计时",
            "phaseLabel": "正向计时",
            "linkedTodoId": null,
            "linkedTodoTitle": null,
            "completedAt": "2026-09-05 12:00:00",
            "completedDate": "2026-09-05",
            "completedTime": "12:00"
        }"#;
        let record: FocusRecord = serde_json::from_str(legacy).expect("legacy record parses");
        assert_eq!(record.source, "timer");
        assert_eq!(record.time_basis, "completion_day");
        assert_eq!(record.edited_at, None);
    }

    #[cfg(windows)]
    #[test]
    fn tray_menu_presentation_reflects_timer_state() {
        let mut timer = TimerEngine::default();
        let initial = timer.snapshot();

        assert!(!initial.has_unsubmitted_progress);
        assert_eq!(tray_status_text(&initial), "当前状态：未开始");
        assert_eq!(tray_task_text(&initial), "当前事项：尚未指定");
        assert_eq!(tray_timer_action(&initial), ("没有可继续的计时", false));

        timer.update_context("整理 Windows 托盘".to_string(), None, false);
        timer.start();
        let running = timer.snapshot();
        assert!(running.has_unsubmitted_progress);
        assert_eq!(tray_timer_action(&running), ("暂停计时", true));

        timer.pause();
        timer.stopwatch_elapsed_ms = 125_000;
        let paused = timer.snapshot();
        assert_eq!(
            tray_status_text(&paused),
            "当前状态：已暂停 · 已用 00:02:05"
        );
        assert_eq!(tray_task_text(&paused), "当前事项：整理 Windows 托盘");
        assert_eq!(tray_timer_action(&paused), ("继续计时", true));

        timer.update_context(format!("{}\n下一行", "a".repeat(40)), None, false);
        let long_title = tray_task_text(&timer.snapshot());
        assert!(!long_title.contains('\n'));
        assert!(long_title.ends_with('…'));

        let mut completed_countdown = TimerEngine {
            mode: TimerMode::Countdown,
            countdown_duration_ms: 60_000,
            countdown_elapsed_ms: 60_000,
            ..TimerEngine::default()
        };
        let completed = completed_countdown.snapshot();
        assert_eq!(
            tray_timer_action(&completed),
            ("计时已结束，请打开计时页", false)
        );
        assert!(tray_has_progress(&completed));
    }

    fn isolated_root() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is before unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "focused-moment-runtime-test-{}-{suffix}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).expect("create isolated runtime fixture");
        root
    }

    fn cleanup_isolated_root(root: &std::path::Path) {
        let _ = std::fs::remove_dir_all(root);
    }

    fn rewind_timer_anchor(timer: &mut TimerEngine, elapsed_ms: u64) {
        let elapsed = Duration::from_millis(elapsed_ms);
        // Keep the synthetic elapsed time in the wall clock so this helper does
        // not assume the host has been running longer than a focus session.
        timer.running_anchor = Some(RunAnchor {
            monotonic: Instant::now(),
            wall_clock: SystemTime::now() - elapsed,
        });
    }

    fn state_with_store(
        store: PersistenceStore,
        next_record_id: u64,
        stopwatch_elapsed_ms: u64,
    ) -> TimerEngineState {
        TimerEngineState {
            timer: Mutex::new(TimerEngine {
                stopwatch_elapsed_ms,
                ..TimerEngine::default()
            }),
            timer_preferences: Mutex::new(TimerPreferences::default()),
            app_preferences: Mutex::new(AppPreferences::default()),
            focus_plan: Mutex::new(FocusPlanState::default()),
            focus_records: Mutex::new(Vec::new()),
            next_record_id: Mutex::new(next_record_id),
            todo_items: Mutex::new(Vec::new()),
            next_todo_id: Mutex::new(0),
            persistence: Some(store),
            startup_error: None,
        }
    }

    fn fixture_todo(id: u64, title: &str) -> TodoItem {
        TodoItem {
            id,
            title: title.to_string(),
            is_completed: false,
            scheduled_date: Local::now().format("%Y-%m-%d").to_string(),
            scheduled_time: String::new(),
            importance_key: "medium".to_string(),
            continuation_note: String::new(),
            continuation_updated_at: None,
        }
    }

    fn fixture_record(id: u64, todo_id: Option<u64>, title: &str) -> FocusRecord {
        FocusRecord {
            id,
            title: title.to_string(),
            duration_ms: 25 * 60_000,
            duration_label: "00:25:00".to_string(),
            mode_key: "stopwatch".to_string(),
            mode_label: "正向计时".to_string(),
            phase_label: "正向计时".to_string(),
            linked_todo_id: todo_id,
            linked_todo_title: todo_id.map(|id| format!("事项 {id}")),
            completed_at: "2026-09-19 12:00:00".to_string(),
            completed_date: "2026-09-19".to_string(),
            completed_time: "12:00".to_string(),
            source: "timer".to_string(),
            time_basis: "completion_day".to_string(),
            edited_at: None,
        }
    }

    fn seed_persisted_bundle(root: &std::path::Path) {
        let store = PersistenceStore::for_test(root).expect("create seed store");
        store
            .save(&PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                next_record_id: 1,
                ..PersistedState::default()
            })
            .expect("save seed state");
        store
            .save_runtime(&PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                stopwatch_elapsed_ms: 1_000,
                ..PersistedRuntimeState::default()
            })
            .expect("save seed runtime");
    }

    #[test]
    fn persistence_failure_is_not_reported_as_success() {
        let state = TimerEngineState {
            timer: Mutex::new(TimerEngine::default()),
            timer_preferences: Mutex::new(TimerPreferences::default()),
            app_preferences: Mutex::new(AppPreferences::default()),
            focus_plan: Mutex::new(FocusPlanState::default()),
            focus_records: Mutex::new(Vec::new()),
            next_record_id: Mutex::new(0),
            todo_items: Mutex::new(Vec::new()),
            next_todo_id: Mutex::new(0),
            persistence: None,
            startup_error: Some("测试中的持久化不可用".to_string()),
        };

        assert!(state.persist().is_err());
        assert!(state.persist_runtime().is_err());
        assert!(state.persist_all().is_err());
    }

    #[test]
    fn persist_all_rolls_back_memory_and_disk_when_runtime_commit_fails() {
        let root = isolated_root();
        seed_persisted_bundle(&root);
        let faulty_store =
            PersistenceStore::for_test_with_failure(&root, storage::SaveStage::RuntimePromoteNew)
                .expect("create faulty store");
        let state = state_with_store(faulty_store, 2, 2_000);

        let error = state
            .persist_all()
            .expect_err("runtime commit failure must be reported");
        assert!(error.contains("保存本地状态与运行态失败"));
        assert_eq!(
            state
                .snapshot_state()
                .expect("snapshot state")
                .next_record_id,
            1
        );
        assert_eq!(
            state
                .snapshot_runtime_state()
                .expect("snapshot runtime")
                .stopwatch_elapsed_ms,
            1_000
        );

        let recovered_store = PersistenceStore::for_test(&root).expect("reopen recovered store");
        assert_eq!(
            recovered_store
                .load()
                .expect("load recovered state")
                .next_record_id,
            1
        );
        assert_eq!(
            recovered_store
                .load_runtime()
                .expect("load recovered runtime")
                .stopwatch_elapsed_ms,
            1_000
        );
        cleanup_isolated_root(&root);
    }

    #[test]
    fn backup_import_failure_restores_the_previous_bundle() {
        let root = isolated_root();
        seed_persisted_bundle(&root);
        let faulty_store =
            PersistenceStore::for_test_with_failure(&root, storage::SaveStage::RuntimePromoteNew)
                .expect("create faulty store");
        let state = state_with_store(faulty_store, 1, 1_000);
        let backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-08T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                next_record_id: 2,
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                stopwatch_elapsed_ms: 2_000,
                ..PersistedRuntimeState::default()
            },
        };

        assert!(state.apply_backup_file(backup).is_err());
        assert_eq!(
            state
                .snapshot_state()
                .expect("snapshot state")
                .next_record_id,
            1
        );
        assert_eq!(
            state
                .snapshot_runtime_state()
                .expect("snapshot runtime")
                .stopwatch_elapsed_ms,
            1_000
        );
        cleanup_isolated_root(&root);
    }

    #[test]
    fn persisted_countdown_keeps_all_legal_durations() {
        let preferences = TimerPreferences::default();

        for minutes in [1, 5, 24, 25, 60, 720] {
            let duration_ms = minutes * 60_000;
            let runtime = PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "countdown".to_string(),
                countdown_duration_ms: duration_ms,
                countdown_elapsed_ms: duration_ms - 1_000,
                ..PersistedRuntimeState::default()
            };
            let mut timer = TimerEngine::from_persisted_runtime(runtime, preferences);
            let snapshot = timer.countdown_snapshot();
            let persisted = timer.persisted_runtime_state();

            assert_eq!(snapshot.target_duration_ms, Some(duration_ms));
            assert_eq!(snapshot.remaining_ms, Some(1_000));
            assert_eq!(persisted.countdown_duration_ms, duration_ms);
        }
    }

    #[test]
    fn invalid_persisted_countdown_duration_uses_the_default() {
        let preferences = TimerPreferences::default();
        let default_duration_ms = DEFAULT_COUNTDOWN_MINUTES * 60_000;

        for duration_ms in [0, 90_000, (MAX_COUNTDOWN_MINUTES + 1) * 60_000] {
            let runtime = PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "countdown".to_string(),
                countdown_duration_ms: duration_ms,
                countdown_elapsed_ms: u64::MAX,
                ..PersistedRuntimeState::default()
            };
            let mut timer = TimerEngine::from_persisted_runtime(runtime, preferences);
            let snapshot = timer.countdown_snapshot();
            let persisted = timer.persisted_runtime_state();

            assert_eq!(snapshot.target_duration_ms, Some(default_duration_ms));
            assert_eq!(snapshot.remaining_ms, Some(0));
            assert_eq!(persisted.countdown_duration_ms, default_duration_ms);
            assert_eq!(persisted.countdown_elapsed_ms, default_duration_ms);
        }
    }

    #[test]
    fn restored_countdown_preserves_paused_running_and_completed_states() {
        let preferences = TimerPreferences::default();
        let duration_ms = 5 * 60_000;
        let cases = [
            (false, 2 * 60_000, None, "已暂停"),
            (true, 2 * 60_000, None, "倒计时中"),
            (false, duration_ms, Some("countdown_complete"), "已结束"),
        ];

        for (is_running, elapsed_ms, active_alert_key, expected_status) in cases {
            let runtime = PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "countdown".to_string(),
                countdown_duration_ms: duration_ms,
                countdown_elapsed_ms: elapsed_ms,
                is_running,
                anchor_wall_clock_ms: is_running
                    .then(|| system_time_to_epoch_ms(SystemTime::now())),
                active_alert_key: active_alert_key.map(str::to_string),
                ..PersistedRuntimeState::default()
            };
            let timer = TimerEngine::from_persisted_runtime(runtime, preferences);

            assert_eq!(timer.countdown_snapshot().status, expected_status);
        }
    }

    #[test]
    fn backup_import_preserves_a_short_countdown_duration() {
        let root = isolated_root();
        seed_persisted_bundle(&root);
        let store = PersistenceStore::for_test(&root).expect("create import store");
        let state = state_with_store(store, 1, 1_000);
        let duration_ms = 5 * 60_000;
        let elapsed_ms = 2 * 60_000;
        let backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-08T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "countdown".to_string(),
                countdown_duration_ms: duration_ms,
                countdown_elapsed_ms: elapsed_ms,
                ..PersistedRuntimeState::default()
            },
        };

        state
            .apply_backup_file(backup)
            .expect("import short countdown backup");

        let runtime = state
            .snapshot_runtime_state()
            .expect("snapshot imported runtime");
        assert_eq!(runtime.countdown_duration_ms, duration_ms);
        assert_eq!(runtime.countdown_elapsed_ms, elapsed_ms);

        let recovered_store = PersistenceStore::for_test(&root).expect("reopen import store");
        let recovered_runtime = recovered_store
            .load_runtime()
            .expect("load imported runtime");
        assert_eq!(recovered_runtime.countdown_duration_ms, duration_ms);
        assert_eq!(recovered_runtime.countdown_elapsed_ms, elapsed_ms);
        cleanup_isolated_root(&root);
    }

    #[test]
    fn portable_backup_round_trip_survives_copy_and_restart() {
        let source_root = isolated_root();
        let destination_root = isolated_root();
        let source_store = PersistenceStore::for_test(&source_root).expect("create source store");
        let preferences = TimerPreferences {
            pomodoro_focus_minutes: 50,
            pomodoro_break_minutes: 10,
            stopwatch_reminder_minutes: Some(90),
            toast_reminder_enabled: false,
            window_attention_reminder_enabled: true,
            sound_reminder_enabled: false,
            alert_sound_key: AlertSoundKey::Custom,
        };
        let app_preferences = AppPreferences {
            custom_alert_sound_name: "migration-check.mp3".to_string(),
            custom_alert_sound_data: Some("data:audio/mpeg;base64,AA==".to_string()),
            ..AppPreferences::default()
        };
        let source_state = TimerEngineState {
            timer: Mutex::new(TimerEngine {
                mode: TimerMode::Pomodoro,
                stopwatch_elapsed_ms: 1_600_000,
                countdown_elapsed_ms: 123_000,
                countdown_duration_ms: 300_000,
                pomodoro_elapsed_ms: 123_000,
                pomodoro_phase: PomodoroPhase::Break,
                pending_pomodoro_record_ms: Some(1_500_000),
                current_task_title: "跨设备搬移演练".to_string(),
                linked_todo_id: Some(42),
                complete_linked_todo_on_finish: true,
                completed_focus_count: 3,
                completed_break_count: 2,
                pomodoro_focus_ms: preferences.pomodoro_focus_ms(),
                pomodoro_break_ms: preferences.pomodoro_break_ms(),
                stopwatch_reminder_ms: preferences.stopwatch_reminder_ms(),
                stopwatch_stage_index: 2,
                alert_sequence: 7,
                active_alert_kind: Some(AlertKind::PomodoroBreakComplete),
                ..TimerEngine::default()
            }),
            timer_preferences: Mutex::new(preferences),
            app_preferences: Mutex::new(app_preferences),
            focus_plan: Mutex::new(FocusPlanState::default()),
            focus_records: Mutex::new(vec![FocusRecord {
                id: 41,
                title: "完成迁移验证".to_string(),
                duration_ms: 1_500_000,
                duration_label: "25 分钟".to_string(),
                mode_key: "pomodoro".to_string(),
                mode_label: "番茄钟".to_string(),
                phase_label: "专注".to_string(),
                linked_todo_id: Some(42),
                linked_todo_title: Some("跨设备数据搬移".to_string()),
                completed_at: "2026-09-09T16:30:00+08:00".to_string(),
                completed_date: "2026-09-09".to_string(),
                completed_time: "16:30".to_string(),
                source: "timer".to_string(),
                time_basis: "completion_day".to_string(),
                edited_at: None,
            }]),
            next_record_id: Mutex::new(42),
            todo_items: Mutex::new(vec![TodoItem {
                id: 42,
                title: "跨设备数据搬移".to_string(),
                is_completed: false,
                scheduled_date: "2026-09-10".to_string(),
                scheduled_time: "09:30".to_string(),
                importance_key: "high".to_string(),
                continuation_note: String::new(),
                continuation_updated_at: None,
            }]),
            next_todo_id: Mutex::new(43),
            persistence: Some(source_store.clone()),
            startup_error: None,
        };

        source_state
            .persist_all()
            .expect("persist source account before export");
        let expected_state = source_state
            .snapshot_state()
            .expect("snapshot source state");
        let expected_runtime = source_state
            .snapshot_runtime_state()
            .expect("snapshot source runtime");
        let backup = source_state
            .export_backup_file()
            .expect("export source backup");
        let file_name = "focused-moment-backup-v2-portability-test.json";
        let source_backup_path = source_store
            .save_user_backup(file_name, &backup)
            .expect("save source backup");

        let destination_store =
            PersistenceStore::for_test(&destination_root).expect("create clean destination store");
        let destination_backup_path = destination_store
            .user_backup_dir()
            .expect("create destination backup directory")
            .join(file_name);
        std::fs::copy(&source_backup_path, &destination_backup_path)
            .expect("copy portable backup into destination account");
        let imported_backup = destination_store
            .load_user_backup(file_name)
            .expect("load copied backup");
        let destination_state = state_with_store(destination_store.clone(), 0, 0);

        let import_result = destination_state
            .apply_backup_file(imported_backup)
            .expect("import copied backup");
        assert_eq!(import_result.focus_record_count, 1);
        assert_eq!(import_result.todo_count, 1);
        assert!(import_result.restored_runtime_session);
        assert!(destination_store
            .list_user_backups()
            .expect("list destination backups")
            .iter()
            .any(|(name, _)| name == file_name));

        let imported_state = destination_state
            .snapshot_state()
            .expect("snapshot imported destination state");
        let imported_runtime = destination_state
            .snapshot_runtime_state()
            .expect("snapshot imported destination runtime");
        assert_eq!(
            serde_json::to_value(&expected_state).expect("serialize expected state"),
            serde_json::to_value(imported_state).expect("serialize imported state")
        );
        assert_eq!(
            serde_json::to_value(&expected_runtime).expect("serialize expected runtime"),
            serde_json::to_value(imported_runtime).expect("serialize imported runtime")
        );

        let restarted_store =
            PersistenceStore::for_test(&destination_root).expect("reopen destination account");
        assert_eq!(
            serde_json::to_value(&expected_state).expect("serialize expected state after restart"),
            serde_json::to_value(
                restarted_store
                    .load()
                    .expect("load destination state after restart")
            )
            .expect("serialize destination state after restart")
        );
        assert_eq!(
            serde_json::to_value(&expected_runtime)
                .expect("serialize expected runtime after restart"),
            serde_json::to_value(
                restarted_store
                    .load_runtime()
                    .expect("load destination runtime after restart")
            )
            .expect("serialize destination runtime after restart")
        );
        cleanup_isolated_root(&source_root);
        cleanup_isolated_root(&destination_root);
    }

    #[test]
    fn pomodoro_delayed_confirmation_accumulates_rounds_and_survives_restore() {
        let preferences = TimerPreferences::default();
        let focus_duration_ms = preferences.pomodoro_focus_ms();
        let break_duration_ms = preferences.pomodoro_break_ms();

        for round_count in [1_u64, 2, 10] {
            let mut timer = TimerEngine {
                mode: TimerMode::Pomodoro,
                running_anchor: Some(RunAnchor {
                    monotonic: Instant::now(),
                    wall_clock: SystemTime::now(),
                }),
                pomodoro_focus_ms: focus_duration_ms,
                pomodoro_break_ms: break_duration_ms,
                ..TimerEngine::default()
            };

            for _ in 0..round_count {
                rewind_timer_anchor(&mut timer, focus_duration_ms);
                timer.sync_running_time();
                assert!(timer.pomodoro_phase == PomodoroPhase::Break);

                rewind_timer_anchor(&mut timer, break_duration_ms);
                timer.sync_running_time();
                assert!(timer.pomodoro_phase == PomodoroPhase::Focus);
            }

            assert_eq!(
                timer.pending_pomodoro_record_ms,
                Some(round_count * focus_duration_ms)
            );
            assert_eq!(timer.completed_focus_count, round_count);
            assert_eq!(timer.completed_break_count, round_count);
            assert_eq!(timer.current_round(), round_count + 1);

            let persisted = timer.persisted_runtime_state();
            let mut restored = TimerEngine::from_persisted_runtime(persisted, preferences);
            assert_eq!(
                restored.pending_pomodoro_record_ms,
                timer.pending_pomodoro_record_ms
            );
            assert_eq!(restored.completed_focus_count, round_count);
            assert_eq!(restored.completed_break_count, round_count);
            assert!(restored.pomodoro_phase == PomodoroPhase::Focus);
            assert!(restored.recovered_from_last_session);

            let completed = restored
                .complete_focus_session()
                .expect("save accumulated pomodoro focus");
            assert_eq!(completed.duration_ms, round_count * focus_duration_ms);
            assert_eq!(restored.pending_pomodoro_record_ms, None);
        }
    }

    #[test]
    fn pomodoro_restore_counts_elapsed_wall_time_after_sleep() {
        let preferences = TimerPreferences::default();
        let focus_duration_ms = preferences.pomodoro_focus_ms();
        let break_duration_ms = preferences.pomodoro_break_ms();
        let slept_for_ms = focus_duration_ms + break_duration_ms + focus_duration_ms / 2;
        let anchor_wall_clock = SystemTime::now() - Duration::from_millis(slept_for_ms);
        let runtime = PersistedRuntimeState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            mode_key: "pomodoro".to_string(),
            pomodoro_phase_key: "focus".to_string(),
            is_running: true,
            anchor_wall_clock_ms: Some(system_time_to_epoch_ms(anchor_wall_clock)),
            ..PersistedRuntimeState::default()
        };

        let mut restored = TimerEngine::from_persisted_runtime(runtime, preferences);
        restored.sync_running_time();

        assert_eq!(restored.completed_focus_count, 1);
        assert_eq!(restored.completed_break_count, 1);
        assert_eq!(restored.pending_pomodoro_record_ms, Some(focus_duration_ms));
        assert!(restored.pomodoro_elapsed_ms >= focus_duration_ms / 2);
        assert!(restored.pomodoro_elapsed_ms < focus_duration_ms);
        assert!(restored.running_anchor.is_some());
    }

    #[test]
    fn elapsed_anchor_handles_sleep_forward_and_backward_wall_clock_changes() {
        let monotonic_now = Instant::now();
        let wall_clock_now = SystemTime::now();

        let monotonic_leads = RunAnchor {
            monotonic: monotonic_now - Duration::from_secs(10),
            wall_clock: wall_clock_now - Duration::from_secs(4),
        };
        assert_eq!(
            elapsed_since_anchor_ms_at(monotonic_leads, monotonic_now, wall_clock_now),
            10_000
        );

        let wall_clock_jumps_forward = RunAnchor {
            monotonic: monotonic_now - Duration::from_secs(10),
            wall_clock: wall_clock_now - Duration::from_secs(20),
        };
        assert_eq!(
            elapsed_since_anchor_ms_at(wall_clock_jumps_forward, monotonic_now, wall_clock_now),
            20_000
        );

        let wall_clock_moves_backward = RunAnchor {
            monotonic: monotonic_now - Duration::from_secs(10),
            wall_clock: wall_clock_now + Duration::from_secs(5),
        };
        assert_eq!(
            elapsed_since_anchor_ms_at(wall_clock_moves_backward, monotonic_now, wall_clock_now),
            10_000
        );

        let simulated_sleep = RunAnchor {
            monotonic: monotonic_now - Duration::from_secs(5),
            wall_clock: wall_clock_now - Duration::from_secs(60),
        };
        assert_eq!(
            elapsed_since_anchor_ms_at(simulated_sleep, monotonic_now, wall_clock_now),
            60_000
        );
    }

    #[test]
    fn countdown_stops_at_zero_and_emits_one_completion_alert() {
        let mut timer = TimerEngine {
            mode: TimerMode::Countdown,
            countdown_duration_ms: 60_000,
            countdown_elapsed_ms: 59_900,
            running_anchor: Some(RunAnchor {
                monotonic: Instant::now() - Duration::from_secs(1),
                wall_clock: SystemTime::now() - Duration::from_secs(1),
            }),
            ..TimerEngine::default()
        };

        timer.sync_running_time();

        assert_eq!(timer.countdown_elapsed_ms, 60_000);
        assert!(timer.running_anchor.is_none());
        assert_eq!(timer.active_alert_kind, Some(AlertKind::CountdownComplete));
    }

    #[test]
    fn countdown_completion_creates_a_countdown_record_payload() {
        let mut timer = TimerEngine {
            mode: TimerMode::Countdown,
            countdown_duration_ms: 25 * 60_000,
            countdown_elapsed_ms: 12 * 60_000,
            ..TimerEngine::default()
        };

        let completed = timer.complete_focus_session().expect("countdown completes");

        assert_eq!(completed.mode_key, "countdown");
        assert_eq!(completed.duration_ms, 12 * 60_000);
        assert_eq!(timer.countdown_elapsed_ms, 0);
    }

    #[test]
    fn completed_countdown_records_the_full_configured_duration() {
        let mut timer = TimerEngine {
            mode: TimerMode::Countdown,
            countdown_duration_ms: 60 * 60_000,
            countdown_elapsed_ms: 60 * 60_000 - 100,
            running_anchor: Some(RunAnchor {
                monotonic: Instant::now() - Duration::from_millis(500),
                wall_clock: SystemTime::now() - Duration::from_millis(500),
            }),
            ..TimerEngine::default()
        };

        let completed = timer.complete_focus_session().expect("countdown completes");

        assert_eq!(completed.duration_ms, 60 * 60_000);
        assert_eq!(timer.countdown_elapsed_ms, 0);
    }

    #[test]
    fn stopwatch_completion_keeps_task_context_for_the_record() {
        let mut timer = TimerEngine {
            mode: TimerMode::Stopwatch,
            stopwatch_elapsed_ms: 90_000,
            current_task_title: "write release notes".to_string(),
            linked_todo_id: Some(42),
            ..TimerEngine::default()
        };

        let completed = timer.complete_focus_session().expect("stopwatch completes");

        assert_eq!(completed.task_title, "write release notes");
        assert_eq!(completed.linked_todo_id, Some(42));
        assert!(timer.current_task_title.is_empty());
        assert_eq!(timer.linked_todo_id, None);
    }

    #[test]
    fn stopwatch_uses_staged_targets_and_keeps_running() {
        let mut timer = TimerEngine {
            mode: TimerMode::Stopwatch,
            stopwatch_reminder_ms: Some(60_000),
            stopwatch_elapsed_ms: 25 * 60_000 - 100,
            running_anchor: Some(RunAnchor {
                monotonic: Instant::now() - Duration::from_millis(500),
                wall_clock: SystemTime::now() - Duration::from_millis(500),
            }),
            ..TimerEngine::default()
        };

        timer.sync_running_time();

        assert_eq!(timer.stopwatch_stage_index, 1);
        assert!(timer.running_anchor.is_some());
        assert_eq!(
            timer.active_alert_kind,
            Some(AlertKind::StopwatchTargetReached)
        );
        assert!(timer.stopwatch_alert_message().contains("25"));

        timer.clear_alert();
        timer.stopwatch_elapsed_ms = 45 * 60_000 - 100;
        timer.running_anchor = Some(RunAnchor {
            monotonic: Instant::now() - Duration::from_millis(500),
            wall_clock: SystemTime::now() - Duration::from_millis(500),
        });
        timer.sync_running_time();

        assert_eq!(timer.stopwatch_stage_index, 2);
        assert!(timer.running_anchor.is_some());
        assert_eq!(
            timer.active_alert_kind,
            Some(AlertKind::StopwatchTargetReached)
        );
        assert!(timer.stopwatch_alert_message().contains("45"));
    }

    #[test]
    fn completion_preference_is_captured_before_context_is_cleared() {
        let mut timer = TimerEngine {
            mode: TimerMode::Stopwatch,
            stopwatch_elapsed_ms: 90_000,
            ..TimerEngine::default()
        };

        timer.update_context("finish the plan".to_string(), Some(7), true);
        let completed = timer.complete_focus_session().expect("session completes");

        assert_eq!(completed.linked_todo_id, Some(7));
        assert!(completed.complete_linked_todo_on_finish);
        assert!(!timer.complete_linked_todo_on_finish);
    }

    #[test]
    fn todo_validation_rejects_impossible_dates_and_oversized_titles() {
        assert!(normalize_scheduled_date("2026-02-30").is_err());
        assert!(normalize_scheduled_time("25:61").is_err());
        assert!(normalize_todo_title(&"x".repeat(MAX_TODO_TITLE_CHARS + 1)).is_err());
        assert!(normalize_scheduled_date("2026-02-28").is_ok());
        assert!(normalize_scheduled_time("09:30").is_ok());
    }

    #[test]
    fn focus_record_title_validation_trims_and_rejects_empty_titles() {
        assert_eq!(
            normalize_focus_record_title("  完成季度复盘  ").expect("title is valid"),
            "完成季度复盘"
        );
        assert!(normalize_focus_record_title("   ").is_err());
        assert!(normalize_focus_record_title(&"x".repeat(MAX_TODO_TITLE_CHARS + 1)).is_err());
    }

    #[test]
    fn analytics_snapshot_explains_current_streak_and_best_day() {
        let today = Local::now().date_naive();
        let yesterday = today - ChronoDuration::days(1);
        let build_record = |id, date: NaiveDate, duration_ms| FocusRecord {
            id,
            title: format!("session-{id}"),
            duration_ms,
            duration_label: format_duration_ms(duration_ms),
            mode_key: "stopwatch".to_string(),
            mode_label: "正向计时".to_string(),
            phase_label: "正向计时".to_string(),
            linked_todo_id: None,
            linked_todo_title: None,
            completed_at: format!("{date} 12:00:00"),
            completed_date: date.to_string(),
            completed_time: "12:00".to_string(),
            source: "timer".to_string(),
            time_basis: "completion_day".to_string(),
            edited_at: None,
        };

        let snapshot = analytics_snapshot(
            &[
                build_record(1, today, 45 * 60_000),
                build_record(2, yesterday, 30 * 60_000),
            ],
            &[],
        );

        assert_eq!(snapshot.current_streak_days, 2);
        assert_eq!(snapshot.best_focus_date, Some(today.to_string()));
        assert_eq!(
            snapshot.best_focus_duration_label,
            Some(format_duration_ms(45 * 60_000))
        );
    }

    #[test]
    fn record_duration_is_attributed_to_completed_day_without_fabricated_cross_midnight_split() {
        let today = Local::now().date_naive();
        let record = FocusRecord {
            id: 1,
            title: "跨午夜专注".to_string(),
            duration_ms: 20 * 60_000,
            duration_label: format_duration_ms(20 * 60_000),
            mode_key: "countdown".to_string(),
            mode_label: "倒计时".to_string(),
            phase_label: "倒计时".to_string(),
            linked_todo_id: None,
            linked_todo_title: None,
            completed_at: format!("{today} 00:10:00"),
            completed_date: today.to_string(),
            completed_time: "00:10".to_string(),
            source: "timer".to_string(),
            time_basis: "completion_day".to_string(),
            edited_at: None,
        };

        let snapshot = analytics_snapshot(&[record], &[]);
        let today_breakdown = snapshot
            .daily_breakdown
            .iter()
            .find(|day| day.date == today.to_string())
            .expect("today is included");

        assert_eq!(snapshot.total_focus_duration_ms, 20 * 60_000);
        assert_eq!(today_breakdown.total_duration_ms, 20 * 60_000);
        assert_eq!(today_breakdown.session_count, 1);
    }

    #[test]
    fn current_backup_migration_is_a_noop_and_remains_idempotent() {
        let backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-19T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                ..PersistedRuntimeState::default()
            },
        };
        let original = serde_json::to_value(&backup).expect("serialize current backup");
        let (first, first_source) = migrate_backup_file(backup).expect("v3 migration succeeds");
        let (second, second_source) = migrate_backup_file(first.clone()).expect("repeat is safe");

        assert_eq!(first_source, None);
        assert_eq!(second_source, None);
        assert_eq!(
            serde_json::to_value(&first).expect("serialize first"),
            original
        );
        assert_eq!(
            serde_json::to_value(&second).expect("serialize second"),
            serde_json::to_value(&first).expect("serialize first again")
        );
    }

    #[test]
    fn malformed_missing_and_invalid_backup_data_is_rejected_without_mutation() {
        assert!(serde_json::from_str::<AppBackupFile>("{broken json").is_err());
        assert!(serde_json::from_str::<AppBackupFile>(
            r#"{"kind":"focused-moment-backup","formatVersion":3}"#
        )
        .is_err());

        let root = isolated_root();
        seed_persisted_bundle(&root);
        let store = PersistenceStore::for_test(&root).expect("create isolated store");
        let state = state_with_store(store, 2, 2_000);
        let invalid_record = FocusRecord {
            duration_ms: 0,
            completed_date: "2026-02-30".to_string(),
            ..fixture_record(1, None, "非法记录")
        };
        let backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-19T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                focus_records: vec![invalid_record],
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                ..PersistedRuntimeState::default()
            },
        };

        assert!(state.apply_backup_file(backup).is_err());
        assert!(state
            .snapshot_state()
            .expect("snapshot remains available")
            .focus_records
            .is_empty());
        cleanup_isolated_root(&root);
    }

    #[test]
    fn selective_backup_restore_keeps_selected_domains_consistent() {
        let root = isolated_root();
        seed_persisted_bundle(&root);
        let store = PersistenceStore::for_test(&root).expect("create isolated store");
        let state = state_with_store(store, 21, 2_000);
        let current_todo = fixture_todo(2, "当前事项");
        let current_record = fixture_record(20, Some(2), "当前记录");
        *state.todo_items.lock().expect("lock current todos") = vec![current_todo];
        *state.focus_records.lock().expect("lock current records") = vec![current_record];
        state.persist_all().expect("persist current fixture");

        let imported_preferences = AppPreferences {
            theme_id: "graphite-console".to_string(),
            custom_alert_sound_name: "imported.mp3".to_string(),
            custom_alert_sound_data: Some("data:audio/mpeg;base64,aW1wb3J0ZWQ=".to_string()),
            ..AppPreferences::default()
        };
        let imported_timer_preferences = TimerPreferences {
            alert_sound_key: AlertSoundKey::Custom,
            ..TimerPreferences::default()
        };
        let imported_todo = fixture_todo(1, "导入事项");
        let imported_record = fixture_record(10, Some(1), "导入记录");
        let backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-19T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                focus_records: vec![imported_record],
                next_record_id: 11,
                todo_items: vec![imported_todo],
                next_todo_id: 2,
                timer_preferences: imported_timer_preferences,
                app_preferences: imported_preferences.clone(),
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                ..PersistedRuntimeState::default()
            },
        };

        state
            .apply_backup_file_with_options(
                backup.clone(),
                BackupImportOptions {
                    restore_todos: true,
                    restore_records: false,
                    restore_app_preferences: false,
                },
            )
            .expect("restore only todos");
        let after_todos = state.snapshot_state().expect("snapshot after todo restore");
        assert_eq!(after_todos.todo_items[0].id, 1);
        assert_eq!(after_todos.focus_records[0].id, 20);
        assert_eq!(after_todos.focus_records[0].linked_todo_id, None);
        assert_eq!(after_todos.app_preferences.custom_alert_sound_name, "");
        assert_eq!(
            after_todos.timer_preferences.alert_sound_key,
            AlertSoundKey::SoftChime
        );

        state
            .apply_backup_file_with_options(
                backup.clone(),
                BackupImportOptions {
                    restore_todos: false,
                    restore_records: true,
                    restore_app_preferences: false,
                },
            )
            .expect("restore only records");
        let after_records = state
            .snapshot_state()
            .expect("snapshot after record restore");
        assert_eq!(after_records.todo_items[0].id, 1);
        assert_eq!(after_records.focus_records[0].id, 10);
        assert_eq!(after_records.focus_records[0].linked_todo_id, Some(1));
        assert_eq!(after_records.app_preferences.custom_alert_sound_name, "");
        assert_eq!(
            after_records.timer_preferences.alert_sound_key,
            AlertSoundKey::SoftChime
        );

        state
            .apply_backup_file_with_options(
                backup.clone(),
                BackupImportOptions {
                    restore_todos: false,
                    restore_records: false,
                    restore_app_preferences: true,
                },
            )
            .expect("restore only settings");
        let after_settings = state
            .snapshot_state()
            .expect("snapshot after settings restore");
        assert_eq!(after_settings.todo_items[0].id, 1);
        assert_eq!(after_settings.focus_records[0].id, 10);
        assert_eq!(
            after_settings.app_preferences.custom_alert_sound_name,
            "imported.mp3"
        );
        assert_eq!(
            after_settings.timer_preferences.alert_sound_key,
            AlertSoundKey::Custom
        );

        state
            .apply_backup_file(backup.clone())
            .expect("first complete restore");
        state
            .apply_backup_file(backup)
            .expect("repeat complete restore");
        let repeated = state
            .snapshot_state()
            .expect("snapshot after repeat restore");
        assert_eq!(repeated.todo_items.len(), 1);
        assert_eq!(repeated.focus_records.len(), 1);
        cleanup_isolated_root(&root);
    }

    #[test]
    fn invalid_backup_ids_and_duplicate_ids_are_rejected_without_mutation() {
        let mut backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: "2026-09-19T12:00:00+08:00".to_string(),
            state: PersistedState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                todo_items: vec![fixture_todo(1, "合法事项")],
                focus_records: vec![fixture_record(2, Some(1), "合法记录")],
                ..PersistedState::default()
            },
            runtime: PersistedRuntimeState {
                schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
                mode_key: "stopwatch".to_string(),
                ..PersistedRuntimeState::default()
            },
        };

        let mut invalid_todo_id = serde_json::to_value(&backup).expect("serialize backup");
        invalid_todo_id["state"]["todoItems"][0]["id"] = serde_json::json!(-1);
        assert!(serde_json::from_value::<AppBackupFile>(invalid_todo_id).is_err());

        let mut invalid_record_id = serde_json::to_value(&backup).expect("serialize backup");
        invalid_record_id["state"]["focusRecords"][0]["id"] = serde_json::json!(-1);
        assert!(serde_json::from_value::<AppBackupFile>(invalid_record_id).is_err());

        backup.state.todo_items.push(fixture_todo(1, "重复事项"));
        let root = isolated_root();
        seed_persisted_bundle(&root);
        let store = PersistenceStore::for_test(&root).expect("create isolated store");
        let state = state_with_store(store, 3, 3_000);
        assert!(state.apply_backup_file(backup).is_err());
        let snapshot = state.snapshot_state().expect("snapshot stays readable");
        assert!(snapshot.todo_items.is_empty());
        assert!(snapshot.focus_records.is_empty());
        cleanup_isolated_root(&root);
    }

    #[test]
    fn legacy_backup_is_migrated_to_current_schema_without_data_loss() {
        let legacy = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: 1,
            schema_version: 1,
            app_version: "1.10.0".to_string(),
            exported_at: "2026-08-21T10:00:00+08:00".to_string(),
            state: PersistedState::default(),
            runtime: PersistedRuntimeState::default(),
        };

        let (migrated, source_version) = migrate_backup_file(legacy).expect("migration succeeds");

        assert_eq!(source_version, Some(1));
        assert_eq!(migrated.format_version, APP_BACKUP_FORMAT_VERSION);
        assert_eq!(migrated.schema_version, CURRENT_STORAGE_SCHEMA_VERSION);
        assert_eq!(
            migrated.state.schema_version,
            CURRENT_STORAGE_SCHEMA_VERSION
        );
        assert_eq!(
            migrated.runtime.schema_version,
            CURRENT_STORAGE_SCHEMA_VERSION
        );
        assert_eq!(migrated.app_version, "1.10.0");

        let mut v2 = migrated.clone();
        v2.format_version = 2;
        v2.schema_version = 2;
        v2.state.schema_version = 2;
        v2.runtime.schema_version = 2;
        let (migrated_v2, source_version_v2) =
            migrate_backup_file(v2).expect("v2 migration succeeds");
        assert_eq!(source_version_v2, Some(2));
        assert_eq!(migrated_v2.format_version, APP_BACKUP_FORMAT_VERSION);
        assert_eq!(migrated_v2.schema_version, CURRENT_STORAGE_SCHEMA_VERSION);
    }

    #[test]
    fn newer_nested_backup_schema_is_rejected_before_import() {
        let mut future_backup = AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: "3.0.0".to_string(),
            exported_at: "2026-08-21T10:00:00+08:00".to_string(),
            state: PersistedState::default(),
            runtime: PersistedRuntimeState::default(),
        };
        future_backup.runtime.schema_version = CURRENT_STORAGE_SCHEMA_VERSION + 1;

        let error = match migrate_backup_file(future_backup) {
            Ok(_) => panic!("future schema is rejected"),
            Err(error) => error,
        };

        assert!(error.contains("更新版本"));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
            eprintln!("FOCUSED_MOMENT_SINGLE_INSTANCE_ARGS={argv:?}");
        }
        if argv
            .iter()
            .any(|argument| argument.contains("focused-moment-native-smoke-tray-click"))
        {
            match app.run_on_main_thread(trigger_native_smoke_tray_click) {
                Ok(()) => eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=scheduled"),
                Err(error) => {
                    eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=error:schedule:{error}")
                }
            }
        } else {
            let _ = show_main_window(app);
        }
    }));

    builder
        .manage(TimerEngineState::new())
        .manage(AppLifecycleState::new())
        .setup(|app| {
            build_system_tray(&app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.app_handle().try_state::<AppLifecycleState>() {
                    if !state.is_quitting() {
                        api.prevent_close();
                        let _ = hide_main_window(window);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap_shell,
            get_timer_snapshot,
            acknowledge_timer_alert,
            get_timer_preferences,
            update_timer_preferences,
            get_app_preferences,
            update_app_preferences,
            get_focus_plan,
            update_focus_plan,
            update_timer_context,
            switch_timer_mode,
            set_countdown_minutes,
            get_focus_records,
            update_focus_record_title,
            update_focus_record,
            delete_focus_record,
            restore_focus_record,
            delete_focus_records,
            get_analytics_snapshot,
            clear_app_data,
            list_app_backups,
            export_app_backup,
            import_app_backup,
            preview_app_backup_path,
            export_app_backup_to_path,
            import_app_backup_path,
            open_app_backup_folder,
            get_todo_items,
            create_todo_item,
            update_todo_item,
            update_todo_continuation_note,
            toggle_todo_item,
            delete_todo_item,
            restore_todo_item,
            start_timer,
            pause_timer,
            reset_timer,
            complete_focus_session,
            create_manual_focus_record,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            show_floating_todos,
            lock_floating_todos,
            unlock_floating_todos,
            show_focus_floating,
            lock_focus_floating,
            unlock_focus_floating,
            restore_main_from_focus_floating,
            restore_main_from_floating_todos,
            quit_application,
            show_main_window_from_tray,
            flash_main_window_attention,
            start_dragging_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
