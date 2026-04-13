mod storage;

use std::cmp::Reverse;
use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use chrono::Local;
use serde::{Deserialize, Serialize};
use storage::{PersistedState, PersistenceStore};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Window, WindowEvent};

const POMODORO_FOCUS_MS: u64 = 25 * 60 * 1000;
const POMODORO_BREAK_MS: u64 = 5 * 60 * 1000;
const TRAY_SHOW_ID: &str = "tray_show_main";
const TRAY_QUIT_ID: &str = "tray_quit_app";

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
    secondary_label: &'static str,
    can_complete_session: bool,
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
    reward_snapshot: RewardSnapshot,
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
    daily_breakdown: Vec<DailyInsight>,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RewardWallet {
    lmd: u64,
    orundum: u64,
    originium: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RewardLedgerEntry {
    id: u64,
    #[serde(default)]
    source_record_id: u64,
    source_title: String,
    source_mode_label: String,
    duration_ms: u64,
    duration_label: String,
    lmd: u64,
    orundum: u64,
    originium: u64,
    completed_at: String,
    completed_date: String,
    completed_time: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RewardSnapshot {
    wallet: RewardWallet,
    today_focus_duration_ms: u64,
    today_focus_duration_label: String,
    current_streak_days: usize,
    total_reward_count: usize,
    latest_rewards: Vec<RewardLedgerEntry>,
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
    Pomodoro,
}

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum PomodoroPhase {
    #[default]
    Focus,
    Break,
}

#[derive(Clone, Copy)]
struct RunAnchor {
    monotonic: Instant,
    wall_clock: SystemTime,
}

struct TimerEngineState {
    timer: Mutex<TimerEngine>,
    focus_records: Mutex<Vec<FocusRecord>>,
    next_record_id: Mutex<u64>,
    todo_items: Mutex<Vec<TodoItem>>,
    next_todo_id: Mutex<u64>,
    reward_wallet: Mutex<RewardWallet>,
    reward_ledger: Mutex<Vec<RewardLedgerEntry>>,
    next_reward_id: Mutex<u64>,
    persistence: Option<PersistenceStore>,
}

#[derive(Default)]
struct TimerEngine {
    mode: TimerMode,
    running_anchor: Option<RunAnchor>,
    stopwatch_elapsed_ms: u64,
    pomodoro_elapsed_ms: u64,
    pomodoro_phase: PomodoroPhase,
    pending_pomodoro_record_ms: Option<u64>,
}

struct CompletedSession {
    duration_ms: u64,
    mode_key: &'static str,
    mode_label: &'static str,
    phase_label: &'static str,
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

        let PersistedState {
            mut focus_records,
            next_record_id,
            mut todo_items,
            next_todo_id,
            reward_wallet,
            mut reward_ledger,
            next_reward_id,
        } = persisted;

        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);
        sort_reward_ledger(&mut reward_ledger);

        Self {
            timer: Mutex::new(TimerEngine::default()),
            next_record_id: Mutex::new(next_record_id.max(next_focus_record_id(&focus_records))),
            focus_records: Mutex::new(focus_records),
            next_todo_id: Mutex::new(next_todo_id.max(next_todo_id_value(&todo_items))),
            todo_items: Mutex::new(todo_items),
            reward_wallet: Mutex::new(reward_wallet),
            next_reward_id: Mutex::new(next_reward_id.max(next_reward_id_value(&reward_ledger))),
            reward_ledger: Mutex::new(reward_ledger),
            persistence,
        }
    }

    fn persist(&self) -> Result<(), String> {
        let Some(store) = &self.persistence else {
            return Ok(());
        };

        let persisted = PersistedState {
            focus_records: self
                .focus_records
                .lock()
                .map_err(|_| {
                    "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                        .to_string()
                })?
                .clone(),
            next_record_id: *self.next_record_id.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?,
            todo_items: self
                .todo_items
                .lock()
                .map_err(|_| {
                    "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                        .to_string()
                })?
                .clone(),
            next_todo_id: *self.next_todo_id.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?,
            reward_wallet: self
                .reward_wallet
                .lock()
                .map_err(|_| "奖励钱包状态锁定失败".to_string())?
                .clone(),
            reward_ledger: self
                .reward_ledger
                .lock()
                .map_err(|_| "奖励流水状态锁定失败".to_string())?
                .clone(),
            next_reward_id: *self
                .next_reward_id
                .lock()
                .map_err(|_| "奖励编号状态锁定失败".to_string())?,
        };

        store.save(&persisted)
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
            let mut wallet = self
                .reward_wallet
                .lock()
                .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
            *wallet = RewardWallet::default();
        }

        {
            let mut ledger = self
                .reward_ledger
                .lock()
                .map_err(|_| "奖励流水状态锁定失败".to_string())?;
            ledger.clear();
        }

        {
            let mut next_reward_id = self
                .next_reward_id
                .lock()
                .map_err(|_| "奖励编号状态锁定失败".to_string())?;
            *next_reward_id = 0;
        }

        self.persist()
    }
}

