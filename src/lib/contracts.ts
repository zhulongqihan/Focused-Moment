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
}

export interface CompletionPayload {
  timerSnapshot: TimerSnapshot;
  records: FocusRecord[];
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
