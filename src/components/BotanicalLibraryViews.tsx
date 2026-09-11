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
import "./BotanicalLibraryViews.css";

function blLocalDateKey() {
  const now = new Date();
  return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

function blDate(value: string) {
  return value.replace(/-/g, " / ");
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
  return value === "high" ? "要紧" : value === "medium" ? "常规" : "轻量";
}

function blGrowthBars(records: FocusRecord[]) {
  const windows = [
    { label: "晨读", range: "05—11", from: 5, to: 11, minutes: 0 },
    { label: "午后", range: "11—17", from: 11, to: 17, minutes: 0 },
    { label: "晚灯", range: "17—23", from: 17, to: 23, minutes: 0 },
    { label: "夜读", range: "23—05", from: 23, to: 29, minutes: 0 },
  ];
  records.forEach((record) => {
    const match = blTime(record).match(/^(\d{2})/);
    const rawHour = match ? Number(match[1]) : 0;
    const hour = rawHour < 5 ? rawHour + 24 : rawHour;
    const window = windows.find((item) => hour >= item.from && hour < item.to) ?? windows[0];
    window.minutes += Math.max(0, record.durationMs) / 60000;
  });
  const total = windows.reduce((sum, item) => sum + item.minutes, 0);
  return windows.map((item) => ({ ...item, percentage: total ? Math.round((item.minutes / total) * 100) : 0 }));
}

function BlPaper(props: { title?: string; note?: string; class?: string; children: any }) {
  return (
    <section class={"bl-paper " + (props.class ?? "")}>
      <Show when={props.title}><header class="bl-paper__heading"><span>{props.title}</span><small>{props.note}</small></header></Show>
      {props.children}
    </section>
  );
}

function BlLeafMark({ class: className = "" }: { class?: string }) {
  return <span class={"bl-leaf-mark " + className} aria-hidden="true"><i /><i /></span>;
}

function BlField(props: { label: string; children: any }) {
  return <label class="bl-field"><span>{props.label}</span>{props.children}</label>;
}

function BlStatusLine(props: { analytics: () => AnalyticsSnapshot | null; timer: () => TimerSnapshot }) {
  return (
    <footer class="bl-status-line" aria-label="书房状态">
      <span><i class="bl-status-dot" /> READING ROOM OPEN</span>
      <span>今日专注 <strong>{blAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00")}</strong></span>
      <span>生长记录 <strong>{blAnalytics(props.analytics(), "sessionCount", "0")}</strong></span>
      <span class="bl-status-line__state"><BlLeafMark /> {props.timer().isRunning ? "这一页正在生长" : "等候下一页"}</span>
    </footer>
  );
}

export function BotanicalLibraryToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const sequence = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].slice(0, 7));
  const nextTodo = createMemo(() => props.nextTodo());
  const focusDuration = createMemo(() => blAnalytics(props.analytics(), "todayFocusDurationLabel", "00:00:00"));

  return (
    <section class="bl-page bl-today-page" aria-label="今日生长">
      <header class="bl-library-head"><div><span class="bl-eyebrow">BOTANICAL LIBRARY / {blDate(props.todayDate)}</span><span class="bl-breadcrumb">木质书房 · 今日生长</span></div><div class="bl-growth-streak"><span>连续生长</span><strong>{String(streak()).padStart(2, "0")}</strong><small>天</small></div></header>
      <div class="bl-today-intro"><div><span class="bl-kicker">GROWTH / {props.todayLabel}</span><h2 class="bl-surface-title">GROWTH / 今日生长</h2><h1>让今天<br /><em>长出一圈年轮。</em></h1><p>把注意力放在书桌上，一件一件地照看。完成不是清空，而是留下新的生长线。</p><div class="bl-intro-actions"><Show when={nextTodo()} fallback={<button type="button" class="bl-ink-button" onClick={props.onOpenTodos}><Plus size={16} /> START / 开始专注</button>}>{(item) => <button type="button" class="bl-ink-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}><Play size={16} fill="currentColor" /> START / 开始专注 <ArrowRight size={15} /></button>}</Show><button type="button" class="bl-text-link" onClick={props.onOpenRecords}>翻开成长记录 <ChevronRight size={15} /></button></div></div><div class="bl-library-stilllife"><div class="bl-stilllife-lamp" /><div class="bl-stilllife-shelf"><For each={sequence()}>{(item, index) => <button type="button" classList={{ "bl-plant-marker": true, "is-complete": item.isCompleted, "is-current": index() === props.todayCompletedTodos().length }} disabled={props.busy() || item.isCompleted || props.timerHasProgress()} onClick={() => props.onUseTodo(item)}><span class="bl-pot" /><i class="bl-stem" /><b>{String(index() + 1).padStart(2, "0")}</b><strong>{item.title}</strong><small>{item.scheduledTime || (item.isCompleted ? "已完成" : "待安排")}</small></button>}</For><Show when={sequence().length === 0}><div class="bl-shelf-empty"><CircleDot size={24} /><strong>书架还没有新的生长点</strong><span>添加一件待办，开始今天的第一圈。</span></div></Show></div><div class="bl-stilllife-paper"><span>NEXT NOTE</span><Show when={nextTodo()} fallback={<><strong>留一页空白</strong><small>去待办里写下下一件要照看的事。</small></>}>{(item) => <><strong>{item().title}</strong><small>{props.formatTodoDue(item())}</small></>}</Show></div></div></div>
      <div class="bl-today-ledger"><div><span>今日完成</span><strong>{String(props.todayCompletedTodos().length).padStart(2, "0")}</strong><small>项</small></div><div><span>今日专注</span><strong>{focusDuration()}</strong><small>时长</small></div><div><span>书房状态</span><strong>{blTimerLabel(props.timer(), props.timerHasProgress())}</strong><small>{props.timer().mode}</small></div><div><span>连续生长</span><strong>{String(streak()).padStart(2, "0")}</strong><small>天</small></div></div><BlStatusLine analytics={props.analytics} timer={props.timer} />
    </section>
  );
}

