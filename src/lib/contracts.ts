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
}

export interface CompletionPayload {
  timerSnapshot: TimerSnapshot;
  records: FocusRecord[];
}
