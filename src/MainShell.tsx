import { invoke } from "@tauri-apps/api/core";
import { For, createSignal, onCleanup, onMount } from "solid-js";
import type {
  FocusRecord,
  ShellSnapshot,
  TimerSnapshot,
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
  completeStopwatchSession,
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

const copy = {
  versionEyebrow: "\u4e13\u6ce8\u684c\u9762\u52a9\u624b",
  heroVersion: "v0.4.0 \u4efb\u52a1\u6e05\u5355\u57fa\u7840\u7248",
  heroSummary:
    "\u8fd9\u4e00\u7248\u628a\u4efb\u52a1\u6e05\u5355\u63a5\u8fdb\u4e86 Rust \u72b6\u6001\u5c42\uff0c\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u5728\u5e94\u7528\u5185\u65b0\u589e\u3001\u7f16\u8f91\u3001\u5b8c\u6210\u548c\u5220\u9664\u4efb\u52a1\u3002",
  loading: "\u6b63\u5728\u8f7d\u5165 v0.4.0 \u65f6\u95f4\u4e0e\u4efb\u52a1\u9762\u677f...",
  ready: "\u4efb\u52a1\u6e05\u5355\u57fa\u7840\u80fd\u529b\u5df2\u63a5\u5165 Rust \u5f15\u64ce\u3002",
  fallback: "\u5e94\u7528\u5df2\u4f7f\u7528\u56de\u9000\u6570\u636e\u542f\u52a8\u3002",
  shellFallback:
    "\u8f7d\u5165\u684c\u9762\u58f3\u5c42\u6570\u636e\u5931\u8d25\u3002",
  minimize: "\u6700\u5c0f\u5316",
  maximize: "\u6700\u5927\u5316",
  close: "\u5173\u95ed",
  modeSwitchEyebrow: "\u8ba1\u65f6\u6a21\u5f0f",
  stopwatchMode: "\u6b63\u5411\u8ba1\u65f6",
  pomodoroMode: "\u756a\u8304\u949f",
  modeEyebrow: "\u5f53\u524d\u6a21\u5f0f",
  currentTaskEyebrow: "\u5f53\u524d\u4e8b\u52a1",
  currentTaskTitle: "\u505a\u5b8c\u4e00\u4ef6\uff0c\u5c31\u7ed3\u7b97\u4e00\u4ef6",
  currentTaskHint:
    "\u8f93\u5165\u6b63\u5728\u5904\u7406\u7684\u4e8b\u52a1\u540d\u79f0\uff0c\u5b8c\u6210\u540e\u76f4\u63a5\u8bb0\u5f55\u5e76\u8fdb\u5165\u4e0b\u4e00\u9879\u3002",
  pomodoroTaskHint:
    "\u756a\u8304\u949f\u6a21\u5f0f\u4e0b\u4e5f\u53ef\u4ee5\u586b\u5199\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9\uff0c\u7528\u6765\u6807\u8bb0\u8fd9\u4e00\u8f6e\u4f60\u6b63\u5728\u505a\u4ec0\u4e48\u3002",
  taskPlaceholder: "\u4f8b\u5982\uff1a\u6574\u7406\u4eca\u65e5\u65b9\u6848\u521d\u7a3f",
  currentFocusLabel: "\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9",
  start: "\u5f00\u59cb\u8ba1\u65f6",
  pause: "\u6682\u505c",
  reset: "\u91cd\u7f6e",
  complete: "\u5b8c\u6210\u5e76\u8bb0\u5f55",
  pomodoroHint:
    "\u756a\u8304\u949f\u6a21\u5f0f\u4f1a\u81ea\u52a8\u5728 25 \u5206\u949f\u4e13\u6ce8\u548c 5 \u5206\u949f\u4f11\u606f\u4e4b\u95f4\u5207\u6362\u3002",
  engineOwner: "\u5f15\u64ce\u5f52\u5c5e",
  engineOwnerNote:
    "\u65f6\u95f4\u7d2f\u8ba1\u4e0d\u4f9d\u8d56\u524d\u7aef\u5b9a\u65f6\u5668",
  currentStatus: "\u5f53\u524d\u72b6\u6001",
  currentStatusNote:
    "\u652f\u6301\u5f00\u59cb\u3001\u6682\u505c\u3001\u5b8c\u6210\u8bb0\u5f55",
  runtimeTarget: "\u8fd0\u884c\u76ee\u6807",
  runtimeTargetNote: "\u4f4e\u5360\u7528\u684c\u9762\u5e38\u9a7b\u5f62\u6001",
  timingCorrection: "\u6821\u6b63\u65b9\u5f0f",
  timingCorrectionNote:
    "\u5df2\u8003\u8651\u540e\u53f0\u8fd0\u884c\u548c\u7cfb\u7edf\u4f11\u7720\u540e\u7684\u65f6\u95f4\u5dee\u503c",
  recordsEyebrow: "\u5df2\u5b8c\u6210\u8bb0\u5f55",
  recordsTitle: "\u672c\u6b21\u8fd0\u884c\u5185\u5df2\u7ed3\u7b97\u7684\u4e8b\u52a1",
  recordsEmpty: "\u8fd8\u6ca1\u6709\u5b8c\u6210\u8bb0\u5f55\uff0c\u5b8c\u6210\u4e00\u4ef6\u4e8b\u540e\u4f1a\u51fa\u73b0\u5728\u8fd9\u91cc\u3002",
  unnamedTask: "\u672a\u547d\u540d\u4e8b\u52a1",
  todoEyebrow: "\u4efb\u52a1\u9762\u677f",
  todoTitle: "\u4eca\u5929\u8981\u63a8\u8fdb\u7684\u4e8b\u60c5",
  todoSummary:
    "\u8fd9\u4e00\u7248\u5148\u628a\u4efb\u52a1\u7684\u65b0\u589e\u3001\u7f16\u8f91\u3001\u5b8c\u6210\u4e0e\u5220\u9664\u8fde\u8d77\u6765\uff0c\u540e\u7eed\u518d\u628a\u5b83\u4e0e\u4e13\u6ce8\u4f1a\u8bdd\u548c\u60ac\u6d6e\u7a97\u7ed1\u5b9a\u8d77\u6765\u3002",
  todoPlaceholder: "\u65b0\u589e\u4e00\u4e2a\u4efb\u52a1\uff0c\u4f8b\u5982\uff1a\u8865\u5b8c\u5468\u62a5\u521d\u7a3f",
  todoCreate: "\u6dfb\u52a0\u4efb\u52a1",
  todoEditing: "\u6b63\u5728\u7f16\u8f91",
  todoEmpty: "\u8fd8\u6ca1\u6709\u4efb\u52a1\uff0c\u5148\u6dfb\u52a0\u4e00\u9879\u4eca\u5929\u60f3\u63a8\u8fdb\u7684\u4e8b\u60c5\u5427\u3002",
  todoPendingCount: "\u5f85\u63a8\u8fdb",
  todoCompletedCount: "\u5df2\u5b8c\u6210",
  todoEdit: "\u7f16\u8f91",
  todoDelete: "\u5220\u9664",
  todoSave: "\u4fdd\u5b58",
  todoCancel: "\u53d6\u6d88",
  todoStatusDone: "\u5df2\u5b8c\u6210",
  todoStatusPending: "\u8fdb\u884c\u4e2d",
  todoCreatedPrefix: "\u72b6\u6001",
  roadmapEyebrow: "\u7248\u672c\u8def\u7ebf",
  roadmapTitle: "\u540e\u9762\u4f1a\u63a5\u4e0a\u7684\u6a21\u5757",
  roadmapSummary:
    "\u73b0\u5728\u4e3b\u754c\u9762\u5df2\u7ecf\u6709\u65f6\u95f4\u5f15\u64ce\u548c\u4efb\u52a1\u9762\u677f\uff0c\u540e\u7eed\u4f1a\u7ee7\u7eed\u63a5\u5165\u6570\u636e\u590d\u76d8\u3001\u60ac\u6d6e\u7a97\u548c\u6269\u5c55\u80fd\u529b\u3002",
  reservedEyebrow: "\u6269\u5c55\u9884\u7559",
  reservedTitle: "\u4e3a\u4e86\u540e\u7eed\u529f\u80fd\u4fdd\u7559\u7684\u63a5\u53e3\u65b9\u5411",
  reservedSummary:
    "\u8fd9\u4e9b\u80fd\u529b\u4e0d\u4f1a\u8fdb\u5165\u5f53\u524d MVP\uff0c\u4f46\u5e95\u5c42\u7ed3\u6784\u5df2\u7ecf\u9884\u7559\u4e86\u7a7a\u95f4\uff0c\u540e\u9762\u53ef\u4ee5\u7ee7\u7eed\u53e0\u52a0\u800c\u4e0d\u9700\u8981\u63a8\u7ffb\u91cd\u505a\u3002",
  fallbackPrefix: "\u8f7d\u5165\u56de\u9000\u4fe1\u606f\uff1a",
  windows: "Windows",
} as const;

const emptySnapshot: ShellSnapshot = {
  productName: "Focused Moment",
  version: "0.4.0",
  milestone: "v0.4.0 \u4efb\u52a1\u6e05\u5355\u57fa\u7840\u7248",
  slogan:
    "\u5728\u7cbe\u51c6\u8ba1\u65f6\u4e4b\u5916\uff0c\u4e5f\u8ba9\u6bcf\u4e00\u9879\u4efb\u52a1\u80fd\u88ab\u6e05\u6670\u5730\u6536\u62e2\u3001\u5b8c\u6210\u548c\u7ef4\u62a4\u3002",
  surfaces: [],
  reservedExtensions: [],
};

const emptyTimerSnapshot: TimerSnapshot = {
  modeKey: "stopwatch",
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
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [todoItems, setTodoItems] = createSignal<TodoItem[]>([]);
  const [todoDraft, setTodoDraft] = createSignal("");
  const [editingTodoId, setEditingTodoId] = createSignal<number | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = createSignal("");
  const [statusText, setStatusText] = createSignal<string>(copy.loading);
  const [bootError, setBootError] = createSignal<string | null>(null);
  const [timerBusy, setTimerBusy] = createSignal(false);
  const [todoBusy, setTodoBusy] = createSignal(false);

  const timerReady = () => !bootError();
  const taskHintText = () =>
    timerSnapshot().modeKey === "pomodoro"
      ? copy.pomodoroTaskHint
      : copy.currentTaskHint;
  const pendingTodoCount = () =>
    todoItems().filter((item) => !item.isCompleted).length;
  const completedTodoCount = () =>
    todoItems().filter((item) => item.isCompleted).length;

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
    } finally {
      setTodoBusy(false);
    }
  }

  async function handleCreateTodo() {
    const normalizedDraft = todoDraft().trim();
    if (!normalizedDraft) {
      return;
    }

    await runTodoAction(() => createTodoItem(normalizedDraft));
    setTodoDraft("");
    setStatusText(`\u5df2\u6dfb\u52a0\u4efb\u52a1\uff1a${normalizedDraft}`);
  }

  async function handleToggleTodo(id: number) {
    await runTodoAction(() => toggleTodoItem(id));
  }

  async function handleDeleteTodo(id: number) {
    await runTodoAction(() => deleteTodoItem(id));

    if (editingTodoId() === id) {
      setEditingTodoId(null);
      setEditingTodoTitle("");
    }
  }

  function beginTodoEditing(item: TodoItem) {
    setEditingTodoId(item.id);
    setEditingTodoTitle(item.title);
  }

  function cancelTodoEditing() {
    setEditingTodoId(null);
    setEditingTodoTitle("");
  }

  async function handleSaveTodo(id: number) {
    const normalizedTitle = editingTodoTitle().trim();
    if (!normalizedTitle) {
      return;
    }

    await runTodoAction(() => updateTodoItem(id, normalizedTitle));
    setEditingTodoId(null);
    setEditingTodoTitle("");
    setStatusText(`\u5df2\u66f4\u65b0\u4efb\u52a1\uff1a${normalizedTitle}`);
  }

  async function handleCompleteSession() {
    if (timerBusy()) {
      return;
    }

    setTimerBusy(true);

    try {
      const payload = await completeStopwatchSession(currentTaskTitle());
      setTimerSnapshot(payload.timerSnapshot);
      setRecords(payload.records);
      setStatusText(
        `\u5df2\u8bb0\u5f55\uff1a${
          currentTaskTitle().trim() || copy.unnamedTask
        }`
      );
      setCurrentTaskTitle("");
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

      <main class="workspace">
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
              <label class="task-entry__field">
                <input
                  class="task-input"
                  type="text"
                  value={currentTaskTitle()}
                  placeholder={copy.taskPlaceholder}
                  onInput={(event) => setCurrentTaskTitle(event.currentTarget.value)}
                />
              </label>
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
                  !timerSnapshot().canCompleteSession ||
                  timerSnapshot().elapsedMs === 0 ||
                  !timerReady()
                }
                onClick={() => void handleCompleteSession()}
              >
                {copy.complete}
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
                        <strong>{record.title}</strong>
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
              value={todoDraft()}
              placeholder={copy.todoPlaceholder}
              disabled={todoBusy()}
              onInput={(event) => setTodoDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateTodo();
                }
              }}
            />
            <button
              type="button"
              class="action-button action-button--primary"
              disabled={todoBusy() || !todoDraft().trim()}
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
                          value={editingTodoTitle()}
                          disabled={todoBusy()}
                          onInput={(event) =>
                            setEditingTodoTitle(event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSaveTodo(item.id);
                            }
                          }}
                        />
                        <div class="todo-inline-actions">
                          <button
                            type="button"
                            class="action-button action-button--success"
                            disabled={todoBusy() || !editingTodoTitle().trim()}
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
                        <p class="todo-card__meta">
                          {copy.todoCreatedPrefix}
                          {`\uff1a${item.createdAtLabel}`}
                        </p>
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

        <section class="panel split-panel">
          <div class="split-panel__intro">
            <span class="eyebrow">{copy.roadmapEyebrow}</span>
            <h2>{copy.roadmapTitle}</h2>
            <p>{copy.roadmapSummary}</p>
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
      </main>
    </div>
  );
}

export default MainShell;
