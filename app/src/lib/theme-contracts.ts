import type {
  AnalyticsSnapshot,
  BackupListItem,
  BackupPreview,
  DailyInsight,
  FocusRecord,
  TimerPreferences,
  TimerSnapshot,
  TodoImportance,
  TodoItem,
} from "./contracts";
import type { ThemeId } from "./themes";

/**
 * The visual layer consumes Solid accessors so the shell can keep ownership of
 * state, effects, and IPC without forcing each theme to know about the shell.
 */
export type Accessor<T> = () => T;

export interface TodaySurfaceProps {
  todayDate: string;
  todayLabel: string;
  timer: Accessor<TimerSnapshot>;
  ready: Accessor<boolean>;
  busy: Accessor<boolean>;
  timerHasProgress: Accessor<boolean>;
  timerCanContinue: Accessor<boolean>;
  nextTodo: Accessor<TodoItem | null>;
  currentTodo: Accessor<TodoItem | null>;
  todayPickTodos: Accessor<TodoItem[]>;
  todayPickIds: Accessor<number[]>;
  planTodos: Accessor<TodoItem[]>;
  todayTodos: Accessor<TodoItem[]>;
  todayCompletedTodos: Accessor<TodoItem[]>;
  records: Accessor<FocusRecord[]>;
  analytics: Accessor<AnalyticsSnapshot | null>;
  defaultFocusMinutes: Accessor<number>;
  formatTodoDue: (item: TodoItem) => string;
  importanceLabel: (value: TodoImportance) => string;
  onPause: () => void;
  onContinue: () => void;
  onFinish: () => void | Promise<void>;
  onStartNext: () => void;
  onSetCurrentTodo: (id: number | null) => void | Promise<void>;
  onToggleTodayPick: (id: number) => void | Promise<void>;
  onStartTodo: (item: TodoItem) => void | Promise<void>;
  onQuickCapture: () => void;
  onOpenFocus: () => void;
  onOpenRecords: () => void;
  onUseTodo: (item: TodoItem) => void;
  onOpenTodos: () => void;
}

export interface FocusSurfaceProps {
  timer: Accessor<TimerSnapshot>;
  currentStreakDays: Accessor<number>;
  todaySessionCount: Accessor<number>;
  timerPreferences: Accessor<TimerPreferences>;
  todos: Accessor<TodoItem[]>;
  records: Accessor<FocusRecord[]>;
  pendingTodos: Accessor<TodoItem[]>;
  formatTodoDue: (item: TodoItem) => string;
  ready: Accessor<boolean>;
  busy: Accessor<boolean>;
  timerHasProgress: Accessor<boolean>;
  timerCanContinue: Accessor<boolean>;
  canFinish: Accessor<boolean>;
  savedConfirmation: Accessor<boolean>;
  sessionTitle: Accessor<string>;
  linkedTodoId: Accessor<number | null>;
  completeLinkedTodo: Accessor<boolean>;
  countdownMinutes: Accessor<number>;
  countdownDraftDirty: Accessor<boolean>;
  busyLabel: Accessor<string>;
  onSessionTitleChange: (value: string) => void;
  onSessionTitleDirty: () => void;
  onLinkedTodoChange: (value: number | null) => void;
  onCompleteLinkedTodoChange: (value: boolean) => void;
  onCountdownMinutesChange: (value: number) => void;
  onCountdownDraftDirty: () => void;
  onChangeMode: (mode: "stopwatch" | "countdown") => void | Promise<void>;
  onStart: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onShowFocusFloating: () => void | Promise<void>;
  onOpenRecords: () => void;
}

export interface TodoEditState {
  id: number;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}

export interface TodoSurfaceProps {
  todos: Accessor<TodoItem[]>;
  records: Accessor<FocusRecord[]>;
  activeTodos: Accessor<TodoItem[]>;
  overdueTodos: Accessor<TodoItem[]>;
  completedTodos: Accessor<TodoItem[]>;
  todayTodos: Accessor<TodoItem[]>;
  todayCompletedTodos: Accessor<TodoItem[]>;
  timer: Accessor<TimerSnapshot>;
  timerHasProgress: Accessor<boolean>;
  ready: Accessor<boolean>;
  busy: Accessor<boolean>;
  busyLabel: Accessor<string>;
  todoTitle: Accessor<string>;
  todoDueDate: Accessor<string>;
  todoDueTime: Accessor<string>;
  todoImportance: Accessor<TodoImportance>;
  editingTodo: Accessor<TodoEditState | null>;
  onTodoTitleChange: (value: string) => void;
  onTodoDueDateChange: (value: string) => void;
  onTodoDueTimeChange: (value: string) => void;
  onTodoImportanceChange: (value: TodoImportance) => void;
  onAddTodo: () => void | Promise<void>;
  onToggle: (id: number) => void;
  onBeginEdit: (item: TodoItem) => void;
  onUseForFocus: (item: TodoItem) => void;
  onRemove: (id: number) => void;
  onPatch: (patch: Partial<TodoEditState>) => void;
  onSave: () => void;
  onCancel: () => void;
  formatTodoDue: (item: TodoItem) => string;
  importanceLabel: (value: TodoImportance) => string;
}