impl TimerEngine {
    fn start(&mut self) {
        if self.running_anchor.is_none() {
            self.running_anchor = Some(Self::new_anchor());
        }
    }

    fn pause(&mut self) {
        self.sync_running_time();
        self.running_anchor = None;
    }

    fn reset(&mut self) {
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
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

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    fn complete_focus_session(&mut self) -> Result<CompletedSession, String> {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => {
                let elapsed_ms = self.stopwatch_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
                }

                self.stopwatch_elapsed_ms = 0;
                self.running_anchor = None;

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "stopwatch",
                    mode_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                })
            }
            TimerMode::Pomodoro => {
                if let Some(elapsed_ms) = self.pending_pomodoro_record_ms.take() {
                    return Ok(CompletedSession {
                        duration_ms: elapsed_ms,
                        mode_key: "pomodoro",
                        mode_label: "\u{756a}\u{8304}\u{949f}",
                        phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
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

                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Break;
                self.running_anchor = None;

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "pomodoro",
                    mode_label: "\u{756a}\u{8304}\u{949f}",
                    phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                })
            }
        }
    }

    fn snapshot(&mut self) -> TimerSnapshot {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_snapshot(),
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

        TimerSnapshot {
            mode_key: "stopwatch",
            phase_key: "stopwatch",
            mode: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(elapsed_ms),
            secondary_label: "\u{5df2}\u{7d2f}\u{8ba1}\u{4e13}\u{6ce8}\u{65f6}\u{957f}",
            can_complete_session: true,
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
            secondary_label,
            can_complete_session: self.pending_pomodoro_record_ms.is_some()
                || self.pomodoro_phase == PomodoroPhase::Focus,
        }
    }

    fn current_pomodoro_duration_ms(&self) -> u64 {
        match self.pomodoro_phase {
            PomodoroPhase::Focus => POMODORO_FOCUS_MS,
            PomodoroPhase::Break => POMODORO_BREAK_MS,
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

        match self.mode {
            TimerMode::Stopwatch => {
                self.stopwatch_elapsed_ms = self.stopwatch_elapsed_ms.saturating_add(delta_ms);
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
                    }
                    self.pomodoro_phase = match self.pomodoro_phase {
                        PomodoroPhase::Focus => PomodoroPhase::Break,
                        PomodoroPhase::Break => PomodoroPhase::Focus,
                    };
                }

                self.pomodoro_elapsed_ms = total_elapsed;
            }
        }

        self.running_anchor = Some(Self::new_anchor());
    }

    fn new_anchor() -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: SystemTime::now(),
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

fn parse_mode(mode: &str) -> Result<TimerMode, String> {
    match mode {
        "stopwatch" => Ok(TimerMode::Stopwatch),
        "pomodoro" => Ok(TimerMode::Pomodoro),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{8ba1}\u{65f6}\u{6a21}\u{5f0f}".to_string()),
    }
}

