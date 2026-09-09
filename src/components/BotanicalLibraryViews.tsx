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
import "./BotanicalLibraryViews.css";

function blDate(value: string) {
  return value.replace(/-/g, " / ");
}

function blLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function blTime(record: FocusRecord) {
  return record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "--:--";
}

function blTimerLabel(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (snapshot.isRunning) return "运行中";
  if (hasProgress) return "已暂停";
  if (snapshot.modeKey === "countdown" && snapshot.remainingMs === 0) return "待保存";
  return "准备开始";
}

function blProgress(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (!hasProgress) return 0;
  if (snapshot.modeKey === "countdown" && snapshot.targetDurationMs && snapshot.remainingMs !== null) {
    return Math.min(1, Math.max(0, 1 - snapshot.remainingMs / snapshot.targetDurationMs));
  }
  return Math.min(1, Math.max(0, snapshot.elapsedMs / Math.max(snapshot.targetDurationMs ?? 45 * 60 * 1000, 45 * 60 * 1000)));
}

function blAnalytics(analytics: AnalyticsSnapshot | null, key: keyof AnalyticsSnapshot, fallback = "0") {
  const value = analytics?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

function blImportance(value: TodoImportance) {
  return value === "high" ? "P1" : value === "medium" ? "P2" : "P3";
}

function BlScrew(props: { class?: string }) {
  return <span class={`bl-screw ${props.class ?? ""}`} aria-hidden="true" />;
}

function BlPanel(props: { title: string; code?: string; class?: string; children: any }) {
  return (
    <section class={`bl-panel ${props.class ?? ""}`}>
      <BlScrew class="bl-screw--tl" />
      <BlScrew class="bl-screw--tr" />
      <BlScrew class="bl-screw--bl" />
      <BlScrew class="bl-screw--br" />
      <header class="bl-panel__heading"><span>{props.title}</span><small>{props.code ?? "SYS / 03"}</small></header>
      {props.children}
    </section>
  );
}

function BlStatusStrip(props: { analytics: () => AnalyticsSnapshot | null; timer: () => TimerSnapshot }) {
  return (
    <footer class="bl-status-strip" aria-label="系统状态">
      <div class="bl-status-strip__label"><span class="bl-led bl-led--lime" /> SYSTEM STATUS <strong>OPERATIONAL</strong></div>
      <div><span>CPU</span><strong>12%</strong><i class="bl-meter"><b style={{ width: "38%" }} /></i></div>
      <div><span>MEM</span><strong>28%</strong><i class="bl-meter"><b style={{ width: "54%" }} /></i></div>
      <div><span>FOCUS</span><strong>{props.timer().isRunning ? "RUN" : blAnalytics(props.analytics(), "todaySessionCount", "0")}</strong><i class="bl-meter"><b style={{ width: props.timer().isRunning ? "78%" : "28%" }} /></i></div>
      <div><span>SYNC</span><strong>ONLINE</strong><span class="bl-led bl-led--lime" /></div>
    </footer>
  );
}

export function BotanicalLibraryToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const sequence = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].slice(0, 7));
  const activeIndex = createMemo(() => props.todayCompletedTodos().length);
  const nextTodo = createMemo(() => props.nextTodo());

  return (
    <section class="bl-page bl-today-page" aria-label="今日生长">
      <header class="bl-page-head bl-page-head--split">
        <div><span class="bl-date-code">GROWTH LOG / {props.todayDate} · {props.todayLabel.match(/周[一二三四五六日天]/)?.[0] ?? "TODAY"}</span><h1>GROWTH <em>/ 今日生长</em></h1><p>让每一段专注都在安静的土壤里留下年轮。</p></div>
        <div class="bl-head-readout"><span>GROWTH STREAK</span><strong>{String(streak()).padStart(2, "0")}</strong><small>DAYS / 温室 <i class="bl-led bl-led--lime" /></small></div>
      </header>

      <div class="bl-today-layout">
        <BlPanel title="GROWTH SHELF / 生长架" code="SHELF REF. / G-0905" class="bl-sequence-panel">
          <div class="bl-time-ruler"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
          <div class="bl-sequence-grid">
            <Show when={props.ready()} fallback={<div class="bl-empty-console">正在同步今日序列…</div>}>
              <For each={sequence()}>
                {(item, index) => {
                  const completed = item.isCompleted;
                  const active = index() === activeIndex();
                  return (
                    <button type="button" classList={{ "bl-sequence-row": true, "is-done": completed, "is-active": active }} disabled={props.busy() || completed || props.timerHasProgress()} onClick={() => props.onUseTodo(item)}>
                      <span class="bl-sequence-row__index">{String(index() + 1).padStart(2, "0")}<small>SEQ-{String(index() + 1).padStart(2, "0")}</small></span>
                      <span class="bl-sequence-row__icon"><CircleDot size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                      <span class="bl-sequence-row__content"><time>{item.scheduledTime || "--:--"}</time><strong>{item.title}</strong><small>{props.formatTodoDue(item)}</small></span>
                      <span class="bl-sequence-row__state">{completed ? "完成" : active ? "进行中" : "等待"}<i class="bl-led" /></span>
                    </button>
                  );
                }}
              </For>
              <Show when={sequence().length === 0}><div class="bl-empty-console">没有排定事项。先添加一件待办。</div></Show>
            </Show>
          </div>
          <div class="bl-sequence-legend"><span><i class="bl-line bl-line--lime" /> 已完成</span><span><i class="bl-line bl-line--orange" /> 进行中</span><span><i class="bl-line" /> 待执行</span><small>GROWTH CYCLE · 24H / 1H STEP</small></div>
        </BlPanel>

        <BlPanel title="NEXT SEED / 下一颗种子" code="AUTO / 01" class="bl-operation-panel">
          <Show when={nextTodo()} fallback={<div class="bl-operation-empty"><span>QUEUE EMPTY</span><h2>等待下一次生长</h2><p>把一个念头种进待办队列。</p><button type="button" class="bl-lime-button" onClick={props.onOpenTodos}><Plus size={17} aria-hidden="true" /> 添加待办</button></div>}>
            {(item) => <div class="bl-operation-card"><span class="bl-card-kicker">NEXT SEED</span><h2>{item().title}</h2><div class="bl-operation-meta"><span>DURATION</span><strong>{props.defaultFocusMinutes()} <small>MIN</small></strong></div><div class="bl-operation-meta"><span>NOTE</span><p>{props.formatTodoDue(item())}</p></div><div class="bl-operation-status"><span><i class="bl-led bl-led--orange" /> STATUS</span><strong>READY TO GROW</strong></div><button type="button" class="bl-lime-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注 <ArrowRight size={16} aria-hidden="true" /></button><div class="bl-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>快捷键</small></div></div>}
          </Show>
          <div class="bl-operation-footer"><span>FOCUS MODULE</span><strong>STANDARD MODE</strong><i class="bl-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /><b /></i></div>
        </BlPanel>
      </div>

      <section class="bl-today-footer">
        <div><span>今日完成</span><strong>{String(props.todayCompletedTodos().length).padStart(2, "0")}</strong><small>段 · 继续运行</small></div>
        <div><span>今日专注</span><strong>{blAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong></div>
        <div><span>累计记录</span><strong>{blAnalytics(props.analytics(), "sessionCount", "0")}</strong></div>
        <div><span>状态</span><strong>{blTimerLabel(props.timer(), props.timerHasProgress())}</strong><button type="button" class="bl-inline-button" onClick={props.onOpenRecords}>查看成长记录 <ChevronRight size={14} aria-hidden="true" /></button></div>
      </section>
      <BlStatusStrip analytics={props.analytics} timer={props.timer} />
    </section>
  );
}

