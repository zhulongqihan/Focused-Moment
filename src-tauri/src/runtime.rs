mod storage;

use std::cmp::Reverse;
use std::collections::{BTreeMap, HashSet};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use std::mem::size_of;

use chrono::{Duration as ChronoDuration, Local, NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use storage::{
    AppBackupFile, PersistedRuntimeState, PersistedState, PersistenceStore,
    CURRENT_STORAGE_SCHEMA_VERSION,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Window, WindowEvent};

#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FlashWindowEx, FLASHWINFO, FLASHW_TIMERNOFG, FLASHW_TRAY,
};

const TRAY_SHOW_ID: &str = "tray_show_main";
const TRAY_QUIT_ID: &str = "tray_quit_app";

const DEFAULT_POMODORO_FOCUS_MINUTES: u64 = 25;
const DEFAULT_POMODORO_BREAK_MINUTES: u64 = 5;
const MIN_POMODORO_FOCUS_MINUTES: u64 = 5;
const MAX_POMODORO_FOCUS_MINUTES: u64 = 90;
const MIN_POMODORO_BREAK_MINUTES: u64 = 1;
const MAX_POMODORO_BREAK_MINUTES: u64 = 30;
const MIN_STOPWATCH_REMINDER_MINUTES: u64 = 1;
const MAX_STOPWATCH_REMINDER_MINUTES: u64 = 12 * 60;
const DEFAULT_STOPWATCH_REMINDER_MINUTES: u64 = 25;
const STOPWATCH_STAGE_MINUTES: [u64; 5] = [25, 45, 60, 90, 120];
const DEFAULT_COUNTDOWN_MINUTES: u64 = 25;
const MIN_COUNTDOWN_MINUTES: u64 = 1;
const MAX_COUNTDOWN_MINUTES: u64 = 12 * 60;
const MAX_TODO_TITLE_CHARS: usize = 200;
const APP_VERSION: &str = "2.3.13";
const APP_MILESTONE: &str = "v2.3.13 \u{4eca}\u{65e5}\u{8def}\u{5f84}";
const APP_BACKUP_KIND: &str = "focused-moment-backup";
const APP_BACKUP_FORMAT_VERSION: u64 = 2;
const FLOATING_WORKSPACE_SYNC_EVENT: &str = "floating-workspace-sync";

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

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerPreferences {
    pomodoro_focus_minutes: u64,
    pomodoro_break_minutes: u64,
    stopwatch_reminder_minutes: Option<u64>,
    toast_reminder_enabled: bool,
    window_attention_reminder_enabled: bool,
    #[serde(default = "default_sound_reminder_enabled")]
    sound_reminder_enabled: bool,
    #[serde(default)]
    alert_sound_key: AlertSoundKey,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AlertSoundKey {
    SoftChime,
    BrightBell,
    DeepPulse,
    ViralQuote,
    Custom,
}

impl Default for AlertSoundKey {
    fn default() -> Self {
        Self::SoftChime
    }
}

fn default_sound_reminder_enabled() -> bool {
    true
}

impl Default for TimerPreferences {
    fn default() -> Self {
        Self {
            pomodoro_focus_minutes: DEFAULT_POMODORO_FOCUS_MINUTES,
            pomodoro_break_minutes: DEFAULT_POMODORO_BREAK_MINUTES,
            stopwatch_reminder_minutes: Some(DEFAULT_STOPWATCH_REMINDER_MINUTES),
            toast_reminder_enabled: true,
            window_attention_reminder_enabled: true,
            sound_reminder_enabled: true,
            alert_sound_key: AlertSoundKey::SoftChime,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerPreferencesSnapshot {
    pomodoro_focus_minutes: u64,
    pomodoro_break_minutes: u64,
    stopwatch_reminder_minutes: Option<u64>,
    toast_reminder_enabled: bool,
    window_attention_reminder_enabled: bool,
    sound_reminder_enabled: bool,
    alert_sound_key: &'static str,
}

impl AlertSoundKey {
    fn key(self) -> &'static str {
        match self {
            Self::SoftChime => "soft_chime",
            Self::BrightBell => "bright_bell",
            Self::DeepPulse => "deep_pulse",
            Self::ViralQuote => "viral_quote",
            Self::Custom => "custom",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum AlertKind {
    PomodoroFocusComplete,
    PomodoroBreakComplete,
    StopwatchTargetReached,
    CountdownComplete,
}

impl AlertKind {
    fn key(self) -> &'static str {
        match self {
            AlertKind::PomodoroFocusComplete => "pomodoro_focus_complete",
            AlertKind::PomodoroBreakComplete => "pomodoro_break_complete",
            AlertKind::StopwatchTargetReached => "stopwatch_target_reached",
            AlertKind::CountdownComplete => "countdown_complete",
        }
    }

    fn title(self) -> &'static str {
        match self {
            AlertKind::PomodoroFocusComplete => "本轮番茄已完成",
            AlertKind::PomodoroBreakComplete => "休息时间结束了",
            AlertKind::StopwatchTargetReached => "已达到阶段性目标",
            AlertKind::CountdownComplete => "倒计时已结束",
        }
    }

    fn message(self, preferences: TimerPreferences) -> String {
        match self {
            AlertKind::PomodoroFocusComplete => format!(
                "已经完成一轮 {} 分钟专注，可以休息一下，或者直接补记这轮专注。",
                preferences.pomodoro_focus_minutes
            ),
            AlertKind::PomodoroBreakComplete => format!(
                "{} 分钟休息已经结束，可以回来继续下一轮专注了。",
                preferences.pomodoro_break_minutes
            ),
            AlertKind::StopwatchTargetReached => {
                if let Some(minutes) = preferences.stopwatch_reminder_minutes {
                    format!("已经达到你设置的 {} 分钟提醒目标。", minutes)
                } else {
                    "已经达到这轮正向计时的提醒目标。".to_string()
                }
            }
            AlertKind::CountdownComplete => "计时已到 00:00，可以立即完成并记录。".to_string(),
        }
    }
}

impl TimerPreferences {
    fn snapshot(self) -> TimerPreferencesSnapshot {
        TimerPreferencesSnapshot {
            pomodoro_focus_minutes: self.pomodoro_focus_minutes,
            pomodoro_break_minutes: self.pomodoro_break_minutes,
            stopwatch_reminder_minutes: self.stopwatch_reminder_minutes,
            toast_reminder_enabled: self.toast_reminder_enabled,
            window_attention_reminder_enabled: self.window_attention_reminder_enabled,
            sound_reminder_enabled: self.sound_reminder_enabled,
            alert_sound_key: self.alert_sound_key.key(),
        }
    }

    fn normalized(self) -> Result<Self, String> {
        let focus_minutes = self
            .pomodoro_focus_minutes
            .clamp(MIN_POMODORO_FOCUS_MINUTES, MAX_POMODORO_FOCUS_MINUTES);
        let break_minutes = self
            .pomodoro_break_minutes
            .clamp(MIN_POMODORO_BREAK_MINUTES, MAX_POMODORO_BREAK_MINUTES);
        let stopwatch_reminder_minutes = match self.stopwatch_reminder_minutes {
            Some(minutes) if minutes == 0 => None,
            Some(minutes) => Some(minutes.clamp(
                MIN_STOPWATCH_REMINDER_MINUTES,
                MAX_STOPWATCH_REMINDER_MINUTES,
            )),
            None => None,
        };

        if self.pomodoro_focus_minutes < MIN_POMODORO_FOCUS_MINUTES
            || self.pomodoro_focus_minutes > MAX_POMODORO_FOCUS_MINUTES
        {
            return Err("番茄专注时长需要在 5 到 90 分钟之间。".to_string());
        }

        if self.pomodoro_break_minutes < MIN_POMODORO_BREAK_MINUTES
            || self.pomodoro_break_minutes > MAX_POMODORO_BREAK_MINUTES
        {
            return Err("番茄休息时长需要在 1 到 30 分钟之间。".to_string());
        }

        if let Some(minutes) = self.stopwatch_reminder_minutes {
            if !(MIN_STOPWATCH_REMINDER_MINUTES..=MAX_STOPWATCH_REMINDER_MINUTES).contains(&minutes)
            {
                return Err("正向计时提醒需要在 1 到 720 分钟之间，或留空关闭。".to_string());
            }
        }

        Ok(Self {
            pomodoro_focus_minutes: focus_minutes,
            pomodoro_break_minutes: break_minutes,
            stopwatch_reminder_minutes,
            toast_reminder_enabled: self.toast_reminder_enabled,
            window_attention_reminder_enabled: self.window_attention_reminder_enabled,
            sound_reminder_enabled: self.sound_reminder_enabled,
            alert_sound_key: self.alert_sound_key,
        })
    }

    fn pomodoro_focus_ms(self) -> u64 {
        self.pomodoro_focus_minutes.saturating_mul(60_000)
    }

    fn pomodoro_break_ms(self) -> u64 {
        self.pomodoro_break_minutes.saturating_mul(60_000)
    }

    fn stopwatch_reminder_ms(self) -> Option<u64> {
        self.stopwatch_reminder_minutes
            .map(|minutes| minutes.saturating_mul(60_000))
    }
}

fn stopwatch_stage_index_for_elapsed(elapsed_ms: u64) -> usize {
    STOPWATCH_STAGE_MINUTES
        .iter()
        .take_while(|minutes| elapsed_ms >= minutes.saturating_mul(60_000))
        .count()
}

fn stopwatch_next_target_ms(stage_index: usize) -> Option<u64> {
    STOPWATCH_STAGE_MINUTES
        .get(stage_index)
        .map(|minutes| minutes.saturating_mul(60_000))
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

#[derive(Clone, Copy)]
struct RunAnchor {
    monotonic: Instant,
    wall_clock: SystemTime,
}

struct TimerEngineState {
    timer: Mutex<TimerEngine>,
    timer_preferences: Mutex<TimerPreferences>,
    focus_records: Mutex<Vec<FocusRecord>>,
    next_record_id: Mutex<u64>,
    todo_items: Mutex<Vec<TodoItem>>,
    next_todo_id: Mutex<u64>,
    persistence: Option<PersistenceStore>,
}

#[derive(Default)]
struct TimerEngine {
    mode: TimerMode,
    running_anchor: Option<RunAnchor>,
    stopwatch_elapsed_ms: u64,
    countdown_elapsed_ms: u64,
    countdown_duration_ms: u64,
    countdown_completed_alerted: bool,
    pomodoro_elapsed_ms: u64,
    pomodoro_phase: PomodoroPhase,
    pending_pomodoro_record_ms: Option<u64>,
    current_task_title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
    completed_focus_count: u64,
    completed_break_count: u64,
    recovered_from_last_session: bool,
    pomodoro_focus_ms: u64,
    pomodoro_break_ms: u64,
    stopwatch_reminder_ms: Option<u64>,
    stopwatch_stage_index: usize,
    alert_sequence: u64,
    active_alert_kind: Option<AlertKind>,
}

struct CompletedSession {
    duration_ms: u64,
    mode_key: &'static str,
    mode_label: &'static str,
    phase_label: &'static str,
    task_title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
}

impl TimerEngineState {
    fn new() -> Self {
        let persistence = PersistenceStore::new()
            .map_err(|error| {
                eprintln!("failed to prepare persistence store: {error}");
                error
            })
            .ok();

        let persisted = persistence
            .as_ref()
            .and_then(|store| {
                store
                    .load()
                    .map_err(|error| {
                        eprintln!("failed to load persisted state: {error}");
                        error
                    })
                    .ok()
            })
            .unwrap_or_default();

        let persisted_runtime = persistence
            .as_ref()
            .and_then(|store| {
                store
                    .load_runtime()
                    .map_err(|error| {
                        eprintln!("failed to load persisted runtime state: {error}");
                        error
                    })
                    .ok()
            })
            .unwrap_or_default();
        let should_migrate_persisted_storage = persisted.schema_version
            < CURRENT_STORAGE_SCHEMA_VERSION
            || persisted_runtime.schema_version < CURRENT_STORAGE_SCHEMA_VERSION;

        let PersistedState {
            schema_version: _,
            mut focus_records,
            next_record_id,
            mut todo_items,
            next_todo_id,
            timer_preferences,
        } = persisted;

        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);

        let normalized_preferences = timer_preferences
            .normalized()
            .unwrap_or_else(|_| TimerPreferences::default());
        let mut timer =
            TimerEngine::from_persisted_runtime(persisted_runtime, normalized_preferences);
        if let Some(linked_todo_id) = timer.linked_todo_id {
            if !todo_items.iter().any(|item| item.id == linked_todo_id) {
                timer.linked_todo_id = None;
            }
        }

        let state = Self {
            timer: Mutex::new(timer),
            timer_preferences: Mutex::new(normalized_preferences),
            next_record_id: Mutex::new(next_record_id.max(next_focus_record_id(&focus_records))),
            focus_records: Mutex::new(focus_records),
            next_todo_id: Mutex::new(next_todo_id.max(next_todo_id_value(&todo_items))),
            todo_items: Mutex::new(todo_items),
            persistence,
        };

        if should_migrate_persisted_storage {
            if let Err(error) = state.persist_all() {
                eprintln!("failed to migrate persisted state to schema v{CURRENT_STORAGE_SCHEMA_VERSION}: {error}");
            }
        }

        state
    }

    fn snapshot_state(&self) -> Result<PersistedState, String> {
        Ok(PersistedState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            focus_records: self
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?
                .clone(),
            next_record_id: *self
                .next_record_id
                .lock()
                .map_err(|_| "记录编号状态锁定失败".to_string())?,
            todo_items: self
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?
                .clone(),
            next_todo_id: *self
                .next_todo_id
                .lock()
                .map_err(|_| "任务编号状态锁定失败".to_string())?,
            timer_preferences: *self
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?,
        })
    }

    fn snapshot_runtime_state(&self) -> Result<PersistedRuntimeState, String> {
        let persisted = self
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?
            .persisted_runtime_state();
        Ok(persisted)
    }

    fn export_backup_file(&self) -> Result<AppBackupFile, String> {
        Ok(AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: Local::now().to_rfc3339(),
            state: self.snapshot_state()?,
            runtime: self.snapshot_runtime_state()?,
        })
    }

    fn apply_backup_file(&self, backup: AppBackupFile) -> Result<BackupImportResult, String> {
        let (backup, migrated_from_format_version) = migrate_backup_file(backup)?;
        let AppBackupFile {
            kind,
            format_version: _,
            schema_version: _,
            app_version: _,
            exported_at: _,
            state,
            runtime,
        } = backup;

        debug_assert_eq!(kind, APP_BACKUP_KIND);

        let normalized_preferences = state
            .timer_preferences
            .normalized()
            .map_err(|_| "备份中的计时设置不合法，无法恢复。".to_string())?;
        let mut focus_records = state.focus_records;
        let mut todo_items = state.todo_items;
        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);
        let mut normalized_runtime =
            normalize_imported_runtime(runtime, &todo_items, normalized_preferences);

        {
            let mut timer = self
                .timer
                .lock()
                .map_err(|_| "计时引擎状态锁定失败".to_string())?;
            *timer = TimerEngine::from_persisted_runtime(
                normalized_runtime.clone(),
                normalized_preferences,
            );
            normalized_runtime = timer.persisted_runtime_state();
        }

        {
            let mut preferences = self
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?;
            *preferences = normalized_preferences;
        }

        {
            let mut records = self
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?;
            *records = focus_records.clone();
        }

        {
            let mut next_record_id = self
                .next_record_id
                .lock()
                .map_err(|_| "记录编号状态锁定失败".to_string())?;
            *next_record_id = state
                .next_record_id
                .max(next_focus_record_id(&focus_records));
        }

        {
            let mut items = self
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?;
            *items = todo_items.clone();
        }

        {
            let mut next_todo_id = self
                .next_todo_id
                .lock()
                .map_err(|_| "任务编号状态锁定失败".to_string())?;
            *next_todo_id = state.next_todo_id.max(next_todo_id_value(&todo_items));
        }

        self.persist_all()?;

        Ok(BackupImportResult {
            imported_file_name: String::new(),
            rollback_file_name: String::new(),
            focus_record_count: focus_records.len(),
            todo_count: todo_items.len(),
            restored_runtime_session: normalized_runtime.is_running
                || normalized_runtime.stopwatch_elapsed_ms > 0
                || normalized_runtime.countdown_elapsed_ms > 0
                || normalized_runtime.pomodoro_elapsed_ms > 0
                || normalized_runtime.pending_pomodoro_record_ms.is_some()
                || !normalized_runtime.current_task_title.trim().is_empty()
                || normalized_runtime.linked_todo_id.is_some(),
            migrated_from_format_version,
        })
    }

    fn persist(&self) -> Result<(), String> {
        let Some(store) = &self.persistence else {
            return Ok(());
        };

        let persisted = self.snapshot_state()?;

        store.save(&persisted)
    }

    fn persist_runtime(&self) -> Result<(), String> {
        let Some(store) = &self.persistence else {
            return Ok(());
        };

        let persisted = self
            .timer
            .lock()
            .map_err(|_| {
                "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?
            .persisted_runtime_state();

        store.save_runtime(&persisted)
    }

    fn persist_all(&self) -> Result<(), String> {
        self.persist()?;
        self.persist_runtime()
    }

    fn clear_all(&self) -> Result<(), String> {
        {
            let mut timer = self.timer.lock().map_err(|_| {
                "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            timer.reset();
            timer.mode = TimerMode::Stopwatch;
        }

        {
            let mut records = self.focus_records.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            records.clear();
        }

        {
            let mut next_record_id = self.next_record_id.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_record_id = 0;
        }

        {
            let mut items = self.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            items.clear();
        }

        {
            let mut next_todo_id = self.next_todo_id.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_todo_id = 0;
        }

        {
            let mut preferences = self.timer_preferences.lock().map_err(|_| {
                "\u{8ba1}\u{65f6}\u{8bbe}\u{7f6e}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *preferences = TimerPreferences::default();
        }

        self.persist()?;

        if let Some(store) = &self.persistence {
            store.clear_runtime()?;
        }

        Ok(())
    }
}

impl TimerEngine {
    fn from_persisted_runtime(
        runtime: PersistedRuntimeState,
        preferences: TimerPreferences,
    ) -> Self {
        let mode = parse_mode_key_value(&runtime.mode_key).unwrap_or_default();
        let pomodoro_phase = parse_phase_key_value(&runtime.pomodoro_phase_key).unwrap_or_default();
        let has_task_title = !runtime.current_task_title.trim().is_empty();
        let stopwatch_stage_index = runtime
            .stopwatch_stage_index
            .max(stopwatch_stage_index_for_elapsed(
                runtime.stopwatch_elapsed_ms,
            ))
            .min(STOPWATCH_STAGE_MINUTES.len());
        let active_alert_kind = runtime
            .active_alert_key
            .as_deref()
            .and_then(parse_alert_key_value);
        let active_alert_kind = match active_alert_kind {
            Some(AlertKind::StopwatchTargetReached) if stopwatch_stage_index == 0 => None,
            other => other,
        };
        let anchor = runtime.anchor_wall_clock_ms.and_then(|milliseconds| {
            if runtime.is_running {
                Some(Self::anchor_from_wall_clock_ms(milliseconds))
            } else {
                None
            }
        });

        Self {
            mode,
            running_anchor: anchor,
            stopwatch_elapsed_ms: runtime.stopwatch_elapsed_ms,
            countdown_elapsed_ms: runtime.countdown_elapsed_ms,
            countdown_duration_ms: runtime
                .countdown_duration_ms
                .max(DEFAULT_COUNTDOWN_MINUTES.saturating_mul(60_000)),
            countdown_completed_alerted: matches!(
                runtime.active_alert_key.as_deref(),
                Some("countdown_complete")
            ),
            pomodoro_elapsed_ms: runtime.pomodoro_elapsed_ms,
            pomodoro_phase,
            pending_pomodoro_record_ms: runtime.pending_pomodoro_record_ms,
            current_task_title: runtime.current_task_title,
            linked_todo_id: runtime.linked_todo_id,
            complete_linked_todo_on_finish: runtime.complete_linked_todo_on_finish,
            completed_focus_count: runtime.completed_focus_count,
            completed_break_count: runtime.completed_break_count,
            pomodoro_focus_ms: preferences.pomodoro_focus_ms(),
            pomodoro_break_ms: preferences.pomodoro_break_ms(),
            stopwatch_reminder_ms: preferences.stopwatch_reminder_ms(),
            stopwatch_stage_index,
            alert_sequence: runtime.alert_sequence,
            active_alert_kind,
            recovered_from_last_session: runtime.is_running
                || runtime.stopwatch_elapsed_ms > 0
                || runtime.countdown_elapsed_ms > 0
                || runtime.pomodoro_elapsed_ms > 0
                || runtime.pending_pomodoro_record_ms.is_some()
                || has_task_title
                || runtime.linked_todo_id.is_some(),
        }
    }

    fn persisted_runtime_state(&mut self) -> PersistedRuntimeState {
        self.sync_running_time();
        PersistedRuntimeState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            mode_key: self.mode.key().to_string(),
            stopwatch_elapsed_ms: self.stopwatch_elapsed_ms,
            countdown_elapsed_ms: self.countdown_elapsed_ms,
            countdown_duration_ms: self.countdown_duration_ms,
            pomodoro_elapsed_ms: self.pomodoro_elapsed_ms,
            pomodoro_phase_key: self.pomodoro_phase.key().to_string(),
            pending_pomodoro_record_ms: self.pending_pomodoro_record_ms,
            is_running: self.running_anchor.is_some(),
            anchor_wall_clock_ms: self
                .running_anchor
                .map(|anchor| system_time_to_epoch_ms(anchor.wall_clock)),
            current_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            alert_sequence: self.alert_sequence,
            active_alert_key: self.active_alert_kind.map(|kind| kind.key().to_string()),
            stopwatch_target_alerted: self.stopwatch_stage_index > 0,
            stopwatch_stage_index: self.stopwatch_stage_index,
        }
    }

    fn apply_preferences(&mut self, preferences: TimerPreferences) {
        self.pomodoro_focus_ms = preferences.pomodoro_focus_ms();
        self.pomodoro_break_ms = preferences.pomodoro_break_ms();
        self.stopwatch_reminder_ms = preferences.stopwatch_reminder_ms();
        if self.stopwatch_reminder_ms.is_none() {
            if self.active_alert_kind == Some(AlertKind::StopwatchTargetReached) {
                self.clear_alert();
            }
        } else if self.mode == TimerMode::Stopwatch {
            if self.active_alert_kind == Some(AlertKind::StopwatchTargetReached)
                && self.stopwatch_stage_index == 0
            {
                self.clear_alert();
            }
            let reached_stage_index = stopwatch_stage_index_for_elapsed(self.stopwatch_elapsed_ms);
            if reached_stage_index > self.stopwatch_stage_index {
                self.stopwatch_stage_index = reached_stage_index;
                self.mark_alert(AlertKind::StopwatchTargetReached);
            }
        }
    }

    fn update_context(
        &mut self,
        title: String,
        linked_todo_id: Option<u64>,
        complete_linked_todo_on_finish: bool,
    ) {
        self.current_task_title = title;
        self.linked_todo_id = linked_todo_id;
        self.complete_linked_todo_on_finish = complete_linked_todo_on_finish;
    }

    fn clear_context(&mut self) {
        self.current_task_title.clear();
        self.linked_todo_id = None;
        self.complete_linked_todo_on_finish = false;
    }

    fn clear_recovery_flag(&mut self) {
        self.recovered_from_last_session = false;
    }

    fn clear_alert(&mut self) {
        self.active_alert_kind = None;
    }

    fn stopwatch_alert_message(&self) -> String {
        let completed_stage_index = self.stopwatch_stage_index.saturating_sub(1);
        let completed_minutes = STOPWATCH_STAGE_MINUTES
            .get(completed_stage_index)
            .copied()
            .unwrap_or(DEFAULT_STOPWATCH_REMINDER_MINUTES);
        match STOPWATCH_STAGE_MINUTES.get(self.stopwatch_stage_index) {
            Some(next_minutes) => format!(
                "已达到第 {} 个阶段性目标：累计专注 {} 分钟。下一目标是 {} 分钟。",
                completed_stage_index + 1,
                completed_minutes,
                next_minutes
            ),
            None => format!(
                "已完成全部阶段性目标：累计专注 {} 分钟。计时仍会继续。",
                completed_minutes
            ),
        }
    }

    fn mark_alert(&mut self, alert_kind: AlertKind) {
        self.alert_sequence = self.alert_sequence.saturating_add(1);
        self.active_alert_kind = Some(alert_kind);
    }

    fn current_round(&self) -> u64 {
        match self.mode {
            TimerMode::Stopwatch => 1,
            TimerMode::Countdown => 1,
            TimerMode::Pomodoro => match self.pomodoro_phase {
                PomodoroPhase::Focus => self.completed_focus_count + 1,
                PomodoroPhase::Break => self.completed_focus_count.max(1),
            },
        }
    }

    fn has_unsubmitted_progress(&self) -> bool {
        self.running_anchor.is_some()
            || self.stopwatch_elapsed_ms > 0
            || self.countdown_elapsed_ms > 0
            || self.pomodoro_elapsed_ms > 0
            || self.pending_pomodoro_record_ms.is_some()
            || self.completed_focus_count > 0
            || self.completed_break_count > 0
    }

    fn mode_switch_hint(&self) -> Option<String> {
        if self.has_unsubmitted_progress() {
            Some("当前这轮专注还有未提交进度，请先完成记录或重置后再切换模式。".to_string())
        } else {
            None
        }
    }

    fn start(&mut self) {
        if self.running_anchor.is_none() {
            self.running_anchor = Some(Self::new_anchor());
        }
        self.clear_recovery_flag();
    }

    fn pause(&mut self) {
        self.sync_running_time();
        self.running_anchor = None;
        self.clear_recovery_flag();
    }

    fn reset(&mut self) {
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;
        self.clear_context();
        self.completed_focus_count = 0;
        self.completed_break_count = 0;
        self.stopwatch_stage_index = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        self.clear_recovery_flag();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Countdown => self.countdown_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    fn switch_mode(&mut self, mode: TimerMode) {
        if self.mode == mode {
            return;
        }

        self.mode = mode;
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;
        self.clear_context();
        self.completed_focus_count = 0;
        self.completed_break_count = 0;
        self.stopwatch_stage_index = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        self.clear_recovery_flag();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Countdown => self.countdown_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    fn set_countdown_minutes(&mut self, minutes: u64) -> Result<(), String> {
        if self.has_unsubmitted_progress() {
            return Err("当前计时还有未提交的进度，请先完成记录或重置后再调整倒计时。".to_string());
        }

        if !(MIN_COUNTDOWN_MINUTES..=MAX_COUNTDOWN_MINUTES).contains(&minutes) {
            return Err("倒计时时长需要在 1 到 720 分钟之间。".to_string());
        }

        self.countdown_duration_ms = minutes.saturating_mul(60_000);
        self.countdown_elapsed_ms = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        Ok(())
    }

    fn complete_focus_session(&mut self) -> Result<CompletedSession, String> {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => {
                let elapsed_ms = self.stopwatch_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.stopwatch_elapsed_ms = 0;
                self.running_anchor = None;
                self.clear_context();
                self.stopwatch_stage_index = 0;
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "stopwatch",
                    mode_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
            TimerMode::Countdown => {
                let elapsed_ms = self.countdown_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("当前倒计时还没有累计时间".to_string());
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.countdown_elapsed_ms = 0;
                self.running_anchor = None;
                self.clear_context();
                self.countdown_completed_alerted = false;
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "countdown",
                    mode_label: "倒计时",
                    phase_label: "倒计时",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
            TimerMode::Pomodoro => {
                if let Some(elapsed_ms) = self.pending_pomodoro_record_ms.take() {
                    self.clear_alert();
                    return Ok(CompletedSession {
                        duration_ms: elapsed_ms,
                        mode_key: "pomodoro",
                        mode_label: "\u{756a}\u{8304}\u{949f}",
                        phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                        task_title: self.current_task_title.clone(),
                        linked_todo_id: self.linked_todo_id,
                        complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
                    });
                }

                if self.pomodoro_phase != PomodoroPhase::Focus {
                    return Err(
                        "\u{5f53}\u{524d}\u{5904}\u{4e8e}\u{4f11}\u{606f}\u{9636}\u{6bb5}\u{ff0c}\u{6ca1}\u{6709}\u{53ef}\u{8bb0}\u{5f55}\u{7684}\u{4e13}\u{6ce8}\u{8f6e}\u{6b21}"
                            .to_string(),
                    );
                }

                let elapsed_ms = self.pomodoro_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err(
                        "\u{5f53}\u{524d}\u{756a}\u{8304}\u{4e13}\u{6ce8}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}"
                            .to_string(),
                    );
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Break;
                self.running_anchor = None;
                self.completed_focus_count = self.completed_focus_count.saturating_add(1);
                self.clear_context();
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "pomodoro",
                    mode_label: "\u{756a}\u{8304}\u{949f}",
                    phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
        }
    }

    fn snapshot(&mut self) -> TimerSnapshot {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_snapshot(),
            TimerMode::Countdown => self.countdown_snapshot(),
            TimerMode::Pomodoro => self.pomodoro_snapshot(),
        }
    }

    fn stopwatch_snapshot(&self) -> TimerSnapshot {
        let elapsed_ms = self.stopwatch_elapsed_ms;
        let status = if self.running_anchor.is_some() {
            "\u{8ba1}\u{65f6}\u{4e2d}"
        } else if elapsed_ms == 0 {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "stopwatch",
            phase_key: "stopwatch",
            mode: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(elapsed_ms),
            target_duration_ms: if self.stopwatch_reminder_ms.is_some() {
                stopwatch_next_target_ms(self.stopwatch_stage_index)
            } else {
                None
            },
            remaining_ms: None,
            secondary_label: "\u{5df2}\u{7d2f}\u{8ba1}\u{4e13}\u{6ce8}\u{65f6}\u{957f}",
            can_complete_session: true,
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| match kind {
                AlertKind::StopwatchTargetReached => self.stopwatch_alert_message(),
                _ => kind.message(self.active_preferences()),
            }),
        }
    }

    fn countdown_snapshot(&self) -> TimerSnapshot {
        let duration_ms = self.countdown_duration_ms;
        let elapsed_ms = self.countdown_elapsed_ms.min(duration_ms);
        let remaining_ms = duration_ms.saturating_sub(elapsed_ms);
        let status = if self.running_anchor.is_some() {
            "倒计时中"
        } else if elapsed_ms == 0 {
            "未开始"
        } else if remaining_ms == 0 {
            "已结束"
        } else {
            "已暂停"
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "countdown",
            phase_key: "countdown",
            mode: "倒计时",
            phase_label: "倒计时",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            target_duration_ms: Some(duration_ms),
            remaining_ms: Some(remaining_ms),
            secondary_label: "本轮剩余时间",
            can_complete_session: true,
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| match kind {
                AlertKind::CountdownComplete => format!(
                    "倒计时已完成，已累计专注 {} 分钟。点击“保存并记录”后写入专注记录。",
                    duration_ms / 60_000
                ),
                _ => kind.message(self.active_preferences()),
            }),
        }
    }

    fn pomodoro_snapshot(&self) -> TimerSnapshot {
        let duration_ms = self.current_pomodoro_duration_ms();
        let elapsed_ms = self.pomodoro_elapsed_ms.min(duration_ms);
        let remaining_ms = duration_ms.saturating_sub(elapsed_ms);
        let status = if self.running_anchor.is_some() {
            match self.pomodoro_phase {
                PomodoroPhase::Focus => "\u{4e13}\u{6ce8}\u{4e2d}",
                PomodoroPhase::Break => "\u{4f11}\u{606f}\u{4e2d}",
            }
        } else if elapsed_ms == 0 && self.pomodoro_phase == PomodoroPhase::Focus {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        let phase_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
            PomodoroPhase::Break => "\u{77ed}\u{4f11}\u{606f}",
        };

        let secondary_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{672c}\u{8f6e}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
            PomodoroPhase::Break => "\u{4f11}\u{606f}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "pomodoro",
            phase_key: match self.pomodoro_phase {
                PomodoroPhase::Focus => "focus",
                PomodoroPhase::Break => "break",
            },
            mode: "\u{756a}\u{8304}\u{949f}",
            phase_label,
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            target_duration_ms: Some(duration_ms),
            remaining_ms: Some(remaining_ms),
            secondary_label,
            can_complete_session: self.pending_pomodoro_record_ms.is_some()
                || self.pomodoro_phase == PomodoroPhase::Focus,
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| kind.message(self.active_preferences())),
        }
    }

    fn current_pomodoro_duration_ms(&self) -> u64 {
        match self.pomodoro_phase {
            PomodoroPhase::Focus => self.pomodoro_focus_ms,
            PomodoroPhase::Break => self.pomodoro_break_ms,
        }
    }

    fn active_preferences(&self) -> TimerPreferences {
        TimerPreferences {
            pomodoro_focus_minutes: (self.pomodoro_focus_ms / 60_000).max(1),
            pomodoro_break_minutes: (self.pomodoro_break_ms / 60_000).max(1),
            stopwatch_reminder_minutes: self
                .stopwatch_reminder_ms
                .map(|milliseconds| (milliseconds / 60_000).max(1)),
            toast_reminder_enabled: true,
            window_attention_reminder_enabled: true,
            sound_reminder_enabled: true,
            alert_sound_key: AlertSoundKey::SoftChime,
        }
    }

    fn sync_running_time(&mut self) {
        let Some(anchor) = self.running_anchor else {
            return;
        };

        let delta_ms = elapsed_since_anchor_ms(anchor);
        if delta_ms == 0 {
            return;
        }

        let keep_running = match self.mode {
            TimerMode::Stopwatch => {
                self.stopwatch_elapsed_ms = self.stopwatch_elapsed_ms.saturating_add(delta_ms);
                if self.stopwatch_reminder_ms.is_some() {
                    let reached_stage_index =
                        stopwatch_stage_index_for_elapsed(self.stopwatch_elapsed_ms);
                    if reached_stage_index > self.stopwatch_stage_index {
                        self.stopwatch_stage_index = reached_stage_index;
                        self.mark_alert(AlertKind::StopwatchTargetReached);
                    }
                }
                true
            }
            TimerMode::Countdown => {
                self.countdown_elapsed_ms = self
                    .countdown_elapsed_ms
                    .saturating_add(delta_ms)
                    .min(self.countdown_duration_ms);
                if self.countdown_elapsed_ms >= self.countdown_duration_ms {
                    if !self.countdown_completed_alerted {
                        self.countdown_completed_alerted = true;
                        self.mark_alert(AlertKind::CountdownComplete);
                    }
                    false
                } else {
                    true
                }
            }
            TimerMode::Pomodoro => {
                let mut total_elapsed = self.pomodoro_elapsed_ms.saturating_add(delta_ms);
                loop {
                    let phase_duration = self.current_pomodoro_duration_ms();
                    if total_elapsed < phase_duration {
                        break;
                    }

                    total_elapsed -= phase_duration;
                    if self.pomodoro_phase == PomodoroPhase::Focus
                        && self.pending_pomodoro_record_ms.is_none()
                    {
                        self.pending_pomodoro_record_ms = Some(phase_duration);
                        self.completed_focus_count = self.completed_focus_count.saturating_add(1);
                        self.mark_alert(AlertKind::PomodoroFocusComplete);
                    }
                    self.pomodoro_phase = match self.pomodoro_phase {
                        PomodoroPhase::Focus => PomodoroPhase::Break,
                        PomodoroPhase::Break => {
                            self.completed_break_count =
                                self.completed_break_count.saturating_add(1);
                            self.mark_alert(AlertKind::PomodoroBreakComplete);
                            PomodoroPhase::Focus
                        }
                    };
                }

                self.pomodoro_elapsed_ms = total_elapsed;
                true
            }
        };

        self.running_anchor = keep_running.then(Self::new_anchor);
    }

    fn new_anchor() -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: SystemTime::now(),
        }
    }

    fn anchor_from_wall_clock_ms(milliseconds: u64) -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: UNIX_EPOCH + Duration::from_millis(milliseconds),
        }
    }
}

fn elapsed_since_anchor_ms(anchor: RunAnchor) -> u64 {
    let monotonic_ms = anchor.monotonic.elapsed().as_millis() as u64;
    let wall_ms = SystemTime::now()
        .duration_since(anchor.wall_clock)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64;

    monotonic_ms.max(wall_ms)
}

fn with_timer_engine<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut TimerEngine) -> Result<T, String>,
) -> Result<T, String> {
    let mut engine = state.timer.lock().map_err(|_| {
        "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    f(&mut engine)
}

fn format_duration_ms(total_ms: u64) -> String {
    let total_seconds = total_ms / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

fn system_time_to_epoch_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64
}

fn parse_mode(mode: &str) -> Result<TimerMode, String> {
    match mode {
        "stopwatch" => Ok(TimerMode::Stopwatch),
        "countdown" => Ok(TimerMode::Countdown),
        "pomodoro" => Ok(TimerMode::Pomodoro),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{8ba1}\u{65f6}\u{6a21}\u{5f0f}".to_string()),
    }
}

fn parse_mode_key_value(mode: &str) -> Result<TimerMode, String> {
    parse_mode(mode)
}

fn parse_phase_key_value(value: &str) -> Result<PomodoroPhase, String> {
    match value {
        "focus" => Ok(PomodoroPhase::Focus),
        "break" => Ok(PomodoroPhase::Break),
        _ => Err(
            "\u{4e0d}\u{652f}\u{6301}\u{7684}\u{756a}\u{8304}\u{95f4}\u{9694}\u{9636}\u{6bb5}"
                .to_string(),
        ),
    }
}

fn parse_alert_key_value(value: &str) -> Option<AlertKind> {
    match value {
        "pomodoro_focus_complete" => Some(AlertKind::PomodoroFocusComplete),
        "pomodoro_break_complete" => Some(AlertKind::PomodoroBreakComplete),
        "stopwatch_target_reached" => Some(AlertKind::StopwatchTargetReached),
        "countdown_complete" => Some(AlertKind::CountdownComplete),
        _ => None,
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

fn normalize_scheduled_date(value: &str) -> Result<String, String> {
    let normalized = value.trim();
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

    let Some(completed_at) = record_completed_at(record) else {
        return vec![(fallback_date, record.duration_ms)];
    };

    let Ok(duration_ms) = i64::try_from(record.duration_ms) else {
        return vec![(fallback_date, record.duration_ms)];
    };

    let started_at = completed_at - ChronoDuration::milliseconds(duration_ms);
    let mut segments = Vec::new();
    let mut date = started_at.date();

    while date <= completed_at.date() {
        let day_start = date.and_time(NaiveTime::MIN);
        let next_day_start = date
            .succ_opt()
            .map(|next_date| next_date.and_time(NaiveTime::MIN))
            .unwrap_or(completed_at);
        let segment_start = if started_at > day_start {
            started_at
        } else {
            day_start
        };
        let segment_end = if completed_at < next_day_start {
            completed_at
        } else {
            next_day_start
        };

        if segment_end > segment_start {
            segments.push((
                date.to_string(),
                (segment_end - segment_start).num_milliseconds() as u64,
            ));
        }

        let Some(next_date) = date.succ_opt() else {
            break;
        };
        date = next_date;
    }

    if segments.is_empty() {
        vec![(fallback_date, record.duration_ms)]
    } else {
        segments
    }
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

fn migrate_backup_file(mut backup: AppBackupFile) -> Result<(AppBackupFile, Option<u64>), String> {
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

    match backup.format_version {
        1 => {
            backup.format_version = APP_BACKUP_FORMAT_VERSION;
            backup.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.state.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            backup.runtime.schema_version = CURRENT_STORAGE_SCHEMA_VERSION;
            Ok((backup, Some(1)))
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

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: APP_VERSION,
        milestone: APP_MILESTONE,
        slogan: "\u{7528}\u{66f4}\u{8f7b}\u{7684}\u{65b9}\u{5f0f}\u{4e13}\u{6ce8}\u{3001}\u{5b89}\u{6392}\u{548c}\u{590d}\u{76d8}\u{6bcf}\u{4e00}\u{5929}\u{3002}",
        surfaces: vec![
            ShellPanel {
                id: "timer",
                title: "\u{65f6}\u{95f4}\u{5f15}\u{64ce}",
                phase: "v0.2-v0.3",
                status: "\u{5df2}\u{5b8c}\u{6210}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{3001}\u{756a}\u{8304}\u{949f}\u{4ee5}\u{53ca}\u{540e}\u{53f0}/\u{4f11}\u{7720}\u{6062}\u{590d}\u{540e}\u{7684}\u{771f}\u{5b9e}\u{65f6}\u{95f4}\u{6821}\u{6b63}\u{3002}",
            },
            ShellPanel {
                id: "tasks",
                title: "\u{4efb}\u{52a1}\u{9762}\u{677f}",
                phase: "v0.4.0-v1.2.0",
                status: "\u{5df2}\u{589e}\u{5f3a}",
                summary: "\u{4efb}\u{52a1}\u{533a}\u{73b0}\u{5728}\u{652f}\u{6301}\u{641c}\u{7d22}\u{3001}\u{7b5b}\u{9009}\u{4e0e}\u{6392}\u{5e8f}\u{ff0c}\u{66f4}\u{9002}\u{5408}\u{65e5}\u{5e38}\u{7ef4}\u{62a4}\u{548c}\u{5feb}\u{901f}\u{627e}\u{4efb}\u{52a1}\u{3002}",
            },
            ShellPanel {
                id: "analytics",
                title: "\u{6570}\u{636e}\u{590d}\u{76d8}",
                phase: "v0.7.0-v1.1.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{65f6}\u{95f4}\u{8303}\u{56f4}\u{7b5b}\u{9009}\u{3001}\u{5355}\u{6761}\u{5220}\u{9664}\u{4e0e}\u{8303}\u{56f4}\u{6e05}\u{7406}\u{ff0c}\u{590d}\u{76d8}\u{9875}\u{7684}\u{65e5}\u{5e38}\u{53ef}\u{7528}\u{6027}\u{66f4}\u{5b8c}\u{6574}\u{4e86}\u{3002}",
            },
            ShellPanel {
                id: "tray",
                title: "\u{540e}\u{53f0}\u{5e38}\u{9a7b}",
                phase: "v0.9.0-v1.0.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5173}\u{95ed}\u{4e3b}\u{7a97}\u{53e3}\u{540e}\u{4f1a}\u{9690}\u{85cf}\u{5230}\u{7cfb}\u{7edf}\u{6258}\u{76d8}\u{ff0c}\u{53ef}\u{4ee5}\u{4ece}\u{6258}\u{76d8}\u{91cd}\u{65b0}\u{6253}\u{5f00}\u{6216}\u{9000}\u{51fa}\u{5e94}\u{7528}\u{3002}",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "focus-reminders",
                title: "\u{4e13}\u{6ce8}\u{63d0}\u{9192}",
                phase: "v1.3.0-v1.3.3",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{756a}\u{8304}\u{4e13}\u{6ce8}\u{7ed3}\u{675f}\u{3001}\u{4f11}\u{606f}\u{7ed3}\u{675f}\u{4e0e}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{5230}\u{70b9}\u{73b0}\u{5728}\u{90fd}\u{53ef}\u{4ee5}\u{89e6}\u{53d1}\u{7cfb}\u{7edf}\u{901a}\u{77e5}\u{6216}\u{7a97}\u{53e3}\u{63d0}\u{9192}\u{3002}",
            },
            ShellPanel {
                id: "session-recovery",
                title: "\u{4f1a}\u{8bdd}\u{6062}\u{590d}",
                phase: "v1.2.6-v1.3.3",
                status: "\u{5df2}\u{589e}\u{5f3a}",
                summary: "运行中的会话会独立落盘并保留快照备份，启动时优先恢复核心计时与任务上下文。",
            },
            ShellPanel {
                id: "data-backup",
                title: "\u{6570}\u{636e}\u{5907}\u{4efd}\u{4e0e}\u{6062}\u{590d}",
                phase: "v1.4.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "主状态和运行中会话现在都会在写入前自动生成本地备份，为后续回退和排查留下一层保护。",
            },
            ShellPanel {
                id: "safe-rendering",
                title: "\u{7a33}\u{5b9a}\u{6e32}\u{67d3}",
                phase: "v1.3.3",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "主界面默认优先使用更轻的渲染模式，减少多层模糊和毛玻璃对 Windows 桌面环境的压力。",
            },
        ],
    }
}

#[tauri::command]
fn get_timer_snapshot(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| Ok(engine.snapshot()))
}

#[tauri::command]
fn acknowledge_timer_alert(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.clear_alert();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn get_timer_preferences(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerPreferencesSnapshot, String> {
    let preferences = *state
        .timer_preferences
        .lock()
        .map_err(|_| "计时设置状态锁定失败".to_string())?;

    Ok(preferences.snapshot())
}

#[tauri::command]
fn update_timer_preferences(
    state: tauri::State<'_, TimerEngineState>,
    preferences: TimerPreferences,
) -> Result<TimerPreferencesSnapshot, String> {
    let normalized_preferences = preferences.normalized()?;

    {
        let mut engine = state
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?;
        engine.apply_preferences(normalized_preferences);
    }

    {
        let mut stored_preferences = state
            .timer_preferences
            .lock()
            .map_err(|_| "计时设置状态锁定失败".to_string())?;
        *stored_preferences = normalized_preferences;
    }

    state.persist_all()?;
    Ok(normalized_preferences.snapshot())
}

#[tauri::command]
fn update_timer_context(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
) -> Result<TimerSnapshot, String> {
    if let Some(id) = linked_todo_id {
        let items = state.todo_items.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        if !items.iter().any(|item| item.id == id && !item.is_completed) {
            return Err(
                "\u{5f53}\u{524d}\u{5173}\u{8054}\u{7684}\u{4efb}\u{52a1}\u{4e0d}\u{5b58}\u{5728}\u{6216}\u{5df2}\u{5b8c}\u{6210}"
                    .to_string(),
            );
        }
    }

    let snapshot = with_timer_engine(&state, |engine| {
        engine.update_context(
            title.trim().to_string(),
            linked_todo_id,
            complete_linked_todo_on_finish,
        );
        Ok(engine.snapshot())
    })?;

    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn switch_timer_mode(
    state: tauri::State<'_, TimerEngineState>,
    mode: String,
) -> Result<TimerSnapshot, String> {
    let next_mode = parse_mode(&mode)?;
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != next_mode && engine.has_unsubmitted_progress() {
            return Err("当前计时还有未提交的进度，请先完成记录或重置后再切换模式。".to_string());
        }
        engine.switch_mode(next_mode);
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn set_countdown_minutes(
    state: tauri::State<'_, TimerEngineState>,
    minutes: u64,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != TimerMode::Countdown {
            return Err("请先切换到倒计时模式。".to_string());
        }
        engine.set_countdown_minutes(minutes)?;
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn get_focus_records(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<FocusRecord>, String> {
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(records.clone())
}

#[tauri::command]
fn update_focus_record_title(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
) -> Result<Vec<FocusRecord>, String> {
    let normalized_title = normalize_focus_record_title(&title)?;
    let records = with_focus_records(&state, |records| {
        let record = records
            .iter_mut()
            .find(|record| record.id == id)
            .ok_or_else(|| "未找到要编辑的专注记录".to_string())?;

        record.title = normalized_title;
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn delete_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<FocusRecord>, String> {
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| record.id != id);
        if records.len() == before_len {
            return Err("未找到要删除的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn restore_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    record: FocusRecord,
) -> Result<Vec<FocusRecord>, String> {
    let record_id = record.id;
    let records = with_focus_records(&state, |records| {
        if records.iter().any(|item| item.id == record_id) {
            return Err("这条专注记录已经存在，无法重复恢复。".to_string());
        }

        records.insert(0, record.clone());
        sort_focus_records(records);
        Ok(records.clone())
    })?;

    {
        let mut next_record_id = state
            .next_record_id
            .lock()
            .map_err(|_| "记录编号状态锁定失败".to_string())?;
        *next_record_id = (*next_record_id).max(record_id.saturating_add(1));
    }

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn delete_focus_records(
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<Vec<FocusRecord>, String> {
    if ids.is_empty() {
        return Err("当前范围内没有可清理的专注记录".to_string());
    }

    let id_set = ids.into_iter().collect::<HashSet<_>>();
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| !id_set.contains(&record.id));
        if records.len() == before_len {
            return Err("没有找到可清理的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn get_analytics_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AnalyticsSnapshot, String> {
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;
    let todo_items = state.todo_items.lock().map_err(|_| {
        "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(analytics_snapshot(&records, &todo_items))
}

#[tauri::command]
fn clear_app_data(state: tauri::State<'_, TimerEngineState>) -> Result<(), String> {
    state.clear_all()
}

#[tauri::command]
fn list_app_backups(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<BackupListItem>, String> {
    let store = state
        .persistence
        .as_ref()
        .ok_or_else(|| "当前环境暂时无法访问本地备份目录。".to_string())?;

    let backups = store.list_user_backups()?;
    Ok(backups
        .into_iter()
        .filter(|(_, backup)| {
            backup.kind == APP_BACKUP_KIND
                && matches!(backup.format_version, 1 | APP_BACKUP_FORMAT_VERSION)
        })
        .map(|(file_name, backup)| BackupListItem {
            file_name,
            exported_at: backup.exported_at,
            app_version: backup.app_version,
            format_version: backup.format_version,
            schema_version: backup.schema_version,
            migration_needed: backup.format_version != APP_BACKUP_FORMAT_VERSION,
            focus_record_count: backup.state.focus_records.len(),
            todo_count: backup.state.todo_items.len(),
            has_runtime_session: backup.runtime.is_running
                || backup.runtime.stopwatch_elapsed_ms > 0
                || backup.runtime.countdown_elapsed_ms > 0
                || backup.runtime.pomodoro_elapsed_ms > 0
                || backup.runtime.pending_pomodoro_record_ms.is_some()
                || !backup.runtime.current_task_title.trim().is_empty()
                || backup.runtime.linked_todo_id.is_some(),
        })
        .collect())
}

#[tauri::command]
fn export_app_backup(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<BackupExportResult, String> {
    let store = state
        .persistence
        .as_ref()
        .ok_or_else(|| "当前环境暂时无法创建本地备份。".to_string())?;

    let backup = state.export_backup_file()?;
    let file_name = create_backup_file_name("focused-moment-backup-v2-");
    let exported_at = backup.exported_at.clone();
    let backup_path = store.save_user_backup(&file_name, &backup)?;

    Ok(BackupExportResult {
        file_name,
        file_path: backup_path.display().to_string(),
        exported_at,
    })
}

#[tauri::command]
fn import_app_backup(
    state: tauri::State<'_, TimerEngineState>,
    file_name: String,
) -> Result<BackupImportResult, String> {
    let store = state
        .persistence
        .as_ref()
        .ok_or_else(|| "当前环境暂时无法访问本地备份目录。".to_string())?;

    let backup = store.load_user_backup(&file_name)?;
    let rollback = state.export_backup_file()?;
    let rollback_file_name =
        create_backup_file_name("focused-moment-backup-v2-rollback-before-import-");
    store.save_user_backup(&rollback_file_name, &rollback)?;

    let mut result = state.apply_backup_file(backup)?;
    result.imported_file_name = file_name;
    result.rollback_file_name = rollback_file_name;
    Ok(result)
}

#[tauri::command]
fn open_app_backup_folder(state: tauri::State<'_, TimerEngineState>) -> Result<(), String> {
    let store = state
        .persistence
        .as_ref()
        .ok_or_else(|| "当前环境暂时无法访问本地备份目录。".to_string())?;
    let backup_dir = store.user_backup_dir()?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(&backup_dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&backup_dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let _ = backup_dir;
        Err("当前平台暂不支持打开备份目录。".to_string())
    }
}

#[tauri::command]
fn get_todo_items(state: tauri::State<'_, TimerEngineState>) -> Result<Vec<TodoItem>, String> {
    with_todo_items(&state, |items| {
        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })
}

#[tauri::command]
fn create_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let next_id = {
        let mut id_guard = state.next_todo_id.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let items = with_todo_items(&state, |items| {
        items.insert(
            0,
            TodoItem {
                id: next_id,
                title: normalized_title,
                is_completed: false,
                scheduled_date: normalized_date,
                scheduled_time: normalized_time,
                importance_key: normalized_importance,
            },
        );
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn update_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{7f16}\u{8f91}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.title = normalized_title;
        item.scheduled_date = normalized_date;
        item.scheduled_time = normalized_time;
        item.importance_key = normalized_importance;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn toggle_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let mut should_clear_timer_link = false;
    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{66f4}\u{65b0}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.is_completed = !item.is_completed;
        should_clear_timer_link = item.is_completed;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    if should_clear_timer_link {
        with_timer_engine(&state, |engine| {
            if engine.linked_todo_id == Some(id) {
                engine.linked_todo_id = None;
                return Ok(());
            }
            Ok(())
        })?;
        state.persist_runtime()?;
    }
    Ok(items)
}

#[tauri::command]
fn delete_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let items = with_todo_items(&state, |items| {
        let before_len = items.len();
        items.retain(|item| item.id != id);
        if items.len() == before_len {
            return Err(
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5220}\u{9664}\u{7684}\u{4efb}\u{52a1}"
                    .to_string(),
            );
        }

        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    with_timer_engine(&state, |engine| {
        if engine.linked_todo_id == Some(id) {
            engine.linked_todo_id = None;
        }
        Ok(())
    })?;
    state.persist_runtime()?;
    Ok(items)
}

#[tauri::command]
fn restore_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    item: TodoItem,
) -> Result<Vec<TodoItem>, String> {
    let normalized_item = TodoItem {
        id: item.id,
        title: normalize_todo_title(&item.title)?,
        is_completed: item.is_completed,
        scheduled_date: normalize_scheduled_date(&item.scheduled_date)?,
        scheduled_time: normalize_scheduled_time(&item.scheduled_time)?,
        importance_key: normalize_importance_key(&item.importance_key)?,
    };
    let item_id = normalized_item.id;

    let items = with_todo_items(&state, |items| {
        if items.iter().any(|current| current.id == item_id) {
            return Err("这个待办已经存在，无法重复恢复。".to_string());
        }

        items.push(normalized_item.clone());
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    {
        let mut next_todo_id = state
            .next_todo_id
            .lock()
            .map_err(|_| "任务编号状态锁定失败".to_string())?;
        *next_todo_id = (*next_todo_id).max(item_id.saturating_add(1));
    }

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn start_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.start();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn pause_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.pause();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn reset_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.reset();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    Ok(snapshot)
}

#[tauri::command]
fn complete_focus_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
) -> Result<CompletionPayload, String> {
    let completed_session = with_timer_engine(&state, |engine| engine.complete_focus_session())?;
    let (completed_at, completed_date, completed_time) = current_local_markers();
    let record_linked_todo_id = completed_session.linked_todo_id;

    let linked_todo_title = match record_linked_todo_id {
        Some(id) => {
            let items = state.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;

            let item = items.iter().find(|item| item.id == id).ok_or_else(|| {
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5173}\u{8054}\u{7684}\u{4efb}\u{52a1}"
                    .to_string()
            })?;

            Some(item.title.clone())
        }
        None => None,
    };

    let next_id = {
        let mut id_guard = state.next_record_id.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let normalized_title = title.trim();
    let completed_task_title = completed_session.task_title.trim();
    let record = FocusRecord {
        id: next_id,
        title: if normalized_title.is_empty() {
            if !completed_task_title.is_empty() {
                completed_task_title.to_string()
            } else {
                linked_todo_title
                    .clone()
                    .unwrap_or_else(|| "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string())
            }
        } else {
            normalized_title.to_string()
        },
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        mode_key: completed_session.mode_key.to_string(),
        mode_label: completed_session.mode_label.to_string(),
        phase_label: completed_session.phase_label.to_string(),
        linked_todo_id: record_linked_todo_id,
        linked_todo_title,
        completed_at,
        completed_date,
        completed_time,
    };

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        sort_focus_records(&mut records);
        records.clone()
    };

    let todo_items = with_todo_items(&state, |items| {
        if completed_session.complete_linked_todo_on_finish {
            if let Some(linked_todo_id) = record_linked_todo_id {
                if let Some(item) = items.iter_mut().find(|item| item.id == linked_todo_id) {
                    item.is_completed = true;
                }
            }
        }

        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })?;

    state.persist_all()?;

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;

    Ok(CompletionPayload {
        timer_snapshot,
        records,
        todo_items,
    })
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn hide_main_window(window: &Window) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

fn build_system_tray(app: &AppHandle) -> Result<(), String> {
    let show_item = MenuItemBuilder::with_id(TRAY_SHOW_ID, "显示主界面")
        .build(app)
        .map_err(|error| error.to_string())?;
    let quit_item = MenuItemBuilder::with_id(TRAY_QUIT_ID, "退出应用")
        .build(app)
        .map_err(|error| error.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|error| error.to_string())?;

    let mut tray_builder = TrayIconBuilder::with_id("focused-moment-tray")
        .menu(&menu)
        .tooltip("Focused Moment")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            TRAY_SHOW_ID => {
                let _ = show_main_window(app);
            }
            TRAY_QUIT_ID => {
                if let Some(state) = app.try_state::<AppLifecycleState>() {
                    state.mark_quitting();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<_>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let _ = tray_builder.build(app).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_main_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_maximize_main_window(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn close_main_window(window: tauri::Window) -> Result<(), String> {
    hide_main_window(&window)
}

#[tauri::command]
fn show_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到悬浮待办窗口".to_string())?;

    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    floating_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("todo-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }
    floating_window.show().map_err(|error| error.to_string())?;
    floating_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    let _ = floating_window.emit(FLOATING_WORKSPACE_SYNC_EVENT, ());
    if let Some(focus_window) = app.get_webview_window("focus-float") {
        focus_window.hide().map_err(|error| error.to_string())?;
    }
    main_window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn lock_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到悬浮待办窗口".to_string())?;
    let unlock_window = app
        .get_webview_window("todo-unlock")
        .ok_or_else(|| "找不到待办解锁按钮".to_string())?;

    let floating_position = floating_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let floating_size = floating_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let unlock_size = unlock_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let unlock_position = PhysicalPosition::new(
        floating_position.x + floating_size.width as i32 - unlock_size.width as i32 - 10,
        floating_position.y + 10,
    );

    unlock_window
        .set_position(unlock_position)
        .map_err(|error| error.to_string())?;
    unlock_window.show().map_err(|error| error.to_string())?;
    unlock_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    floating_window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn unlock_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到悬浮待办窗口".to_string())?;

    // Restore interaction before hiding the fallback unlock window. If a
    // native focus/show call is delayed, the user must still have a visible
    // button to retry instead of being left with a click-through window.
    floating_window.show().map_err(|error| error.to_string())?;
    floating_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    floating_window.set_focus().map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("todo-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到悬浮工作台窗口".to_string())?;
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    floating_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("todo-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }
    floating_window.show().map_err(|error| error.to_string())?;
    floating_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    let _ = floating_window.emit(FLOATING_WORKSPACE_SYNC_EVENT, ());
    if let Some(focus_window) = app.get_webview_window("focus-float") {
        focus_window.hide().map_err(|error| error.to_string())?;
    }
    main_window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn lock_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let focus_window = app
        .get_webview_window("focus-float")
        .ok_or_else(|| "找不到专注小窗".to_string())?;
    let unlock_window = app
        .get_webview_window("focus-unlock")
        .ok_or_else(|| "找不到专注解锁按钮".to_string())?;

    let floating_position = focus_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let floating_size = focus_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let unlock_size = unlock_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    unlock_window
        .set_position(PhysicalPosition::new(
            floating_position.x + floating_size.width as i32 - unlock_size.width as i32 - 10,
            floating_position.y + 10,
        ))
        .map_err(|error| error.to_string())?;
    unlock_window.show().map_err(|error| error.to_string())?;
    unlock_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    focus_window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn unlock_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let focus_window = app
        .get_webview_window("focus-float")
        .ok_or_else(|| "找不到专注小窗".to_string())?;
    // Keep the fallback unlock window alive until the floating window is
    // visible, interactive, and focused. Hiding it first can strand the
    // floating window in click-through mode when Windows delays a focus call.
    focus_window.show().map_err(|error| error.to_string())?;
    focus_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    focus_window.set_focus().map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("focus-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn restore_main_from_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(floating_window) = app.get_webview_window("todo-float") {
        floating_window
            .set_ignore_cursor_events(false)
            .map_err(|error| error.to_string())?;
        floating_window.hide().map_err(|error| error.to_string())?;
    }
    if let Some(focus_window) = app.get_webview_window("focus-float") {
        focus_window
            .set_ignore_cursor_events(false)
            .map_err(|error| error.to_string())?;
        focus_window.hide().map_err(|error| error.to_string())?;
    }
    if let Some(unlock_window) = app.get_webview_window("focus-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }
    show_main_window(&app)
}

#[tauri::command]
fn restore_main_from_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(floating_window) = app.get_webview_window("todo-float") {
        floating_window
            .set_ignore_cursor_events(false)
            .map_err(|error| error.to_string())?;
        floating_window.hide().map_err(|error| error.to_string())?;
    }
    if let Some(unlock_window) = app.get_webview_window("todo-unlock") {
        unlock_window.hide().map_err(|error| error.to_string())?;
    }

    show_main_window(&app)
}

#[tauri::command]
fn quit_application(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppLifecycleState>() {
        state.mark_quitting();
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn show_main_window_from_tray(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
fn flash_main_window_attention(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        let info = FLASHWINFO {
            cbSize: size_of::<FLASHWINFO>() as u32,
            hwnd: hwnd.0,
            dwFlags: FLASHW_TRAY | FLASHW_TIMERNOFG,
            uCount: 5,
            dwTimeout: 0,
        };

        unsafe {
            FlashWindowEx(&info);
        }
    }

    #[cfg(not(windows))]
    {
        let _ = window;
    }

    Ok(())
}

#[tauri::command]
fn start_dragging_main_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn analytics_splits_a_session_across_midnight_without_splitting_the_record() {
        let today = Local::now().date_naive();
        let yesterday = today - ChronoDuration::days(1);
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
        };

        let snapshot = analytics_snapshot(&[record], &[]);
        let yesterday_breakdown = snapshot
            .daily_breakdown
            .iter()
            .find(|day| day.date == yesterday.to_string())
            .expect("yesterday is included");
        let today_breakdown = snapshot
            .daily_breakdown
            .iter()
            .find(|day| day.date == today.to_string())
            .expect("today is included");

        assert_eq!(snapshot.total_focus_duration_ms, 20 * 60_000);
        assert_eq!(yesterday_breakdown.total_duration_ms, 10 * 60_000);
        assert_eq!(today_breakdown.total_duration_ms, 10 * 60_000);
        assert_eq!(yesterday_breakdown.session_count, 1);
        assert_eq!(today_breakdown.session_count, 1);
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
    tauri::Builder::default()
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
            update_timer_context,
            switch_timer_mode,
            set_countdown_minutes,
            get_focus_records,
            update_focus_record_title,
            delete_focus_record,
            restore_focus_record,
            delete_focus_records,
            get_analytics_snapshot,
            clear_app_data,
            list_app_backups,
            export_app_backup,
            import_app_backup,
            open_app_backup_folder,
            get_todo_items,
            create_todo_item,
            update_todo_item,
            toggle_todo_item,
            delete_todo_item,
            restore_todo_item,
            start_timer,
            pause_timer,
            reset_timer,
            complete_focus_session,
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
