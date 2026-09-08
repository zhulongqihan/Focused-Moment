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
import "./AuroraOceanViews.css";

function aoDate(value: string) {
  return value.replace(/-/g, " / ");
}

function aoLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function aoTime(record: FocusRecord) {
  return record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "--:--";
}

function aoTimerLabel(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (snapshot.isRunning) return "运行中";
  if (hasProgress) return "已暂停";
  if (snapshot.modeKey === "countdown" && snapshot.remainingMs === 0) return "待保存";
  return "准备开始";
}

function aoProgress(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (!hasProgress) return 0;
  if (snapshot.modeKey === "countdown" && snapshot.targetDurationMs && snapshot.remainingMs !== null) {
    return Math.min(1, Math.max(0, 1 - snapshot.remainingMs / snapshot.targetDurationMs));
  }
  return Math.min(1, Math.max(0, snapshot.elapsedMs / Math.max(snapshot.targetDurationMs ?? 45 * 60 * 1000, 45 * 60 * 1000)));
}

function aoAnalytics(analytics: AnalyticsSnapshot | null, key: keyof AnalyticsSnapshot, fallback = "0") {
  const value = analytics?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

function aoImportance(value: TodoImportance) {
  return value === "high" ? "P1" : value === "medium" ? "P2" : "P3";
}

function AoScrew(props: { class?: string }) {
  return <span class={`ao-screw ${props.class ?? ""}`} aria-hidden="true" />;
}

function AoPanel(props: { title: string; code?: string; class?: string; children: any }) {
  return (
    <section class={`ao-panel ${props.class ?? ""}`}>
      <AoScrew class="ao-screw--tl" />
      <AoScrew class="ao-screw--tr" />
      <AoScrew class="ao-screw--bl" />
      <AoScrew class="ao-screw--br" />
      <header class="ao-panel__heading"><span>{props.title}</span><small>{props.code ?? "SYS / 03"}</small></header>
      {props.children}
    </section>
  );
}

function AoStatusStrip(props: { analytics: () => AnalyticsSnapshot | null; timer: () => TimerSnapshot }) {
  return (
    <footer class="ao-status-strip" aria-label="系统状态">
      <div class="ao-status-strip__label"><span class="ao-led ao-led--lime" /> SYSTEM STATUS <strong>OPERATIONAL</strong></div>
      <div><span>CPU</span><strong>12%</strong><i class="ao-meter"><b style={{ width: "38%" }} /></i></div>
      <div><span>MEM</span><strong>28%</strong><i class="ao-meter"><b style={{ width: "54%" }} /></i></div>
      <div><span>FOCUS</span><strong>{props.timer().isRunning ? "RUN" : aoAnalytics(props.analytics(), "todaySessionCount", "0")}</strong><i class="ao-meter"><b style={{ width: props.timer().isRunning ? "78%" : "28%" }} /></i></div>
      <div><span>SYNC</span><strong>ONLINE</strong><span class="ao-led ao-led--lime" /></div>
    </footer>
  );
}

export function AuroraOceanToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const sequence = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].slice(0, 7));
  const activeIndex = createMemo(() => props.todayCompletedTodos().length);
  const nextTodo = createMemo(() => props.nextTodo());

  return (
    <section class="ao-page ao-today-page" aria-label="潮汐轨迹">
      <header class="ao-page-head ao-page-head--split">
        <div><span class="ao-date-code">TIDE LOG / {props.todayDate} · {props.todayLabel.match(/周[一二三四五六日天]/)?.[0] ?? "TODAY"}</span><h1>TIDE <em>/ 潮汐轨迹</em></h1><p>让注意力像潮汐一样，缓慢而明确地移动。</p></div>
        <div class="ao-head-readout"><span>CURRENT STREAK</span><strong>{String(streak()).padStart(2, "0")}</strong><small>DAYS / 光场 <i class="ao-led ao-led--lime" /></small></div>
      </header>

      <div class="ao-today-layout">
        <AoPanel title="TIDAL ROUTE / 潮汐路径" code="FLOW REF. / T-0905" class="ao-sequence-panel">
          <div class="ao-time-ruler"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
          <div class="ao-sequence-grid">
            <Show when={props.ready()} fallback={<div class="ao-empty-console">正在同步今日序列…</div>}>
              <For each={sequence()}>
                {(item, index) => {
                  const completed = item.isCompleted;
                  const active = index() === activeIndex();
                  return (
                    <button type="button" classList={{ "ao-sequence-row": true, "is-done": completed, "is-active": active }} disabled={props.busy() || completed || props.timerHasProgress()} onClick={() => props.onUseTodo(item)}>
                      <span class="ao-sequence-row__index">{String(index() + 1).padStart(2, "0")}<small>SEQ-{String(index() + 1).padStart(2, "0")}</small></span>
                      <span class="ao-sequence-row__icon"><CircleDot size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                      <span class="ao-sequence-row__content"><time>{item.scheduledTime || "--:--"}</time><strong>{item.title}</strong><small>{props.formatTodoDue(item)}</small></span>
                      <span class="ao-sequence-row__state">{completed ? "完成" : active ? "进行中" : "等待"}<i class="ao-led" /></span>
                    </button>
                  );
                }}
              </For>
              <Show when={sequence().length === 0}><div class="ao-empty-console">没有排定事项。先添加一件待办。</div></Show>
            </Show>
          </div>
          <div class="ao-sequence-legend"><span><i class="ao-line ao-line--lime" /> 已完成</span><span><i class="ao-line ao-line--orange" /> 进行中</span><span><i class="ao-line" /> 待执行</span><small>TIDE CYCLE · 24H / 1H STEP</small></div>
        </AoPanel>

        <AoPanel title="NEXT TIDE / 下一段潮汐" code="AUTO / 01" class="ao-operation-panel">
          <Show when={nextTodo()} fallback={<div class="ao-operation-empty"><span>QUEUE EMPTY</span><h2>等待下一次潮汐</h2><p>把一个念头放进待办队列。</p><button type="button" class="ao-lime-button" onClick={props.onOpenTodos}><Plus size={17} aria-hidden="true" /> 添加待办</button></div>}>
            {(item) => <div class="ao-operation-card"><span class="ao-card-kicker">NEXT WAVE</span><h2>{item().title}</h2><div class="ao-operation-meta"><span>DURATION</span><strong>{props.defaultFocusMinutes()} <small>MIN</small></strong></div><div class="ao-operation-meta"><span>NOTE</span><p>{props.formatTodoDue(item())}</p></div><div class="ao-operation-status"><span><i class="ao-led ao-led--orange" /> STATUS</span><strong>READY TO RISE</strong></div><button type="button" class="ao-lime-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注 <ArrowRight size={16} aria-hidden="true" /></button><div class="ao-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>快捷键</small></div></div>}
          </Show>
          <div class="ao-operation-footer"><span>FOCUS MODULE</span><strong>STANDARD MODE</strong><i class="ao-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /><b /></i></div>
        </AoPanel>
      </div>

      <section class="ao-today-footer">
        <div><span>今日完成</span><strong>{String(props.todayCompletedTodos().length).padStart(2, "0")}</strong><small>段 · 继续运行</small></div>
        <div><span>今日专注</span><strong>{aoAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong></div>
        <div><span>累计记录</span><strong>{aoAnalytics(props.analytics(), "sessionCount", "0")}</strong></div>
        <div><span>状态</span><strong>{aoTimerLabel(props.timer(), props.timerHasProgress())}</strong><button type="button" class="ao-inline-button" onClick={props.onOpenRecords}>查看潮汐记录 <ChevronRight size={14} aria-hidden="true" /></button></div>
      </section>
      <AoStatusStrip analytics={props.analytics} timer={props.timer} />
    </section>
  );
}

