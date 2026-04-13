import { invoke } from "@tauri-apps/api/core";
import type {
  AnalyticsSnapshot,
  CompletionPayload,
  ContentPackSnapshot,
  FocusRecord,
  RewardSnapshot,
  TimerSnapshot,
} from "./contracts";

export async function getTimerSnapshot() {
  return invoke<TimerSnapshot>("get_timer_snapshot");
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

export async function getFocusRecords() {
  return invoke<FocusRecord[]>("get_focus_records");
}

export async function getAnalyticsSnapshot() {
  return invoke<AnalyticsSnapshot>("get_analytics_snapshot");
}

export async function getRewardSnapshot() {
  return invoke<RewardSnapshot>("get_reward_snapshot");
}

export async function getContentPackSnapshot() {
  return invoke<ContentPackSnapshot>("get_content_pack_snapshot");
}

export async function syncContentPack() {
  return invoke<ContentPackSnapshot>("sync_content_pack");
}

export async function deleteFocusRecord(id: number) {
  return invoke<FocusRecord[]>("delete_focus_record", { id });
}

export async function deleteFocusRecords(ids: number[]) {
  return invoke<FocusRecord[]>("delete_focus_records", { ids });
}

export async function exportFocusRecordsCsv(ids: number[]) {
  return invoke<string>("export_focus_records_csv", { ids });
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
