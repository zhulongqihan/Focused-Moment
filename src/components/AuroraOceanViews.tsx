import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
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

const orbitPositions = [
  { left: 13, top: 54 },
  { left: 26, top: 29 },
  { left: 43, top: 18 },
  { left: 62, top: 26 },
  { left: 79, top: 46 },
  { left: 68, top: 72 },
  { left: 38, top: 78 },
];

function aoLocalDateKey() {
  const now = new Date();
  return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

function aoDate(value: string) {
  return value.replace(/-/g, " · ");
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

function aoBandStats(records: FocusRecord[]) {
  const bands = [
    { label: "深夜", range: "00—05", from: 0, to: 5, minutes: 0 },
    { label: "晨光", range: "05—11", from: 5, to: 11, minutes: 0 },
    { label: "日光", range: "11—17", from: 11, to: 17, minutes: 0 },
    { label: "蓝调", range: "17—24", from: 17, to: 24, minutes: 0 },
  ];
  records.forEach((record) => {
    const match = aoTime(record).match(/^(\d{2})/);
    const hour = match ? Number(match[1]) : 0;
    const band = bands.find((item) => hour >= item.from && hour < item.to) ?? bands[0];
    band.minutes += Math.max(0, record.durationMs) / 60000;
  });
  const total = bands.reduce((sum, item) => sum + item.minutes, 0);
  return bands.map((item) => ({ ...item, percentage: total ? Math.round((item.minutes / total) * 100) : 0 }));
}

function AoGlass(props: { title?: string; note?: string; class?: string; children: any }) {
  return (
    <section class={"ao-glass " + (props.class ?? "")}>
      <Show when={props.title}>
        <header class="ao-glass__heading"><span>{props.title}</span><small>{props.note}</small></header>
      </Show>
      {props.children}
    </section>
  );
}

function AoPulse({ class: className = "" }: { class?: string }) {
  return <span class={"ao-pulse " + className} aria-hidden="true"><i /><i /><i /></span>;
}

function AoFieldLabel(props: { label: string; children: any; class?: string }) {
  return <label class={"ao-field " + (props.class ?? "")}><span>{props.label}</span>{props.children}</label>;
}

function AoStatusLine(props: { analytics: () => AnalyticsSnapshot | null; timer: () => TimerSnapshot }) {
  return (
    <footer class="ao-status-line" aria-label="光场状态">
      <span><i class="ao-status-dot" /> LIGHT FIELD ONLINE</span>
      <span>今日专注 <strong>{aoAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong></span>
      <span>记录 <strong>{aoAnalytics(props.analytics(), "sessionCount", "0")}</strong></span>
      <span class="ao-status-line__state"><AoPulse /> {props.timer().isRunning ? "潮汐正在流动" : "等待下一束光"}</span>
    </footer>
  );
}

export function AuroraOceanToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const sequence = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].slice(0, 7));
  const activeIndex = createMemo(() => props.todayCompletedTodos().length);
  const nextTodo = createMemo(() => props.nextTodo());
  const focusDuration = createMemo(() => aoAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00"));

  return (
    <section class="ao-page ao-today-page" aria-label="潮汐轨迹">
      <header class="ao-page-top">
        <div><span class="ao-eyebrow">AURORA OCEAN / {aoDate(props.todayDate)}</span><span class="ao-breadcrumb">深海光场 · 今日轨迹</span></div>
        <div class="ao-streak-chip"><span>连续投入</span><strong>{String(streak()).padStart(2, "0")}</strong><small>天</small></div>
      </header>

      <div class="ao-today-hero">
        <div class="ao-today-intro">
          <span class="ao-kicker">TIDE / {props.todayLabel}</span>
          <h2 class="ao-surface-title">TIDE / 潮汐轨迹</h2>
          <h1>让注意力<br /><em>浮向下一束光。</em></h1>
          <p>把今天的事项放进潮汐轨道，光会告诉你下一步应该落在哪里。</p>
          <div class="ao-intro-actions">
            <Show when={nextTodo()} fallback={<button type="button" class="ao-aqua-button" onClick={props.onOpenTodos}><Plus size={16} aria-hidden="true" /> START / 开始专注</button>}>
              {(item) => <button type="button" class="ao-aqua-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}><Play size={16} fill="currentColor" aria-hidden="true" /> START / 开始专注 <ArrowRight size={15} aria-hidden="true" /></button>}
            </Show>
            <button type="button" class="ao-ghost-link" onClick={props.onOpenRecords}>查看潮汐记录 <ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          <div class="ao-intro-note"><AoPulse /><span>{props.timer().isRunning ? "当前专注正在形成潮汐" : "今天的光场已准备好"}</span></div>
        </div>

        <div class="ao-orbit-stage" aria-label="今日潮汐轨道">
          <div class="ao-orbit-aura" />
          <div class="ao-orbit-ring ao-orbit-ring--outer" />
          <div class="ao-orbit-ring ao-orbit-ring--inner" />
          <svg class="ao-orbit-route" viewBox="0 0 680 480" aria-hidden="true">
            <path d="M82 289 C126 106 313 65 466 126 C625 188 587 358 407 392 C243 423 125 375 82 289" />
            <path d="M184 365 C111 286 179 152 319 139 C471 125 549 218 493 306" />
          </svg>
          <div class="ao-orbit-center">
            <span>NOW / 当前</span>
            <strong>{props.timer().isRunning ? "IN FLOW" : "LOW TIDE"}</strong>
            <small>{focusDuration()}</small>
          </div>
          <For each={sequence()}>
            {(item, index) => {
              const point = orbitPositions[index() % orbitPositions.length];
              const completed = item.isCompleted;
              const active = index() === activeIndex();
              return (
                <button type="button" classList={{ "ao-orbit-node": true, "is-complete": completed, "is-current": active }} style={"left:" + String(point.left) + "%;top:" + String(point.top) + "%;"} disabled={props.busy() || completed || props.timerHasProgress()} onClick={() => props.onUseTodo(item)}>
                  <span class="ao-orbit-node__halo" /><b>{String(index() + 1).padStart(2, "0")}</b><strong>{item.title}</strong><small>{item.scheduledTime || (completed ? "已完成" : "待安排")}</small>
                </button>
              );
            }}
          </For>
          <Show when={sequence().length === 0}><div class="ao-orbit-empty"><CircleDot size={24} /><strong>轨道还没有节点</strong><span>添加一件待办，让今天开始发光。</span></div></Show>
          <span class="ao-orbit-caption ao-orbit-caption--one">FLOAT</span><span class="ao-orbit-caption ao-orbit-caption--two">BREATHE</span>
        </div>
      </div>

      <div class="ao-today-rail">
        <AoGlass class="ao-next-capsule">
          <span class="ao-capsule-label">NEXT TIDE / 下一段潮汐</span>
          <Show when={nextTodo()} fallback={<><strong>等待一个念头浮上来</strong><p>去待办里写下下一步，轨道会为它留出位置。</p><button type="button" class="ao-text-button" onClick={props.onOpenTodos}>添加待办 <ArrowRight size={14} /></button></>}>
            {(item) => <><strong>{item().title}</strong><p>{props.formatTodoDue(item())} · 建议 {props.defaultFocusMinutes()} 分钟</p><button type="button" class="ao-text-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}>让它成为焦点 <ArrowRight size={14} /></button></>}
          </Show>
        </AoGlass>
        <AoGlass class="ao-today-metrics">
          <div><span>今日完成</span><strong>{String(props.todayCompletedTodos().length).padStart(2, "0")}</strong><small>项</small></div><div><span>今日专注</span><strong>{focusDuration()}</strong><small>时长</small></div><div><span>累计记录</span><strong>{aoAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>段</small></div><div><span>状态</span><strong>{aoTimerLabel(props.timer(), props.timerHasProgress())}</strong><small>{props.timer().mode}</small></div>
        </AoGlass>
      </div>
      <AoStatusLine analytics={props.analytics} timer={props.timer} />
    </section>
  );
}

export function AuroraOceanFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => {
    if (props.timer().modeKey === "countdown" && props.countdownDraftDirty()) {
      return String(Math.floor(props.countdownMinutes() / 60)).padStart(2, "0") + ":" + String(props.countdownMinutes() % 60).padStart(2, "0") + ":00";
    }
    return props.timer().elapsedLabel;
  });
  const progress = createMemo(() => aoProgress(props.timer(), props.timerHasProgress()));
  const currentTitle = createMemo(() => props.sessionTitle().trim() || props.timer().activeTaskTitle || "未命名专注");
  const stateLabel = createMemo(() => aoTimerLabel(props.timer(), props.timerHasProgress()));
  const recentRecords = createMemo(() => props.todos().slice(0, 4));

  function updateLinkedTodo(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) props.onSessionTitleChange(item.title);
  }

  return (
    <section class="ao-page ao-focus-page" aria-label="潮汐计时">
      <header class="ao-page-top"><div><span class="ao-eyebrow">TIDE ENGINE / DEPTH PROFILE</span><span class="ao-breadcrumb">深海光场 · 计时器</span></div><div class="ao-live-chip"><i class="ao-status-dot" /> {stateLabel()} <strong>{props.timer().mode}</strong></div></header>
      <div class="ao-focus-hero">
        <div class="ao-focus-copy">
          <span class="ao-kicker">FOCUS / 潮汐计时</span><h1>沉入这一段<br /><em>只和时间在一起。</em></h1><p>把外面的噪声交给海面。你只需要决定，下一束光照向什么。</p>
          <div class="ao-wave-history"><span class="ao-section-label">RECENT WAVES / 最近片段</span><For each={recentRecords()}>{(item, index) => <div class="ao-wave-history__row"><b>{String(index() + 1).padStart(2, "0")}</b><span>{item.title}</span><small>{item.scheduledTime || "--:--"}</small><i /></div>}</For><Show when={recentRecords().length === 0}><p class="ao-muted">完成第一段专注后，潮汐会在这里留下痕迹。</p></Show><button type="button" class="ao-ghost-link" onClick={props.onOpenRecords}>打开记录 <ChevronRight size={14} /></button></div>
        </div>
        <section class="ao-fluid-timer" aria-label="计时器">
          <div class="ao-fluid-timer__halo" /><svg class="ao-fluid-timer__rings" viewBox="0 0 420 420" aria-hidden="true"><circle class="ao-fluid-timer__track" cx="210" cy="210" r="174" /><circle class="ao-fluid-timer__progress" cx="210" cy="210" r="174" style={"stroke-dashoffset:" + String(1093 - 1093 * progress())} /></svg>
          <div class="ao-fluid-timer__face"><span>{props.timer().modeKey === "countdown" ? "COUNTDOWN" : "STOPWATCH"}</span><strong>{displayTime()}</strong><small><i class="ao-status-dot" /> {stateLabel()}</small><em>{currentTitle()}</em></div><div class="ao-fluid-timer__bubble ao-fluid-timer__bubble--a" /><div class="ao-fluid-timer__bubble ao-fluid-timer__bubble--b" /><div class="ao-fluid-timer__bubble ao-fluid-timer__bubble--c" />
          <div class="ao-timer-actions"><Show when={props.timer().isRunning} fallback={<button type="button" class="ao-aqua-button ao-aqua-button--wide" disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}><Play size={18} fill="currentColor" /> {props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}><button type="button" class="ao-aqua-button ao-aqua-button--wide" disabled={props.busy()} onClick={() => void props.onPause()}><Pause size={18} fill="currentColor" /> 暂停此潮</button></Show><div><button type="button" class="ao-glass-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}><CheckCircle2 size={15} /> 完成并记录</button><button type="button" class="ao-glass-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={15} /> 重置</button></div></div>
        </section>
        <AoGlass title="FOCUS BOTTLE / 专注配置" note="LIGHT / 01" class="ao-focus-bottle"><div class="ao-bottle-glow" /><AoFieldLabel label="这一段想照亮什么？"><input type="text" name="auroraSessionTitle" value={props.sessionTitle()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} placeholder="写下一个清晰的意图" onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></AoFieldLabel><AoFieldLabel label="模式"><div class="ao-segmented"><button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div></AoFieldLabel><Show when={props.timer().modeKey === "countdown"}><AoFieldLabel label="潮汐长度"><div class="ao-number-input"><input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><span>分钟</span></div></AoFieldLabel></Show><AoFieldLabel label="连接待办"><select value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => updateLinkedTodo(event.currentTarget.value)}><option value="">不连接待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></AoFieldLabel><Show when={props.linkedTodoId() !== null}><label class="ao-check-line"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={props.busy() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成时标记这件待办</span></label></Show><p class="ao-bottle-note"><AoPulse /> {props.timer().modeSwitchHint ?? "光场已就绪，等你按下开始。"}</p></AoGlass>
      </div>
      <div class="ao-focus-footer"><span>今日已完成 <strong>{props.timer().completedFocusCount}</strong> 段</span><span>当前状态 <strong>{stateLabel()}</strong></span><span class="ao-focus-shortcut"><Keyboard size={14} /><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd><small>开始 / 继续</small></span></div>
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
    <article classList={{ "ao-tide-card": true, "is-complete": props.item.isCompleted, "is-editing": editing() }}>
      <Show when={!editing()} fallback={<div class="ao-edit-grid"><input aria-label="待办事项" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /><input aria-label="截止日期" type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /><input aria-label="时间" type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /><select aria-label="重要程度" value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select><div><button type="button" class="ao-text-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="ao-ghost-link" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>}>
        <button type="button" class="ao-tide-card__check" aria-label={props.item.isCompleted ? "恢复待办" : "完成待办"} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}>{props.item.isCompleted ? <Check size={15} /> : <span />}</button><div class="ao-tide-card__copy"><span>{aoImportance(props.item.importanceKey)} · {props.importanceLabel(props.item.importanceKey)}</span><strong>{props.item.title}</strong><small>{props.formatTodoDue(props.item)}</small></div><div class="ao-tide-card__actions"><button type="button" class="ao-card-action" disabled={props.busy() || props.timerHasProgress() || props.item.isCompleted} onClick={() => props.onUseForFocus(props.item)}>带入专注</button><button type="button" class="ao-card-action" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="ao-card-action ao-card-action--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button></div>
      </Show>
    </article>
  );
}

export function AuroraOceanTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedId = createMemo(() => props.timer().linkedTodoId);
  const nowItems = createMemo(() => [...props.overdueTodos(), ...props.activeTodos().filter((item) => item.id === focusedId() || Boolean(item.scheduledTime))]);
  const laterItems = createMemo(() => props.activeTodos().filter((item) => !nowItems().some((now) => now.id === item.id)));
  const rowProps = { editingTodo: props.editingTodo, busy: props.busy, timerHasProgress: props.timerHasProgress, formatTodoDue: props.formatTodoDue, importanceLabel: props.importanceLabel, onToggle: props.onToggle, onBeginEdit: props.onBeginEdit, onUseForFocus: props.onUseForFocus, onRemove: props.onRemove, onPatch: props.onPatch, onSave: props.onSave, onCancel: props.onCancel };
  const completion = createMemo(() => props.todos().length ? Math.round((props.completedTodos().length / props.todos().length) * 100) : 0);

  return (
    <section class="ao-page ao-todos-page" aria-label="潮汐清单">
      <header class="ao-page-top"><div><span class="ao-eyebrow">TIDE LIST / {aoDate(aoLocalDateKey())}</span><span class="ao-breadcrumb">深海光场 · 待办气泡</span></div><button type="button" class="ao-aqua-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} /> : <Plus size={16} />} {createOpen() ? "收起" : "加入潮汐"}</button></header>
      <div class="ao-todos-intro"><div><span class="ao-kicker">TIDE LIST / 潮汐清单</span><h1>把事情放回<br /><em>它们该在的水层。</em></h1></div><p>现在、稍后、已经抵达。每一件事都有自己的潮汐，不需要同时浮在眼前。</p></div>
      <Show when={createOpen()}><form class="ao-add-bubble" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setCreateOpen(false); }}><span class="ao-section-label">NEW BUBBLE / 新气泡</span><input type="text" name="auroraTodoTitle" value={props.todoTitle()} placeholder="写下一件要完成的事" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /><div><input type="date" name="auroraTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /><input type="time" name="auroraTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /><select name="auroraTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高优先</option><option value="medium">普通</option><option value="low">低优先</option></select><button type="submit" class="ao-aqua-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "放入水面"}</button></div></form></Show>
      <div class="ao-reef-board">
        <section class="ao-reef-zone ao-reef-zone--now"><header><span class="ao-zone-mark">01</span><div><span>NOW / 现在</span><strong>{nowItems().length} 个气泡</strong></div><AoPulse /></header><div class="ao-reef-list"><Show when={props.ready()} fallback={<p class="ao-muted">正在读取潮汐…</p>}><For each={nowItems()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={nowItems().length === 0}><div class="ao-reef-empty"><span>○</span><strong>这里很安静</strong><small>把正在靠近的事项放进来。</small></div></Show></Show></div></section>
        <section class="ao-reef-zone ao-reef-zone--later"><header><span class="ao-zone-mark">02</span><div><span>LATER / 稍后</span><strong>{laterItems().length} 个气泡</strong></div><i class="ao-zone-wave" /></header><div class="ao-reef-list"><For each={laterItems()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={laterItems().length === 0}><div class="ao-reef-empty"><span>≈</span><strong>稍后没有等待</strong><small>可以把注意力留给现在。</small></div></Show></div></section>
        <section class="ao-reef-zone ao-reef-zone--arrived"><header><span class="ao-zone-mark">03</span><div><span>ARRIVED / 已抵达</span><strong>{props.completedTodos().length} 个气泡</strong></div><span class="ao-checkmark"><Check size={13} /></span></header><div class="ao-reef-list"><For each={props.completedTodos()}>{(item) => <AuroraTodoCard item={item} {...rowProps} />}</For><Show when={props.completedTodos().length === 0}><div class="ao-reef-empty"><span>✦</span><strong>完成一件，它会抵达这里</strong><small>完成不是终点，是今天留下的光。</small></div></Show></div></section>
      </div>
      <footer class="ao-todo-dock"><div><span>今日潮汐</span><strong>{completion()}%</strong><i><b style={"width:" + String(completion()) + "%"} /></i></div><div><span>专注连接</span><strong>{props.timer().linkedTodoId ? "已连接" : "未连接"}</strong></div><div><span>下一步</span><strong>{props.activeTodos()[0]?.title ?? "等待新事项"}</strong></div></footer>
    </section>
  );
}