fn normalize_todo_title(title: &str) -> Result<String, String> {
    let normalized = title.trim();
    if normalized.is_empty() {
        Err("\u{4efb}\u{52a1}\u{540d}\u{79f0}\u{4e0d}\u{80fd}\u{4e3a}\u{7a7a}".to_string())
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

    if is_valid {
        Ok(normalized.to_string())
    } else {
        Err("\u{8bf7}\u{9009}\u{62e9}\u{6709}\u{6548}\u{7684}\u{65e5}\u{671f}".to_string())
    }
}

fn normalize_scheduled_time(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    let is_valid = normalized.len() == 5
        && normalized
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                2 => ch == ':',
                _ => ch.is_ascii_digit(),
            });

    if is_valid {
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

fn next_reward_id_value(entries: &[RewardLedgerEntry]) -> u64 {
    entries
        .iter()
        .map(|entry| entry.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn sort_focus_records(records: &mut [FocusRecord]) {
    records.sort_by(|left, right| Reverse(left.id).cmp(&Reverse(right.id)));
}

fn sort_todo_items(items: &mut [TodoItem]) {
    items.sort_by(|left, right| {
        left.is_completed
            .cmp(&right.is_completed)
            .then_with(|| left.scheduled_date.cmp(&right.scheduled_date))
            .then_with(|| left.scheduled_time.cmp(&right.scheduled_time))
            .then_with(|| {
                importance_rank(&left.importance_key).cmp(&importance_rank(&right.importance_key))
            })
            .then_with(|| Reverse(left.id).cmp(&Reverse(right.id)))
    });
}

fn sort_reward_ledger(entries: &mut [RewardLedgerEntry]) {
    entries.sort_by(|left, right| Reverse(left.id).cmp(&Reverse(right.id)));
}

fn current_local_markers() -> (String, String, String) {
    let now = Local::now();
    (
        now.format("%Y-%m-%d %H:%M:%S").to_string(),
        now.format("%Y-%m-%d").to_string(),
        now.format("%H:%M").to_string(),
    )
}

fn current_streak_days(records: &[FocusRecord]) -> usize {
    let today = Local::now().date_naive();
    let mut unique_days = records
        .iter()
        .filter_map(|record| {
            chrono::NaiveDate::parse_from_str(&record.completed_date, "%Y-%m-%d").ok()
        })
        .collect::<Vec<_>>();

    unique_days.sort_unstable();
    unique_days.dedup();

    let mut cursor = today;
    let mut streak = 0usize;

    for day in unique_days.into_iter().rev() {
        if day == cursor {
            streak += 1;
            cursor = cursor.pred_opt().unwrap_or(cursor);
        } else if streak == 0 && day == today.pred_opt().unwrap_or(today) {
            cursor = day;
            streak += 1;
            cursor = cursor.pred_opt().unwrap_or(cursor);
        } else if day < cursor {
            break;
        }
    }

    streak
}

fn count_originium_pity_misses(reward_ledger: &[RewardLedgerEntry]) -> usize {
    reward_ledger
        .iter()
        .filter(|entry| {
            entry.duration_ms >= POMODORO_FOCUS_MS || entry.duration_ms >= 45 * 60 * 1000
        })
        .take_while(|entry| entry.originium == 0)
        .count()
}

fn build_reward_entry(
    id: u64,
    source_record_id: u64,
    title: &str,
    completed_session: &CompletedSession,
    completed_at: String,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
    reward_ledger: &[RewardLedgerEntry],
) -> RewardLedgerEntry {
    let duration_minutes = (completed_session.duration_ms / 60_000).max(1);
    let linked_lmd_bonus = if linked_todo_id.is_some() { 90 } else { 0 };
    let linked_orundum_bonus = if linked_todo_id.is_some() { 20 } else { 0 };
    let pomodoro_orundum_bonus = if completed_session.mode_key == "pomodoro" {
        40
    } else {
        0
    };

    let lmd = duration_minutes * 18 + linked_lmd_bonus;
    let orundum = duration_minutes * 6 + pomodoro_orundum_bonus + linked_orundum_bonus;

    let title_factor = title.chars().count() as u64;
    let date_factor = completed_date
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .filter_map(|ch| ch.to_digit(10))
        .map(u64::from)
        .sum::<u64>();
    let random_seed = id
        .saturating_mul(13)
        .saturating_add(duration_minutes)
        .saturating_add(title_factor)
        .saturating_add(date_factor);
    let is_originium_eligible = completed_session.duration_ms >= POMODORO_FOCUS_MS
        || completed_session.duration_ms >= 45 * 60 * 1000;
    let recent_miss_streak = count_originium_pity_misses(reward_ledger);
    let pity_triggered = is_originium_eligible && recent_miss_streak >= 5;
    let surprise_hit = if completed_session.mode_key == "pomodoro" {
        random_seed % 100 < 8
    } else {
        random_seed % 100 < 6
    };
    let originium = if is_originium_eligible && (pity_triggered || surprise_hit) {
        1
    } else {
        0
    };

    RewardLedgerEntry {
        id,
        source_record_id,
        source_title: title.to_string(),
        source_mode_label: completed_session.mode_label.to_string(),
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        lmd,
        orundum,
        originium,
        completed_at,
        completed_date,
        completed_time,
    }
}

fn reward_snapshot(
    records: &[FocusRecord],
    wallet: &RewardWallet,
    ledger: &[RewardLedgerEntry],
) -> RewardSnapshot {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let today_focus_duration_ms = records
        .iter()
        .filter(|record| record.completed_date == today)
        .map(|record| record.duration_ms)
        .sum::<u64>();

    RewardSnapshot {
        wallet: wallet.clone(),
        today_focus_duration_ms,
        today_focus_duration_label: format_duration_ms(today_focus_duration_ms),
        current_streak_days: current_streak_days(records),
        total_reward_count: ledger.len(),
        latest_rewards: ledger.iter().take(6).cloned().collect(),
    }
}

fn wallet_from_ledger(ledger: &[RewardLedgerEntry]) -> RewardWallet {
    ledger
        .iter()
        .fold(RewardWallet::default(), |mut wallet, entry| {
            wallet.lmd = wallet.lmd.saturating_add(entry.lmd);
            wallet.orundum = wallet.orundum.saturating_add(entry.orundum);
            wallet.originium = wallet.originium.saturating_add(entry.originium);
            wallet
        })
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

    let mut grouped = BTreeMap::<String, Vec<&FocusRecord>>::new();
    for record in records {
        let date_key = if record.completed_date.trim().is_empty() {
            "未记录日期".to_string()
        } else {
            record.completed_date.clone()
        };

        grouped.entry(date_key).or_default().push(record);
    }

    let mut daily_breakdown = grouped
        .into_iter()
        .map(|(date, day_records)| {
            let total_duration_ms = day_records
                .iter()
                .map(|record| record.duration_ms)
                .sum::<u64>();
            let session_count = day_records.len();
            let linked_session_count = day_records
                .iter()
                .filter(|record| record.linked_todo_id.is_some())
                .count();
            let independent_session_count = session_count.saturating_sub(linked_session_count);

            DailyInsight {
                date,
                total_duration_ms,
                total_duration_label: format_duration_ms(total_duration_ms),
                session_count,
                linked_session_count,
                independent_session_count,
            }
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
            date: today,
            total_duration_ms: 0,
            total_duration_label: format_duration_ms(0),
            session_count: 0,
            linked_session_count: 0,
            independent_session_count: 0,
        });

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
        daily_breakdown,
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

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn resolve_export_directory() -> Result<PathBuf, String> {
    let base_dir = env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Documents"))
        .filter(|path| path.exists())
        .unwrap_or(env::current_dir().map_err(|error| error.to_string())?);

    let export_dir = base_dir.join("Focused Moment Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    Ok(export_dir)
}

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: "1.3.2",
        milestone: "v1.3.2 \u{8d27}\u{5e01}\u{5e73}\u{8861}\u{7248}",
        slogan: "\u{5b8c}\u{6210}\u{4e00}\u{8f6e}\u{4e13}\u{6ce8}\u{540e}\u{ff0c}\u{4f60}\u{7684}\u{79ef}\u{7d2f}\u{4e5f}\u{4f1a}\u{8ddf}\u{7740}\u{5411}\u{524d}\u{8d70}\u{4e00}\u{5c0f}\u{6b65}\u{3002}",
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
                summary: "\u{5df2}\u{652f}\u{6301}\u{65f6}\u{95f4}\u{8303}\u{56f4}\u{7b5b}\u{9009}\u{3001}\u{5355}\u{6761}\u{5220}\u{9664}\u{3001}\u{8303}\u{56f4}\u{6e05}\u{7406}\u{4e0e} CSV \u{5bfc}\u{51fa}\u{ff0c}\u{590d}\u{76d8}\u{9875}\u{7684}\u{65e5}\u{5e38}\u{53ef}\u{7528}\u{6027}\u{66f4}\u{5b8c}\u{6574}\u{4e86}\u{3002}",
            },
            ShellPanel {
                id: "tray",
                title: "\u{540e}\u{53f0}\u{5e38}\u{9a7b}",
                phase: "v0.9.0-v1.0.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5173}\u{95ed}\u{4e3b}\u{7a97}\u{53e3}\u{540e}\u{4f1a}\u{9690}\u{85cf}\u{5230}\u{7cfb}\u{7edf}\u{6258}\u{76d8}\u{ff0c}\u{53ef}\u{4ee5}\u{4ece}\u{6258}\u{76d8}\u{91cd}\u{65b0}\u{6253}\u{5f00}\u{6216}\u{9000}\u{51fa}\u{5e94}\u{7528}\u{3002}",
            },
            ShellPanel {
                id: "reward-engine",
                title: "\u{5956}\u{52b1}\u{5f15}\u{64ce}",
                phase: "v1.3.0-v1.3.2",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{73b0}\u{5728}\u{6bcf}\u{5b8c}\u{6210}\u{4e00}\u{8f6e}\u{4e13}\u{6ce8}\u{ff0c}\u{90fd}\u{4f1a}\u{7ed3}\u{7b97}\u{9f99}\u{95e8}\u{5e01}\u{3001}\u{5408}\u{6210}\u{7389}\u{548c}\u{6e90}\u{77f3}\u{ff0c}\u{5e76}\u{7559}\u{4e0b}\u{5956}\u{52b1}\u{6d41}\u{6c34}\u{3002}",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "progression",
                title: "\u{517b}\u{6210}\u{5c42}",
                phase: "\u{9884}\u{7559}",
                status: "\u{672a}\u{6765}\u{6269}\u{5c55}",
                summary: "\u{4e3a}\u{672a}\u{6765}\u{7684}\u{89d2}\u{8272}\u{6210}\u{957f}\u{3001}\u{517b}\u{6210}\u{5faa}\u{73af}\u{6216}\u{6536}\u{96c6}\u{7cfb}\u{7edf}\u{4fdd}\u{7559}\u{7ed3}\u{6784}\u{4f4d}\u{7f6e}\u{3002}",
            },
            ShellPanel {
                id: "theme-profile",
                title: "\u{4e3b}\u{9898}\u{914d}\u{7f6e}",
                phase: "\u{9884}\u{7559}",
                status: "\u{672a}\u{6765}\u{6269}\u{5c55}",
                summary: "\u{8ba9}\u{5f53}\u{524d}\u{514b}\u{5236}\u{7684}\u{57fa}\u{7840}\u{98ce}\u{683c}\u{80fd}\u{5728}\u{540e}\u{9762}\u{5e73}\u{6ed1}\u{5207}\u{6362}\u{4e3a}\u{66f4}\u{591a}\u{4e3b}\u{9898}\u{5316}\u{89c6}\u{89c9}\u{3002}",
            },
        ],
    }
}

#[tauri::command]
fn get_timer_snapshot(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| Ok(engine.snapshot()))
}

