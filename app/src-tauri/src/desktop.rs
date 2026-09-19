use super::*;

#[cfg(windows)]
use std::mem::size_of;
#[cfg(windows)]
use std::sync::OnceLock;

#[cfg(windows)]
use tauri::menu::{Menu, MenuItem};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, Window,
};

#[cfg(windows)]
use tauri::Wry;

#[cfg(target_os = "macos")]
use objc2::{rc::Retained, MainThreadMarker};

#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FlashWindowEx, FLASHWINFO, FLASHW_TIMERNOFG, FLASHW_TRAY,
};

const TRAY_SHOW_ID: &str = "tray_show_main";
const TRAY_QUIT_ID: &str = "tray_quit_app";
#[cfg(windows)]
const TRAY_STATUS_ID: &str = "tray_status";
#[cfg(windows)]
const TRAY_TASK_ID: &str = "tray_task";
#[cfg(windows)]
const TRAY_TIMER_ACTION_ID: &str = "tray_timer_action";
#[cfg(windows)]
const TRAY_FOCUS_FLOATING_ID: &str = "tray_open_focus_floating";
#[cfg(windows)]
const TRAY_OPEN_FOCUS_ID: &str = "tray_open_focus";
#[cfg(windows)]
const TRAY_OPEN_TODAY_ID: &str = "tray_open_today";
#[cfg(windows)]
const TRAY_OPEN_TODOS_ID: &str = "tray_open_todos";
#[cfg(windows)]
const TRAY_OPEN_RECORDS_ID: &str = "tray_open_records";
#[cfg(windows)]
const TRAY_NAVIGATE_EVENT: &str = "tray-navigate";

#[cfg(windows)]
struct TrayMenuState {
    status_item: MenuItem<Wry>,
    task_item: MenuItem<Wry>,
    timer_action_item: MenuItem<Wry>,
    focus_floating_item: MenuItem<Wry>,
}

#[cfg(windows)]
static TRAY_MENU_STATE: OnceLock<TrayMenuState> = OnceLock::new();

pub(crate) fn show_main_window(app: &AppHandle) -> Result<(), String> {
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

pub(crate) fn build_floating_window(
    app: &AppHandle,
    label: &str,
    title: &str,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
) -> Result<tauri::WebviewWindow, String> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(width, height)
        .min_inner_size(min_width, min_height)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .build()
        .map_err(|error| error.to_string())
}

pub(crate) fn build_unlock_window(
    app: &AppHandle,
    label: &str,
    title: &str,
) -> Result<tauri::WebviewWindow, String> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(42.0, 42.0)
        .min_inner_size(42.0, 42.0)
        .max_inner_size(42.0, 42.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .build()
        .map_err(|error| error.to_string())
}

pub(crate) fn ensure_todo_floating_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("todo-float").map_or_else(
        || {
            build_floating_window(
                app,
                "todo-float",
                "Focused Moment 迷你工作台",
                360.0,
                340.0,
                280.0,
                260.0,
            )
        },
        Ok,
    )
}

pub(crate) fn ensure_focus_floating_window(
    app: &AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("focus-float").map_or_else(
        || {
            build_floating_window(
                app,
                "focus-float",
                "Focused Moment 专注",
                320.0,
                230.0,
                280.0,
                200.0,
            )
        },
        Ok,
    )
}

pub(crate) fn ensure_todo_unlock_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("todo-unlock").map_or_else(
        || build_unlock_window(app, "todo-unlock", "解除待办锁定"),
        Ok,
    )
}

pub(crate) fn ensure_focus_unlock_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("focus-unlock").map_or_else(
        || build_unlock_window(app, "focus-unlock", "解除专注锁定"),
        Ok,
    )
}

