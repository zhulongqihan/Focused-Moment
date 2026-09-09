import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  Keyboard,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Volume2,
  X,
} from "lucide-solid";
import type { AlertSoundKey, AnalyticsSnapshot, FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";
import { themes } from "../lib/themes";
import type { TodayDashboardProps } from "./TodayDashboard";
import type {
  NightValleyFocusProps,
  NightValleyRecordsProps,
  NightValleySettingsProps,
  NightValleyTodoProps,
} from "./NightValleyViews";
import "./GraphiteConsoleViews.css";

function gcDate(value: string) {
  return value.replace(/-/g, " / ");
}

function gcLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function gcTime(record: FocusRecord) {
  return record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "--:--";
}

function gcTimerLabel(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (snapshot.isRunning) return "运行中";
  if (hasProgress) return "已暂停";
  if (snapshot.modeKey === "countdown" && snapshot.remainingMs === 0) return "待保存";
  return "准备开始";
}

function gcProgress(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (!hasProgress) return 0;
  if (snapshot.modeKey === "countdown" && snapshot.targetDurationMs && snapshot.remainingMs !== null) {
    return Math.min(1, Math.max(0, 1 - snapshot.remainingMs / snapshot.targetDurationMs));
  }
  return Math.min(1, Math.max(0, snapshot.elapsedMs / Math.max(snapshot.targetDurationMs ?? 45 * 60 * 1000, 45 * 60 * 1000)));
}

function gcAnalytics(analytics: AnalyticsSnapshot | null, key: keyof AnalyticsSnapshot, fallback = "0") {
  const value = analytics?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

function gcImportance(value: TodoImportance) {
  return value === "high" ? "P1" : value === "medium" ? "P2" : "P3";
}

function gcFocusBand(hour: number) {
  if (hour < 11) return { key: "morning", label: "清晨", range: "05:00—11:00" };
  if (hour < 17) return { key: "midday", label: "午间", range: "11:00—17:00" };
  return { key: "evening", label: "夜晚", range: "17:00—23:00" };
}

function GcScrew(props: { class?: string }) {
  return <span class={`gc-screw ${props.class ?? ""}`} aria-hidden="true" />;
}

function GcPanel(props: { title: string; code?: string; class?: string; children: any }) {
  return (
    <section class={`gc-panel ${props.class ?? ""}`}>
      <GcScrew class="gc-screw--tl" />
      <GcScrew class="gc-screw--tr" />
      <GcScrew class="gc-screw--bl" />
      <GcScrew class="gc-screw--br" />
      <header class="gc-panel__heading"><span>{props.title}</span><small>{props.code ?? "SYS / 03"}</small></header>
      {props.children}
    </section>
  );
}

function GcStatusStrip(props: { analytics: () => AnalyticsSnapshot | null; timer: () => TimerSnapshot }) {
  const timer = () => props.timer();
  return (
    <footer class="gc-status-strip" aria-label="系统状态">
      <div class="gc-status-strip__label"><span class="gc-led gc-led--lime" /> SYSTEM STATUS <strong>OPERATIONAL</strong></div>
      <div><span>FOCUS TIME</span><strong>{gcAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong><i class="gc-meter"><b style={{ width: timer().isRunning ? "78%" : "18%" }} /></i></div>
      <div><span>SESSIONS</span><strong>{gcAnalytics(props.analytics(), "todaySessionCount", "0")}</strong><i class="gc-meter"><b style={{ width: `${Math.min(100, (props.analytics()?.todaySessionCount ?? 0) * 18)}%` }} /></i></div>
      <div><span>ENGINE</span><strong>{timer().isRunning ? "RUN" : gcTimerLabel(timer(), timer().elapsedMs > 0)}</strong><i class="gc-meter"><b style={{ width: timer().isRunning ? "78%" : timer().elapsedMs > 0 ? "42%" : "8%" }} /></i></div>
      <div><span>STORE</span><strong>LOCAL</strong><span class="gc-led gc-led--lime" /></div>
    </footer>
  );
}

export function GraphiteConsoleToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const sequence = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].slice(0, 7));
  const sequenceSlots = createMemo(() => Array.from({ length: 7 }, (_, index) => sequence()[index] ?? null));
  const activeIndex = createMemo(() => props.todayCompletedTodos().length);
  const nextTodo = createMemo(() => props.nextTodo());

  return (
    <section class="gc-page gc-today-page" aria-label="今日节奏调度">
      <header class="gc-page-head gc-page-head--split">
        <div class="gc-head-identity"><span class="gc-date-code">DAY ID</span><strong>{props.todayDate}</strong><small>{props.todayLabel.match(/周[一二三四五六日天]/)?.[0] ?? "TODAY"}</small></div>
        <div class="gc-head-title"><span class="gc-date-code">CONTROL SURFACE / DAILY ROUTE</span><h1>TODAY <em>/ 节奏调度</em></h1><p>把注意力排成可执行的序列。</p></div>
        <div class="gc-head-readout"><span>STREAK</span><strong>{String(streak()).padStart(2, "0")}</strong><small>DAYS <i class="gc-led gc-led--lime" /></small></div>
      </header>

      <div class="gc-today-layout">
        <GcPanel title="DAY SEQUENCE MATRIX" code="GRID REF. / T-0905" class="gc-sequence-panel">
          <div class="gc-time-ruler"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
          <div class="gc-sequence-grid">
            <Show when={props.ready()} fallback={<div class="gc-empty-console">正在同步今日序列…</div>}>
              <For each={sequenceSlots()}>
                {(item, index) => {
                  const completed = item?.isCompleted ?? false;
                  const active = Boolean(item) && index() === activeIndex();
                  return (
                    <Show when={item} fallback={<div class="gc-sequence-row gc-sequence-row--empty" aria-label={`序列槽位 ${index() + 1} 尚未排定`}>
                      <span class="gc-sequence-row__index">{String(index() + 1).padStart(2, "0")}<small>SEQ-{String(index() + 1).padStart(2, "0")}</small></span>
                      <span class="gc-sequence-row__icon"><CircleDot size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                      <span class="gc-sequence-row__content"><time>--:--</time><strong>OPEN SLOT / 待排定</strong><small>从待办队列分配一项任务</small></span>
                      <span class="gc-sequence-row__state">空闲<i class="gc-led" /></span>
                    </div>}>
                      {(resolvedItem) => <button type="button" classList={{ "gc-sequence-row": true, "is-done": completed, "is-active": active }} disabled={props.busy() || completed || props.timerHasProgress()} onClick={() => props.onUseTodo(resolvedItem())}>
                        <span class="gc-sequence-row__index">{String(index() + 1).padStart(2, "0")}<small>SEQ-{String(index() + 1).padStart(2, "0")}</small></span>
                        <span class="gc-sequence-row__icon"><CircleDot size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                        <span class="gc-sequence-row__content"><time>{resolvedItem().scheduledTime || "--:--"}</time><strong>{resolvedItem().title}</strong><small>{props.formatTodoDue(resolvedItem())}</small></span>
                        <span class="gc-sequence-row__state">{completed ? "完成" : active ? "进行中" : "等待"}<i class="gc-led" /></span>
                      </button>}
                    </Show>
                  );
                }}
              </For>
            </Show>
          </div>
          <div class="gc-sequence-legend"><span><i class="gc-line gc-line--lime" /> 已完成</span><span><i class="gc-line gc-line--orange" /> 进行中</span><span><i class="gc-line" /> 待执行</span><small>TIME GRID · 24H / 1H STEP</small></div>
        </GcPanel>

        <GcPanel title="NEXT OPERATION" code="AUTO / 01" class="gc-operation-panel">
          <Show when={nextTodo()} fallback={<div class="gc-operation-empty"><span>QUEUE EMPTY</span><h2>等待下一件事</h2><p>把一个念头放进待办队列。</p><button type="button" class="gc-lime-button" onClick={props.onOpenTodos}><Plus size={17} aria-hidden="true" /> 添加待办</button></div>}>
            {(item) => <div class="gc-operation-card"><span class="gc-card-kicker">NEXT FOCUS</span><h2>{item().title}</h2><div class="gc-operation-meta"><span>DURATION</span><strong>{props.defaultFocusMinutes()} <small>MIN</small></strong></div><div class="gc-operation-meta"><span>NOTE</span><p>{props.formatTodoDue(item())}</p></div><div class="gc-operation-status"><span><i class="gc-led gc-led--orange" /> STATUS</span><strong>QUEUED</strong></div><button type="button" class="gc-lime-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注 <ArrowRight size={16} aria-hidden="true" /></button><div class="gc-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>快捷键</small></div></div>}
          </Show>
          <div class="gc-operation-footer"><span>FOCUS MODULE</span><strong>STANDARD MODE</strong><i class="gc-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /><b /></i></div>
        </GcPanel>
      </div>

      <section class="gc-today-footer">
        <div><span>今日完成</span><strong>{String(props.todayCompletedTodos().length).padStart(2, "0")}</strong><small>段 · 继续运行</small></div>
        <div><span>今日专注</span><strong>{gcAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong></div>
        <div><span>累计记录</span><strong>{gcAnalytics(props.analytics(), "sessionCount", "0")}</strong></div>
        <div><span>状态</span><strong>{gcTimerLabel(props.timer(), props.timerHasProgress())}</strong><button type="button" class="gc-inline-button" onClick={props.onOpenRecords}>查看记录 <ChevronRight size={14} aria-hidden="true" /></button></div>
      </section>
      <GcStatusStrip analytics={props.analytics} timer={props.timer} />
    </section>
  );
}

export function GraphiteConsoleFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => props.timer().modeKey === "countdown" && props.countdownDraftDirty() ? `${String(Math.floor(props.countdownMinutes() / 60)).padStart(2, "0")}:${String(props.countdownMinutes() % 60).padStart(2, "0")}:00` : props.timer().elapsedLabel);
  const progress = createMemo(() => gcProgress(props.timer(), props.timerHasProgress()));
  const currentTitle = createMemo(() => props.sessionTitle().trim() || props.timer().activeTaskTitle || "未命名专注");
  const recentRecords = createMemo(() => props.todos().slice(0, 3));
  const stateLabel = createMemo(() => gcTimerLabel(props.timer(), props.timerHasProgress()));

  function updateLinkedTodo(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) props.onSessionTitleChange(item.title);
  }

  return (
    <section class="gc-page gc-focus-page" aria-label="专注计时控制台">
      <header class="gc-page-head"><div><span class="gc-date-code">FOCUS ENGINE / SESSION PROFILE</span><h1>TIMER <em>/ 专注计时</em></h1><p>为这一段注意力设定明确边界。</p></div><div class="gc-head-status"><i class="gc-led gc-led--lime" /> SYS READY <strong>{props.timer().mode.toUpperCase()}</strong></div></header>
      <div class="gc-focus-layout">
        <GcPanel title="RUN LOG" code="RECENT / 03" class="gc-run-log">
          <p>最近的专注记录</p>
          <For each={recentRecords()}>{(item, index) => <div class="gc-run-item"><span>{String(index() + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.scheduledTime || "--:--"}</small></div><i class="gc-ring-dot" /></div>}</For>
          <Show when={recentRecords().length === 0}><div class="gc-empty-console">暂无最近记录</div></Show>
          <button type="button" class="gc-quiet-button" onClick={props.onOpenRecords}>查看更多记录 <ChevronRight size={14} aria-hidden="true" /></button>
        </GcPanel>

        <section class="gc-dial-module" aria-label="计时器">
          <div class="gc-dial" style={{ "--gc-progress": `${progress() * 100}%` }}>
            <div class="gc-dial__ticks" aria-hidden="true"><For each={Array.from({ length: 36 })}>{(_, index) => <i style={{ transform: `rotate(${index() * 10}deg)` }} />}</For></div>
            <div class="gc-dial__face"><span>TIMER</span><h2>{currentTitle()}</h2><strong>{displayTime()}</strong><small><i class="gc-led gc-led--lime" /> {stateLabel()}</small><span class="gc-dial__needle" style={{ transform: `rotate(${progress() * 300 - 150}deg)` }} /></div>
          </div>
          <div class="gc-dial-controls"><Show when={props.timer().isRunning} fallback={<button type="button" class="gc-lime-button gc-lime-button--wide" disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}><Play size={18} fill="currentColor" aria-hidden="true" /> {props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}><button type="button" class="gc-lime-button gc-lime-button--wide" disabled={props.busy()} onClick={() => void props.onPause()}><Pause size={18} fill="currentColor" aria-hidden="true" /> 暂停本段</button></Show><div class="gc-round-buttons"><button type="button" class="gc-dark-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}><CheckCircle2 size={16} aria-hidden="true" /> 完成并记录</button><button type="button" class="gc-dark-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={15} aria-hidden="true" /> 重置</button></div></div>
        </section>

        <GcPanel title="SESSION PROFILE" code="CFG / ACTIVE" class="gc-session-profile">
          <label class="gc-console-field"><span>模式 / MODE</span><div class="gc-mode-buttons"><button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div></label>
          <label class="gc-console-field"><span>本次专注 / TITLE</span><input type="text" name="graphiteSessionTitle" value={props.sessionTitle()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} placeholder="输入本次专注的意图" onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
          <Show when={props.timer().modeKey === "countdown"}><label class="gc-console-field"><span>时长 / PRESET</span><div class="gc-number-field"><input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><b>MIN</b></div></label></Show>
          <label class="gc-console-field"><span>关联待办 / LINK</span><select value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => updateLinkedTodo(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
          <Show when={props.linkedTodoId() !== null}><label class="gc-check-row"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={props.busy() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成本段时标记待办</span></label></Show>
          <div class="gc-profile-note"><span class="gc-led gc-led--orange" /> {props.timer().modeSwitchHint ?? "专注配置已就绪"}</div>
        </GcPanel>
      </div>
      <section class="gc-focus-bottom"><div><span>今日已专注</span><strong>{props.timer().completedFocusCount}</strong><small>段</small></div><div><span>待办连接</span><strong>{props.linkedTodoId() === null ? "FREE" : "LINKED"}</strong><small>{props.linkedTodoId() === null ? "未关联" : "已关联"}</small></div><div><span>当前状态</span><strong>{stateLabel()}</strong></div><div class="gc-focus-key"><Keyboard size={15} aria-hidden="true" /><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>开始 / 继续</small></div></section>
    </section>
  );
}

interface GraphiteTodoCardProps {
  item: TodoItem;
  editingTodo: NightValleyTodoProps["editingTodo"];
  busy: NightValleyTodoProps["busy"];
  timerHasProgress: NightValleyTodoProps["timerHasProgress"];
  formatTodoDue: NightValleyTodoProps["formatTodoDue"];
  importanceLabel: NightValleyTodoProps["importanceLabel"];
  onToggle: NightValleyTodoProps["onToggle"];
  onBeginEdit: NightValleyTodoProps["onBeginEdit"];
  onUseForFocus: NightValleyTodoProps["onUseForFocus"];
  onRemove: NightValleyTodoProps["onRemove"];
  onPatch: NightValleyTodoProps["onPatch"];
  onSave: NightValleyTodoProps["onSave"];
  onCancel: NightValleyTodoProps["onCancel"];
}

function GraphiteTodoCard(props: GraphiteTodoCardProps) {
  const editing = createMemo(() => props.editingTodo()?.id === props.item.id);
  return (
    <article classList={{ "gc-todo-card": true, "is-editing": editing(), "is-complete": props.item.isCompleted }}>
      <span class="gc-todo-card__number">{String(props.item.id).padStart(2, "0")}</span>
      <Show when={!editing()} fallback={<div class="gc-edit-grid"><input aria-label="待办事项" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /><input aria-label="截止日期" type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /><input aria-label="时间" type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /><select aria-label="重要程度" value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select><div><button type="button" class="gc-inline-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="gc-quiet-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>}>
        <button type="button" class="gc-todo-check" aria-label={props.item.isCompleted ? "恢复待办" : "完成待办"} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}>{props.item.isCompleted ? <Check size={15} aria-hidden="true" /> : <span />}</button>
        <div class="gc-todo-card__body"><strong>{props.item.title}</strong><small>{props.formatTodoDue(props.item)}</small><span>{props.importanceLabel(props.item.importanceKey)} · {gcImportance(props.item.importanceKey)}</span></div>
        <div class="gc-todo-card__actions"><button type="button" class="gc-quiet-button" disabled={props.busy() || props.timerHasProgress() || props.item.isCompleted} onClick={() => props.onUseForFocus(props.item)}>专注</button><button type="button" class="gc-quiet-button" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="gc-quiet-button gc-quiet-button--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button></div>
      </Show>
    </article>
  );
}

export function GraphiteConsoleTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedId = createMemo(() => props.timer().linkedTodoId);
  const queued = createMemo(() => props.activeTodos().filter((item) => item.id !== focusedId()));
  const active = createMemo(() => props.activeTodos().filter((item) => item.id === focusedId()));
  const completion = createMemo(() => props.todos().length === 0 ? 0 : Math.round((props.completedTodos().length / props.todos().length) * 100));
  const rowProps = { editingTodo: props.editingTodo, busy: props.busy, timerHasProgress: props.timerHasProgress, formatTodoDue: props.formatTodoDue, importanceLabel: props.importanceLabel, onToggle: props.onToggle, onBeginEdit: props.onBeginEdit, onUseForFocus: props.onUseForFocus, onRemove: props.onRemove, onPatch: props.onPatch, onSave: props.onSave, onCancel: props.onCancel };

  return (
    <section class="gc-page gc-todos-page" aria-label="任务阵列">
      <header class="gc-page-head gc-page-head--split"><div><span class="gc-date-code">GRID / 24 × 06 · {gcDate(gcLocalDateKey())}</span><h1>TASK ARRAY <em>/ 任务阵列</em></h1><p>专注执行，精确交付。</p></div><button type="button" class="gc-lime-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} {createOpen() ? "收起" : "ADD TASK"}</button></header>
      <Show when={createOpen()}><form class="gc-create-task" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setCreateOpen(false); }}><span class="gc-panel-label">QUEUE BUFFER / NEW</span><input type="text" name="graphiteTodoTitle" value={props.todoTitle()} placeholder="输入下一件要完成的事" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /><input type="date" name="graphiteTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /><input type="time" name="graphiteTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /><select name="graphiteTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">P1 高</option><option value="medium">P2 中</option><option value="low">P3 低</option></select><button type="submit" class="gc-lime-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "QUEUE"}</button></form></Show>
      <div class="gc-task-layout">
        <div class="gc-task-bays">
          <GcPanel title="QUEUED / 待处理" code={`BAY-001.Q · ${queued().length}`} class="gc-task-bay gc-task-bay--queued"><div class="gc-task-grid"><Show when={props.ready()} fallback={<div class="gc-empty-console">正在读取队列…</div>}><For each={queued()}>{(item) => <GraphiteTodoCard item={item} {...rowProps} />}</For><Show when={queued().length === 0}><div class="gc-empty-console">队列为空</div></Show></Show></div></GcPanel>
          <GcPanel title="ACTIVE / 正在推进" code={`BAY-002.A · ${active().length}`} class="gc-task-bay gc-task-bay--active"><div class="gc-task-grid"><For each={active()}>{(item) => <GraphiteTodoCard item={item} {...rowProps} />}</For><Show when={active().length === 0}><div class="gc-empty-console">没有进行中的事项</div></Show></div></GcPanel>
          <GcPanel title="DONE / 已完成" code={`BAY-003.D · ${props.completedTodos().length}`} class="gc-task-bay gc-task-bay--done"><div class="gc-task-grid"><For each={props.completedTodos()}>{(item) => <GraphiteTodoCard item={item} {...rowProps} />}</For><Show when={props.completedTodos().length === 0}><div class="gc-empty-console">完成一项后会归档在这里</div></Show></div></GcPanel>
        </div>
        <GcPanel title="NEXT FOCUS / 下一段专注" code="MOD-NEXT.45" class="gc-next-task-panel"><Show when={props.activeTodos()[0]} fallback={<div class="gc-operation-empty"><span>NO TASK ASSIGNED</span><h2>等待下一段</h2><p>从左侧队列选一项开始。</p></div>}>{(item) => <div class="gc-next-task-content"><span class="gc-card-kicker">TASK.ID</span><strong class="gc-task-id">{String(item().id).padStart(2, "0")}</strong><span class="gc-card-kicker">TASK.TITLE</span><h2>{item().title}</h2><span class="gc-card-kicker">DURATION</span><strong class="gc-duration-readout">{Math.round((props.timer().targetDurationMs ?? 45 * 60 * 1000) / 60000)}<small> MIN</small></strong><span class="gc-card-kicker">NOTE</span><p>{props.formatTodoDue(item())}</p><button type="button" class="gc-lime-button gc-lime-button--wide" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注</button><div class="gc-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></div></div>}</Show></GcPanel>
      </div>
      <footer class="gc-todo-footer"><div><span>今日完成</span><strong>{String(props.completedTodos().length).padStart(2, "0")}</strong><small>项</small></div><div><span>待处理</span><strong>{String(queued().length).padStart(2, "0")}</strong><small>项</small></div><div class="gc-completion-meter"><span>系统状态</span><i><b style={{ width: `${completion()}%` }} /></i><strong>{completion()}%</strong></div><div><span>CONSOLE ID</span><strong>FM-OPS-{String(props.todos().length).padStart(4, "0")}</strong></div></footer>
    </section>
  );
}

