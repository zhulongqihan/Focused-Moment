import { invoke } from "@tauri-apps/api/core";
import type {
  AnalyticsSnapshot,
  AppPreferences,
  BackupImportOptions,
  BackupPreview,
  BackupExportResult,
  BackupImportResult,
  BackupListItem,
  CompletionPayload,
  FocusRecord,
  FocusPlanState,
  TimerPreferences,
  TimerSnapshot,
} from "./contracts";

export async function getTimerSnapshot() {
  return invoke<TimerSnapshot>("get_timer_snapshot");
}

export async function acknowledgeTimerAlert() {
  return invoke<TimerSnapshot>("acknowledge_timer_alert");
}

export async function getTimerPreferences() {
  return invoke<TimerPreferences>("get_timer_preferences");
}

export async function getAppPreferences() {
  return invoke<AppPreferences>("get_app_preferences");
}

export async function updateAppPreferences(preferences: AppPreferences) {
  return invoke<AppPreferences>("update_app_preferences", { preferences });
}

export async function getFocusPlan() {
  return invoke<FocusPlanState>("get_focus_plan");
}

export async function updateFocusPlan(plan: FocusPlanState) {
  return invoke<FocusPlanState>("update_focus_plan", {
    currentTodoId: plan.currentTodoId,
    todayPickIds: plan.todayPickIds,
  });
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

export async function switchTimerMode(
  mode: "stopwatch" | "countdown" | "pomodoro"
) {
  return invoke<TimerSnapshot>("switch_timer_mode", { mode });
}

export async function setCountdownMinutes(minutes: number) {
  return invoke<TimerSnapshot>("set_countdown_minutes", { minutes });
}

export async function updateTimerContext(
  title: string,
  linkedTodoId: number | null,
  completeLinkedTodoOnFinish: boolean
) {
  return invoke<TimerSnapshot>("update_timer_context", {
    title,
    linkedTodoId,
    completeLinkedTodoOnFinish,
  });
}

export async function getFocusRecords() {
  return invoke<FocusRecord[]>("get_focus_records");
}

export async function updateFocusRecordTitle(id: number, title: string) {
  return invoke<FocusRecord[]>("update_focus_record_title", { id, title });
}

export async function createManualFocusRecord(payload: {
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
}) {
  return invoke<FocusRecord[]>("create_manual_focus_record", {
    title: payload.title,
    durationMinutes: payload.durationMinutes,
    completedDate: payload.completedDate,
    completedTime: payload.completedTime,
    linkedTodoId: payload.linkedTodoId,
  });
}

export async function updateFocusRecord(payload: {
  id: number;
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
}) {
  return invoke<FocusRecord[]>("update_focus_record", {
    id: payload.id,
    title: payload.title,
    durationMinutes: payload.durationMinutes,
    completedDate: payload.completedDate,
    completedTime: payload.completedTime,
    linkedTodoId: payload.linkedTodoId,
  });
}

export async function getAnalyticsSnapshot() {
  return invoke<AnalyticsSnapshot>("get_analytics_snapshot");
}

export async function deleteFocusRecord(id: number) {
  return invoke<FocusRecord[]>("delete_focus_record", { id });
}

export async function restoreFocusRecord(record: FocusRecord) {
  return invoke<FocusRecord[]>("restore_focus_record", { record });
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

export async function previewAppBackupPath(path: string) {
  return invoke<BackupPreview>("preview_app_backup_path", { path });
}

export async function exportAppBackupToPath(path: string) {
  return invoke<BackupExportResult>("export_app_backup_to_path", { path });
}

export async function importAppBackupPath(path: string, options: BackupImportOptions) {
  return invoke<BackupImportResult>("import_app_backup_path", {
    path,
    restoreTodos: options.restoreTodos,
    restoreRecords: options.restoreRecords,
    restoreAppPreferences: options.restoreAppPreferences,
  });
}

export async function clearAppData() {
  return invoke("clear_app_data");
}

export async function completeFocusSession(
  title: string
) {
  return invoke<CompletionPayload>("complete_focus_session", {
    title,
  });
}

export async function openAppBackupFolder() {
  return invoke("open_app_backup_folder");
}
