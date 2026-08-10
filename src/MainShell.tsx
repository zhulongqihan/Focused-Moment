import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FocusRecord, TimerSnapshot, TodoItem } from "./lib/contracts";
import {
  completeFocusSession,
  deleteFocusRecord,
  getFocusRecords,
  getTimerSnapshot,
  pauseTimer,
  resetTimer,
  setCountdownMinutes as configureCountdownMinutes,
  startTimer,
  switchTimerMode,
  updateTimerContext,
} from "./lib/timer";
import {
  createTodoItem,
  deleteTodoItem,
  getTodoItems,
  toggleTodoItem,
} from "./lib/tasks";
import {
  closeMainWindow,
  minimizeMainWindow,
  quitApplication,
  restoreMainFromFloatingTodos,
  showFloatingTodos,
} from "./lib/window-controls";
import "./App.css";

type AppView = "focus" | "todos" | "records";
type TimerMode = "stopwatch" | "countdown";

const currentWindow = getCurrentWindow();
const isFloatingWindow = currentWindow.label === "todo-float";

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

function sortTodos(items: TodoItem[]) {
  return items.slice().sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) {
      return Number(left.isCompleted) - Number(right.isCompleted);
    }

    return left.scheduledDate.localeCompare(right.scheduledDate) || right.id - left.id;
  });
}