export function AuroraOceanFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => props.timer().modeKey === "countdown" && props.countdownDraftDirty() ? `${String(Math.floor(props.countdownMinutes() / 60)).padStart(2, "0")}:${String(props.countdownMinutes() % 60).padStart(2, "0")}:00` : props.timer().elapsedLabel);
  const progress = createMemo(() => aoProgress(props.timer(), props.timerHasProgress()));
  const currentTitle = createMemo(() => props.sessionTitle().trim() || props.timer().activeTaskTitle || "未命名专注");
  const recentRecords = createMemo(() => props.todos().slice(0, 3));
  const stateLabel = createMemo(() => aoTimerLabel(props.timer(), props.timerHasProgress()));

  function updateLinkedTodo(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) props.onSessionTitleChange(item.title);
  }

  return (
    <section class="ao-page ao-focus-page" aria-label="潮汐计时">
      <header class="ao-page-head"><div><span class="ao-date-code">TIDE ENGINE / DEPTH PROFILE</span><h1>TIDE TIMER <em>/ 潮汐计时</em></h1><p>让这一段注意力慢慢沉入光场。</p></div><div class="ao-head-status"><i class="ao-led ao-led--lime" /> TIDE READY <strong>{props.timer().mode.toUpperCase()}</strong></div></header>
      <div class="ao-focus-layout">
        <AoPanel title="RECENT WAVES / 最近潮汐" code="FLOW / 03" class="ao-run-log">
          <p>最近浮起的专注片段</p>
          <For each={recentRecords()}>{(item, index) => <div class="ao-run-item"><span>{String(index() + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.scheduledTime || "--:--"}</small></div><i class="ao-ring-dot" /></div>}</For>
          <Show when={recentRecords().length === 0}><div class="ao-empty-console">暂无最近记录</div></Show>
          <button type="button" class="ao-quiet-button" onClick={props.onOpenRecords}>回看潮汐记录 <ChevronRight size={14} aria-hidden="true" /></button>
        </AoPanel>

        <section class="ao-dial-module" aria-label="计时器">
          <div class="ao-dial" style={{ "--ao-progress": `${progress() * 100}%` }}>
            <div class="ao-dial__ticks" aria-hidden="true"><For each={Array.from({ length: 36 })}>{(_, index) => <i style={{ transform: `rotate(${index() * 10}deg)` }} />}</For></div>
            <div class="ao-dial__face"><span>TIDE TIMER</span><h2>{currentTitle()}</h2><strong>{displayTime()}</strong><small><i class="ao-led ao-led--lime" /> {stateLabel()}</small><span class="ao-dial__needle" style={{ transform: `rotate(${progress() * 300 - 150}deg)` }} /></div>
          </div>
          <div class="ao-dial-controls"><Show when={props.timer().isRunning} fallback={<button type="button" class="ao-lime-button ao-lime-button--wide" disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}><Play size={18} fill="currentColor" aria-hidden="true" /> {props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}><button type="button" class="ao-lime-button ao-lime-button--wide" disabled={props.busy()} onClick={() => void props.onPause()}><Pause size={18} fill="currentColor" aria-hidden="true" /> 暂停本段</button></Show><div class="ao-round-buttons"><button type="button" class="ao-dark-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}><CheckCircle2 size={16} aria-hidden="true" /> 完成并记录</button><button type="button" class="ao-dark-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={15} aria-hidden="true" /> 重置</button></div></div>
        </section>

        <AoPanel title="FOCUS PROFILE / 专注配置" code="CFG / ACTIVE" class="ao-session-profile">
          <label class="ao-console-field"><span>模式 / MODE</span><div class="ao-mode-buttons"><button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div></label>
          <label class="ao-console-field"><span>本次专注 / TITLE</span><input type="text" name="auroraSessionTitle" value={props.sessionTitle()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} placeholder="输入本次专注的意图" onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
          <Show when={props.timer().modeKey === "countdown"}><label class="ao-console-field"><span>时长 / PRESET</span><div class="ao-number-field"><input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><b>MIN</b></div></label></Show>
          <label class="ao-console-field"><span>关联待办 / LINK</span><select value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => updateLinkedTodo(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
          <Show when={props.linkedTodoId() !== null}><label class="ao-check-row"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={props.busy() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成本段时标记待办</span></label></Show>
          <div class="ao-profile-note"><span class="ao-led ao-led--orange" /> {props.timer().modeSwitchHint ?? "专注配置已就绪"}</div>
        </AoPanel>
      </div>
      <section class="ao-focus-bottom"><div><span>今日已专注</span><strong>{props.timer().completedFocusCount}</strong><small>段</small></div><div><span>连续天数</span><strong> {props.timer().completedFocusCount > 0 ? "09" : "00"}</strong><small>天</small></div><div><span>当前状态</span><strong>{stateLabel()}</strong></div><div class="ao-focus-key"><Keyboard size={15} aria-hidden="true" /><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>开始 / 继续</small></div></section>
    </section>
  );
}

interface AuroraTodoCardProps {
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

function AuroraTodoCard(props: AuroraTodoCardProps) {
  const editing = createMemo(() => props.editingTodo()?.id === props.item.id);
  return (
    <article classList={{ "ao-todo-card": true, "is-editing": editing(), "is-complete": props.item.isCompleted }}>
      <span class="ao-todo-card__number">{String(props.item.id).padStart(2, "0")}</span>
      <Show when={!editing()} fallback={<div class="ao-edit-grid"><input aria-label="待办事项" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /><input aria-label="截止日期" type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /><input aria-label="时间" type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /><select aria-label="重要程度" value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select><div><button type="button" class="ao-inline-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="ao-quiet-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>}>
        <button type="button" class="ao-todo-check" aria-label={props.item.isCompleted ? "恢复待办" : "完成待办"} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}>{props.item.isCompleted ? <Check size={15} aria-hidden="true" /> : <span />}</button>
        <div class="ao-todo-card__body"><strong>{props.item.title}</strong><small>{props.formatTodoDue(props.item)}</small><span>{props.importanceLabel(props.item.importanceKey)} · {aoImportance(props.item.importanceKey)}</span></div>
        <div class="ao-todo-card__actions"><button type="button" class="ao-quiet-button" disabled={props.busy() || props.timerHasProgress() || props.item.isCompleted} onClick={() => props.onUseForFocus(props.item)}>专注</button><button type="button" class="ao-quiet-button" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="ao-quiet-button ao-quiet-button--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button></div>
      </Show>
    </article>
  );
}

export function AuroraOceanTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedId = createMemo(() => props.timer().linkedTodoId);
  const queued = createMemo(() => props.activeTodos().filter((item) => item.id !== focusedId()));
  const active = createMemo(() => props.activeTodos().filter((item) => item.id === focusedId()));
  const completion = createMemo(() => props.todos().length === 0 ? 0 : Math.round((props.completedTodos().length / props.todos().length) * 100));
  const rowProps = { editingTodo: props.editingTodo, busy: props.busy, timerHasProgress: props.timerHasProgress, formatTodoDue: props.formatTodoDue, importanceLabel: props.importanceLabel, onToggle: props.onToggle, onBeginEdit: props.onBeginEdit, onUseForFocus: props.onUseForFocus, onRemove: props.onRemove, onPatch: props.onPatch, onSave: props.onSave, onCancel: props.onCancel };

  return (
    <section class="ao-page ao-todos-page" aria-label="潮汐清单">
      <header class="ao-page-head ao-page-head--split"><div><span class="ao-date-code">TIDE / 24 × 06 · {aoDate(aoLocalDateKey())}</span><h1>TIDE LIST <em>/ 潮汐清单</em></h1><p>让下一步像气泡一样浮出水面。</p></div><button type="button" class="ao-lime-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} {createOpen() ? "收起" : "ADD WAVE"}</button></header>
      <Show when={createOpen()}><form class="ao-create-task" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setCreateOpen(false); }}><span class="ao-panel-label">WAVE BUFFER / NEW</span><input type="text" name="auroraTodoTitle" value={props.todoTitle()} placeholder="输入下一件要完成的事" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /><input type="date" name="auroraTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /><input type="time" name="auroraTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /><select name="auroraTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">P1 高</option><option value="medium">P2 中</option><option value="low">P3 低</option></select><button type="submit" class="ao-lime-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "QUEUE"}</button></form></Show>
      <div class="ao-task-layout">
        <div class="ao-task-bays">
          <AoPanel title="QUEUED / 待处理" code={`BAY-001.Q · ${queued().length}`} class="ao-task-bay ao-task-bay--queued"><div class="ao-task-grid"><Show when={props.ready()} fallback={<div class="ao-empty-console">正在读取队列…</div>}><For each={queued()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={queued().length === 0}><div class="ao-empty-console">队列为空</div></Show></Show></div></AoPanel>
          <AoPanel title="ACTIVE / 正在推进" code={`BAY-002.A · ${active().length}`} class="ao-task-bay ao-task-bay--active"><div class="ao-task-grid"><For each={active()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={active().length === 0}><div class="ao-empty-console">没有进行中的事项</div></Show></div></AoPanel>
          <AoPanel title="DONE / 已完成" code={`BAY-003.D · ${props.completedTodos().length}`} class="ao-task-bay ao-task-bay--done"><div class="ao-task-grid"><For each={props.completedTodos()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={props.completedTodos().length === 0}><div class="ao-empty-console">完成一项后会归档在这里</div></Show></div></AoPanel>
        </div>
        <AoPanel title="NEXT FOCUS / 下一段专注" code="MOD-NEXT.45" class="ao-next-task-panel"><Show when={props.activeTodos()[0]} fallback={<div class="ao-operation-empty"><span>NO TASK ASSIGNED</span><h2>等待下一段</h2><p>从左侧队列选一项开始。</p></div>}>{(item) => <div class="ao-next-task-content"><span class="ao-card-kicker">TASK.ID</span><strong class="ao-task-id">{String(item().id).padStart(2, "0")}</strong><span class="ao-card-kicker">TASK.TITLE</span><h2>{item().title}</h2><span class="ao-card-kicker">DURATION</span><strong class="ao-duration-readout">{Math.round((props.timer().targetDurationMs ?? 45 * 60 * 1000) / 60000)}<small> MIN</small></strong><span class="ao-card-kicker">NOTE</span><p>{props.formatTodoDue(item())}</p><button type="button" class="ao-lime-button ao-lime-button--wide" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注</button><div class="ao-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></div></div>}</Show></AoPanel>
      </div>
      <footer class="ao-todo-footer"><div><span>今日完成</span><strong>{String(props.completedTodos().length).padStart(2, "0")}</strong><small>项</small></div><div><span>待处理</span><strong>{String(queued().length).padStart(2, "0")}</strong><small>项</small></div><div class="ao-completion-meter"><span>系统状态</span><i><b style={{ width: `${completion()}%` }} /></i><strong>{completion()}%</strong></div><div><span>CONSOLE ID</span><strong>FM-OPS-{String(props.todos().length).padStart(4, "0")}</strong></div></footer>
    </section>
  );
}

export function AuroraOceanRecords(props: NightValleyRecordsProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const [visibleCount, setVisibleCount] = createSignal(200);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const visibleRecords = createMemo(() => selectedRecords().slice(0, visibleCount()));
  createEffect(() => { const date = selectedDate(); const count = selectedRecords().length; setVisibleCount(200); setExpandedDate(count <= 200 ? date : null); });

  return (
    <section class="ao-page ao-records-page" aria-label="潮汐记录">
      <header class="ao-page-head ao-page-head--split"><div><span class="ao-date-code">AURORA ARCHIVE / FOCUS TIDE</span><h1>TIDE RECORDS <em>/ 潮汐记录</em></h1><p>回到光场里，看见自己的专注潮汐。</p></div><div class="ao-records-actions"><button type="button" class="ao-dark-button" disabled title="导出记录尚未接入"><Download size={15} aria-hidden="true" /> EXPORT</button><span class="ao-head-status"><i class="ao-led ao-led--lime" /> LIGHT FIELD OK</span></div></header>
      <AoPanel title="TIDE SIGNAL / 潮汐信号" code={`${props.formatAnalyticsDate(selectedDate())} · 7D`} class="ao-signal-panel"><div class="ao-signal-chart"><div class="ao-signal-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div class="ao-signal-days"><For each={props.archiveDays()}>{(day) => <button type="button" classList={{ "ao-signal-day": true, active: day.date === selectedDate() }} onClick={() => props.onSelectDate(day.date)}><span>{props.formatAnalyticsDate(day.date)}</span><strong>{day.totalDurationLabel}</strong><i><b style={{ height: `${Math.max(6, (day.totalDurationMs / maxDuration()) * 100)}%` }} /></i><small>{day.sessionCount} WAVE</small></button>}</For></div></div><div class="ao-chart-foot"><span>0</span><strong>累计 {props.formatDurationMs(props.recentWeekDurationMs())}</strong><span>100</span></div></AoPanel>
      <section class="ao-record-stat-grid"><div><span>累计专注</span><strong>{aoAnalytics(props.analytics(), "totalFocusDurationLabel", "00:00:00")}</strong><small>HH : MM : SS</small></div><div><span>完成段数</span><strong>{aoAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>WAVES</small></div><div><span>平均时长</span><strong>{props.analytics()?.sessionCount ? props.formatDurationMs(props.recentWeekDurationMs() / Math.max(1, props.analytics()?.sessionCount ?? 1)) : "00:00:00"}</strong><small>PER WAVE</small></div><div><span>连续天数</span><strong>{aoAnalytics(props.analytics(), "currentStreakDays", "0")}</strong><small>STREAK</small></div></section>
      <div class="ao-records-grid"><AoPanel title="潮汐日志 / WAVE LOG" code={`${selectedRecords().length} EVENTS`} class="ao-event-log"><div class="ao-event-log__heading"><span>时间</span><span>事件</span><span>强度</span><span>状态</span></div><Show when={visibleRecords().length > 0} fallback={<div class="ao-empty-console">当前日期没有专注事件</div>}><For each={visibleRecords().slice(0, 12)}>{(record) => <div class="ao-event-row"><i class="ao-led ao-led--lime" /><time>{aoTime(record)}</time><span>{record.title}</span><b><i /><i /><i /><i /><i /></b><strong>OK</strong></div>}</For><Show when={visibleCount() < selectedRecords().length}><button type="button" class="ao-inline-button" onClick={() => setVisibleCount((count) => Math.min(count + 200, selectedRecords().length))}>加载更多 · {visibleCount()} / {selectedRecords().length}</button></Show></Show></AoPanel><AoPanel title="极光分布 / AURORA ANALYZER" code="BAND / DAY" class="ao-analyzer-panel"><div class="ao-radar"><i /><i /><i /><span>LIGHT</span></div><div class="ao-band-list"><div><span>清晨 <small>05:00—11:00</small></span><strong>34%</strong></div><div><span>午间 <small>11:00—17:00</small></span><strong>41%</strong></div><div><span>夜晚 <small>17:00—23:00</small></span><strong>25%</strong></div></div><p>洞察 / INSIGHT<br /><strong>午间专注占比最高，适合安排深度工作。</strong></p></AoPanel></div>
      <AoPanel title="更长的路 / 30-DAY TIDE" code="TREND / ARCHIVE" class="ao-trend-panel"><div class="ao-trend-lines"><For each={props.archiveDays()}>{(day, index) => <button type="button" classList={{ active: day.date === selectedDate() }} style={{ left: `${index() * (100 / Math.max(1, props.archiveDays().length - 1))}%`, bottom: `${Math.max(8, (day.totalDurationMs / maxDuration()) * 80)}%` }} onClick={() => props.onSelectDate(day.date)}><i /><span>{props.formatAnalyticsDate(day.date)}</span></button>}</For></div><div class="ao-trend-footer"><span>最近 7 天</span><strong>{props.recentWeekActiveDays()} 天有投入</strong><button type="button" class="ao-quiet-button" onClick={() => props.onSelectDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? selectedDate())}>VIEW ALL <ChevronRight size={14} aria-hidden="true" /></button></div></AoPanel>
      <section class="ao-history-index"><header><span>FULL INDEX / ALL RECORDS</span><strong>{props.records().length} ROUNDS</strong></header><Show when={props.ready() && props.records().length > 0} fallback={<div class="ao-empty-console">完成一次计时后，记录会显示在这里。</div>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedDate() === group.date}><div>{group.records.slice(0, 200).map((record) => <span>{record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
      <AoStatusStrip analytics={props.analytics} timer={() => ({ ...({} as TimerSnapshot), isRunning: false } as TimerSnapshot)} />
    </section>
  );
}

export function AuroraOceanSettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const toggle = (checked: boolean, key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled") => void props.onSaveTimerPreferences({ [key]: checked });

  return (
    <section class="ao-page ao-settings-page" aria-label="光场设置">
      <header class="ao-page-head ao-page-head--split"><div><span class="ao-date-code">LIGHT FIELD / CONTROL SURFACE</span><h1>LIGHT FIELD <em>/ 光场设置</em></h1><p>调整你的专注空间，让每一次进入都自然。</p></div><div class="ao-head-status"><i class="ao-led ao-led--lime" /> FIELD SYNC / READY</div></header>
      <div class="ao-settings-layout"><nav class="ao-settings-nav" aria-label="设置分组"><a href="#ao-appearance">01 <span>外观</span></a><a href="#ao-behavior">02 <span>行为</span></a><a href="#ao-audio">03 <span>音频</span></a><a href="#ao-shortcuts">04 <span>快捷键</span></a><a href="#ao-data">05 <span>数据</span></a></nav><div class="ao-settings-main">
        <AoPanel title="AURORA FIELD / 外观矩阵" code="THEME / 04" class="ao-settings-appearance" ><div id="ao-appearance" class="ao-theme-matrix"><For each={themes}>{(theme) => <button type="button" classList={{ "ao-theme-card": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class={`ao-theme-card__preview ao-theme-card__preview--${theme.id}`}><i /><b /><em /></span><strong>{theme.name}</strong><small>{theme.implemented ? "可用" : "尚未实现"}</small></button>}</For></div><div class="ao-setting-slider-list"><label><span>光场亮度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>流动强度 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label><span>界面密度 <b>{props.density() === "roomy" ? "标准" : "紧凑"}</b></span><input type="range" min="0" max="1" step="1" value={props.density() === "compact" ? 1 : 0} onInput={(event) => props.onDensityChange(event.currentTarget.value === "1" ? "compact" : "roomy")} /></label></div></AoPanel>
        <AoPanel title="INPUT / BEHAVIOR" code="SWITCH / LIVE" class="ao-behavior-panel" ><div id="ao-behavior" class="ao-switch-list"><label><span><strong>完成后自动进入下一段</strong><small>AUTO NEXT SEGMENT</small></span><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "toastReminderEnabled")} /><i /></label><label><span><strong>结束时显示总结</strong><small>SHOW SUMMARY AT END</small></span><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "windowAttentionReminderEnabled")} /><i /></label><label><span><strong>持续专注提醒</strong><small>FOCUS REMINDER · 每 60 分钟</small></span><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "soundReminderEnabled")} /><i /></label></div><div class="ao-response-readout"><span>RESPONSE DELAY</span><strong>120 <small>ms</small></strong><i class="ao-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /></i></div></AoPanel>
        <AoPanel title="AUDIO CURRENT / 声音与提示" code="BUS / 01" class="ao-audio-panel"><div id="ao-audio" class="ao-audio-grid"><label class="ao-console-field"><span>环境音 / ENVIRONMENT</span><select disabled><option>潮汐白噪</option></select></label><label class="ao-console-field"><span>提醒音效 / ALERT</span><select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></label><div class="ao-audio-actions"><button type="button" class="ao-dark-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} aria-hidden="true" />试听</button><button type="button" class="ao-dark-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入</button><Show when={props.customAlertSoundName()}><button type="button" class="ao-quiet-button" onClick={() => void props.onClearCustomAlertSound()}>移除</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></AoPanel>
        <AoPanel title="KEY MAP / 快捷键" code="INPUT / HOTKEY" class="ao-shortcuts-panel"><div id="ao-shortcuts" class="ao-key-map"><div><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd><span>开始专注 / START FOCUS</span></div><div><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>E</kbd><span>结束本段 / END SEGMENT</span></div><div><kbd>F11</kbd><span>全屏 / TOGGLE FULLSCREEN</span></div></div></AoPanel>
        <AoPanel title="LOCAL SAFETY / 本地数据" code="DATA / SAFE" class="ao-data-panel"><div id="ao-data" class="ao-data-copy"><ShieldCheck size={20} aria-hidden="true" /><p>待办、专注记录和未完成计时状态只保存在这台电脑上。</p></div><div class="ao-data-actions"><button type="button" class="ao-lime-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="ao-dark-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开目录</button><button type="button" class="ao-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空数据</button></div><Show when={props.lastBackupPath()}><p class="ao-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "error"}><div class="ao-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="ao-inline-button" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="ao-console-field"><span>选择备份</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></label><button type="button" class="ao-dark-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show></AoPanel>
      </div></div>
      <footer class="ao-settings-footer"><span>ACTIVE FIELD / {activeTheme().englishName.toUpperCase()}</span><strong>{activeTheme().name}</strong><button type="button" class="ao-lime-button" onClick={props.onSaveVisualSettings}><Save size={15} aria-hidden="true" /> APPLY / 保存更改</button></footer>
    </section>
  );
}