export function AuroraOceanRecords(props: NightValleyRecordsProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const bandStats = createMemo(() => aoBandStats(props.records()));
  const [visibleCount, setVisibleCount] = createSignal(12);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const visibleRecords = createMemo(() => selectedRecords().slice(0, visibleCount()));
  createEffect(() => { selectedDate(); setVisibleCount(12); setExpandedDate(null); });

  return (
    <section class="ao-page ao-records-page" aria-label="潮汐记录">
      <header class="ao-page-top"><div><span class="ao-eyebrow">TIDE ARCHIVE / {props.formatAnalyticsDate(selectedDate())}</span><span class="ao-breadcrumb">深海光场 · 记录回看</span></div><div class="ao-records-head"><span><i class="ao-status-dot" /> LOCAL ARCHIVE</span></div></header>
      <div class="ao-records-intro"><div><span class="ao-kicker">ARCHIVE / 潮汐记录</span><h1>每一束光<br /><em>都曾经发生。</em></h1></div><div class="ao-archive-range"><span>最近 7 天</span><strong>{props.formatArchiveRangeDate(props.archiveDays()[0]?.date ?? selectedDate())} — {props.formatArchiveRangeDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? selectedDate())}</strong></div></div>
      <AoGlass title="SEVEN DAY TIDE / 七日潮汐" note={props.formatAnalyticsDate(selectedDate())} class="ao-archive-chart-card"><div class="ao-archive-chart"><div class="ao-archive-axis"><span>高</span><span>中</span><span>低</span></div><svg viewBox="0 0 900 250" preserveAspectRatio="none" aria-label="七日专注潮汐图"><path class="ao-archive-grid" d="M0 48H900 M0 124H900 M0 202H900" /><path class="ao-archive-path" d={props.archivePath()} /></svg><div class="ao-archive-points" aria-label="七日专注日期"><For each={props.archiveDays()}>{(day, index) => <button type="button" classList={{ "ao-archive-point": true, active: day.date === selectedDate() }} style={"left:" + String((index() / Math.max(1, props.archiveDays().length - 1)) * 100) + "%;bottom:" + String(Math.max(5, (day.totalDurationMs / maxDuration()) * 74)) + "%"} onClick={() => props.onSelectDate(day.date)}><i /><span>{props.formatAnalyticsDate(day.date)}</span></button>}</For></div></div><div class="ao-chart-legend"><span><i class="ao-status-dot" /> 每个光点代表一天</span><strong>最近七天累计 {props.formatDurationMs(props.recentWeekDurationMs())}</strong><span>{props.recentWeekActiveDays()} 天有投入</span></div></AoGlass>
      <div class="ao-record-stat-grid"><div><span>总投入</span><strong>{aoAnalytics(props.analytics(), "totalFocusDurationLabel", "00:00:00")}</strong><small>全部潮汐</small></div><div><span>完成段数</span><strong>{aoAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>光点</small></div><div><span>平均潮汐</span><strong>{props.analytics()?.sessionCount ? props.formatDurationMs(props.recentWeekDurationMs() / Math.max(1, props.analytics()?.sessionCount ?? 1)) : "00:00:00"}</strong><small>每一段</small></div><div><span>连续天数</span><strong>{aoAnalytics(props.analytics(), "currentStreakDays", "0")}</strong><small>当前</small></div></div>
      <div class="ao-records-lower">
        <AoGlass title="WAVE LOG / 当日潮汐" note={String(selectedRecords().length) + " EVENTS"} class="ao-wave-log"><div class="ao-wave-log__head"><span>时间</span><span>专注意图</span><span>时长</span><span>动作</span></div><Show when={visibleRecords().length > 0} fallback={<div class="ao-empty-records">这一天还没有潮汐。选择另一颗光点，或现在开始一段。</div>}><For each={visibleRecords()}>{(record) => <Show when={props.editingRecord()?.id === record.id} fallback={<div class="ao-wave-row"><time>{aoTime(record)}</time><div><strong>{record.title}</strong><small>{props.formatRecordDate(record)}</small></div><b>{record.durationLabel}</b><div class="ao-wave-row__actions"><button type="button" class="ao-card-action" onClick={() => props.onBeginEdit(record)}>改名</button><button type="button" class="ao-card-action ao-card-action--danger" onClick={() => void props.onRemove(record.id)}>移除</button></div></div>}><div class="ao-wave-row ao-wave-row--editing"><input aria-label="编辑记录标题" value={props.editingRecord()?.title ?? record.title} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} /><button type="button" class="ao-text-button" onClick={() => void props.onSaveEdit()}>保存</button><button type="button" class="ao-ghost-link" onClick={props.onCancelEdit}>取消</button></div></Show>}</For><Show when={visibleCount() < selectedRecords().length}><button type="button" class="ao-ghost-link" onClick={() => setVisibleCount((count) => Math.min(count + 12, selectedRecords().length))}>加载更多 · {visibleCount()} / {selectedRecords().length}</button></Show></Show></AoGlass>
        <AoGlass title="LIGHT DISTRIBUTION / 光场分布" note="ALL RECORDS" class="ao-light-distribution"><div class="ao-spectrum"><For each={bandStats()}>{(band) => <div><span>{band.label}<small>{band.range}</small></span><i><b style={"width:" + String(band.percentage) + "%"} /></i><strong>{band.percentage}%</strong></div>}</For></div><p class="ao-insight"><span>潮汐观察</span><strong>{bandStats().slice().sort((a, b) => b.minutes - a.minutes)[0]?.label ?? "尚无"}是当前最常出现的光线。</strong></p></AoGlass>
      </div>
      <AoGlass title="FULL INDEX / 全部记录" note={String(props.records().length) + " ROUNDS"} class="ao-history-index"><Show when={props.ready() && props.records().length > 0} fallback={<div class="ao-empty-records">完成一次计时后，完整索引会从这里长出来。</div>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 段 · {props.formatDurationMs(group.totalDurationMs)}</strong><ChevronRight size={15} /></summary><Show when={expandedDate() === group.date}><div class="ao-history-items">{group.records.slice(0, 200).map((record) => <span>{aoTime(record)} · {record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></AoGlass>
    </section>
  );
}

export function AuroraOceanSettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const toggle = (checked: boolean, key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled") => void props.onSaveTimerPreferences({ [key]: checked });

  return (
    <section class="ao-page ao-settings-page" aria-label="光场设置">
      <header class="ao-page-top"><div><span class="ao-eyebrow">LIGHT FIELD / SETTINGS</span><span class="ao-breadcrumb">深海光场 · 设置</span></div><div class="ao-live-chip"><i class="ao-status-dot" /> LOCAL / READY</div></header>
      <div class="ao-settings-intro"><span class="ao-kicker">LIGHT FIELD / 光场设置</span><h1>调一束你愿意<br /><em>回来的光。</em></h1><p>视觉、提醒和本地数据都在这里。改变会即时反映在光场中。</p></div>
      <div class="ao-settings-grid">
        <nav class="ao-settings-nav" aria-label="设置分组"><a href="#ao-appearance">01 <span>光场</span></a><a href="#ao-behavior">02 <span>提醒</span></a><a href="#ao-audio">03 <span>声音</span></a><a href="#ao-shortcuts">04 <span>快捷键</span></a><a href="#ao-data">05 <span>本地数据</span></a></nav>
        <div class="ao-settings-main">
          <AoGlass title="THE LIGHT FIELD / 光场" note="APPEARANCE / 01" class="ao-setting-card"><div id="ao-appearance" class="ao-theme-bubbles"><For each={themes}>{(theme) => <button type="button" classList={{ "ao-theme-bubble": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} title={theme.implemented ? "使用" + theme.name + "主题" : theme.name + "主题尚未实现"} onClick={() => props.onThemeSelect(theme.id)}><img src={theme.preview} alt={theme.englishName + " 概念预览"} /><span class="ao-theme-bubble__orb" /><strong>{theme.name}</strong><small>{theme.implemented ? "已接入" : "未接入"}</small></button>}</For></div><div class="ao-setting-sliders"><label><span>光场强度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} aria-label="光场强度" onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>水流动效 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} aria-label="水流动效" onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label><span>界面密度 <b>{props.density() === "roomy" ? "舒展" : "紧凑"}</b></span><div class="ao-density-buttons"><button type="button" classList={{ active: props.density() === "roomy" }} onClick={() => props.onDensityChange("roomy")}>舒展</button><button type="button" classList={{ active: props.density() === "compact" }} onClick={() => props.onDensityChange("compact")}>紧凑</button></div></label></div></AoGlass>
          <AoGlass title="RETURN SIGNAL / 回来提醒" note="BEHAVIOR / 02" class="ao-setting-card"><div id="ao-behavior" class="ao-toggle-list"><label><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "toastReminderEnabled")} /><span><strong>应用内弹窗</strong><small>在当前光场里轻轻出现。</small></span><i /></label><label><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "windowAttentionReminderEnabled")} /><span><strong>任务栏提醒</strong><small>窗口在后台时让你回来。</small></span><i /></label><label><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "soundReminderEnabled")} /><span><strong>声音提醒</strong><small>播放一枚短促的潮汐声。</small></span><i /></label></div></AoGlass>
          <AoGlass title="SOUND CURRENT / 声音" note="AUDIO / 03" class="ao-setting-card"><div id="ao-audio" class="ao-audio-setting"><AoFieldLabel label="提醒音效"><select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></AoFieldLabel><div><button type="button" class="ao-glass-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} />试听</button><button type="button" class="ao-glass-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入</button><Show when={props.customAlertSoundName()}><button type="button" class="ao-ghost-link" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>移除</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></AoGlass>
          <AoGlass title="KEYS / 快捷键" note="INPUT / 04" class="ao-setting-card"><div id="ao-shortcuts" class="ao-shortcut-list"><div><span>开始 / 继续当前专注</span><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd></div><div><span>结束并保存这一段</span><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>E</kbd></div></div></AoGlass>
          <AoGlass title="LOCAL WATER / 本地数据" note="SAFETY / 05" class="ao-setting-card"><div id="ao-data" class="ao-data-setting"><div class="ao-data-copy"><ShieldCheck size={21} /><p>待办、专注记录和未完成计时状态只保存在这台电脑上。</p></div><div class="ao-data-actions"><button type="button" class="ao-aqua-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="ao-glass-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开目录</button><button type="button" class="ao-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空数据</button></div><Show when={props.lastBackupPath()}><p class="ao-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "error"}><div class="ao-load-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="ao-text-button" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><AoFieldLabel label="选择备份"><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></AoFieldLabel><button type="button" class="ao-glass-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show></div></AoGlass>
        </div>
        <aside class="ao-settings-preview"><div class="ao-preview-orbit"><div class="ao-preview-orbit__core"><span>LIVE</span><strong>{activeTheme().name}</strong></div><i /><i /><i /></div><span>ACTIVE LIGHT FIELD</span><strong>{activeTheme().englishName}</strong><p>{activeTheme().description}</p><button type="button" class="ao-aqua-button ao-aqua-button--wide" onClick={props.onSaveVisualSettings}><Save size={15} /> 保存光场设置</button></aside>
      </div>
    </section>
  );
}