export function BotanicalLibraryFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => props.timer().modeKey === "countdown" && props.countdownDraftDirty() ? `${String(Math.floor(props.countdownMinutes() / 60)).padStart(2, "0")}:${String(props.countdownMinutes() % 60).padStart(2, "0")}:00` : props.timer().elapsedLabel);
  const progress = createMemo(() => blProgress(props.timer(), props.timerHasProgress()));
  const currentTitle = createMemo(() => props.sessionTitle().trim() || props.timer().activeTaskTitle || "未命名专注");
  const recentRecords = createMemo(() => props.todos().slice(0, 3));
  const stateLabel = createMemo(() => blTimerLabel(props.timer(), props.timerHasProgress()));

  function updateLinkedTodo(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) props.onSessionTitleChange(item.title);
  }

  return (
    <section class="bl-page bl-focus-page" aria-label="专注年轮">
      <header class="bl-page-head"><div><span class="bl-date-code">GROWTH ENGINE / RING PROFILE</span><h1>FOCUS RING <em>/ 专注年轮</em></h1><p>让这一段注意力在安静里扎根。</p></div><div class="bl-head-status"><i class="bl-led bl-led--lime" /> GREENHOUSE READY <strong>{props.timer().mode.toUpperCase()}</strong></div></header>
      <div class="bl-focus-layout">
        <BlPanel title="RECENT RINGS / 最近年轮" code="FLOW / 03" class="bl-run-log">
          <p>最近留下的专注片段</p>
          <For each={recentRecords()}>{(item, index) => <div class="bl-run-item"><span>{String(index() + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.scheduledTime || "--:--"}</small></div><i class="bl-ring-dot" /></div>}</For>
          <Show when={recentRecords().length === 0}><div class="bl-empty-console">暂无最近记录</div></Show>
          <button type="button" class="bl-quiet-button" onClick={props.onOpenRecords}>回看成长记录 <ChevronRight size={14} aria-hidden="true" /></button>
        </BlPanel>

        <section class="bl-dial-module" aria-label="计时器">
          <div class="bl-dial" style={{ "--bl-progress": `${progress() * 100}%` }}>
            <div class="bl-dial__ticks" aria-hidden="true"><For each={Array.from({ length: 36 })}>{(_, index) => <i style={{ transform: `rotate(${index() * 10}deg)` }} />}</For></div>
            <div class="bl-dial__face"><span>FOCUS RING</span><h2>{currentTitle()}</h2><strong>{displayTime()}</strong><small><i class="bl-led bl-led--lime" /> {stateLabel()}</small><span class="bl-dial__needle" style={{ transform: `rotate(${progress() * 300 - 150}deg)` }} /></div>
          </div>
          <div class="bl-dial-controls"><Show when={props.timer().isRunning} fallback={<button type="button" class="bl-lime-button bl-lime-button--wide" disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}><Play size={18} fill="currentColor" aria-hidden="true" /> {props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}><button type="button" class="bl-lime-button bl-lime-button--wide" disabled={props.busy()} onClick={() => void props.onPause()}><Pause size={18} fill="currentColor" aria-hidden="true" /> 暂停本段</button></Show><div class="bl-round-buttons"><button type="button" class="bl-dark-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}><CheckCircle2 size={16} aria-hidden="true" /> 完成并记录</button><button type="button" class="bl-dark-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={15} aria-hidden="true" /> 重置</button></div></div>
        </section>

        <BlPanel title="FOCUS PROFILE / 专注配置" code="CFG / ACTIVE" class="bl-session-profile">
          <label class="bl-console-field"><span>模式 / MODE</span><div class="bl-mode-buttons"><button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div></label>
          <label class="bl-console-field"><span>本次专注 / TITLE</span><input type="text" name="botanicalSessionTitle" value={props.sessionTitle()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} placeholder="输入本次专注的意图" onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
          <Show when={props.timer().modeKey === "countdown"}><label class="bl-console-field"><span>时长 / PRESET</span><div class="bl-number-field"><input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><b>MIN</b></div></label></Show>
          <label class="bl-console-field"><span>关联待办 / LINK</span><select value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => updateLinkedTodo(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
          <Show when={props.linkedTodoId() !== null}><label class="bl-check-row"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={props.busy() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成本段时标记待办</span></label></Show>
          <div class="bl-profile-note"><span class="bl-led bl-led--orange" /> {props.timer().modeSwitchHint ?? "专注配置已就绪"}</div>
        </BlPanel>
      </div>
      <section class="bl-focus-bottom"><div><span>今日已专注</span><strong>{props.timer().completedFocusCount}</strong><small>段</small></div><div><span>连续天数</span><strong> {props.timer().completedFocusCount > 0 ? "09" : "00"}</strong><small>天</small></div><div><span>当前状态</span><strong>{stateLabel()}</strong></div><div class="bl-focus-key"><Keyboard size={15} aria-hidden="true" /><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><small>开始 / 继续</small></div></section>
    </section>
  );
}

interface BotanicalTodoCardProps {
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

function BotanicalTodoCard(props: BotanicalTodoCardProps) {
  const editing = createMemo(() => props.editingTodo()?.id === props.item.id);
  return (
    <article classList={{ "bl-todo-card": true, "is-editing": editing(), "is-complete": props.item.isCompleted }}>
      <span class="bl-todo-card__number">{String(props.item.id).padStart(2, "0")}</span>
      <Show when={!editing()} fallback={<div class="bl-edit-grid"><input aria-label="待办事项" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /><input aria-label="截止日期" type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /><input aria-label="时间" type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /><select aria-label="重要程度" value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select><div><button type="button" class="bl-inline-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="bl-quiet-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>}>
        <button type="button" class="bl-todo-check" aria-label={props.item.isCompleted ? "恢复待办" : "完成待办"} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}>{props.item.isCompleted ? <Check size={15} aria-hidden="true" /> : <span />}</button>
        <div class="bl-todo-card__body"><strong>{props.item.title}</strong><small>{props.formatTodoDue(props.item)}</small><span>{props.importanceLabel(props.item.importanceKey)} · {blImportance(props.item.importanceKey)}</span></div>
        <div class="bl-todo-card__actions"><button type="button" class="bl-quiet-button" disabled={props.busy() || props.timerHasProgress() || props.item.isCompleted} onClick={() => props.onUseForFocus(props.item)}>专注</button><button type="button" class="bl-quiet-button" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="bl-quiet-button bl-quiet-button--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button></div>
      </Show>
    </article>
  );
}

export function BotanicalLibraryTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedId = createMemo(() => props.timer().linkedTodoId);
  const queued = createMemo(() => props.activeTodos().filter((item) => item.id !== focusedId()));
  const active = createMemo(() => props.activeTodos().filter((item) => item.id === focusedId()));
  const completion = createMemo(() => props.todos().length === 0 ? 0 : Math.round((props.completedTodos().length / props.todos().length) * 100));
  const rowProps = { editingTodo: props.editingTodo, busy: props.busy, timerHasProgress: props.timerHasProgress, formatTodoDue: props.formatTodoDue, importanceLabel: props.importanceLabel, onToggle: props.onToggle, onBeginEdit: props.onBeginEdit, onUseForFocus: props.onUseForFocus, onRemove: props.onRemove, onPatch: props.onPatch, onSave: props.onSave, onCancel: props.onCancel };

  return (
    <section class="bl-page bl-todos-page" aria-label="生长清单">
      <header class="bl-page-head bl-page-head--split"><div><span class="bl-date-code">GROWTH / 24 × 06 · {blDate(blLocalDateKey())}</span><h1>GROWTH LIST <em>/ 生长清单</em></h1><p>让下一步像种子一样安静落地。</p></div><button type="button" class="bl-lime-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} {createOpen() ? "收起" : "ADD SEED"}</button></header>
      <Show when={createOpen()}><form class="bl-create-task" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setCreateOpen(false); }}><span class="bl-panel-label">SEED TRAY / NEW</span><input type="text" name="botanicalTodoTitle" value={props.todoTitle()} placeholder="输入下一件要完成的事" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /><input type="date" name="botanicalTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /><input type="time" name="botanicalTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /><select name="botanicalTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">P1 高</option><option value="medium">P2 中</option><option value="low">P3 低</option></select><button type="submit" class="bl-lime-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "QUEUE"}</button></form></Show>
      <div class="bl-task-layout">
        <div class="bl-task-bays">
          <BlPanel title="QUEUED / 待处理" code={`BAY-001.Q · ${queued().length}`} class="bl-task-bay bl-task-bay--queued"><div class="bl-task-grid"><Show when={props.ready()} fallback={<div class="bl-empty-console">正在读取队列…</div>}><For each={queued()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={queued().length === 0}><div class="bl-empty-console">队列为空</div></Show></Show></div></BlPanel>
          <BlPanel title="ACTIVE / 正在推进" code={`BAY-002.A · ${active().length}`} class="bl-task-bay bl-task-bay--active"><div class="bl-task-grid"><For each={active()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={active().length === 0}><div class="bl-empty-console">没有进行中的事项</div></Show></div></BlPanel>
          <BlPanel title="DONE / 已完成" code={`BAY-003.D · ${props.completedTodos().length}`} class="bl-task-bay bl-task-bay--done"><div class="bl-task-grid"><For each={props.completedTodos()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={props.completedTodos().length === 0}><div class="bl-empty-console">完成一项后会归档在这里</div></Show></div></BlPanel>
        </div>
        <BlPanel title="NEXT FOCUS / 下一段专注" code="MOD-NEXT.45" class="bl-next-task-panel"><Show when={props.activeTodos()[0]} fallback={<div class="bl-operation-empty"><span>NO SEED ASSIGNED</span><h2>等待下一段</h2><p>从左侧队列选一项开始。</p></div>}>{(item) => <div class="bl-next-task-content"><span class="bl-card-kicker">TASK.ID</span><strong class="bl-task-id">{String(item().id).padStart(2, "0")}</strong><span class="bl-card-kicker">TASK.TITLE</span><h2>{item().title}</h2><span class="bl-card-kicker">DURATION</span><strong class="bl-duration-readout">{Math.round((props.timer().targetDurationMs ?? 45 * 60 * 1000) / 60000)}<small> MIN</small></strong><span class="bl-card-kicker">NOTE</span><p>{props.formatTodoDue(item())}</p><button type="button" class="bl-lime-button bl-lime-button--wide" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(item())}><Play size={17} fill="currentColor" aria-hidden="true" /> START / 开始专注</button><div class="bl-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></div></div>}</Show></BlPanel>
      </div>
      <footer class="bl-todo-footer"><div><span>今日完成</span><strong>{String(props.completedTodos().length).padStart(2, "0")}</strong><small>项</small></div><div><span>待处理</span><strong>{String(queued().length).padStart(2, "0")}</strong><small>项</small></div><div class="bl-completion-meter"><span>系统状态</span><i><b style={{ width: `${completion()}%` }} /></i><strong>{completion()}%</strong></div><div><span>LIBRARY ID</span><strong>FM-GROW-{String(props.todos().length).padStart(4, "0")}</strong></div></footer>
    </section>
  );
}

export function BotanicalLibraryRecords(props: NightValleyRecordsProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const [visibleCount, setVisibleCount] = createSignal(200);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const visibleRecords = createMemo(() => selectedRecords().slice(0, visibleCount()));
  createEffect(() => { const date = selectedDate(); const count = selectedRecords().length; setVisibleCount(200); setExpandedDate(count <= 200 ? date : null); });

  return (
    <section class="bl-page bl-records-page" aria-label="成长记录">
      <header class="bl-page-head bl-page-head--split"><div><span class="bl-date-code">BOTANICAL ARCHIVE / FOCUS RINGS</span><h1>GROWTH RECORDS <em>/ 成长记录</em></h1><p>沿着年轮回看，看见自己的专注节奏。</p></div><div class="bl-records-actions"><button type="button" class="bl-dark-button" disabled title="导出记录尚未接入"><Download size={15} aria-hidden="true" /> EXPORT</button><span class="bl-head-status"><i class="bl-led bl-led--lime" /> GREENHOUSE OK</span></div></header>
      <BlPanel title="GROWTH SIGNAL / 生长信号" code={`${props.formatAnalyticsDate(selectedDate())} · 7D`} class="bl-signal-panel"><div class="bl-signal-chart"><div class="bl-signal-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div class="bl-signal-days"><For each={props.archiveDays()}>{(day) => <button type="button" classList={{ "bl-signal-day": true, active: day.date === selectedDate() }} onClick={() => props.onSelectDate(day.date)}><span>{props.formatAnalyticsDate(day.date)}</span><strong>{day.totalDurationLabel}</strong><i><b style={{ height: `${Math.max(6, (day.totalDurationMs / maxDuration()) * 100)}%` }} /></i><small>{day.sessionCount} RING</small></button>}</For></div></div><div class="bl-chart-foot"><span>0</span><strong>累计 {props.formatDurationMs(props.recentWeekDurationMs())}</strong><span>100</span></div></BlPanel>
      <section class="bl-record-stat-grid"><div><span>累计专注</span><strong>{blAnalytics(props.analytics(), "totalFocusDurationLabel", "00:00:00")}</strong><small>HH : MM : SS</small></div><div><span>完成段数</span><strong>{blAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>RINGS</small></div><div><span>平均时长</span><strong>{props.analytics()?.sessionCount ? props.formatDurationMs(props.recentWeekDurationMs() / Math.max(1, props.analytics()?.sessionCount ?? 1)) : "00:00:00"}</strong><small>PER RING</small></div><div><span>连续天数</span><strong>{blAnalytics(props.analytics(), "currentStreakDays", "0")}</strong><small>STREAK</small></div></section>
      <div class="bl-records-grid"><BlPanel title="成长日志 / RING LOG" code={`${selectedRecords().length} EVENTS`} class="bl-event-log"><div class="bl-event-log__heading"><span>时间</span><span>事件</span><span>强度</span><span>状态</span></div><Show when={visibleRecords().length > 0} fallback={<div class="bl-empty-console">当前日期没有专注事件</div>}><For each={visibleRecords().slice(0, 12)}>{(record) => <div class="bl-event-row"><i class="bl-led bl-led--lime" /><time>{blTime(record)}</time><span>{record.title}</span><b><i /><i /><i /><i /><i /></b><strong>OK</strong></div>}</For><Show when={visibleCount() < selectedRecords().length}><button type="button" class="bl-inline-button" onClick={() => setVisibleCount((count) => Math.min(count + 200, selectedRecords().length))}>加载更多 · {visibleCount()} / {selectedRecords().length}</button></Show></Show></BlPanel><BlPanel title="植物分布 / BOTANICAL ANALYZER" code="BAND / DAY" class="bl-analyzer-panel"><div class="bl-radar"><i /><i /><i /><span>LIGHT</span></div><div class="bl-band-list"><div><span>清晨 <small>05:00—11:00</small></span><strong>34%</strong></div><div><span>午间 <small>11:00—17:00</small></span><strong>41%</strong></div><div><span>夜晚 <small>17:00—23:00</small></span><strong>25%</strong></div></div><p>洞察 / INSIGHT<br /><strong>午间专注占比最高，适合安排深度工作。</strong></p></BlPanel></div>
      <BlPanel title="更长的路 / 30-DAY GROWTH" code="TREND / ARCHIVE" class="bl-trend-panel"><div class="bl-trend-lines"><For each={props.archiveDays()}>{(day, index) => <button type="button" classList={{ active: day.date === selectedDate() }} style={{ left: `${index() * (100 / Math.max(1, props.archiveDays().length - 1))}%`, bottom: `${Math.max(8, (day.totalDurationMs / maxDuration()) * 80)}%` }} onClick={() => props.onSelectDate(day.date)}><i /><span>{props.formatAnalyticsDate(day.date)}</span></button>}</For></div><div class="bl-trend-footer"><span>最近 7 天</span><strong>{props.recentWeekActiveDays()} 天有投入</strong><button type="button" class="bl-quiet-button" onClick={() => props.onSelectDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? selectedDate())}>VIEW ALL <ChevronRight size={14} aria-hidden="true" /></button></div></BlPanel>
      <section class="bl-history-index"><header><span>FULL INDEX / ALL RECORDS</span><strong>{props.records().length} ROUNDS</strong></header><Show when={props.ready() && props.records().length > 0} fallback={<div class="bl-empty-console">完成一次计时后，记录会显示在这里。</div>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedDate() === group.date}><div>{group.records.slice(0, 200).map((record) => <span>{record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
      <BlStatusStrip analytics={props.analytics} timer={() => ({ ...({} as TimerSnapshot), isRunning: false } as TimerSnapshot)} />
    </section>
  );
}

export function BotanicalLibrarySettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const toggle = (checked: boolean, key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled") => void props.onSaveTimerPreferences({ [key]: checked });

  return (
    <section class="bl-page bl-settings-page" aria-label="温室设置">
      <header class="bl-page-head bl-page-head--split"><div><span class="bl-date-code">GREENHOUSE / CONTROL SURFACE</span><h1>GREENHOUSE <em>/ 温室设置</em></h1><p>调整你的专注空间，让每一次进入都自然。</p></div><div class="bl-head-status"><i class="bl-led bl-led--lime" /> FIELD SYNC / READY</div></header>
      <div class="bl-settings-layout"><nav class="bl-settings-nav" aria-label="设置分组"><a href="#bl-appearance">01 <span>外观</span></a><a href="#bl-behavior">02 <span>行为</span></a><a href="#bl-audio">03 <span>音频</span></a><a href="#bl-shortcuts">04 <span>快捷键</span></a><a href="#bl-data">05 <span>数据</span></a></nav><div class="bl-settings-main">
        <BlPanel title="BOTANICAL FIELD / 外观矩阵" code="THEME / 05" class="bl-settings-appearance" ><div id="bl-appearance" class="bl-theme-matrix"><For each={themes}>{(theme) => <button type="button" classList={{ "bl-theme-card": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class={`bl-theme-card__preview bl-theme-card__preview--${theme.id}`}><i /><b /><em /></span><strong>{theme.name}</strong><small>{theme.implemented ? "可用" : "尚未实现"}</small></button>}</For></div><div class="bl-setting-slider-list"><label><span>灯光亮度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>叶影动效 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label><span>界面密度 <b>{props.density() === "roomy" ? "标准" : "紧凑"}</b></span><input type="range" min="0" max="1" step="1" value={props.density() === "compact" ? 1 : 0} onInput={(event) => props.onDensityChange(event.currentTarget.value === "1" ? "compact" : "roomy")} /></label></div></BlPanel>
        <BlPanel title="INPUT / BEHAVIOR" code="SWITCH / LIVE" class="bl-behavior-panel" ><div id="bl-behavior" class="bl-switch-list"><label><span><strong>完成后自动进入下一段</strong><small>AUTO NEXT SEGMENT</small></span><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "toastReminderEnabled")} /><i /></label><label><span><strong>结束时显示总结</strong><small>SHOW SUMMARY AT END</small></span><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "windowAttentionReminderEnabled")} /><i /></label><label><span><strong>持续专注提醒</strong><small>FOCUS REMINDER · 每 60 分钟</small></span><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "soundReminderEnabled")} /><i /></label></div><div class="bl-response-readout"><span>QUIET RESPONSE</span><strong>120 <small>ms</small></strong><i class="bl-signal-bars"><b /><b /><b /><b /><b /><b /><b /><b /></i></div></BlPanel>
        <BlPanel title="SOUND & AIR / 声音与提示" code="BUS / 01" class="bl-audio-panel"><div id="bl-audio" class="bl-audio-grid"><label class="bl-console-field"><span>环境音 / ENVIRONMENT</span><select disabled><option>轻雨书房</option></select></label><label class="bl-console-field"><span>提醒音效 / ALERT</span><select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></label><div class="bl-audio-actions"><button type="button" class="bl-dark-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} aria-hidden="true" />试听</button><button type="button" class="bl-dark-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入</button><Show when={props.customAlertSoundName()}><button type="button" class="bl-quiet-button" onClick={() => void props.onClearCustomAlertSound()}>移除</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></BlPanel>
        <BlPanel title="KEY MAP / 快捷键" code="INPUT / HOTKEY" class="bl-shortcuts-panel"><div id="bl-shortcuts" class="bl-key-map"><div><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd><span>开始专注 / START FOCUS</span></div><div><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>E</kbd><span>结束本段 / END SEGMENT</span></div><div><kbd>F11</kbd><span>全屏 / TOGGLE FULLSCREEN</span></div></div></BlPanel>
        <BlPanel title="LOCAL SAFETY / 本地数据" code="DATA / SAFE" class="bl-data-panel"><div id="bl-data" class="bl-data-copy"><ShieldCheck size={20} aria-hidden="true" /><p>待办、专注记录和未完成计时状态只保存在这台电脑上。</p></div><div class="bl-data-actions"><button type="button" class="bl-lime-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="bl-dark-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开目录</button><button type="button" class="bl-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空数据</button></div><Show when={props.lastBackupPath()}><p class="bl-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "error"}><div class="bl-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="bl-inline-button" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="bl-console-field"><span>选择备份</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></label><button type="button" class="bl-dark-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show></BlPanel>
      </div></div>
      <footer class="bl-settings-footer"><span>ACTIVE FIELD / {activeTheme().englishName.toUpperCase()}</span><strong>{activeTheme().name}</strong><button type="button" class="bl-lime-button" onClick={props.onSaveVisualSettings}><Save size={15} aria-hidden="true" /> APPLY / 保存更改</button></footer>
    </section>
  );
}
