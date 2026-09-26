import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Pause, Plus, RotateCcw } from "lucide-solid";
import type { FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";
import type { FocusSurfaceProps, RecordsSurfaceProps, SettingsSurfaceProps, TodaySurfaceProps, TodoSurfaceProps } from "../lib/theme-contracts";
import { buildWeeklyChartGeometry } from "../lib/weekly-chart";
import { MetroThemeSettings } from "./ThemeSettings";

function mpStatus(timer: TimerSnapshot, progress: boolean) {
  if (timer.isRunning) return "进行中";
  if (progress && timer.modeKey === "countdown" && timer.remainingMs === 0) return "待保存";
  if (progress) return "已暂停";
  return "空闲，可开始专注";
}
function mpFormatMs(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}
function mpClock(timer: TimerSnapshot, countdownMinutes: number, draftDirty: boolean) {
  if (timer.modeKey === "countdown" && draftDirty && !timer.hasUnsubmittedProgress) return mpFormatMs(countdownMinutes * 60000);
  return timer.modeKey === "countdown" && timer.remainingMs !== null ? mpFormatMs(timer.remainingMs) : timer.elapsedLabel;
}
function mpImportance(value: TodoImportance) {
  return value === "high" ? "重要" : value === "medium" ? "普通" : "低压力";
}
function MetroHeader(props: { eyebrow: string; title: string; description: string; trailing?: any }) {
  return <header class="mp-page-head"><div><span class="mp-eyebrow">{props.eyebrow}</span><h1>{props.title}</h1><p>{props.description}</p></div><div class="mp-page-head__trailing">{props.trailing}</div></header>;
}

export function MetroPulseToday(props: TodaySurfaceProps) {
  const sequence = createMemo(() => {
    const items = [...props.todayCompletedTodos(), ...props.todayTodos()];
    const seen = new Set(items.map((item) => item.id));
    for (const item of props.planTodos()) if (!seen.has(item.id)) { items.push(item); seen.add(item.id); }
    return items.slice(0, 6);
  });
  const next = createMemo(() => props.currentTodo() ?? props.nextTodo() ?? sequence().find((item) => !item.isCompleted) ?? null);
  const minuteDigits = createMemo(() => {
    const timer = props.timer();
    if (!props.timerHasProgress()) return String(props.defaultFocusMinutes()).padStart(2, "0").split("");
    const milliseconds = timer.modeKey === "countdown" && timer.remainingMs !== null ? timer.remainingMs : timer.elapsedMs;
    const parts = mpFormatMs(milliseconds).split(":");
    const display = Number(parts[0]) === 0 ? parts.slice(1).join("") : parts.join("");
    return display.split("");
  });
  const minuteBoardLabel = createMemo(() => props.timerHasProgress()
    ? (props.timer().modeKey === "countdown" ? "剩余时间 " : "已用时间 ") + mpClock(props.timer(), props.defaultFocusMinutes(), false)
    : "建议专注 " + props.defaultFocusMinutes() + " 分钟");
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const status = createMemo(() => mpStatus(props.timer(), props.timerHasProgress()));
  const depart = () => props.timer().isRunning ? props.onPause() : props.timerCanContinue() ? props.onContinue() : props.timerHasProgress() ? props.onOpenFocus() : next() ? props.onStartTodo(next()!) : props.onOpenTodos();
  return <section class="mp-page mp-today-page" aria-label="今日班次">
    <header class="mp-today-heading"><div><span class="mp-eyebrow">SERVICE 06　/　DAILY LINE</span><h1>今日班次</h1><p>按计划出发，专注让每一天更靠近目标。</p></div></header>
    <div class="mp-today-grid">
      <section class="mp-route-panel" aria-label="今日班次路线">
        <div class="mp-panel-heading"><span>今日线路　/　TODAY ROUTE</span><strong>{props.todayCompletedTodos().length} / {sequence().length} 已到站</strong></div>
        <div class="mp-route-list"><i class="mp-route-rail" aria-hidden="true" />
          <Show when={props.ready()} fallback={<p class="mp-empty">正在核对今日班次…</p>}>
            <For each={Array.from({ length: 6 }, (_, index) => sequence()[index] ?? null)}>{(item, index) => {
              const completed = () => item?.isCompleted ?? false;
              const current = () => Boolean(item) && item?.id === next()?.id && !completed();
              const state = () => completed() ? "已完成" : current() ? "即将出发" : item ? "待开始" : "空站位";
              return <Show when={item} fallback={<button type="button" class="mp-route-stop mp-route-stop--empty" onClick={props.onOpenTodos} aria-label={"第 " + (index() + 1) + " 班为空，添加班次"}><span class="mp-stop-node">＋</span><span class="mp-stop-copy"><strong><span class="mp-stop-order">{String(index() + 1).padStart(2, "0")}</span>空站位</strong><small>新增一项待办，为它安排出发时间</small></span><span class="mp-stop-state">添加班次</span></button>}>
                {(task) => <button type="button" classList={{ "mp-route-stop": true, "is-done": completed(), "is-current": current() }} disabled={props.busy() || completed() || props.timerHasProgress()} onClick={() => props.onStartTodo(task())} aria-label={(index() + 1) + " 班：" + task().title + "，" + state()}><span class="mp-stop-node">{completed() ? <Check size={16} /> : current() ? <i class="mp-current-dot" /> : null}</span><span class="mp-stop-copy"><strong><span class="mp-stop-order">{String(index() + 1).padStart(2, "0")}</span>{task().title}</strong><small>{task().scheduledTime || props.formatTodoDue(task())}</small></span><span class="mp-stop-state">{state()}</span></button>}
              </Show>;
            }}</For>
          </Show>
        </div>
        <div class="mp-route-legend"><span><i class="is-done" />已完成</span><span><i class="is-current" />当前</span><span><i />待开始</span></div>
      </section>
      <aside class="mp-departure-card" aria-label="下一班出发信息">
        <div class="mp-departure-card__top"><span><strong>下一班</strong><small>NEXT DEPARTURE</small></span><span class="mp-platform-mark"><ArrowUpRight size={56} strokeWidth={2.5} aria-hidden="true" /><small>站台</small><strong>03</strong><small>PLATFORM</small></span></div>
        <Show when={next()} fallback={<div class="mp-departure-empty"><h2>站台等待乘客</h2><p>添加第一班任务，开始今天的专注线路。</p><button type="button" class="mp-outline-button" onClick={props.onOpenTodos}>添加第一班 <ArrowRight size={15} /></button></div>}>
          {(item) => <><span class="mp-next-label">下一班　/　NEXT STOP</span><h2>{item().title}</h2><p class="mp-departure-detail"><span>{props.formatTodoDue(item())}</span><span classList={{ "mp-departure-state": true, running: props.timer().isRunning, paused: props.timerHasProgress() && !props.timer().isRunning }}>{status()}</span></p></>}
        </Show>
        <div classList={{ "mp-focus-minute-board": true, "mp-focus-minute-board--live": props.timerHasProgress() }} role="img" aria-label={minuteBoardLabel()}>
        <div class="mp-focus-minute-board__digits" data-digit-count={minuteDigits().length}><For each={minuteDigits()}>{(digit) => <span class="mp-flip-digit" aria-hidden="true"><span class="mp-flip-digit__value">{digit}</span></span>}</For></div>
          <div class="mp-focus-minute-board__unit"><strong>{props.timerHasProgress() ? props.timer().modeKey === "countdown" ? "剩余" : "已用" : "分钟"}</strong><span>{props.timerHasProgress() ? "LIVE CLOCK" : "MINUTES"}</span><Show when={props.timerHasProgress()} fallback={<><span>TO</span><span>FOCUS</span></>}><span>REAL TIME</span></Show></div>
        </div>
        <p class="mp-departure-motto" aria-hidden="true">专注创作<br />让想法落地<br />成为作品</p>
        <button type="button" class="mp-orange-button" disabled={props.busy() || !props.ready() || (!props.timerHasProgress() && !next())} onClick={() => void depart()}><span class="mp-departure-action-label">{props.timer().isRunning ? <Pause size={48} strokeWidth={3} aria-hidden="true" /> : <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 24h31V10l22 22-22 22V40H7z" fill="currentColor" /></svg>}<span>{props.timer().isRunning ? "暂停专注" : props.timerCanContinue() ? "继续专注" : props.timerHasProgress() ? "打开待保存计时" : "开始专注"}</span></span><span class="mp-departure-shortcut"><kbd>Ctrl</kbd><kbd>Enter</kbd></span></button>
      </aside>
    </div>
    <section class="mp-stat-band"><div><span>已完成</span><strong class="mp-stat-total">{props.todayCompletedTodos().length}<small> / {sequence().length}</small></strong><small class="mp-stat-note">保持节奏，继续前行。</small></div><div><span>连续专注</span><strong>{streak()}<small> 天</small></strong><span class="mp-streak-dots" aria-label={"连续专注 " + streak() + " 天，最近七天刻度"}>{Array.from({ length: 7 }, (_, index) => <i classList={{ active: index < Math.min(streak(), 7) }} />)}</span></div><div class="mp-stat-band__next"><span>下一站</span><strong>{next()?.scheduledTime || "待安排"}</strong></div><div class="mp-stat-band__hint"><span>下一站</span><strong>更好的自己</strong><button type="button" aria-label="查看完整运行记录" onClick={props.onOpenRecords}><ArrowRight size={24} /></button></div></section>
    <svg class="mp-transit-art" viewBox="0 0 560 150" aria-hidden="true"><path d="M0 137H560" stroke="#627c93" stroke-width="3" /><path d="M72 119 118 55Q132 36 164 32L540 23V119Z" fill="#eaf2f7" stroke="#6988a3" stroke-width="3" /><path d="M175 43 529 36V81H145Z" fill="#174f98" /><path d="M131 94H540V105H123Z" fill="#ed5a32" /><path d="M110 119H540" stroke="#0b376a" stroke-width="10" /><path d="M211 45V79M293 43V79M375 41V79M457 39V79" stroke="#d9e7ef" stroke-width="4" /><circle cx="204" cy="122" r="15" fill="#31445a" /><circle cx="204" cy="122" r="6" fill="#b8c6d1" /><circle cx="340" cy="122" r="15" fill="#31445a" /><circle cx="340" cy="122" r="6" fill="#b8c6d1" /><circle cx="476" cy="122" r="15" fill="#31445a" /><circle cx="476" cy="122" r="6" fill="#b8c6d1" /></svg>
    <footer class="mp-tactile-strip"><span>LINE 06　·　准点出发，稳步抵达</span><span>{props.timer().mode}　/　{status()}</span><span>FOCUSED MOMENT　—　KEEP MOVING</span></footer>
  </section>;
}

export function MetroPulseFocus(props: FocusSurfaceProps) {
  const display = createMemo(() => mpClock(props.timer(), props.countdownMinutes(), props.countdownDraftDirty()));
  const timerSegments = createMemo(() => {
    const parts = display().split(":");
    if (parts.length === 2) return parts;
    if (parts.length === 3 && parts[0] === "00") return parts.slice(1);
    return parts;
  });
  const linked = createMemo(() => props.todos().find((todo) => todo.id === props.linkedTodoId()) ?? null);
  const locked = createMemo(() => props.busy() || !props.ready() || props.timerHasProgress());
  const resetLabel = createMemo(() => props.timerHasProgress() ? "重置本次班次" : "重置");
  const activeTitle = createMemo(() => props.timer().activeTaskTitle || linked()?.title || props.sessionTitle().trim() || "尚未指定班次");
  const routeStops = createMemo(() => {
    const completed = Math.min(6, Math.max(props.todaySessionCount(), props.timer().completedFocusCount));
    const current = Math.max(1, props.timer().currentRound || completed + 1);
    return Array.from({ length: 6 }, (_, index) => ({ number: String(index + 1).padStart(2, "0"), state: index < completed ? "done" : index + 1 === current ? "current" : "waiting" }));
  });
  const actionLabel = createMemo(() => props.timer().isRunning ? "Ⅱ　暂停专注" : props.timerCanContinue() ? "▶　继续专注" : props.timer().modeKey === "countdown" && props.timer().remainingMs === 0 && props.timerHasProgress() ? "本班已到站" : props.canFinish() ? "✓　完成并记录" : props.timerHasProgress() ? "本班已到站" : "▶　开始专注");
  const runPrimaryAction = () => {
    if (props.timer().isRunning) return props.onPause();
    if (props.timerCanContinue()) return props.onStart();
    if (props.canFinish()) return props.onFinish();
    return props.onStart();
  };
  const primaryDisabled = createMemo(() => props.busy() || !props.ready() || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0));
  function linkedChange(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id); props.onSessionTitleDirty(); if (item) props.onSessionTitleChange(item.title);
  }
  return <section class="mp-page mp-focus-page" aria-label="班次计时">
    <MetroHeader eyebrow="PLATFORM 03　/　DEPARTURE TIMER" title="班次计时" description="把这一段时间，完整交给眼前的事情。" trailing={<span class="mp-status-pill"><i classList={{ running: props.timer().isRunning, paused: props.timerHasProgress() && !props.timer().isRunning }} /><strong>{props.timer().isRunning ? "IN FOCUS" : "ON PLATFORM"}</strong><span>{mpStatus(props.timer(), props.timerHasProgress())}</span></span>} />
    <div class="mp-focus-grid">
      <section class="mp-flip-board" aria-label="专注计时显示">
        <div class="mp-flip-board__top"><span><strong>FOCUSED MOMENT</strong><small>今日站台　·　第{String(Math.max(1, props.timer().currentRound))}班</small></span><b>{props.timer().mode}　/　{props.timerPreferences().pomodoroFocusMinutes} 分钟目标</b></div>
        <div class="mp-timer-center-group">
          <div class="mp-flip-board__task"><span>当前班次　{String(Math.max(1, props.timer().currentRound)).padStart(2, "0")}　·　{activeTitle()}</span></div>
          <div class="mp-flip-board__display" aria-label={display()}>
            <div class="mp-timer-flips"><For each={timerSegments()}>{(part, index) => <><Show when={index() > 0}><span class="mp-timer-colon">:</span></Show><span class="mp-timer-flip-card">{part}</span></>}</For></div>
          </div>
          <div class="mp-timer-arrival"><span>{linked()?.scheduledTime ? "预计 " + linked()!.scheduledTime + " 到站" : "预计专注 " + props.countdownMinutes() + " 分钟"}</span><span>关联待办：{linked()?.title || "未关联"}</span></div>
          <div class="mp-timer-route" aria-label="今日六班线路进度"><div class="mp-timer-route__stops"><For each={routeStops()}>{(stop, index) => <><span classList={{ "is-done": stop.state === "done", "is-current": stop.state === "current" }}>{stop.number}</span><Show when={index() < 5}><i aria-hidden="true" /></Show></>}</For></div></div>
        </div>
        <div class="mp-focus-actions"><button type="button" class="mp-orange-button" disabled={primaryDisabled()} onClick={() => void runPrimaryAction()}>{actionLabel()}</button><button type="button" class="mp-outline-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}>完成并记录</button><button type="button" class="mp-link-button" disabled={props.busy() || !props.ready()} aria-label={resetLabel()} onClick={() => void props.onReset()}><RotateCcw size={15} />{resetLabel()}</button></div>
        <Show when={props.savedConfirmation()}><p class="mp-confirm" role="status">已记录这一班专注。</p></Show>
      </section>
      <aside class="mp-route-card mp-timer-settings" aria-label="班次设置">
        <header class="mp-timer-settings__head"><h2>班次设置</h2><span>站台　03</span></header>
        <div class="mp-mode-tabs" role="group" aria-label="计时模式"><button type="button" aria-pressed={props.timer().modeKey === "stopwatch"} disabled={locked()} onClick={() => void props.onChangeMode("stopwatch")}>正向计时</button><button type="button" aria-pressed={props.timer().modeKey === "countdown"} disabled={locked()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div>
        <label class="mp-form-field"><span>专注标题</span><input name="metroSessionTitle" value={props.sessionTitle() || linked()?.title || ""} placeholder="写下本班目标" disabled={locked()} onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
        <div class="mp-form-field mp-countdown-field"><span>本轮时长</span><Show when={props.timer().modeKey === "countdown"} fallback={<div class="mp-countdown-display"><span>目标专注时长</span><strong>{props.timerPreferences().pomodoroFocusMinutes}</strong><b>min</b></div>}><label class="mp-countdown-display"><span>目标专注时长</span><input name="metroCountdownMinutes" type="number" min="1" max="720" value={props.countdownMinutes()} disabled={locked()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><b>min</b></label></Show></div>
        <div class="mp-linked-field"><span>关联待办</span><div class="mp-link-note mp-linked-task-card"><strong>{String(props.timer().currentRound).padStart(2, "0")}</strong><span><select name="metroLinkedTodo" aria-label="关联待办" value={props.linkedTodoId() ?? ""} disabled={locked()} onChange={(event) => linkedChange(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(item) => <option value={item.id}>{item.title}</option>}</For></select><Show when={linked()}>{(todo) => <small>{props.formatTodoDue(todo())}</small>}</Show></span></div></div>
        <label class="mp-check-field"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={locked() || !props.linkedTodoId()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>完成时同步标记待办</span></label>
        <footer class="mp-timer-settings__footer"><span>今日已完成班次　<strong>{props.todaySessionCount()}</strong> 班</span><span>快捷开始　<kbd>Ctrl</kbd> + <kbd>Enter</kbd></span></footer>
      </aside>
    </div>
    <footer class="mp-page-footer"><span>时间会带你抵达，但每一刻都由你掌舵。</span><button type="button" onClick={props.onOpenRecords}>打开运行记录 <ArrowRight size={14} /></button><Show when={props.timerHasProgress()}><button type="button" onClick={() => void props.onShowFocusFloating()}>打开迷你工作台</button></Show></footer>
  </section>;
}

function mpTodoDetail(item: TodoItem, surface: TodoSurfaceProps, completionSummary: boolean) {
  if (completionSummary) {
    const latestRecord = surface.records()
      .filter((record) => record.linkedTodoId === item.id)
      .reduce<FocusRecord | null>((latest, record) => !latest || record.completedAt > latest.completedAt ? record : latest, null);
    if (latestRecord) {
      return `记录于 ${mpRecordTime(latestRecord)}　·　专注 ${Math.round(latestRecord.durationMs / 60_000)} 分`;
    }
  }

  const currentDate = surface.todayTodos()[0]?.scheduledDate ?? surface.todayCompletedTodos()[0]?.scheduledDate ?? "";
  const due = !item.scheduledDate
    ? "未安排"
    : item.scheduledDate === currentDate
      ? item.scheduledTime || "今日"
      : surface.formatTodoDue(item);
  return `${due}　·　${mpImportance(item.importanceKey)}`;
}

function MpTodoRow(props: { item: TodoItem; surface: TodoSurfaceProps; number: number; label: string; completionSummary?: boolean }) {
  const overdue = () => props.surface.overdueTodos().some((item) => item.id === props.item.id);
  const status = () => overdue() ? "已过期" : props.item.isCompleted ? props.completionSummary ? "已完成" : "已到站" : props.label;
  return (
    <article classList={{ "mp-task-row": true, "is-done": props.item.isCompleted, "is-overdue": overdue() }}>
      <span class="mp-task-index">{String(props.number).padStart(2, "0")}</span>
      <Show
        when={props.surface.editingTodo()?.id === props.item.id}
        fallback={
          <>
            <button
              type="button"
              class="mp-task-check"
              aria-label={(props.item.isCompleted ? "恢复“" : "完成“") + props.item.title + "”"}
              disabled={props.surface.busy()}
              onClick={() => props.surface.onToggle(props.item.id)}
            >
              {props.item.isCompleted ? <Check size={15} /> : ""}
            </button>
            <div class="mp-task-copy">
              <strong>{props.item.title}</strong>
              <small>{mpTodoDetail(props.item, props.surface, props.completionSummary ?? false)}</small>
            </div>
            <span class="mp-task-status">
              {status()}
            </span>
            <div class="mp-task-actions">
              <button type="button" disabled={props.surface.busy() || props.surface.timerHasProgress()} onClick={() => props.surface.onUseForFocus(props.item)}>开始专注</button>
              <button type="button" disabled={props.surface.busy()} onClick={() => props.surface.onBeginEdit(props.item)}>编辑</button>
              <button type="button" disabled={props.surface.busy()} onClick={() => void props.surface.onRemove(props.item.id)}>删除</button>
            </div>
          </>
        }
      >
        <div class="mp-task-edit">
          <label>标题<input value={props.surface.editingTodo()?.title ?? ""} onInput={(event) => props.surface.onPatch({ title: event.currentTarget.value })} /></label>
          <label>日期<input type="date" value={props.surface.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.surface.onPatch({ scheduledDate: event.currentTarget.value })} /></label>
          <label>时间<input type="time" value={props.surface.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.surface.onPatch({ scheduledTime: event.currentTarget.value })} /></label>
          <label>重要度<select value={props.surface.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.surface.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
          <button type="button" disabled={props.surface.busy()} onClick={props.surface.onSave}>保存</button>
          <button type="button" disabled={props.surface.busy()} onClick={props.surface.onCancel}>取消</button>
        </div>
      </Show>
    </article>
  );
}

export function MetroPulseTodos(props: TodoSurfaceProps) {
  const [formOpen, setFormOpen] = createSignal(false);
  const today = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos().slice(0, 1)]);
  const todayDate = createMemo(() => props.todayTodos()[0]?.scheduledDate ?? props.todayCompletedTodos()[0]?.scheduledDate ?? "");
  const todayScheduledCount = createMemo(() => todayDate() ? props.todos().filter((item) => item.scheduledDate === todayDate()).length : 0);
  const todayCompletionRate = createMemo(() => todayScheduledCount() ? Math.round(props.todayCompletedTodos().length / todayScheduledCount() * 100) : 0);
  const onDeck = createMemo(() => {
    const currentId = props.todayTodos()[0]?.id;
    const overdueIds = new Set(props.overdueTodos().map((item) => item.id));
    return props.activeTodos().filter((item) => item.id !== currentId && !overdueIds.has(item.id));
  });
  return <section class="mp-page mp-todos-page" aria-label="班次待办">
    <MetroHeader eyebrow="TODAY'S DEPARTURE BOARD　/　06 ROUTES" title="把事项排上班次" description="每一件重要的事，都有它的出发时间。" trailing={<button type="button" class="mp-orange-button" onClick={() => setFormOpen((open) => !open)}><Plus size={17} />{formOpen() ? "收起新增" : "新增班次"}</button>} />
    <Show when={formOpen()}><form class="mp-create-card" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); }}><div><span class="mp-eyebrow">NEW DEPARTURE　/　新增班次</span><strong>安排下一件要做的事</strong></div><label>班次名称<input name="metroTodoTitle" value={props.todoTitle()} placeholder="例如：完成产品方案" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} required /></label><label>日期<input type="date" name="metroTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /></label><label>时间<input type="time" name="metroTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /></label><label>重要程度<select name="metroTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高</option><option value="medium">普通</option><option value="low">低</option></select></label><button type="submit" class="mp-blue-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "确认排班"}</button></form></Show>
    <div class="mp-timetable-grid">
      <section class="mp-lane mp-lane--today"><header><h2>今日站台</h2><span>01 ACTIVE</span></header><Show when={props.ready()} fallback={<p class="mp-empty">正在读取班次…</p>}><Show when={today().length} fallback={<p class="mp-empty">今天尚未安排班次。</p>}><For each={today()}>{(item, index) => <MpTodoRow item={item} surface={props} number={index() + 1} label="正在出发" />}</For></Show></Show><footer>当前班次　{String(Math.max(1, today().findIndex((item) => !item.isCompleted) + 1)).padStart(2, "0")}　·　点击开始专注</footer></section>
      <section class="mp-lane mp-lane--next"><header><h2>待发班次</h2><span>02 NEXT</span></header><Show when={onDeck().length + props.overdueTodos().length} fallback={<p class="mp-empty">没有待发或过期事项，站台已清空。</p>}><For each={[...props.overdueTodos(), ...onDeck()]}>{(item, index) => <MpTodoRow item={item} surface={props} number={today().length + index() + 1} label={props.overdueTodos().some((overdue) => overdue.id === item.id) ? "已过期" : item.scheduledDate ? "待开始" : "未安排"} />}</For></Show><footer>未来班次、未安排事项与过期项均保留在列表</footer></section>
      <section class="mp-lane mp-lane--arrived"><header><h2>已到站</h2><span>03 ARRIVED</span></header><Show when={props.completedTodos().length} fallback={<p class="mp-empty">完成的班次会留在这里。</p>}><For each={props.completedTodos()}>{(item, index) => <MpTodoRow item={item} surface={props} number={index() + 1} label="已完成" completionSummary />}</For></Show><footer>已完成班次　{props.todayCompletedTodos().length} / {todayScheduledCount()}　·　完成率 {todayCompletionRate()}%</footer></section>
    </div><div class="mp-todos-footer"><span>今日班次：{todayDate() || "尚未安排"}</span><span>收件箱 {props.todos().filter((item) => !item.isCompleted && !item.scheduledDate).length}　·　过期 {props.overdueTodos().length}　·　已完成 {props.completedTodos().length}</span></div>
  </section>;
}

