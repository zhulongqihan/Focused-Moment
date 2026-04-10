use std::cmp::Reverse;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use serde::Serialize;

const POMODORO_FOCUS_MS: u64 = 25 * 60 * 1000;
const POMODORO_BREAK_MS: u64 = 5 * 60 * 1000;

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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerSnapshot {
    mode_key: &'static str,
    mode: &'static str,
    phase_label: &'static str,
    status: &'static str,
    is_running: bool,
    elapsed_ms: u64,
    elapsed_label: String,
    secondary_label: &'static str,
    can_complete_session: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FocusRecord {
    id: u64,
    title: String,
    duration_ms: u64,
    duration_label: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletionPayload {
    timer_snapshot: TimerSnapshot,
    records: Vec<FocusRecord>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TodoItem {
    id: u64,
    title: String,
    is_completed: bool,
    created_at_label: String,
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

#[derive(Default)]
struct TimerEngineState {
    timer: Mutex<TimerEngine>,
    focus_records: Mutex<Vec<FocusRecord>>,
    next_record_id: Mutex<u64>,
    todo_items: Mutex<Vec<TodoItem>>,
    next_todo_id: Mutex<u64>,
}

#[derive(Default)]
struct TimerEngine {
    mode: TimerMode,
    running_anchor: Option<RunAnchor>,
    stopwatch_elapsed_ms: u64,
    pomodoro_elapsed_ms: u64,
    pomodoro_phase: PomodoroPhase,
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

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
            }
        }
    }

    fn switch_mode(&mut self, mode: TimerMode) {
        if self.mode == mode {
            return;
        }

        self.mode = mode;
        self.running_anchor = None;

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
            }
        }
    }

    fn complete_stopwatch_session(&mut self) -> Result<u64, String> {
        if self.mode != TimerMode::Stopwatch {
            return Err("\u{53ea}\u{6709}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{6a21}\u{5f0f}\u{53ef}\u{4ee5}\u{5b8c}\u{6210}\u{5e76}\u{8bb0}\u{5f55}".to_string());
        }

        self.sync_running_time();
        let elapsed_ms = self.stopwatch_elapsed_ms;

        if elapsed_ms == 0 {
            return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
        }

        self.stopwatch_elapsed_ms = 0;
        self.running_anchor = None;

        Ok(elapsed_ms)
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
            mode: "\u{756a}\u{8304}\u{949f}",
            phase_label,
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            secondary_label,
            can_complete_session: false,
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

fn sort_todo_items(items: &mut [TodoItem]) {
    items.sort_by_key(|item| (item.is_completed, Reverse(item.id)));
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

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: "0.4.0",
        milestone: "v0.4.0 \u{4efb}\u{52a1}\u{6e05}\u{5355}\u{57fa}\u{7840}\u{7248}",
        slogan: "\u{5728}\u{7cbe}\u{51c6}\u{8ba1}\u{65f6}\u{4e4b}\u{5916}\u{ff0c}\u{4e5f}\u{8ba9}\u{6bcf}\u{4e00}\u{9879}\u{4efb}\u{52a1}\u{80fd}\u{88ab}\u{6e05}\u{6670}\u{5730}\u{6536}\u{62e2}\u{3001}\u{5b8c}\u{6210}\u{548c}\u{7ef4}\u{62a4}\u{3002}",
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
                phase: "v0.4.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5f53}\u{524d}\u{5df2}\u{652f}\u{6301}\u{4efb}\u{52a1}\u{65b0}\u{589e}\u{3001}\u{7f16}\u{8f91}\u{3001}\u{52fe}\u{9009}\u{5b8c}\u{6210}\u{4e0e}\u{5220}\u{9664}\u{ff0c}\u{540e}\u{7eed}\u{518d}\u{63a5}\u{5165}\u{60ac}\u{6d6e}\u{7a97}\u{5f62}\u{6001}\u{3002}",
            },
            ShellPanel {
                id: "analytics",
                title: "\u{6570}\u{636e}\u{590d}\u{76d8}",
                phase: "v0.7-v0.8",
                status: "\u{5f85}\u{5f00}\u{53d1}",
                summary: "\u{540e}\u{7eed}\u{63d0}\u{4f9b}\u{672c}\u{5730}\u{4f18}\u{5148}\u{7684}\u{6bcf}\u{65e5}\u{65f6}\u{957f}\u{805a}\u{5408}\u{4e0e}\u{6781}\u{7b80}\u{8d8b}\u{52bf}\u{7edf}\u{8ba1}\u{5c55}\u{793a}\u{3002}",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "reward-engine",
                title: "\u{5956}\u{52b1}\u{5f15}\u{64ce}",
                phase: "\u{9884}\u{7559}",
                status: "\u{672a}\u{6765}\u{6269}\u{5c55}",
                summary: "\u{628a}\u{4e13}\u{6ce8}\u{65f6}\u{957f}\u{6362}\u{7b97}\u{6210}\u{5185}\u{90e8}\u{8d27}\u{5e01}\u{ff0c}\u{4f46}\u{4e0d}\u{548c}\u{8ba1}\u{65f6}\u{6838}\u{5fc3}\u{5f3a}\u{8026}\u{5408}\u{3002}",
            },
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
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;

    let next_id = {
        let mut id_guard = state.next_todo_id.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    with_todo_items(&state, |items| {
        items.insert(
            0,
            TodoItem {
                id: next_id,
                title: normalized_title,
                is_completed: false,
                created_at_label: "\u{521a}\u{521a}\u{6dfb}\u{52a0}".to_string(),
            },
        );
        sort_todo_items(items);
        Ok(items.clone())
    })
}

#[tauri::command]
fn update_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;

    with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{7f16}\u{8f91}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.title = normalized_title;
        Ok(items.clone())
    })
}

#[tauri::command]
fn toggle_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{66f4}\u{65b0}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.is_completed = !item.is_completed;
        sort_todo_items(items);
        Ok(items.clone())
    })
}

#[tauri::command]
fn delete_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    with_todo_items(&state, |items| {
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
    })
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
fn complete_stopwatch_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
) -> Result<CompletionPayload, String> {
    let elapsed_ms = with_timer_engine(&state, |engine| engine.complete_stopwatch_session())?;

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
    let record = FocusRecord {
        id: next_id,
        title: if normalized_title.is_empty() {
            "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string()
        } else {
            normalized_title.to_string()
        },
        duration_ms: elapsed_ms,
        duration_label: format_duration_ms(elapsed_ms),
    };

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        records.clone()
    };

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;

    Ok(CompletionPayload {
        timer_snapshot,
        records,
    })
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
    window.close().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TimerEngineState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap_shell,
            get_timer_snapshot,
            switch_timer_mode,
            get_focus_records,
            get_todo_items,
            create_todo_item,
            update_todo_item,
            toggle_todo_item,
            delete_todo_item,
            start_timer,
            pause_timer,
            reset_timer,
            complete_stopwatch_session,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