pub(crate) fn close_utility_window(app: &AppHandle, label: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(crate) fn hide_main_window(window: &Window) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

pub(crate) fn snapshot_from_timer_state(state: &TimerEngineState) -> Result<TimerSnapshot, String> {
    state.ensure_ready()?;
    let mut engine = state
        .timer
        .lock()
        .map_err(|_| "计时引擎状态锁定失败".to_string())?;
    Ok(engine.snapshot())
}

#[cfg(windows)]
pub(crate) fn tray_has_progress(snapshot: &TimerSnapshot) -> bool {
    snapshot.has_unsubmitted_progress
}

#[cfg(windows)]
pub(crate) fn tray_can_continue(snapshot: &TimerSnapshot) -> bool {
    tray_has_progress(snapshot)
        && !(snapshot.mode_key == "countdown" && snapshot.remaining_ms == Some(0))
}

#[cfg(windows)]
pub(crate) fn tray_status_text(snapshot: &TimerSnapshot) -> String {
    let duration = if tray_has_progress(snapshot) {
        match snapshot.mode_key {
            "stopwatch" => format!(" · 已用 {}", snapshot.elapsed_label),
            _ => format!(" · 剩余 {}", snapshot.elapsed_label),
        }
    } else {
        String::new()
    };

    format!("当前状态：{}{}", snapshot.status, duration)
}

#[cfg(windows)]
pub(crate) fn tray_task_text(snapshot: &TimerSnapshot) -> String {
    let normalized: String = snapshot
        .active_task_title
        .chars()
        .map(|character| match character {
            '\r' | '\n' | '\t' => ' ',
            _ => character,
        })
        .collect();
    let trimmed = normalized.trim();
    let mut characters = trimmed.chars();
    let clipped: String = characters.by_ref().take(36).collect();
    let title = if characters.next().is_some() {
        format!("{clipped}…")
    } else if clipped.is_empty() {
        "尚未指定".to_string()
    } else {
        clipped
    };

    format!("当前事项：{title}")
}

#[cfg(windows)]
pub(crate) fn tray_timer_action(snapshot: &TimerSnapshot) -> (&'static str, bool) {
    if snapshot.is_running {
        ("暂停计时", true)
    } else if tray_can_continue(snapshot) {
        ("继续计时", true)
    } else if tray_has_progress(snapshot) && snapshot.remaining_ms == Some(0) {
        ("计时已结束，请打开计时页", false)
    } else {
        ("没有可继续的计时", false)
    }
}

#[cfg(windows)]
pub(crate) fn refresh_system_tray_menu(snapshot: &TimerSnapshot) {
    let Some(menu_state) = TRAY_MENU_STATE.get() else {
        return;
    };

    let (timer_action, timer_action_enabled) = tray_timer_action(snapshot);
    let _ = menu_state.status_item.set_text(tray_status_text(snapshot));
    let _ = menu_state.task_item.set_text(tray_task_text(snapshot));
    let _ = menu_state.timer_action_item.set_text(timer_action);
    let _ = menu_state
        .timer_action_item
        .set_enabled(timer_action_enabled);
    let _ = menu_state
        .focus_floating_item
        .set_enabled(tray_has_progress(snapshot));
}

#[cfg(not(windows))]
pub(crate) fn refresh_system_tray_menu(_snapshot: &TimerSnapshot) {}

#[cfg(windows)]
pub(crate) fn default_tray_snapshot() -> TimerSnapshot {
    let mut engine = TimerEngine::default();
    engine.snapshot()
}

#[cfg(windows)]
pub(crate) fn initial_tray_snapshot(app: &AppHandle) -> TimerSnapshot {
    app.try_state::<TimerEngineState>()
        .and_then(|state| snapshot_from_timer_state(&state).ok())
        .unwrap_or_else(default_tray_snapshot)
}

#[cfg(windows)]
pub(crate) fn build_windows_tray_menu(app: &AppHandle) -> Result<Menu<Wry>, String> {
    let snapshot = initial_tray_snapshot(app);
    let (timer_action, timer_action_enabled) = tray_timer_action(&snapshot);

    let status_item = MenuItemBuilder::with_id(TRAY_STATUS_ID, tray_status_text(&snapshot))
        .enabled(false)
        .build(app)
        .map_err(|error| error.to_string())?;
    let task_item = MenuItemBuilder::with_id(TRAY_TASK_ID, tray_task_text(&snapshot))
        .enabled(false)
        .build(app)
        .map_err(|error| error.to_string())?;
    let timer_action_item = MenuItemBuilder::with_id(TRAY_TIMER_ACTION_ID, timer_action)
        .enabled(timer_action_enabled)
        .build(app)
        .map_err(|error| error.to_string())?;
    let focus_floating_item = MenuItemBuilder::with_id(TRAY_FOCUS_FLOATING_ID, "打开迷你工作台")
        .enabled(tray_has_progress(&snapshot))
        .build(app)
        .map_err(|error| error.to_string())?;
    let open_focus_item = MenuItemBuilder::with_id(TRAY_OPEN_FOCUS_ID, "打开计时页")
        .build(app)
        .map_err(|error| error.to_string())?;
    let open_today_item = MenuItemBuilder::with_id(TRAY_OPEN_TODAY_ID, "打开今日")
        .build(app)
        .map_err(|error| error.to_string())?;
    let open_todos_item = MenuItemBuilder::with_id(TRAY_OPEN_TODOS_ID, "打开待办")
        .build(app)
        .map_err(|error| error.to_string())?;
    let open_records_item = MenuItemBuilder::with_id(TRAY_OPEN_RECORDS_ID, "打开记录")
        .build(app)
        .map_err(|error| error.to_string())?;
    let show_item = MenuItemBuilder::with_id(TRAY_SHOW_ID, "显示主界面")
        .build(app)
        .map_err(|error| error.to_string())?;
    let quit_item = MenuItemBuilder::with_id(TRAY_QUIT_ID, "退出应用")
        .build(app)
        .map_err(|error| error.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&task_item)
        .separator()
        .item(&timer_action_item)
        .item(&focus_floating_item)
        .separator()
        .item(&open_focus_item)
        .item(&open_today_item)
        .item(&open_todos_item)
        .item(&open_records_item)
        .separator()
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|error| error.to_string())?;

    TRAY_MENU_STATE
        .set(TrayMenuState {
            status_item,
            task_item,
            timer_action_item,
            focus_floating_item,
        })
        .map_err(|_| "托盘菜单重复初始化".to_string())?;

    Ok(menu)
}