export function BotanicalLibraryFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => {
    if (props.timer().modeKey === "countdown" && props.countdownDraftDirty()) {
      return String(Math.floor(props.countdownMinutes() / 60)).padStart(2, "0") + ":" + String(props.countdownMinutes() % 60).padStart(2, "0") + ":00";
    }
    return props.timer().elapsedLabel;
  });
  const progress = createMemo(() => blProgress(props.timer(), props.timerHasProgress()));
  const currentTitle = createMemo(() => props.sessionTitle().trim() || props.timer().activeTaskTitle || "未命名专注");
  const stateLabel = createMemo(() => blTimerLabel(props.timer(), props.timerHasProgress()));
  const recentItems = createMemo(() => props.pendingTodos().slice(0, 4));

  function updateLinkedTodo(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) props.onSessionTitleChange(item.title);
  }

  return (
    <section class="bl-page bl-focus-page" aria-label="年轮计时">
      <header class="bl-library-head"><div><span class="bl-eyebrow">READING DESK / FOCUS RINGS</span><span class="bl-breadcrumb">木质书房 · 专注计时</span></div><div class="bl-reading-chip"><i class="bl-status-dot" /> {stateLabel()} <strong>{props.timer().mode}</strong></div></header>
      <div class="bl-focus-hero">
        <div class="bl-focus-notes"><span class="bl-kicker">FOCUS / 年轮计时</span><h1>在这一页上<br /><em>慢慢长大。</em></h1><p>把时间摊开，像一本值得反复阅读的书。下一行从这里开始。</p><div class="bl-bookmark-list"><span class="bl-section-label">BOOKMARKS / 书签</span><For each={recentItems()}>{(item, index) => <div><b>{String(index() + 1).padStart(2, "0")}</b><span>{item.title}</span><small>{item.scheduledTime || "--:--"}</small></div>}</For><Show when={recentItems().length === 0}><p class="bl-muted">完成一段专注后，书签会留在这里。</p></Show><button type="button" class="bl-text-link" onClick={props.onOpenRecords}>查看记录 <ChevronRight size={14} /></button></div></div>
        <section class="bl-tree-dial" aria-label="计时器"><div class="bl-dial-shadow" /><svg class="bl-dial-rings" viewBox="0 0 420 420" aria-hidden="true"><circle class="bl-dial-ring bl-dial-ring--outer" cx="210" cy="210" r="178" /><circle class="bl-dial-ring bl-dial-ring--inner" cx="210" cy="210" r="151" /><circle class="bl-dial-progress" cx="210" cy="210" r="178" style={"stroke-dashoffset:" + String(1118 - 1118 * progress())} /></svg><div class="bl-dial-face"><span>{props.timer().modeKey === "countdown" ? "COUNTDOWN / 倒计时" : "OPEN ENDED / 正向"}</span><strong>{displayTime()}</strong><small><i class="bl-status-dot" /> {stateLabel()}</small><em>{currentTitle()}</em></div><span class="bl-ring-label bl-ring-label--a">YEAR 01</span><span class="bl-ring-label bl-ring-label--b">READ · REST · RETURN</span><div class="bl-dial-leaf bl-dial-leaf--a" /><div class="bl-dial-leaf bl-dial-leaf--b" /><div class="bl-dial-actions"><Show when={props.timer().isRunning} fallback={<button type="button" class="bl-ink-button bl-ink-button--wide" disabled={props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}><Play size={18} fill="currentColor" /> {props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}><button type="button" class="bl-ink-button bl-ink-button--wide" disabled={props.busy()} onClick={() => void props.onPause()}><Pause size={18} fill="currentColor" /> 暂停这一页</button></Show><div><button type="button" class="bl-stone-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}><CheckCircle2 size={15} /> 完成并记录</button><button type="button" class="bl-stone-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={15} /> 重置</button></div></div></section>
        <BlPaper title="FOCUS JOURNAL / 专注札记" note="READING DESK" class="bl-focus-journal"><div class="bl-journal-seal">FM</div><BlField label="这一页要读什么？"><input type="text" name="botanicalSessionTitle" value={props.sessionTitle()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} placeholder="写下这一段的意图" onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></BlField><BlField label="计时方式"><div class="bl-segmented"><button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div></BlField><Show when={props.timer().modeKey === "countdown"}><BlField label="阅读时长"><div class="bl-number-input"><input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><span>分钟</span></div></BlField></Show><BlField label="带入书签"><select value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => updateLinkedTodo(event.currentTarget.value)}><option value="">不连接待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></BlField><Show when={props.linkedTodoId() !== null}><label class="bl-check-line"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={props.busy() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成后把这件事标记为已读</span></label></Show><p class="bl-journal-note"><BlLeafMark /> {props.timer().modeSwitchHint ?? "书桌已整理好，翻开这一页吧。"}</p></BlPaper>
      </div>
      <div class="bl-focus-footer"><span>今日已完成 <strong>{props.timer().completedFocusCount}</strong> 段</span><span>当前状态 <strong>{stateLabel()}</strong></span><span class="bl-focus-shortcut"><Keyboard size={14} /><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd><small>开始 / 继续</small></span></div>
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
    <article classList={{ "bl-task-card": true, "is-complete": props.item.isCompleted, "is-editing": editing() }}>
      <Show when={!editing()} fallback={<div class="bl-edit-grid"><input aria-label="待办事项" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /><input aria-label="截止日期" type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /><input aria-label="时间" type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /><select aria-label="重要程度" value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select><div><button type="button" class="bl-text-link" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="bl-muted-link" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>}>
        <button type="button" class="bl-task-card__check" aria-label={props.item.isCompleted ? "恢复待办" : "完成待办"} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}>{props.item.isCompleted ? <Check size={14} /> : <span />}</button><div class="bl-task-card__copy"><span>{blImportance(props.item.importanceKey)} · {props.importanceLabel(props.item.importanceKey)}</span><strong>{props.item.title}</strong><small>{props.formatTodoDue(props.item)}</small></div><div class="bl-task-card__actions"><button type="button" class="bl-row-action" disabled={props.busy() || props.timerHasProgress() || props.item.isCompleted} onClick={() => props.onUseForFocus(props.item)}>带入专注</button><button type="button" class="bl-row-action" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="bl-row-action bl-row-action--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button></div>
      </Show>
    </article>
  );
}

