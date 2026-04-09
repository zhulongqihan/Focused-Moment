use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

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
    mode: &'static str,
    status: &'static str,
    is_running: bool,
    elapsed_ms: u64,
    elapsed_label: String,
}

#[derive(Default)]
struct TimerEngineState {
    stopwatch: Mutex<StopwatchEngine>,
    focus_records: Mutex<Vec<FocusRecord>>,
    next_record_id: Mutex<u64>,
}

#[derive(Default)]
struct StopwatchEngine {
    accumulated: Duration,
    started_at: Option<Instant>,
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

impl StopwatchEngine {
    fn start(&mut self) {
        if self.started_at.is_none() {
            self.started_at = Some(Instant::now());
        }
    }

    fn pause(&mut self) {
        if let Some(started_at) = self.started_at.take() {
            self.accumulated += started_at.elapsed();
        }
    }

    fn reset(&mut self) {
        self.accumulated = Duration::ZERO;
        self.started_at = None;
    }

    fn snapshot(&self) -> TimerSnapshot {
        let elapsed = self.elapsed();
        let is_running = self.started_at.is_some();
        let status = if is_running {
            "\u{8ba1}\u{65f6}\u{4e2d}"
        } else if elapsed.is_zero() {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        TimerSnapshot {
            mode: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            status,
            is_running,
            elapsed_ms: elapsed.as_millis() as u64,
            elapsed_label: format_duration(elapsed),
        }
    }

    fn elapsed(&self) -> Duration {
        match self.started_at {
            Some(started_at) => self.accumulated + started_at.elapsed(),
            None => self.accumulated,
        }
    }
}

fn with_timer_engine<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut StopwatchEngine) -> T,
) -> Result<T, String> {
    let mut engine = state.stopwatch.lock().map_err(|_| {
        "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(f(&mut engine))
}

fn format_duration(duration: Duration) -> String {
    let total_seconds = duration.as_secs();
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: "0.2.0",
        milestone: "v0.2 \u{6b63}\u{5411}\u{8ba1}\u{65f6}",
        slogan: "\u{7cbe}\u{51c6}\u{8ba1}\u{65f6}\u{ff0c}\u{5b89}\u{9759}\u{4e13}\u{6ce8}\u{ff0c}\u{4ece}\u{8fd9}\u{4e00}\u{523b}\u{5f00}\u{59cb}\u{3002}",
        surfaces: vec![
            ShellPanel {
                id: "timer",
                title: "\u{65f6}\u{95f4}\u{5f15}\u{64ce}",
                phase: "v0.2-v0.3",
                status: "\u{8fdb}\u{884c}\u{4e2d}",
                summary: "\u{5f53}\u{524d}\u{5df2}\u{63a5}\u{5165} Rust \u{9a71}\u{52a8}\u{7684}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{ff0c}\u{4e0b}\u{4e00}\u{7248}\u{7ee7}\u{7eed}\u{8865}\u{4e0a}\u{756a}\u{8304}\u{949f}\u{4e0e}\u{540e}\u{53f0}\u{7cbe}\u{5ea6}\u{6821}\u{6b63}\u{3002}",
            },
            ShellPanel {
                id: "tasks",
                title: "\u{4efb}\u{52a1}\u{9762}\u{677f}",
                phase: "v0.4-v0.6",
                status: "\u{5f85}\u{5f00}\u{53d1}",
                summary: "\u{540e}\u{7eed}\u{4f1a}\u{9010}\u{6b65}\u{63a5}\u{5165}\u{4efb}\u{52a1}\u{65b0}\u{589e}\u{3001}\u{7f16}\u{8f91}\u{3001}\u{5b8c}\u{6210}\u{72b6}\u{6001}\u{4ee5}\u{53ca}\u{53ef}\u{5251}\u{79bb}\u{60ac}\u{6d6e}\u{7a97}\u{3002}",
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
    with_timer_engine(&state, |engine| engine.snapshot())
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
fn start_stopwatch(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.start();
        engine.snapshot()
    })
}

#[tauri::command]
fn pause_stopwatch(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.pause();
        engine.snapshot()
    })
}

#[tauri::command]
fn reset_stopwatch(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.reset();
        engine.snapshot()
    })
}

#[tauri::command]
fn complete_stopwatch_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
) -> Result<CompletionPayload, String> {
    let elapsed = {
        let mut engine = state.stopwatch.lock().map_err(|_| {
            "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        engine.pause();
        let elapsed = engine.elapsed();

        if elapsed.is_zero() {
            return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
        }

        engine.reset();
        elapsed
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
    let record = FocusRecord {
        id: next_id,
        title: if normalized_title.is_empty() {
            "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string()
        } else {
            normalized_title.to_string()
        },
        duration_ms: elapsed.as_millis() as u64,
        duration_label: format_duration(elapsed),
    };

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        records.clone()
    };

    let timer_snapshot = {
        let engine = state.stopwatch.lock().map_err(|_| {
            "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        engine.snapshot()
    };

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
            get_focus_records,
            start_stopwatch,
            pause_stopwatch,
            reset_stopwatch,
            complete_stopwatch_session,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