#[cfg(windows)]
pub(crate) fn toggle_timer_from_tray(app: &AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<TimerEngineState>()
        .ok_or_else(|| "找不到计时状态".to_string())?;
    let snapshot = {
        state.ensure_ready()?;
        let mut engine = state
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?;
        let current = engine.snapshot();
        if current.is_running {
            engine.pause();
        } else if tray_can_continue(&current) {
            engine.start();
        } else {
            return Err("当前没有可继续的计时，请打开计时页检查当前状态。".to_string());
        }
        engine.snapshot()
    };

    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(())
}

#[cfg(windows)]
pub(crate) fn navigate_from_tray(app: &AppHandle, view: &str) -> Result<(), String> {
    show_main_window(app)?;
    app.emit_to("main", TRAY_NAVIGATE_EVENT, view)
        .map_err(|error| error.to_string())
}

pub(crate) fn build_system_tray(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    let menu = build_windows_tray_menu(app)?;

    #[cfg(not(windows))]
    let menu = {
        let show_item = MenuItemBuilder::with_id(TRAY_SHOW_ID, "显示主界面")
            .build(app)
            .map_err(|error| error.to_string())?;
        let quit_item = MenuItemBuilder::with_id(TRAY_QUIT_ID, "退出应用")
            .build(app)
            .map_err(|error| error.to_string())?;

        MenuBuilder::new(app)
            .item(&show_item)
            .separator()
            .item(&quit_item)
            .build()
            .map_err(|error| error.to_string())?
    };

    let mut tray_builder = TrayIconBuilder::with_id("focused-moment-tray")
        .menu(&menu)
        .tooltip("Focused Moment")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            TRAY_SHOW_ID => {
                let result = show_main_window(app);
                if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
                    match result {
                        Ok(()) => eprintln!("FOCUSED_MOMENT_TRAY_MENU_SHOW_MAIN=ok"),
                        Err(error) => {
                            eprintln!("FOCUSED_MOMENT_TRAY_MENU_SHOW_MAIN=error:{error}")
                        }
                    }
                }
            }
            #[cfg(windows)]
            TRAY_TIMER_ACTION_ID => {
                if let Err(error) = toggle_timer_from_tray(app) {
                    eprintln!("FOCUSED_MOMENT_TRAY_TIMER_ACTION=error:{error}");
                }
            }
            #[cfg(windows)]
            TRAY_FOCUS_FLOATING_ID => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    match show_focus_floating(app_handle).await {
                        Ok(()) => eprintln!("FOCUSED_MOMENT_TRAY_FOCUS_FLOATING=ok"),
                        Err(error) => {
                            eprintln!("FOCUSED_MOMENT_TRAY_FOCUS_FLOATING=error:{error}")
                        }
                    }
                });
            }
            #[cfg(windows)]
            TRAY_OPEN_FOCUS_ID => {
                if let Err(error) = navigate_from_tray(app, "focus") {
                    eprintln!("FOCUSED_MOMENT_TRAY_NAVIGATE=focus:error:{error}");
                }
            }
            #[cfg(windows)]
            TRAY_OPEN_TODAY_ID => {
                if let Err(error) = navigate_from_tray(app, "today") {
                    eprintln!("FOCUSED_MOMENT_TRAY_NAVIGATE=today:error:{error}");
                }
            }
            #[cfg(windows)]
            TRAY_OPEN_TODOS_ID => {
                if let Err(error) = navigate_from_tray(app, "todos") {
                    eprintln!("FOCUSED_MOMENT_TRAY_NAVIGATE=todos:error:{error}");
                }
            }
            #[cfg(windows)]
            TRAY_OPEN_RECORDS_ID => {
                if let Err(error) = navigate_from_tray(app, "records") {
                    eprintln!("FOCUSED_MOMENT_TRAY_NAVIGATE=records:error:{error}");
                }
            }
            TRAY_QUIT_ID => {
                if let Some(state) = app.try_state::<AppLifecycleState>() {
                    state.mark_quitting();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<_>, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let _ = show_main_window(tray.app_handle());
            }
            #[cfg(windows)]
            TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } => {
                if let Some(state) = tray.app_handle().try_state::<TimerEngineState>() {
                    if let Ok(snapshot) = snapshot_from_timer_state(&state) {
                        refresh_system_tray_menu(&snapshot);
                    }
                }
            }
            _ => {}
        });

    #[cfg(target_os = "macos")]
    {
        // A text label keeps the status item visible and discoverable in
        // macOS Accessibility/SystemUIServer surfaces when a runner or user
        // account does not expose image-only status items.
        tray_builder = tray_builder.title("Focused Moment");
    }

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let _tray = tray_builder.build(app).map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
        let result = _tray
            .with_inner_tray_icon(|inner| {
                if let Some(status_item) = inner.ns_status_item() {
                    NATIVE_SMOKE_STATUS_ITEM.with(|cell| {
                        *cell.borrow_mut() = Some(status_item);
                    });
                    true
                } else {
                    false
                }
            })
            .map_err(|error| error.to_string());
        match result {
            Ok(true) => {
                eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_SETUP=status-item-ready");
            }
            Ok(false) => {
                eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_SETUP=error:status-item-unavailable")
            }
            Err(error) => eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_SETUP=error:{error}"),
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
thread_local! {
    static NATIVE_SMOKE_STATUS_ITEM: std::cell::RefCell<Option<Retained<objc2_app_kit::NSStatusItem>>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(target_os = "macos")]
pub(crate) fn trigger_native_smoke_tray_click() {
    if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
        eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=started");
    }

    if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
        eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=before-status-item");
    }
    let result = NATIVE_SMOKE_STATUS_ITEM.with(|status_item_cell| {
        let status_item_ref = status_item_cell.borrow();
        let Some(status_item) = status_item_ref.as_ref() else {
            return Err("status-item-unavailable".to_string());
        };
        let Some(marker) = MainThreadMarker::new() else {
            return Err("main-thread-marker-unavailable".to_string());
        };
        let Some(button) = status_item.button(marker) else {
            return Err("status-button-unavailable".to_string());
        };

        // NSStatusItem is hosted by ControlCenter on current macOS runners,
        // so a screen coordinate is not a stable user-event target. AppKit's
        // native performClick path is the same status-item button action and
        // keeps this smoke assertion on the shipped tray/menu wiring.
        unsafe { button.performClick(None) };
        Ok(())
    });

    if std::env::var_os("FOCUSED_MOMENT_NATIVE_SMOKE").is_some() {
        eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=after-status-item");
    }

    match result {
        Ok(()) => eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=ok"),
        Err(error) => eprintln!("FOCUSED_MOMENT_TRAY_NATIVE_CLICK=error:{error}"),
    }
}

