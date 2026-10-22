import { invoke } from "@tauri-apps/api/core";
import type {
  AnalyticsSnapshot,
  AppPreferencesPatch,
  AppPreferencesView,
  BackupImportOptions,
  BackupPreview,
  BackupExportResult,
  BackupImportResult,
  BackupListItem,
  CompletionPayload,
  CustomAlertAudio,
  CustomAlertAudioMetadata,
  DataRevisions,
  FocusRecord,
  FocusPlanState,
  TimerPreferences,
  TimerSnapshot,
  SyncDomain,
  SyncSnapshot,
  TimerSyncSnapshot,
} from "./contracts";
import { invokeRevisioned } from "./revisioned-command";

export const dataRevisionsChangedEvent = "data-revisions-changed";
export const timerSyncSampleEvent = "timer-sync-sample";

export async function getTimerSnapshot() {
  return invoke<TimerSnapshot>("get_timer_snapshot");
}

export async function getDataRevisions() {
  return invoke<DataRevisions>("get_data_revisions");
}

export async function getSyncSnapshot(domains: SyncDomain[], includeAnalytics = false) {
  return invoke<SyncSnapshot>("get_sync_snapshot", { domains, includeAnalytics });
}

export async function getTimerSyncSnapshot() {
  return invoke<TimerSyncSnapshot>("get_timer_sync_snapshot");
}

export async function getCustomAlertAudio() {
  return invoke<CustomAlertAudio>("get_custom_alert_audio");
}

export async function acknowledgeTimerAlert() {
  return invokeRevisioned<TimerSnapshot>("acknowledge_timer_alert");
}

export async function getTimerPreferences() {
  return invoke<TimerPreferences>("get_timer_preferences");
}

export async function getAppPreferences() {
  return invoke<AppPreferencesView>("get_app_preferences");
}

export async function updateAppPreferences(preferences: AppPreferencesPatch) {
  return invokeRevisioned<AppPreferencesView>("update_app_preferences", { preferences });
}

export async function updateCustomAlertAudio(name: string, data: string | null) {
  return invokeRevisioned<CustomAlertAudioMetadata>("update_custom_alert_audio", { name, data });
}

export async function getFocusPlan() {
  return invoke<FocusPlanState>("get_focus_plan");
}

export async function updateFocusPlan(plan: FocusPlanState) {
  return invokeRevisioned<FocusPlanState>("update_focus_plan", {
    currentTodoId: plan.currentTodoId,
    todayPickIds: plan.todayPickIds,
  });
}

export async function updateTimerPreferences(preferences: TimerPreferences) {
  return invokeRevisioned<TimerPreferences>("update_timer_preferences", { preferences });
}

export async function startTimer() {
  return invokeRevisioned<TimerSnapshot>("start_timer");
}

export async function pauseTimer() {
  return invokeRevisioned<TimerSnapshot>("pause_timer");
}

export async function resetTimer(sessionId: string) {
  return invokeRevisioned<TimerSnapshot>("reset_timer", { sessionId });
}

export async function switchTimerMode(
  mode: "stopwatch" | "countdown" | "pomodoro"
) {
  return invokeRevisioned<TimerSnapshot>("switch_timer_mode", { mode });
}

export async function setCountdownMinutes(minutes: number) {
  return invokeRevisioned<TimerSnapshot>("set_countdown_minutes", { minutes });
}

export async function updateTimerContext(
  title: string,
  linkedTodoId: number | null,
  completeLinkedTodoOnFinish: boolean
) {
  return invokeRevisioned<TimerSnapshot>("update_timer_context", {
    title,
    linkedTodoId,
    completeLinkedTodoOnFinish,
  });
}

export async function getFocusRecords() {
  return invoke<FocusRecord[]>("get_focus_records");
}

export async function updateFocusRecordTitle(id: number, title: string) {
  return invokeRevisioned<FocusRecord[]>("update_focus_record_title", { id, title });
}

export async function createManualFocusRecord(payload: {
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
}) {
  return invokeRevisioned<FocusRecord[]>("create_manual_focus_record", {
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
  return invokeRevisioned<FocusRecord[]>("update_focus_record", {
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
  return invokeRevisioned<FocusRecord[]>("delete_focus_record", { id });
}

export async function restoreFocusRecord(record: FocusRecord) {
  return invokeRevisioned<FocusRecord[]>("restore_focus_record", { record });
}

export async function deleteFocusRecords(ids: number[]) {
  return invokeRevisioned<FocusRecord[]>("delete_focus_records", { ids });
}

export async function listAppBackups() {
  return invoke<BackupListItem[]>("list_app_backups");
}

export async function exportAppBackup() {
  return invoke<BackupExportResult>("export_app_backup");
}

export async function importAppBackup(fileName: string) {
  return invokeRevisioned<BackupImportResult>("import_app_backup", { fileName });
}

export async function previewAppBackupPath(path: string) {
  return invoke<BackupPreview>("preview_app_backup_path", { path });
}

export async function exportAppBackupToPath(path: string) {
  return invoke<BackupExportResult>("export_app_backup_to_path", { path });
}

export async function exportRecoveryMaterial(path: string, blockedReason: string) {
  return invoke<string>("export_recovery_material", { path, blockedReason });
}

export async function importAppBackupPath(path: string, options: BackupImportOptions) {
  return invokeRevisioned<BackupImportResult>("import_app_backup_path", {
    path,
    restoreAppPreferences: options.restoreAppPreferences,
  });
}

export async function clearAppData() {
  return invokeRevisioned<void>("clear_app_data");
}

export async function completeFocusSession(
  title: string
) {
  return invokeRevisioned<CompletionPayload>("complete_focus_session", {
    title,
  });
}

export async function openAppBackupFolder() {
  return invoke("open_app_backup_folder");
}
