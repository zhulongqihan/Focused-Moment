import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import type {
  AppPreferences,
  AppPreferencesView,
  AnalyticsSnapshot,
  AlertSoundKey,
  BackupListItem,
  BackupPreview,
  FeedbackKind,
  FocusRecord,
  FocusPlanState,
  TodoDraft,
  TodoImportance,
  TimerSnapshot,
  TimerPreferences,
  TodoItem,
} from "../../lib/contracts";
import {
  acknowledgeTimerAlert,
  clearAppData,
  completeFocusSession,
  createManualFocusRecord,
  deleteFocusRecord,
  exportAppBackup,
  getAnalyticsSnapshot,
  getAppPreferences,
  getFocusPlan,
  getFocusRecords,
  getTimerPreferences,
  getTimerSnapshot,
  importAppBackup,
  listAppBackups,
  openAppBackupFolder,
  pauseTimer,
  previewAppBackupPath,
  exportAppBackupToPath,
  importAppBackupPath,
  resetTimer,
  restoreFocusRecord,
  setCountdownMinutes as configureCountdownMinutes,
  startTimer,
  switchTimerMode,
  updateTimerPreferences,
  updateFocusRecord,
  updateAppPreferences,
  updateFocusPlan,
  updateTimerContext,
} from "../../lib/timer";
import {
  createTodoItem,
  deleteTodoItem,
  getTodoItems,
  updateTodoItem,
  restoreTodoItem,
  toggleTodoItem,
  updateTodoContinuationNote,
} from "../../lib/tasks";
import {
  flashMainWindowAttention,
  restoreMainFromFloatingTodos,
  restoreMainFromFocusFloating,
  showFocusFloating,
  showFloatingTodos,
} from "../../lib/window-controls";
import {
  getToday,
  isOverdue,
} from "../shared/date-utils";
import { createArchivePath, getRecentTrendDays, groupRecordsByDate, mergeArchiveDays, recordDateKey } from "../records/derived";
import { buildFocusHistoryResults } from "../records/focus-history";
import { sortTodos } from "../todos/derived";
import type { PaletteCommand } from "../../components/CommandPalette";
import { getTheme, implementedThemeId, normalizeThemeId, type ThemeId } from "../../lib/themes";

type AppView = "today" | "focus" | "todos" | "records" | "settings";
type TimerMode = "stopwatch" | "countdown";
type LoadState = "loading" | "ready" | "error";
type FloatingTab = "todos" | "timer";
type MotionIntensityMode = "off" | "subtle" | "full";
type UndoAction =
  | { kind: "todo"; item: TodoItem }
  | { kind: "record"; item: FocusRecord };

type TodoEditDraft = TodoDraft & { id: number };
type RecordEditDraft = {
  id: number;
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
};
type ContinuationPrompt = { todoId: number; title: string };
type AppStateSyncPayload = {
  timer: TimerSnapshot;
  todos: TodoItem[];
  records: FocusRecord[];
  analytics: AnalyticsSnapshot;
  timerPreferences: TimerPreferences;
  appPreferencesView: AppPreferencesView;
  focusPlan: FocusPlanState;
};

function getWindowLabel() {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

export const currentWindowLabel = getWindowLabel();
export const isFloatingWindow = currentWindowLabel === "todo-float";
export const isUnlockWindow = currentWindowLabel === "todo-unlock";
export const isFocusFloatingWindow = currentWindowLabel === "focus-float";
export const isFocusUnlockWindow = currentWindowLabel === "focus-unlock";

const emptyTimerSnapshot: TimerSnapshot = {
  modeKey: "stopwatch",
  phaseKey: "stopwatch",
  mode: "正向计时",
  phaseLabel: "正向计时",
  status: "待开始",
  isRunning: false,
  elapsedMs: 0,
  elapsedLabel: "00:00:00",
  targetDurationMs: null,
  remainingMs: null,
  secondaryLabel: "已累计时长",
  canCompleteSession: true,
  hasUnsubmittedProgress: false,
  activeTaskTitle: "",
  linkedTodoId: null,
  completeLinkedTodoOnFinish: false,
  currentRound: 1,
  completedFocusCount: 0,
  completedBreakCount: 0,
  recoveredFromLastSession: false,
  modeSwitchLocked: false,
  modeSwitchHint: null,
  alertSequence: 0,
  alertKey: null,
  alertTitle: null,
  alertMessage: null,
};

const defaultTimerPreferences: TimerPreferences = {
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
  stopwatchReminderMinutes: 25,
  toastReminderEnabled: true,
  windowAttentionReminderEnabled: true,
  soundReminderEnabled: true,
  alertSoundKey: "soft_chime",
};

const customAlertSoundDataKey = "focused-moment.custom-alert-sound.data";
const customAlertSoundNameKey = "focused-moment.custom-alert-sound.name";
const floatingOpacityKey = "focused-moment.floating-window.opacity";
export const defaultFloatingOpacity = 100;
export const minFloatingOpacity = 45;
const alertClaimKeyPrefix = "focused-moment.alert-claimed.";
const maxCustomAlertSoundBytes = 5 * 1024 * 1024;
const floatingWorkspaceSyncEvent = "floating-workspace-sync";
const appStateSyncEvent = "app-state-sync";
const trayNavigateEvent = "tray-navigate";
const themeStorageKey = "focused-moment.theme";
const visualIntensityKey = "focused-moment.visual-intensity";
const motionIntensityKey = "focused-moment.motion-intensity";
const densityKey = "focused-moment.density";

type SynthAlertSoundKey = Exclude<AlertSoundKey, "custom" | "viral_quote">;

const synthAlertSoundProfiles: Record<SynthAlertSoundKey, { frequencies: number[]; oscillator: OscillatorType; spacing: number; peak: number; release: number }> = {
  soft_chime: { frequencies: [660, 880], oscillator: "triangle", spacing: 0.13, peak: 0.18, release: 0.36 },
  bright_bell: { frequencies: [880, 1174, 1568], oscillator: "triangle", spacing: 0.13, peak: 0.18, release: 0.36 },
  deep_pulse: { frequencies: [220, 330], oscillator: "sine", spacing: 0.16, peak: 0.2, release: 0.42 },
  wooden_tick: { frequencies: [294], oscillator: "square", spacing: 0, peak: 0.13, release: 0.16 },
  glass_ping: { frequencies: [1047, 1568, 2093], oscillator: "sine", spacing: 0.1, peak: 0.14, release: 0.52 },
  morning_chord: { frequencies: [523, 659, 784], oscillator: "triangle", spacing: 0.08, peak: 0.13, release: 0.48 },
};

function readLocalStorageValue(key: string) {
  return readStoredLocalStorageValue(key) ?? "";
}

function isAppView(value: unknown): value is AppView {
  return value === "today" || value === "focus" || value === "todos" || value === "records" || value === "settings";
}

function readStoredLocalStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeLocalStorageValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in a restricted webview; the feature still works for this run.
  }
}

function writeLocalStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return window.localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function readFloatingOpacity() {
  const storedValue = Number(readLocalStorageValue(floatingOpacityKey));
  if (!Number.isFinite(storedValue)) {
    return defaultFloatingOpacity;
  }
  return Math.min(defaultFloatingOpacity, Math.max(minFloatingOpacity, Math.round(storedValue)));
}

function readPercentage(key: string, fallback: number) {
  const rawValue = readLocalStorageValue(key).trim();
  if (!rawValue) {
    return fallback;
  }
  const storedValue = Number(rawValue);
  return Number.isFinite(storedValue) ? Math.min(100, Math.max(0, Math.round(storedValue))) : fallback;
}

function readThemeId(): ThemeId {
  const theme = getTheme(normalizeThemeId(readLocalStorageValue(themeStorageKey)));
  return theme.implemented ? theme.id : implementedThemeId;
}

function readDensity(): "roomy" | "compact" {
  return readLocalStorageValue(densityKey) === "compact" ? "compact" : "roomy";
}

export function getMotionIntensityMode(value: number): MotionIntensityMode {
  if (value <= 0) {
    return "off";
  }
  return value < 50 ? "subtle" : "full";
}

function claimAlertSequence(sequence: number) {
  const key = `${alertClaimKeyPrefix}${sequence}`;
  if (readLocalStorageValue(key) === "claimed") {
    return false;
  }
  const stored = writeLocalStorageValue(key, "claimed");
  return stored || readLocalStorageValue(key) !== "claimed";
}