export function BotanicalLibraryTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(false);
  const focusedId = createMemo(() => props.timer().linkedTodoId);
  const seedbed = createMemo(() => [...props.overdueTodos(), ...props.activeTodos().filter((item) => item.id === focusedId() || Boolean(item.scheduledTime))]);
  const growing = createMemo(() => props.activeTodos().filter((item) => !seedbed().some((seed) => seed.id === item.id)));
  const rowProps = { editingTodo: props.editingTodo, busy: props.busy, timerHasProgress: props.timerHasProgress, formatTodoDue: props.formatTodoDue, importanceLabel: props.importanceLabel, onToggle: props.onToggle, onBeginEdit: props.onBeginEdit, onUseForFocus: props.onUseForFocus, onRemove: props.onRemove, onPatch: props.onPatch, onSave: props.onSave, onCancel: props.onCancel };
  const completion = createMemo(() => props.todos().length ? Math.round((props.completedTodos().length / props.todos().length) * 100) : 0);

  return (
    <section class="bl-page bl-todos-page" aria-label="书房待办">
      <header class="bl-library-head"><div><span class="bl-eyebrow">READING ROOM / {blDate(blLocalDateKey())}</span><span class="bl-breadcrumb">木质书房 · 书桌清单</span></div><button type="button" class="bl-ink-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} /> : <Plus size={16} />} {createOpen() ? "收起" : "写一张纸条"}</button></header>
      <div class="bl-todos-intro"><div><span class="bl-kicker">DESK NOTES / 书桌清单</span><h1>把每件事<br /><em>照看成一株植物。</em></h1></div><p>种下、发芽、收成。给每一个念头一块合适的土壤，别让它们堆成噪声。</p></div>
      <Show when={createOpen()}><form class="bl-new-note" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setCreateOpen(false); }}><span class="bl-section-label">NEW NOTE / 新纸条</span><input type="text" name="botanicalTodoTitle" value={props.todoTitle()} placeholder="写下一件要完成的事" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /><div><input type="date" name="botanicalTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /><input type="time" name="botanicalTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /><select name="botanicalTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">重要</option><option value="medium">常规</option><option value="low">轻量</option></select><button type="submit" class="bl-ink-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "钉上书架"}</button></div></form></Show>
      <div class="bl-desk-board">
        <section class="bl-desk-column bl-desk-column--seed"><header><span>01</span><div><strong>SEEDBED / 种下</strong><small>{seedbed().length} 件 · 现在照看</small></div><i /></header><div class="bl-task-list"><Show when={props.ready()} fallback={<p class="bl-muted">正在读取书架…</p>}><For each={seedbed()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={seedbed().length === 0}><div class="bl-column-empty"><span>✿</span><strong>土壤是空的</strong><small>放一张纸条进来。</small></div></Show></Show></div></section>
        <section class="bl-desk-column bl-desk-column--sprout"><header><span>02</span><div><strong>SPROUTING / 发芽</strong><small>{growing().length} 件 · 稍后再读</small></div><BlLeafMark /></header><div class="bl-task-list"><For each={growing()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={growing().length === 0}><div class="bl-column-empty"><span>❧</span><strong>暂时没有发芽</strong><small>让注意力留给手边这一页。</small></div></Show></div></section>
        <section class="bl-desk-column bl-desk-column--harvest"><header><span>03</span><div><strong>HARVEST / 收成</strong><small>{props.completedTodos().length} 件 · 已留下年轮</small></div><span class="bl-harvest-mark"><Check size={13} /></span></header><div class="bl-task-list"><For each={props.completedTodos()}>{(item) => <BotanicalTodoCard item={item} {...rowProps} />}</For><Show when={props.completedTodos().length === 0}><div class="bl-column-empty"><span>◌</span><strong>完成一件，它会在这里结果</strong><small>每一次收成都会留下一圈年轮。</small></div></Show></div></section>
      </div>
      <footer class="bl-desk-ledger"><div><span>今日完成度</span><strong>{completion()}%</strong><i><b style={"width:" + String(completion()) + "%"} /></i></div><div><span>连接到专注</span><strong>{props.timer().linkedTodoId ? "已连接" : "未连接"}</strong></div><div><span>书桌下一张</span><strong>{props.activeTodos()[0]?.title ?? "等待新的纸条"}</strong></div></footer>
    </section>
  );
}

