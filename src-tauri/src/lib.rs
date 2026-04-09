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

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: "0.1.0",
        milestone: "v0.1 Foundation",
        slogan: "Precision time, calm focus, quiet review.",
        surfaces: vec![
            ShellPanel {
                id: "timer",
                title: "Time Engine",
                phase: "v0.2-v0.3",
                status: "Queued",
                summary:
                    "Rust-owned timer orchestration for stopwatch and pomodoro modes with drift-resistant timing.",
            },
            ShellPanel {
                id: "tasks",
                title: "Task Console",
                phase: "v0.4-v0.6",
                status: "Queued",
                summary:
                    "Task capture, editing, completion states, and later detachment into a compact floating widget.",
            },
            ShellPanel {
                id: "analytics",
                title: "Data Review",
                phase: "v0.7-v0.8",
                status: "Queued",
                summary:
                    "Local-first daily summaries and minimal trend views for reviewing focus output without clutter.",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "reward-engine",
                title: "Reward Engine",
                phase: "Reserved",
                status: "Future",
                summary:
                    "Converts focused time into internal currency without coupling reward logic to the timer core.",
            },
            ShellPanel {
                id: "progression",
                title: "Progression Layer",
                phase: "Reserved",
                status: "Future",
                summary:
                    "Supports future operator growth, upgrade loops, or collection systems without entering the MVP now.",
            },
            ShellPanel {
                id: "theme-profile",
                title: "Theme Profiles",
                phase: "Reserved",
                status: "Future",
                summary:
                    "Allows the calm default aesthetic to evolve into themed presentation layers later without changing features.",
            },
        ],
    }
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
        .invoke_handler(tauri::generate_handler![
            bootstrap_shell,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