function mpRecordTime(record: FocusRecord) { return record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "--:--"; }
function mpRecordTimeRange(record: FocusRecord) {
  const [hour, minute] = mpRecordTime(record).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "--:-- – --:--";
  const end = hour * 60 + minute;
  const start = Math.max(0, end - Math.round(record.durationMs / 60_000));
  const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return `${format(start)} – ${format(end)}`;
}
function mpMinutes(value: number) { return `${Math.round(value / 60_000)} 分`; }
function mpCompactMinutes(value: number) { return `${Math.round(value / 60_000)}m`; }
function mpHours(value: number) { return `${(value / 3_600_000).toFixed(1)} h`; }
function mpHumanDuration(value: number) {
  const minutes = Math.round(value / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}小时${remainder}分钟` : `${minutes}分钟`;
}
function mpSelectedDayLabel(date: string, formatted: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatted;
  const dayStatus = formatted.startsWith("今天") ? "今天" : formatted.startsWith("昨天") ? "昨天" : formatted.replace(/^.*?·\s*/, "");
  return `${match[2]}月${match[3]}日 · ${dayStatus}`;
}
function mpShortArchiveDate(date: string) {
  const match = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}.${match[2]}` : date;
}
function mpCompactArchiveDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const weekday = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
  return `${Number(match[3])} ${["日", "一", "二", "三", "四", "五", "六"][weekday]}`;
}
function mpPeriodSummary(records: FocusRecord[]) {
  const ranges = [{ label: "上午", from: 5, to: 10 }, { label: "午后", from: 10, to: 14 }, { label: "傍晚", from: 14, to: 18 }, { label: "夜间", from: 18, to: 29 }];
  return ranges.map((part) => ({ ...part, duration: records.filter((record) => { const hour = Number.parseInt(mpRecordTime(record), 10); return Number.isFinite(hour) && hour >= part.from && hour < part.to; }).reduce((sum, record) => sum + record.durationMs, 0) }));
}

