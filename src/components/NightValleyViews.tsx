import { For, Show, createMemo, createSignal } from "solid-js";
import {
  ArrowUpRight,
  CircleCheck,
  Flame,
  Plus,
  RotateCcw,
  Save,
  Volume2,
} from "lucide-solid";
import type {
  AnalyticsSnapshot,
  AlertSoundKey,
  BackupListItem,
  DailyInsight,
  FocusRecord,
  TimerPreferences,
  TimerSnapshot,
  TodoImportance,
  TodoItem,
} from "../lib/contracts";
import { themes, type ThemeId } from "../lib/themes";
import { NightValleyDateStamp } from "./NightValleyDateStamp";

type Accessor<T> = () => T;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentDateLabel() {
  return new Date()
    .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");
}

export interface NightValleyFocusProps {
  timer: Accessor<TimerSnapshot>;
  todaySessionCount: Accessor<number>;
  timerPreferences: Accessor<TimerPreferences>;
  todos: Accessor<TodoItem[]>;
  pendingTodos: Accessor<TodoItem[]>;
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

function formatPreviewMinutes(value: number) {
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

type FocusVisualStateKey = "ready" | "running" | "paused" | "awaiting-save" | "saved" | "recovered";

interface FocusVisualState {
  key: FocusVisualStateKey;
  label: string;
  compactLabel: string;
  description: string;
}

function resolveFocusVisualState(
  snapshot: TimerSnapshot,
  hasProgress: boolean,
  savedConfirmation: boolean,
): FocusVisualState {
  if (snapshot.recoveredFromLastSession) {
    return {
      key: "recovered",
      label: "已恢复",
      compactLabel: "RECOVERED",
      description: "上次专注还没有结束，可以继续、保存或清空。",
    };
  }

  if (
    (snapshot.modeKey === "countdown" && snapshot.remainingMs === 0 && snapshot.elapsedMs > 0) ||
    (snapshot.phaseKey === "break" && snapshot.alertKey === "pomodoro_focus_complete")
  ) {
    return {
      key: "awaiting-save",
      label: "到点待保存",
      compactLabel: "SAVE REQUIRED",
      description: "时间已到，保存后会写入专注记录。",
    };
  }

  if (savedConfirmation && !hasProgress && !snapshot.isRunning) {
    return {
      key: "saved",
      label: "保存成功",
      compactLabel: "SAVED",
      description: "已保存，可以开始下一次专注。",
    };
  }

  if (snapshot.isRunning) {
    return {
      key: "running",
      label: "运行中",
      compactLabel: "RUNNING",
      description: "正在记录这次专注时间。",
    };
  }

  if (hasProgress) {
    return {
      key: "paused",
      label: "已暂停",
      compactLabel: "PAUSED",
      description: "已暂停，准备好后可以继续。",
    };
  }

  return {
    key: "ready",
    label: "未开始",
    compactLabel: "READY",
    description: "写下要专注的事，选择时长后开始。",
  };
}

export function NightValleyFocus(props: NightValleyFocusProps) {
  const visualState = createMemo(() => resolveFocusVisualState(props.timer(), props.timerHasProgress(), props.savedConfirmation()));

  const displayTime = createMemo(() => {
    if (props.timer().modeKey === "countdown" && props.countdownDraftDirty()) {
      const preview = formatPreviewMinutes(props.countdownMinutes());
      return preview.startsWith("00:") ? preview.slice(3) : preview;
    }
    const label = props.timer().elapsedLabel;
    return props.timer().modeKey === "countdown" && label.startsWith("00:") ? label.slice(3) : label;
  });

  const targetDurationLabel = createMemo(() => {
    const snapshot = props.timer();
    const minutes = snapshot.modeKey === "countdown"
      ? props.countdownMinutes()
      : snapshot.targetDurationMs !== null
        ? Math.round(snapshot.targetDurationMs / 60_000)
        : props.timerPreferences().stopwatchReminderMinutes ?? props.timerPreferences().pomodoroFocusMinutes;
    return `${minutes} 分钟`;
  });

  const displayTarget = createMemo(() => props.timer().modeKey === "countdown"
    ? `设定 ${targetDurationLabel()}`
    : `目标 ${targetDurationLabel()}`);

  const activeTodo = createMemo(() => props.todos().find((item) => item.id === props.linkedTodoId()) ?? null);
  const currentLabel = createMemo(() => props.timer().activeTaskTitle.trim() || activeTodo()?.title || "还没有指定事项");
  const modeLabel = createMemo(() => props.timer().modeKey === "countdown" ? "倒计时" : "正向计时");
  const resetLabel = createMemo(() => props.timerHasProgress() ? "重置本次专注" : "清空设置");
  const resetDescription = createMemo(() => props.timerHasProgress()
    ? "放弃当前计时并清除本次专注设置"
    : "清除当前标题、时长和待办选择");

  const chooseDuration = async (minutes: number) => {
    if (props.busy() || !props.ready() || props.timerHasProgress()) return;
    if (props.timer().modeKey !== "countdown") {
      await props.onChangeMode("countdown");
    }
    props.onCountdownMinutesChange(minutes);
    props.onCountdownDraftDirty();
  };

  return (
    <section class="nv-page nv-focus-page focus-page" aria-label="专注计时">
      <header class="nv-page-heading nv-focus-heading">
        <NightValleyDateStamp date={currentDateLabel()} />
        <h1>专注计时</h1>
        <p>写下要做的事，开始一段专注。</p>
      </header>

      <div class="nv-focus-layout">
        <section class="nv-focus-brief" aria-label="专注说明">
          <span class="nv-section-kicker">FOCUS TIMER / 专注计时</span>
          <h2>准备开始下一次专注</h2>
          <p>写下要做的事，选择时长，然后开始。完成后会自动留下记录。</p>
          <div class="nv-focus-brief__stats">
            <div><span>今天已记录</span><strong>{props.todaySessionCount()} 段</strong></div>
            <div><span>当前模式</span><strong>{modeLabel()}</strong></div>
          </div>
          <div class="nv-focus-quick" aria-label="常用专注时长">
            <span>常用时长</span>
            <div>
              <For each={[25, 45, 60]}>{(minutes) => (
                <button
                  type="button"
                  classList={{ active: props.timer().modeKey === "countdown" && props.countdownMinutes() === minutes }}
                  disabled={props.busy() || !props.ready() || props.timerHasProgress()}
                  onClick={() => void chooseDuration(minutes)}
                >{minutes} 分钟</button>
              )}</For>
            </div>
          </div>
          <button type="button" class="secondary-button nv-focus-records-link" onClick={props.onOpenRecords}>
            查看专注记录 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </section>

        <main class="nv-focus-panel nv-focus-workspace" aria-label="本次专注">
          <div class="nv-focus-panel__header">
            <div>
              <div class="nv-panel-kicker"><span class="nv-live-dot" /> 本次专注</div>
              <h2>{currentLabel()}</h2>
            </div>
            <div class="nv-focus-panel__header-actions">
              <span data-focus-state={visualState().key}>{visualState().label}</span>
              <Show when={props.timerHasProgress()}>
                <button
                  type="button"
                  class="secondary-button nv-focus-floating-link nv-focus-floating-link--header"
                  disabled={props.busy()}
                  title="隐藏主窗口，回到悬浮计时"
                  onClick={() => void props.onShowFocusFloating()}
                >
                  进入悬浮窗 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </Show>
            </div>
          </div>
          <div class="timer-readout nv-focus-panel__timer" role="timer" aria-label="这次专注计时">
            <span>{visualState().label}</span>
            <strong>{displayTime()}</strong>
            <small>{modeLabel()} · {displayTarget()}</small>
          </div>
          <div class="nv-focus-panel__session-data">
            <div><span>目标时长</span><strong>{targetDurationLabel()}</strong></div>
            <div><span>今日已完成</span><strong>{props.todaySessionCount()} 段</strong></div>
          </div>
          <p class="nv-focus-panel__status" aria-live="polite">
            <strong>{visualState().label}</strong>
            <span>{visualState().description}</span>
          </p>

          <div class="mode-switcher nv-mode-switcher" role="group" aria-label="计时模式">
            <button
              type="button"
              classList={{ active: props.timer().modeKey === "stopwatch" }}
              aria-pressed={props.timer().modeKey === "stopwatch"}
              disabled={props.busy() || !props.ready() || props.timerHasProgress()}
              onClick={() => props.onChangeMode("stopwatch")}
            >正向计时</button>
            <button
              type="button"
              classList={{ active: props.timer().modeKey === "countdown" }}
              aria-pressed={props.timer().modeKey === "countdown"}
              disabled={props.busy() || !props.ready() || props.timerHasProgress()}
              onClick={() => props.onChangeMode("countdown")}
            >倒计时</button>
          </div>

          <div class="nv-focus-field-grid">
          <label class="nv-field nv-focus-panel__title-field">
            <span>要专注什么</span>
            <input
              type="text"
              name="sessionTitle"
              autocomplete="off"
              value={props.sessionTitle()}
              placeholder="例如：完成项目方案…"
              disabled={props.busy() || !props.ready() || props.timerHasProgress()}
              onInput={(event) => {
                props.onSessionTitleDirty();
                props.onSessionTitleChange(event.currentTarget.value);
              }}
            />
          </label>

          <Show when={props.timer().modeKey === "countdown"}>
            <label class="nv-field nv-countdown-field">
              <span>专注时长</span>
              <div>
                <input
                  type="number"
                  name="countdownMinutes"
                  min="1"
                  max="720"
                  value={props.countdownMinutes()}
                  disabled={props.busy() || !props.ready() || props.timerHasProgress()}
                  onInput={(event) => {
                    props.onCountdownDraftDirty();
                    props.onCountdownMinutesChange(Number(event.currentTarget.value || 0));
                  }}
                />
                <em>分钟</em>
              </div>
            </label>
          </Show>

          <label class="nv-field">
            <span>关联待办（可选）</span>
            <select
              name="linkedTodoId"
              value={props.linkedTodoId() ?? ""}
              disabled={props.busy() || !props.ready() || props.timerHasProgress()}
              onChange={(event) => {
                const id = event.currentTarget.value ? Number(event.currentTarget.value) : null;
                const item = props.todos().find((todo) => todo.id === id);
                props.onLinkedTodoChange(id);
                props.onSessionTitleDirty();
                if (item) {
                  props.onSessionTitleChange(item.title);
                }
              }}
            >
              <option value="">不关联待办</option>
              <For each={props.pendingTodos()}>{(item) => <option value={item.id}>{item.title}</option>}</For>
            </select>
          </label>
          </div>

          <Show when={props.linkedTodoId() !== null}>
            <label class="linked-todo-option nv-linked-todo-option">
              <input
                type="checkbox"
                name="completeLinkedTodo"
                checked={props.completeLinkedTodo()}
                disabled={props.busy() || !props.ready() || props.timerHasProgress()}
                onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)}
              />
              <span>本轮完成后同时标记关联待办</span>
            </label>
          </Show>

          <div class="timer-controls nv-focus-controls">
            <Show
              when={props.timer().isRunning}
              fallback={
                <button
                  type="button"
                  class="primary-button nv-focus-primary"
                  disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)}
                  onClick={() => props.onStart()}
                >
                  {props.busy() ? props.busyLabel() : props.timerHasProgress() ? "继续" : "开始"}
                </button>
              }
            >
              <button type="button" class="primary-button nv-focus-primary" disabled={props.busy()} onClick={() => props.onPause()}>
                {props.busy() ? props.busyLabel() : "暂停"}
              </button>
            </Show>
            <Show when={props.timerHasProgress()}>
              <button type="button" class="secondary-button nv-focus-finish" disabled={props.busy() || !props.canFinish()} onClick={() => props.onFinish()}>
                <CircleCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                完成并记录
              </button>
            </Show>
          </div>
          <button
            type="button"
            class="text-button nv-focus-reset"
            disabled={props.busy() || !props.ready()}
            title={resetDescription()}
            aria-label={resetLabel()}
            onClick={() => props.onReset()}
          >
            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
            {resetLabel()}
          </button>
        </main>
      </div>
    </section>
  );
}

