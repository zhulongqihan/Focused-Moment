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

export async function startDraggingMainWindow() {
  try {
    await getCurrentWindow().startDragging();
  } catch {
    await invoke("start_dragging_main_window");
  }
}