export interface ArchiveDayShape extends DailyInsight {}

export interface RecordGroupShape {
  date: string;
  records: FocusRecord[];
  totalDurationMs: number;
}

export interface RecordsSurfaceProps {
  analytics: Accessor<AnalyticsSnapshot | null>;
  records: Accessor<FocusRecord[]>;
  archiveDays: Accessor<ArchiveDayShape[]>;
  extendedArchiveDays: Accessor<ArchiveDayShape[]>;
  archivePath: Accessor<string>;
  selectedArchiveDate: Accessor<string>;
  selectedArchiveDay: Accessor<ArchiveDayShape | null>;
  selectedArchiveRecords: Accessor<FocusRecord[]>;
  recordGroups: Accessor<RecordGroupShape[]>;
  ready: Accessor<boolean>;
  busy: Accessor<boolean>;
  editingRecord: Accessor<{ id: number; title: string } | null>;
  todoCompletionPercent: Accessor<number>;
  recentWeekActiveDays: Accessor<number>;
  recentWeekDurationMs: Accessor<number>;
  formatAnalyticsDate: (value: string) => string;
  formatArchiveRangeDate: (value: string) => string;
  formatRecordDate: (record: FocusRecord) => string;
  formatRecordDay: (value: string) => string;
  formatDurationMs: (value: number) => string;
  onSelectDate: (value: string) => void;
  onBeginEdit: (record: FocusRecord) => void;
  onBeginDetailedEdit?: (record: FocusRecord) => void;
  onPatchEdit: (value: string) => void;
  onSaveEdit: () => void | Promise<void>;
  onCancelEdit: () => void;
  onRemove: (id: number) => void | Promise<void>;
  onCreateManualRecord?: () => void | Promise<void>;
}

export interface SettingsSurfaceProps {
  timerPreferences: Accessor<TimerPreferences>;
  busy: Accessor<boolean>;
  busyLabel: Accessor<string>;
  customAlertSoundName: Accessor<string>;
  backups: Accessor<BackupListItem[]>;
  backupLoadState: Accessor<"loading" | "ready" | "error">;
  backupLoadError: Accessor<string>;
  selectedBackupFile: Accessor<string>;
  selectedBackup: Accessor<BackupListItem | null>;
  lastBackupPath: Accessor<string>;
  themeId: Accessor<ThemeId>;
  visualIntensity: Accessor<number>;
  motionIntensity: Accessor<number>;
  density: Accessor<"roomy" | "compact">;
  autoMiniOnStart: Accessor<boolean>;
  appPreferenceSaveError: Accessor<string>;
  appPreferenceSaveBusy: Accessor<boolean>;
  portableBackupPath: Accessor<string>;
  portableBackupPreview: Accessor<BackupPreview | null>;
  restorePortableAppPreferences: Accessor<boolean>;
  onThemeSelect: (value: ThemeId) => void;
  onVisualIntensityChange: (value: number) => void;
  onMotionIntensityChange: (value: number) => void;
  onDensityChange: (value: "roomy" | "compact") => void;
  onAutoMiniOnStartChange: (value: boolean) => void;
  onRetryAppPreferenceSave: () => void;
  onPortableBackupPathChange: (value: string) => void;
  onPreviewPortableBackup: () => void | Promise<void>;
  onExportPortableBackup: () => void | Promise<void>;
  onImportPortableBackup: () => void | Promise<void>;
  onRestorePortableAppPreferencesChange: (value: boolean) => void;
  /** Compatibility action for the original theme settings; flushes native autosave. */
  onSaveVisualSettings: () => void;
  onSaveTimerPreferences: (patch: Partial<TimerPreferences>) => void | Promise<void>;
  onPreviewAlertSound: () => void;
  onChooseCustomAlertSound: (event: Event) => void | Promise<void>;
  onClearCustomAlertSound: () => void | Promise<void>;
  onSelectedBackupFile: (value: string) => void;
  onLoadBackups: () => void | Promise<void>;
  onCreateBackup: () => void | Promise<void>;
  onOpenBackupFolder: () => void | Promise<void>;
  onRestoreBackup: () => void | Promise<void>;
  onClearAllData: () => void | Promise<void>;
}
