import { invoke } from "@tauri-apps/api/core";
import type {
  AnalyticsSnapshot,
  BackupExportResult,
  BackupImportResult,
  BackupListItem,
  CompletionPayload,
  FocusRecord,
  TimerPreferences,
  TimerSnapshot,
} from "./contracts";

export async function getTimerSnapshot() {
  return invoke<TimerSnapshot>("get_timer_snapshot");
}

export async function getTimerPreferences() {
  return invoke<TimerPreferences>("get_timer_preferences");
}

export async function updateTimerPreferences(preferences: TimerPreferences) {
  return invoke<TimerPreferences>("update_timer_preferences", { preferences });
}

export async function startTimer() {
  return invoke<TimerSnapshot>("start_timer");
}

export async function pauseTimer() {
  return invoke<TimerSnapshot>("pause_timer");
}

export async function resetTimer() {
  return invoke<TimerSnapshot>("reset_timer");
}

export async function switchTimerMode(mode: "stopwatch" | "pomodoro") {
  return invoke<TimerSnapshot>("switch_timer_mode", { mode });
}

export async function updateTimerContext(
  title: string,
  linkedTodoId: number | null
) {
  return invoke<TimerSnapshot>("update_timer_context", {
    title,
    linkedTodoId,
  });
}

export async function getFocusRecords() {
  return invoke<FocusRecord[]>("get_focus_records");
}

export async function getAnalyticsSnapshot() {
  return invoke<AnalyticsSnapshot>("get_analytics_snapshot");
}

export async function deleteFocusRecord(id: number) {
  return invoke<FocusRecord[]>("delete_focus_record", { id });
}

export async function deleteFocusRecords(ids: number[]) {
  return invoke<FocusRecord[]>("delete_focus_records", { ids });
}

export async function listAppBackups() {
  return invoke<BackupListItem[]>("list_app_backups");
}

export async function exportAppBackup() {
  return invoke<BackupExportResult>("export_app_backup");
}

export async function importAppBackup(fileName: string) {
  return invoke<BackupImportResult>("import_app_backup", { fileName });
}

export async function clearAppData() {
  return invoke("clear_app_data");
}

export async function completeFocusSession(
  title: string,
  linkedTodoId: number | null
) {
  return invoke<CompletionPayload>("complete_focus_session", {
    title,
    linkedTodoId,
  });
}
