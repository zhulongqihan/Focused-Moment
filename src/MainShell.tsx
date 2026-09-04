import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { LockKeyhole, LockKeyholeOpen, SlidersHorizontal } from "lucide-solid";
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
  quitApplication,
  restoreMainFromFloatingTodos,
  restoreMainFromFocusFloating,
  showFocusFloating,
  showFloatingTodos,
  startDraggingWindow,
  unlockFloatingTodos,
  unlockFocusFloating,
} from "./lib/window-controls";
import CommandPalette, { type PaletteCommand } from "./components/CommandPalette";
import TodayDashboard from "./components/TodayDashboard";
import { copyLibrarySize, getCopyAttribution, getCopyDisplayText, getCopyOriginalText, getDailyCopy } from "./lib/copy-library";
import "./App.css";

type AppView = "today" | "focus" | "todos" | "records" | "settings";
type TimerMode = "stopwatch" | "countdown";
type LoadState = "loading" | "ready" | "error";
type FloatingTab = "todos" | "timer";
type UndoAction =
  | { kind: "todo"; item: TodoItem }
  | { kind: "record"; item: FocusRecord };

type TodoEditDraft = TodoDraft & { id: number };
type RecordEditDraft = { id: number; title: string };

interface TodoRowProps {
  item: TodoItem;
  editingTodo: () => TodoEditDraft | null;
  busy: () => boolean;
  timerHasProgress: () => boolean;
  onToggle: (id: number) => void;
  onBeginEdit: (item: TodoItem) => void;
  onUseForFocus: (item: TodoItem) => void;
  onRemove: (id: number) => void;
  onPatch: (patch: Partial<TodoEditDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TodoRow(props: TodoRowProps) {
  return (
    <article classList={{ "todo-row": true, "todo-row--overdue": isOverdue(props.item.scheduledDate) }}>
      <Show
        when={props.editingTodo()?.id === props.item.id}
        fallback={
          <>
            <button
              type="button"
              class="todo-check"
              title="标记完成"
              aria-label={`标记“${props.item.title}”完成`}
              disabled={props.busy()}
              onClick={() => props.onToggle(props.item.id)}
            />
            <div>
              <strong title={props.item.title}>{props.item.title}</strong>
              <small>
                {formatTodoDue(props.item)} · 重要程度：{importanceLabel(props.item.importanceKey)}
                <Show when={isOverdue(props.item.scheduledDate)}>
                  <span class="todo-row__overdue-label">已过期</span>
                </Show>
              </small>
            </div>
            <div class="todo-row__actions">
              <button
                type="button"
                class="row-action"
                disabled={props.busy()}
                onClick={() => props.onBeginEdit(props.item)}
              >
                编辑
              </button>
              <button
                type="button"
                class="row-action"
                disabled={props.busy() || props.timerHasProgress()}
                onClick={() => props.onUseForFocus(props.item)}
              >
                专注
              </button>
              <button
                type="button"
                class="row-action row-action--danger"
                title="删除待办"
                disabled={props.busy()}
                onClick={() => props.onRemove(props.item.id)}
              >
                删除
              </button>
            </div>
          </>
        }
      >
        <div class="todo-edit-form">
          <label>
            <span>待办事项</span>
            <input
              type="text"
              name={`editTodoTitle-${props.item.id}`}
              autocomplete="off"
              value={props.editingTodo()?.title ?? ""}
              onInput={(event) => props.onPatch({ title: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>截止日期</span>
            <input
              type="date"
              name={`editTodoDate-${props.item.id}`}
              autocomplete="off"
              value={props.editingTodo()?.scheduledDate ?? ""}
              onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>时间</span>
            <input
              type="time"
              name={`editTodoTime-${props.item.id}`}
              autocomplete="off"
              value={props.editingTodo()?.scheduledTime ?? ""}
              onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>重要程度</span>
            <select
              name={`editTodoImportance-${props.item.id}`}
              value={props.editingTodo()?.importanceKey ?? "medium"}
              onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <div class="todo-edit-form__actions">
            <button type="button" class="primary-button" disabled={props.busy()} onClick={props.onSave}>
              保存
            </button>
            <button type="button" class="text-button" disabled={props.busy()} onClick={props.onCancel}>
              取消
            </button>
          </div>
        </div>
      </Show>
    </article>
  );
}

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
const floatingOpacityKey = "focused-moment.floating-window.opacity";
const defaultFloatingOpacity = 100;
const minFloatingOpacity = 45;
const alertClaimKeyPrefix = "focused-moment.alert-claimed.";
const maxCustomAlertSoundBytes = 5 * 1024 * 1024;
const floatingWorkspaceSyncEvent = "floating-workspace-sync";

function readLocalStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
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
    return true;
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
    if (typeof SpeechSynthesisUtterance !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("你的胆子真是肥嘟嘟的");
      utterance.lang = "zh-CN";
      utterance.rate = 0.88;
      utterance.pitch = 1.08;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
      return;
    }
    soundKey = "bright_bell";
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
const backupDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
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

function formatBackupDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : backupDateFormatter.format(date);
}

function formatAnalyticsDate(value: string) {
  const date = parseLocalDate(value);
  return date ? calendarDateFormatter.format(date) : value;
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

function formatCountdownPreview(minutes: number) {
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(minutes) ? minutes : 0) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, remainingMinutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
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

function importanceLabel(value: TodoImportance) {
  return value === "high" ? "高" : value === "low" ? "低" : "中";
}

function MainShell() {
  const [activeView, setActiveView] = createSignal<AppView>("today");
  const [timer, setTimer] = createSignal<TimerSnapshot>(emptyTimerSnapshot);
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
  let undoTimer: number | undefined;
  let commandInput: HTMLInputElement | undefined;
  let commandTrigger: HTMLButtonElement | undefined;
  let refreshVersion = 0;
  let observedAlertSequence: number | null = null;
  let customAlertSoundInput: HTMLInputElement | undefined;
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
  const dailyCopy = createMemo(() => getDailyCopy(getToday()));
  const recordGroups = createMemo(() => groupRecordsByDate(records()));
  const recentWeekDurationMs = () =>
    recentBreakdown().reduce((total, day) => total + day.totalDurationMs, 0);
  const recentWeekActiveDays = () =>
    recentBreakdown().filter((day) => day.totalDurationMs > 0).length;
  const totalTodoCount = () =>
    (analytics()?.completedTodoCount ?? 0) + (analytics()?.pendingTodoCount ?? 0);
  const todoCompletionPercent = () => {
    const total = totalTodoCount();
    return total === 0 ? 0 : Math.round(((analytics()?.completedTodoCount ?? 0) / total) * 100);
  };
  const maxDailyDuration = () =>
    Math.max(1, ...recentBreakdown().map((day) => day.totalDurationMs));
  const selectedTodo = () =>
    todos().find((item) => item.id === linkedTodoId() && !item.isCompleted) ?? null;
  const activeTitle = () =>
    sessionTitle().trim() || selectedTodo()?.title || timer().activeTaskTitle.trim() || "未命名事项";
  const timerHasProgress = () => timer().isRunning || timer().elapsedMs > 0;
  const timerCanContinue = () =>
    timerHasProgress() && !(timer().modeKey === "countdown" && timer().remainingMs === 0);
  const canFinish = () => timer().elapsedMs > 0 && timer().canCompleteSession;
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
  }

  async function refresh(force = false) {
    const requestVersion = ++refreshVersion;
    const [nextTimer, nextTodos, nextRecords, nextAnalytics, nextPreferences] = await Promise.all([
      getTimerSnapshot(),
      getTodoItems(),
      getFocusRecords(),
      getAnalyticsSnapshot(),
      getTimerPreferences(),
    ]);

    if (
      requestVersion !== refreshVersion ||
      (!force && (busy() || editingTodo() !== null || editingRecord() !== null))
    ) {
      return false;
    }

    applyTimerSnapshot(nextTimer);
    setTodos(nextTodos);
    setRecords(nextRecords);
    setAnalytics(nextAnalytics);
    if (nextPreferences) {
      setTimerPreferences(nextPreferences);
    }
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

  function handleRecordEditKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveRecordEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditRecord();
    }
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
    setActiveView("focus");
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
          if (busy() || editingTodo() !== null || editingRecord() !== null) {
            return;
          }

          const hadSyncError = Boolean(syncError());
          void refresh()
            .then((refreshed) => {
              if (!refreshed) {
                return;
              }
              setLoadState("ready");
              setLoadError("");
              setSyncError("");
              if (messageKind() === "error") {
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
        "minimal-app--running": timer().isRunning,
        "minimal-app--paused": !timer().isRunning && timerHasProgress(),
        "minimal-app--break": timer().phaseKey === "break",
        "minimal-app--records": activeView() === "records",
      }}
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
          <button
            type="button"
            class="icon-button"
            title="最小化"
            onClick={() => void minimizeMainWindow()}
          >
            最小化
          </button>
          <button
            type="button"
            class="icon-button"
            title="隐藏到托盘"
            onClick={() => void closeMainWindow()}
          >
            隐藏
          </button>
          <button
            type="button"
            class="icon-button icon-button--danger"
            title="退出"
            onClick={() => void quitApplication()}
          >
            退出
          </button>
        </div>
      </header>

        <main id="main-content" class="minimal-workspace">
        <nav class="minimal-nav" aria-label="主导航">
          <button
            type="button"
            classList={{ active: activeView() === "today" }}
            aria-current={activeView() === "today" ? "page" : undefined}
            onClick={() => changeView("today")}
          >
            今日
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "focus" }}
            aria-current={activeView() === "focus" ? "page" : undefined}
            onClick={() => changeView("focus")}
          >
            计时
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "todos" }}
            aria-current={activeView() === "todos" ? "page" : undefined}
            onClick={() => changeView("todos")}
          >
            待办
            <span>{pendingTodos().length}</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "records" }}
            aria-current={activeView() === "records" ? "page" : undefined}
            onClick={() => changeView("records")}
          >
            记录
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "settings" }}
            aria-current={activeView() === "settings" ? "page" : undefined}
            onClick={() => changeView("settings")}
          >
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
          <Show when={activeView() === "today"}>
            <TodayDashboard
              todayLabel={formatAnalyticsDate(getToday())}
              timer={() => timer()}
              ready={ready}
              busy={busy}
              timerHasProgress={timerHasProgress}
              timerCanContinue={timerCanContinue}
              nextTodo={nextTodo}
              todayTodos={todayTodos}
              todayCompletedTodos={todayCompletedTodos}
              analytics={() => analytics()}
              formatTodoDue={formatTodoDue}
              importanceLabel={importanceLabel}
              onPause={() => void pauseFocus()}
              onContinue={() => void startFocus()}
              onFinish={() => void finishFocus()}
              onStartNext={() => void startNextTodo()}
              onOpenFocus={() => changeView("focus")}
              onUseTodo={useTodoForFocus}
              onOpenTodos={() => changeView("todos")}
            />
          </Show>
          <Show when={activeView() === "focus"}>
            <section class="focus-page">
              <div class="page-heading">
                <span>专注</span>
                <h1>现在只做一件事</h1>
              </div>

              <Show when={timer().recoveredFromLastSession}>
                <div class="recovery-banner" role="status">
                  <strong>已恢复上一轮专注</strong>
                  <span>当前计时和事项仍然保留，可以继续、完成记录或重置。</span>
                </div>
              </Show>

              <div class="mode-switcher">
                <button
                  type="button"
                  classList={{ active: timer().modeKey === "stopwatch" }}
                  aria-pressed={timer().modeKey === "stopwatch"}
                  disabled={busy() || !ready() || timerHasProgress()}
                  onClick={() => void changeMode("stopwatch")}
                >
                  正向计时
                </button>
                <button
                  type="button"
                  classList={{ active: timer().modeKey === "countdown" }}
                  aria-pressed={timer().modeKey === "countdown"}
                  disabled={busy() || !ready() || timerHasProgress()}
                  onClick={() => void changeMode("countdown")}
                >
                  倒计时
                </button>
              </div>

              <Show when={timer().modeKey === "countdown"}>
                <label class="inline-field countdown-field">
                  <span>专注时长</span>
                  <input
                    type="number"
                    name="countdownMinutes"
                    min="1"
                    max="720"
                    value={countdownMinutes()}
                    disabled={busy() || !ready() || timerHasProgress()}
                    onInput={(event) => {
                      setCountdownDraftDirty(true);
                      setCountdownMinutes(Number(event.currentTarget.value || 0));
                    }}
                  />
                  <em>分钟</em>
                </label>
              </Show>

              <div class="session-form">
                <label>
                  <span>这一轮要做什么</span>
                  <input
                    type="text"
                    name="sessionTitle"
                    autocomplete="off"
                    value={sessionTitle()}
                    placeholder="例如：完成项目方案…"
                    disabled={busy() || !ready() || timerHasProgress()}
                    onInput={(event) => {
                      setSessionTitleDirty(true);
                      setSessionTitle(event.currentTarget.value);
                    }}
                  />
                </label>
                <label>
                  <span>关联待办（可选）</span>
                  <select
                    name="linkedTodoId"
                    value={linkedTodoId() ?? ""}
                    disabled={busy() || !ready() || timerHasProgress()}
                    onChange={(event) => {
                      const id = event.currentTarget.value
                        ? Number(event.currentTarget.value)
                        : null;
                      const item = todos().find((todo) => todo.id === id);
                      setLinkedTodoId(id);
                      setSessionTitleDirty(true);
                      if (item) {
                        setSessionTitle(item.title);
                      }
                    }}
                  >
                    <option value="">不关联待办</option>
                    <For each={pendingTodos()}>
                      {(item) => <option value={item.id}>{item.title}</option>}
                    </For>
                  </select>
                </label>
              </div>

              <Show when={linkedTodoId() !== null}>
                <label class="linked-todo-option">
                  <input
                    type="checkbox"
                    name="completeLinkedTodo"
                    checked={completeLinkedTodo()}
                    disabled={busy() || !ready() || timerHasProgress()}
                    onChange={(event) => setCompleteLinkedTodo(event.currentTarget.checked)}
                  />
                  <span>本轮完成后同时标记关联待办</span>
                </label>
              </Show>

              <div class="timer-readout">
                <span>{timer().status}</span>
                <strong>
                  {timer().modeKey === "countdown" && countdownDraftDirty()
                    ? formatCountdownPreview(countdownMinutes())
                    : timer().elapsedLabel}
                </strong>
                <small>
                  {timer().modeKey === "countdown"
                    ? `设定 ${countdownMinutes()} 分钟`
                    : timer().targetDurationMs !== null
                      ? `下一阶段目标：${Math.round(timer().targetDurationMs! / 60_000)} 分钟`
                      : "阶段目标已完成"}
                </small>
              </div>

              <div class="timer-controls">
                <button
                  type="button"
                  class="primary-button"
                  disabled={busy() || !ready() || timer().isRunning || (timer().modeKey === "countdown" && timer().remainingMs === 0)}
                  onClick={() => void startFocus()}
                >
                  {busy() && !timer().isRunning ? busyLabel() : "开始"}
                </button>
                <button
                  type="button"
                  class="secondary-button"
                  disabled={busy() || !timer().isRunning}
                  onClick={() => void pauseFocus()}
                >
                  {busy() && timer().isRunning ? busyLabel() : "暂停"}
                </button>
                <button
                  type="button"
                  class="secondary-button"
                  disabled={busy() || !canFinish()}
                  onClick={() => void finishFocus()}
                >
                  {busy() && canFinish() ? busyLabel() : "完成并记录"}
                </button>
                <button
                  type="button"
                  class="text-button"
                  disabled={busy() || !timerHasProgress()}
                  onClick={() => void resetFocus()}
                >
                  重置
                </button>
              </div>
            </section>
          </Show>

          <Show when={activeView() === "todos"}>
            <section class="todo-page">
              <div class="page-heading">
                <span>待办</span>
                <h1>写下要完成的事</h1>
              </div>

              <div class="todo-create">
                <label>
                  <span>待办事项</span>
                  <input
                    type="text"
                    name="todoTitle"
                    autocomplete="off"
                    value={todoTitle()}
                    placeholder="例如：完成项目方案…"
                    onInput={(event) => setTodoTitle(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addTodo();
                      }
                    }}
                  />
                </label>
                <label>
                  <span>截止日期</span>
                  <input
                    type="date"
                    name="todoDueDate"
                    autocomplete="off"
                    value={todoDueDate()}
                    onChange={(event) => setTodoDueDate(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>时间（可选）</span>
                  <input
                    type="time"
                    name="todoDueTime"
                    autocomplete="off"
                    value={todoDueTime()}
                    onInput={(event) => setTodoDueTime(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>重要程度</span>
                  <select
                    name="todoImportance"
                    value={todoImportance()}
                    onChange={(event) => setTodoImportance(event.currentTarget.value as TodoImportance)}
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </label>
                <button
                  type="button"
                  class="primary-button"
                  disabled={busy()}
                  onClick={() => void addTodo()}
                >
                  {busy() ? busyLabel() : "添加"}
                </button>
              </div>

              <div class="todo-list">
                <Show when={loadState() === "loading"}>
                  <p class="load-copy">正在读取待办…</p>
                </Show>
                <Show when={loadState() === "error"}>
                  <p class="empty-copy">读取失败，请点击上方“重试读取”。</p>
                </Show>
                <Show when={ready()}>
                  <For each={activeTodos()}>
                    {(item) => (
                      <TodoRow
                        item={item}
                        editingTodo={editingTodo}
                        busy={busy}
                        timerHasProgress={timerHasProgress}
                        onToggle={(id) => void toggleTodo(id)}
                        onBeginEdit={beginEditTodo}
                        onUseForFocus={useTodoForFocus}
                        onRemove={(id) => void removeTodo(id)}
                        onPatch={patchEditingTodo}
                        onSave={() => void saveTodoEdit()}
                        onCancel={cancelEditTodo}
                      />
                    )}
                  </For>
                </Show>
                <Show when={ready() && activeTodos().length === 0 && overdueTodos().length === 0}>
                  <p class="empty-copy">还没有待办，先写下今天要完成的一件事。</p>
                </Show>
              </div>

              <Show when={ready() && overdueTodos().length > 0}>
                <section class="todo-status-section todo-status-section--overdue" aria-labelledby="overdue-todos-heading">
                  <div class="todo-status-section__heading">
                    <div>
                      <h2 id="overdue-todos-heading">已过期</h2>
                      <span>截止日期已过去，仍可编辑或标记完成</span>
                    </div>
                    <strong>{overdueTodos().length}</strong>
                  </div>
                  <For each={overdueTodos()}>
                    {(item) => (
                      <TodoRow
                        item={item}
                        editingTodo={editingTodo}
                        busy={busy}
                        timerHasProgress={timerHasProgress}
                        onToggle={(id) => void toggleTodo(id)}
                        onBeginEdit={beginEditTodo}
                        onUseForFocus={useTodoForFocus}
                        onRemove={(id) => void removeTodo(id)}
                        onPatch={patchEditingTodo}
                        onSave={() => void saveTodoEdit()}
                        onCancel={cancelEditTodo}
                      />
                    )}
                  </For>
                </section>
              </Show>

              <Show when={completedTodos().length > 0}>
                <section class="completed-section">
                  <span>已完成</span>
                  <For each={completedTodos()}>
                    {(item) => (
                      <div class="completed-row">
                        <span class="completed-row__marker" aria-hidden="true">✓</span>
                        <button
                          type="button"
                          class="completed-row__title"
                          disabled={busy()}
                          onClick={() => void toggleTodo(item.id)}
                        >
                          {item.title}
                        </button>
                        <span class="completed-row__label">已完成</span>
                        <button
                          type="button"
                          class="row-action"
                          disabled={busy()}
                          onClick={() => void toggleTodo(item.id)}
                        >
                          恢复
                        </button>
                        <button
                          type="button"
                          class="row-action row-action--danger"
                          disabled={busy()}
                          onClick={() => void removeTodo(item.id)}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </For>
                </section>
              </Show>
            </section>
          </Show>

          <Show when={activeView() === "settings"}>
            <section class="settings-page">
              <div class="page-heading">
                <span>设置</span>
                <h1>数据留在你手里</h1>
              </div>

              <section class="settings-section reminder-settings">
                <div class="settings-section__heading">
                  <h2>结束提醒</h2>
                  <p>倒计时结束、番茄钟阶段切换或正向计时达到目标时，用更明显的方式把你叫回来。</p>
                </div>
                <div class="reminder-options">
                  <label class="reminder-option">
                    <input
                      type="checkbox"
                      name="toastReminderEnabled"
                      checked={timerPreferences().toastReminderEnabled}
                      disabled={busy()}
                      onChange={(event) => void saveTimerPreferences({ toastReminderEnabled: event.currentTarget.checked })}
                    />
                    <span>
                      <strong>应用内弹窗</strong>
                      <small>无论当前在哪个页面，时间到都会显示醒目提醒。</small>
                    </span>
                  </label>
                  <label class="reminder-option">
                    <input
                      type="checkbox"
                      name="windowAttentionReminderEnabled"
                      checked={timerPreferences().windowAttentionReminderEnabled}
                      disabled={busy()}
                      onChange={(event) => void saveTimerPreferences({ windowAttentionReminderEnabled: event.currentTarget.checked })}
                    />
                    <span>
                      <strong>任务栏闪烁</strong>
                      <small>应用在后台时，让 Windows 任务栏图标短暂闪烁。</small>
                    </span>
                  </label>
                  <label class="reminder-option">
                    <input
                      type="checkbox"
                      name="soundReminderEnabled"
                      checked={timerPreferences().soundReminderEnabled}
                      disabled={busy()}
                      onChange={(event) => void saveTimerPreferences({ soundReminderEnabled: event.currentTarget.checked })}
                    />
                    <span>
                      <strong>声音提醒</strong>
                      <small>播放一次短促音效；浏览器或系统静音时会自动安静处理。</small>
                    </span>
                  </label>
                </div>
                <div class="sound-picker">
                  <label class="settings-select">
                    <span>提醒音效</span>
                    <select
                      name="alertSoundKey"
                      value={timerPreferences().alertSoundKey}
                      disabled={busy()}
                      onChange={(event) => void saveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}
                    >
                      <option value="soft_chime">柔和铃音</option>
                      <option value="bright_bell">明亮三连</option>
                      <option value="deep_pulse">沉稳脉冲</option>
                      <option value="viral_quote">胆子真是肥嘟嘟的（系统语音）</option>
                      <option value="custom" disabled={!customAlertSoundName()}>自定义音效{customAlertSoundName() ? ` · ${customAlertSoundName()}` : " · 请先导入"}</option>
                    </select>
                  </label>
                  <div class="sound-picker__actions">
                    <button type="button" class="secondary-button" disabled={busy()} onClick={previewAlertSound}>
                      试听
                    </button>
                    <button type="button" class="secondary-button" disabled={busy()} onClick={() => customAlertSoundInput?.click()}>
                      导入音效
                    </button>
                    <Show when={customAlertSoundName()}>
                      <button type="button" class="text-button" disabled={busy()} onClick={() => void clearCustomAlertSound()}>
                        移除自定义
                      </button>
                    </Show>
                    <input
                      ref={(element) => (customAlertSoundInput = element)}
                      class="sr-only"
                      type="file"
                      accept="audio/*"
                      aria-label="导入自定义音效"
                      onChange={(event) => void chooseCustomAlertSound(event)}
                    />
                  </div>
                </div>
              </section>

              <section class="settings-section">
                <div class="settings-section__heading">
                  <h2>本地备份</h2>
                  <p>备份包含待办、专注记录和当前未完成的计时状态，只保存在这台电脑上。</p>
                </div>
                <div class="settings-actions">
                  <button type="button" class="primary-button" disabled={busy()} onClick={() => void createBackup()}>
                    {busy() ? busyLabel() : "导出备份"}
                  </button>
                  <button
                    type="button"
                    class="secondary-button"
                    disabled={busy()}
                    onClick={() => void run(async () => {
                      await openAppBackupFolder();
                      showMessage("已打开备份目录。", "success");
                    }, "正在打开…")}
                  >
                    打开备份目录
                  </button>
                </div>
                <Show when={lastBackupPath()}>
                  <p class="settings-path">最近备份：{lastBackupPath()}</p>
                </Show>
              </section>

              <section class="settings-section">
                <div class="settings-section__heading">
                  <h2>恢复备份</h2>
                  <p>导入会替换当前数据。应用会先自动保存一份回滚备份。</p>
                </div>
                <Show when={backupLoadState() === "loading"}>
                  <p class="load-copy">正在读取备份列表…</p>
                </Show>
                <Show when={backupLoadState() === "error"}>
                  <div class="load-error">
                    <strong>备份列表读取失败</strong>
                    <span>{backupLoadError()}</span>
                    <button type="button" class="secondary-button" disabled={busy()} onClick={() => void loadBackups()}>
                      重试读取
                    </button>
                  </div>
                </Show>
                <Show when={backupLoadState() === "ready" && backups().length > 0}>
                  <label class="settings-select">
                    <span>选择备份</span>
                    <select
                      name="backupFile"
                      value={selectedBackupFile()}
                      disabled={busy()}
                      onChange={(event) => setSelectedBackupFile(event.currentTarget.value)}
                    >
                      <For each={backups()}>
                        {(backup) => (
                          <option value={backup.fileName}>
                            {formatBackupDate(backup.exportedAt)} · {backup.todoCount} 项待办 · {backup.focusRecordCount} 条记录{backup.migrationNeeded ? " · 旧版" : ""}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                  <Show when={selectedBackup()}>
                    {(backup) => (
                      <div class="backup-preview" aria-label="备份摘要">
                        <div>
                          <span>备份版本</span>
                          <strong>{backup().migrationNeeded ? "v1 · 导入时自动升级" : `v${backup().schemaVersion}`}</strong>
                        </div>
                        <div>
                          <span>数据内容</span>
                          <strong>{backup().todoCount} 项待办 · {backup().focusRecordCount} 条记录</strong>
                        </div>
                        <div>
                          <span>运行中会话</span>
                          <strong>{backup().hasRuntimeSession ? "包含" : "不包含"}</strong>
                        </div>
                      </div>
                    )}
                  </Show>
                  <button type="button" class="secondary-button" disabled={busy() || !selectedBackupFile()} onClick={() => void restoreBackup()}>
                    导入并替换当前数据
                  </button>
                </Show>
                <Show when={backupLoadState() === "ready" && backups().length === 0}>
                  <p class="empty-copy">还没有备份。建议在更换电脑或清理数据前先导出一份。</p>
                </Show>
              </section>

              <section class="settings-section settings-section--danger">
                <div class="settings-section__heading">
                  <h2>清空当前数据</h2>
                  <p>只清空当前待办、记录和未完成计时，不会删除已经导出的备份。</p>
                </div>
                <button type="button" class="secondary-button" disabled={busy()} onClick={() => void clearAllData()}>
                  清空当前数据
                </button>
              </section>
            </section>
          </Show>

          <Show when={activeView() === "records"}>
            <section class="records-page">
              <header class="records-page__masthead">
                <div>
                  <span class="records-page__eyebrow">RECORDS / PERSONAL ARCHIVE</span>
                  <h1>看见自己留下的节奏</h1>
                  <p>每一次回到这里，都会在时间里留下一个清晰的坐标。</p>
                </div>
                <div class="records-page__counter" aria-label={`共 ${records().length} 条专注记录`}>
                  <span>LOCAL LOG</span>
                  <strong>{String(records().length).padStart(2, "0")}</strong>
                  <small>条专注记录</small>
                </div>
              </header>
              <Show when={analytics()}>
                {(summary) => (
                  <>
                    <section class="records-hero" aria-label="专注成就">
                      <div class="records-hero__grid" aria-hidden="true" />
                      <div class="records-hero__main">
                        <span class="records-hero__eyebrow">
                          <span class="records-hero__pulse" aria-hidden="true" />
                          CURRENT STREAK / 当前连续
                        </span>
                        <div class="records-hero__streak">
                          <strong>{summary().currentStreakDays}</strong>
                          <span>天<br />连续投入</span>
                        </div>
                        <p>
                          {summary().currentStreakDays > 0
                            ? "你已经把专注变成了会回来的节奏。今天，再为这条轨迹添上一笔。"
                            : "今天还没有新的投入。先完成一小段，让这条轨迹重新亮起来。"}
                        </p>
                        <div class="records-hero__week">
                          <div>
                            <span>本周节奏</span>
                            <strong>{recentWeekActiveDays()} / 7 天</strong>
                          </div>
                          <div class="records-hero__week-meter" aria-hidden="true">
                            <span style={{ width: `${Math.round((recentWeekActiveDays() / 7) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                      <div class="records-hero__dial" aria-label={`已完成 ${summary().sessionCount} 轮专注`}>
                        <div class="records-hero__dial-ring records-hero__dial-ring--outer" />
                        <div class="records-hero__dial-ring records-hero__dial-ring--inner" />
                        <div class="records-hero__dial-core">
                          <span>FOCUS LOG</span>
                          <strong>{summary().sessionCount}</strong>
                          <small>次专注记录</small>
                        </div>
                        <i class="records-hero__dial-marker" aria-hidden="true" />
                      </div>
                      <div class="records-hero__letter">
                        <span class="records-hero__letter-label">TODAY / 今日一句</span>
                        <strong>“{getCopyDisplayText(dailyCopy())}”</strong>
                        <Show when={getCopyOriginalText(dailyCopy())}>
                          <small class="records-hero__letter-original">{getCopyOriginalText(dailyCopy())}</small>
                        </Show>
                        <small class="records-hero__letter-source">{getCopyAttribution(dailyCopy())} · {copyLibrarySize} 条本地语料</small>
                        <div class="records-hero__best">
                          <span>BEST DAY / 最佳单日</span>
                          <strong>{summary().bestFocusDate ? formatAnalyticsDate(summary().bestFocusDate!) : "还没有记录"}</strong>
                          <small>{summary().bestFocusDurationLabel ?? "完成一轮后，这里会出现你的最高投入。"}</small>
                        </div>
                      </div>
                    </section>
                    <section class="records-stats" aria-label="专注概览">
                      <div>
                        <span>今天留下</span>
                        <strong>{summary().todayFocusDurationLabel}</strong>
                        <small>{summary().todaySessionCount} 轮</small>
                      </div>
                      <div>
                        <span>累计时间</span>
                        <strong>{summary().totalFocusDurationLabel}</strong>
                        <small>{summary().sessionCount} 轮记录</small>
                      </div>
                      <div>
                        <span>回来的日子</span>
                        <strong>{summary().activeDays}</strong>
                        <small>平均每天 {summary().averageDailyDurationLabel}</small>
                      </div>
                      <div class="records-stats__progress">
                        <div class="records-stats__progress-heading">
                          <span>待办完成轨迹</span>
                          <strong>{todoCompletionPercent()}%</strong>
                        </div>
                        <div class="records-progress" aria-hidden="true">
                          <span style={{ width: `${todoCompletionPercent()}%` }} />
                        </div>
                        <small>
                          {summary().completedTodoCount} 已完成 · {summary().pendingTodoCount} 待处理
                        </small>
                      </div>
                    </section>
                    <section class="records-trajectory" aria-label="专注轨迹">
                      <div class="records-trajectory__heading">
                        <div>
                          <span>RETURN / KEEP GOING</span>
                          <h2>你的节奏正在成形</h2>
                        </div>
                        <p>不需要一次走很远，只要继续回来。</p>
                      </div>
                      <div class="records-trajectory__rail">
                        <div class="records-trajectory__rail-line" aria-hidden="true">
                          <span style={{ width: `${Math.round((recentWeekActiveDays() / 7) * 100)}%` }} />
                          <i style={{ left: `${Math.round((recentWeekActiveDays() / 7) * 100)}%` }} />
                        </div>
                        <div class="records-trajectory__rail-labels">
                          <span>本周开始</span>
                          <strong>{recentWeekActiveDays()} 天有投入</strong>
                          <span>今天</span>
                        </div>
                      </div>
                      <div class="records-trajectory__side">
                        <strong>{summary().averageDailyDurationLabel}</strong>
                        <span>平均每个活跃日</span>
                      </div>
                    </section>
                  </>
                )}
              </Show>
              <Show when={recentBreakdown().length > 0}>
                <section class="records-trend" aria-label="最近七天专注趋势">
                  <div class="records-trend__heading">
                    <div>
                      <h2>最近 7 天的节奏</h2>
                      <span>
                        {recentWeekActiveDays()} 天有投入 · 共 {formatDurationMs(recentWeekDurationMs())}
                      </span>
                    </div>
                    <span class="records-trend__hint">每个节点都是你回来过的证据</span>
                  </div>
                  <div class="records-chart">
                    <For each={recentBreakdown()}>
                      {(day) => (
                        <div
                          class="records-chart__item"
                          title={`${formatAnalyticsDate(day.date)} · ${day.totalDurationLabel}`}
                        >
                          <div class="records-chart__bar-area">
                            <span
                              classList={{ "records-chart__bar": true, "records-chart__bar--empty": day.totalDurationMs === 0 }}
                              style={{ height: `${Math.max(8, (day.totalDurationMs / maxDailyDuration()) * 100)}%` }}
                            />
                          </div>
                          <strong>{day.totalDurationLabel}</strong>
                          <small>{formatAnalyticsDate(day.date)}</small>
                          <span class="sr-only">
                            {formatAnalyticsDate(day.date)}，专注 {day.totalDurationLabel}，{day.sessionCount} 轮
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>
              <section class="record-history" aria-label="专注记录">
                <div class="record-history__heading">
                  <div>
                    <h2>全部记录</h2>
                    <span>按日期收纳，想回看时再展开</span>
                  </div>
                  <strong>{records().length} 轮</strong>
                </div>
                <div class="record-list">
                  <Show when={loadState() === "loading"}>
                    <p class="load-copy">正在读取专注记录…</p>
                  </Show>
                  <Show when={loadState() === "error"}>
                    <p class="empty-copy">读取失败，请点击上方“重试读取”。</p>
                  </Show>
                  <Show when={ready() && records().length > 0}>
                    <For each={recordGroups()}>
                      {(group, groupIndex) => (
                        <details class="record-day" open={groupIndex() === 0}>
                          <summary class="record-day__summary">
                            <span class="record-day__date">
                              <strong>{formatRecordDay(group.date)}</strong>
                              <small>{group.records.length} 轮 · {formatDurationMs(group.totalDurationMs)}</small>
                            </span>
                            <span class="record-day__chevron" aria-hidden="true">⌄</span>
                          </summary>
                          <div class="record-day__items">
                            <For each={group.records}>
                              {(record) => (
                                <article class="record-row">
                                  <Show
                                    when={editingRecord()?.id === record.id}
                                    fallback={
                                      <>
                                        <div class="record-row__details">
                                          <div class="record-row__title-line">
                                            <strong title={record.title}>{record.title}</strong>
                                            <span class="record-row__mode">{record.modeLabel}</span>
                                          </div>
                                          <small>{formatRecordDate(record)}</small>
                                        </div>
                                        <b>{record.durationLabel}</b>
                                        <div class="record-row__actions">
                                          <button
                                            type="button"
                                            class="row-action"
                                            aria-label={`编辑记录“${record.title}”`}
                                            disabled={busy()}
                                            onClick={() => beginEditRecord(record)}
                                          >
                                            编辑
                                          </button>
                                          <button
                                            type="button"
                                            class="row-action row-action--danger"
                                            aria-label={`删除记录“${record.title}”`}
                                            disabled={busy()}
                                            onClick={() => void removeRecord(record.id)}
                                          >
                                            删除
                                          </button>
                                        </div>
                                      </>
                                    }
                                  >
                                    <div class="record-row__details record-row__details--editing">
                                      <label class="sr-only" for={`editRecordTitle-${record.id}`}>
                                        记录名称
                                      </label>
                                      <input
                                        id={`editRecordTitle-${record.id}`}
                                        type="text"
                                        name={`editRecordTitle-${record.id}`}
                                        autocomplete="off"
                                        maxlength="200"
                                        autofocus
                                        aria-label="记录名称"
                                        value={editingRecord()?.title ?? ""}
                                        onInput={(event) => patchEditingRecordTitle(event.currentTarget.value)}
                                        onKeyDown={handleRecordEditKeyDown}
                                      />
                                      <small>{formatRecordDate(record)}</small>
                                    </div>
                                    <b>{record.durationLabel}</b>
                                    <div class="record-row__actions">
                                      <button
                                        type="button"
                                        class="primary-button"
                                        disabled={busy()}
                                        onClick={() => void saveRecordEdit()}
                                      >
                                        保存
                                      </button>
                                      <button
                                        type="button"
                                        class="text-button"
                                        disabled={busy()}
                                        onClick={cancelEditRecord}
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </Show>
                                </article>
                              )}
                            </For>
                          </div>
                        </details>
                      )}
                    </For>
                  </Show>
                  <Show when={ready() && records().length === 0}>
                    <p class="empty-copy">完成一次计时后，记录会显示在这里。</p>
                  </Show>
                </div>
              </section>
            </section>
          </Show>

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
