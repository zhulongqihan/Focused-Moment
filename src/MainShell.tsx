import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  ChartNoAxesCombined,
  CircleDot,
  Clock3,
  LockKeyhole,
  LockKeyholeOpen,
  Maximize2,
  Minus,
  Settings,
  SlidersHorizontal,
  SquareCheck,
  X,
} from "lucide-solid";
import type {
  AnalyticsSnapshot,
  AlertSoundKey,
  BackupListItem,
  FeedbackKind,
  FocusRecord,
  TodoDraft,
  TodoImportance,
  TimerSnapshot,
  TimerPreferences,
  TodoItem,
} from "./lib/contracts";
import {
  acknowledgeTimerAlert,
  clearAppData,
  completeFocusSession,
  deleteFocusRecord,
  exportAppBackup,
  getAnalyticsSnapshot,
  getFocusRecords,
  getTimerPreferences,
  getTimerSnapshot,
  importAppBackup,
  listAppBackups,
  openAppBackupFolder,
  pauseTimer,
  resetTimer,
  restoreFocusRecord,
  setCountdownMinutes as configureCountdownMinutes,
  startTimer,
  switchTimerMode,
  updateTimerPreferences,
  updateFocusRecordTitle,
  updateTimerContext,
} from "./lib/timer";
import {
  createTodoItem,
  deleteTodoItem,
  getTodoItems,
  updateTodoItem,
  restoreTodoItem,
  toggleTodoItem,
} from "./lib/tasks";
import {
  closeMainWindow,
  flashMainWindowAttention,
  lockFocusFloating,
  lockFloatingTodos,
  minimizeMainWindow,
  restoreMainFromFloatingTodos,
  restoreMainFromFocusFloating,
  showFocusFloating,
  showFloatingTodos,
  startDraggingWindow,
  toggleMaximizeMainWindow,
  unlockFloatingTodos,
  unlockFocusFloating,
} from "./lib/window-controls";
import CommandPalette, { type PaletteCommand } from "./components/CommandPalette";
import ThemeSurface from "./components/ThemeSurface";
import { getTheme, implementedThemeId, type ThemeId } from "./lib/themes";
import "./App.css";

type AppView = "today" | "focus" | "todos" | "records" | "settings";
type TimerMode = "stopwatch" | "countdown";
type LoadState = "loading" | "ready" | "error";
type FloatingTab = "todos" | "timer";
type MotionIntensityMode = "off" | "subtle" | "full";
type UndoAction =
  | { kind: "todo"; item: TodoItem }
  | { kind: "record"; item: FocusRecord };

type TodoEditDraft = TodoDraft & { id: number };
type RecordEditDraft = { id: number; title: string };

function getWindowLabel() {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

const currentWindowLabel = getWindowLabel();
const isFloatingWindow = currentWindowLabel === "todo-float";
const isUnlockWindow = currentWindowLabel === "todo-unlock";
const isFocusFloatingWindow = currentWindowLabel === "focus-float";
const isFocusUnlockWindow = currentWindowLabel === "focus-unlock";

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
const viralQuoteAudioUrl = new URL("./assets/viral-quote-sample.mp3", import.meta.url).href;
const floatingOpacityKey = "focused-moment.floating-window.opacity";
const defaultFloatingOpacity = 100;
const minFloatingOpacity = 45;
const alertClaimKeyPrefix = "focused-moment.alert-claimed.";
const maxCustomAlertSoundBytes = 5 * 1024 * 1024;
const floatingWorkspaceSyncEvent = "floating-workspace-sync";
const themeStorageKey = "focused-moment.theme";
const visualIntensityKey = "focused-moment.visual-intensity";
const motionIntensityKey = "focused-moment.motion-intensity";
const densityKey = "focused-moment.density";

function readLocalStorageValue(key: string) {
  return readStoredLocalStorageValue(key) ?? "";
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
  const theme = getTheme(readLocalStorageValue(themeStorageKey));
  return theme.implemented ? theme.id : implementedThemeId;
}

function readDensity(): "roomy" | "compact" {
  return readLocalStorageValue(densityKey) === "compact" ? "compact" : "roomy";
}

function getMotionIntensityMode(value: number): MotionIntensityMode {
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

function playAlertSound(soundKey: AlertSoundKey) {
  if (soundKey === "custom") {
    const dataUrl = readLocalStorageValue(customAlertSoundDataKey);
    if (dataUrl) {
      const audio = new Audio(dataUrl);
      audio.volume = 0.85;
      void audio.play().catch(() => undefined);
      return;
    }
  }

  if (soundKey === "viral_quote") {
    const audio = new Audio(viralQuoteAudioUrl);
    audio.volume = 1;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      if (typeof SpeechSynthesisUtterance === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("你的胆子真是肥嘟嘟的");
      utterance.lang = "zh-CN";
      utterance.rate = 0.88;
      utterance.pitch = 1.08;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    });
    return;
  }

  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  const now = context.currentTime;
  const tones = soundKey === "bright_bell"
    ? [880, 1174, 1568]
    : soundKey === "deep_pulse"
      ? [220, 330]
      : [660, 880];
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.13;
    oscillator.type = soundKey === "deep_pulse" ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.38);
  });
  window.setTimeout(() => void context.close(), 900);
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "操作未完成，请重试。";
}

const calendarDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const recordDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function parseLocalDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDueDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) {
    return `截止 ${value}`;
  }

  const today = parseLocalDate(getToday());
  const difference = today
    ? Math.round((date.getTime() - today.getTime()) / 86_400_000)
    : null;
  if (difference === 0) {
    return "今天截止";
  }
  if (difference === 1) {
    return "明天截止";
  }
  if (difference !== null && difference < 0) {
    return `已逾期 · ${calendarDateFormatter.format(date)}`;
  }
  return `截止 ${calendarDateFormatter.format(date)}`;
}

function isOverdue(value: string) {
  const date = parseLocalDate(value);
  const today = parseLocalDate(getToday());
  return Boolean(date && today && date.getTime() < today.getTime());
}

function formatRecordDate(record: FocusRecord) {
  const date = new Date(record.completedAt);
  if (!Number.isNaN(date.getTime())) {
    return recordDateFormatter.format(date);
  }
  return `${record.completedDate} ${record.completedTime}`.trim();
}

function formatAnalyticsDate(value: string) {
  const date = parseLocalDate(value);
  return date ? calendarDateFormatter.format(date) : value;
}

function formatArchiveRangeDate(value: string) {
  const date = parseLocalDate(value);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : value;
}

function sortTodos(items: TodoItem[]) {
  const importanceRank: Record<TodoImportance, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return items.slice().sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) {
      return Number(left.isCompleted) - Number(right.isCompleted);
    }

    const leftHasTime = Boolean(left.scheduledTime.trim());
    const rightHasTime = Boolean(right.scheduledTime.trim());

    return (
      left.scheduledDate.localeCompare(right.scheduledDate) ||
      Number(rightHasTime) - Number(leftHasTime) ||
      left.scheduledTime.localeCompare(right.scheduledTime) ||
      importanceRank[left.importanceKey] - importanceRank[right.importanceKey] ||
      right.id - left.id
    );
  });
}

function formatTodoDue(item: TodoItem) {
  return `${formatDueDate(item.scheduledDate)}${item.scheduledTime ? ` · ${item.scheduledTime}` : ""}`;
}

function formatDurationMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function recordDateKey(record: FocusRecord) {
  if (record.completedDate.trim()) {
    return record.completedDate;
  }

  const dateMatch = record.completedAt.match(/^\d{4}-\d{2}-\d{2}/);
  return dateMatch?.[0] ?? "未记录日期";
}

function formatRecordDay(value: string) {
  if (value === "未记录日期") {
    return value;
  }

  const date = parseLocalDate(value);
  const today = parseLocalDate(getToday());
  const difference = date && today
    ? Math.round((date.getTime() - today.getTime()) / 86_400_000)
    : null;
  const dateLabel = formatAnalyticsDate(value);

  if (difference === 0) {
    return `今天 · ${dateLabel}`;
  }
  if (difference === -1) {
    return `昨天 · ${dateLabel}`;
  }
  return dateLabel;
}

interface RecordDayGroup {
  date: string;
  records: FocusRecord[];
  totalDurationMs: number;
}

function groupRecordsByDate(items: FocusRecord[]) {
  const groups = new Map<string, RecordDayGroup>();

  for (const record of items) {
    const date = recordDateKey(record);
    const current = groups.get(date);
    if (current) {
      current.records.push(record);
      current.totalDurationMs += record.durationMs;
    } else {
      groups.set(date, {
        date,
        records: [record],
        totalDurationMs: record.durationMs,
      });
    }
  }

  return Array.from(groups.values());
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecentTrendDays(items: AnalyticsSnapshot["dailyBreakdown"]) {
  const today = parseLocalDate(getToday());
  if (!today) {
    return items.slice(0, 7);
  }

  const byDate = new Map(items.map((day) => [day.date, day]));
  const days: AnalyticsSnapshot["dailyBreakdown"] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const dateKey = formatLocalDateKey(date);
    days.push(
      byDate.get(dateKey) ?? {
        date: dateKey,
        totalDurationMs: 0,
        totalDurationLabel: "00:00:00",
        sessionCount: 0,
        linkedSessionCount: 0,
        independentSessionCount: 0,
      }
    );
  }

  return days;
}

function mergeArchiveDays(days: AnalyticsSnapshot["dailyBreakdown"], items: FocusRecord[]) {
  const recordsByDate = new Map(
    groupRecordsByDate(items).map((group) => [group.date, group]),
  );

  return days.map((day) => {
    const group = recordsByDate.get(day.date);
    if (!group || group.records.length === 0 || day.sessionCount > 0 || day.totalDurationMs > 0) {
      return day;
    }

    const linkedSessionCount = group.records.filter((record) => record.linkedTodoId !== null).length;
    return {
      ...day,
      totalDurationMs: group.totalDurationMs,
      totalDurationLabel: formatDurationMs(group.totalDurationMs),
      sessionCount: group.records.length,
      linkedSessionCount,
      independentSessionCount: group.records.length - linkedSessionCount,
    };
  });
}