export function GraphiteConsoleRecords(props: NightValleyRecordsProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const [visibleCount, setVisibleCount] = createSignal(200);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const visibleRecords = createMemo(() => selectedRecords().slice(0, visibleCount()));
  const bandStats = createMemo(() => {
    const bands = [
      { key: "morning", label: "清晨", range: "05:00—11:00", totalMs: 0 },
      { key: "midday", label: "午间", range: "11:00—17:00", totalMs: 0 },
      { key: "evening", label: "夜晚", range: "17:00—23:00", totalMs: 0 },
    ];
    for (const record of props.records()) {
      const hour = Number.parseInt(gcTime(record).slice(0, 2), 10);
      const band = bands.find((item) => item.key === gcFocusBand(Number.isFinite(hour) ? hour : 0).key);
      if (band) band.totalMs += record.durationMs;
    }
    const totalMs = bands.reduce((sum, band) => sum + band.totalMs, 0);
    return bands.map((band) => ({ ...band, percent: totalMs === 0 ? 0 : Math.round((band.totalMs / totalMs) * 100) }));
  });
  const dominantBand = createMemo(() => bandStats().reduce((current, band) => band.totalMs > current.totalMs ? band : current, bandStats()[0]));
  createEffect(() => { const date = selectedDate(); const count = selectedRecords().length; setVisibleCount(200); setExpandedDate(count <= 200 ? date : null); });

  return (
    <section class="gc-page gc-records-page" aria-label="专注遥测">
      <header class="gc-page-head gc-page-head--split"><div><span class="gc-date-code">SIGNAL SYS / FOCUS TELEMETRY</span><h1>RECORDS <em>/ 专注遥测</em></h1><p>把注意力的波形留在系统里。</p></div><div class="gc-records-actions"><button type="button" class="gc-dark-button" disabled title="导出记录尚未接入"><Download size={15} aria-hidden="true" /> EXPORT</button><span class="gc-head-status"><i class="gc-led gc-led--lime" /> DATA LINK OK</span></div></header>
      <GcPanel title="FOCUS SIGNAL / 专注信号" code={`${props.formatAnalyticsDate(selectedDate())} · 7D`} class="gc-signal-panel"><div class="gc-signal-chart"><div class="gc-signal-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div class="gc-signal-days"><For each={props.archiveDays()}>{(day) => <button type="button" classList={{ "gc-signal-day": true, active: day.date === selectedDate() }} onClick={() => props.onSelectDate(day.date)}><span>{props.formatAnalyticsDate(day.date)}</span><strong>{day.totalDurationLabel}</strong><i><b style={{ height: `${Math.max(6, (day.totalDurationMs / maxDuration()) * 100)}%` }} /></i><small>{day.sessionCount} SEG</small></button>}</For></div></div><div class="gc-chart-foot"><span>0</span><strong>累计 {props.formatDurationMs(props.recentWeekDurationMs())}</strong><span>100</span></div></GcPanel>
      <section class="gc-record-stat-grid"><div><span>累计专注</span><strong>{gcAnalytics(props.analytics(), "totalFocusDurationLabel", "00:00:00")}</strong><small>HH : MM : SS</small></div><div><span>完成段数</span><strong>{gcAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>SEGMENTS</small></div><div><span>平均时长</span><strong>{props.analytics()?.sessionCount ? props.formatDurationMs(props.recentWeekDurationMs() / Math.max(1, props.analytics()?.sessionCount ?? 1)) : "00:00:00"}</strong><small>PER SEGMENT</small></div><div><span>连续天数</span><strong>{gcAnalytics(props.analytics(), "currentStreakDays", "0")}</strong><small>STREAK</small></div></section>
      <div class="gc-records-grid"><GcPanel title="节奏日志 / EVENT LOG" code={`${selectedRecords().length} EVENTS`} class="gc-event-log"><div class="gc-event-log__heading"><span>时间</span><span>事件</span><span>强度</span><span>状态</span></div><Show when={visibleRecords().length > 0} fallback={<div class="gc-empty-console">当前日期没有专注事件</div>}><For each={visibleRecords().slice(0, 12)}>{(record) => <div class="gc-event-row"><i class="gc-led gc-led--lime" /><time>{gcTime(record)}</time><span>{record.title}</span><b><i /><i /><i /><i /><i /></b><strong>OK</strong></div>}</For><Show when={visibleCount() < selectedRecords().length}><button type="button" class="gc-inline-button" onClick={() => setVisibleCount((count) => Math.min(count + 200, selectedRecords().length))}>加载更多 · {visibleCount()} / {selectedRecords().length}</button></Show></Show></GcPanel><GcPanel title="专注分布 / SIGNAL ANALYZER" code="BAND / ALL" class="gc-analyzer-panel"><div class="gc-radar"><i /><i /><i /><span>FOCUS</span></div><div class="gc-band-list"><For each={bandStats()}>{(band) => <div><span>{band.label} <small>{band.range}</small></span><strong>{band.percent}%</strong></div>}</For></div><p>洞察 / INSIGHT<br /><strong>{props.records().length === 0 ? "完成一次专注后，这里会显示真实的时段分布。" : `${dominantBand().label}时段投入最多，可作为下一次深度工作的参考。`}</strong></p></GcPanel></div>
      <GcPanel title="更长的路 / 30-DAY TREND" code="TREND / ARCHIVE" class="gc-trend-panel"><div class="gc-trend-lines"><For each={props.archiveDays()}>{(day, index) => <button type="button" classList={{ active: day.date === selectedDate() }} style={{ left: `${index() * (100 / Math.max(1, props.archiveDays().length - 1))}%`, bottom: `${Math.max(8, (day.totalDurationMs / maxDuration()) * 80)}%` }} onClick={() => props.onSelectDate(day.date)}><i /><span>{props.formatAnalyticsDate(day.date)}</span></button>}</For></div><div class="gc-trend-footer"><span>最近 7 天</span><strong>{props.recentWeekActiveDays()} 天有投入</strong><button type="button" class="gc-quiet-button" onClick={() => props.onSelectDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? selectedDate())}>VIEW ALL <ChevronRight size={14} aria-hidden="true" /></button></div></GcPanel>
      <section class="gc-history-index"><header><span>FULL INDEX / ALL RECORDS</span><strong>{props.records().length} ROUNDS</strong></header><Show when={props.ready() && props.records().length > 0} fallback={<div class="gc-empty-console">完成一次计时后，记录会显示在这里。</div>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedDate() === group.date}><div>{group.records.slice(0, 200).map((record) => <span>{record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
      <GcStatusStrip analytics={props.analytics} timer={() => ({ ...({} as TimerSnapshot), isRunning: false } as TimerSnapshot)} />
    </section>
  );
}

export function GraphiteConsoleSettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const toggle = (checked: boolean, key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled") => void props.onSaveTimerPreferences({ [key]: checked });

  return (
    <section class="gc-page gc-settings-page" aria-label="系统配置">
      <header class="gc-page-head gc-page-head--split"><div><span class="gc-date-code">SYS-MOD-5A / CONTROL SURFACE</span><h1>SYSTEM CONFIG <em>/ 系统配置</em></h1><p>调整显示、行为和本地安全边界。</p></div><div class="gc-head-status"><i class="gc-led gc-led--lime" /> CONFIG SYNC / READY</div></header>
      <div class="gc-settings-layout"><nav class="gc-settings-nav" aria-label="设置分组"><a href="#gc-appearance">01 <span>外观</span></a><a href="#gc-behavior">02 <span>行为</span></a><a href="#gc-audio">03 <span>音频</span></a><a href="#gc-shortcuts">04 <span>快捷键</span></a><a href="#gc-data">05 <span>数据</span></a></nav><div class="gc-settings-main">
        <GcPanel title="APPEARANCE MATRIX / 外观矩阵" code="THEME / 03" class="gc-settings-appearance" ><div id="gc-appearance" class="gc-theme-matrix"><For each={themes}>{(theme) => <button type="button" classList={{ "gc-theme-card": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class={`gc-theme-card__preview gc-theme-card__preview--${theme.id}`}><i /><b /><em /></span><strong>{theme.name}</strong><small>{theme.implemented ? "可用" : "尚未实现"}</small></button>}</For></div><div class="gc-setting-slider-list"><label><span>亮度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>动效 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label><span>界面密度 <b>{props.density() === "roomy" ? "标准" : "紧凑"}</b></span><input type="range" min="0" max="1" step="1" value={props.density() === "compact" ? 1 : 0} onInput={(event) => props.onDensityChange(event.currentTarget.value === "1" ? "compact" : "roomy")} /></label></div></GcPanel>
        <GcPanel title="INPUT / BEHAVIOR" code="SWITCH / LIVE" class="gc-behavior-panel" ><div id="gc-behavior" class="gc-switch-list"><label><span><strong>完成后自动进入下一段</strong><small>AUTO NEXT SEGMENT</small></span><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "toastReminderEnabled")} /><i /></label><label><span><strong>结束时显示总结</strong><small>SHOW SUMMARY AT END</small></span><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "windowAttentionReminderEnabled")} /><i /></label><label><span><strong>持续专注提醒</strong><small>FOCUS REMINDER · 每 60 分钟</small></span><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "soundReminderEnabled")} /><i /></label></div><div class="gc-response-readout"><span>RESPONSE DELAY</span><strong>120 <small>ms</small></strong><i class="gc-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /></i></div></GcPanel>
        <GcPanel title="AUDIO BUS / 声音与提示" code="BUS / 01" class="gc-audio-panel"><div id="gc-audio" class="gc-audio-grid"><label class="gc-console-field"><span>环境音 / ENVIRONMENT</span><select disabled><option>山谷夜风</option></select></label><label class="gc-console-field"><span>提醒音效 / ALERT</span><select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></label><div class="gc-audio-actions"><button type="button" class="gc-dark-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} aria-hidden="true" />试听</button><button type="button" class="gc-dark-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入</button><Show when={props.customAlertSoundName()}><button type="button" class="gc-quiet-button" onClick={() => void props.onClearCustomAlertSound()}>移除</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></GcPanel>
        <GcPanel title="KEY MAP / 快捷键" code="INPUT / HOTKEY" class="gc-shortcuts-panel"><div id="gc-shortcuts" class="gc-key-map"><div><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd><span>开始专注 / START FOCUS</span></div><div><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>E</kbd><span>结束本段 / END SEGMENT</span></div><div><kbd>F11</kbd><span>全屏 / TOGGLE FULLSCREEN</span></div></div></GcPanel>
        <GcPanel title="LOCAL SAFETY / 本地数据" code="DATA / SAFE" class="gc-data-panel"><div id="gc-data" class="gc-data-copy"><ShieldCheck size={20} aria-hidden="true" /><p>待办、专注记录和未完成计时状态只保存在这台电脑上。</p></div><div class="gc-data-actions"><button type="button" class="gc-lime-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="gc-dark-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开目录</button><button type="button" class="gc-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空数据</button></div><Show when={props.lastBackupPath()}><p class="gc-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "error"}><div class="gc-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="gc-inline-button" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="gc-console-field"><span>选择备份</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></label><button type="button" class="gc-dark-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show></GcPanel>
      </div></div>
      <footer class="gc-settings-footer"><span>ACTIVE SURFACE / {activeTheme().englishName.toUpperCase()}</span><strong>{activeTheme().name}</strong><button type="button" class="gc-lime-button" onClick={props.onSaveVisualSettings}><Save size={15} aria-hidden="true" /> APPLY / 保存更改</button></footer>
    </section>
  );
}