export function BotanicalLibraryRecords(props: NightValleyRecordsProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const growthBars = createMemo(() => blGrowthBars(props.records()));
  const [visibleCount, setVisibleCount] = createSignal(12);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const visibleRecords = createMemo(() => selectedRecords().slice(0, visibleCount()));
  createEffect(() => { selectedDate(); setVisibleCount(12); setExpandedDate(null); });

  return (
    <section class="bl-page bl-records-page" aria-label="成长记录">
      <header class="bl-library-head"><div><span class="bl-eyebrow">GROWTH ARCHIVE / {props.formatAnalyticsDate(selectedDate())}</span><span class="bl-breadcrumb">木质书房 · 植物档案</span></div><div class="bl-records-head"><span><i class="bl-status-dot" /> LOCAL SHELF</span></div></header>
      <div class="bl-records-intro"><div><span class="bl-kicker">GROWTH ARCHIVE / 生长档案</span><h1>每一圈年轮<br /><em>都是读过的页。</em></h1></div><div class="bl-archive-range"><span>最近 7 天</span><strong>{props.formatArchiveRangeDate(props.archiveDays()[0]?.date ?? selectedDate())} — {props.formatArchiveRangeDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? selectedDate())}</strong></div></div>
      <BlPaper title="THE READING GARDEN / 七日生长" note={props.formatAnalyticsDate(selectedDate())} class="bl-growth-chart-card"><div class="bl-growth-chart"><div class="bl-growth-shelf-line" /><div class="bl-growth-axis"><span>长得高</span><span>扎根</span><span>播种</span></div><svg viewBox="0 0 900 250" preserveAspectRatio="none" aria-label="七日专注生长图"><path class="bl-growth-grid" d="M0 48H900 M0 124H900 M0 202H900" /><path class="bl-growth-path" d={props.archivePath()} /></svg><div class="bl-growth-points" aria-label="七日专注日期"><For each={props.archiveDays()}>{(day, index) => <button type="button" classList={{ "bl-growth-point": true, active: day.date === selectedDate() }} style={"left:" + String((index() / Math.max(1, props.archiveDays().length - 1)) * 100) + "%;bottom:" + String(Math.max(5, (day.totalDurationMs / maxDuration()) * 74)) + "%"} onClick={() => props.onSelectDate(day.date)}><i /><span>{props.formatAnalyticsDate(day.date)}</span></button>}</For></div></div><div class="bl-chart-legend"><span><i class="bl-status-dot" /> 每一株代表一天</span><strong>最近七日 {props.formatDurationMs(props.recentWeekDurationMs())}</strong><span>{props.recentWeekActiveDays()} 天有投入</span></div></BlPaper>
      <div class="bl-record-stat-grid"><div><span>总阅读时长</span><strong>{blAnalytics(props.analytics(), "totalFocusDurationLabel", "00:00:00")}</strong><small>全部年轮</small></div><div><span>完成段数</span><strong>{blAnalytics(props.analytics(), "sessionCount", "0")}</strong><small>页</small></div><div><span>平均一页</span><strong>{props.analytics()?.sessionCount ? props.formatDurationMs(props.recentWeekDurationMs() / Math.max(1, props.analytics()?.sessionCount ?? 1)) : "00:00:00"}</strong><small>每次</small></div><div><span>连续生长</span><strong>{blAnalytics(props.analytics(), "currentStreakDays", "0")}</strong><small>天</small></div></div>
      <div class="bl-records-lower"><BlPaper title="READING LOG / 当日阅读日志" note={String(selectedRecords().length) + " ENTRIES"} class="bl-reading-log"><div class="bl-reading-log__head"><span>时间</span><span>书名 / 意图</span><span>时长</span><span>动作</span></div><Show when={visibleRecords().length > 0} fallback={<div class="bl-empty-records">这一天还没有留下阅读记录。</div>}><For each={visibleRecords()}>{(record) => <Show when={props.editingRecord()?.id === record.id} fallback={<div class="bl-reading-row"><time>{blTime(record)}</time><div><strong>{record.title}</strong><small>{props.formatRecordDate(record)}</small></div><b>{record.durationLabel}</b><div class="bl-reading-actions"><button type="button" class="bl-row-action" onClick={() => props.onBeginEdit(record)}>改名</button><button type="button" class="bl-row-action bl-row-action--danger" onClick={() => void props.onRemove(record.id)}>移除</button></div></div>}><div class="bl-reading-row bl-reading-row--editing"><input aria-label="编辑记录标题" value={props.editingRecord()?.title ?? record.title} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} /><button type="button" class="bl-text-link" onClick={() => void props.onSaveEdit()}>保存</button><button type="button" class="bl-muted-link" onClick={props.onCancelEdit}>取消</button></div></Show>}</For><Show when={visibleCount() < selectedRecords().length}><button type="button" class="bl-text-link" onClick={() => setVisibleCount((count) => Math.min(count + 12, selectedRecords().length))}>加载更多 · {visibleCount()} / {selectedRecords().length}</button></Show></Show></BlPaper><BlPaper title="LIGHT IN THE ROOM / 书房光线" note="ALL RECORDS" class="bl-reading-rhythm"><div class="bl-growth-bars"><For each={growthBars()}>{(bar) => <div><span>{bar.label}<small>{bar.range}</small></span><i><b style={"width:" + String(bar.percentage) + "%"} /></i><strong>{bar.percentage}%</strong></div>}</For></div><p class="bl-insight"><span>今日书签</span><strong>{growthBars().slice().sort((a, b) => b.minutes - a.minutes)[0]?.label ?? "尚无"}是你最常打开书房的时段。</strong></p></BlPaper></div>
      <BlPaper title="CATALOG / 完整植物档案" note={String(props.records().length) + " ENTRIES"} class="bl-history-index"><Show when={props.ready() && props.records().length > 0} fallback={<div class="bl-empty-records">完成一次专注后，完整植物档案会从这里长出来。</div>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 页 · {props.formatDurationMs(group.totalDurationMs)}</strong><ChevronRight size={15} /></summary><Show when={expandedDate() === group.date}><div class="bl-history-items">{group.records.slice(0, 200).map((record) => <span>{blTime(record)} · {record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></BlPaper>
    </section>
  );
}

export function BotanicalLibrarySettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const toggle = (checked: boolean, key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled") => void props.onSaveTimerPreferences({ [key]: checked });

  return (
    <section class="bl-page bl-settings-page" aria-label="书房设置">
      <header class="bl-library-head"><div><span class="bl-eyebrow">READING ROOM / SETTINGS</span><span class="bl-breadcrumb">木质书房 · 设置</span></div><div class="bl-reading-chip"><i class="bl-status-dot" /> CATALOG / READY</div></header>
      <div class="bl-settings-intro"><span class="bl-kicker">LIBRARY RULES / 书房设置</span><h1>整理一间<br /><em>你愿意久坐的房间。</em></h1><p>主题、提醒和本地备份都放在书架旁。调整之后，记得保存这次布置。</p></div>
      <div class="bl-settings-grid"><nav class="bl-settings-nav" aria-label="设置分组"><a href="#bl-appearance">01 <span>书架</span></a><a href="#bl-behavior">02 <span>提醒</span></a><a href="#bl-audio">03 <span>声音</span></a><a href="#bl-shortcuts">04 <span>快捷键</span></a><a href="#bl-data">05 <span>备份</span></a></nav><div class="bl-settings-main">
        <BlPaper title="THE BOOKSHELF / 主题书架" note="APPEARANCE / 01" class="bl-setting-card"><div id="bl-appearance" class="bl-theme-books"><For each={themes}>{(theme) => <button type="button" classList={{ "bl-theme-book": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} title={theme.implemented ? "使用" + theme.name + "主题" : theme.name + "主题尚未实现"} onClick={() => props.onThemeSelect(theme.id)}><span class={"bl-book-spine bl-book-spine--" + theme.id}><img src={theme.preview} alt={theme.englishName + " 概念预览"} /></span><strong>{theme.name}</strong><small>{theme.implemented ? "在架" : "未装订"}</small></button>}</For></div><div class="bl-setting-sliders"><label><span>灯光亮度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} aria-label="灯光亮度" onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label><span>叶影动效 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} aria-label="叶影动效" onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label><span>桌面密度 <b>{props.density() === "roomy" ? "舒展" : "紧凑"}</b></span><div class="bl-density-buttons"><button type="button" classList={{ active: props.density() === "roomy" }} onClick={() => props.onDensityChange("roomy")}>舒展</button><button type="button" classList={{ active: props.density() === "compact" }} onClick={() => props.onDensityChange("compact")}>紧凑</button></div></label></div></BlPaper>
        <BlPaper title="RETURN TO THE DESK / 回到书桌" note="BEHAVIOR / 02" class="bl-setting-card"><div id="bl-behavior" class="bl-toggle-list"><label><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "toastReminderEnabled")} /><span><strong>应用内弹窗</strong><small>在当前书页轻轻出现。</small></span><i /></label><label><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "windowAttentionReminderEnabled")} /><span><strong>任务栏提醒</strong><small>窗口在后台时叫你回来。</small></span><i /></label><label><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle(event.currentTarget.checked, "soundReminderEnabled")} /><span><strong>声音提醒</strong><small>像书签落下那样轻。</small></span><i /></label></div></BlPaper>
        <BlPaper title="AUDIO BOOKMARK / 声音" note="AUDIO / 03" class="bl-setting-card"><div id="bl-audio" class="bl-audio-setting"><BlField label="提醒音效"><select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></BlField><div><button type="button" class="bl-stone-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} />试听</button><button type="button" class="bl-stone-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入</button><Show when={props.customAlertSoundName()}><button type="button" class="bl-muted-link" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>移除</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></div></BlPaper>
        <BlPaper title="BOOKMARKS / 快捷键" note="INPUT / 04" class="bl-setting-card"><div id="bl-shortcuts" class="bl-shortcut-list"><div><span>开始 / 继续当前专注</span><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd></div><div><span>结束并保存这一段</span><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>E</kbd></div></div></BlPaper>
        <BlPaper title="LOCAL CATALOG / 本地备份" note="SAFETY / 05" class="bl-setting-card"><div id="bl-data" class="bl-data-setting"><div class="bl-data-copy"><ShieldCheck size={21} /><p>待办、专注记录和未完成计时状态只保存在这台电脑上。</p></div><div class="bl-data-actions"><button type="button" class="bl-ink-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="bl-stone-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开目录</button><button type="button" class="bl-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空数据</button></div><Show when={props.lastBackupPath()}><p class="bl-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "error"}><div class="bl-load-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="bl-text-link" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><BlField label="选择备份"><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></BlField><button type="button" class="bl-stone-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show></div></BlPaper>
      </div><aside class="bl-settings-preview"><div class="bl-preview-room"><div class="bl-preview-lamp" /><div class="bl-preview-shelf"><i /><i /><i /><i /></div><div class="bl-preview-paper"><span>LIVE CATALOG</span><strong>{activeTheme().name}</strong></div></div><span>ACTIVE READING ROOM</span><strong>{activeTheme().englishName}</strong><p>{activeTheme().description}</p><button type="button" class="bl-ink-button bl-ink-button--wide" onClick={props.onSaveVisualSettings}><Save size={15} /> 保存书房布置</button></aside></div>
    </section>
  );
}
