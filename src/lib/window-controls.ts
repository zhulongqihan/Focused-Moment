import { invoke } from "@tauri-apps/api/core";

export async function minimizeMainWindow() {
  await invoke("minimize_main_window");
}

export async function toggleMaximizeMainWindow() {
  return invoke<boolean>("toggle_maximize_main_window");
}

export async function closeMainWindow() {
  await invoke("close_main_window");
}
