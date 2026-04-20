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
  modeKey: "stopwatch" | "pomodoro";
  phaseKey: "stopwatch" | "focus" | "break";
  mode: string;
  phaseLabel: string;
  status: string;
  isRunning: boolean;
  elapsedMs: number;
  elapsedLabel: string;
  secondaryLabel: string;
  canCompleteSession: boolean;
  activeTaskTitle: string;
  linkedTodoId: number | null;
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
}

export interface FocusRecord {
  id: number;
  title: string;
  durationMs: number;
  durationLabel: string;
  modeKey: "stopwatch" | "pomodoro";
  modeLabel: string;
  phaseLabel: string;
  linkedTodoId: number | null;
  linkedTodoTitle: string | null;
  completedAt: string;
  completedDate: string;
  completedTime: string;
}

export interface CompletionPayload {
  timerSnapshot: TimerSnapshot;
  records: FocusRecord[];
}

export interface BackupListItem {
  fileName: string;
  exportedAt: string;
  appVersion: string;
  formatVersion: number;
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
}

export interface DailyInsight {
  date: string;
  totalDurationMs: number;
  totalDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
}

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
}

export interface TodoDraft {
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}
