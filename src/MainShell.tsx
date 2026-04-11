import { invoke } from "@tauri-apps/api/core";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type {
  FocusRecord,
  ShellSnapshot,
  TimerSnapshot,
  TodoDraft,
  TodoImportance,
  TodoItem,
} from "./lib/contracts";
import {
  createTodoItem,
  deleteTodoItem,
  getTodoItems,
  toggleTodoItem,
  updateTodoItem,
} from "./lib/tasks";
import {
  completeFocusSession,
  getFocusRecords,
  getTimerSnapshot,
  pauseTimer,
  resetTimer,
  startTimer,
  switchTimerMode,
} from "./lib/timer";
import {
  closeMainWindow,
  minimizeMainWindow,
  toggleMaximizeMainWindow,
} from "./lib/window-controls";
import "./App.css";

type ViewKey = "focus" | "tasks" | "insights" | "lab";

const viewItems = [
  {
    key: "focus",
    label: "\u4e13\u6ce8\u8ba1\u65f6",
    summary: "\u756a\u8304\u949f\u4e0e\u6b63\u5411\u8ba1\u65f6",
  },
  {
    key: "tasks",
    label: "\u5f85\u529e\u6e05\u5355",
    summary: "\u4efb\u52a1\u6392\u671f\u4e0e\u4e8b\u52a1\u7ba1\u7406",
  },
  {
    key: "insights",
    label: "\u6570\u636e\u590d\u76d8",
    summary: "\u672c\u5730\u8bb0\u5f55\u4e0e\u540e\u7eed\u7edf\u8ba1",
  },
  {
    key: "lab",
    label: "\u6269\u5c55\u9884\u7559",
    summary: "\u5956\u52b1\u3001\u517b\u6210\u4e0e\u4e3b\u9898\u65b9\u5411",
  },
] as const;