function createArchivePath(days: AnalyticsSnapshot["dailyBreakdown"]) {
  if (days.length === 0) {
    return "M 0 72";
  }

  const maxDuration = Math.max(1, ...days.map((day) => day.totalDurationMs));
  const points = days.map((day, index) => {
    const x = days.length === 1 ? 50 : 7 + (86 * index) / (days.length - 1);
    const intensity = day.totalDurationMs / maxDuration;
    return { x, y: 70 - intensity * 42 };
  });

  if (points.length === 1) {
    return `M 0 ${points[0].y + 18} C 20 ${points[0].y + 18}, 34 ${points[0].y}, ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x - 8} ${points[0].y + 8}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const distance = (current.x - previous.x) * 0.42;
    path += ` C ${previous.x + distance} ${previous.y}, ${current.x - distance} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function importanceLabel(value: TodoImportance) {
  return value === "high" ? "高" : value === "low" ? "低" : "中";
}

function MainShell() {
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
  const [todoTitle, setTodoTitle] = createSignal("");
  const [todoDueDate, setTodoDueDate] = createSignal(getToday());
  const [todoDueTime, setTodoDueTime] = createSignal("");
  const [todoImportance, setTodoImportance] = createSignal<TodoImportance>("medium");
  const [editingTodo, setEditingTodo] = createSignal<TodoEditDraft | null>(null);
  const [editingRecord, setEditingRecord] = createSignal<RecordEditDraft | null>(null);
  const [backups, setBackups] = createSignal<BackupListItem[]>([]);
  const [backupLoadState, setBackupLoadState] = createSignal<LoadState>("loading");
  const [backupLoadError, setBackupLoadError] = createSignal("");
  const [selectedBackupFile, setSelectedBackupFile] = createSignal("");
  const [lastBackupPath, setLastBackupPath] = createSignal("");
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
  const [themeId, setThemeId] = createSignal<ThemeId>(readThemeId());
  const [visualIntensity, setVisualIntensity] = createSignal(readPercentage(visualIntensityKey, 72));
  const [motionIntensity, setMotionIntensity] = createSignal(readPercentage(motionIntensityKey, 44));
  const [density, setDensity] = createSignal<"roomy" | "compact">(readDensity());
  let undoTimer: number | undefined;
  let commandInput: HTMLInputElement | undefined;
  let commandTrigger: HTMLButtonElement | undefined;
  let refreshVersion = 0;
  let timerRefreshVersion = 0;
  let observedAlertSequence: number | null = null;
  let floatingTimerWasAvailable = false;
  let floatingWorkspaceElement: HTMLElement | undefined;
  let floatingResizeFrame: number | undefined;

  const ready = () => loadState() === "ready";

  const pendingTodos = () => sortTodos(todos()).filter((item) => !item.isCompleted);
  const activeTodos = () => pendingTodos().filter((item) => !isOverdue(item.scheduledDate));
  const overdueTodos = () => pendingTodos().filter((item) => isOverdue(item.scheduledDate));
  const completedTodos = () => sortTodos(todos()).filter((item) => item.isCompleted);
  const todayTodos = () => pendingTodos().filter((item) => item.scheduledDate === getToday());
  const todayCompletedTodos = () =>
    completedTodos().filter((item) => item.scheduledDate === getToday());
  const nextTodo = () => pendingTodos()[0] ?? null;
  const selectedBackup = () => backups().find((backup) => backup.fileName === selectedBackupFile()) ?? null;
  const recentBreakdown = createMemo(() => getRecentTrendDays(analytics()?.dailyBreakdown ?? []));
  const recordGroups = createMemo(() => groupRecordsByDate(records()));
  const archiveDays = createMemo(() => mergeArchiveDays(recentBreakdown(), records()));
  const archivePath = createMemo(() => createArchivePath(archiveDays()));
  const selectedArchiveDay = createMemo(() =>
    archiveDays().find((day) => day.date === selectedArchiveDate()) ?? archiveDays()[archiveDays().length - 1] ?? null,
  );
  const selectedArchiveRecords = createMemo(() => {
    const selectedDate = selectedArchiveDay()?.date;
    return selectedDate ? records().filter((record) => recordDateKey(record) === selectedDate) : [];
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
  const timerHasProgress = () => timer().isRunning || timer().elapsedMs > 0;
  const timerCanContinue = () =>
    timerHasProgress() && !(timer().modeKey === "countdown" && timer().remainingMs === 0);
  const canFinish = () => timer().elapsedMs > 0 && timer().canCompleteSession;

  createEffect(() => {
    const days = archiveDays();
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
    { id: "backup", label: "导出本地备份", detail: "把当前待办、记录和运行态保存下来" },
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
    setMessage(text);
    setMessageKind(kind);
  }

  function clearMessage() {
    setMessage("");
    setMessageKind("info");
  }

  function selectTheme(nextThemeId: ThemeId) {
    const theme = getTheme(nextThemeId);
    if (!theme.implemented) {
      return;
    }
    setThemeId(theme.id);
  }

  function saveVisualSettings() {
    const settings = [
      [themeStorageKey, themeId()],
      [visualIntensityKey, String(visualIntensity())],
      [motionIntensityKey, String(motionIntensity())],
      [densityKey, density()],
    ] as const;
    const previousValues = settings.map(([key]) => [key, readStoredLocalStorageValue(key)] as const);
    let saved = true;

    for (const [key, value] of settings) {
      if (!writeLocalStorageValue(key, value)) {
        saved = false;
      }
    }

    if (!saved) {
      for (const [key, previousValue] of previousValues) {
        if (previousValue === null) {
          removeLocalStorageValue(key);
        } else {
          writeLocalStorageValue(key, previousValue);
        }
      }
      showMessage("外观预览已应用，但本地保存失败；重启后不会保留本次修改，请检查存储权限后重试。", "error");
      return;
    }

    showMessage("外观设置已保存，下次启动会继续使用。", "success");
  }

  function updateFloatingOpacity(value: number) {
    const nextValue = Math.min(defaultFloatingOpacity, Math.max(minFloatingOpacity, Math.round(value)));
    setFloatingOpacity(nextValue);
    writeLocalStorageValue(floatingOpacityKey, String(nextValue));
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
    if (next.isRunning || next.elapsedMs > 0 || next.recoveredFromLastSession) {
      setSavedConfirmation(false);
    }
    const hasCommittedContext =
      next.isRunning ||
      next.elapsedMs > 0 ||
      next.recoveredFromLastSession ||
      next.activeTaskTitle.trim().length > 0;

    if (next.isRunning || next.elapsedMs > 0 || next.recoveredFromLastSession) {
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
    const [nextTimer, nextTodos, nextRecords, nextAnalytics, nextPreferences] = await Promise.all([
      getTimerSnapshot(),
      getTodoItems(),
      getFocusRecords(),
      getAnalyticsSnapshot(),
      getTimerPreferences(),
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
      if (timer().modeKey === "stopwatch" || timer().modeKey === "countdown") {
        await showFocusFloating();
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
      applyTimerSnapshot(await resetTimer());
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
    if (!todoDueDate()) {
      showMessage("请填写截止日期。", "error");
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
    setEditingRecord({ id: record.id, title: record.title });
  }

  function patchEditingRecordTitle(title: string) {
    const current = editingRecord();
    if (current) {
      setEditingRecord({ ...current, title });
    }
  }

  function cancelEditRecord() {
    setEditingRecord(null);
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
      setRecords(await updateFocusRecordTitle(draft.id, title));
      setEditingRecord(null);
      showMessage("专注记录名称已更新。", "success");
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
    await run(async () => {
      setTimerPreferences(await updateTimerPreferences(nextPreferences));
      showMessage(successMessage, "success");
    }, "正在保存提醒设置…");
  }

  function previewAlertSound() {
    if (!timerPreferences().soundReminderEnabled) {
      showMessage("请先打开声音提醒，再试听音效。", "info");
      return;
    }
    playAlertSound(timerPreferences().alertSoundKey);
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
    if (!dataUrl || !writeLocalStorageValue(customAlertSoundDataKey, dataUrl)) {
      showMessage("音效保存失败，请换一个文件重试。", "error");
      return;
    }

    writeLocalStorageValue(customAlertSoundNameKey, file.name);
    setCustomAlertSoundName(file.name);
    await saveTimerPreferences({ alertSoundKey: "custom" }, "自定义音效已启用。");
  }

  async function clearCustomAlertSound() {
    removeLocalStorageValue(customAlertSoundDataKey);
    removeLocalStorageValue(customAlertSoundNameKey);
    setCustomAlertSoundName("");
    await saveTimerPreferences({ alertSoundKey: "soft_chime" }, "已恢复为柔和铃音。");
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
    setActiveView(view);
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
    queueMicrotask(() => commandTrigger?.focus());
  }

  function openCommandPalette() {
    setCommandPaletteOpen(true);
    setCommandSearch("");
  }

  function executePaletteCommand(commandId: string) {
    closeCommandPalette();
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
    setCustomAlertSoundName(readLocalStorageValue(customAlertSoundNameKey));
    if (isFloatingWindow || isUnlockWindow || isFocusFloatingWindow || isFocusUnlockWindow) {
      document.documentElement.classList.add("floating-window");
    }

    let interval: number | undefined;
    let floatingSyncActive = true;
    let floatingSyncUnlisten: (() => void) | undefined;
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

    if (!isUnlockWindow && !isFocusUnlockWindow) {
      void loadFromStorage().catch((error) => {
        showMessage(getErrorMessage(error), "error");
      });

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
        1000
      );
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
      if (undoTimer !== undefined) {
        window.clearTimeout(undoTimer);
      }
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("floating-window");
    });
  });

  if (isUnlockWindow) {
    return (
      <button
        type="button"
        class="floating-unlock"
        title="解除锁定，恢复待办操作"
        aria-label="解除锁定，恢复待办操作"
        onClick={() => void unlockFloatingTodos()}
      >
        <LockKeyholeOpen size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
    );
  }

  if (isFocusUnlockWindow) {
    return (
      <button
        type="button"
        class="floating-unlock"
        title="解除专注锁定，恢复计时操作"
        aria-label="解除专注锁定，恢复计时操作"
        onClick={() => void unlockFocusFloating()}
      >
        <LockKeyholeOpen size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
    );
  }

  if (isFocusFloatingWindow) {
    return (
      <aside class="focus-floating" aria-label="专注悬浮窗">
        <header class="focus-floating__header">
          <div
            class="floating-todo__drag-handle"
            data-tauri-drag-region
            onMouseDown={(event) => {
              if (event.button === 0) {
                void startDraggingWindow();
              }
            }}
          >
            <span>正在专注</span>
            <strong>{timer().activeTaskTitle || "未命名事项"}</strong>
          </div>
          <div class="floating-todo__actions">
            <button
              type="button"
              class="floating-lock-button"
              title="锁定并开启鼠标穿透"
              aria-label="锁定并开启鼠标穿透"
              onClick={() => void lockFocusFloating()}
            >
              <LockKeyhole size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-button"
              title="返回主窗口"
              onClick={() => void restoreMainFromFocusFloating()}
            >
              返回
            </button>
          </div>
        </header>
        <div class="focus-floating__clock">
          <span>{timer().status}</span>
          <strong>{timer().elapsedLabel}</strong>
        </div>
          <Show when={timer().alertTitle && timerPreferences().toastReminderEnabled}>
            <div class="floating-alert" role="alert">
              <strong>{timer().alertTitle}</strong>
              <span>{timer().alertMessage}</span>
              <Show
                when={timer().alertKey === "countdown_complete"}
                fallback={
                  <button
                    type="button"
                    class="text-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    知道了
                  </button>
                }
              >
                <div class="floating-alert__actions">
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !canFinish()}
                    onClick={() => void finishFocus()}
                  >
                    保存并记录
                  </button>
                  <button
                    type="button"
                    class="text-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    稍后处理
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        <Show when={timer().linkedTodoId !== null}>
          <label class="linked-todo-option linked-todo-option--floating">
            <input
              type="checkbox"
              name="completeLinkedTodoFloating"
              checked={timer().completeLinkedTodoOnFinish}
              disabled={busy()}
              onChange={(event) => void changeCompletionPreference(event.currentTarget.checked)}
            />
            <span>完成后标记待办</span>
          </label>
        </Show>
        <div class="focus-floating__controls">
          <Show
            when={timer().isRunning}
            fallback={
              <button
                type="button"
                class="primary-button"
                disabled={busy() || !timerCanContinue()}
                onClick={() => void startFocus()}
              >
                继续
              </button>
            }
          >
            <button
              type="button"
              class="secondary-button"
              disabled={busy()}
              onClick={() => void pauseFocus()}
            >
              暂停
            </button>
          </Show>
          <button
            type="button"
            class="primary-button"
            disabled={busy() || !canFinish()}
            onClick={() => void finishFocus()}
          >
            完成并记录
          </button>
        </div>
      </aside>
    );
  }

  if (isFloatingWindow) {
    return (
      <aside
        class="floating-todo"
        aria-label="桌面悬浮工作台"
        ref={(element) => {
          floatingWorkspaceElement = element;
        }}
        style={{ opacity: floatingOpacity() / 100 }}
      >
        <header class="floating-todo__header">
          <div
            class="floating-todo__drag-handle"
            data-tauri-drag-region
            onMouseDown={(event) => {
              if (event.button === 0) {
                void startDraggingWindow();
              }
            }}
          >
            <span>Focused Moment</span>
            <strong>悬浮工作台</strong>
          </div>
          <div class="floating-todo__actions">
            <button
              type="button"
              class="floating-lock-button"
              title="锁定并开启鼠标穿透"
              aria-label="锁定并开启鼠标穿透"
              onClick={() => void lockFloatingTodos()}
            >
              <LockKeyhole size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="floating-opacity-button"
              title="调整悬浮窗透明度"
              aria-label="调整悬浮窗透明度"
              aria-expanded={floatingOpacityPanelOpen()}
              aria-controls="floating-opacity-panel"
              onClick={() => setFloatingOpacityPanelOpen((open) => !open)}
            >
              <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-button"
              title="返回主窗口"
              onClick={() => void restoreMainFromFloatingTodos()}
            >
              返回
            </button>
          </div>
        </header>

        <Show when={floatingOpacityPanelOpen()}>
          <section id="floating-opacity-panel" class="floating-opacity-panel" role="dialog" aria-label="悬浮窗透明度">
            <div class="floating-opacity-panel__heading">
              <span>悬浮窗透明度</span>
              <strong>{floatingOpacity()}%</strong>
            </div>
            <label class="floating-opacity-panel__slider">
              <span class="sr-only">悬浮窗透明度</span>
              <input
                type="range"
                min={minFloatingOpacity}
                max={defaultFloatingOpacity}
                step="1"
                value={floatingOpacity()}
                aria-label="悬浮窗透明度"
                onInput={(event) => updateFloatingOpacity(Number(event.currentTarget.value))}
              />
            </label>
            <div class="floating-opacity-panel__scale" aria-hidden="true">
              <span>更透明</span>
              <span>更清晰</span>
            </div>
          </section>
        </Show>

        <nav class="floating-tabs" aria-label="悬浮内容">
          <button
            type="button"
            classList={{ "floating-tab": true, "floating-tab--active": floatingTab() === "todos" }}
            aria-selected={floatingTab() === "todos"}
            onClick={() => setFloatingTab("todos")}
          >
            待办
            <span>{pendingTodos().length}</span>
          </button>
          <Show when={timerHasProgress()}>
            <button
              type="button"
              classList={{ "floating-tab": true, "floating-tab--active": floatingTab() === "timer" }}
              aria-selected={floatingTab() === "timer"}
              onClick={() => setFloatingTab("timer")}
            >
              当前计时
              <span class="floating-tab__signal" aria-label={timer().isRunning ? "正在运行" : "已暂停"} />
            </button>
          </Show>
        </nav>

        <Show
          when={floatingTab() === "timer" && timerHasProgress()}
          fallback={
            <div class="floating-todo__list" role="tabpanel" aria-label="待办列表">
              <Show when={loadState() === "loading"}>
                <p class="floating-empty">正在读取待办…</p>
              </Show>
              <Show when={loadState() === "error"}>
                <div class="floating-empty floating-empty--error">
                  <p>读取失败</p>
                  <button type="button" class="text-button" onClick={() => void retryLoad()}>
                    重试
                  </button>
                </div>
              </Show>
              <Show when={ready() && pendingTodos().length > 0}>
                <For each={pendingTodos()}>
                  {(item) => (
                    <button
                      type="button"
                      class="floating-todo__item"
                      disabled={busy()}
                      onClick={() => void toggleTodo(item.id)}
                    >
                      <span class="floating-check" aria-hidden="true" />
                      <span class="floating-todo__copy">
                        <strong>{item.title}</strong>
                        <small>{formatTodoDue(item)}</small>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
              <Show when={ready() && pendingTodos().length === 0}>
                <p class="floating-empty">没有未完成的待办</p>
              </Show>
            </div>
          }
        >
          <section class="floating-timer" role="tabpanel" aria-label="当前正在的计时">
            <div class="floating-timer__identity">
              <span>当前专注</span>
              <strong>{timer().activeTaskTitle || "未命名事项"}</strong>
            </div>
            <div class="floating-timer__clock">
              <span>{timer().status}</span>
              <strong>{timer().elapsedLabel}</strong>
            </div>
            <Show when={timer().alertTitle && timerPreferences().toastReminderEnabled}>
              <div class="floating-alert" role="alert">
                <strong>{timer().alertTitle}</strong>
                <span>{timer().alertMessage}</span>
                <Show
                  when={timer().alertKey === "countdown_complete"}
                  fallback={
                    <button
                      type="button"
                      class="text-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      知道了
                    </button>
                  }
                >
                  <div class="floating-alert__actions">
                    <button
                      type="button"
                      class="primary-button"
                      disabled={busy() || !canFinish()}
                      onClick={() => void finishFocus()}
                    >
                      保存并记录
                    </button>
                    <button
                      type="button"
                      class="text-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      稍后处理
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={timer().linkedTodoId !== null}>
              <label class="linked-todo-option linked-todo-option--floating">
                <input
                  type="checkbox"
                  name="completeLinkedTodoFloating"
                  checked={timer().completeLinkedTodoOnFinish}
                  disabled={busy()}
                  onChange={(event) => void changeCompletionPreference(event.currentTarget.checked)}
                />
                <span>完成后标记待办</span>
              </label>
            </Show>
            <div class="focus-floating__controls">
              <Show
                when={timer().isRunning}
                fallback={
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !timerCanContinue()}
                    onClick={() => void startFocus()}
                  >
                    继续
                  </button>
                }
              >
                <button
                  type="button"
                  class="secondary-button"
                  disabled={busy()}
                  onClick={() => void pauseFocus()}
                >
                  暂停
                </button>
              </Show>
              <button
                type="button"
                class="primary-button"
                disabled={busy() || !canFinish()}
                onClick={() => void finishFocus()}
              >
                完成并记录
              </button>
            </div>
          </section>
        </Show>
      </aside>
    );
  }

  function handleMainWindowMouseDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, a")) {
      return;
    }

    void startDraggingWindow();
  }

  return (
    <div
      classList={{
        "minimal-app": true,
        "minimal-app--cinematic": true,
        "minimal-app--running": timer().isRunning,
        "minimal-app--paused": !timer().isRunning && timerHasProgress(),
        "minimal-app--break": timer().phaseKey === "break",
        "minimal-app--focus": activeView() === "focus",
        "minimal-app--todos": activeView() === "todos",
        "minimal-app--records": activeView() === "records",
        "minimal-app--settings": activeView() === "settings",
        "minimal-app--trail": activeView() === "today",
      }}
      data-theme={themeId()}
      data-density={density()}
      data-motion={getMotionIntensityMode(motionIntensity())}
      style={`--nv-visual-intensity: ${visualIntensity() / 100}; --nv-visual-opacity: ${0.55 + (visualIntensity() / 100) * 0.45}; --nv-motion-intensity: ${motionIntensity() / 100};`}
    >
      <a class="skip-link" href="#main-content">跳到主要内容</a>
      <header class="app-bar" onMouseDown={handleMainWindowMouseDown}>
        <div class="app-brand" data-tauri-drag-region>
          <span class="app-brand__mark" />
          <strong>Focused Moment</strong>
        </div>
        <div class="app-bar__actions">
          <button
            type="button"
            class="command-trigger"
            ref={(element) => (commandTrigger = element)}
            aria-keyshortcuts="Control+K Meta+K"
            aria-haspopup="dialog"
            aria-expanded={commandPaletteOpen()}
            aria-controls="command-palette-dialog"
            onClick={openCommandPalette}
          >
            命令 <kbd>Ctrl K</kbd>
          </button>
          <button
            type="button"
            class="quiet-button"
            disabled={busy()}
            onClick={() => void showFloatingTodos()}
          >
            悬浮工作台
          </button>
          <div class="window-controls" aria-label="窗口控制">
            <button
              type="button"
              class="window-control"
              aria-label="最小化窗口"
              title="最小化"
              onClick={() => void minimizeMainWindow()}
            >
              <Minus size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="window-control"
              aria-label="最大化或还原窗口"
              title="最大化 / 还原"
              onClick={() => void toggleMaximizeMainWindow()}
            >
              <Maximize2 size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="window-control window-control--close"
              aria-label="关闭窗口"
              title="关闭窗口（隐藏到托盘）"
              onClick={() => void closeMainWindow()}
            >
              <X size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

        <main id="main-content" class="minimal-workspace">
        <nav class="minimal-nav" aria-label="主导航">
          <div class="trail-nav__brand" data-tauri-drag-region aria-label="Focused Moment">
            <span class="trail-nav__logo" aria-hidden="true">
              <span class="trail-nav__logo-ring" />
              <span class="trail-nav__logo-dot" />
            </span>
            <strong>Focused</strong>
            <span>Moment</span>
          </div>
          <button
            type="button"
            classList={{ active: activeView() === "today" }}
            aria-current={activeView() === "today" ? "page" : undefined}
            onClick={() => changeView("today")}
          >
            <CircleDot class="trail-nav__icon trail-nav__icon--today" size={23} strokeWidth={1.7} aria-hidden="true" />
            今日
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "focus" }}
            aria-current={activeView() === "focus" ? "page" : undefined}
            onClick={() => changeView("focus")}
          >
            <Clock3 class="trail-nav__icon trail-nav__icon--focus" size={23} strokeWidth={1.7} aria-hidden="true" />
            计时
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "todos" }}
            aria-current={activeView() === "todos" ? "page" : undefined}
            onClick={() => changeView("todos")}
          >
            <SquareCheck class="trail-nav__icon trail-nav__icon--todos" size={23} strokeWidth={1.7} aria-hidden="true" />
            待办
            <span class="minimal-nav__count">{pendingTodos().length}</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "records" }}
            aria-current={activeView() === "records" ? "page" : undefined}
            onClick={() => changeView("records")}
          >
            <ChartNoAxesCombined class="trail-nav__icon trail-nav__icon--records" size={23} strokeWidth={1.7} aria-hidden="true" />
            记录
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "settings" }}
            aria-current={activeView() === "settings" ? "page" : undefined}
            onClick={() => changeView("settings")}
          >
            <Settings class="trail-nav__icon trail-nav__icon--settings" size={23} strokeWidth={1.7} aria-hidden="true" />
            设置
          </button>
        </nav>

        <section
          classList={{
            "minimal-content": true,
            "minimal-content--records": activeView() === "records",
          }}
          aria-busy={busy() || loadState() === "loading"}
        >
          <Show when={alertIsVisible()}>
            <div class="timer-alert timer-alert--global" role="alert">
              <div class="timer-alert__signal" aria-hidden="true">
                <span class="timer-alert__signal-dot" />
                <span>时间到</span>
              </div>
              <div class="timer-alert__copy">
                <strong>{timer().alertTitle}</strong>
                <p>{timer().alertMessage}</p>
              </div>
              <div class="timer-alert__actions">
                <Show
                  when={timer().alertKey === "countdown_complete"}
                  fallback={
                    <button
                      type="button"
                      class="secondary-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      知道了
                    </button>
                  }
                >
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !canFinish()}
                    onClick={() => void finishFocus()}
                  >
                    保存并记录
                  </button>
                  <button
                    type="button"
                    class="secondary-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    稍后处理
                  </button>
                </Show>
              </div>
            </div>
          </Show>
          <Show when={syncError()}>
            <div class="sync-error" role="status" aria-live="polite">
              <span>本地数据暂时没有刷新成功。</span>
              <button type="button" class="text-button" disabled={busy()} onClick={() => void retryLoad()}>
                重试
              </button>
            </div>
          </Show>
          <Show when={loadState() === "loading"}>
            <p class="load-copy">正在读取本地数据…</p>
          </Show>
          <Show when={loadState() === "error"}>
            <div class="load-error" role="alert">
              <strong>暂时无法读取本地数据</strong>
              <span>{loadError()}</span>
              <button type="button" class="secondary-button" disabled={busy()} onClick={() => void retryLoad()}>
                重试读取
              </button>
            </div>
          </Show>
          <ThemeSurface
            activeView={() => activeView()}
            themeId={() => themeId()}
            today={{
              todayDate: getToday(),
              todayLabel: formatAnalyticsDate(getToday()),
              timer: () => timer(),
              ready,
              busy,
              timerHasProgress,
              timerCanContinue,
              nextTodo,
              todayTodos,
              todayCompletedTodos,
              records: () => records(),
              analytics: () => analytics(),
              defaultFocusMinutes: () => timerPreferences().stopwatchReminderMinutes ?? timerPreferences().pomodoroFocusMinutes,
              formatTodoDue,
              importanceLabel,
              onPause: () => void pauseFocus(),
              onContinue: () => void startFocus(),
              onFinish: () => finishFocus(),
              onStartNext: () => void startNextTodo(),
              onOpenFocus: () => changeView("focus"),
              onOpenRecords: () => changeView("records"),
              onUseTodo: useTodoForFocus,
              onOpenTodos: () => changeView("todos"),
            }}
            focus={{
              timer: () => timer(),
              timerPreferences: () => timerPreferences(),
              todos: () => todos(),
              pendingTodos,
              ready,
              busy,
              timerHasProgress,
              timerCanContinue,
              canFinish,
              savedConfirmation,
              sessionTitle: () => sessionTitle(),
              linkedTodoId: () => linkedTodoId(),
              completeLinkedTodo: () => completeLinkedTodo(),
              countdownMinutes: () => countdownMinutes(),
              countdownDraftDirty: () => countdownDraftDirty(),
              busyLabel: () => busyLabel(),
              onSessionTitleChange: setSessionTitle,
              onSessionTitleDirty: () => setSessionTitleDirty(true),
              onLinkedTodoChange: setLinkedTodoId,
              onCompleteLinkedTodoChange: setCompleteLinkedTodo,
              onCountdownMinutesChange: setCountdownMinutes,
              onCountdownDraftDirty: () => setCountdownDraftDirty(true),
              onChangeMode: (mode) => void changeMode(mode),
              onStart: () => void startFocus(),
              onPause: () => void pauseFocus(),
              onFinish: () => void finishFocus(),
              onReset: () => void resetFocus(),
            }}
            todos={{
              todos: () => todos(),
              activeTodos,
              overdueTodos,
              completedTodos,
              timer: () => timer(),
              timerHasProgress,
              ready,
              busy,
              busyLabel: () => busyLabel(),
              todoTitle: () => todoTitle(),
              todoDueDate: () => todoDueDate(),
              todoDueTime: () => todoDueTime(),
              todoImportance: () => todoImportance(),
              editingTodo: () => editingTodo(),
              onTodoTitleChange: setTodoTitle,
              onTodoDueDateChange: setTodoDueDate,
              onTodoDueTimeChange: setTodoDueTime,
              onTodoImportanceChange: setTodoImportance,
              onAddTodo: () => void addTodo(),
              onToggle: (id) => void toggleTodo(id),
              onBeginEdit: beginEditTodo,
              onUseForFocus: useTodoForFocus,
              onRemove: (id) => void removeTodo(id),
              onPatch: patchEditingTodo,
              onSave: () => void saveTodoEdit(),
              onCancel: cancelEditTodo,
              formatTodoDue,
              importanceLabel,
            }}
            records={{
              analytics: () => analytics(),
              records: () => records(),
              archiveDays: () => archiveDays(),
              archivePath: () => archivePath(),
              selectedArchiveDate: () => selectedArchiveDate(),
              selectedArchiveDay: () => selectedArchiveDay(),
              selectedArchiveRecords: () => selectedArchiveRecords(),
              recordGroups: () => recordGroups(),
              ready,
              busy,
              editingRecord: () => editingRecord(),
              todoCompletionPercent,
              recentWeekActiveDays,
              recentWeekDurationMs,
              formatAnalyticsDate,
              formatArchiveRangeDate,
              formatRecordDate,
              formatRecordDay,
              formatDurationMs,
              onSelectDate: setSelectedArchiveDate,
              onBeginEdit: beginEditRecord,
              onPatchEdit: patchEditingRecordTitle,
              onSaveEdit: () => void saveRecordEdit(),
              onCancelEdit: cancelEditRecord,
              onRemove: (id) => void removeRecord(id),
            }}
            settings={{
              timerPreferences: () => timerPreferences(),
              busy,
              busyLabel: () => busyLabel(),
              customAlertSoundName: () => customAlertSoundName(),
              backups: () => backups(),
              backupLoadState: () => backupLoadState(),
              backupLoadError: () => backupLoadError(),
              selectedBackupFile: () => selectedBackupFile(),
              selectedBackup: () => selectedBackup(),
              lastBackupPath: () => lastBackupPath(),
              themeId: () => themeId(),
              visualIntensity: () => visualIntensity(),
              motionIntensity: () => motionIntensity(),
              density: () => density(),
              onThemeSelect: selectTheme,
              onVisualIntensityChange: setVisualIntensity,
              onMotionIntensityChange: setMotionIntensity,
              onDensityChange: setDensity,
              onSaveVisualSettings: saveVisualSettings,
              onSaveTimerPreferences: saveTimerPreferences,
              onPreviewAlertSound: previewAlertSound,
              onChooseCustomAlertSound: chooseCustomAlertSound,
              onClearCustomAlertSound: clearCustomAlertSound,
              onSelectedBackupFile: setSelectedBackupFile,
              onLoadBackups: loadBackups,
              onCreateBackup: createBackup,
              onOpenBackupFolder: () =>
                void run(async () => {
                  await openAppBackupFolder();
                  showMessage("已打开备份目录。", "success");
                }, "正在打开…"),
              onRestoreBackup: restoreBackup,
              onClearAllData: clearAllData,
            }}
          />

          <Show when={message()}>
            <p classList={{ "app-message": true, [`app-message--${messageKind()}`]: true }} role="status" aria-live="polite">
              {message()}
            </p>
          </Show>

          <Show when={undoAction()}>
            {(action) => (
              <div class="undo-bar" role="status" aria-live="polite">
                <span>已删除“{action().item.title}”</span>
                <button type="button" class="secondary-button" disabled={busy()} onClick={() => void undoDelete()}>
                  撤销
                </button>
              </div>
            )}
          </Show>
        </section>
        <CommandPalette
          open={commandPaletteOpen}
          search={commandSearch}
          commands={paletteCommands}
          inputRef={(element) => (commandInput = element)}
          onSearch={setCommandSearch}
          onClose={closeCommandPalette}
          onExecute={executePaletteCommand}
        />
      </main>
    </div>
  );
}

export default MainShell;