export function MetroPulseRecords(props: RecordsSurfaceProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const [weekOffset, setWeekOffset] = createSignal(0);
  const allDays = createMemo(() => props.extendedArchiveDays().length ? props.extendedArchiveDays() : props.archiveDays());
  const maxWeekOffset = createMemo(() => Math.max(0, Math.floor((allDays().length - 7) / 7)));
  const days = createMemo(() => {
    const end = allDays().length - weekOffset() * 7;
    return allDays().slice(Math.max(0, end - 7), end);
  });
  const geometry = createMemo(() => buildWeeklyChartGeometry(days()));
  const [visible, setVisible] = createSignal(40);
  const [expandedDate, setExpandedDate] = createSignal<string | null>(null);
  const totalSelected = createMemo(() => selectedRecords().reduce((sum, record) => sum + record.durationMs, 0));
  const weekDuration = createMemo(() => days().reduce((sum, day) => sum + day.totalDurationMs, 0));
  const weekActiveDays = createMemo(() => days().filter((day) => day.totalDurationMs > 0).length);
  const periods = createMemo(() => mpPeriodSummary(selectedRecords()));
  const maxPeriod = createMemo(() => Math.max(1, ...periods().map((part) => part.duration)));
  const selectDate = (date: string) => {
    const index = allDays().findIndex((day) => day.date === date);
    if (index >= 0) setWeekOffset(Math.min(maxWeekOffset(), Math.floor((allDays().length - 1 - index) / 7)));
    props.onSelectDate(date);
  };
  const moveWeek = (offset: number) => {
    const nextOffset = Math.max(0, Math.min(maxWeekOffset(), weekOffset() + offset));
    if (nextOffset === weekOffset()) return;
    setWeekOffset(nextOffset);
    const end = allDays().length - nextOffset * 7;
    const nextWeek = allDays().slice(Math.max(0, end - 7), end);
    const nextSelection = nextWeek[nextWeek.length - 1];
    if (nextSelection) props.onSelectDate(nextSelection.date);
  };
  const returnToRecent = () => {
    setWeekOffset(0);
    const latest = allDays()[allDays().length - 1];
    if (latest) props.onSelectDate(latest.date);
  };
  const scrollToHistory = () => {
    setExpandedDate(selectedDate());
    requestAnimationFrame(() => document.querySelector(".mp-history-index")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  createEffect(() => { const date = selectedDate(); setVisible(40); setExpandedDate(date); });
  return <section class="mp-page mp-records-page" aria-label="班次记录">
    <MetroHeader eyebrow="LINE HISTORY　/　WEEKLY SERVICE" title="七日班次" description="这一周的线路 · 专注时间与每一天对齐。" trailing={<div class="mp-date-range"><button type="button" aria-label="上一周" disabled={weekOffset() >= maxWeekOffset()} onClick={() => moveWeek(1)}><ChevronLeft size={16} /></button><span aria-live="polite">{mpShortArchiveDate(days()[0]?.date ?? "—")}　—　{mpShortArchiveDate(days()[days().length - 1]?.date ?? "—")}</span><button type="button" aria-label="下一周" disabled={weekOffset() === 0} onClick={() => moveWeek(-1)}><ChevronRight size={16} /></button><button type="button" onClick={returnToRecent}>回到最近</button></div>} />
    <div class="mp-record-top-grid"><section class="mp-week-panel"><div class="mp-panel-heading"><span>这一周的线路</span><small>专注分钟　/　每天同一坐标</small></div><div class="mp-chart" role="group" aria-label="最近七天专注记录">
      <div class="mp-chart__grid" aria-hidden="true"><i /><i /><i /><i /></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="mp-chart__area" d={geometry().areaPath} /><path class="mp-chart__line" d={geometry().linePath} /></svg>
      <For each={days()}>{(day, index) => <i aria-hidden="true" classList={{ "mp-chart-bar": true, active: selectedDate() === day.date, empty: day.totalDurationMs === 0 }} style={{ left: geometry().points[index()].x + "%", height: geometry().points[index()].barHeight + "%" }} />}</For>
      <For each={days()}>{(day, index) => { const point = geometry().points[index()]; return <button type="button" classList={{ "mp-chart-point": true, active: selectedDate() === day.date, empty: day.totalDurationMs === 0 }} style={{ left: point.x + "%", top: point.y + "%" }} aria-label={props.formatAnalyticsDate(day.date) + "，" + day.totalDurationLabel + "，" + day.sessionCount + " 段"} aria-pressed={selectedDate() === day.date} onClick={() => selectDate(day.date)}><i /><span>{day.totalDurationLabel}</span></button>; }}</For>
      <div class="mp-chart__dates">{days().map((day, index) => <button type="button" aria-label={props.formatAnalyticsDate(day.date)} aria-pressed={selectedDate() === day.date} style={{ left: geometry().points[index].x + "%" }} classList={{ active: selectedDate() === day.date }} onClick={() => selectDate(day.date)}>{mpCompactArchiveDate(day.date)}</button>)}</div>
    </div></section>
    <section class="mp-record-summary" aria-label="班次记录摘要"><div><span>七日累计</span><strong>{mpHours(weekDuration())}</strong></div><div><span>活跃天数</span><strong>{weekActiveDays()}<small> / 7</small></strong></div><div class="mp-record-selected"><span>选中日期　/　SELECTED DAY</span><strong>{mpSelectedDayLabel(selectedDate(), props.formatRecordDay(selectedDate()))}</strong><small>专注 {mpHumanDuration(totalSelected())}　·　完成 {selectedRecords().length} 班</small></div></section></div>
    <div class="mp-records-grid"><section class="mp-day-records"><div class="mp-panel-heading"><span>当日到站记录　·　{selectedRecords().length} 段</span></div><Show when={selectedRecords().length} fallback={<div class="mp-empty"><span>这一天没有专注记录。可以选择其他日期，或补录一段历史专注。</span><button type="button" disabled={props.busy()} onClick={() => void props.onCreateManualRecord?.()}>补录专注</button></div>}><For each={selectedRecords().slice(0, visible())}>{(record) => <article class="mp-record-row"><time>{mpRecordTimeRange(record)}</time><span class="mp-record-line" /><div class="mp-record-copy"><Show when={props.editingRecord()?.id === record.id} fallback={<><strong>{record.title}</strong><small>{record.modeLabel}　·　{record.source === "manual" ? "手动补录" : "计时完成"}{record.editedAt ? "　·　已修正" : ""}</small></>}><input aria-label="记录名称" value={props.editingRecord()?.title ?? ""} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void props.onSaveEdit(); if (event.key === "Escape") props.onCancelEdit(); }} /><div><button type="button" onClick={() => void props.onSaveEdit()}>保存</button><button type="button" onClick={props.onCancelEdit}>取消</button></div></Show></div><strong class="mp-record-duration">{mpMinutes(record.durationMs)}</strong><Show when={props.editingRecord()?.id !== record.id}><div class="mp-record-actions"><button type="button" disabled={props.busy()} onClick={() => props.onBeginEdit(record)}>改名</button><Show when={props.onBeginDetailedEdit}><button type="button" disabled={props.busy()} onClick={() => props.onBeginDetailedEdit?.(record)}>详细编辑</button></Show><button type="button" disabled={props.busy()} onClick={() => void props.onRemove(record.id)}>删除</button></div></Show></article>}</For><div class="mp-record-footer-actions"><button type="button" disabled={props.busy()} onClick={() => void props.onCreateManualRecord?.()}><Plus size={14} />补录</button><button type="button" onClick={scrollToHistory}>展开当日完整记录　<ChevronDown size={13} /></button><button type="button" onClick={() => { if (visible() < selectedRecords().length) setVisible((count) => count + 40); else scrollToHistory(); }}>加载更多</button></div></Show></section>
      <aside class="mp-period-card"><div class="mp-panel-heading"><span>专注时段分布</span><small>按真实完成时间统计</small></div><For each={periods()}>{(part) => <div classList={{ "mp-period-row": true, "mp-period-row--morning": part.label === "上午" }} style={{ "--mp-period-width": `${part.duration / maxPeriod() * 100}%`, "--mp-period-height": `${Math.max(3, part.duration / maxPeriod() * 63)}px` }}><span>{part.label}</span><i><b /></i><strong>{mpCompactMinutes(part.duration)}</strong></div>}</For><div class="mp-selected-note"><span>选中日摘要</span><strong>{selectedRecords().length} 段专注</strong><small>{props.formatRecordDay(selectedDate())} · {props.formatDurationMs(totalSelected())}</small></div></aside></div>
    <section class="mp-history-index"><div class="mp-panel-heading"><span>完整历史　/　按日展开</span><strong>{props.records().length} 条记录</strong></div><Show when={props.recordGroups().length} fallback={<p class="mp-empty">完成一段专注后，完整历史会显示在这里。</p>}><For each={props.recordGroups()}>{(group) => <details open={expandedDate() === group.date}><summary aria-expanded={expandedDate() === group.date} onClick={(event) => { event.preventDefault(); setExpandedDate((date) => date === group.date ? null : group.date); }}><span><ChevronDown size={15} />{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 段　·　{props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedDate() === group.date}><div class="mp-history-items">{group.records.map((record) => <span>{mpRecordTime(record)}　{record.title}　·　{record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
  </section>;
}

export function MetroPulseSettings(props: SettingsSurfaceProps) { return <MetroThemeSettings {...props} variant="metro" />; }