const importanceOptions = [
  { key: "high", label: "\u9ad8\u4f18\u5148\u7ea7" },
  { key: "medium", label: "\u4e2d\u4f18\u5148\u7ea7" },
  { key: "low", label: "\u4f4e\u4f18\u5148\u7ea7" },
] as const;

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalTimeValue() {
  const now = new Date();
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createDefaultTodoDraft(title = ""): TodoDraft {
  return {
    title,
    scheduledDate: getLocalDateValue(),
    scheduledTime: getLocalTimeValue(),
    importanceKey: "medium",
  };
}

function getImportanceLabel(importanceKey: TodoImportance) {
  return (
    importanceOptions.find((option) => option.key === importanceKey)?.label ??
    "\u672a\u8bbe\u7f6e"
  );
}

function formatDurationMs(totalMs: number) {
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = `${Math.floor(totalSeconds / 3600)}`.padStart(2, "0");
  const minutes = `${Math.floor((totalSeconds % 3600) / 60)}`.padStart(
    2,
    "0"
  );
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

const copy = {
  versionEyebrow: "\u4e13\u6ce8\u684c\u9762\u52a9\u624b",
  heroVersion: "v0.6.0 \u4e3b\u754c\u9762\u5206\u533a",
  heroSummary:
    "\u8fd9\u4e00\u7248\u4e0d\u518d\u4f9d\u8d56\u60ac\u6d6e\u7a97\uff0c\u800c\u662f\u628a\u4e3b\u754c\u9762\u5207\u6210\u51e0\u4e2a\u7a33\u5b9a\u7684\u5de5\u4f5c\u533a\uff1a\u8ba1\u65f6\u3001\u5f85\u529e\u3001\u6570\u636e\u590d\u76d8\u548c\u6269\u5c55\u9884\u7559\u3002",
  loading: "\u6b63\u5728\u8f7d\u5165 v0.6.0 \u4e3b\u754c\u9762\u5206\u533a...",
  ready: "\u4e3b\u754c\u9762\u5206\u533a\u5df2\u63a5\u5165\uff0c\u4f60\u53ef\u4ee5\u5728\u4e0d\u540c\u5de5\u4f5c\u533a\u4e4b\u95f4\u7a33\u5b9a\u5207\u6362\u3002",
  fallback: "\u5e94\u7528\u5df2\u4f7f\u7528\u56de\u9000\u6570\u636e\u542f\u52a8\u3002",
  shellFallback: "\u8f7d\u5165\u684c\u9762\u58f3\u5c42\u6570\u636e\u5931\u8d25\u3002",
  minimize: "\u6700\u5c0f\u5316",
  maximize: "\u6700\u5927\u5316",
  close: "\u5173\u95ed",
  modeSwitchEyebrow: "\u8ba1\u65f6\u6a21\u5f0f",
  stopwatchMode: "\u6b63\u5411\u8ba1\u65f6",
  pomodoroMode: "\u756a\u8304\u949f",
  modeEyebrow: "\u5f53\u524d\u6a21\u5f0f",
  currentTaskEyebrow: "\u5f53\u524d\u4e8b\u52a1",
  currentTaskTitle: "\u8fd9\u4e00\u6b21\u4e13\u6ce8\uff0c\u51c6\u5907\u8bb0\u6210\u4ec0\u4e48",
  currentTaskHint:
    "\u4f60\u53ef\u4ee5\u76f4\u63a5\u8f93\u5165\u4e00\u4e2a\u72ec\u7acb\u4e8b\u52a1\u540d\u79f0\uff0c\u5b8c\u6210\u540e\u4f1a\u5355\u72ec\u8bb0\u6210\u4e00\u6761\u4e13\u6ce8\u4e8b\u4ef6\u3002",
  pomodoroTaskHint:
    "\u756a\u8304\u949f\u4e0b\u4e5f\u53ef\u4ee5\u586b\u5199\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9\uff1b\u5230\u70b9\u540e\u6216\u63d0\u524d\u7ed3\u675f\u65f6\uff0c\u90fd\u53ef\u4ee5\u628a\u8fd9\u4e00\u8f6e\u8bb0\u6210\u72ec\u7acb\u4e8b\u4ef6\u6216\u5173\u8054\u4efb\u52a1\u3002",
  taskPlaceholder: "\u4f8b\u5982\uff1a\u6574\u7406\u4eca\u65e5\u65b9\u6848\u521d\u7a3f",
  linkTodoLabel: "\u5173\u8054\u4efb\u52a1",
  linkTodoHint: "\u4e0d\u9009\u62e9\u4efb\u52a1\u65f6\uff0c\u8fd9\u6761\u8bb0\u5f55\u4f1a\u4f5c\u4e3a\u72ec\u7acb\u4e13\u6ce8\u4e8b\u4ef6\u4fdd\u5b58\u3002",
  linkTodoEmpty: "\u4e0d\u5173\u8054\u4efb\u52a1\uff0c\u5355\u72ec\u8bb0\u5f55",
  linkTodoPrefix: "\u5f53\u524d\u5c06\u5173\u8054\u5230\u4efb\u52a1\uff1a",
  currentFocusLabel: "\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9",
  start: "\u5f00\u59cb\u8ba1\u65f6",
  pause: "\u6682\u505c",
  reset: "\u91cd\u7f6e",
  complete: "\u5b8c\u6210\u5e76\u8bb0\u5f55",
  completePomodoro: "\u5b8c\u6210\u672c\u8f6e\u5e76\u8bb0\u5f55",
  completePomodoroPending: "\u8bb0\u5f55\u4e0a\u4e00\u8f6e\u4e13\u6ce8",
  pomodoroHint:
    "\u756a\u8304\u949f\u4f1a\u5728 25 \u5206\u949f\u4e13\u6ce8\u548c 5 \u5206\u949f\u77ed\u4f11\u606f\u4e4b\u95f4\u5207\u6362\u3002\u8fdb\u5165\u4f11\u606f\u9636\u6bb5\u540e\uff0c\u4ecd\u53ef\u8865\u8bb0\u521a\u7ed3\u675f\u7684\u4e0a\u4e00\u8f6e\u4e13\u6ce8\u3002",
  engineOwner: "\u5f15\u64ce\u5f52\u5c5e",
  engineOwnerNote: "\u65f6\u95f4\u7d2f\u8ba1\u4e0d\u4f9d\u8d56\u524d\u7aef\u5b9a\u65f6\u5668",
  currentStatus: "\u5f53\u524d\u72b6\u6001",
  currentStatusNote: "\u652f\u6301\u5f00\u59cb\u3001\u6682\u505c\u3001\u91cd\u7f6e\u4e0e\u5b8c\u6210\u8bb0\u5f55",
  runtimeTarget: "\u8fd0\u884c\u76ee\u6807",
  runtimeTargetNote: "\u4f4e\u5360\u7528\u684c\u9762\u5e38\u9a7b\u5f62\u6001",
  timingCorrection: "\u6821\u6b63\u65b9\u5f0f",
  timingCorrectionNote: "\u5df2\u8003\u8651\u540e\u53f0\u8fd0\u884c\u548c\u7cfb\u7edf\u4f11\u7720\u540e\u7684\u65f6\u95f4\u5dee\u503c",
  recordsEyebrow: "\u4e13\u6ce8\u8bb0\u5f55",
  recordsTitle: "\u672c\u6b21\u8fd0\u884c\u5185\u5df2\u6c89\u6dc0\u7684\u4e13\u6ce8\u4e8b\u4ef6",
  recordsEmpty: "\u8fd8\u6ca1\u6709\u8bb0\u5f55\uff0c\u5b8c\u6210\u4e00\u8f6e\u4e13\u6ce8\u540e\u4f1a\u51fa\u73b0\u5728\u8fd9\u91cc\u3002",
  unnamedTask: "\u672a\u547d\u540d\u4e8b\u52a1",
  recordIndependent: "\u72ec\u7acb\u4e8b\u4ef6",
  recordLinkedPrefix: "\u5173\u8054\u4efb\u52a1\uff1a",
  todoEyebrow: "\u4efb\u52a1\u9762\u677f",
  todoTitle: "\u4eca\u5929\u8981\u63a8\u8fdb\u7684\u4e8b\u60c5",
  todoSummary:
    "\u4efb\u52a1\u73b0\u5728\u4e0d\u53ea\u662f\u6392\u671f\u9879\uff0c\u4e5f\u53ef\u4ee5\u5728\u8bb0\u5f55\u4e13\u6ce8\u65f6\u4f5c\u4e3a\u5173\u8054\u5bf9\u8c61\u88ab\u9009\u4e2d\uff0c\u65b9\u4fbf\u540e\u7eed\u7ee7\u7eed\u505a\u6c89\u6dc0\u548c\u590d\u76d8\u3002",
  todoPlaceholder: "\u65b0\u589e\u4e00\u4e2a\u4efb\u52a1\uff0c\u4f8b\u5982\uff1a\u8865\u5b8c\u5468\u62a5\u521d\u7a3f",
  todoDateLabel: "\u65e5\u671f",
  todoTimeLabel: "\u5f00\u59cb\u65f6\u95f4",
  todoImportanceLabel: "\u91cd\u8981\u7a0b\u5ea6",
  todoCreate: "\u6dfb\u52a0\u4efb\u52a1",
  todoEmpty: "\u8fd8\u6ca1\u6709\u4efb\u52a1\uff0c\u5148\u6dfb\u52a0\u4e00\u9879\u4eca\u5929\u60f3\u63a8\u8fdb\u7684\u4e8b\u60c5\u5427\u3002",
  todoPendingCount: "\u5f85\u63a8\u8fdb",
  todoCompletedCount: "\u5df2\u5b8c\u6210",
  todoEdit: "\u7f16\u8f91",
  todoDelete: "\u5220\u9664",
  todoSave: "\u4fdd\u5b58",
  todoCancel: "\u53d6\u6d88",
  todoStatusDone: "\u5df2\u5b8c\u6210",
  todoStatusPending: "\u8fdb\u884c\u4e2d",
  todoDateValueLabel: "\u65e5\u671f",
  todoTimeValueLabel: "\u5f00\u59cb",
  todoImportanceValueLabel: "\u91cd\u8981",
  switcherEyebrow: "\u5de5\u4f5c\u533a\u5207\u6362",
  switcherTitle: "\u628a\u529f\u80fd\u653e\u8fdb\u66f4\u7a33\u5b9a\u7684\u4e3b\u754c\u9762\u5206\u533a",
  switcherSummary:
    "\u5728\u8fd9\u91cc\u5207\u6362\u4f60\u5f53\u524d\u8981\u4e13\u6ce8\u7684\u754c\u9762\uff1a\u8ba1\u65f6\u3001\u5f85\u529e\u3001\u6570\u636e\u590d\u76d8\u6216\u540e\u7eed\u6269\u5c55\u3002",
  insightEyebrow: "\u6570\u636e\u590d\u76d8",
  insightTitle: "\u4e3a\u4e0b\u4e00\u9636\u6bb5\u7edf\u8ba1\u4e2d\u5fc3\u51c6\u5907\u7684\u57fa\u7840\u89c6\u56fe",
  insightSummary:
    "\u8fd9\u4e00\u9875\u5148\u628a\u73b0\u6709\u7684\u672c\u5730\u6570\u636e\u6309\u6700\u76f4\u89c2\u7684\u65b9\u5f0f\u5c55\u793a\u51fa\u6765\uff0c\u540e\u7eed\u4f1a\u5728\u6b64\u57fa\u7840\u4e0a\u63a5\u5165\u56fe\u8868\u548c\u8de8\u5929\u7edf\u8ba1\u3002",
  labEyebrow: "\u6269\u5c55\u9884\u7559",
  labTitle: "\u540e\u7eed\u529f\u80fd\u5c06\u5728\u8fd9\u91cc\u7ee7\u7eed\u5c55\u5f00",
  labSummary:
    "\u5f53\u524d MVP \u5148\u805a\u7126\u8ba1\u65f6\u548c\u5f85\u529e\uff0c\u4f46\u5e95\u5c42\u5df2\u7ecf\u4e3a\u5956\u52b1\u7cfb\u7edf\u3001\u6210\u957f\u4f53\u7cfb\u4e0e\u4e3b\u9898\u6269\u5c55\u9884\u7559\u4e86\u63a5\u53e3\u4f4d\u7f6e\u3002",
  roadmapEyebrow: "\u7248\u672c\u8def\u7ebf",
  roadmapTitle: "\u540e\u9762\u4f1a\u63a5\u4e0a\u7684\u6a21\u5757",
  roadmapSummary:
    "\u73b0\u5728\u4e3b\u754c\u9762\u5df2\u7ecf\u80fd\u5728\u4e0d\u540c\u5de5\u4f5c\u533a\u4e4b\u95f4\u7a33\u5b9a\u5207\u6362\uff0c\u4e0b\u4e00\u6b65\u4f1a\u7ee7\u7eed\u8865\u4e0a\u66f4\u5b8c\u6574\u7684\u6570\u636e\u590d\u76d8\u548c\u540e\u53f0\u5e38\u9a7b\u4f53\u9a8c\u3002",
  reservedEyebrow: "\u6269\u5c55\u9884\u7559",
  reservedTitle: "\u4e3a\u4e86\u540e\u7eed\u529f\u80fd\u4fdd\u7559\u7684\u63a5\u53e3\u65b9\u5411",
  reservedSummary:
    "\u8fd9\u4e9b\u80fd\u529b\u4e0d\u4f1a\u8fdb\u5165\u5f53\u524d MVP\uff0c\u4f46\u5e95\u5c42\u7ed3\u6784\u5df2\u7ecf\u9884\u7559\u4e86\u7a7a\u95f4\uff0c\u540e\u9762\u53ef\u4ee5\u7ee7\u7eed\u53e0\u52a0\u800c\u4e0d\u9700\u8981\u63a8\u7ffb\u91cd\u505a\u3002",
  fallbackPrefix: "\u8f7d\u5165\u56de\u9000\u4fe1\u606f\uff1a",
  windows: "Windows",
  defaultError: "\u64cd\u4f5c\u6ca1\u6709\u6210\u529f\uff0c\u8bf7\u91cd\u8bd5\u3002",
} as const;

const emptySnapshot: ShellSnapshot = {
  productName: "Focused Moment",
  version: "0.6.0",
  milestone: "v0.6.0 \u4e3b\u754c\u9762\u5206\u533a",
  slogan:
    "\u4e13\u6ce8\u3001\u5f85\u529e\u548c\u540e\u7eed\u529f\u80fd\u73b0\u5728\u4f1a\u5728\u540c\u4e00\u4e3b\u754c\u9762\u7684\u4e0d\u540c\u5de5\u4f5c\u533a\u91cc\u5c55\u5f00\u3002",
  surfaces: [],
  reservedExtensions: [],
};

const emptyTimerSnapshot: TimerSnapshot = {
  modeKey: "stopwatch",
  phaseKey: "stopwatch",
  mode: "\u6b63\u5411\u8ba1\u65f6",
  phaseLabel: "\u6b63\u5411\u8ba1\u65f6",
  status: "\u672a\u5f00\u59cb",
  isRunning: false,
  elapsedMs: 0,
  elapsedLabel: "00:00:00",
  secondaryLabel: "\u5df2\u7d2f\u8ba1\u4e13\u6ce8\u65f6\u957f",
  canCompleteSession: true,
};

function MainShell() {
  const [snapshot, setSnapshot] = createSignal<ShellSnapshot>(emptySnapshot);
  const [timerSnapshot, setTimerSnapshot] =
    createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [currentTaskTitle, setCurrentTaskTitle] = createSignal("");
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [todoItems, setTodoItems] = createSignal<TodoItem[]>([]);
  const [todoDraft, setTodoDraft] =
    createSignal<TodoDraft>(createDefaultTodoDraft());
  const [editingTodoId, setEditingTodoId] = createSignal<number | null>(null);
  const [editingTodoDraft, setEditingTodoDraft] =
    createSignal<TodoDraft>(createDefaultTodoDraft());
  const [statusText, setStatusText] = createSignal<string>(copy.loading);
  const [bootError, setBootError] = createSignal<string | null>(null);
  const [timerBusy, setTimerBusy] = createSignal(false);
  const [todoBusy, setTodoBusy] = createSignal(false);
  const [activeView, setActiveView] = createSignal<ViewKey>("focus");

  const timerReady = () => !bootError();
  const taskHintText = () =>
    timerSnapshot().modeKey === "pomodoro"
      ? copy.pomodoroTaskHint
      : copy.currentTaskHint;
  const pendingTodoCount = () =>
    todoItems().filter((item) => !item.isCompleted).length;
  const completedTodoCount = () =>
    todoItems().filter((item) => item.isCompleted).length;
  const linkedTodoItem = () =>
    todoItems().find((item) => item.id === linkedTodoId()) ?? null;
  const linkedTodoValue = () =>
    linkedTodoId() === null ? "" : String(linkedTodoId());
  const taskLinkSummary = () =>
    linkedTodoItem()
      ? `${copy.linkTodoPrefix}${linkedTodoItem()?.title ?? ""}`
      : copy.linkTodoHint;
  const completionLabel = () => {
    if (timerSnapshot().modeKey !== "pomodoro") {
      return copy.complete;
    }

    return timerSnapshot().phaseKey === "break"
      ? copy.completePomodoroPending
      : copy.completePomodoro;
  };
  const completionTitle = () =>
    currentTaskTitle().trim() || linkedTodoItem()?.title || copy.unnamedTask;
  const canCompleteAction = () =>
    timerSnapshot().canCompleteSession &&
    !(
      timerSnapshot().phaseKey !== "break" &&
      timerSnapshot().elapsedMs === 0 &&
      !timerSnapshot().isRunning
    );

  createEffect(() => {
    const activeLinkedTodoId = linkedTodoId();
    if (
      activeLinkedTodoId !== null &&
      !todoItems().some((item) => item.id === activeLinkedTodoId)
    ) {
      setLinkedTodoId(null);
    }
  });

  function patchTodoDraft(patch: Partial<TodoDraft>) {
    setTodoDraft((current) => ({ ...current, ...patch }));
  }

  function patchEditingTodoDraft(patch: Partial<TodoDraft>) {
    setEditingTodoDraft((current) => ({ ...current, ...patch }));
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return copy.defaultError;
  }

  async function refreshTimerSnapshot() {
    const nextTimerSnapshot = await getTimerSnapshot();
    setTimerSnapshot(nextTimerSnapshot);
  }

  async function refreshFocusRecords() {
    const nextRecords = await getFocusRecords();
    setRecords(nextRecords);
  }

  async function refreshTodoItems() {
    const nextTodoItems = await getTodoItems();
    setTodoItems(nextTodoItems);
  }

  async function runTimerAction(action: () => Promise<TimerSnapshot>) {
    if (timerBusy()) {
      return;
    }

    setTimerBusy(true);

    try {
      const nextTimerSnapshot = await action();
      setTimerSnapshot(nextTimerSnapshot);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function runTodoAction(action: () => Promise<TodoItem[]>) {
    if (todoBusy()) {
      return;
    }

    setTodoBusy(true);

    try {
      const nextTodoItems = await action();
      setTodoItems(nextTodoItems);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTodoBusy(false);
    }
  }

  async function handleCreateTodo() {
    const draft = todoDraft();
    const normalizedTitle = draft.title.trim();
    if (!normalizedTitle) {
      return;
    }

    await runTodoAction(() =>
      createTodoItem({
        ...draft,
        title: normalizedTitle,
      })
    );
    patchTodoDraft({ title: "" });
    setStatusText(`\u5df2\u6dfb\u52a0\u4efb\u52a1\uff1a${normalizedTitle}`);
  }

  async function handleToggleTodo(id: number) {
    await runTodoAction(() => toggleTodoItem(id));
  }

  async function handleDeleteTodo(id: number) {
    await runTodoAction(() => deleteTodoItem(id));

    if (editingTodoId() === id) {
      setEditingTodoId(null);
      setEditingTodoDraft(createDefaultTodoDraft());
    }

    if (linkedTodoId() === id) {
      setLinkedTodoId(null);
    }
  }

  function beginTodoEditing(item: TodoItem) {
    setEditingTodoId(item.id);
    setEditingTodoDraft({
      title: item.title,
      scheduledDate: item.scheduledDate,
      scheduledTime: item.scheduledTime,
      importanceKey: item.importanceKey,
    });
  }

  function cancelTodoEditing() {
    setEditingTodoId(null);
    setEditingTodoDraft(createDefaultTodoDraft());
  }

  async function handleSaveTodo(id: number) {
    const draft = editingTodoDraft();
    const normalizedTitle = draft.title.trim();
    if (!normalizedTitle) {
      return;
    }

    await runTodoAction(() =>
      updateTodoItem(id, {
        ...draft,
        title: normalizedTitle,
      })
    );
    setEditingTodoId(null);
    setEditingTodoDraft(createDefaultTodoDraft());
    setStatusText(`\u5df2\u66f4\u65b0\u4efb\u52a1\uff1a${normalizedTitle}`);
  }

  async function handleCompleteSession() {
    if (timerBusy()) {
      return;
    }

    setTimerBusy(true);

    try {
      const payload = await completeFocusSession(
        currentTaskTitle(),
        linkedTodoId()
      );
      setTimerSnapshot(payload.timerSnapshot);
      setRecords(payload.records);
      setStatusText(`\u5df2\u8bb0\u5f55\uff1a${completionTitle()}`);
      setCurrentTaskTitle("");
      setLinkedTodoId(null);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  onMount(async () => {
    try {
      const nextSnapshot = await invoke<ShellSnapshot>("bootstrap_shell");
      setSnapshot(nextSnapshot);
      await refreshTimerSnapshot();
      await refreshFocusRecords();
      await refreshTodoItems();
      setStatusText(copy.ready);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : copy.shellFallback;
      setBootError(message);
      setStatusText(copy.fallback);
    }

    const timerId = window.setInterval(() => {
      void refreshTimerSnapshot().catch(() => {
        // Ignore transient polling errors and keep the last valid timer state.
      });
    }, 250);

    onCleanup(() => {
      window.clearInterval(timerId);
    });
  });

  return (
    <div class="shell">
      <header class="window-chrome" data-tauri-drag-region>
        <div class="brand-lockup" data-tauri-drag-region>
          <div class="brand-mark">
            <span class="brand-mark__dot" />
          </div>
          <div class="brand-copy">
            <span class="brand-copy__eyebrow">{copy.versionEyebrow}</span>
            <strong>{snapshot().productName}</strong>
          </div>
        </div>

        <div class="window-actions">
          <button
            type="button"
            class="window-button"
            onClick={() => void minimizeMainWindow()}
          >
            {copy.minimize}
          </button>
          <button
            type="button"
            class="window-button"
            onClick={() => void toggleMaximizeMainWindow()}
          >
            {copy.maximize}
          </button>
          <button
            type="button"
            class="window-button window-button--danger"
            onClick={() => void closeMainWindow()}
          >
            {copy.close}
          </button>
        </div>
      </header>

      <main class="workspace workspace--single">
        <section class="panel view-switcher">
          <div class="view-switcher__copy">
            <span class="eyebrow">{copy.switcherEyebrow}</span>
            <h2>{copy.switcherTitle}</h2>
            <p>{copy.switcherSummary}</p>
          </div>

          <div class="view-switcher__actions">
            <For each={viewItems}>
              {(item) => (
                <button
                  type="button"
                  classList={{
                    "view-chip": true,
                    "view-chip--active": activeView() === item.key,
                  }}
                  onClick={() => setActiveView(item.key)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                </button>
              )}
            </For>
          </div>
        </section>

                <Show when={activeView() === "focus"}>
          <section class="hero-panel panel">
            <div class="hero-copy timer-hero">
            <span class="eyebrow">{copy.heroVersion}</span>
            <h1>{snapshot().productName}</h1>
            <p class="hero-text">{snapshot().slogan}</p>
            <p class="hero-subtext">{copy.heroSummary}</p>
          </div>

          <div class="status-row">
            <span class="status-pill">{snapshot().milestone}</span>
            <span class="status-copy">{statusText()}</span>
          </div>

          <section class="timer-panel">
            <div class="mode-switch">
              <span class="eyebrow">{copy.modeSwitchEyebrow}</span>
              <div class="mode-switch__actions">
                <button
                  type="button"
                  classList={{
                    "mode-chip": true,
                    "mode-chip--active": timerSnapshot().modeKey === "stopwatch",
                  }}
                  disabled={timerBusy()}
                  onClick={() => void runTimerAction(() => switchTimerMode("stopwatch"))}
                >
                  {copy.stopwatchMode}
                </button>
                <button
                  type="button"
                  classList={{
                    "mode-chip": true,
                    "mode-chip--active": timerSnapshot().modeKey === "pomodoro",
                  }}
                  disabled={timerBusy()}
                  onClick={() => void runTimerAction(() => switchTimerMode("pomodoro"))}
                >
                  {copy.pomodoroMode}
                </button>
              </div>
            </div>

            <div class="task-entry">
              <div class="task-entry__copy">
                <span class="eyebrow">{copy.currentTaskEyebrow}</span>
                <h2>{copy.currentTaskTitle}</h2>
                <p>{taskHintText()}</p>
              </div>

              <div class="task-entry__controls">
                <label class="task-entry__field">
                  <input
                    class="task-input"
                    type="text"
                    value={currentTaskTitle()}
                    placeholder={copy.taskPlaceholder}
                    onInput={(event) =>
                      setCurrentTaskTitle(event.currentTarget.value)
                    }
                  />
                </label>

                <label class="todo-form-field task-entry__field task-entry__field--compact">
                  <span>{copy.linkTodoLabel}</span>
                  <select
                    class="task-input task-select"
                    value={linkedTodoValue()}
                    onChange={(event) =>
                      setLinkedTodoId(
                        event.currentTarget.value
                          ? Number(event.currentTarget.value)
                          : null
                      )
                    }
                  >
                    <option value="">{copy.linkTodoEmpty}</option>
                    <For each={todoItems()}>
                      {(item) => (
                        <option value={item.id}>
                          {`${item.title} - ${item.scheduledDate} ${item.scheduledTime}`}
                        </option>
                      )}
                    </For>
                  </select>
                </label>
              </div>

              <p class="task-link-hint">{taskLinkSummary()}</p>
            </div>

            <div class="timer-panel__header">
              <div>
                <span class="eyebrow">{copy.modeEyebrow}</span>
                <h2>{timerSnapshot().phaseLabel}</h2>
              </div>
              <span
                classList={{
                  "timer-status": true,
                  "timer-status--running": timerSnapshot().isRunning,
                }}
              >
                {timerSnapshot().status}
              </span>
            </div>

            <p class="timer-secondary">{timerSnapshot().secondaryLabel}</p>
            {currentTaskTitle().trim() && (
              <p class="timer-focus-copy">
                {copy.currentFocusLabel}
                {`\uff1a${currentTaskTitle().trim()}`}
              </p>
            )}
            <div class="timer-display">{timerSnapshot().elapsedLabel}</div>
            {timerSnapshot().modeKey === "pomodoro" && (
              <p class="timer-mode-hint">{copy.pomodoroHint}</p>
            )}

            <div class="timer-actions">
              <button
                type="button"
                class="action-button action-button--primary"
                disabled={timerBusy() || timerSnapshot().isRunning || !timerReady()}
                onClick={() => void runTimerAction(startTimer)}
              >
                {copy.start}
              </button>
              <button
                type="button"
                class="action-button"
                disabled={timerBusy() || !timerSnapshot().isRunning || !timerReady()}
                onClick={() => void runTimerAction(pauseTimer)}
              >
                {copy.pause}
              </button>
              <button
                type="button"
                class="action-button"
                disabled={
                  timerBusy() ||
                  (timerSnapshot().elapsedMs === 0 && !timerSnapshot().isRunning) ||
                  !timerReady()
                }
                onClick={() => void runTimerAction(resetTimer)}
              >
                {copy.reset}
              </button>
              <button
                type="button"
                class="action-button action-button--success"
                disabled={
                  timerBusy() ||
                  !canCompleteAction() ||
                  !timerReady()
                }
                onClick={() => void handleCompleteSession()}
              >
                {completionLabel()}
              </button>
            </div>

            <div class="metric-grid">
              <article class="metric-card">
                <span class="metric-label">{copy.engineOwner}</span>
                <strong>Rust</strong>
                <span class="metric-footnote">{copy.engineOwnerNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.currentStatus}</span>
                <strong>{timerSnapshot().status}</strong>
                <span class="metric-footnote">{copy.currentStatusNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.runtimeTarget}</span>
                <strong>{copy.windows}</strong>
                <span class="metric-footnote">{copy.runtimeTargetNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.timingCorrection}</span>
                <strong>Dual Clock</strong>
                <span class="metric-footnote">{copy.timingCorrectionNote}</span>
              </article>
            </div>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.recordsEyebrow}</span>
                  <h3>{copy.recordsTitle}</h3>
                </div>
              </div>

              <div class="records-list">
                <For each={records()}>
                  {(record) => (
                    <article class="record-card">
                      <div class="record-card__main">
                        <div class="record-card__copy">
                          <strong>{record.title}</strong>
                          <div class="record-card__meta">
                            <span class="record-pill">{record.phaseLabel}</span>
                            <span
                              classList={{
                                "record-pill": true,
                                "record-pill--muted": !record.linkedTodoTitle,
                              }}
                            >
                              {record.linkedTodoTitle
                                ? `${copy.recordLinkedPrefix}${record.linkedTodoTitle}`
                                : copy.recordIndependent}
                            </span>
                          </div>
                        </div>
                        <span>{record.durationLabel}</span>
                      </div>
                    </article>
                  )}
                </For>
                {records().length === 0 && (
                  <p class="records-empty">{copy.recordsEmpty}</p>
                )}
              </div>
            </section>
          </section>
        </section>
        </Show>

                <Show when={activeView() === "tasks"}>
          <section class="panel section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">{copy.todoEyebrow}</span>
              <h2>{copy.todoTitle}</h2>
            </div>
            <p>{copy.todoSummary}</p>
          </div>

          <div class="todo-creation">
            <input
              class="task-input"
              type="text"
              value={todoDraft().title}
              placeholder={copy.todoPlaceholder}
              disabled={todoBusy()}
              onInput={(event) =>
                patchTodoDraft({ title: event.currentTarget.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateTodo();
                }
              }}
            />
            <div class="todo-form-grid">
              <label class="todo-form-field">
                <span>{copy.todoDateLabel}</span>
                <input
                  class="task-input"
                  type="date"
                  value={todoDraft().scheduledDate}
                  disabled={todoBusy()}
                  onInput={(event) =>
                    patchTodoDraft({ scheduledDate: event.currentTarget.value })
                  }
                />
              </label>
              <label class="todo-form-field">
                <span>{copy.todoTimeLabel}</span>
                <input
                  class="task-input"
                  type="time"
                  value={todoDraft().scheduledTime}
                  disabled={todoBusy()}
                  onInput={(event) =>
                    patchTodoDraft({ scheduledTime: event.currentTarget.value })
                  }
                />
              </label>
              <label class="todo-form-field">
                <span>{copy.todoImportanceLabel}</span>
                <select
                  class="task-input task-select"
                  value={todoDraft().importanceKey}
                  disabled={todoBusy()}
                  onChange={(event) =>
                    patchTodoDraft({
                      importanceKey: event.currentTarget.value as TodoImportance,
                    })
                  }
                >
                  <For each={importanceOptions}>
                    {(option) => (
                      <option value={option.key}>{option.label}</option>
                    )}
                  </For>
                </select>
              </label>
            </div>
            <button
              type="button"
              class="action-button action-button--primary"
              disabled={todoBusy() || !todoDraft().title.trim()}
              onClick={() => void handleCreateTodo()}
            >
              {copy.todoCreate}
            </button>
          </div>

          <div class="todo-metrics">
            <article class="todo-metric-card">
              <span class="metric-label">{copy.todoPendingCount}</span>
              <strong>{pendingTodoCount()}</strong>
            </article>
            <article class="todo-metric-card">
              <span class="metric-label">{copy.todoCompletedCount}</span>
              <strong>{completedTodoCount()}</strong>
            </article>
          </div>

          <div class="todo-list">
            <For each={todoItems()}>
              {(item) => (
                <article
                  classList={{
                    "todo-card": true,
                    "todo-card--completed": item.isCompleted,
                  }}
                >
                  <button
                    type="button"
                    classList={{
                      "todo-toggle": true,
                      "todo-toggle--completed": item.isCompleted,
                    }}
                    disabled={todoBusy()}
                    onClick={() => void handleToggleTodo(item.id)}
                  >
                    {item.isCompleted ? "\u2713" : ""}
                  </button>

                  <div class="todo-card__body">
                    {editingTodoId() === item.id ? (
                      <div class="todo-edit-row">
                        <input
                          class="task-input"
                          type="text"
                          value={editingTodoDraft().title}
                          disabled={todoBusy()}
                          onInput={(event) =>
                            patchEditingTodoDraft({
                              title: event.currentTarget.value,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSaveTodo(item.id);
                            }
                          }}
                        />
                        <div class="todo-form-grid">
                          <label class="todo-form-field">
                            <span>{copy.todoDateLabel}</span>
                            <input
                              class="task-input"
                              type="date"
                              value={editingTodoDraft().scheduledDate}
                              disabled={todoBusy()}
                              onInput={(event) =>
                                patchEditingTodoDraft({
                                  scheduledDate: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label class="todo-form-field">
                            <span>{copy.todoTimeLabel}</span>
                            <input
                              class="task-input"
                              type="time"
                              value={editingTodoDraft().scheduledTime}
                              disabled={todoBusy()}
                              onInput={(event) =>
                                patchEditingTodoDraft({
                                  scheduledTime: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label class="todo-form-field">
                            <span>{copy.todoImportanceLabel}</span>
                            <select
                              class="task-input task-select"
                              value={editingTodoDraft().importanceKey}
                              disabled={todoBusy()}
                              onChange={(event) =>
                                patchEditingTodoDraft({
                                  importanceKey:
                                    event.currentTarget
                                      .value as TodoImportance,
                                })
                              }
                            >
                              <For each={importanceOptions}>
                                {(option) => (
                                  <option value={option.key}>
                                    {option.label}
                                  </option>
                                )}
                              </For>
                            </select>
                          </label>
                        </div>
                        <div class="todo-inline-actions">
                          <button
                            type="button"
                            class="action-button action-button--success"
                            disabled={
                              todoBusy() || !editingTodoDraft().title.trim()
                            }
                            onClick={() => void handleSaveTodo(item.id)}
                          >
                            {copy.todoSave}
                          </button>
                          <button
                            type="button"
                            class="action-button"
                            disabled={todoBusy()}
                            onClick={() => cancelTodoEditing()}
                          >
                            {copy.todoCancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div class="todo-card__title-row">
                          <strong>{item.title}</strong>
                          <span class="todo-status-pill">
                            {item.isCompleted
                              ? copy.todoStatusDone
                              : copy.todoStatusPending}
                          </span>
                        </div>
                        <div class="todo-attribute-row">
                          <span class="todo-attribute">
                            {copy.todoDateValueLabel}
                            {`\uff1a${item.scheduledDate}`}
                          </span>
                          <span class="todo-attribute">
                            {copy.todoTimeValueLabel}
                            {`\uff1a${item.scheduledTime}`}
                          </span>
                          <span
                            classList={{
                              "todo-attribute": true,
                              "todo-attribute--high":
                                item.importanceKey === "high",
                              "todo-attribute--medium":
                                item.importanceKey === "medium",
                              "todo-attribute--low":
                                item.importanceKey === "low",
                            }}
                          >
                            {copy.todoImportanceValueLabel}
                            {`\uff1a${getImportanceLabel(item.importanceKey)}`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {editingTodoId() !== item.id && (
                    <div class="todo-inline-actions">
                      <button
                        type="button"
                        class="action-button"
                        disabled={todoBusy()}
                        onClick={() => beginTodoEditing(item)}
                      >
                        {copy.todoEdit}
                      </button>
                      <button
                        type="button"
                        class="action-button"
                        disabled={todoBusy()}
                        onClick={() => void handleDeleteTodo(item.id)}
                      >
                        {copy.todoDelete}
                      </button>
                    </div>
                  )}
                </article>
              )}
            </For>

            {todoItems().length === 0 && (
              <p class="records-empty">{copy.todoEmpty}</p>
            )}
          </div>
        </section>
        </Show>

        <Show when={activeView() === "insights"}>
          <section class="panel insights-panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">{copy.insightEyebrow}</span>
                <h2>{copy.insightTitle}</h2>
              </div>
              <p>{copy.insightSummary}</p>
            </div>

            <div class="metric-grid">
              <article class="metric-card">
                <span class="metric-label">{"\u4e13\u6ce8\u8bb0\u5f55"}</span>
                <strong>{records().length}</strong>
                <span class="metric-footnote">
                  {
                    "\u5f53\u524d\u672c\u5730\u5df2\u4fdd\u5b58\u7684\u4e13\u6ce8\u4e8b\u4ef6\u6570\u91cf"
                  }
                </span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{"\u7d2f\u8ba1\u4e13\u6ce8"}</span>
                <strong>
                  {formatDurationMs(
                    records().reduce((total, record) => total + record.durationMs, 0)
                  )}
                </strong>
                <span class="metric-footnote">
                  {
                    "\u57fa\u4e8e\u73b0\u6709\u8bb0\u5f55\u7d2f\u52a0\u5f97\u5230\u7684\u603b\u65f6\u957f"
                  }
                </span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{"\u5f85\u529e\u603b\u6570"}</span>
                <strong>{todoItems().length}</strong>
                <span class="metric-footnote">
                  {
                    "\u5f53\u524d\u672c\u5730\u4efb\u52a1\u5217\u8868\u4e2d\u7684\u5168\u90e8\u4efb\u52a1"
                  }
                </span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{"\u5df2\u5b8c\u6210\u4efb\u52a1"}</span>
                <strong>{completedTodoCount()}</strong>
                <span class="metric-footnote">
                  {
                    "\u540e\u7eed\u56fe\u8868\u4f1a\u5728\u8fd9\u4e2a\u57fa\u7840\u4e0a\u7ee7\u7eed\u5c55\u5f00"
                  }
                </span>
              </article>
            </div>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{"\u6700\u8fd1\u8bb0\u5f55"}</span>
                  <h3>
                    {"\u5148\u7528\u5361\u7247\u65b9\u5f0f\u67e5\u770b\u5df2\u6709\u6570\u636e"}
                  </h3>
                </div>
              </div>

              <div class="records-list">
                <For each={records().slice(0, 6)}>
                  {(record) => (
                    <article class="record-card">
                      <div class="record-card__main">
                        <div class="record-card__copy">
                          <strong>{record.title}</strong>
                          <div class="record-card__meta">
                            <span class="record-pill">{record.phaseLabel}</span>
                            <span
                              classList={{
                                "record-pill": true,
                                "record-pill--muted": !record.linkedTodoTitle,
                              }}
                            >
                              {record.linkedTodoTitle
                                ? `${copy.recordLinkedPrefix}${record.linkedTodoTitle}`
                                : copy.recordIndependent}
                            </span>
                          </div>
                        </div>
                        <span>{record.durationLabel}</span>
                      </div>
                    </article>
                  )}
                </For>

                {records().length === 0 && (
                  <p class="records-empty">
                    {
                      "\u5148\u5b8c\u6210\u51e0\u8f6e\u4e13\u6ce8\uff0c\u518d\u56de\u6765\u67e5\u770b\u66f4\u5b8c\u6574\u7684\u6570\u636e\u590d\u76d8\u3002"
                    }
                  </p>
                )}
              </div>
            </section>
          </section>
        </Show>

        <Show when={activeView() === "lab"}>
          <section class="panel split-panel">
            <div class="split-panel__intro">
              <span class="eyebrow">{copy.labEyebrow}</span>
              <h2>{copy.labTitle}</h2>
              <p>{copy.labSummary}</p>
              {bootError() && (
                <p class="error-copy">
                  {copy.fallbackPrefix}
                  {bootError()}
                </p>
              )}
            </div>

            <div class="stack-list">
              <For each={snapshot().surfaces}>
                {(module) => (
                  <article class="stack-card">
                    <span class="stack-card__phase">{module.phase}</span>
                    <div>
                      <h3>{module.title}</h3>
                      <p>{module.summary}</p>
                    </div>
                  </article>
                )}
              </For>
              <For each={snapshot().reservedExtensions}>
                {(module) => (
                  <article class="stack-card">
                    <span class="stack-card__phase">{module.phase}</span>
                    <div>
                      <h3>{module.title}</h3>
                      <p>{module.summary}</p>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </section>
        </Show>
      </main>
    </div>
  );
}

export default MainShell;

