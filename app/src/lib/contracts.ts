export interface ShellPanel {
  id: string;
  title: string;
  phase: string;
  status: string;
  summary: string;
}

export interface ShellSnapshot {
  productName: string;
  version: string;
  milestone: string;
  slogan: string;
  surfaces: ShellPanel[];
  reservedExtensions: ShellPanel[];
}

export interface TimerSnapshot {
  modeKey: "stopwatch" | "countdown" | "pomodoro";
  phaseKey: "stopwatch" | "countdown" | "focus" | "break";
  mode: string;
  phaseLabel: string;
  status: string;
  isRunning: boolean;
  elapsedMs: number;
  elapsedLabel: string;
  targetDurationMs: number | null;
  remainingMs: number | null;
  secondaryLabel: string;
  canCompleteSession: boolean;
  hasUnsubmittedProgress: boolean;
  activeTaskTitle: string;
  linkedTodoId: number | null;
  completeLinkedTodoOnFinish: boolean;
  currentRound: number;
  completedFocusCount: number;
  completedBreakCount: number;
  recoveredFromLastSession: boolean;
  modeSwitchLocked: boolean;
  modeSwitchHint: string | null;
  alertSequence: number;
  alertKey: string | null;
  alertTitle: string | null;
  alertMessage: string | null;
}

export interface TimerPreferences {
  pomodoroFocusMinutes: number;
  pomodoroBreakMinutes: number;
  stopwatchReminderMinutes: number | null;
  toastReminderEnabled: boolean;
  windowAttentionReminderEnabled: boolean;
  soundReminderEnabled: boolean;
  alertSoundKey: AlertSoundKey;
}

export type AlertSoundKey = "soft_chime" | "bright_bell" | "deep_pulse" | "wooden_tick" | "glass_ping" | "morning_chord" | "viral_quote" | "custom";

export interface AppPreferences {
  schemaVersion: number;
  themeId: ThemeId;
  visualIntensity: number;
  motionIntensity: number;
  density: "roomy" | "compact";
  floatingOpacity: number;
  autoMiniOnStart: boolean;
  customAlertSoundName: string;
  customAlertSoundData: string | null;
}

export interface AppPreferencesView extends Omit<AppPreferences, "customAlertSoundData"> {
  hasCustomAlertSound: boolean;
}

export interface FocusPlanState {
  currentTodoId: number | null;
  todayPickIds: number[];
}

export interface FocusRecord {
  id: number;
  title: string;
  durationMs: number;
  durationLabel: string;
  modeKey: "stopwatch" | "countdown" | "pomodoro";
  modeLabel: string;
  phaseLabel: string;
  linkedTodoId: number | null;
  linkedTodoTitle: string | null;
  completedAt: string;
  completedDate: string;
  completedTime: string;
  source: "timer" | "manual";
  timeBasis: "completion_day" | "exact_interval";
  editedAt: string | null;
}

export interface CompletionPayload {
  timerSnapshot: TimerSnapshot;
  records: FocusRecord[];
  todoItems: TodoItem[];
}

export interface BackupListItem {
  fileName: string;
  exportedAt: string;
  appVersion: string;
  formatVersion: number;
  schemaVersion: number;
  migrationNeeded: boolean;
  focusRecordCount: number;
  todoCount: number;
  hasRuntimeSession: boolean;
}

export interface BackupExportResult {
  fileName: string;
  filePath: string;
  exportedAt: string;
}

export interface BackupImportResult {
  importedFileName: string;
  rollbackFileName: string;
  focusRecordCount: number;
  todoCount: number;
  restoredRuntimeSession: boolean;
  migratedFromFormatVersion: number | null;
  restoredAppPreferences: boolean;
}

export interface BackupPreview {
  sourcePath: string;
  appVersion: string;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  focusRecordCount: number;
  todoCount: number;
  hasRuntimeSession: boolean;
  hasAppPreferences: boolean;
  hasCustomAlertSound: boolean;
  migrationNeeded: boolean;
  warnings: string[];
}

export interface BackupImportOptions {
  restoreTodos: boolean;
  restoreRecords: boolean;
  restoreAppPreferences: boolean;
}

export interface DailyInsight {
  date: string;
  totalDurationMs: number;
  totalDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
}

export type FeedbackKind = "success" | "error" | "info";

export interface AnalyticsSnapshot {
  totalFocusDurationMs: number;
  totalFocusDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
  pendingTodoCount: number;
  completedTodoCount: number;
  activeDays: number;
  averageDailyDurationLabel: string;
  todayFocusDurationLabel: string;
  todaySessionCount: number;
  currentStreakDays: number;
  bestFocusDate: string | null;
  bestFocusDurationLabel: string | null;
  dailyBreakdown: DailyInsight[];
}

export type TodoImportance = "low" | "medium" | "high";

export interface TodoItem {
  id: number;
  title: string;
  isCompleted: boolean;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
  continuationNote: string;
  continuationUpdatedAt: string | null;
}

export interface TodoDraft {
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}
import type { ThemeId } from "./themes";