function playAlertSound(soundKey: AlertSoundKey, customSoundData: string | null = null) {
  if (soundKey === "custom") {
    const dataUrl = customSoundData || readLocalStorageValue(customAlertSoundDataKey);
    if (dataUrl) {
      const audio = new Audio(dataUrl);
      audio.volume = 0.85;
      void audio.play().catch(() => undefined);
      return;
    }
  }

  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  const now = context.currentTime;
  const profile = synthAlertSoundProfiles[soundKey as SynthAlertSoundKey] ?? synthAlertSoundProfiles.soft_chime;
  profile.frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * profile.spacing;
    oscillator.type = profile.oscillator;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(profile.peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.release);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + profile.release + 0.02);
  });
  window.setTimeout(() => void context.close(), Math.ceil((profile.release + profile.spacing * profile.frequencies.length + 0.2) * 1000));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "操作未完成，请重试。";
}

export function useMainShellController() {
  const [activeView, setActiveView] = createSignal<AppView>("today");
  const [timer, setTimer] = createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [savedConfirmation, setSavedConfirmation] = createSignal(false);
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [analytics, setAnalytics] = createSignal<AnalyticsSnapshot | null>(null);
  const [sessionTitle, setSessionTitle] = createSignal("");
  const [sessionTitleDirty, setSessionTitleDirty] = createSignal(false);
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);
  const [completeLinkedTodo, setCompleteLinkedTodo] = createSignal(false);
  const [countdownMinutes, setCountdownMinutes] = createSignal(25);
  const [countdownDraftDirty, setCountdownDraftDirty] = createSignal(false);
  const [timerPreferences, setTimerPreferences] = createSignal<TimerPreferences>(defaultTimerPreferences);
  const [customAlertSoundName, setCustomAlertSoundName] = createSignal("");
  const [customAlertSoundData, setCustomAlertSoundData] = createSignal<string | null>(null);
  const [autoMiniOnStart, setAutoMiniOnStart] = createSignal(false);
  const [appPreferenceSaveError, setAppPreferenceSaveError] = createSignal("");
  const [appPreferenceSaveBusy, setAppPreferenceSaveBusy] = createSignal(false);
  const [failedAppPreferenceSnapshot, setFailedAppPreferenceSnapshot] = createSignal<AppPreferences | null>(null);
  const [focusPlan, setFocusPlan] = createSignal<FocusPlanState>({ currentTodoId: null, todayPickIds: [] });
  const [continuationPrompt, setContinuationPrompt] = createSignal<ContinuationPrompt | null>(null);
  const [continuationSaveError, setContinuationSaveError] = createSignal("");
  const [quickCaptureOpen, setQuickCaptureOpen] = createSignal(false);
  const [quickCaptureTitle, setQuickCaptureTitle] = createSignal("");
  const [manualRecordOpen, setManualRecordOpen] = createSignal(false);
  const [todoTitle, setTodoTitle] = createSignal("");
  const [todoDueDate, setTodoDueDate] = createSignal(getToday());
  const [todoDueTime, setTodoDueTime] = createSignal("");
  const [todoImportance, setTodoImportance] = createSignal<TodoImportance>("medium");
  const [editingTodo, setEditingTodo] = createSignal<TodoEditDraft | null>(null);
  const [editingRecord, setEditingRecord] = createSignal<RecordEditDraft | null>(null);
  const [recordEditDialogOpen, setRecordEditDialogOpen] = createSignal(false);
  const [backups, setBackups] = createSignal<BackupListItem[]>([]);
  const [backupLoadState, setBackupLoadState] = createSignal<LoadState>("loading");
  const [backupLoadError, setBackupLoadError] = createSignal("");
  const [selectedBackupFile, setSelectedBackupFile] = createSignal("");
  const [lastBackupPath, setLastBackupPath] = createSignal("");
  const [portableBackupPath, setPortableBackupPath] = createSignal("");
  const [portableBackupPreview, setPortableBackupPreview] = createSignal<BackupPreview | null>(null);
  const [restorePortableAppPreferences, setRestorePortableAppPreferences] = createSignal(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [commandSearch, setCommandSearch] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [busyLabel, setBusyLabel] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [messageKind, setMessageKind] = createSignal<FeedbackKind>("info");
  const [loadState, setLoadState] = createSignal<LoadState>("loading");
  const [loadError, setLoadError] = createSignal("");
  const [syncError, setSyncError] = createSignal("");
  const [undoAction, setUndoAction] = createSignal<UndoAction | null>(null);
  const [floatingTab, setFloatingTab] = createSignal<FloatingTab>("todos");
  const [floatingOpacity, setFloatingOpacity] = createSignal(readFloatingOpacity());
  const [floatingOpacityPanelOpen, setFloatingOpacityPanelOpen] = createSignal(false);
  const [selectedArchiveDate, setSelectedArchiveDate] = createSignal(getToday());
  const [recordTaskFilterId, setRecordTaskFilterId] = createSignal<number | null>(null);
  const [themeId, setThemeId] = createSignal<ThemeId>(readThemeId());
  const [visualIntensity, setVisualIntensity] = createSignal(readPercentage(visualIntensityKey, 72));
  const [motionIntensity, setMotionIntensity] = createSignal(readPercentage(motionIntensityKey, 44));
  const [density, setDensity] = createSignal<"roomy" | "compact">(readDensity());
  let undoTimer: number | undefined;
  let messageTimer: number | undefined;
  let appPreferenceSaveVersion = 0;
  let appPreferenceSaveTimer: number | undefined;
  let pendingAppPreferenceSnapshot: AppPreferences | null = null;
  let legacyPreferencesMigrationAttempted = false;
  let commandInput: HTMLInputElement | undefined;
  let commandTrigger: HTMLButtonElement | undefined;
  let refreshVersion = 0;
  let timerRefreshVersion = 0;
  let observedAlertSequence: number | null = null;
  let floatingTimerWasAvailable = false;
  let floatingWorkspaceElement: HTMLElement | undefined;
  let floatingResizeFrame: number | undefined;

  const ready = () => loadState() === "ready";

  function currentAppPreferences(): AppPreferences {
    return {
      schemaVersion: 3,
      themeId: themeId(),
      visualIntensity: visualIntensity(),
      motionIntensity: motionIntensity(),
      density: density(),
      floatingOpacity: floatingOpacity(),
      autoMiniOnStart: autoMiniOnStart(),
      customAlertSoundName: customAlertSoundName(),
      customAlertSoundData: customAlertSoundData(),
    };
  }

  function currentAppPreferencesView(): AppPreferencesView {
    const preferences = currentAppPreferences();
    return {
      schemaVersion: preferences.schemaVersion,
      themeId: preferences.themeId,
      visualIntensity: preferences.visualIntensity,
      motionIntensity: preferences.motionIntensity,
      density: preferences.density,
      floatingOpacity: preferences.floatingOpacity,
      autoMiniOnStart: preferences.autoMiniOnStart,
      customAlertSoundName: preferences.customAlertSoundName,
      hasCustomAlertSound: Boolean(preferences.customAlertSoundData),
    };
  }

  async function emitAppStateSync() {
    const currentAnalytics = analytics();
    if (!currentAnalytics) return;
    try {
      await emit(appStateSyncEvent, {
        timer: timer(),
        todos: todos(),
        records: records(),
        analytics: currentAnalytics,
        timerPreferences: timerPreferences(),
        appPreferencesView: currentAppPreferencesView(),
        focusPlan: focusPlan(),
      } satisfies AppStateSyncPayload);
    } catch {
      // State sync is an enhancement for sibling windows. The initiating
      // window already holds the committed state, so a failed broadcast must
      // never turn a successful business operation into a false error.
    }
  }

  function applyAppPreferences(next: AppPreferences) {
    setThemeId(normalizeThemeId(next.themeId));
    setVisualIntensity(next.visualIntensity);
    setMotionIntensity(next.motionIntensity);
    setDensity(next.density);
    setFloatingOpacity(next.floatingOpacity);
    setAutoMiniOnStart(next.autoMiniOnStart);
    setCustomAlertSoundName(next.customAlertSoundName);
    setCustomAlertSoundData(next.customAlertSoundData);
  }

  function persistAppPreferences(snapshot: AppPreferences, version: number) {
    setAppPreferenceSaveBusy(true);
    void updateAppPreferences(snapshot)
      .then((saved) => {
        if (version !== appPreferenceSaveVersion) return;
        applyAppPreferences(saved);
        setAppPreferenceSaveError("");
        setFailedAppPreferenceSnapshot(null);
        void emitAppStateSync();
      })
      .catch((error) => {
        if (version !== appPreferenceSaveVersion) return;
        setFailedAppPreferenceSnapshot(snapshot);
        setAppPreferenceSaveError(`外观设置保存失败：${getErrorMessage(error)}`);
      })
      .finally(() => {
        if (version === appPreferenceSaveVersion) {
          setAppPreferenceSaveBusy(false);
        }
      });
  }

  function scheduleAppPreferencesSave(patch: Partial<AppPreferences>) {
    const next = { ...currentAppPreferences(), ...patch, schemaVersion: 3 };
    applyAppPreferences(next);
    pendingAppPreferenceSnapshot = next;
    setAppPreferenceSaveError("");
    setFailedAppPreferenceSnapshot(null);
    appPreferenceSaveVersion += 1;
    const version = appPreferenceSaveVersion;
    if (appPreferenceSaveTimer !== undefined) {
      window.clearTimeout(appPreferenceSaveTimer);
    }
    appPreferenceSaveTimer = window.setTimeout(() => {
      appPreferenceSaveTimer = undefined;
      pendingAppPreferenceSnapshot = null;
      persistAppPreferences(next, version);
    }, 200);
  }

  function flushAppPreferencesSave() {
    if (appPreferenceSaveTimer === undefined || !pendingAppPreferenceSnapshot) {
      return;
    }
    window.clearTimeout(appPreferenceSaveTimer);
    appPreferenceSaveTimer = undefined;
    const snapshot = pendingAppPreferenceSnapshot;
    pendingAppPreferenceSnapshot = null;
    appPreferenceSaveVersion += 1;
    persistAppPreferences(snapshot, appPreferenceSaveVersion);
  }

  function retryAppPreferencesSave() {
    const snapshot = failedAppPreferenceSnapshot();
    if (snapshot) {
      scheduleAppPreferencesSave(snapshot);
    }
  }

  async function migrateLegacyAppPreferences(next: AppPreferences) {
    if (legacyPreferencesMigrationAttempted) {
      return next;
    }
    legacyPreferencesMigrationAttempted = true;
    const legacyValues = [
      readStoredLocalStorageValue(themeStorageKey),
      readStoredLocalStorageValue(visualIntensityKey),
      readStoredLocalStorageValue(motionIntensityKey),
      readStoredLocalStorageValue(densityKey),
      readStoredLocalStorageValue(floatingOpacityKey),
      readStoredLocalStorageValue(customAlertSoundDataKey),
      readStoredLocalStorageValue(customAlertSoundNameKey),
    ];
    if (!legacyValues.some((value) => value !== null)) {
      writeLocalStorageValue("focused-moment.preferences-v3-migrated", "1");
      return next;
    }

    const legacyTheme = getTheme(readStoredLocalStorageValue(themeStorageKey));
    const legacyVisual = readPercentage(visualIntensityKey, next.visualIntensity);
    const legacyMotion = readPercentage(motionIntensityKey, next.motionIntensity);
    const legacyDensity = readDensity();
    const legacyOpacity = readFloatingOpacity();
    const legacySoundData = readStoredLocalStorageValue(customAlertSoundDataKey);
    const legacySoundName = readLocalStorageValue(customAlertSoundNameKey);
    const migrated = {
      ...next,
      themeId: legacyTheme.implemented ? legacyTheme.id : next.themeId,
      visualIntensity: legacyVisual,
      motionIntensity: legacyMotion,
      density: legacyDensity,
      floatingOpacity: legacyOpacity,
      customAlertSoundData: legacySoundData || next.customAlertSoundData,
      customAlertSoundName: legacySoundData ? legacySoundName : next.customAlertSoundName,
    };
    applyAppPreferences(migrated);
    try {
      const saved = await updateAppPreferences(migrated);
      [themeStorageKey, visualIntensityKey, motionIntensityKey, densityKey, floatingOpacityKey, customAlertSoundDataKey, customAlertSoundNameKey]
        .forEach(removeLocalStorageValue);
      writeLocalStorageValue("focused-moment.preferences-v3-migrated", "1");
      return saved;
    } catch (error) {
      setFailedAppPreferenceSnapshot(migrated);
      setAppPreferenceSaveError(`旧版外观设置迁移失败：${getErrorMessage(error)}`);
      return migrated;
    }
  }

  const pendingTodos = () => sortTodos(todos()).filter((item) => !item.isCompleted);
  const activeTodos = () => pendingTodos().filter((item) => !isOverdue(item.scheduledDate));
  const overdueTodos = () => pendingTodos().filter((item) => isOverdue(item.scheduledDate));
  const completedTodos = () => sortTodos(todos()).filter((item) => item.isCompleted);
  const todayTodos = () => pendingTodos().filter((item) => item.scheduledDate === getToday());
  const todayCompletedTodos = () =>
    completedTodos().filter((item) => item.scheduledDate === getToday());
  const currentTodo = () => pendingTodos().find((item) => item.id === focusPlan().currentTodoId) ?? null;
  const todayPickTodos = () => focusPlan().todayPickIds
    .map((id) => pendingTodos().find((item) => item.id === id))
    .filter((item): item is TodoItem => Boolean(item));
  const nextTodo = () => currentTodo() ?? pendingTodos()[0] ?? null;
  const selectedBackup = () => backups().find((backup) => backup.fileName === selectedBackupFile()) ?? null;
  const recentBreakdown = createMemo(() => getRecentTrendDays(analytics()?.dailyBreakdown ?? []));
  const recordGroups = createMemo(() => groupRecordsByDate(records()));
  const archiveDays = createMemo(() => mergeArchiveDays(recentBreakdown(), records()));
  const extendedArchiveDays = createMemo(() =>
    mergeArchiveDays(getRecentTrendDays(analytics()?.dailyBreakdown ?? [], 30), records()),
  );
  const archivePath = createMemo(() => createArchivePath(archiveDays()));
  const selectedArchiveDay = createMemo(() =>
    extendedArchiveDays().find((day) => day.date === selectedArchiveDate())
      ?? extendedArchiveDays()[extendedArchiveDays().length - 1]
      ?? null,
  );
  const selectedArchiveRecords = createMemo(() => {
    const taskFilterId = recordTaskFilterId();
    if (taskFilterId !== null) {
      return records().filter((record) => record.linkedTodoId === taskFilterId);
    }
    const selectedDate = selectedArchiveDay()?.date;
    return selectedDate ? records().filter((record) => recordDateKey(record) === selectedDate) : [];
  });
  const recordTaskFilterTitle = createMemo(() => {
    const taskFilterId = recordTaskFilterId();
    if (taskFilterId === null) return "";
    return todos().find((item) => item.id === taskFilterId)?.title
      ?? records().find((record) => record.linkedTodoId === taskFilterId)?.linkedTodoTitle
      ?? "关联任务";
  });
  const recentWeekDurationMs = () =>
    archiveDays().reduce((total, day) => total + day.totalDurationMs, 0);
  const recentWeekActiveDays = () =>
    archiveDays().filter((day) => day.totalDurationMs > 0).length;
  const totalTodoCount = () =>
    (analytics()?.completedTodoCount ?? 0) + (analytics()?.pendingTodoCount ?? 0);
  const todoCompletionPercent = () => {
    const total = totalTodoCount();
    return total === 0 ? 0 : Math.round(((analytics()?.completedTodoCount ?? 0) / total) * 100);
  };
  const selectedTodo = () =>
    todos().find((item) => item.id === linkedTodoId() && !item.isCompleted) ?? null;
  const activeTitle = () =>
    sessionTitle().trim() || selectedTodo()?.title || timer().activeTaskTitle.trim() || "未命名事项";
  const timerHasProgress = () => timer().hasUnsubmittedProgress;
  const timerCanContinue = () =>
    timerHasProgress() && !(timer().modeKey === "countdown" && timer().remainingMs === 0);
  const canFinish = () => timer().elapsedMs > 0 && timer().canCompleteSession;

  createEffect(() => {
    const days = extendedArchiveDays();
    if (days.length > 0 && !days.some((day) => day.date === selectedArchiveDate())) {
      setSelectedArchiveDate(days[days.length - 1].date);
    }
  });
  const paletteCommands = (): PaletteCommand[] => [
    { id: "today", label: "打开今日驾驶舱", detail: "查看当前状态、下一件事和今日进展" },
    { id: "focus", label: "打开完整计时", detail: "进入模式、任务和计时控制" },
    { id: "todos", label: "打开待办", detail: "管理、编辑和排序待办" },
    { id: "records", label: "打开记录", detail: "查看趋势和专注记录" },
    { id: "settings", label: "打开设置", detail: "管理本地备份和数据" },
    { id: "start", label: "开始下一件事", detail: "把最早的未完成待办带入专注", shortcut: "Enter" },
    { id: "pause", label: "暂停当前专注", detail: "保留当前进度，稍后继续" },
    { id: "finish", label: "完成并记录当前专注", detail: "保存这一轮并回到可继续的状态" },
    { id: "floating", label: "打开迷你工作台", detail: "把待办和当前计时放到桌面上" },
    { id: "quick-capture", label: "快速收进收件箱", detail: "记下一件事，不填日期也可以" },
    { id: "backup", label: "导出本地备份", detail: "把当前待办、记录和运行态保存下来" },
    ...buildFocusHistoryResults(todos(), records(), commandSearch()).map((result) => ({
      id: result.id,
      label: result.label,
      detail: result.detail,
    })),
  ];

  createEffect(() => {
    if (!isFloatingWindow || loadState() !== "ready") {
      return;
    }

    const timerAvailable = timerHasProgress();
    if (timerAvailable && !floatingTimerWasAvailable) {
      setFloatingTab("timer");
    } else if (!timerAvailable && floatingTab() === "timer") {
      setFloatingTab("todos");
    }
    floatingTimerWasAvailable = timerAvailable;
  });

  function showMessage(text: string, kind: FeedbackKind = "info") {
    if (messageTimer !== undefined) {
      window.clearTimeout(messageTimer);
    }
    setMessage(text);
    setMessageKind(kind);
    messageTimer = window.setTimeout(() => {
      setMessage("");
      setMessageKind("info");
      messageTimer = undefined;
    }, 5_000);
  }

  function clearMessage() {
    if (messageTimer !== undefined) {
      window.clearTimeout(messageTimer);
      messageTimer = undefined;
    }
    setMessage("");
    setMessageKind("info");
  }

  function selectTheme(nextThemeId: ThemeId) {
    const theme = getTheme(nextThemeId);
    if (!theme.implemented) {
      return;
    }
    scheduleAppPreferencesSave({ themeId: theme.id });
  }

  function updateVisualIntensity(value: number) {
    scheduleAppPreferencesSave({ visualIntensity: Math.max(0, Math.min(100, Math.round(value))) });
  }

  function updateMotionIntensity(value: number) {
    scheduleAppPreferencesSave({ motionIntensity: Math.max(0, Math.min(100, Math.round(value))) });
  }

  function updateDensity(value: "roomy" | "compact") {
    scheduleAppPreferencesSave({ density: value });
  }

  function updateFloatingOpacity(value: number) {
    const nextValue = Math.min(defaultFloatingOpacity, Math.max(minFloatingOpacity, Math.round(value)));
    scheduleAppPreferencesSave({ floatingOpacity: nextValue });
  }

  function updateAutoMiniOnStart(value: boolean) {
    scheduleAppPreferencesSave({ autoMiniOnStart: value });
  }

  function scheduleFloatingWorkspaceFit() {
    if (!isFloatingWindow || floatingResizeFrame !== undefined) {
      return;
    }

    floatingResizeFrame = window.requestAnimationFrame(() => {
      floatingResizeFrame = undefined;
      const element = floatingWorkspaceElement;
      if (!element) {
        return;
      }

      const desiredHeight = Math.max(260, Math.min(560, Math.ceil(element.scrollHeight + 2)));
      void getCurrentWindow()
        .scaleFactor()
        .then(async (scaleFactor) => {
          const currentSize = await getCurrentWindow().innerSize();
          const currentLogicalSize = currentSize.toLogical(scaleFactor);
          if (Math.abs(currentLogicalSize.height - desiredHeight) < 4) {
            return;
          }
          await getCurrentWindow().setSize(new LogicalSize(currentLogicalSize.width, desiredHeight));
        })
        .catch(() => undefined);
    });
  }

  createEffect(() => {
    if (!isFloatingWindow || loadState() !== "ready") {
      return;
    }

    floatingTab();
    timer().activeTaskTitle;
    timer().isRunning;
    timer().alertSequence;
    timer().alertTitle;
    timer().linkedTodoId;
    scheduleFloatingWorkspaceFit();
  });

  function applyTimerSnapshot(next: TimerSnapshot) {
    setTimer(next);
    if (next.hasUnsubmittedProgress) {
      setSavedConfirmation(false);
    }
    const hasCommittedContext =
      next.hasUnsubmittedProgress ||
      next.activeTaskTitle.trim().length > 0;

    if (next.hasUnsubmittedProgress) {
      setCompleteLinkedTodo(next.completeLinkedTodoOnFinish);
    }
    if (next.modeKey === "countdown" && next.targetDurationMs !== null && !countdownDraftDirty()) {
      setCountdownMinutes(Math.max(1, Math.round(next.targetDurationMs / 60_000)));
    }

    // Each window has its own form state. Sync the persisted timer context into
    // an untouched form, and clear stale context after another window finishes
    // or resets the session. Never overwrite a title the user is editing.
    if (!sessionTitleDirty()) {
      setSessionTitle(hasCommittedContext ? next.activeTaskTitle : "");
      setLinkedTodoId(hasCommittedContext ? next.linkedTodoId : null);
      setCompleteLinkedTodo(hasCommittedContext ? next.completeLinkedTodoOnFinish : false);
    }
  }

  function applyAppStateSnapshot(next: AppStateSyncPayload) {
    applyTimerSnapshot(next.timer);
    if (editingTodo() !== null || editingRecord() !== null) {
      return;
    }
    setTodos(next.todos);
    setRecords(next.records);
    setAnalytics(next.analytics);
    setTimerPreferences(next.timerPreferences);
    setFocusPlan(next.focusPlan);
    applyAppPreferences({
      schemaVersion: next.appPreferencesView.schemaVersion,
      themeId: next.appPreferencesView.themeId,
      visualIntensity: next.appPreferencesView.visualIntensity,
      motionIntensity: next.appPreferencesView.motionIntensity,
      density: next.appPreferencesView.density,
      floatingOpacity: next.appPreferencesView.floatingOpacity,
      autoMiniOnStart: next.appPreferencesView.autoMiniOnStart,
      customAlertSoundName: next.appPreferencesView.customAlertSoundName,
      customAlertSoundData: customAlertSoundData(),
    });
  }

  function alertIsVisible() {
    return Boolean(timer().alertTitle && timerPreferences().toastReminderEnabled);
  }

  function handleNewTimerAlert() {
    const nextSequence = timer().alertSequence;
    if (observedAlertSequence === null) {
      observedAlertSequence = nextSequence;
      return;
    }
    if (nextSequence <= observedAlertSequence || !timer().alertTitle) {
      return;
    }

    observedAlertSequence = nextSequence;
    if (!claimAlertSequence(nextSequence)) {
      return;
    }
    if (timerPreferences().windowAttentionReminderEnabled) {
      void flashMainWindowAttention().catch(() => undefined);
    }
    if (timerPreferences().soundReminderEnabled) {
      playAlertSound(timerPreferences().alertSoundKey);
    }
  }

  function invalidateRefreshes() {
    refreshVersion += 1;
    timerRefreshVersion += 1;
  }

  async function refresh(force = false) {
    const requestVersion = ++refreshVersion;
    const timerRequestVersion = ++timerRefreshVersion;
    const [nextTimer, nextTodos, nextRecords, nextAnalytics, nextPreferences, nextAppPreferences, nextFocusPlan] = await Promise.all([
      getTimerSnapshot(),
      getTodoItems(),
      getFocusRecords(),
      getAnalyticsSnapshot(),
      getTimerPreferences(),
      getAppPreferences(),
      getFocusPlan(),
    ]);

    if (
      requestVersion !== refreshVersion ||
      timerRequestVersion !== timerRefreshVersion ||
      (!force && busy())
    ) {
      return false;
    }

    applyTimerSnapshot(nextTimer);
    if (!force && (editingTodo() !== null || editingRecord() !== null)) {
      return false;
    }
    setTodos(nextTodos);
    setRecords(nextRecords);
    setAnalytics(nextAnalytics);
    if (nextPreferences) {
      setTimerPreferences(nextPreferences);
    }
    const resolvedAppPreferences = await migrateLegacyAppPreferences(nextAppPreferences);
    applyAppPreferences(resolvedAppPreferences);
    setFocusPlan(nextFocusPlan);
    if (currentWindowLabel === "main") {
      void emit<AppStateSyncPayload>(appStateSyncEvent, {
        timer: nextTimer,
        todos: nextTodos,
        records: nextRecords,
        analytics: nextAnalytics,
        timerPreferences: nextPreferences,
        appPreferencesView: {
          schemaVersion: resolvedAppPreferences.schemaVersion,
          themeId: resolvedAppPreferences.themeId,
          visualIntensity: resolvedAppPreferences.visualIntensity,
          motionIntensity: resolvedAppPreferences.motionIntensity,
          density: resolvedAppPreferences.density,
          floatingOpacity: resolvedAppPreferences.floatingOpacity,
          autoMiniOnStart: resolvedAppPreferences.autoMiniOnStart,
          customAlertSoundName: resolvedAppPreferences.customAlertSoundName,
          hasCustomAlertSound: Boolean(resolvedAppPreferences.customAlertSoundData),
        },
        focusPlan: nextFocusPlan,
      }).catch(() => undefined);
    }
    return true;
  }

  async function refreshTimerSnapshot(force = false) {
    const requestVersion = ++timerRefreshVersion;
    const nextTimer = await getTimerSnapshot();

    if (requestVersion !== timerRefreshVersion || (!force && busy())) {
      return false;
    }

    applyTimerSnapshot(nextTimer);
    return true;
  }

  async function loadFromStorage() {
    setLoadState("loading");
    setLoadError("");
    try {
      await refresh(true);
      setLoadState("ready");
      setSyncError("");
    } catch (error) {
      const text = getErrorMessage(error);
      setLoadState("error");
      setLoadError(text);
      throw error;
    }
  }

  async function retryLoad() {
    await run(async () => {
      await loadFromStorage();
      showMessage("数据已重新加载。", "success");
    }, "正在加载…");
  }

  async function run(action: () => Promise<void>, actionLabel = "正在处理…") {
    if (busy()) {
      return;
    }

    invalidateRefreshes();
    setBusy(true);
    setBusyLabel(actionLabel);
    clearMessage();
    try {
      await action();
      await emitAppStateSync();
    } catch (error) {
      showMessage(getErrorMessage(error), "error");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function changeMode(mode: TimerMode) {
    if (timerHasProgress()) {
      showMessage("请先完成记录或重置当前计时，再切换模式。", "info");
      return;
    }

    await run(async () => {
      const next = await switchTimerMode(mode);
      applyTimerSnapshot(next);
      setSavedConfirmation(false);
      setCountdownDraftDirty(false);
      setCompleteLinkedTodo(false);
    }, "正在切换…");
  }

  async function startFocus() {
    const title = activeTitle();
    if (!title || title === "未命名事项") {
      showMessage("请先写下这一轮要做什么，或选择一个待办。", "error");
      return;
    }

    await run(async () => {
      if (timer().modeKey === "countdown" && !timerHasProgress()) {
        const minutes = Math.round(countdownMinutes());
        if (minutes < 1 || minutes > 720) {
          throw new Error("倒计时时长需要在 1 到 720 分钟之间。");
        }
        applyTimerSnapshot(await configureCountdownMinutes(minutes));
        setCountdownDraftDirty(false);
      }

      applyTimerSnapshot(
        await updateTimerContext(title, linkedTodoId(), completeLinkedTodo())
      );
      applyTimerSnapshot(await startTimer());
      setSavedConfirmation(false);
      setSessionTitleDirty(false);
      if (autoMiniOnStart() && (timer().modeKey === "stopwatch" || timer().modeKey === "countdown")) {
        await showFloatingTodos();
      }
      showMessage("已开始计时。", "success");
    }, "正在开始…");
  }

  async function pauseFocus() {
    await run(async () => {
      applyTimerSnapshot(await pauseTimer());
      showMessage("已暂停计时。", "info");
    }, "正在暂停…");
  }

  async function resetFocus() {
    await run(async () => {
      const nextTimer = await resetTimer();
      setCountdownDraftDirty(false);
      applyTimerSnapshot(nextTimer);
      setSavedConfirmation(false);
      setSessionTitle("");
      setSessionTitleDirty(false);
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      showMessage("本轮已重置，没有生成记录。", "info");
    }, "正在重置…");
  }

  async function finishFocus() {
    await run(async () => {
      const linkedTodoBeforeFinish = timer().linkedTodoId ?? linkedTodoId();
      const title = isFloatingWindow || isFocusFloatingWindow
        ? timer().activeTaskTitle
        : activeTitle();
      const payload = await completeFocusSession(title);
      setRecords(payload.records);
      setTodos(payload.todoItems);
      setAnalytics(await getAnalyticsSnapshot());
      applyTimerSnapshot(payload.timerSnapshot);
      setSavedConfirmation(true);
      setSessionTitle("");
      setSessionTitleDirty(false);
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      const linkedTodo = linkedTodoBeforeFinish === null
        ? null
        : payload.todoItems.find((item) => item.id === linkedTodoBeforeFinish);
      if (linkedTodo && !linkedTodo.isCompleted) {
        setContinuationSaveError("");
        setContinuationPrompt({ todoId: linkedTodo.id, title: linkedTodo.title });
      } else {
        setContinuationSaveError("");
        setContinuationPrompt(null);
      }
      if (isFloatingWindow) {
        await restoreMainFromFloatingTodos();
      } else if (isFocusFloatingWindow) {
        await restoreMainFromFocusFloating();
      }
      showMessage("已保存为一条专注记录。", "success");
    }, "正在保存…");
  }

  async function addTodo() {
    const title = todoTitle().trim();
    if (!title) {
      showMessage("请填写待办事项。", "error");
      return;
    }
    await run(async () => {
      setTodos(
        await createTodoItem({
          title,
          scheduledDate: todoDueDate(),
          scheduledTime: todoDueTime(),
          importanceKey: todoImportance(),
        })
      );
      setTodoTitle("");
      setTodoDueTime("");
      setTodoImportance("medium");
      showMessage("待办已添加。", "success");
    }, "正在添加…");
  }

  function beginEditTodo(item: TodoItem) {
    setEditingTodo({
      id: item.id,
      title: item.title,
      scheduledDate: item.scheduledDate,
      scheduledTime: item.scheduledTime,
      importanceKey: item.importanceKey,
    });
  }

  function patchEditingTodo(patch: Partial<TodoEditDraft>) {
    const current = editingTodo();
    if (current) {
      setEditingTodo({ ...current, ...patch });
    }
  }

  function cancelEditTodo() {
    setEditingTodo(null);
  }

  async function saveTodoEdit() {
    const draft = editingTodo();
    if (!draft) {
      return;
    }

    await run(async () => {
      setTodos(
        await updateTodoItem(draft.id, {
          title: draft.title,
          scheduledDate: draft.scheduledDate,
          scheduledTime: draft.scheduledTime,
          importanceKey: draft.importanceKey,
        })
      );
      setEditingTodo(null);
      showMessage("待办已更新。", "success");
    }, "正在保存…");
  }

  async function syncFloatingWorkspace() {
    if (busy() || editingTodo() !== null || editingRecord() !== null) {
      return;
    }

    try {
      const refreshed = await refresh(true);
      if (refreshed) {
        setLoadState("ready");
        setLoadError("");
        setSyncError("");
      }
    } catch (error) {
      setSyncError(getErrorMessage(error));
    }
  }

  function beginEditRecord(record: FocusRecord) {
    setEditingRecord({
      id: record.id,
      title: record.title,
      durationMinutes: Math.max(1, Math.min(1440, Math.round(record.durationMs / 60_000))),
      completedDate: record.completedDate,
      completedTime: record.completedTime,
      linkedTodoId: record.linkedTodoId,
    });
    setRecordEditDialogOpen(false);
  }

  function beginDetailedRecordEdit(record: FocusRecord) {
    beginEditRecord(record);
    setRecordEditDialogOpen(true);
  }

  function patchEditingRecordTitle(title: string) {
    const current = editingRecord();
    if (current) {
      setEditingRecord({ ...current, title });
    }
  }

  function patchEditingRecord(patch: Partial<RecordEditDraft>) {
    const current = editingRecord();
    if (current) {
      setEditingRecord({ ...current, ...patch });
    }
  }

  function cancelEditRecord() {
    setEditingRecord(null);
    setRecordEditDialogOpen(false);
  }

  async function saveRecordEdit() {
    const draft = editingRecord();
    if (!draft) {
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      showMessage("记录名称不能为空。", "error");
      return;
    }

    await run(async () => {
      setRecords(await updateFocusRecord({
        id: draft.id,
        title,
        durationMinutes: draft.durationMinutes,
        completedDate: draft.completedDate,
        completedTime: draft.completedTime,
        linkedTodoId: draft.linkedTodoId,
      }));
      setAnalytics(await getAnalyticsSnapshot());
      setEditingRecord(null);
      setRecordEditDialogOpen(false);
      showMessage("专注记录已更新。", "success");
    }, "正在保存…");
  }

  async function toggleTodo(id: number) {
    await run(async () => {
      const nextTodos = await toggleTodoItem(id);
      const updatedItem = nextTodos.find((item) => item.id === id);
      setTodos(nextTodos);
      if (updatedItem?.isCompleted) {
        showMessage(`已完成“${updatedItem.title}”，已移到“已完成”。`, "success");
      } else {
        showMessage(`已恢复“${updatedItem?.title ?? "待办"}”。`, "success");
      }
    }, "正在更新…");
  }

  async function removeTodo(id: number) {
    const item = todos().find((candidate) => candidate.id === id);
    if (!item) {
      showMessage("找不到要删除的待办。", "error");
      return;
    }

    await run(async () => {
      setTodos(await deleteTodoItem(id));
      if (linkedTodoId() === id) {
        setLinkedTodoId(null);
      }
      armUndo({ kind: "todo", item });
      showMessage(`已删除“${item.title}”。`, "success");
    }, "正在删除…");
  }

  async function removeRecord(id: number) {
    const item = records().find((candidate) => candidate.id === id);
    if (!item) {
      showMessage("找不到要删除的专注记录。", "error");
      return;
    }

    await run(async () => {
      setRecords(await deleteFocusRecord(id));
      armUndo({ kind: "record", item });
      showMessage(`已删除“${item.title}”。`, "success");
    }, "正在删除…");
  }

  function armUndo(action: UndoAction) {
    if (undoTimer !== undefined) {
      window.clearTimeout(undoTimer);
    }
    setUndoAction(action);
    undoTimer = window.setTimeout(() => {
      setUndoAction(null);
      undoTimer = undefined;
    }, 8_000);
  }

  async function undoDelete() {
    const action = undoAction();
    if (!action) {
      return;
    }

    await run(async () => {
      if (action.kind === "todo") {
        setTodos(await restoreTodoItem(action.item));
      } else {
        setRecords(await restoreFocusRecord(action.item));
      }
      setUndoAction(null);
      if (undoTimer !== undefined) {
        window.clearTimeout(undoTimer);
        undoTimer = undefined;
      }
      showMessage("已撤销删除。", "success");
    }, "正在恢复…");
  }

  async function dismissTimerAlert() {
    await run(async () => {
      applyTimerSnapshot(await acknowledgeTimerAlert());
      setSavedConfirmation(false);
    }, "正在收起…");
  }

  async function saveTimerPreferences(patch: Partial<TimerPreferences>, successMessage = "提醒设置已保存。") {
    const nextPreferences = { ...timerPreferences(), ...patch };
    let saved = false;
    await run(async () => {
      setTimerPreferences(await updateTimerPreferences(nextPreferences));
      saved = true;
      showMessage(successMessage, "success");
    }, "正在保存提醒设置…");
    if (!saved) {
      setTimerPreferences({ ...timerPreferences() });
    }
  }

  function previewAlertSound() {
    if (!timerPreferences().soundReminderEnabled) {
      showMessage("请先打开声音提醒，再试听音效。", "info");
      return;
    }
    playAlertSound(timerPreferences().alertSoundKey, customAlertSoundData());
  }

  async function chooseCustomAlertSound(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("audio/")) {
      showMessage("请选择音频文件。", "error");
      return;
    }
    if (file.size > maxCustomAlertSoundBytes) {
      showMessage("自定义音效不能超过 5MB。", "error");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("音效读取失败，请重试。"));
      reader.readAsDataURL(file);
    }).catch((error) => {
      showMessage(getErrorMessage(error), "error");
      return "";
    });
    if (!dataUrl) {
      showMessage("音效保存失败，请换一个文件重试。", "error");
      return;
    }

    scheduleAppPreferencesSave({ customAlertSoundName: file.name, customAlertSoundData: dataUrl });
    await saveTimerPreferences({ alertSoundKey: "custom" }, "自定义音效已启用。");
  }

  async function clearCustomAlertSound() {
    scheduleAppPreferencesSave({ customAlertSoundName: "", customAlertSoundData: null });
    await saveTimerPreferences({ alertSoundKey: "soft_chime" }, "已恢复为柔和铃音。");
  }

  function openQuickCapture() {
    setQuickCaptureTitle("");
    setQuickCaptureOpen(true);
  }

  function closeQuickCapture() {
    setQuickCaptureOpen(false);
    setQuickCaptureTitle("");
  }

  async function saveQuickCapture() {
    const title = quickCaptureTitle().trim();
    if (!title) {
      showMessage("请先写下一件要记住的事。", "error");
      return;
    }
    await run(async () => {
      setTodos(await createTodoItem({
        title,
        scheduledDate: "",
        scheduledTime: "",
        importanceKey: "medium",
      }));
      closeQuickCapture();
      showMessage("已放入收件箱，稍后整理。", "success");
    }, "正在收进收件箱…");
  }

  function openManualRecord() {
    setManualRecordOpen(true);
  }

  function closeManualRecord() {
    setManualRecordOpen(false);
  }

  async function loadBackups() {
    setBackupLoadState("loading");
    setBackupLoadError("");
    try {
      const nextBackups = await listAppBackups();
      setBackups(nextBackups);
      setSelectedBackupFile((current) =>
        nextBackups.some((backup) => backup.fileName === current)
          ? current
          : nextBackups[0]?.fileName ?? ""
      );
      setBackupLoadState("ready");
    } catch (error) {
      setBackupLoadState("error");
      setBackupLoadError(getErrorMessage(error));
    }
  }

  function changeView(view: AppView) {
    flushAppPreferencesSave();
    if (view !== "records") {
      setRecordTaskFilterId(null);
    }
    setActiveView(view);
    // A tab is a new destination. Do not carry a long records/settings
    // document position into the next page and hide its heading.
    document.scrollingElement?.scrollTo(0, 0);
    if (view === "settings") {
      void loadBackups();
    }
  }

  async function createBackup() {
    await run(async () => {
      const result = await exportAppBackup();
      setLastBackupPath(result.filePath);
      await loadBackups();
      showMessage("备份已保存到本机。", "success");
    }, "正在导出…");
  }

  async function restoreBackup() {
    const fileName = selectedBackupFile();
    if (!fileName) {
      showMessage("请先选择一份备份。", "error");
      return;
    }
    if (!window.confirm("导入备份会替换当前待办、记录和计时状态，是否继续？")) {
      return;
    }

    await run(async () => {
      const result = await importAppBackup(fileName);
      await loadFromStorage();
      await loadBackups();
      showMessage(
        result.migratedFromFormatVersion
          ? `已升级旧版备份，并恢复 ${result.todoCount} 项待办和 ${result.focusRecordCount} 条记录。`
          : `已恢复 ${result.todoCount} 项待办和 ${result.focusRecordCount} 条记录。`,
        "success"
      );
    }, "正在恢复…");
  }

  async function previewPortableBackup() {
    const path = portableBackupPath().trim();
    if (!path) {
      showMessage("请先选择或填写备份文件路径。", "error");
      return;
    }
    await run(async () => {
      setPortableBackupPreview(await previewAppBackupPath(path));
    }, "正在预览备份…");
  }

  async function exportPortableBackup() {
    const path = portableBackupPath().trim();
    if (!path) {
      showMessage("请先填写导出文件路径。", "error");
      return;
    }
    await run(async () => {
      const result = await exportAppBackupToPath(path);
      setLastBackupPath(result.filePath);
      await loadBackups();
      showMessage(`便携备份已导出：${result.filePath}`, "success");
    }, "正在导出便携备份…");
  }

  async function importPortableBackup() {
    const path = portableBackupPath().trim();
    const preview = portableBackupPreview();
    if (!path || !preview) {
      showMessage("请先预览一份有效备份，再导入。", "error");
      return;
    }
    if (!window.confirm("导入会替换当前待办、记录和计时状态，是否继续？")) {
      return;
    }
    await run(async () => {
      const result = await importAppBackupPath(path, { restoreAppPreferences: restorePortableAppPreferences() });
      setPortableBackupPreview(null);
      await loadFromStorage();
      await loadBackups();
      showMessage(`已恢复 ${result.todoCount} 项待办和 ${result.focusRecordCount} 条记录${result.migratedFromFormatVersion ? "，并完成旧版迁移" : ""}。`, "success");
    }, "正在导入便携备份…");
  }

  async function clearAllData() {
    if (!window.confirm("这会清空当前待办、专注记录和未完成计时，但不会删除备份。是否继续？")) {
      return;
    }

    await run(async () => {
      await clearAppData();
      await loadFromStorage();
      showMessage("本地数据已清空，已有备份仍然保留。", "success");
    }, "正在清空…");
  }


  async function openBackupFolder() {
    await run(async () => {
      await openAppBackupFolder();
      showMessage("已打开备份目录。", "success");
    }, "正在打开…");
  }

  function useTodoForFocus(item: TodoItem) {
    setLinkedTodoId(item.id);
    setSessionTitle(item.title);
    setSessionTitleDirty(true);
    setActiveView("focus");
  }

  async function startNextTodo() {
    if (timerHasProgress()) {
      setActiveView("focus");
      showMessage("当前还有一轮专注，请先继续、完成或重置。", "info");
      return;
    }

    const item = nextTodo();
    if (!item) {
      setActiveView("todos");
      showMessage("先写下一件要完成的事，再从这里开始专注。", "info");
      return;
    }

    setLinkedTodoId(item.id);
    setSessionTitle(item.title);
    setSessionTitleDirty(true);
    await startFocus();
  }

  async function updateFocusPlanState(next: FocusPlanState, successMessage?: string) {
    await run(async () => {
      const saved = await updateFocusPlan(next);
      setFocusPlan(saved);
      if (successMessage) {
        showMessage(successMessage, "info");
      }
    }, "正在更新焦点计划…");
  }

  async function setCurrentTodo(id: number | null) {
    await updateFocusPlanState({ ...focusPlan(), currentTodoId: id }, id === null ? "已取消当前事项。" : "已设为当前事项。 ");
  }

  async function toggleTodayPick(id: number) {
    const current = focusPlan().todayPickIds;
    const nextIds = current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id];
    if (nextIds.length > 3) {
      showMessage("今日精选最多保留 3 件事，请先移出一项。", "info");
      return;
    }
    await updateFocusPlanState({ ...focusPlan(), todayPickIds: nextIds }, current.includes(id) ? "已移出今日精选。" : "已加入今日精选。");
  }

  async function startFocusForTodo(item: TodoItem) {
    if (timerHasProgress()) {
      setActiveView("focus");
      showMessage("当前还有一轮专注，请先继续、完成或重置。", "info");
      return;
    }
    setLinkedTodoId(item.id);
    setSessionTitle(item.title);
    setSessionTitleDirty(true);
    await updateFocusPlanState({ ...focusPlan(), currentTodoId: item.id });
    await startFocus();
  }

  async function saveContinuationNote(id: number, note: string): Promise<boolean> {
    const normalized = note.trim();
    let saved = false;
    await run(async () => {
      setTodos(await updateTodoContinuationNote(id, normalized));
      saved = true;
      setContinuationSaveError("");
      showMessage(normalized ? "停笔书签已保存。" : "已清空停笔书签。", "success");
    }, "正在保存停笔书签…");
    if (!saved) {
      setContinuationSaveError("保存失败，请检查本地数据后点击“重试保存”。");
    }
    return saved;
  }

  async function createManualRecord(payload: {
    title: string;
    durationMinutes: number;
    completedDate: string;
    completedTime: string;
    linkedTodoId: number | null;
  }): Promise<boolean> {
    let saved = false;
    await run(async () => {
      setRecords(await createManualFocusRecord(payload));
      setAnalytics(await getAnalyticsSnapshot());
      saved = true;
      showMessage("手动专注记录已补录。", "success");
    }, "正在补录专注…");
    return saved;
  }

  async function updateRecord(payload: {
    id: number;
    title: string;
    durationMinutes: number;
    completedDate: string;
    completedTime: string;
    linkedTodoId: number | null;
  }) {
    await run(async () => {
      setRecords(await updateFocusRecord(payload));
      setAnalytics(await getAnalyticsSnapshot());
      setEditingRecord(null);
      showMessage("专注记录已修正。", "success");
    }, "正在修正记录…");
  }

  async function changeCompletionPreference(value: boolean) {
    setCompleteLinkedTodo(value);
    if (!isFloatingWindow && !isFocusFloatingWindow) {
      return;
    }

    await run(async () => {
      applyTimerSnapshot(
        await updateTimerContext(
          timer().activeTaskTitle,
          timer().linkedTodoId,
          value
        )
      );
    }, "正在更新…");
  }

  function closeCommandPalette() {
    setCommandPaletteOpen(false);
    setCommandSearch("");
    queueMicrotask(() => {
      if (commandTrigger && commandTrigger.offsetParent !== null) {
        commandTrigger.focus();
        return;
      }
      document.querySelector<HTMLElement>(".minimal-nav > button.active")?.focus();
    });
  }

  function openCommandPalette() {
    setCommandPaletteOpen(true);
    setCommandSearch("");
  }

  function executePaletteCommand(commandId: string) {
    closeCommandPalette();
    const dateMatch = commandId.match(/^history-date-(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      setRecordTaskFilterId(null);
      setSelectedArchiveDate(dateMatch[1]);
      changeView("records");
      showMessage("已定位到日期归档。", "info");
      return;
    }
    const taskMatch = commandId.match(/^history-task-(\d+)$/);
    if (taskMatch) {
      setRecordTaskFilterId(Number(taskMatch[1]));
      changeView("records");
      showMessage("已定位到任务的全部专注记录。", "info");
      return;
    }
    const recordMatch = commandId.match(/^history-record-(\d+)$/);
    if (recordMatch) {
      const record = records().find((item) => item.id === Number(recordMatch[1]));
      if (record) {
        setRecordTaskFilterId(record.linkedTodoId);
        setSelectedArchiveDate(recordDateKey(record));
        changeView("records");
        showMessage("已定位到这条专注记录。", "info");
      }
      return;
    }
    switch (commandId) {
      case "today":
        changeView("today");
        break;
      case "focus":
        changeView("focus");
        break;
      case "todos":
        changeView("todos");
        break;
      case "records":
        changeView("records");
        break;
      case "settings":
        changeView("settings");
        break;
      case "start":
        void startNextTodo();
        break;
      case "pause":
        if (timer().isRunning) {
          void pauseFocus();
        } else {
          showMessage("当前没有正在运行的专注。", "info");
        }
        break;
      case "finish":
        if (canFinish()) {
          void finishFocus();
        } else {
          showMessage("当前还没有可以保存的专注进度。", "info");
        }
        break;
      case "floating":
        void showFloatingTodos();
        break;
      case "quick-capture":
        openQuickCapture();
        break;
      case "backup":
        void createBackup();
        break;
    }
  }

  createEffect(() => {
    if (commandPaletteOpen()) {
      queueMicrotask(() => {
        commandInput?.focus();
        commandInput?.select();
      });
    }
  });

  createEffect(() => {
    timer().alertSequence;
    handleNewTimerAlert();
  });

  onMount(() => {
    if (isFloatingWindow || isUnlockWindow || isFocusFloatingWindow || isFocusUnlockWindow) {
      document.documentElement.classList.add("floating-window");
    }

    let interval: number | undefined;
    let floatingSyncActive = true;
    let floatingSyncUnlisten: (() => void) | undefined;
    let appStateSyncActive = true;
    let appStateSyncUnlisten: (() => void) | undefined;
    let trayNavigationActive = true;
    let trayNavigationUnlisten: (() => void) | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (commandPaletteOpen()) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (timer().isRunning) {
          showMessage("当前专注正在进行中。", "info");
        } else if (timerHasProgress()) {
          void startFocus();
        } else {
          void startNextTodo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (canFinish()) {
          void finishFocus();
        } else {
          showMessage("当前还没有可以保存的专注进度。", "info");
        }
        return;
      }

      if (commandPaletteOpen() && event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
      }
    };

    if (!isFloatingWindow && !isUnlockWindow && !isFocusFloatingWindow && !isFocusUnlockWindow) {
      window.addEventListener("keydown", onKeyDown);
    }
    window.addEventListener("beforeunload", flushAppPreferencesSave);

    if (isFloatingWindow) {
      void listen(floatingWorkspaceSyncEvent, () => {
        void syncFloatingWorkspace();
      })
        .then((unlisten) => {
          if (floatingSyncActive) {
            floatingSyncUnlisten = unlisten;
          } else {
            void unlisten();
          }
        })
        .catch(() => undefined);
    }

    if (currentWindowLabel === "main" || isFloatingWindow || isFocusFloatingWindow) {
      void listen<AppStateSyncPayload>(appStateSyncEvent, ({ payload }) => {
        if (busy() || editingTodo() !== null || editingRecord() !== null) {
          return;
        }
        applyAppStateSnapshot(payload);
        setLoadState("ready");
        setLoadError("");
        setSyncError("");
      })
        .then((unlisten) => {
          if (appStateSyncActive) {
            appStateSyncUnlisten = unlisten;
          } else {
            void unlisten();
          }
        })
        .catch(() => undefined);
    }

    if (currentWindowLabel === "main") {
      void listen<string>(trayNavigateEvent, ({ payload }) => {
        if (isAppView(payload)) {
          changeView(payload);
        }
      })
        .then((unlisten) => {
          if (trayNavigationActive) {
            trayNavigationUnlisten = unlisten;
          } else {
            void unlisten();
          }
        })
        .catch(() => undefined);
    }

    if (currentWindowLabel === "main" || isFloatingWindow || isFocusFloatingWindow) {
      void loadFromStorage().catch((error) => {
        showMessage(getErrorMessage(error), "error");
      });

      if (currentWindowLabel === "main") {
        interval = window.setInterval(
          () => {
            if (loadState() === "error") {
              return;
            }

            const shouldRefreshBusiness = !busy() && editingTodo() === null && editingRecord() === null;
            const hadSyncError = Boolean(syncError());
            const refreshTask = shouldRefreshBusiness ? refresh() : refreshTimerSnapshot();
            void refreshTask
              .then((refreshed) => {
                if (!refreshed) {
                  return;
                }
                setLoadState("ready");
                setLoadError("");
                setSyncError("");
                if (hadSyncError && messageKind() === "error") {
                  clearMessage();
                }
              })
              .catch((error) => {
                const text = getErrorMessage(error);
                setSyncError(text);
                if (!hadSyncError) {
                  showMessage("本地数据刷新失败，请稍后重试。", "error");
                }
              });
          },
          1000,
        );
      }
    }

    onCleanup(() => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      if (floatingResizeFrame !== undefined) {
        window.cancelAnimationFrame(floatingResizeFrame);
        floatingResizeFrame = undefined;
      }
      floatingSyncActive = false;
      if (floatingSyncUnlisten) {
        void floatingSyncUnlisten();
      }
      appStateSyncActive = false;
      if (appStateSyncUnlisten) {
        void appStateSyncUnlisten();
      }
      trayNavigationActive = false;
      if (trayNavigationUnlisten) {
        void trayNavigationUnlisten();
      }
      if (undoTimer !== undefined) {
        window.clearTimeout(undoTimer);
      }
      if (messageTimer !== undefined) {
        window.clearTimeout(messageTimer);
      }
      flushAppPreferencesSave();
      window.removeEventListener("beforeunload", flushAppPreferencesSave);
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("floating-window");
    });
  });

  return {
    activeView,
    setActiveView,
    timer,
    savedConfirmation,
    todos,
    records,
    analytics,
    sessionTitle,
    setSessionTitle,
    sessionTitleDirty,
    setSessionTitleDirty,
    linkedTodoId,
    setLinkedTodoId,
    completeLinkedTodo,
    setCompleteLinkedTodo,
    countdownMinutes,
    setCountdownMinutes,
    countdownDraftDirty,
    setCountdownDraftDirty,
    timerPreferences,
    customAlertSoundName,
    todoTitle,
    setTodoTitle,
    todoDueDate,
    setTodoDueDate,
    todoDueTime,
    setTodoDueTime,
    todoImportance,
    setTodoImportance,
    editingTodo,
    setEditingTodo,
    editingRecord,
    recordEditDialogOpen,
    patchEditingRecord,
    backups,
    backupLoadState,
    backupLoadError,
    selectedBackupFile,
    setSelectedBackupFile,
    lastBackupPath,
    portableBackupPath,
    setPortableBackupPath,
    portableBackupPreview,
    restorePortableAppPreferences,
    setRestorePortableAppPreferences,
    commandPaletteOpen,
    commandSearch,
    setCommandSearch,
    busy,
    busyLabel,
    message,
    messageKind,
    loadState,
    loadError,
    syncError,
    undoAction,
    floatingTab,
    setFloatingTab,
    floatingOpacity,
    floatingOpacityPanelOpen,
    setFloatingOpacityPanelOpen,
    selectedArchiveDate,
    setSelectedArchiveDate,
    recordTaskFilterId,
    recordTaskFilterTitle,
    clearRecordTaskFilter: () => setRecordTaskFilterId(null),
    themeId,
    visualIntensity,
    motionIntensity,
    density,
    ready,
    pendingTodos,
    activeTodos,
    overdueTodos,
    completedTodos,
    todayTodos,
    todayCompletedTodos,
    nextTodo,
    selectedBackup,
    recentBreakdown,
    recordGroups,
    archiveDays,
    extendedArchiveDays,
    archivePath,
    selectedArchiveDay,
    selectedArchiveRecords,
    recentWeekDurationMs,
    recentWeekActiveDays,
    todoCompletionPercent,
    timerHasProgress,
    timerCanContinue,
    canFinish,
    showMessage,
    clearMessage,
    alertIsVisible,
    retryLoad,
    dismissTimerAlert,
    finishFocus,
    changeCompletionPreference,
    changeMode,
    startFocus,
    pauseFocus,
    resetFocus,
    addTodo,
    toggleTodo,
    beginEditTodo,
    patchEditingTodo,
    saveTodoEdit,
    cancelEditTodo,
    useTodoForFocus,
    removeTodo,
    removeRecord,
    beginEditRecord,
    beginDetailedRecordEdit,
    patchEditingRecordTitle,
    saveRecordEdit,
    cancelEditRecord,
    undoDelete,
    selectTheme,
    updateVisualIntensity,
    updateMotionIntensity,
    updateDensity,
    autoMiniOnStart,
    appPreferenceSaveError,
    appPreferenceSaveBusy,
    retryAppPreferencesSave,
    flushAppPreferencesSave,
    updateAutoMiniOnStart,
    currentTodo,
    todayPickTodos,
    focusPlan,
    setCurrentTodo,
    toggleTodayPick,
    startFocusForTodo,
    saveContinuationNote,
    createManualRecord,
    updateRecord,
    continuationPrompt,
    continuationSaveError,
    dismissContinuationPrompt: () => {
      setContinuationSaveError("");
      setContinuationPrompt(null);
    },
    quickCaptureOpen,
    quickCaptureTitle,
    setQuickCaptureTitle,
    openQuickCapture,
    closeQuickCapture,
    saveQuickCapture,
    manualRecordOpen,
    openManualRecord,
    closeManualRecord,
    saveTimerPreferences,
    previewAlertSound,
    chooseCustomAlertSound,
    clearCustomAlertSound,
    loadBackups,
    createBackup,
    openBackupFolder,
    restoreBackup,
    previewPortableBackup,
    exportPortableBackup,
    importPortableBackup,
    clearAllData,
    changeView,
    startNextTodo,
    openCommandPalette,
    closeCommandPalette,
    executePaletteCommand,
    paletteCommands,
    updateFloatingOpacity,
    showFloatingTodos,
    showFocusFloating,
    setCommandInput: (element: HTMLInputElement | undefined) => {
      commandInput = element;
    },
    setCommandTrigger: (element: HTMLButtonElement | undefined) => {
      commandTrigger = element;
    },
    setFloatingWorkspaceElement: (element: HTMLElement | undefined) => {
      floatingWorkspaceElement = element;
    },
  };
}