function MainShell() {
  const [activeView, setActiveView] = createSignal<AppView>("focus");
  const [timer, setTimer] = createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [sessionTitle, setSessionTitle] = createSignal("");
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);
  const [countdownMinutes, setCountdownMinutes] = createSignal(25);
  const [todoTitle, setTodoTitle] = createSignal("");
  const [todoDueDate, setTodoDueDate] = createSignal(getToday());
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [ready, setReady] = createSignal(false);

  const pendingTodos = () => sortTodos(todos()).filter((item) => !item.isCompleted);
  const completedTodos = () => sortTodos(todos()).filter((item) => item.isCompleted);
  const selectedTodo = () =>
    todos().find((item) => item.id === linkedTodoId() && !item.isCompleted) ?? null;
  const activeTitle = () => sessionTitle().trim() || selectedTodo()?.title || "未命名事项";
  const timerHasProgress = () => timer().isRunning || timer().elapsedMs > 0;
  const canFinish = () => timer().elapsedMs > 0 && timer().canCompleteSession;

  function applyTimerSnapshot(next: TimerSnapshot) {
    setTimer(next);
    if (next.modeKey === "countdown" && next.targetDurationMs !== null) {
      setCountdownMinutes(Math.max(1, Math.round(next.targetDurationMs / 60_000)));
    }

    if (!timerHasProgress()) {
      setSessionTitle(next.activeTaskTitle);
      setLinkedTodoId(next.linkedTodoId);
    }
  }

  async function refresh() {
    const [nextTimer, nextTodos, nextRecords] = await Promise.all([
      getTimerSnapshot(),
      getTodoItems(),
      getFocusRecords(),
    ]);
    applyTimerSnapshot(nextTimer);
    setTodos(nextTodos);
    setRecords(nextRecords);
  }

  async function run(action: () => Promise<void>) {
    if (busy()) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(mode: TimerMode) {
    if (timerHasProgress()) {
      setMessage("请先完成记录或重置当前计时，再切换模式。");
      return;
    }

    await run(async () => {
      const next = await switchTimerMode(mode);
      applyTimerSnapshot(next);
    });
  }

  async function startFocus() {
    const title = activeTitle();
    if (!title || title === "未命名事项") {
      setMessage("请先写下这一轮要做什么，或选择一个待办。");
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
        await updateTimerContext(title, linkedTodoId())
      );
      applyTimerSnapshot(await startTimer());
      setMessage("已开始计时。");
    });
  }

  async function pauseFocus() {
    await run(async () => {
      applyTimerSnapshot(await pauseTimer());
    });
  }

  async function resetFocus() {
    await run(async () => {
      applyTimerSnapshot(await resetTimer());
      setSessionTitle("");
      setLinkedTodoId(null);
      setMessage("本轮已重置，没有生成记录。");
    });
  }

  async function finishFocus() {
    await run(async () => {
      const payload = await completeFocusSession(activeTitle(), linkedTodoId());
      setRecords(payload.records);
      applyTimerSnapshot(payload.timerSnapshot);
      setSessionTitle("");
      setLinkedTodoId(null);
      setMessage("已保存为一条专注记录。");
    });
  }

  async function addTodo() {
    const title = todoTitle().trim();
    if (!title) {
      setMessage("请填写待办事项。");
      return;
    }
    if (!todoDueDate()) {
      setMessage("请填写截止日期。");
      return;
    }

    await run(async () => {
      setTodos(
        await createTodoItem({
          title,
          scheduledDate: todoDueDate(),
          scheduledTime: "",
          importanceKey: "medium",
        })
      );
      setTodoTitle("");
      setMessage("待办已添加。");
    });
  }

  async function toggleTodo(id: number) {
    await run(async () => {
      setTodos(await toggleTodoItem(id));
    });
  }

  async function removeTodo(id: number) {
    await run(async () => {
      setTodos(await deleteTodoItem(id));
      if (linkedTodoId() === id) {
        setLinkedTodoId(null);
      }
    });
  }

  async function removeRecord(id: number) {
    await run(async () => {
      setRecords(await deleteFocusRecord(id));
    });
  }

  function useTodoForFocus(item: TodoItem) {
    setLinkedTodoId(item.id);
    setSessionTitle(item.title);
    setActiveView("focus");
  }

  onMount(() => {
    if (isFloatingWindow) {
      document.documentElement.classList.add("floating-window");
    }

    void refresh()
      .catch((error) => setMessage(getErrorMessage(error)))
      .finally(() => setReady(true));

    const interval = window.setInterval(
      () => void refresh().catch(() => undefined),
      isFloatingWindow ? 4000 : 1000
    );

    onCleanup(() => {
      window.clearInterval(interval);
      document.documentElement.classList.remove("floating-window");
    });
  });

  if (isFloatingWindow) {
    return (
      <aside class="floating-todo" aria-label="桌面悬浮待办">
        <header class="floating-todo__header" data-tauri-drag-region>
          <div>
            <span>Focused Moment</span>
            <strong>待办</strong>
          </div>
          <button
            type="button"
            class="icon-button"
            title="返回主窗口"
            onClick={() => void restoreMainFromFloatingTodos()}
          >
            返回
          </button>
        </header>

        <div class="floating-todo__list">
          <Show
            when={ready() && pendingTodos().length > 0}
            fallback={<p class="floating-empty">没有未完成的待办</p>}
          >
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
                    <small>{`截止 ${item.scheduledDate}`}</small>
                  </span>
                </button>
              )}
            </For>
          </Show>
        </div>
      </aside>
    );
  }

  return (
    <div class="minimal-app">
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

      <main class="minimal-workspace">
        <nav class="minimal-nav" aria-label="主导航">
          <button
            type="button"
            classList={{ active: activeView() === "focus" }}
            onClick={() => setActiveView("focus")}
          >
            计时
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "todos" }}
            onClick={() => setActiveView("todos")}
          >
            待办
            <span>{pendingTodos().length}</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "records" }}
            onClick={() => setActiveView("records")}
          >
            记录
          </button>
        </nav>

        <section class="minimal-content">
          <Show when={activeView() === "focus"}>
            <section class="focus-page">
              <div class="page-heading">
                <span>专注</span>
                <h1>现在只做一件事</h1>
              </div>

              <div class="mode-switcher">
                <button
                  type="button"
                  classList={{ active: timer().modeKey === "stopwatch" }}
                  disabled={busy() || timerHasProgress()}
                  onClick={() => void changeMode("stopwatch")}
                >
                  正向计时
                </button>
                <button
                  type="button"
                  classList={{ active: timer().modeKey === "countdown" }}
                  disabled={busy() || timerHasProgress()}
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
                    min="1"
                    max="720"
                    value={countdownMinutes()}
                    disabled={busy() || timerHasProgress()}
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
                    value={sessionTitle()}
                    placeholder="例如：完成项目方案"
                    disabled={busy() || timerHasProgress()}
                    onInput={(event) => setSessionTitle(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>关联待办（可选）</span>
                  <select
                    value={linkedTodoId() ?? ""}
                    disabled={busy() || timerHasProgress()}
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
                  disabled={busy() || timer().isRunning}
                  onClick={() => void startFocus()}
                >
                  开始
                </button>
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
                  class="secondary-button"
                  disabled={busy() || !canFinish()}
                  onClick={() => void finishFocus()}
                >
                  完成并记录
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
                <input
                  type="text"
                  value={todoTitle()}
                  placeholder="新增待办"
                  onInput={(event) => setTodoTitle(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addTodo();
                    }
                  }}
                />
                <label>
                  <span>截止日期</span>
                  <input
                    type="date"
                    value={todoDueDate()}
                    onInput={(event) => setTodoDueDate(event.currentTarget.value)}
                  />
                </label>
                <button
                  type="button"
                  class="primary-button"
                  disabled={busy()}
                  onClick={() => void addTodo()}
                >
                  添加
                </button>
              </div>

              <div class="todo-list">
                <For each={pendingTodos()}>
                  {(item) => (
                    <article class="todo-row">
                      <button
                        type="button"
                        class="todo-check"
                        title="标记完成"
                        disabled={busy()}
                        onClick={() => void toggleTodo(item.id)}
                      />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{`截止 ${item.scheduledDate}`}</small>
                      </div>
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
                    </article>
                  )}
                </For>
                <Show when={ready() && pendingTodos().length === 0}>
                  <p class="empty-copy">还没有待办。</p>
                </Show>
              </div>

              <Show when={completedTodos().length > 0}>
                <section class="completed-section">
                  <span>已完成</span>
                  <For each={completedTodos()}>
                    {(item) => (
                      <button
                        type="button"
                        class="completed-row"
                        disabled={busy()}
                        onClick={() => void toggleTodo(item.id)}
                      >
                        {item.title}
                      </button>
                    )}
                  </For>
                </section>
              </Show>
            </section>
          </Show>

          <Show when={activeView() === "records"}>
            <section class="records-page">
              <div class="page-heading">
                <span>记录</span>
                <h1>每一轮都留得下来</h1>
              </div>
              <div class="record-list">
                <For each={records()}>
                  {(record) => (
                    <article class="record-row">
                      <div>
                        <strong>{record.title}</strong>
                        <small>{`${record.modeLabel} · ${record.completedDate} ${record.completedTime}`}</small>
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
                <Show when={ready() && records().length === 0}>
                  <p class="empty-copy">完成一次计时后，记录会显示在这里。</p>
                </Show>
              </div>
            </section>
          </Show>

          <Show when={message()}>
            <p class="app-message" role="status">{message()}</p>
          </Show>
        </section>
      </main>
    </div>
  );
}

export default MainShell;
