import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { ChevronDown, Plus, RotateCcw } from "lucide-solid";
import type { FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";
import type { FocusSurfaceProps, RecordsSurfaceProps, SettingsSurfaceProps, TodaySurfaceProps, TodoSurfaceProps } from "../lib/theme-contracts";
import { buildWeeklyChartGeometry } from "../lib/weekly-chart";
import { ClutchThemeSettings } from "./ThemeSettings";

function ccFormatMs(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
function ccCompactLabel(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return value;
  return parts[0] > 0 ? `${parts[0]}:${String(parts[1]).padStart(2, "0")}:${String(parts[2]).padStart(2, "0")}` : `${parts[1]}:${String(parts[2]).padStart(2, "0")}`;
}
function ccStatus(timer: TimerSnapshot, progress: boolean) {
  if (timer.isRunning) return "专注进行中";
  if (timer.modeKey === "countdown" && timer.remainingMs === 0 && progress) return "计时结束 · 待记录";
  if (progress) return "已暂停";
  if (timer.modeKey === "countdown" && timer.remainingMs === 0) return "倒计时已结束";
  return "准备开始专注";
}
function ccClock(timer: TimerSnapshot, minutes: number, dirty: boolean) {
  if (timer.modeKey === "countdown" && dirty && !timer.hasUnsubmittedProgress) return ccFormatMs(minutes * 60000);
  return timer.modeKey === "countdown" && timer.remainingMs !== null ? ccFormatMs(timer.remainingMs) : ccCompactLabel(timer.elapsedLabel);
}
function ccImportance(value: TodoImportance) { return value === "high" ? "高优先" : value === "medium" ? "普通" : "低优先"; }
function ClutchHeader(props: { eyebrow: string; title: string; description: string; trailing?: any }) {
  return <header class="cc-page-head"><div><span class="cc-eyebrow">{props.eyebrow}</span><h1>{props.title}</h1><p>{props.description}</p></div><div class="cc-page-head__trailing">{props.trailing}</div></header>;
}
function Scoreboard(props: { metricValue: number; metricLabel: string; metricUnit: string; timer: TimerSnapshot; streak: number; status: string; featured?: boolean; clockLabel?: string }) {
  const clock = () => props.clockLabel ?? (props.timer.modeKey === "countdown" && props.timer.remainingMs !== null
    ? ccFormatMs(props.timer.remainingMs)
    : ccCompactLabel(props.timer.elapsedLabel));
  const clockKind = () => props.timer.modeKey === "countdown" ? "剩余时间" : "实际用时";
  return <section classList={{ "cc-scoreboard": true, "cc-scoreboard--featured": Boolean(props.featured) }} aria-label="今日专注概况"><div><span>{props.metricLabel}</span><strong>{String(props.metricValue).padStart(2, "0")}</strong><small>{props.metricUnit}</small></div><div><span>专注段　/　{clockKind()}</span><strong>{props.featured ? <><span>第 {Math.max(1, props.timer.currentRound)} 段</span><b>{clock()}</b></> : `第 ${Math.max(1, props.timer.currentRound)} 段　·　${clock()}`}</strong><small>{props.status}</small></div><div><span>连续专注</span><strong>{props.streak}<small> 天</small></strong><small>专注节奏</small></div></section>;
}
type ButlerCardVariant = "today" | "focus" | "playbook";

function ButlerCard(props: { variant: ButlerCardVariant }) {
  const today = () => props.variant === "today";
  const focus = () => props.variant === "focus";
  const playbook = () => props.variant === "playbook";
  const image = () => today()
    ? "/theme-assets/jimmy-butler-home-warriors10.png"
    : focus()
      ? "/theme-assets/jimmy-butler-focus-action.png"
      : "/theme-assets/jimmy-butler-playbook-calling.png";
  const label = () => today()
    ? "Jimmy Butler 勇士 10 号主场海报"
    : focus()
      ? "Jimmy Butler 关键时刻肖像"
      : "Jimmy Butler 战术板球员签条";

  return <aside
    classList={{
      "cc-butler-card": true,
      compact: playbook(),
      "cc-butler-card--featured": today(),
      "cc-butler-card--today": today(),
      "cc-butler-card--timer": focus(),
      "cc-butler-card--playbook": playbook(),
    }}
    data-butler-style={today() ? "court-poster" : focus() ? "focus-portrait" : "sideline-playbook"}
    aria-label={label()}
  >
    <img src={image()} alt="Jimmy Butler 勇士 10 号球衣人物视觉" />
    <Show when={today()} fallback={<div><span>JIMMY BUTLER　·　#10</span><strong>CLUTCH MODE</strong><small>关键时刻，专注打好眼前这一段。</small></div>}>
      <div><span>JIMMY<br />BUTLER</span><strong>CLUTCH MODE</strong><b>10</b><small>关键时刻，专注打好眼前这一段。</small></div>
    </Show>
  </aside>;
}

export function ClutchCourtToday(props: TodaySurfaceProps) {
  const rounds = createMemo(() => {
    const all = [props.currentTodo(), ...props.todayTodos(), ...props.todayCompletedTodos(), ...props.planTodos()]
      .filter((todo): todo is TodoItem => Boolean(todo));
    const unique = [...new Map(all.map((todo) => [todo.id, todo])).values()];
    return unique.sort((a, b) => {
      const dateOrder = (a.scheduledDate || props.todayDate).localeCompare(b.scheduledDate || props.todayDate);
      return dateOrder || (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99") || a.id - b.id;
    });
  });
  const next = createMemo(() => {
    const linked = rounds().find((todo) => todo.id === props.timer().linkedTodoId && !todo.isCompleted);
    return linked ?? props.currentTodo() ?? props.nextTodo() ?? rounds().find((todo) => !todo.isCompleted) ?? null;
  });
  const taskState = (todo: TodoItem, position: number) => {
    if (todo.isCompleted) return "已完成";
    const isFocused = props.timerHasProgress() && props.timer().linkedTodoId === todo.id;
    if (isFocused) return props.timer().isRunning ? "专注中" : "已暂停";
    if (props.timerHasProgress() && !props.timer().linkedTodoId) return "待开始";
    return todo.id === next()?.id && position < 6 ? "下一项" : "待开始";
  };
  const status = createMemo(() => ccStatus(props.timer(), props.timerHasProgress()));
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const clock = createMemo(() => props.timer().modeKey === "countdown"
    ? ccClock(props.timer(), props.defaultFocusMinutes(), false)
    : ccCompactLabel(props.timer().elapsedLabel));
  const play = () => props.timer().isRunning ? props.onPause() : props.timerHasProgress() ? props.onContinue() : next() ? props.onStartTodo(next()!) : props.onOpenTodos();
  return <section class="cc-page cc-today-page" aria-label="今日赛场">
    <h1 class="sr-only">今日赛场</h1>
    <div class="cc-today-hero">
      <div class="cc-home-manifest"><span>CLUTCH MOMENT</span><p>把注意力放在当下，<br />每一段专注都有新的开始。</p><small>HOME COURT　·　FOCUS MODE</small></div>
      <Scoreboard featured clockLabel={clock()} metricValue={props.todayCompletedTodos().length} metricLabel="今日已完成" metricUnit="项待办" timer={props.timer()} streak={streak()} status={status()} />
      <div class="cc-home-hero-note"><strong>FOCUS AT YOUR PACE</strong><span>专注推进眼前这一项。</span></div>
      <ButlerCard variant="today" />
    </div>
    <div class="cc-home-court">
      <div class="cc-court-stage">
      <div class="cc-court-lines" aria-hidden="true"><span class="cc-halfway" /><span class="cc-center-circle" /><span class="cc-left-key" /><span class="cc-right-key" /><span class="cc-left-hoop" /><span class="cc-right-hoop" /><span class="cc-three-left" /><span class="cc-three-right" /><span class="cc-basketball-art" /></div>
      <svg class="cc-play-arrows" viewBox="0 0 1487 683" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="cc-play-arrow" viewBox="0 0 10 8" refX="8" refY="4" markerWidth="10" markerHeight="8" orient="auto"><path d="M 1 1 L 8 4 L 1 7" /></marker></defs>
        <path d="M 376 140 C 388 171, 423 187, 466 181" />
        <path d="M 800 181 C 838 197, 877 177, 898 146" />
        <path d="M 340 515 C 370 535, 410 531, 450 520" />
        <path d="M 898 514 C 927 537, 967 548, 1002 557" />
      </svg>
      <div class="cc-court-notes" aria-hidden="true">
        <span class="cc-court-note cc-court-note--opening">开局稳住，<br />专注推进！</span>
        <span class="cc-court-note cc-court-note--breakthrough">下一步，<br />专注推进！</span>
        <span class="cc-court-note cc-court-note--steady">稳住节奏，<br />做好这一段！</span>
        <span class="cc-court-note cc-court-note--detail">专注眼前事项！<br /><b>KEEP GOING!</b></span>
      </div>
      <div class="cc-court-title"><span>CLUTCH</span><h1>MOMENT</h1><p>从当前待办开始，专注一项。</p></div>
      <div class="cc-center-clock"><span>专注计时　/　{props.timer().modeKey === "countdown" ? "剩余时间" : "实际用时"}</span><strong>{clock()}</strong><small>{props.timer().activeTaskTitle || next()?.title || "先写下今天的第一项任务"}</small><span class="cc-clock-status" role="status">{status()}</span><button type="button" class="cc-lime-button" disabled={props.busy()} onClick={() => void play()}>{props.timer().isRunning ? "Ⅱ　暂停专注" : props.timerHasProgress() ? "▶　继续专注" : next() ? "▶　开始专注" : "新增待办"}</button></div>
      <div class="cc-shotclock-badge" aria-label="主题铭牌 24 SEC，不是实际递减计时">24 <small>SEC<br />THEME PLATE</small></div>
      </div>
      <div class="cc-round-markers" role="group" aria-label={"今日任务，显示前 " + Math.min(6, rounds().length) + " 项，共 " + rounds().length + " 项"}>
        <For each={rounds().slice(0, 6)}>
          {(todo, index) => <button
            type="button"
            classList={{ "cc-round-marker": true, done: todo.isCompleted, current: todo.id === next()?.id && !todo.isCompleted, focused: props.timerHasProgress() && props.timer().linkedTodoId === todo.id }}
            aria-label={"任务 " + String(index() + 1).padStart(2, "0") + "：" + todo.title + "，" + taskState(todo, index())}
            disabled={props.busy() || todo.isCompleted || props.timerHasProgress()}
            onClick={() => props.onStartTodo(todo)}
          >
            <i>{String(index() + 1).padStart(2, "0")}</i>
            <span class="cc-round-marker__copy">
              <strong>{todo.title}</strong>
              <small>{todo.scheduledTime || (todo.scheduledDate ? "已安排" : "未安排时间")}</small>
              <em>{taskState(todo, index())}</em>
            </span>
          </button>}
        </For>
      </div>
    </div>
    <Show when={rounds().length > 6}><button type="button" class="cc-all-tasks-link" onClick={props.onOpenTodos}>查看全部 {rounds().length} 项待办</button></Show>
  </section>;
}

export function ClutchCourtFocus(props: FocusSurfaceProps) {
  const display = createMemo(() => ccClock(props.timer(), props.countdownMinutes(), props.countdownDraftDirty()));
  const linked = createMemo(() => props.todos().find((todo) => todo.id === props.linkedTodoId()) ?? null);
  const locked = createMemo(() => props.busy() || !props.ready() || props.timerHasProgress());
  const actionLabel = createMemo(() => {
    if (props.timer().isRunning) return "Ⅱ　暂停专注";
    if (props.timerCanContinue()) return "▶　继续专注";
    if (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0 && props.timerHasProgress()) return "时间到 · 等待记录";
    return "▶　开始专注";
  });
  const actionDisabled = createMemo(() => props.busy() || !props.ready() || (!props.timer().isRunning && props.timer().modeKey === "countdown" && props.timer().remainingMs === 0 && props.timerHasProgress()));
  const runPrimaryAction = () => {
    if (props.timer().isRunning) return props.onPause();
    if (props.timerCanContinue()) return props.onStart();
    if (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0 && props.timerHasProgress()) return;
    return props.onStart();
  };
  function linkedChange(value: string) { const id = value ? Number(value) : null; const todo = props.todos().find((item) => item.id === id); props.onLinkedTodoChange(id); props.onSessionTitleDirty(); if (todo) props.onSessionTitleChange(todo.title); }
  return <section class="cc-page cc-focus-page" aria-label="赛场计时">
    <Scoreboard featured clockLabel={display()} metricValue={props.todaySessionCount()} metricLabel="今日已记录" metricUnit="段专注" timer={props.timer()} streak={props.currentStreakDays()} status={ccStatus(props.timer(), props.timerHasProgress())} />
    <ClutchHeader eyebrow="FOCUS CLOCK　/　专注时段" title="关键时刻 · 专注计时" description="从待办开始，按自己的节奏专注；暂停后随时继续。" trailing={<span class="cc-session-badge">第 {Math.max(1, props.timer().currentRound)} 段专注　/　{ccStatus(props.timer(), props.timerHasProgress())}</span>} />
    <div class="cc-timer-layout">
      <ButlerCard variant="focus" />
      <section class="cc-court-dial" aria-label="专注计时盘">
        <div class="cc-center-circle cc-center-circle--timer">
          <span>FOCUS CLOCK　/　{props.timer().mode}</span>
          <strong>{display()}</strong>
          <small>{props.timer().activeTaskTitle || props.sessionTitle().trim() || "当前专注事项"}　·　今日第 {Math.max(1, props.timer().currentRound)} 段</small>
          <button type="button" class="cc-lime-button" disabled={actionDisabled()} onClick={() => void runPrimaryAction()}>{actionLabel()}</button>
        </div>
      </section>
      <aside class="cc-tactics-board">
        <div class="cc-chalk-label">COURTSIDE　/　专注安排</div>
        <h2>本段专注安排</h2>
        <label>专注任务<input name="clutchSessionTitle" value={props.sessionTitle()} placeholder="写下这一段要完成的事" disabled={locked()} onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
        <label>关联待办<select name="clutchLinkedTodo" value={props.linkedTodoId() ?? ""} disabled={locked()} onChange={(event) => linkedChange(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
        <Show when={linked()}>{(todo) => <small class="cc-linked-note">当前战术连接：{todo().title}</small>}</Show>
        <div class="cc-mode-switch" role="group" aria-label="计时模式"><button type="button" aria-pressed={props.timer().modeKey !== "countdown"} classList={{ active: props.timer().modeKey !== "countdown" }} disabled={locked()} onClick={() => void props.onChangeMode("stopwatch")}>正向计时</button><button type="button" aria-pressed={props.timer().modeKey === "countdown"} classList={{ active: props.timer().modeKey === "countdown" }} disabled={locked()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div>
        <Show when={props.timer().modeKey === "countdown"}><label>目标时长（分钟）<input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={locked()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /></label></Show>
        <label class="cc-check"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={locked() || !props.linkedTodoId()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} />完成时同步标记关联待办</label>
        <div class="cc-timer-actions">
          <button type="button" class="cc-secondary-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}>完成并记录</button>
          <button type="button" class="cc-secondary-button" disabled={props.busy() || !props.ready()} onClick={() => void props.onReset()}><RotateCcw size={14} />重置</button>
        </div>
        <Show when={props.savedConfirmation()}><p class="cc-confirm" role="status">专注记录已保存。</p></Show>
        <div class="cc-tactics-actions"><button type="button" disabled={props.busy()} onClick={() => void props.onOpenRecords()}>查看专注记录</button></div>
      </aside>
    </div>
    <footer class="cc-page-footer"><span>今日已记录 {props.todaySessionCount()} 段专注</span><span>只统计实际记录的专注时间</span><Show when={props.timerHasProgress()}><button type="button" onClick={() => void props.onShowFocusFloating()}>打开迷你工作台</button></Show></footer>
  </section>;
}

function CcTodoRow(props: { item: TodoItem; surface: TodoSurfaceProps; number: number }) {
  const overdue = () => props.surface.overdueTodos().some((item) => item.id === props.item.id);
  const focused = () => props.surface.timerHasProgress() && props.surface.timer().linkedTodoId === props.item.id;
  const isEditing = () => props.surface.editingTodo()?.id === props.item.id;
  const state = () => props.item.isCompleted ? "已完成" : focused() ? props.surface.timer().isRunning ? "专注中" : "已暂停" : overdue() ? "已过期" : props.item.scheduledDate ? "待开始" : "未安排";
  return (
    <article classList={{ "cc-task-row": true, complete: props.item.isCompleted, overdue: overdue() }}>
      <Show
        when={isEditing()}
        fallback={
          <div class="cc-task-leading">
            <span class="cc-jersey" aria-hidden="true">{String(props.number).padStart(2, "0")}</span>
            <button type="button" class="cc-task-check" aria-label={(props.item.isCompleted ? "恢复 " : "完成 ") + props.item.title} disabled={props.surface.busy()} onClick={() => props.surface.onToggle(props.item.id)}>{props.item.isCompleted ? "恢复" : "完成"}</button>
          </div>
        }
      >
        <div class="cc-task-leading">
          <span class="cc-jersey" aria-hidden="true">{String(props.number).padStart(2, "0")}</span>
        </div>
      </Show>
      <Show
        when={isEditing()}
        fallback={
          <>
            <div><strong>{props.item.title}</strong><small>{props.surface.formatTodoDue(props.item)}　·　{ccImportance(props.item.importanceKey)}</small></div>
            <span class="cc-task-state">{state()}</span>
            <div class="cc-task-actions">
              <button type="button" aria-label={"开始专注：" + props.item.title} disabled={props.surface.busy() || props.surface.timerHasProgress()} onClick={() => props.surface.onUseForFocus(props.item)}>{focused() ? state() : "开始专注"}</button>
              <button type="button" disabled={props.surface.busy()} onClick={() => props.surface.onBeginEdit(props.item)}>编辑</button>
              <button type="button" disabled={props.surface.busy()} onClick={() => void props.surface.onRemove(props.item.id)}>删除</button>
            </div>
          </>
        }
      >
        <div class="cc-task-edit">
          <label>任务<input value={props.surface.editingTodo()?.title ?? ""} onInput={(event) => props.surface.onPatch({ title: event.currentTarget.value })} /></label>
          <label>日期<input type="date" value={props.surface.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.surface.onPatch({ scheduledDate: event.currentTarget.value })} /></label>
          <label>时间<input type="time" value={props.surface.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.surface.onPatch({ scheduledTime: event.currentTarget.value })} /></label>
          <label>优先级<select value={props.surface.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.surface.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">普通</option><option value="low">低</option></select></label>
          <button type="button" onClick={props.surface.onSave}>保存</button>
          <button type="button" onClick={props.surface.onCancel}>取消</button>
        </div>
      </Show>
    </article>
  );
}
export function ClutchCourtTodos(props: TodoSurfaceProps) {
  const [formOpen, setFormOpen] = createSignal(props.todos().length === 0);
  const [createTodoError, setCreateTodoError] = createSignal("");
  const rankedTodos = createMemo(() => [...props.todos()].sort((a, b) => {
    const dateOrder = (a.scheduledDate || "9999-99-99").localeCompare(b.scheduledDate || "9999-99-99");
    return dateOrder || (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99") || a.id - b.id;
  }));
  const roundNumber = (item: TodoItem) => Math.max(1, rankedTodos().findIndex((todo) => todo.id === item.id) + 1);
  const todays = createMemo(() => [...props.todayCompletedTodos(), ...props.todayTodos()].sort((a, b) => (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99")));
  const currentId = createMemo(() => {
    const linkedId = props.timer().linkedTodoId;
    if (linkedId !== null && todays().some((todo) => todo.id === linkedId && !todo.isCompleted)) return linkedId;
    return todays().find((todo) => !todo.isCompleted)?.id ?? null;
  });
  const currentPlay = createMemo(() => {
    const id = currentId();
    return id === null ? [] : todays().filter((todo) => todo.id === id && !todo.isCompleted);
  });
  const upcoming = createMemo(() => {
    const currentIds = new Set(currentPlay().map((item) => item.id));
    const overdueIds = new Set(props.overdueTodos().map((item) => item.id));
    return props.activeTodos().filter((item) => !currentIds.has(item.id) && !overdueIds.has(item.id));
  });
  const futureCount = createMemo(() => props.activeTodos().filter((item) => item.scheduledDate && !props.todayTodos().some((today) => today.id === item.id)).length);

  return (
    <section class="cc-page cc-todos-page" aria-label="今日赛场待办">
      <ClutchHeader
        eyebrow={"PLAYBOOK　/　" + props.todos().length + " TASKS"}
        title="把待办排进战术板"
        description="先选一项开始专注；未安排、未来和过期事项都会保留。"
        trailing={
          <div class="cc-todos-header-actions">
            <ButlerCard variant="playbook" />
            <button type="button" class="cc-orange-button" onClick={() => { setCreateTodoError(""); setFormOpen((open) => !open); }}>
              <Plus size={16} />{formOpen() ? "收起新增待办" : "新增待办"}
            </button>
          </div>
        }
      />
      <Show when={formOpen()}>
        <form class="cc-create-play" onSubmit={async (event) => {
          event.preventDefault();
          setCreateTodoError("");
          if (!props.todoTitle().trim()) { setCreateTodoError("请先填写待办名称；内容不会因校验失败而丢失。"); return; }
          try {
            const added = await props.onAddTodo();
            if (added === true) setFormOpen(false);
            else setCreateTodoError("保存未成功，请检查应用提示后重试；表单内容已保留。");
          } catch {
            setCreateTodoError("新增待办失败，请检查连接后重试；表单内容已保留。");
          }
        }}>
          <span class="cc-chalk-label">NEW TASK　/　新增待办</span>
          <label>任务名称<input name="clutchTodoTitle" value={props.todoTitle()} placeholder="写下要完成的事项" required onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /></label>
          <label>安排日期<input type="date" name="clutchTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /></label>
          <label>开始时间<input type="time" name="clutchTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /></label>
          <label>优先级<select name="clutchTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高</option><option value="medium">普通</option><option value="low">低</option></select></label>
          <button type="submit" class="cc-lime-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "保存待办"}</button>
          <Show when={createTodoError()}><p class="cc-create-error" role="alert">{createTodoError()}</p></Show>
        </form>
      </Show>
      <div class="cc-playbook-grid">
        <section class="cc-lane cc-lane--current">
          <header><span>NOW　/　当前事项</span><h2>当前待办</h2><b>{currentPlay().length}</b></header>
          <Show when={currentPlay().length} fallback={<p class="cc-empty">当前没有待办。新增一项后，即可从这里开始专注。</p>}>
            <For each={currentPlay()}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} />}</For>
          </Show>
          <footer>点击“开始专注”会自动关联当前待办　·　今日完成 {props.todayCompletedTodos().length} / {todays().length}</footer>
        </section>
        <section class="cc-lane cc-lane--warmup">
          <header><span>UP NEXT　/　后续事项</span><h2>其他待办</h2><b>{upcoming().length + props.overdueTodos().length}</b></header>
          <Show when={upcoming().length + props.overdueTodos().length} fallback={<p class="cc-empty">没有其他待办。未来或未安排的事项会在这里显示。</p>}>
            <For each={[...props.overdueTodos(), ...upcoming()]}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} />}</For>
          </Show>
          <footer>过期、未安排和未来事项都会保留在这里</footer>
        </section>
        <section class="cc-lane cc-lane--made">
          <header><span>DONE　/　已完成</span><h2>已完成待办</h2><b>{props.completedTodos().length}</b></header>
          <Show when={props.completedTodos().length} fallback={<p class="cc-empty">完成待办后会显示在这里；专注记录会保存在“记录”页。</p>}>
            <For each={props.completedTodos()}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} />}</For>
          </Show>
          <footer>可以恢复待办，或再次围绕它开始专注</footer>
        </section>
      </div>
      <footer class="cc-page-footer">
        <span>未安排 {props.todos().filter((item) => !item.isCompleted && !item.scheduledDate).length}</span>
        <span>未来 {futureCount()}</span>
        <span>过期 {props.overdueTodos().length}</span>
        <span>临时任务不会丢失</span>
      </footer>
    </section>
  );
}

function ccRecordTime(record: FocusRecord) { return record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "--:--"; }
function ccCompactDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}` : `${totalMinutes}m`;
}
function ccPeriods(records: FocusRecord[]) {
  const bands = [
    { name: "上午", includes: (hour: number) => hour >= 5 && hour < 11 },
    { name: "午后", includes: (hour: number) => hour >= 11 && hour < 17 },
    { name: "傍晚", includes: (hour: number) => hour >= 17 && hour < 21 },
    { name: "夜间", includes: (hour: number) => hour >= 21 || hour < 5 },
  ];
  return bands.map((band) => ({ name: band.name, ms: records.filter((record) => { const hour = Number.parseInt(ccRecordTime(record), 10); return Number.isFinite(hour) && band.includes(hour); }).reduce((total, record) => total + record.durationMs, 0) }));
}
export function ClutchCourtRecords(props: RecordsSurfaceProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const days = createMemo(() => props.archiveDays().slice(-7));
  const geometry = createMemo(() => buildWeeklyChartGeometry(days()));
  const chartMaximum = createMemo(() => Math.max(0, ...days().map((day) => day.totalDurationMs)));
  const total = createMemo(() => selectedRecords().reduce((sum, record) => sum + record.durationMs, 0));
  const allRecordsDuration = createMemo(() => props.analytics()?.totalFocusDurationMs ?? (props.records().length ? props.records().reduce((sum, record) => sum + record.durationMs, 0) : null));
  const sessions = createMemo(() => props.analytics()?.sessionCount ?? (props.records().length ? props.records().length : null));
  const avg = createMemo(() => allRecordsDuration() !== null && sessions() ? ccCompactDuration(allRecordsDuration()! / sessions()!) : "—");
  const allRecordsDurationLabel = createMemo(() => {
    const duration = allRecordsDuration();
    return duration === null ? "—" : `${(duration / 3_600_000).toFixed(1)}h`;
  });
  const selectedAverage = createMemo(() => selectedRecords().length > 0 ? ccCompactDuration(total() / selectedRecords().length) : "—");
  const periods = createMemo(() => ccPeriods(selectedRecords()));
  const maxPeriod = createMemo(() => Math.max(1, ...periods().map((part) => part.ms)));
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [visible, setVisible] = createSignal(50);
  createEffect(() => { const date = selectedDate(); setExpanded(date); setVisible(50); });
  const latest = () => days()[days().length - 1]?.date ?? selectedDate();
  const dateRange = () => days().length > 0
    ? `${props.formatArchiveRangeDate(days()[0].date)}　—　${props.formatArchiveRangeDate(days()[days().length - 1].date)}`
    : "暂无七日记录";
  const showMoreOrHistory = () => {
    if (visible() < selectedRecords().length) {
      setVisible((count) => count + 50);
      return;
    }
    setExpanded(selectedDate());
    document.getElementById("cc-history-index")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section class="cc-page cc-records-page" aria-label="专注记录与七日趋势">
      <ClutchHeader
        eyebrow="FOCUS STATS　/　7-DAY TREND"
        title="七日专注趋势"
        description="按日期查看真实专注时长、记录段数与当天明细。"
        trailing={
          <div class="cc-records-head-actions">
            <span>{props.formatRecordDay(selectedDate())}<small>{dateRange()}</small></span>
            <button type="button" class="cc-secondary-button" onClick={() => props.onSelectDate(latest())}>回到最近</button>
          </div>
        }
      />
      <section class="cc-boxscore">
        <div><div><span>FOCUS TOTAL</span><small>累计专注</small></div><strong>{allRecordsDurationLabel()}</strong></div>
        <div><div><span>SESSIONS</span><small>记录段数</small></div><strong>{sessions() ?? "—"}</strong></div>
        <div><div><span>AVG. SESSION</span><small>平均时长</small></div><strong>{avg()}</strong></div>
        <div><div><span>STREAK</span><small>连续专注</small></div><strong>{props.analytics()?.currentStreakDays ?? 0} 天</strong></div>
      </section>
      <div class="cc-records-overview-grid">
        <section class="cc-shot-chart">
          <div class="cc-panel-heading"><span>七日专注趋势</span><span>纵向为每日时长　·　0 至 {ccCompactDuration(chartMaximum())}</span></div>
          <div class="cc-chart" role="group" aria-label={`最近七日每日专注时长，纵轴从 0 到 ${ccCompactDuration(chartMaximum())}`}>
            <div class="cc-chart__grid"><i /><i /><i /><i /></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path class="cc-chart__line" d={geometry().linePath} />
            </svg>
            <For each={days()}>{(day, index) => {
              const point = geometry().points[index()];
              return <button type="button" classList={{ "cc-chart-point": true, active: selectedDate() === day.date, empty: day.totalDurationMs === 0 }} style={{ left: point.x + "%", top: point.y + "%" }} aria-label={props.formatAnalyticsDate(day.date) + "，" + day.totalDurationLabel + "，" + day.sessionCount + " 段"} aria-pressed={selectedDate() === day.date} onClick={() => props.onSelectDate(day.date)}><i /><span>{day.totalDurationLabel}</span></button>;
            }}</For>
            <div class="cc-chart-dates">{days().map((day, index) => <button type="button" style={{ left: geometry().points[index].x + "%" }} classList={{ active: selectedDate() === day.date }} aria-pressed={selectedDate() === day.date} onClick={() => props.onSelectDate(day.date)}>{props.formatAnalyticsDate(day.date)}</button>)}</div>
          </div>
        </section>
        <section class="cc-day-boxscore" aria-label="选中日期摘要">
          <div class="cc-panel-heading"><span>{props.formatRecordDay(selectedDate())}</span><strong>SELECTED DAY</strong></div>
          <div class="cc-day-stats">
            <div><span>当日专注</span><strong>{ccCompactDuration(total())}</strong></div>
            <div><span>当日记录</span><strong>{selectedRecords().length} 段</strong></div>
            <div><span>单段平均</span><strong>{selectedAverage()}</strong></div>
            <div><span>七日活跃</span><strong>{props.recentWeekActiveDays()} / 7</strong></div>
          </div>
        </section>
      </div>
      <div class="cc-records-grid">
        <section class="cc-game-log">
          <div class="cc-panel-heading"><span>{props.formatRecordDay(selectedDate())}　·　当日专注记录</span><span>{selectedRecords().length} 段　/　{props.formatDurationMs(total())}</span></div>
          <Show when={selectedRecords().length} fallback={<p class="cc-empty">这一天没有专注记录。点击其他日期或补录历史专注。</p>}>
            <For each={selectedRecords().slice(0, visible())}>{(record) => (
              <article class="cc-log-row">
                <time>{ccRecordTime(record)}</time>
                <div>
                  <Show when={props.editingRecord()?.id === record.id} fallback={<><strong>{record.title}</strong><small>{record.modeLabel}　·　{record.source === "manual" ? "手动补录" : "计时完成"}</small></>}>
                    <input aria-label="记录名称" value={props.editingRecord()?.title ?? ""} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void props.onSaveEdit(); if (event.key === "Escape") props.onCancelEdit(); }} />
                    <button type="button" onClick={() => void props.onSaveEdit()}>保存</button>
                    <button type="button" onClick={props.onCancelEdit}>取消</button>
                  </Show>
                </div>
                <strong>{record.durationLabel}</strong>
                <Show when={props.editingRecord()?.id !== record.id}>
                  <div class="cc-log-actions">
                    <button type="button" disabled={props.busy()} onClick={() => props.onBeginEdit(record)}>改名</button>
                    <Show when={props.onBeginDetailedEdit}><button type="button" disabled={props.busy()} onClick={() => props.onBeginDetailedEdit?.(record)}>详细编辑</button></Show>
                    <button type="button" disabled={props.busy()} onClick={() => void props.onRemove(record.id)}>删除</button>
                  </div>
                </Show>
              </article>
            )}</For>
          </Show>
          <div class="cc-record-footer-actions">
            <button type="button" disabled={props.busy()} onClick={() => void props.onCreateManualRecord?.()}><Plus size={14} />补录</button>
            <button type="button" onClick={() => { setExpanded(selectedDate()); document.getElementById("cc-history-index")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>按日展开完整历史　<ChevronDown size={14} /></button>
            <Show when={selectedRecords().length > 50}><button type="button" onClick={showMoreOrHistory}>{visible() < selectedRecords().length ? `加载更多　${visible()} / ${selectedRecords().length}` : "查看完整历史"}</button></Show>
          </div>
        </section>
        <aside class="cc-session-map">
          <div class="cc-panel-heading"><span>专注时段分布　/　实际完成时间</span></div>
          <div class="cc-period-chart">
            <For each={periods()}>{(part) => (
              <div class="cc-period-column">
                <strong>{ccCompactDuration(part.ms)}</strong>
                <div class="cc-period-track"><i style={{ height: Math.max(4, part.ms / maxPeriod() * 72) + "px" }} /></div>
                <span>{part.name}</span>
              </div>
            )}</For>
          </div>
        </aside>
      </div>
      <section class="cc-history-index" id="cc-history-index">
        <div class="cc-panel-heading"><span>全部专注记录　/　完整历史</span><strong>{props.records().length} 条记录</strong></div>
        <Show when={props.recordGroups().length} fallback={<p class="cc-empty">完成一次专注后，全部历史会显示在这里。</p>}>
          <For each={props.recordGroups()}>{(group) => (
            <details open={expanded() === group.date}>
              <summary onClick={(event) => { event.preventDefault(); setExpanded((date) => date === group.date ? null : group.date); }}>
                <span><ChevronDown size={15} />{props.formatRecordDay(group.date)}</span>
                <strong>{group.records.length} 段　·　{props.formatDurationMs(group.totalDurationMs)}</strong>
              </summary>
              <Show when={expanded() === group.date}><div>{group.records.map((record) => <span>{ccRecordTime(record)}　{record.title}　·　{record.durationLabel}</span>)}</div></Show>
            </details>
          )}</For>
        </Show>
      </section>
    </section>
  );
}
export function ClutchCourtSettings(props: SettingsSurfaceProps) { return <ClutchThemeSettings {...props} variant="clutch" />; }