#[tauri::command]
fn switch_timer_mode(
    state: tauri::State<'_, TimerEngineState>,
    mode: String,
) -> Result<TimerSnapshot, String> {
    let next_mode = parse_mode(&mode)?;
    with_timer_engine(&state, |engine| {
        engine.switch_mode(next_mode);
        Ok(engine.snapshot())
    })
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

    {
        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.retain(|entry| entry.source_record_id != id);
        sort_reward_ledger(&mut ledger);

        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        *wallet = wallet_from_ledger(&ledger);
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

    {
        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.retain(|entry| !id_set.contains(&entry.source_record_id));
        sort_reward_ledger(&mut ledger);

        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        *wallet = wallet_from_ledger(&ledger);
    }

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
fn get_reward_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RewardSnapshot, String> {
    let records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;
    let wallet = state
        .reward_wallet
        .lock()
        .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
    let ledger = state
        .reward_ledger
        .lock()
        .map_err(|_| "奖励流水状态锁定失败".to_string())?;

    Ok(reward_snapshot(&records, &wallet, &ledger))
}

#[tauri::command]
fn clear_app_data(state: tauri::State<'_, TimerEngineState>) -> Result<(), String> {
    state.clear_all()
}

#[tauri::command]
fn export_focus_records_csv(
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<String, String> {
    if ids.is_empty() {
        return Err("当前范围内没有可导出的专注记录".to_string());
    }

    let id_set = ids.into_iter().collect::<HashSet<_>>();
    let records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;

    let export_records = records
        .iter()
        .filter(|record| id_set.contains(&record.id))
        .cloned()
        .collect::<Vec<_>>();

    if export_records.is_empty() {
        return Err("当前范围内没有可导出的专注记录".to_string());
    }

    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let export_dir = resolve_export_directory()?;
    let export_path = export_dir.join(format!("focused-moment-records-{timestamp}.csv"));

    let mut csv_output =
        String::from("\u{feff}记录日期,记录时间,事务名称,模式,阶段,时长,关联任务\n");
    for record in export_records {
        let line = format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(&record.completed_date),
            csv_escape(&record.completed_time),
            csv_escape(&record.title),
            csv_escape(&record.mode_label),
            csv_escape(&record.phase_label),
            csv_escape(&record.duration_label),
            csv_escape(record.linked_todo_title.as_deref().unwrap_or("")),
        );
        csv_output.push_str(&line);
    }

    fs::write(&export_path, csv_output).map_err(|error| error.to_string())?;
    Ok(export_path.display().to_string())
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
    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{66f4}\u{65b0}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.is_completed = !item.is_completed;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
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
    Ok(items)
}

#[tauri::command]
fn start_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.start();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn pause_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.pause();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn reset_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.reset();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn complete_focus_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    linked_todo_id: Option<u64>,
) -> Result<CompletionPayload, String> {
    let completed_session = with_timer_engine(&state, |engine| engine.complete_focus_session())?;
    let (completed_at, completed_date, completed_time) = current_local_markers();

    let linked_todo_title = match linked_todo_id {
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
    let record_title = if normalized_title.is_empty() {
        linked_todo_title
            .clone()
            .unwrap_or_else(|| "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string())
    } else {
        normalized_title.to_string()
    };

    let record = FocusRecord {
        id: next_id,
        title: record_title.clone(),
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        mode_key: completed_session.mode_key.to_string(),
        mode_label: completed_session.mode_label.to_string(),
        phase_label: completed_session.phase_label.to_string(),
        linked_todo_id,
        linked_todo_title,
        completed_at,
        completed_date,
        completed_time,
    };

    let record_id = record.id;
    let reward_completed_at = record.completed_at.clone();
    let reward_completed_date = record.completed_date.clone();
    let reward_completed_time = record.completed_time.clone();

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        sort_focus_records(&mut records);
        records.clone()
    };

    let reward_id = {
        let mut id_guard = state
            .next_reward_id
            .lock()
            .map_err(|_| "奖励编号状态锁定失败".to_string())?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let reward_ledger_before = {
        let ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.clone()
    };

    let reward_entry = build_reward_entry(
        reward_id,
        record_id,
        &record_title,
        &completed_session,
        reward_completed_at,
        reward_completed_date,
        reward_completed_time,
        linked_todo_id,
        &reward_ledger_before,
    );

    let reward_snapshot = {
        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        wallet.lmd = wallet.lmd.saturating_add(reward_entry.lmd);
        wallet.orundum = wallet.orundum.saturating_add(reward_entry.orundum);
        wallet.originium = wallet.originium.saturating_add(reward_entry.originium);

        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.insert(0, reward_entry);
        sort_reward_ledger(&mut ledger);

        reward_snapshot(&records, &wallet, &ledger)
    };

    state.persist()?;

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;

    Ok(CompletionPayload {
        timer_snapshot,
        records,
        reward_snapshot,
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
fn start_dragging_main_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
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
            switch_timer_mode,
            get_focus_records,
            delete_focus_record,
            delete_focus_records,
            get_analytics_snapshot,
            get_reward_snapshot,
            clear_app_data,
            export_focus_records_csv,
            get_todo_items,
            create_todo_item,
            update_todo_item,
            toggle_todo_item,
            delete_todo_item,
            start_timer,
            pause_timer,
            reset_timer,
            complete_focus_session,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            quit_application,
            show_main_window_from_tray,
            start_dragging_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
