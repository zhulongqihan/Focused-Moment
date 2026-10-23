import { batch, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { confirm, save } from "@tauri-apps/plugin-dialog";
import type {
  AppPreferences,
  AppPreferencesPatch,
  AppPreferencesView,
  AnalyticsSnapshot,
  AlertSoundKey,
  BackupListItem,
  BackupPreview,
  CustomAlertAudio,
  CustomAlertAudioMetadata,
  DataRevisions,
  FeedbackKind,
  FocusRecord,
  FocusPlanState,
  TodoDraft,
  TodoImportance,
  TimerSnapshot,
  TimerPreferences,
  TimerSyncSnapshot,
  SyncDomain,
  SyncSnapshot,
  TodoItem,
} from "../../lib/contracts";
import {
  acknowledgeTimerAlert,
  clearAppData,
  completeFocusSession,
  createManualFocusRecord,
  dataRevisionsChangedEvent,
  deleteFocusRecord,
  exportAppBackup,
  getCustomAlertAudio,
  getDataRevisions,
  getSyncSnapshot,
  getTimerSyncSnapshot,
  importAppBackup,
  listAppBackups,
  openAppBackupFolder,
  pauseTimer,
  previewAppBackupPath,
  exportAppBackupToPath,
  exportRecoveryMaterial as exportRecoveryMaterialToPath,
  importAppBackupPath,
  resetTimer,
  restoreFocusRecord,
  setCountdownMinutes as configureCountdownMinutes,
  startTimer,
  switchTimerMode,
  timerSyncSampleEvent,
  updateTimerPreferences,
  updateFocusRecord,
  updateAppPreferences,
  updateCustomAlertAudio,
  updateFocusPlan,
  updateTimerContext,
} from "../../lib/timer";
import { subscribeToLocalRevisionChanges } from "../../lib/revisioned-command";
import {
  createTodoItem,
  deleteTodoItem,
  updateTodoItem,
  restoreTodoItem,
  toggleTodoItem,
  acknowledgePendingBookmarkNotice,
  getPendingBookmarkNotices,
  saveContinuationBookmark,
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

const focusRecordFields = [
  "id",
  "title",
  "durationMs",
  "durationLabel",
  "modeKey",
  "modeLabel",
  "phaseLabel",
  "linkedTodoId",
  "linkedTodoTitle",
  "completedAt",
  "completedDate",
  "completedTime",
  "source",
  "timeBasis",
  "editedAt",
] as const satisfies readonly (keyof FocusRecord)[];

function focusRecordListsEqual(previous: FocusRecord[], next: FocusRecord[]) {
  return previous.length === next.length && previous.every((record, index) => {
    const candidate = next[index];
    return focusRecordFields.every((field) => record[field] === candidate[field]);
  });
}

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
type ContinuationPrompt = { recordId: number; todoId: number; title: string };
type ResetConfirmation = { sessionId: string; taskTitle: string; elapsedMs: number };
type ActionResult<T> = { status: "success"; value: T } | { status: "failed"; error: unknown } | { status: "busy" };
export type FollowUpTask = { id: string; message: string; retry: () => Promise<void> };
const allBusinessDomains: SyncDomain[] = [
  "todos",
  "records",
  "analytics",
  "appPreferences",
  "timerPreferences",
  "focusPlan",
];

const floatingBusinessDomains: SyncDomain[] = [
  "todos",
  "appPreferences",
  "timerPreferences",
  "focusPlan",
];

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
  sessionId: "",
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
const maxCustomAlertSoundBytes = 5 * 1024 * 1024;
const floatingWorkspaceSyncEvent = "floating-workspace-sync";
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

function playAlertSound(soundKey: AlertSoundKey, customSoundData: string | null = null) {
  if (soundKey === "custom") {
    const dataUrl = customSoundData;
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

function isRecoveryMaterialError(message: string) {
  return message.includes("事务")
    || message.includes("恢复保护状态")
    || message.includes("本地数据未加载");
}

export function useMainShellController() {
  const [activeView, setActiveView] = createSignal<AppView>("today");
  const [timer, setTimer] = createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [resetConfirmation, setResetConfirmation] = createSignal<ResetConfirmation | null>(null);
  const [savedConfirmation, setSavedConfirmation] = createSignal(false);
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  // Preserve unchanged history rows when a records revision invalidates them.
  const [records, setRecords] = createSignal<FocusRecord[]>([], { equals: focusRecordListsEqual });
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
  const [failedAppPreferenceSnapshot, setFailedAppPreferenceSnapshot] = createSignal<{
    snapshot: AppPreferences;
    patch: AppPreferencesPatch;
  } | null>(null);
  const [failedCustomAlertAudio, setFailedCustomAlertAudio] = createSignal<{ name: string; data: string | null } | null>(null);
  const [focusPlan, setFocusPlan] = createSignal<FocusPlanState>({ currentTodoId: null, todayPickIds: [] });
  const [continuationPrompt, setContinuationPrompt] = createSignal<ContinuationPrompt | null>(null);
  const [continuationSaveError, setContinuationSaveError] = createSignal("");
  let pendingBookmarkRefreshVersion = 0;
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
  const [recoveryBlockReason, setRecoveryBlockReason] = createSignal("");
  const recoveryMaterialAvailable = createMemo(() => Boolean(recoveryBlockReason()));
  const [syncError, setSyncError] = createSignal("");
  const [followUpTasks, setFollowUpTasks] = createSignal<FollowUpTask[]>([]);
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
  let customAlertAudioSaveVersion = 0;
  let appPreferenceSaveTimer: number | undefined;
  let pendingAppPreferenceSnapshot: AppPreferences | null = null;
  let pendingAppPreferencePatch: AppPreferencesPatch | null = null;
  let legacyPreferencesMigrationAttempted = false;
  const pendingSyncDomains = new Set<SyncDomain>();
  const forcedSyncDomains = new Set<SyncDomain>();
  let syncDrainPromise: Promise<void> | null = null;
  let syncRetryTimer: number | undefined;
  let syncRetryAttempt = 0;
  let calibrationPending = false;
  let observedRevisions: DataRevisions | null = null;
  let audioRevision = 0;
  let audioProcessId = 0;
  let timerSampleInFlight = false;
  let timerSampleSequence = 0;
  let timerProcessId = 0;
  let lastMainTimerSampleAt = Date.now();
  let lastLocalDay = getToday();
  let localRevisionUnsubscribe: (() => void) | undefined;
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

  function applyAppPreferencesView(next: AppPreferencesView) {
    setThemeId(normalizeThemeId(next.themeId));
    setVisualIntensity(next.visualIntensity);
    setMotionIntensity(next.motionIntensity);
    setDensity(next.density);
    setFloatingOpacity(next.floatingOpacity);
    setAutoMiniOnStart(next.autoMiniOnStart);
    setCustomAlertSoundName(next.customAlertSoundName);
  }

  function persistAppPreferences(snapshot: AppPreferences, patch: AppPreferencesPatch, version: number) {
    setAppPreferenceSaveBusy(true);
    void updateAppPreferences(patch)
      .then((saved) => {
        if (version !== appPreferenceSaveVersion) return;
        applyAppPreferencesView(saved);
        setAppPreferenceSaveError("");
        setFailedAppPreferenceSnapshot(null);
      })
      .catch((error) => {
        if (version !== appPreferenceSaveVersion) return;
        setFailedAppPreferenceSnapshot({ snapshot, patch });
        setAppPreferenceSaveError(`外观设置保存失败：${getErrorMessage(error)}`);
      })
      .finally(() => {
        if (version === appPreferenceSaveVersion) {
          setAppPreferenceSaveBusy(false);
        }
      });
  }

  function scheduleAppPreferencesSave(
    patch: Partial<Omit<AppPreferences, "customAlertSoundName" | "customAlertSoundData">>,
  ) {
    const next = { ...currentAppPreferences(), ...patch, schemaVersion: 3 };
    applyAppPreferences(next);
    pendingAppPreferenceSnapshot = next;
    pendingAppPreferencePatch = { ...pendingAppPreferencePatch, ...patch };
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
      const pendingPatch = pendingAppPreferencePatch;
      pendingAppPreferencePatch = null;
      if (pendingPatch) persistAppPreferences(next, pendingPatch, version);
    }, 200);
  }

  function flushAppPreferencesSave() {
    if (appPreferenceSaveTimer === undefined || !pendingAppPreferenceSnapshot || !pendingAppPreferencePatch) {
      return;
    }
    window.clearTimeout(appPreferenceSaveTimer);
    appPreferenceSaveTimer = undefined;
    const snapshot = pendingAppPreferenceSnapshot;
    const patch = pendingAppPreferencePatch;
    pendingAppPreferenceSnapshot = null;
    pendingAppPreferencePatch = null;
    appPreferenceSaveVersion += 1;
    persistAppPreferences(snapshot, patch, appPreferenceSaveVersion);
  }

  function retryAppPreferencesSave() {
    const failed = failedAppPreferenceSnapshot();
    if (failed) {
      scheduleAppPreferencesSave(failed.patch);
    }
    const failedAudio = failedCustomAlertAudio();
    if (failedAudio) void persistCustomAlertAudio(failedAudio.name, failedAudio.data);
  }

  async function persistCustomAlertAudio(name: string, data: string | null) {
    const version = ++customAlertAudioSaveVersion;
    setAppPreferenceSaveBusy(true);
    setAppPreferenceSaveError("");
    setFailedCustomAlertAudio(null);
    try {
      const saved: CustomAlertAudioMetadata = await updateCustomAlertAudio(name, data);
      if (version !== customAlertAudioSaveVersion) return;
      setCustomAlertSoundName(saved.name);
      setCustomAlertSoundData(data);
      setAppPreferenceSaveError("");
    } catch (error) {
      if (version !== customAlertAudioSaveVersion) return;
      setFailedCustomAlertAudio({ name, data });
      setAppPreferenceSaveError(`自定义音效保存失败：${getErrorMessage(error)}`);
    } finally {
      if (version === customAlertAudioSaveVersion) setAppPreferenceSaveBusy(false);
    }
  }

  async function migrateLegacyAppPreferences(next: AppPreferencesView) {
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
    const appearancePatch: AppPreferencesPatch = {};
    if (legacyValues[0] !== null && legacyTheme.implemented) appearancePatch.themeId = legacyTheme.id;
    if (legacyValues[1] !== null) appearancePatch.visualIntensity = legacyVisual;
    if (legacyValues[2] !== null) appearancePatch.motionIntensity = legacyMotion;
    if (legacyValues[3] !== null) appearancePatch.density = legacyDensity;
    if (legacyValues[4] !== null) appearancePatch.floatingOpacity = legacyOpacity;
    try {
      let saved = next;
      if (Object.keys(appearancePatch).length > 0) {
        saved = await updateAppPreferences(appearancePatch);
        applyAppPreferencesView(saved);
      }
      if (legacySoundData) {
        const savedAudio = await updateCustomAlertAudio(legacySoundName, legacySoundData);
        setCustomAlertSoundName(savedAudio.name);
        setCustomAlertSoundData(legacySoundData);
        saved = {
          ...saved,
          customAlertSoundName: savedAudio.name,
          hasCustomAlertSound: savedAudio.hasCustomAlertSound,
        };
      }
      [themeStorageKey, visualIntensityKey, motionIntensityKey, densityKey, floatingOpacityKey, customAlertSoundDataKey, customAlertSoundNameKey]
        .forEach(removeLocalStorageValue);
      writeLocalStorageValue("focused-moment.preferences-v3-migrated", "1");
      return saved;
    } catch (error) {
      if (Object.keys(appearancePatch).length > 0) {
        setFailedAppPreferenceSnapshot({ snapshot: currentAppPreferences(), patch: appearancePatch });
      }
      setAppPreferenceSaveError(`旧版外观设置迁移失败：${getErrorMessage(error)}`);
      return next;
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

  function alertIsVisible() {
    return Boolean(timer().alertTitle && timerPreferences().toastReminderEnabled);
  }

  function handleNewTimerAlert() {
    // The main WebView stays alive when hidden to the tray. It owns audible
    // reminders; sibling windows only render the shared alert state.
    if (currentWindowLabel !== "main") return;
    const nextSequence = timer().alertSequence;
    if (observedAlertSequence === null) {
      observedAlertSequence = nextSequence;
      return;
    }
    if (nextSequence <= observedAlertSequence || !timer().alertTitle) {
      return;
    }

    observedAlertSequence = nextSequence;
    if (timerPreferences().windowAttentionReminderEnabled) {
      void flashMainWindowAttention().catch(() => undefined);
    }
    if (timerPreferences().soundReminderEnabled) {
      playAlertSound(timerPreferences().alertSoundKey, customAlertSoundData());
    }
  }

  function domainsForCurrentWindow() {
    return currentWindowLabel === "main" ? allBusinessDomains : floatingBusinessDomains;
  }

  function isDomainBlocked(domain: SyncDomain, force: boolean) {
    if (force) return false;
    if (busy()) return true;
    if (domain === "todos" && editingTodo() !== null) return true;
    if (domain === "records" && editingRecord() !== null) return true;
    if (
      domain === "appPreferences" &&
      (pendingAppPreferenceSnapshot !== null || appPreferenceSaveBusy() || failedAppPreferenceSnapshot() !== null || failedCustomAlertAudio() !== null)
    ) return true;
    return false;
  }

  function pendingSyncIsBlocked() {
    return [...pendingSyncDomains].every((domain) =>
      isDomainBlocked(domain, forcedSyncDomains.has(domain)),
    );
  }

  function snapshotIsCurrentForDomain(domain: SyncDomain, revisions: DataRevisions) {
    const latest = observedRevisions;
    if (!latest || latest.processId !== revisions.processId) return false;
    if (domain === "todos" || domain === "analytics") {
      if (revisions.todoRevision < latest.todoRevision) return false;
    }
    if (domain === "records" || domain === "analytics") {
      if (revisions.recordRevision < latest.recordRevision) return false;
    }
    if (domain === "appPreferences" && revisions.appPreferencesRevision < latest.appPreferencesRevision) return false;
    if (domain === "timerPreferences" && revisions.timerPreferencesRevision < latest.timerPreferencesRevision) return false;
    if (domain === "focusPlan" && revisions.focusPlanRevision < latest.focusPlanRevision) return false;
    return true;
  }

  async function applySyncDomain(domain: SyncDomain, snapshot: SyncSnapshot) {
    if (domain === "todos" && snapshot.todos) setTodos(snapshot.todos);
    if (domain === "records" && snapshot.records) setRecords(snapshot.records);
    if (domain === "analytics" && snapshot.analytics) setAnalytics(snapshot.analytics);
    if (domain === "timerPreferences" && snapshot.timerPreferences) setTimerPreferences(snapshot.timerPreferences);
    if (domain === "focusPlan" && snapshot.focusPlan) setFocusPlan(snapshot.focusPlan);
    if (domain === "appPreferences" && snapshot.appPreferences) {
      let next = snapshot.appPreferences;
      if (!legacyPreferencesMigrationAttempted && currentWindowLabel === "main") {
        next = await migrateLegacyAppPreferences(next);
      }
      applyAppPreferencesView(next);
    }
  }

  function scheduleSyncRetry() {
    if (syncRetryTimer !== undefined) return;
    const delays = [1_000, 2_000, 5_000, 10_000, 30_000];
    const delay = delays[Math.min(syncRetryAttempt, delays.length - 1)];
    syncRetryAttempt += 1;
    syncRetryTimer = window.setTimeout(() => {
      syncRetryTimer = undefined;
      if (pendingSyncDomains.size > 0) {
        void requestBusinessSync([], false).catch(() => undefined);
      }
      if (calibrationPending) void calibrateDataRevisions();
      if (audioReadPending) {
        void requestCustomAlertAudioSync().catch(() => undefined);
      }
    }, delay);
  }

  function clearSyncRetryIfIdle() {
    if (pendingSyncDomains.size > 0 || calibrationPending || audioReadPending) return;
    if (syncRetryTimer !== undefined) {
      window.clearTimeout(syncRetryTimer);
      syncRetryTimer = undefined;
    }
    syncRetryAttempt = 0;
    setSyncError("");
  }

  function requestBusinessSync(domains: SyncDomain[], force = false): Promise<void> {
    for (const domain of domains) {
      if (!domainsForCurrentWindow().includes(domain)) continue;
      pendingSyncDomains.add(domain);
      if (force) forcedSyncDomains.add(domain);
    }
    if (syncDrainPromise) return syncDrainPromise;
    const eligible = [...pendingSyncDomains].some((domain) =>
      !isDomainBlocked(domain, forcedSyncDomains.has(domain)),
    );
    if (!eligible) return Promise.resolve();

    const task = (async () => {
      try {
        while (true) {
          const requested = [...pendingSyncDomains].filter((domain) =>
            !isDomainBlocked(domain, forcedSyncDomains.has(domain)),
          );
          if (requested.length === 0) break;
          const forced = new Set(requested.filter((domain) => forcedSyncDomains.has(domain)));
          for (const domain of requested) {
            pendingSyncDomains.delete(domain);
            forcedSyncDomains.delete(domain);
          }

          try {
            const snapshot = await getSyncSnapshot(requested, requested.includes("analytics"));
            handleObservedRevisions(snapshot.revisions, requested);
            for (const domain of requested) {
              if (!snapshotIsCurrentForDomain(domain, snapshot.revisions)) {
                pendingSyncDomains.add(domain);
                if (forced.has(domain)) forcedSyncDomains.add(domain);
                continue;
              }
              if (isDomainBlocked(domain, forced.has(domain))) {
                pendingSyncDomains.add(domain);
                if (forced.has(domain)) forcedSyncDomains.add(domain);
                continue;
              }
              await applySyncDomain(domain, snapshot);
            }
          } catch (error) {
            for (const domain of requested) {
              pendingSyncDomains.add(domain);
              if (forced.has(domain)) forcedSyncDomains.add(domain);
            }
            throw error;
          }
        }

        if (pendingSyncDomains.size === 0) {
          clearSyncRetryIfIdle();
          if (loadState() === "error" && !recoveryBlockReason()) {
            setLoadState("ready");
            setLoadError("");
          }
        }
      } catch (error) {
        const message = getErrorMessage(error);
        setSyncError(message);
        scheduleSyncRetry();
        throw error;
      } finally {
        syncDrainPromise = null;
      }
    })();
    syncDrainPromise = task;
    return task;
  }

  function mergeObservedRevisions(next: DataRevisions) {
    const previous = observedRevisions;
    if (!previous || previous.processId !== next.processId) {
      observedRevisions = { ...next };
      for (const domain of domainsForCurrentWindow()) pendingSyncDomains.add(domain);
      if (currentWindowLabel === "main") {
        audioRevision = 0;
        audioProcessId = 0;
        audioReadPending = true;
      }
      timerProcessId = 0;
      timerSampleSequence = 0;
      return { processChanged: true, todos: true, records: true, appPreferences: true, timerPreferences: true, focusPlan: true, timerOperation: true, audio: true };
    }

    const merged: DataRevisions = {
      processId: next.processId,
      todoRevision: Math.max(previous.todoRevision, next.todoRevision),
      recordRevision: Math.max(previous.recordRevision, next.recordRevision),
      appPreferencesRevision: Math.max(previous.appPreferencesRevision, next.appPreferencesRevision),
      timerPreferencesRevision: Math.max(previous.timerPreferencesRevision, next.timerPreferencesRevision),
      focusPlanRevision: Math.max(previous.focusPlanRevision, next.focusPlanRevision),
      audioRevision: Math.max(previous.audioRevision, next.audioRevision),
      timerOperationRevision: Math.max(previous.timerOperationRevision, next.timerOperationRevision),
    };
    observedRevisions = merged;
    const changed = {
      processChanged: false,
      todos: merged.todoRevision > previous.todoRevision,
      records: merged.recordRevision > previous.recordRevision,
      appPreferences: merged.appPreferencesRevision > previous.appPreferencesRevision,
      timerPreferences: merged.timerPreferencesRevision > previous.timerPreferencesRevision,
      focusPlan: merged.focusPlanRevision > previous.focusPlanRevision,
      audio: merged.audioRevision > previous.audioRevision,
      timerOperation: merged.timerOperationRevision > previous.timerOperationRevision,
    };
    const supportedDomains = domainsForCurrentWindow();
    if (changed.todos && supportedDomains.includes("todos")) pendingSyncDomains.add("todos");
    if (changed.records && supportedDomains.includes("records")) pendingSyncDomains.add("records");
    if ((changed.todos || changed.records) && supportedDomains.includes("analytics")) pendingSyncDomains.add("analytics");
    if (changed.appPreferences && supportedDomains.includes("appPreferences")) pendingSyncDomains.add("appPreferences");
    if (changed.timerPreferences && supportedDomains.includes("timerPreferences")) pendingSyncDomains.add("timerPreferences");
    if (changed.focusPlan && supportedDomains.includes("focusPlan")) pendingSyncDomains.add("focusPlan");
    return changed;
  }

  function handleObservedRevisions(next: DataRevisions, coveredDomains: SyncDomain[] = []) {
    const changed = mergeObservedRevisions(next);
    if (changed.processChanged) {
      for (const domain of coveredDomains) pendingSyncDomains.delete(domain);
    }
    if (changed.audio && currentWindowLabel === "main") {
      audioReadPending = true;
      void requestCustomAlertAudioSync().catch(() => undefined);
    }
    if (changed.timerOperation) {
      void refreshTimerSyncSnapshot(currentWindowLabel === "main").catch(() => undefined);
    }
    if ([...pendingSyncDomains].some((domain) => !isDomainBlocked(domain, forcedSyncDomains.has(domain)))) {
      void requestBusinessSync([], false).catch(() => undefined);
    }
  }

  let audioReadPending = false;
  let audioSyncPromise: Promise<void> | null = null;

  function requestCustomAlertAudioSync(): Promise<void> {
    if (currentWindowLabel !== "main") return Promise.resolve();
    audioReadPending = true;
    if (audioSyncPromise) return audioSyncPromise;
    const task = (async () => {
      try {
        while (audioReadPending) {
          audioReadPending = false;
          const next: CustomAlertAudio = await getCustomAlertAudio();
          const desired = observedRevisions;
          if (desired && (next.processId !== desired.processId || next.revision < desired.audioRevision)) {
            audioReadPending = true;
            break;
          }
          if (next.processId !== audioProcessId || next.revision >= audioRevision) {
            audioProcessId = next.processId;
            audioRevision = next.revision;
            setCustomAlertSoundName(next.name);
            setCustomAlertSoundData(next.data);
          }
        }
      } catch (error) {
        audioReadPending = true;
        setSyncError(getErrorMessage(error));
        scheduleSyncRetry();
        throw error;
      } finally {
        audioSyncPromise = null;
      }
      if (audioReadPending) {
        return requestCustomAlertAudioSync();
      }
      clearSyncRetryIfIdle();
    })();
    audioSyncPromise = task;
    return task;
  }

  function queueTimerSample(next: TimerSyncSnapshot, fromMain: boolean) {
    if (fromMain) lastMainTimerSampleAt = Date.now();
    if (timerProcessId !== next.processId) {
      timerProcessId = next.processId;
      timerSampleSequence = 0;
    }
    if (next.sampleSequence <= timerSampleSequence) return false;
    timerSampleSequence = next.sampleSequence;
    applyTimerSnapshot(next.timer);
    return true;
  }

  async function refreshTimerSyncSnapshot(broadcast: boolean) {
    if (timerSampleInFlight) return false;
    timerSampleInFlight = true;
    try {
      const next = await getTimerSyncSnapshot();
      queueTimerSample(next, broadcast && currentWindowLabel === "main");
      if (broadcast && currentWindowLabel === "main") {
        await emit(timerSyncSampleEvent, next);
      }
      return true;
    } catch (error) {
      setSyncError(getErrorMessage(error));
      return false;
    } finally {
      timerSampleInFlight = false;
    }
  }

  async function calibrateDataRevisions() {
    try {
      handleObservedRevisions(await getDataRevisions());
      calibrationPending = false;
      clearSyncRetryIfIdle();
    } catch (error) {
      calibrationPending = true;
      setSyncError(getErrorMessage(error));
      scheduleSyncRetry();
    }
  }

  async function loadFromStorage() {
    setLoadState("loading");
    setLoadError("");
    try {
      await requestBusinessSync(domainsForCurrentWindow(), true);
      await refreshTimerSyncSnapshot(currentWindowLabel === "main");
      if (currentWindowLabel === "main") {
        if (audioProcessId !== (observedRevisions?.processId ?? 0) || audioRevision < (observedRevisions?.audioRevision ?? 0)) {
          try {
          await requestCustomAlertAudioSync();
          } catch {
            // The main window remains usable while the separate audio read retries.
          }
        }
      }
      setLoadState("ready");
      setRecoveryBlockReason("");
    } catch (error) {
      const text = getErrorMessage(error);
      setLoadState("error");
      setLoadError(text);
      if (isRecoveryMaterialError(text)) setRecoveryBlockReason(text);
      throw error;
    }
  }

  async function retryLoad() {
    await run(async () => {
      await loadFromStorage();
      showMessage("数据已重新加载。", "success");
    }, "正在加载…");
  }

  async function run<T>(action: () => Promise<T>, actionLabel = "正在处理…"): Promise<ActionResult<T>> {
    if (busy()) {
      return { status: "busy" };
    }

    setBusy(true);
    setBusyLabel(actionLabel);
    clearMessage();
    try {
      const value = await action();
      return { status: "success", value };
    } catch (error) {
      const message = getErrorMessage(error);
      if (isRecoveryMaterialError(message)) setRecoveryBlockReason(message);
      showMessage(message, "error");
      return { status: "failed", error };
    } finally {
      setBusy(false);
      setBusyLabel("");
      if (pendingSyncDomains.size > 0) {
        void requestBusinessSync([], false).catch(() => undefined);
      }
      if (currentWindowLabel === "main") void refreshPendingBookmarkPrompt();
    }
  }

  async function exportRecoveryMaterialFile() {
    if (busy()) return;
    let selectedPath: string | null;
    try {
      selectedPath = await save({
        defaultPath: "focused-moment-recovery-material.json",
        filters: [{ name: "Focused Moment recovery material", extensions: ["json"] }],
      });
    } catch (error) {
      showMessage(`无法打开保存位置：${getErrorMessage(error)}`, "error");
      return;
    }
    if (!selectedPath) return;

    setBusy(true);
    setBusyLabel("正在导出恢复材料…");
    clearMessage();
    try {
      const destination = await exportRecoveryMaterialToPath(
        selectedPath,
        recoveryBlockReason(),
      );
      showMessage(`恢复材料已导出：${destination}`, "success");
    } catch (error) {
      showMessage(getErrorMessage(error), "error");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function followUp(id: string, message: string, action: () => Promise<void>) {
    try {
      await action();
      setFollowUpTasks((tasks) => tasks.filter((task) => task.id !== id));
    } catch {
      setFollowUpTasks((tasks) => [...tasks.filter((task) => task.id !== id), { id, message, retry: action }]);
    }
  }

  async function retryFollowUp(id: string) {
    const task = followUpTasks().find((item) => item.id === id);
    if (task) await run(() => followUp(task.id, task.message, task.retry), "正在重试后续步骤…");
  }

  async function refreshAnalyticsAfterSave() {
    await followUp("analytics", "记录已保存，统计暂未刷新。", async () => {
      await requestBusinessSync(["analytics"], true);
    });
  }

  async function refreshAfterReplacement() {
    // The old UI no longer describes the newly committed database. Do not
    // let the user edit stale rows while the replacement snapshot is pending.
    setLoadState("loading");
    await followUp("replacement", "数据替换已完成，界面暂未刷新。请重试读取，无需再次导入或清空。", async () => {
      await loadFromStorage();
      await loadBackups();
    });
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
        await followUp("open-mini", "计时已开始，迷你工作台暂未打开。", showFloatingTodos);
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

  async function performReset(sessionId: string) {
    const result = await run(async () => {
      const nextTimer = await resetTimer(sessionId);
      setCountdownDraftDirty(false);
      applyTimerSnapshot(nextTimer);
      setSavedConfirmation(false);
      setSessionTitle("");
      setSessionTitleDirty(false);
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      showMessage("本轮已重置，没有生成记录。", "info");
    }, "正在重置…");

    if (result.status === "failed") {
      try {
        const latest = await getTimerSyncSnapshot();
        queueTimerSample(latest, false);
        if (latest.timer.sessionId !== sessionId && resetConfirmation()?.sessionId === sessionId) {
          setResetConfirmation(null);
          showMessage("本轮已在其他窗口发生变化，请检查当前状态后重新操作。", "info");
        }
      } catch {
        // Preserve the failed action message and the confirmation for a retry.
      }
    }
    return result;
  }

  async function resetFocus() {
    const current = timer();
    if (current.hasUnsubmittedProgress) {
      setResetConfirmation({
        sessionId: current.sessionId,
        taskTitle: current.activeTaskTitle,
        elapsedMs: current.elapsedMs,
      });
      return;
    }
    await performReset(current.sessionId);
  }

  async function confirmResetFocus() {
    const pending = resetConfirmation();
    if (!pending || busy()) return;
    if (timer().sessionId !== pending.sessionId) {
      setResetConfirmation(null);
      showMessage("本轮已在其他窗口发生变化，请检查当前状态后重新操作。", "info");
      return;
    }
    const result = await performReset(pending.sessionId);
    if (result.status === "success") setResetConfirmation(null);
  }

  function cancelResetFocus() {
    if (!busy()) setResetConfirmation(null);
  }

  async function finishFocus() {
    await run(async () => {
      const title = isFloatingWindow || isFocusFloatingWindow
        ? timer().activeTaskTitle
        : activeTitle();
      const payload = await completeFocusSession(title);
      setRecords(payload.records);
      setTodos(payload.todoItems);
      applyTimerSnapshot(payload.timerSnapshot);
      setSavedConfirmation(true);
      setSessionTitle("");
      setSessionTitleDirty(false);
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      await refreshPendingBookmarkPrompt();
      await refreshAnalyticsAfterSave();
      if (isFloatingWindow) {
        await followUp("restore-main", "记录已保存，主窗口暂未恢复。", restoreMainFromFloatingTodos);
      } else if (isFocusFloatingWindow) {
        await followUp("restore-main", "记录已保存，主窗口暂未恢复。", restoreMainFromFocusFloating);
      }
      showMessage("已保存为一条专注记录。", "success");
    }, "正在保存…");
  }

  async function addTodo(): Promise<boolean> {
    const title = todoTitle().trim();
    if (!title) {
      showMessage("请填写待办事项。", "error");
      return false;
    }
    let added = false;
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
      added = true;
      showMessage("待办已添加。", "success");
    }, "正在添加…");
    return added;
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
      await requestBusinessSync(floatingBusinessDomains, true);
      setLoadState("ready");
      setLoadError("");
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
    batch(() => {
      beginEditRecord(record);
      setRecordEditDialogOpen(true);
    });
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
      setEditingRecord(null);
      setRecordEditDialogOpen(false);
      showMessage("专注记录已更新。", "success");
      await refreshAnalyticsAfterSave();
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

    void persistCustomAlertAudio(file.name, dataUrl);
    await saveTimerPreferences({ alertSoundKey: "custom" }, "自定义音效已启用。");
  }

  async function clearCustomAlertSound() {
    void persistCustomAlertAudio("", null);
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
    await run(async () => {
      // Use the supported async API; the legacy window.confirm bridge is not reliable.
      if (!(await confirm("导入备份会替换当前待办、记录和计时状态，是否继续？"))) return;
      const result = await importAppBackup(fileName);
      await refreshAfterReplacement();
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
    if (!path || !preview || preview.sourcePath !== path) {
      showMessage("请先预览一份有效备份，再导入。", "error");
      return;
    }
    const restoreAppPreferences = restorePortableAppPreferences();
    await run(async () => {
      if (!(await confirm("导入会替换当前待办、记录和计时状态，是否继续？"))) return;
      const result = await importAppBackupPath(path, { restoreAppPreferences });
      setPortableBackupPreview(null);
      await refreshAfterReplacement();
      showMessage(`已恢复 ${result.todoCount} 项待办和 ${result.focusRecordCount} 条记录${result.migratedFromFormatVersion ? "，并完成旧版迁移" : ""}。`, "success");
    }, "正在导入便携备份…");
  }

  async function clearAllData() {
    await run(async () => {
      if (!(await confirm("这会清空当前待办、专注记录和未完成计时，但不会删除备份。是否继续？"))) return;
      await clearAppData();
      await refreshAfterReplacement();
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
    return run(async () => {
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
    const result = await updateFocusPlanState({ ...focusPlan(), currentTodoId: item.id });
    if (result.status === "success") await startFocus();
  }

  async function refreshPendingBookmarkPrompt() {
    if (currentWindowLabel !== "main" || loadState() !== "ready") return;
    const requestVersion = ++pendingBookmarkRefreshVersion;
    try {
      const pending = await getPendingBookmarkNotices();
      if (requestVersion !== pendingBookmarkRefreshVersion) return;
      const next = pending[0];
      const current = continuationPrompt();
      setContinuationPrompt(next
        ? { recordId: next.recordId, todoId: next.todoId, title: next.title }
        : null);
      if (!next || current?.recordId !== next.recordId) setContinuationSaveError("");
    } catch (error) {
      if (requestVersion === pendingBookmarkRefreshVersion) {
        console.error("读取停笔书签提示失败。", error);
      }
    }
  }

  async function saveContinuationNote(todoId: number, recordId: number, note: string): Promise<boolean> {
    const normalized = note.trim();
    let saved = false;
    await run(async () => {
      setTodos(await saveContinuationBookmark(todoId, recordId, normalized));
      saved = true;
      setContinuationSaveError("");
      setContinuationPrompt(null);
      showMessage(normalized ? "停笔书签已保存。" : "已清空停笔书签。", "success");
      await refreshPendingBookmarkPrompt();
    }, "正在保存停笔书签…");
    if (!saved) {
      setContinuationSaveError("保存失败，请检查本地数据后点击“重试保存”。");
    }
    return saved;
  }

  async function skipContinuationPrompt() {
    const prompt = continuationPrompt();
    if (!prompt) return;
    await run(async () => {
      await acknowledgePendingBookmarkNotice(prompt.recordId);
      setContinuationPrompt(null);
      setContinuationSaveError("");
      await refreshPendingBookmarkPrompt();
    }, "正在略过停笔书签…");
  }

  async function createManualRecord(payload: {
    title: string;
    durationMinutes: number;
    completedDate: string;
    completedTime: string;
    linkedTodoId: number | null;
  }): Promise<boolean> {
    const result = await run(async () => {
      setRecords(await createManualFocusRecord(payload));
      closeManualRecord();
      showMessage("手动专注记录已补录。", "success");
      await refreshAnalyticsAfterSave();
    }, "正在补录专注…");
    return result.status === "success";
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
      setEditingRecord(null);
      showMessage("专注记录已修正。", "success");
      await refreshAnalyticsAfterSave();
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
    timer().alertSequence;
    handleNewTimerAlert();
  });

  createEffect(() => {
    if (pendingSyncDomains.size === 0) return;
    if (!pendingSyncIsBlocked()) {
      void requestBusinessSync([], false).catch(() => undefined);
    }
  });

  onMount(() => {
    if (isFloatingWindow || isUnlockWindow || isFocusFloatingWindow || isFocusUnlockWindow) {
      document.documentElement.classList.add("floating-window");
    }

    let timerInterval: number | undefined;
    let calibrationInterval: number | undefined;
    let localDayInterval: number | undefined;
    let floatingSyncActive = true;
    let floatingSyncUnlisten: (() => void) | undefined;
    let coreSyncActive = true;
    let dataRevisionUnlisten: (() => void) | undefined;
    let timerSampleUnlisten: (() => void) | undefined;
    let trayNavigationActive = true;
    let trayNavigationUnlisten: (() => void) | undefined;
    let bookmarkSyncActive = true;
    let pendingBookmarkUnlisten: (() => void) | undefined;
    let mainWindowShownUnlisten: (() => void) | undefined;
    const onMainWindowFocus = () => {
      if (currentWindowLabel === "main") void refreshPendingBookmarkPrompt();
      void calibrateDataRevisions();
    };
    const onMainWindowVisibility = () => {
      if (document.visibilityState === "visible") onMainWindowFocus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (modal && !commandPaletteOpen()) return;
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
        if (modal || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
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
        if (modal || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
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
      window.addEventListener("focus", onMainWindowFocus);
      document.addEventListener("visibilitychange", onMainWindowVisibility);
    }

    if (currentWindowLabel === "main") {
      void listen("pending-bookmark-notice", onMainWindowFocus)
        .then((unlisten) => {
          if (bookmarkSyncActive) {
            pendingBookmarkUnlisten = unlisten;
          } else {
            void unlisten();
          }
        })
        .catch(() => undefined);
      void listen("main-window-shown", onMainWindowFocus)
        .then((unlisten) => {
          if (bookmarkSyncActive) {
            mainWindowShownUnlisten = unlisten;
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
      localRevisionUnsubscribe = subscribeToLocalRevisionChanges(handleObservedRevisions);
      void (async () => {
        try {
          dataRevisionUnlisten = await listen<DataRevisions>(dataRevisionsChangedEvent, ({ payload }) => {
            handleObservedRevisions(payload);
            if (currentWindowLabel === "main") void refreshPendingBookmarkPrompt();
          });
        } catch (error) {
          setSyncError(`版本事件监听失败，将使用定时校准：${getErrorMessage(error)}`);
        }
        if ((isFloatingWindow || isFocusFloatingWindow) && coreSyncActive) {
          try {
            timerSampleUnlisten = await listen<TimerSyncSnapshot>(timerSyncSampleEvent, ({ payload }) => {
              queueTimerSample(payload, true);
            });
          } catch (error) {
            setSyncError(`计时同步监听失败，将使用轻量轮询：${getErrorMessage(error)}`);
          }
        }
        if (!coreSyncActive) {
          if (dataRevisionUnlisten) void dataRevisionUnlisten();
          if (timerSampleUnlisten) void timerSampleUnlisten();
          return;
        }

        void loadFromStorage()
          .then(() => refreshPendingBookmarkPrompt())
          .catch((error) => showMessage(getErrorMessage(error), "error"));

        if (currentWindowLabel === "main") {
          timerInterval = window.setInterval(() => {
            void refreshTimerSyncSnapshot(true);
          }, 1000);
          calibrationInterval = window.setInterval(() => {
            void calibrateDataRevisions();
          }, 30_000);
          localDayInterval = window.setInterval(() => {
            const nextDay = getToday();
            if (nextDay !== lastLocalDay) {
              lastLocalDay = nextDay;
              void requestBusinessSync(["analytics"], false).catch(() => undefined);
            }
          }, 15_000);
        } else {
          timerInterval = window.setInterval(() => {
            if (Date.now() - lastMainTimerSampleAt > 2500) {
              void refreshTimerSyncSnapshot(false);
            }
          }, 1000);
          calibrationInterval = window.setInterval(() => {
            void calibrateDataRevisions();
          }, 30_000);
        }
      })();
    }

    onCleanup(() => {
      coreSyncActive = false;
      if (timerInterval !== undefined) window.clearInterval(timerInterval);
      if (calibrationInterval !== undefined) window.clearInterval(calibrationInterval);
      if (localDayInterval !== undefined) window.clearInterval(localDayInterval);
      if (syncRetryTimer !== undefined) window.clearTimeout(syncRetryTimer);
      if (localRevisionUnsubscribe) localRevisionUnsubscribe();
      if (dataRevisionUnlisten) void dataRevisionUnlisten();
      if (timerSampleUnlisten) void timerSampleUnlisten();
      if (floatingResizeFrame !== undefined) {
        window.cancelAnimationFrame(floatingResizeFrame);
        floatingResizeFrame = undefined;
      }
      floatingSyncActive = false;
      if (floatingSyncUnlisten) {
        void floatingSyncUnlisten();
      }
      trayNavigationActive = false;
      if (trayNavigationUnlisten) {
        void trayNavigationUnlisten();
      }
      bookmarkSyncActive = false;
      if (pendingBookmarkUnlisten) void pendingBookmarkUnlisten();
      if (mainWindowShownUnlisten) void mainWindowShownUnlisten();
      if (undoTimer !== undefined) {
        window.clearTimeout(undoTimer);
      }
      if (messageTimer !== undefined) {
        window.clearTimeout(messageTimer);
      }
      flushAppPreferencesSave();
      window.removeEventListener("beforeunload", flushAppPreferencesSave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", onMainWindowFocus);
      document.removeEventListener("visibilitychange", onMainWindowVisibility);
      pendingBookmarkRefreshVersion += 1;
      document.documentElement.classList.remove("floating-window");
    });
  });

  return {
    activeView,
    setActiveView,
    timer,
    resetConfirmation,
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
    recoveryMaterialAvailable,
    syncError,
    followUpTasks,
    retryFollowUp,
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
    confirmResetFocus,
    cancelResetFocus,
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
    skipContinuationPrompt,
    createManualRecord,
    updateRecord,
    continuationPrompt,
    continuationSaveError,
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
    exportRecoveryMaterialFile,
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
    setFloatingWorkspaceElement: (element: HTMLElement | undefined) => {
      floatingWorkspaceElement = element;
    },
  };
}