export interface TodoEditState {
  id: number;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}

interface TodoCardProps {
  item: TodoItem;
  editingTodo: Accessor<TodoEditState | null>;
  busy: Accessor<boolean>;
  timerHasProgress: Accessor<boolean>;
  formatTodoDue: (item: TodoItem) => string;
  importanceLabel: (value: TodoImportance) => string;
  onToggle: (id: number) => void;
  onBeginEdit: (item: TodoItem) => void;
  onUseForFocus: (item: TodoItem) => void;
  onRemove: (id: number) => void;
  onPatch: (patch: Partial<TodoEditState>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TodoCard(props: TodoCardProps) {
  const isOverdue = props.item.scheduledDate < localDateKey();

  return (
    <article classList={{ "todo-row": true, "nv-todo-card": true, "todo-row--overdue": isOverdue }}>
      <Show
        when={props.editingTodo()?.id === props.item.id}
        fallback={
          <>
            <button
              type="button"
              class="todo-check nv-todo-check"
              title="标记完成"
              aria-label={`标记“${props.item.title}”完成`}
              disabled={props.busy()}
              onClick={() => props.onToggle(props.item.id)}
            />
            <div class="nv-todo-card__copy">
              <strong title={props.item.title}>{props.item.title}</strong>
              <small>{props.formatTodoDue(props.item)} · {props.importanceLabel(props.item.importanceKey)}<Show when={isOverdue}><span class="todo-row__overdue-label">已过期</span></Show></small>
            </div>
            <div class="todo-row__actions nv-todo-card__actions">
              <button type="button" class="row-action" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button>
              <button type="button" class="row-action" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(props.item)}>专注</button>
              <button type="button" class="row-action row-action--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button>
            </div>
          </>
        }
      >
        <div class="todo-edit-form nv-todo-edit-form">
          <label><span>待办事项</span><input type="text" name={`editTodoTitle-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /></label>
          <label><span>截止日期</span><input type="date" name={`editTodoDate-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /></label>
          <label><span>时间</span><input type="time" name={`editTodoTime-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /></label>
          <label><span>重要程度</span><select name={`editTodoImportance-${props.item.id}`} value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
          <div class="todo-edit-form__actions"><button type="button" class="primary-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="text-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div>
        </div>
      </Show>
    </article>
  );
}

export interface NightValleyTodoProps {
  todos: Accessor<TodoItem[]>;
  activeTodos: Accessor<TodoItem[]>;
  overdueTodos: Accessor<TodoItem[]>;
  completedTodos: Accessor<TodoItem[]>;
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

export function NightValleyTodo(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedTodoId = createMemo(() => props.timer().linkedTodoId);
  const startItems = createMemo(() => props.activeTodos().filter((item) => item.id !== focusedTodoId()));
  const focusItems = createMemo(() => props.activeTodos().filter((item) => item.id === focusedTodoId()));
  const completionPercent = createMemo(() => {
    const total = props.todos().length;
    return total === 0 ? 0 : Math.round((props.completedTodos().length / total) * 100);
  });

  return (
    <section class="nv-page nv-todo-page todo-page" aria-label="今日待办">
      <header class="nv-page-heading nv-todo-heading">
        <NightValleyDateStamp date={currentDateLabel()} />
        <h1>今日待办</h1>
        <p>把下一步变得清楚。</p>
      </header>
      <div class="nv-todo-summary" aria-label="待办摘要">
        <span><strong>{props.activeTodos().length}</strong> 个待办</span>
        <span><strong>{focusItems().length}</strong> 个进行中</span>
        <span><strong>{props.completedTodos().length}</strong> 个已完成</span>
      </div>

      <Show
        when={createOpen()}
        fallback={<button type="button" class="nv-todo-create-trigger" onClick={() => setCreateOpen(true)}><Plus size={18} strokeWidth={1.8} aria-hidden="true" />添加待办</button>}
      >
        <form class="todo-create nv-todo-create nv-todo-create--expanded" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); }}>
          <div class="nv-todo-create__label"><Plus size={18} strokeWidth={1.8} aria-hidden="true" /><span>添加待办</span></div>
          <label><span class="sr-only">待办事项</span><input type="text" name="todoTitle" autocomplete="off" value={props.todoTitle()} placeholder="写下一件要完成的事…" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /></label>
          <label><span class="sr-only">截止日期</span><input type="date" name="todoDueDate" autocomplete="off" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /></label>
          <label><span class="sr-only">时间（可选）</span><input type="time" name="todoDueTime" autocomplete="off" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /></label>
          <label><span class="sr-only">重要程度</span><select name="todoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
          <button type="submit" class="primary-button nv-todo-create__button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "添加"}</button>
          <button type="button" class="text-button nv-todo-create__close" onClick={() => setCreateOpen(false)}>收起</button>
        </form>
      </Show>

      <section class="todo-board nv-todo-board" aria-label="待办看板">
        <section class="todo-column nv-todo-column nv-todo-column--start">
          <div class="nv-todo-column__heading"><span class="nv-column-index">01</span><div><h2>待开始</h2><small>{startItems().length} 项 · 先做最清楚的一件</small></div></div>
          <div class="nv-todo-column__list">
            <Show when={props.ready()} fallback={<p class="empty-copy">正在读取待办…</p>}>
              <For each={startItems()}>{(item) => <TodoCard item={item} editingTodo={props.editingTodo} busy={props.busy} timerHasProgress={props.timerHasProgress} formatTodoDue={props.formatTodoDue} importanceLabel={props.importanceLabel} onToggle={props.onToggle} onBeginEdit={props.onBeginEdit} onUseForFocus={props.onUseForFocus} onRemove={props.onRemove} onPatch={props.onPatch} onSave={props.onSave} onCancel={props.onCancel} />}</For>
              <Show when={startItems().length === 0 && props.overdueTodos().length === 0}><p class="empty-copy">这里还没有待开始的事项。</p></Show>
            </Show>
          </div>
          <Show when={props.ready() && props.overdueTodos().length > 0}>
            <section class="todo-status-section todo-status-section--overdue nv-overdue-section" aria-labelledby="overdue-todos-heading">
              <div class="todo-status-section__heading"><div><h2 id="overdue-todos-heading">已过期</h2><span>仍可编辑或标记完成</span></div><strong>{props.overdueTodos().length}</strong></div>
              <For each={props.overdueTodos()}>{(item) => <TodoCard item={item} editingTodo={props.editingTodo} busy={props.busy} timerHasProgress={props.timerHasProgress} formatTodoDue={props.formatTodoDue} importanceLabel={props.importanceLabel} onToggle={props.onToggle} onBeginEdit={props.onBeginEdit} onUseForFocus={props.onUseForFocus} onRemove={props.onRemove} onPatch={props.onPatch} onSave={props.onSave} onCancel={props.onCancel} />}</For>
            </section>
          </Show>
        </section>

        <section class="todo-column nv-todo-column nv-todo-column--focus">
          <div class="nv-todo-column__heading"><span class="nv-column-index">02</span><div><h2>进行中</h2><small>{focusItems().length ? "计时器正在看护它" : "从待开始挑一项"}</small></div></div>
          <div class="nv-todo-column__list">
            <Show when={focusItems().length > 0} fallback={<div class="nv-todo-empty-card"><span class="nv-todo-empty-card__orb" /><strong>还没有进行中的事项</strong><small>开始一段专注后，当前任务会留在这里。</small></div>}>
              <For each={focusItems()}>{(item) => <TodoCard item={item} editingTodo={props.editingTodo} busy={props.busy} timerHasProgress={props.timerHasProgress} formatTodoDue={props.formatTodoDue} importanceLabel={props.importanceLabel} onToggle={props.onToggle} onBeginEdit={props.onBeginEdit} onUseForFocus={props.onUseForFocus} onRemove={props.onRemove} onPatch={props.onPatch} onSave={props.onSave} onCancel={props.onCancel} />}</For>
            </Show>
          </div>
          <div class="nv-todo-column__signal"><span class="nv-live-dot" /> {props.timer().isRunning ? "正在专注" : props.timerHasProgress() ? "已暂停" : "等待下一段"}</div>
        </section>

        <section class="todo-column nv-todo-column nv-todo-column--done completed-section">
          <div class="nv-todo-column__heading"><span class="nv-column-index">03</span><div><h2>已完成</h2><small>{props.completedTodos().length} 项 · 今天留下的坐标</small></div></div>
          <div class="nv-todo-column__list">
            <Show when={props.completedTodos().length > 0} fallback={<p class="empty-copy">完成一项后，它会出现在这里。</p>}>
              <For each={props.completedTodos()}>
                {(item) => (
                  <div class="completed-row nv-completed-row">
                    <span class="completed-row__marker" aria-hidden="true">✓</span>
                    <button type="button" class="completed-row__title" disabled={props.busy()} onClick={() => props.onToggle(item.id)}>{item.title}</button>
                    <span class="completed-row__label">已完成</span>
                    <button type="button" class="row-action" disabled={props.busy()} onClick={() => props.onToggle(item.id)}>恢复</button>
                    <button type="button" class="row-action row-action--danger" disabled={props.busy()} onClick={() => props.onRemove(item.id)}>删除</button>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </section>
      </section>

      <aside class="nv-todo-focus-panel" aria-label="下一件专注">
        <div class="nv-panel-kicker"><Flame size={14} strokeWidth={1.8} aria-hidden="true" /> NEXT / 下一步</div>
        <Show when={props.activeTodos()[0]} fallback={<><h2>路径正在等你</h2><p>添加一件待办，就能从这里开始。</p></>}>
          {(item) => <><h2>{item().title}</h2><p>{props.formatTodoDue(item())}</p><button type="button" class="secondary-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(item())}>带入专注 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" /></button></>}
        </Show>
        <div class="nv-todo-focus-panel__meter"><span style={{ width: `${completionPercent()}%` }} /><small>{completionPercent()}% 今日完成</small></div>
      </aside>

      <footer class="nv-todo-footer"><div><span>今日完成度</span><strong>{completionPercent()}%</strong></div><div><span>当前路径</span><strong>{props.todos().length ? `${props.completedTodos().length} / ${props.todos().length}` : "0"}</strong></div><div class="nv-todo-footer__hint">每一个完成的事项，都会成为今天的新坐标。</div></footer>
    </section>
  );
}

export interface ArchiveDayShape extends DailyInsight {}

interface RecordGroupShape {
  date: string;
  records: FocusRecord[];
  totalDurationMs: number;
}

export interface NightValleyRecordsProps {
  analytics: Accessor<AnalyticsSnapshot | null>;
  records: Accessor<FocusRecord[]>;
  archiveDays: Accessor<ArchiveDayShape[]>;
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
  onPatchEdit: (value: string) => void;
  onSaveEdit: () => void | Promise<void>;
  onCancelEdit: () => void;
  onRemove: (id: number) => void | Promise<void>;
}

export function NightValleyRecords(props: NightValleyRecordsProps) {
  const archiveRangeLabel = () => {
    const days = props.archiveDays();
    if (days.length === 0) {
      return "暂无日期";
    }

    return `${props.formatArchiveRangeDate(days[0].date)} — ${props.formatArchiveRangeDate(days[days.length - 1].date)}`;
  };
  const recentWeekAverageDurationLabel = () => props.formatDurationMs(props.recentWeekDurationMs() / 7);
  const distributionBarHeight = (day: ArchiveDayShape) => {
    if (day.totalDurationMs === 0) {
      return 0;
    }

    const maxDurationMs = Math.max(1, ...props.archiveDays().map((item) => item.totalDurationMs));
    return Math.max(10, Math.round((day.totalDurationMs / maxDurationMs) * 100));
  };

  return (
    <section class="nv-page nv-records-page records-page" aria-label="专注记录">
      <header class="nv-page-heading nv-records-heading">
        <NightValleyDateStamp date={currentDateLabel()} />
        <h1>专注记录</h1>
        <p>看见投入留下的轨迹。</p>
      </header>

      <section class="records-archive nv-records-archive" aria-label="个人专注档案">
        <div class="records-archive__summary">
          <div class="records-archive__summary-copy"><span class="records-archive__kicker"><span aria-hidden="true" /> ARCHIVE / PERSONAL RHYTHM</span><h2>把时间连成一条路</h2><p>每个节点，都是你回来过的证据。</p></div>
          <div class="records-archive__metric"><span>累计专注</span><strong>{props.analytics()?.totalFocusDurationLabel ?? "00:00:00"}</strong><small>{props.analytics()?.sessionCount ?? 0} 条记录</small></div>
          <div class="records-archive__metric"><span>今天留下</span><strong>{props.analytics()?.todayFocusDurationLabel ?? "00:00:00"}</strong><small>{props.analytics()?.todaySessionCount ?? 0} 段专注</small></div>
          <button type="button" class="secondary-button nv-export-button" disabled title="导出记录尚未接入">导出记录 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>

        <div class="nv-records-top-actions" aria-label="记录范围和导出">
          <button type="button" class="nv-records-range" disabled title="日期范围筛选尚未接入" aria-label={`记录范围 ${archiveRangeLabel()}`}><span aria-hidden="true">▦</span> {archiveRangeLabel()} <span aria-hidden="true">⌄</span></button>
          <button type="button" class="secondary-button nv-export-button" disabled title="导出记录尚未接入">导出记录 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>

        <section class="records-archive__timeline nv-records-chart" aria-label="最近七天专注轨迹">
          <div class="nv-records-chart__heading"><span>本周专注总览</span><i aria-hidden="true">i</i></div>
          <div class="nv-records-chart__labels"><span>投入强度</span><span>{props.recentWeekActiveDays()} 天有投入 · 最近 7 天</span></div>
          <div class="records-archive__map">
            <div class="records-archive__map-glow" aria-hidden="true" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="最近七天专注趋势">
              <path class="records-archive__route-shadow" d={props.archivePath()} />
              <path class="records-archive__route-line" d={props.archivePath()} />
              <path class="records-archive__route-dash" d={props.archivePath()} />
            </svg>
            <div class="nv-records-chart__grid" aria-hidden="true"><i /><i /><i /></div>
            <For each={props.archiveDays()}>
              {(day, index) => {
                const left = props.archiveDays().length <= 1 ? 50 : 7 + (86 * index()) / (props.archiveDays().length - 1);
                const intensity = props.archiveDays().length === 0 ? 0 : day.totalDurationMs / Math.max(1, ...props.archiveDays().map((item) => item.totalDurationMs));
                const top = 70 - intensity * 42;
                return (
                  <button
                    type="button"
                    classList={{ "records-archive__node": true, "records-archive__node--selected": props.selectedArchiveDate() === day.date, "records-archive__node--empty": day.totalDurationMs === 0 }}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onClick={() => props.onSelectDate(day.date)}
                    aria-label={`${props.formatAnalyticsDate(day.date)} · ${day.totalDurationLabel}`}
                  >
                    <span class="records-archive__node-label"><b>{props.formatAnalyticsDate(day.date)}</b><small>{day.totalDurationLabel}</small></span>
                    <span class="records-archive__node-orb" aria-hidden="true" />
                  </button>
                );
              }}
            </For>
          </div>
          <div class="records-archive__timeline-footer"><span>最近 7 天</span><strong>{props.recentWeekActiveDays()} 天有投入</strong><span>共 {props.formatDurationMs(props.recentWeekDurationMs())}</span></div>
        </section>

        <section class="records-stats records-archive__stats" aria-label="专注概览">
          <div><span>活跃日</span><strong>{props.analytics()?.activeDays ?? 0}</strong><small>活跃日平均 {props.analytics()?.averageDailyDurationLabel ?? "00:00:00"}</small></div>
          <div><span>连续回来</span><strong>{props.analytics()?.currentStreakDays ?? 0} 天</strong><small>保持你的节奏</small></div>
          <div><span>独立专注</span><strong>{props.analytics()?.independentSessionCount ?? 0}</strong><small>没有关联待办</small></div>
          <div class="records-stats__progress"><div class="records-stats__progress-heading"><span>待办完成轨迹</span><strong>{props.todoCompletionPercent()}%</strong></div><div class="records-progress" aria-hidden="true"><span style={{ width: `${props.todoCompletionPercent()}%` }} /></div><small>完成的事项会回到今日路径。</small></div>
        </section>

        <div class="records-archive__body nv-records-lower">
          <aside class="records-archive__detail nv-records-detail" aria-label="选中日期详情">
            <div class="records-archive__detail-heading"><span class="records-archive__detail-signal" aria-hidden="true" /><span>{props.selectedArchiveDay() ? props.formatRecordDay(props.selectedArchiveDay()!.date) : "还没有日期"}</span></div>
            <h2>{props.selectedArchiveDay()?.sessionCount ?? 0} 段专注</h2>
            <p>{props.selectedArchiveDay()?.totalDurationLabel ?? "00:00:00"} · {props.selectedArchiveRecords().length} 条可回看记录</p>
            <div class="records-hero__dial" aria-label={`已完成 ${props.selectedArchiveDay()?.sessionCount ?? 0} 段专注`}><div class="records-hero__dial-ring records-hero__dial-ring--outer" /><div class="records-hero__dial-ring records-hero__dial-ring--inner" /><div class="records-hero__dial-core"><span>FOCUS LOG</span><strong>{props.selectedArchiveDay()?.sessionCount ?? 0}</strong><small>段专注</small></div><i class="records-hero__dial-marker" aria-hidden="true" /></div>
            <button type="button" class="records-archive__detail-action" disabled={props.selectedArchiveRecords().length === 0} onClick={() => document.querySelector(".record-history")?.scrollIntoView({ behavior: "smooth", block: "start" })}>查看这一天的记录 <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" /></button>
          </aside>
          <section class="nv-records-distribution" aria-label="专注分布"><span class="nv-section-kicker">DISTRIBUTION / 分布</span><h2>把时间留给真正重要的事。</h2><div class="nv-records-distribution__bars"><For each={props.archiveDays()}>{(day) => <span title={`${props.formatAnalyticsDate(day.date)} ${day.totalDurationLabel}`} style={{ height: `${distributionBarHeight(day)}%` }} />}</For></div><small>节点高度按当天真实投入时长变化。</small></section>
        </div>

      </section>

      <section class="records-trend nv-records-trend" aria-label="最近趋势"><div><span class="nv-section-kicker">TREND / RECENT RHYTHM</span><h2>最近 7 天，平均每天 {recentWeekAverageDurationLabel()}。</h2></div><div class="records-trend__rail"><span style={{ width: `${Math.round((props.recentWeekActiveDays() / 7) * 100)}%` }} /><i style={{ left: `${Math.round((props.recentWeekActiveDays() / 7) * 100)}%` }} /></div><small>不需要一次走很远，只要继续回来。</small></section>

      <section class="record-history nv-record-history" aria-label="全部专注记录">
        <div class="record-history__heading"><div><h2>全部记录</h2><span>按日期收纳，想回看时再展开</span></div><strong>{props.records().length} 轮</strong></div>
        <div class="record-list">
          <Show when={!props.ready()}><p class="load-copy">正在读取专注记录…</p></Show>
          <Show when={props.ready() && props.records().length > 0}>
            <For each={props.recordGroups()}>
              {(group, groupIndex) => (
                <details class="record-day" open={groupIndex() === 0}>
                  <summary class="record-day__summary"><span class="record-day__date"><strong>{props.formatRecordDay(group.date)}</strong><small>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</small></span><span class="record-day__chevron" aria-hidden="true">⌄</span></summary>
                  <div class="record-day__items">
                    <For each={group.records}>
                      {(record) => (
                        <article class="record-row">
                          <Show
                            when={props.editingRecord()?.id === record.id}
                            fallback={<><div class="record-row__details"><div class="record-row__title-line"><strong title={record.title}>{record.title}</strong><span class="record-row__mode">{record.modeLabel}</span></div><small>{props.formatRecordDate(record)}</small></div><b>{record.durationLabel}</b><div class="record-row__actions"><button type="button" class="row-action" aria-label={`编辑记录“${record.title}”`} disabled={props.busy()} onClick={() => props.onBeginEdit(record)}>编辑</button><button type="button" class="row-action row-action--danger" aria-label={`删除记录“${record.title}”`} disabled={props.busy()} onClick={() => void props.onRemove(record.id)}>删除</button></div></>}
                          >
                            <div class="record-row__details record-row__details--editing"><label class="sr-only" for={`editRecordTitle-${record.id}`}>记录名称</label><input id={`editRecordTitle-${record.id}`} type="text" name={`editRecordTitle-${record.id}`} autocomplete="off" maxlength="200" autofocus aria-label="记录名称" value={props.editingRecord()?.title ?? ""} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void props.onSaveEdit(); } else if (event.key === "Escape") { event.preventDefault(); props.onCancelEdit(); } }} /><small>{props.formatRecordDate(record)}</small></div><b>{record.durationLabel}</b><div class="record-row__actions"><button type="button" class="primary-button" disabled={props.busy()} onClick={() => void props.onSaveEdit()}>保存</button><button type="button" class="text-button" disabled={props.busy()} onClick={props.onCancelEdit}>取消</button></div>
                          </Show>
                        </article>
                      )}
                    </For>
                  </div>
                </details>
              )}
            </For>
          </Show>
          <Show when={props.ready() && props.records().length === 0}><p class="empty-copy">完成一次计时后，记录会显示在这里。</p></Show>
        </div>
      </section>
    </section>
  );
}

export interface NightValleySettingsProps {
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
  onThemeSelect: (value: ThemeId) => void;
  onVisualIntensityChange: (value: number) => void;
  onMotionIntensityChange: (value: number) => void;
  onDensityChange: (value: "roomy" | "compact") => void;
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

export function NightValleySettings(props: NightValleySettingsProps) {
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  let customAlertSoundInput: HTMLInputElement | undefined;
  return (
    <section class="nv-page nv-settings-page settings-page" aria-label="设置">
      <header class="nv-page-heading nv-settings-heading"><NightValleyDateStamp date={currentDateLabel()} /><h1>设置</h1><p>调整你的专注环境。</p></header>
      <div class="nv-settings-layout">
        <nav class="settings-subnav nv-settings-subnav" aria-label="设置分组"><a href="#nv-appearance">01 <span>外观</span></a><a href="#nv-behavior">02 <span>行为</span></a><a href="#nv-audio">03 <span>音效</span></a><a href="#nv-shortcuts">04 <span>快捷键</span></a><a href="#nv-backup">05 <span>本地备份</span></a></nav>
        <div class="nv-settings-panels">
          <section id="nv-appearance" class="settings-section nv-settings-panel nv-settings-panel--appearance">
            <div class="settings-section__heading"><span class="nv-section-kicker">APPEARANCE / 01</span><h2>外观</h2><p>主题、强调色、字体和页面密度。</p></div>
            <div class="nv-theme-grid" aria-label="主题选择">
              <For each={themes}>{(theme) => <button type="button" classList={{ "nv-theme-card": true, "is-selected": props.themeId() === theme.id, "is-disabled": !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} title={theme.implemented ? `使用${theme.name}主题` : `${theme.name}主题尚未实现`} onClick={() => props.onThemeSelect(theme.id)}><img src={theme.preview} alt={`${theme.englishName} 概念预览`} /><span class="nv-theme-card__shade" /><strong>{theme.name}</strong><small>{theme.implemented ? "已实现" : "尚未实现"}</small></button>}</For>
            </div>
            <div class="nv-setting-sliders"><label><span>视觉强调 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} aria-label="视觉强调" onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>动效强度 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} aria-label="动效强度" onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label class="nv-density-choice"><span>页面密度</span><div><button type="button" classList={{ active: props.density() === "roomy" }} aria-pressed={props.density() === "roomy"} onClick={() => props.onDensityChange("roomy")}>舒展</button><button type="button" classList={{ active: props.density() === "compact" }} aria-pressed={props.density() === "compact"} onClick={() => props.onDensityChange("compact")}>紧凑</button></div></label></div>
          </section>

          <section id="nv-behavior" class="settings-section nv-settings-panel nv-settings-panel--behavior"><div class="settings-section__heading"><span class="nv-section-kicker">BEHAVIOR / 02</span><h2>结束提醒</h2><p>时间到时，用你愿意接受的方式回来。</p></div><div class="nv-toggle-row"><label><input type="checkbox" name="toastReminderEnabled" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ toastReminderEnabled: event.currentTarget.checked })} /><span><strong>应用内弹窗</strong><small>在当前窗口显示提醒。</small></span></label><label><input type="checkbox" name="windowAttentionReminderEnabled" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ windowAttentionReminderEnabled: event.currentTarget.checked })} /><span><strong>任务栏闪烁</strong><small>窗口在后台时提醒你。</small></span></label><label><input type="checkbox" name="soundReminderEnabled" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ soundReminderEnabled: event.currentTarget.checked })} /><span><strong>声音提醒</strong><small>播放一次短促音效。</small></span></label></div></section>

          <section id="nv-audio" class="settings-section nv-settings-panel nv-settings-panel--audio"><div class="settings-section__heading"><span class="nv-section-kicker">AUDIO / 03</span><h2>音效</h2></div><div class="nv-audio-row"><label class="settings-select"><span>提醒音效</span><select name="alertSoundKey" value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">胆子真是肥嘟嘟的（老牧师原声）</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效{props.customAlertSoundName() ? ` · ${props.customAlertSoundName()}` : " · 请先导入"}</option></select></label><div class="sound-picker__actions"><button type="button" class="secondary-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} strokeWidth={1.8} aria-hidden="true" />试听</button><button type="button" class="secondary-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入音效</button><Show when={props.customAlertSoundName()}><button type="button" class="text-button" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>移除自定义</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></section>

          <section id="nv-shortcuts" class="settings-section nv-settings-panel nv-settings-panel--shortcuts"><div class="settings-section__heading"><span class="nv-section-kicker">SHORTCUTS / 04</span><h2>快捷键</h2><p>把最常用的动作留在手边。</p></div><div class="nv-shortcut-list"><div><span>打开命令面板</span><kbd>Ctrl</kbd><i>+</i><kbd>K</kbd></div><div><span>开始 / 继续当前专注</span><kbd>Ctrl</kbd><i>+</i><kbd>Enter</kbd></div><div class="is-disabled"><span>导出记录 <small>尚未接入</small></span><kbd>—</kbd></div></div></section>

          <section id="nv-backup" class="settings-section nv-settings-panel nv-settings-panel--backup"><div class="settings-section__heading"><span class="nv-section-kicker">LOCAL SAFETY / 05</span><h2>本地备份</h2><p>待办、专注记录和未完成的计时状态都只保存在这台电脑上。</p></div><div class="settings-actions"><button type="button" class="primary-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="secondary-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开备份目录</button></div><Show when={props.lastBackupPath()}><p class="settings-path">最近备份：{props.lastBackupPath()}</p></Show></section>

          <section class="settings-section nv-settings-panel nv-settings-panel--restore"><div class="settings-section__heading"><h2>恢复备份</h2><p>导入会先自动保存一份回滚备份。</p></div><Show when={props.backupLoadState() === "loading"}><p class="load-copy">正在读取备份列表…</p></Show><Show when={props.backupLoadState() === "error"}><div class="load-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="secondary-button" disabled={props.busy()} onClick={() => void props.onLoadBackups()}>重试读取</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="settings-select"><span>选择备份</span><select name="backupFile" value={props.selectedBackupFile()} disabled={props.busy()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{new Date(backup.exportedAt).toLocaleString("zh-CN")} · {backup.todoCount} 项待办 · {backup.focusRecordCount} 条记录{backup.migrationNeeded ? " · 旧版" : ""}</option>}</For></select></label><Show when={props.selectedBackup()}>{(backup) => <div class="backup-preview"><div><span>备份版本</span><strong>{backup().migrationNeeded ? "旧版 · 导入时升级" : `v${backup().schemaVersion}`}</strong></div><div><span>数据内容</span><strong>{backup().todoCount} 项待办 · {backup().focusRecordCount} 条记录</strong></div></div>}</Show><button type="button" class="secondary-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show><Show when={props.backupLoadState() === "ready" && props.backups().length === 0}><p class="empty-copy">还没有备份。建议在清理数据前先导出一份。</p></Show></section>

          <section class="settings-section settings-section--danger nv-settings-panel nv-settings-panel--danger"><div class="settings-section__heading"><h2>清空当前数据</h2><p>不会删除已经导出的备份。</p></div><button type="button" class="secondary-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空当前数据</button></section>
        </div>
        <aside class="nv-settings-preview" aria-label="主题实时预览"><div class="nv-settings-preview__screen"><div class="nv-preview-top"><span>{activeTheme().englishName}</span><strong>FOCUS</strong></div><div class="nv-preview-route"><span /><i /><b /></div><div class="nv-preview-card"><small>当前一段</small><strong>{activeTheme().name}主题</strong><span>预览实时更新</span></div><div class="nv-preview-orb" /></div><div class="nv-settings-preview__meta"><span>LIVE PREVIEW</span><strong>{activeTheme().name}</strong><small>{activeTheme().description}</small></div><button type="button" class="primary-button nv-settings-save" aria-label="保存外观设置" onClick={props.onSaveVisualSettings}><Save size={16} strokeWidth={1.8} aria-hidden="true" />保存设置</button><p class="nv-settings-saved"><span />预览实时更新 · 点击保存后保留</p></aside>
      </div>
    </section>
  );
}
