import { invoke } from "@tauri-apps/api/core";
import type {
  CompletionPayload,
  FocusRecord,
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

export async function completeStopwatchSession(title: string) {
  return invoke<CompletionPayload>("complete_stopwatch_session", { title });
}
