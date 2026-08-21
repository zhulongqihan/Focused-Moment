import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LockKeyhole, LockKeyholeOpen } from "lucide-solid";
import type {
  AnalyticsSnapshot,
  BackupListItem,
  FeedbackKind,
  FocusRecord,
  TodoDraft,
  TodoImportance,
  TimerSnapshot,
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
import "./App.css";

type AppView = "focus" | "todos" | "records" | "settings";
type TimerMode = "stopwatch" | "countdown";
type LoadState = "loading" | "ready" | "error";
type UndoAction =
  | { kind: "todo"; item: TodoItem }
  | { kind: "record"; item: FocusRecord };

type TodoEditDraft = TodoDraft & { id: number };

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

function importanceLabel(value: TodoImportance) {
  return value === "high" ? "高" : value === "low" ? "低" : "中";
}

function MainShell() {
  const [activeView, setActiveView] = createSignal<AppView>("focus");
  const [timer, setTimer] = createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [analytics, setAnalytics] = createSignal<AnalyticsSnapshot | null>(null);
  const [sessionTitle, setSessionTitle] = createSignal("");
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);
  const [completeLinkedTodo, setCompleteLinkedTodo] = createSignal(false);
  const [countdownMinutes, setCountdownMinutes] = createSignal(25);
  const [todoTitle, setTodoTitle] = createSignal("");
  const [todoDueDate, setTodoDueDate] = createSignal(getToday());
  const [todoDueTime, setTodoDueTime] = createSignal("");
  const [todoImportance, setTodoImportance] = createSignal<TodoImportance>("medium");
  const [editingTodo, setEditingTodo] = createSignal<TodoEditDraft | null>(null);
  const [backups, setBackups] = createSignal<BackupListItem[]>([]);
  const [backupLoadState, setBackupLoadState] = createSignal<LoadState>("loading");
  const [backupLoadError, setBackupLoadError] = createSignal("");
  const [selectedBackupFile, setSelectedBackupFile] = createSignal("");
  const [lastBackupPath, setLastBackupPath] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [busyLabel, setBusyLabel] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [messageKind, setMessageKind] = createSignal<FeedbackKind>("info");
  const [loadState, setLoadState] = createSignal<LoadState>("loading");
  const [loadError, setLoadError] = createSignal("");
  const [syncError, setSyncError] = createSignal("");
  const [undoAction, setUndoAction] = createSignal<UndoAction | null>(null);
  let undoTimer: number | undefined;
  let refreshVersion = 0;

  const ready = () => loadState() === "ready";

  const pendingTodos = () => sortTodos(todos()).filter((item) => !item.isCompleted);
  const completedTodos = () => sortTodos(todos()).filter((item) => item.isCompleted);
  const recentBreakdown = () => (analytics()?.dailyBreakdown ?? []).slice(0, 7);
  const maxDailyDuration = () =>
    Math.max(1, ...recentBreakdown().map((day) => day.totalDurationMs));
  const selectedTodo = () =>
    todos().find((item) => item.id === linkedTodoId() && !item.isCompleted) ?? null;
  const activeTitle = () => sessionTitle().trim() || selectedTodo()?.title || "未命名事项";
  const timerHasProgress = () => timer().isRunning || timer().elapsedMs > 0;
  const canFinish = () => timer().elapsedMs > 0 && timer().canCompleteSession;

  function showMessage(text: string, kind: FeedbackKind = "info") {
    setMessage(text);
    setMessageKind(kind);
  }

  function clearMessage() {
    setMessage("");
    setMessageKind("info");
  }

  function applyTimerSnapshot(next: TimerSnapshot) {
    setTimer(next);
    if (next.isRunning || next.elapsedMs > 0 || next.recoveredFromLastSession) {
      setCompleteLinkedTodo(next.completeLinkedTodoOnFinish);
    }
    if (next.modeKey === "countdown" && next.targetDurationMs !== null) {
      setCountdownMinutes(Math.max(1, Math.round(next.targetDurationMs / 60_000)));
    }

    // Polling must not erase an unfinished title while the user is typing.
    if (!timerHasProgress() && !sessionTitle().trim() && next.activeTaskTitle.trim()) {
      setSessionTitle(next.activeTaskTitle);
    }
    if (!timerHasProgress() && linkedTodoId() === null && next.linkedTodoId !== null) {
      setLinkedTodoId(next.linkedTodoId);
    }
  }

  function invalidateRefreshes() {
    refreshVersion += 1;
  }

  async function refresh(force = false) {
    const requestVersion = ++refreshVersion;
    const [nextTimer, nextTodos, nextRecords, nextAnalytics] = await Promise.all([
      getTimerSnapshot(),
      getTodoItems(),
      getFocusRecords(),
      getAnalyticsSnapshot(),
    ]);

    if (requestVersion !== refreshVersion || (!force && busy())) {
      return false;
    }

    applyTimerSnapshot(nextTimer);
    setTodos(nextTodos);
    setRecords(nextRecords);
    setAnalytics(nextAnalytics);
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
      if (timer().modeKey === "countdown") {
        const minutes = Math.round(countdownMinutes());
        if (minutes < 1 || minutes > 720) {
          throw new Error("倒计时时长需要在 1 到 720 分钟之间。");
        }
        applyTimerSnapshot(await configureCountdownMinutes(minutes));
      }

      applyTimerSnapshot(
        await updateTimerContext(title, linkedTodoId(), completeLinkedTodo())
      );
      applyTimerSnapshot(await startTimer());
      if (timer().modeKey === "stopwatch") {
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
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      showMessage("本轮已重置，没有生成记录。", "info");
    }, "正在重置…");
  }

  async function finishFocus() {
    await run(async () => {
      const title = isFocusFloatingWindow
        ? timer().activeTaskTitle
        : activeTitle();
      const payload = await completeFocusSession(title);
      setRecords(payload.records);
      setTodos(payload.todoItems);
      setAnalytics(await getAnalyticsSnapshot());
      applyTimerSnapshot(payload.timerSnapshot);
      setSessionTitle("");
      setLinkedTodoId(null);
      setCompleteLinkedTodo(false);
      if (isFocusFloatingWindow) {
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

  async function toggleTodo(id: number) {
    await run(async () => {
      setTodos(await toggleTodoItem(id));
      showMessage("待办状态已更新。", "success");
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
      showMessage(`已恢复 ${result.todoCount} 项待办和 ${result.focusRecordCount} 条记录。`, "success");
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
    setActiveView("focus");
  }

  async function changeCompletionPreference(value: boolean) {
    setCompleteLinkedTodo(value);
    if (!isFocusFloatingWindow) {
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

  onMount(() => {
    if (isFloatingWindow || isUnlockWindow || isFocusFloatingWindow || isFocusUnlockWindow) {
      document.documentElement.classList.add("floating-window");
    }

    let interval: number | undefined;
    if (!isUnlockWindow && !isFocusUnlockWindow) {
      void loadFromStorage().catch((error) => {
        showMessage(getErrorMessage(error), "error");
      });

      interval = window.setInterval(
        () => {
          if (busy()) {
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
        isFloatingWindow ? 4000 : 1000
      );
    }

    onCleanup(() => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      if (undoTimer !== undefined) {
        window.clearTimeout(undoTimer);
      }
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
      <aside class="focus-floating" aria-label="正向计时小窗">
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
        <Show when={timer().alertTitle}>
          <div class="floating-alert" role="alert">
            <strong>{timer().alertTitle}</strong>
            <span>{timer().alertMessage}</span>
            <button
              type="button"
              class="text-button"
              disabled={busy()}
              onClick={() => void dismissTimerAlert()}
            >
              知道了
            </button>
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
          <button
            type="button"
            class="secondary-button"
            disabled={busy() || !timer().isRunning}
            onClick={() => void pauseFocus()}
          >
            暂停
          </button>
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
      <aside class="floating-todo" aria-label="桌面悬浮待办">
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
            <strong>待办</strong>
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
              class="icon-button"
              title="返回主窗口"
              onClick={() => void restoreMainFromFloatingTodos()}
            >
              返回
            </button>
          </div>
        </header>

        <div class="floating-todo__list">
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
      </aside>
    );
  }

  return (
    <div class="minimal-app">
      <a class="skip-link" href="#main-content">跳到主要内容</a>
      <header class="app-bar">
        <div class="app-brand" data-tauri-drag-region>
          <span class="app-brand__mark" />
          <strong>Focused Moment</strong>
        </div>
        <div class="app-bar__actions">
          <button
            type="button"
            class="quiet-button"
            disabled={busy()}
            onClick={() => void showFloatingTodos()}
          >
            悬浮待办
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

        <section class="minimal-content" aria-busy={busy() || loadState() === "loading"}>
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

              <Show when={timer().alertTitle}>
                <div class="timer-alert" role="alert">
                  <div>
                    <strong>{timer().alertTitle}</strong>
                    <p>{timer().alertMessage}</p>
                  </div>
                  <button
                    type="button"
                    class="secondary-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    知道了
                  </button>
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
                    onInput={(event) =>
                      setCountdownMinutes(Number(event.currentTarget.value || 0))
                    }
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
                    onInput={(event) => setSessionTitle(event.currentTarget.value)}
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
                <strong>{timer().elapsedLabel}</strong>
                <small>
                  {timer().modeKey === "countdown"
                    ? `设定 ${countdownMinutes()} 分钟`
                    : "已累计专注时长"}
                </small>
              </div>

              <div class="timer-controls">
                <button
                  type="button"
                  class="primary-button"
                  disabled={busy() || !ready() || timer().isRunning}
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
                    onInput={(event) => setTodoDueDate(event.currentTarget.value)}
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
                  <For each={pendingTodos()}>
                    {(item) => (
                      <article classList={{ "todo-row": true, "todo-row--overdue": isOverdue(item.scheduledDate) }}>
                        <Show
                          when={editingTodo()?.id === item.id}
                          fallback={
                            <>
                              <button
                                type="button"
                                class="todo-check"
                                title="标记完成"
                                aria-label={`标记“${item.title}”完成`}
                                disabled={busy()}
                                onClick={() => void toggleTodo(item.id)}
                              />
                              <div>
                                <strong title={item.title}>{item.title}</strong>
                                <small>
                                  {formatTodoDue(item)} · 重要程度：{importanceLabel(item.importanceKey)}
                                </small>
                              </div>
                              <div class="todo-row__actions">
                                <button
                                  type="button"
                                  class="row-action"
                                  disabled={busy()}
                                  onClick={() => beginEditTodo(item)}
                                >
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  class="row-action"
                                  disabled={busy() || timerHasProgress()}
                                  onClick={() => useTodoForFocus(item)}
                                >
                                  专注
                                </button>
                                <button
                                  type="button"
                                  class="row-action row-action--danger"
                                  title="删除待办"
                                  disabled={busy()}
                                  onClick={() => void removeTodo(item.id)}
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
                                name={`editTodoTitle-${item.id}`}
                                autocomplete="off"
                                value={editingTodo()?.title ?? ""}
                                onInput={(event) => patchEditingTodo({ title: event.currentTarget.value })}
                              />
                            </label>
                            <label>
                              <span>截止日期</span>
                              <input
                                type="date"
                                name={`editTodoDate-${item.id}`}
                                autocomplete="off"
                                value={editingTodo()?.scheduledDate ?? ""}
                                onInput={(event) => patchEditingTodo({ scheduledDate: event.currentTarget.value })}
                              />
                            </label>
                            <label>
                              <span>时间</span>
                              <input
                                type="time"
                                name={`editTodoTime-${item.id}`}
                                autocomplete="off"
                                value={editingTodo()?.scheduledTime ?? ""}
                                onInput={(event) => patchEditingTodo({ scheduledTime: event.currentTarget.value })}
                              />
                            </label>
                            <label>
                              <span>重要程度</span>
                              <select
                                name={`editTodoImportance-${item.id}`}
                                value={editingTodo()?.importanceKey ?? "medium"}
                                onChange={(event) => patchEditingTodo({ importanceKey: event.currentTarget.value as TodoImportance })}
                              >
                                <option value="high">高</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                              </select>
                            </label>
                            <div class="todo-edit-form__actions">
                              <button type="button" class="primary-button" disabled={busy()} onClick={() => void saveTodoEdit()}>
                                保存
                              </button>
                              <button type="button" class="text-button" disabled={busy()} onClick={cancelEditTodo}>
                                取消
                              </button>
                            </div>
                          </div>
                        </Show>
                      </article>
                    )}
                  </For>
                </Show>
                <Show when={ready() && pendingTodos().length === 0}>
                  <p class="empty-copy">还没有待办，先写下今天要完成的一件事。</p>
                </Show>
              </div>

              <Show when={completedTodos().length > 0}>
                <section class="completed-section">
                  <span>已完成</span>
                  <For each={completedTodos()}>
                    {(item) => (
                      <div class="completed-row">
                        <button
                          type="button"
                          class="completed-row__title"
                          disabled={busy()}
                          onClick={() => void toggleTodo(item.id)}
                        >
                          {item.title}
                        </button>
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
                            {formatBackupDate(backup.exportedAt)} · {backup.todoCount} 项待办 · {backup.focusRecordCount} 条记录
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
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
              <div class="page-heading">
                <span>记录</span>
                <h1>每一轮都留得下来</h1>
              </div>
              <Show when={analytics()}>
                {(summary) => (
                  <section class="records-summary" aria-label="专注概览">
                    <div>
                      <span>今日专注</span>
                      <strong>{summary().todayFocusDurationLabel}</strong>
                      <small>{summary().todaySessionCount} 轮</small>
                    </div>
                    <div>
                      <span>累计专注</span>
                      <strong>{summary().totalFocusDurationLabel}</strong>
                      <small>{summary().sessionCount} 轮记录</small>
                    </div>
                    <div>
                      <span>活跃天数</span>
                      <strong>{summary().activeDays}</strong>
                      <small>平均每天 {summary().averageDailyDurationLabel}</small>
                    </div>
                    <div>
                      <span>待办完成</span>
                      <strong>{summary().completedTodoCount}</strong>
                      <small>还有 {summary().pendingTodoCount} 项未完成</small>
                    </div>
                  </section>
                )}
              </Show>
              <Show when={recentBreakdown().length > 0}>
                <section class="records-trend" aria-label="最近七天专注趋势">
                  <div class="records-trend__heading">
                    <h2>最近投入</h2>
                    <span>按天查看最近 7 天的专注时长</span>
                  </div>
                  <For each={recentBreakdown()}>
                    {(day) => (
                      <div class="trend-row">
                        <span>{formatAnalyticsDate(day.date)}</span>
                        <div class="trend-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(8, (day.totalDurationMs / maxDailyDuration()) * 100)}%` }} />
                        </div>
                        <strong>{day.totalDurationLabel}</strong>
                      </div>
                    )}
                  </For>
                </section>
              </Show>
              <div class="record-list">
                <Show when={loadState() === "loading"}>
                  <p class="load-copy">正在读取专注记录…</p>
                </Show>
                <Show when={loadState() === "error"}>
                  <p class="empty-copy">读取失败，请点击上方“重试读取”。</p>
                </Show>
                <Show when={ready()}>
                  <For each={records()}>
                    {(record) => (
                      <article class="record-row">
                        <div>
                          <strong title={record.title}>{record.title}</strong>
                          <small>{`${record.modeLabel} · ${formatRecordDate(record)}`}</small>
                        </div>
                        <b>{record.durationLabel}</b>
                        <button
                          type="button"
                          class="row-action row-action--danger"
                          disabled={busy()}
                          onClick={() => void removeRecord(record.id)}
                        >
                          删除
                        </button>
                      </article>
                    )}
                  </For>
                </Show>
                <Show when={ready() && records().length === 0}>
                  <p class="empty-copy">完成一次计时后，记录会显示在这里。</p>
                </Show>
              </div>
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
      </main>
    </div>
  );
}

export default MainShell;
