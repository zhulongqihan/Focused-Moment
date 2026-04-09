import { invoke } from "@tauri-apps/api/core";
import type {
  CompletionPayload,
  FocusRecord,
  TimerSnapshot,
} from "./contracts";

export async function getTimerSnapshot() {
  return invoke<TimerSnapshot>("get_timer_snapshot");
}

export async function startStopwatch() {
  return invoke<TimerSnapshot>("start_stopwatch");
}

export async function pauseStopwatch() {
  return invoke<TimerSnapshot>("pause_stopwatch");
}

export async function resetStopwatch() {
  return invoke<TimerSnapshot>("reset_stopwatch");
}

export async function getFocusRecords() {
  return invoke<FocusRecord[]>("get_focus_records");
}

export async function completeStopwatchSession(title: string) {
  return invoke<CompletionPayload>("complete_stopwatch_session", { title });
}
