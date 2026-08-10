import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function minimizeMainWindow() {
  await invoke("minimize_main_window");
}

export async function toggleMaximizeMainWindow() {
  return invoke<boolean>("toggle_maximize_main_window");
}

export async function closeMainWindow() {
  await invoke("close_main_window");
}

export async function showFloatingTodos() {
  await invoke("show_floating_todos");
}

export async function lockFloatingTodos() {
  await invoke("lock_floating_todos");
}

export async function unlockFloatingTodos() {
  await invoke("unlock_floating_todos");
}

export async function restoreMainFromFloatingTodos() {
  await invoke("restore_main_from_floating_todos");
}

export async function showFocusFloating() {
  await invoke("show_focus_floating");
}

export async function lockFocusFloating() {
  await invoke("lock_focus_floating");
}

export async function unlockFocusFloating() {
  await invoke("unlock_focus_floating");
}

export async function restoreMainFromFocusFloating() {
  await invoke("restore_main_from_focus_floating");
}

export async function quitApplication() {
  await invoke("quit_application");
}

export async function showMainWindowFromTray() {
  await invoke("show_main_window_from_tray");
}

export async function startDraggingWindow() {
  try {
    await getCurrentWindow().startDragging();
  } catch {
    await invoke("start_dragging_main_window");
  }
}