#[tauri::command]
pub(crate) fn minimize_main_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn toggle_maximize_main_window(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub(crate) fn close_main_window(window: tauri::Window) -> Result<(), String> {
    hide_main_window(&window)
}

#[tauri::command]
pub(crate) async fn show_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    close_utility_window(&app, "focus-float")?;
    close_utility_window(&app, "focus-unlock")?;
    close_utility_window(&app, "todo-unlock")?;
    let floating_window = ensure_todo_floating_window(&app)?;

    floating_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    floating_window.show().map_err(|error| error.to_string())?;
    floating_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    let _ = floating_window.emit(FLOATING_WORKSPACE_SYNC_EVENT, ());
    main_window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn lock_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到迷你工作台".to_string())?;
    let unlock_window = ensure_todo_unlock_window(&app)?;

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
pub(crate) fn unlock_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    let floating_window = app
        .get_webview_window("todo-float")
        .ok_or_else(|| "找不到迷你工作台".to_string())?;

    // Restore interaction before closing the fallback unlock window. If a
    // native focus/show call is delayed, the user must still have a visible
    // button to retry instead of being left with a click-through window.
    floating_window.show().map_err(|error| error.to_string())?;
    floating_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    floating_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("todo-unlock") {
        unlock_window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn show_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    close_utility_window(&app, "todo-float")?;
    close_utility_window(&app, "todo-unlock")?;
    close_utility_window(&app, "focus-unlock")?;
    let focus_window = ensure_focus_floating_window(&app)?;

    focus_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    focus_window.show().map_err(|error| error.to_string())?;
    focus_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    main_window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn lock_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let focus_window = app
        .get_webview_window("focus-float")
        .ok_or_else(|| "找不到迷你工作台".to_string())?;
    let unlock_window = ensure_focus_unlock_window(&app)?;

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
pub(crate) fn unlock_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    let focus_window = app
        .get_webview_window("focus-float")
        .ok_or_else(|| "找不到迷你工作台".to_string())?;
    // Keep the fallback unlock window alive until the floating window is
    // visible, interactive, and focused. Hiding it first can strand the
    // floating window in click-through mode when Windows delays a focus call.
    focus_window.show().map_err(|error| error.to_string())?;
    focus_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    focus_window
        .set_focus()
        .map_err(|error| error.to_string())?;
    if let Some(unlock_window) = app.get_webview_window("focus-unlock") {
        unlock_window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn restore_main_from_focus_floating(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app)?;
    close_utility_window(&app, "todo-float")?;
    close_utility_window(&app, "todo-unlock")?;
    close_utility_window(&app, "focus-float")?;
    close_utility_window(&app, "focus-unlock")
}

#[tauri::command]
pub(crate) fn restore_main_from_floating_todos(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app)?;
    close_utility_window(&app, "todo-float")?;
    close_utility_window(&app, "todo-unlock")?;
    close_utility_window(&app, "focus-float")?;
    close_utility_window(&app, "focus-unlock")
}

#[tauri::command]
pub(crate) fn quit_application(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppLifecycleState>() {
        state.mark_quitting();
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub(crate) fn show_main_window_from_tray(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
pub(crate) fn flash_main_window_attention(app: tauri::AppHandle) -> Result<(), String> {
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
pub(crate) fn start_dragging_main_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}
