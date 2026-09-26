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
  if (timer.isRunning) return "比赛进行中";
  if (timer.modeKey === "countdown" && timer.remainingMs === 0 && progress) return "时间到 · 待保存";
  if (progress) return "暂停";
  if (timer.modeKey === "countdown" && timer.remainingMs === 0) return "倒计时已结束";
  return "准备开球";
}
function ccClock(timer: TimerSnapshot, minutes: number, dirty: boolean) {
  if (timer.modeKey === "countdown" && dirty && !timer.hasUnsubmittedProgress) return ccFormatMs(minutes * 60000);
  return timer.modeKey === "countdown" && timer.remainingMs !== null ? ccFormatMs(timer.remainingMs) : ccCompactLabel(timer.elapsedLabel);
}
function ccImportance(value: TodoImportance) { return value === "high" ? "高优先" : value === "medium" ? "普通" : "低优先"; }
function ClutchHeader(props: { eyebrow: string; title: string; description: string; trailing?: any }) {
  return <header class="cc-page-head"><div><span class="cc-eyebrow">{props.eyebrow}</span><h1>{props.title}</h1><p>{props.description}</p></div><div class="cc-page-head__trailing">{props.trailing}</div></header>;
}
function Scoreboard(props: { points: number; timer: TimerSnapshot; streak: number; status: string; featured?: boolean; clockLabel?: string }) {
  const clock = () => props.clockLabel ?? (props.timer.modeKey === "countdown" && props.timer.remainingMs !== null
    ? ccFormatMs(props.timer.remainingMs)
    : ccCompactLabel(props.timer.elapsedLabel));
  return <section classList={{ "cc-scoreboard": true, "cc-scoreboard--featured": Boolean(props.featured) }} aria-label="今日记分牌"><div><span>今日得分</span><strong>{String(props.points).padStart(2, "0")}</strong><small>已完成事项</small></div><div><span>当前回合　/　实际计时</span><strong>{props.featured ? <><span>第 {Math.max(1, props.timer.currentRound)} 回合</span><b>{clock()}</b></> : `第 ${Math.max(1, props.timer.currentRound)} 回合　·　${clock()}`}</strong><small>{props.status}</small></div><div><span>连续专注</span><strong>{props.streak}<small> 天</small></strong><small>专注节奏</small></div></section>;
}
type ButlerCardVariant = "today" | "focus" | "playbook";

function ButlerCard(props: { variant: ButlerCardVariant }) {
  const today = () => props.variant === "today";
  const focus = () => props.variant === "focus";
  const playbook = () => props.variant === "playbook";
  const image = () => today()
    ? "/theme-assets/jimmy-butler-cutout.png"
    : focus()
      ? "/theme-assets/jimmy-butler-focus-action.png"
      : "/theme-assets/jimmy-butler-playbook-sideline.png";
  const label = () => today()
    ? "Jimmy Butler 赛场海报"
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
    <img src={image()} alt="Jimmy Butler 风格人物视觉" />
    <Show when={today()} fallback={<div><span>JIMMY BUTLER　·　#22</span><strong>CLUTCH MODE</strong><small>关键时刻，专注打好眼前这一球。</small></div>}>
      <div><span>JIMMY<br />BUTLER</span><strong>CLUTCH MODE</strong><b>22</b><small>关键时刻，专注打好这一回合。</small></div>
    </Show>
  </aside>;
}

export function ClutchCourtToday(props: TodaySurfaceProps) {
  const rounds = createMemo(() => {
    const all = [...props.todayCompletedTodos(), ...props.todayTodos()];
    const ids = new Set(all.map((todo) => todo.id));
    for (const todo of props.planTodos()) if (!ids.has(todo.id)) { all.push(todo); ids.add(todo.id); }
    return all.slice(0, 5);
  });
  const next = createMemo(() => props.currentTodo() ?? props.nextTodo() ?? rounds().find((todo) => !todo.isCompleted) ?? null);
  const status = createMemo(() => ccStatus(props.timer(), props.timerHasProgress()));
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const clock = createMemo(() => props.timer().modeKey === "countdown"
    ? ccClock(props.timer(), props.defaultFocusMinutes(), false)
    : ccCompactLabel(props.timer().elapsedLabel));
  const play = () => props.timer().isRunning ? props.onPause() : props.timerHasProgress() ? props.onContinue() : next() ? props.onStartTodo(next()!) : props.onOpenTodos();
  return <section class="cc-page cc-today-page" aria-label="今日赛场">
    <div class="cc-today-hero">
      <div class="cc-home-manifest"><span>CLUTCH MOMENT</span><p>把注意力放在当下，<br />每一节都是新的开始。</p><small>HOME COURT　·　2026 SEASON</small></div>
      <Scoreboard featured clockLabel={clock()} points={props.todayCompletedTodos().length} timer={props.timer()} streak={streak()} status={status()} />
      <div class="cc-home-hero-note"><strong>FOCUS BUILDS A BETTER YOU</strong><span>专注打好眼前这一回合。</span></div>
      <ButlerCard variant="today" />
    </div>
    <div class="cc-home-court">
      <div class="cc-court-lines" aria-hidden="true"><span class="cc-halfway" /><span class="cc-center-circle" /><span class="cc-left-key" /><span class="cc-right-key" /><span class="cc-left-hoop" /><span class="cc-right-hoop" /><span class="cc-three-left" /><span class="cc-three-right" /><span class="cc-basketball-art" /></div>
      <svg class="cc-play-arrows" viewBox="0 0 1487 683" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="cc-possession-arrow" viewBox="0 0 10 8" refX="8" refY="4" markerWidth="10" markerHeight="8" orient="auto"><path d="M 1 1 L 8 4 L 1 7" /></marker></defs>
        <path d="M 376 140 C 388 171, 423 187, 466 181" />
        <path d="M 800 181 C 838 197, 877 177, 898 146" />
        <path d="M 340 515 C 370 535, 410 531, 450 520" />
        <path d="M 898 514 C 927 537, 967 548, 1002 557" />
      </svg>
      <div class="cc-court-notes" aria-hidden="true">
        <span class="cc-court-note cc-court-note--opening">好的开始，<br />赢下半场！</span>
        <span class="cc-court-note cc-court-note--breakthrough">下一回合，<br />专注突破！</span>
        <span class="cc-court-note cc-court-note--steady">稳住节奏，<br />命中这一球！</span>
        <span class="cc-court-note cc-court-note--detail">细节决定胜负！<br /><b>KEEP GOING!</b></span>
      </div>
      <div class="cc-court-title"><span>CLUTCH</span><h1>MOMENT</h1><p>专注成就更好的自己。</p></div>
      <div class="cc-center-clock"><span>当前回合　/　实际计时</span><strong>{clock()}</strong><small>{props.timer().activeTaskTitle || next()?.title || "等待布置第一回合"}</small><span class="cc-clock-status">{status()}</span><button type="button" class="cc-lime-button" disabled={props.busy()} onClick={() => void play()}>{props.timer().isRunning ? "Ⅱ　暂停专注" : props.timerHasProgress() ? "▶　继续专注" : next() ? "▶　开始专注" : "布置第一回合"}</button></div>
      <div class="cc-round-markers" aria-label="今日回合">
        <For each={Array.from({ length: 5 }, (_, index) => rounds()[index] ?? null)}>
          {(todo, index) => <Show when={todo} fallback={<div class="cc-round-marker empty" aria-hidden="true"><i>{String(index() + 1).padStart(2, "0")}</i><span class="cc-round-marker__copy"><strong>开放回合</strong><small>等待布置</small></span></div>}>
            <button
              type="button"
              classList={{ "cc-round-marker": true, done: todo?.isCompleted, current: todo?.id === next()?.id }}
              aria-label={`第 ${index() + 1} 回合：${todo?.title}，${todo?.isCompleted ? "已完成" : todo?.id === next()?.id ? "当前回合" : "待开始"}`}
              disabled={props.busy() || todo?.isCompleted || props.timerHasProgress()}
              onClick={() => props.onStartTodo(todo!)}
            >
              <i>{String(index() + 1).padStart(2, "0")}</i>
              <span class="cc-round-marker__copy">
                <strong>{todo?.title}</strong>
                <small>{todo?.scheduledTime || (todo?.scheduledDate ? "已安排" : "未安排")}</small>
                <em>{todo?.isCompleted ? "已完成" : todo?.id === next()?.id ? "当前回合" : "待开始"}</em>
              </span>
            </button>
          </Show>}
        </For>
      </div>
      <div class="cc-shotclock-badge" aria-label="主题铭牌 24 SEC，不是实际计时">24 <small>SEC<br />THEME PLATE</small></div>
    </div>
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
    <Scoreboard featured clockLabel={display()} points={props.todaySessionCount()} timer={props.timer()} streak={props.currentStreakDays()} status={ccStatus(props.timer(), props.timerHasProgress())} />
    <ClutchHeader eyebrow="GAME CLOCK　/　FOCUS SESSION" title="关键时刻 · 专注计时" description="把这一回合打完整，暂停与继续都由你掌控。" trailing={<span class="cc-quarter-badge">第 {Math.max(1, props.timer().currentRound)} 回合　/　{ccStatus(props.timer(), props.timerHasProgress())}</span>} />
    <div class="cc-timer-layout">
      <ButlerCard variant="focus" />
      <section class="cc-court-dial" aria-label="专注计时盘">
        <div class="cc-center-circle cc-center-circle--timer">
          <span>FOCUS CLOCK　/　{props.timer().mode}</span>
          <strong>{display()}</strong>
          <small>{props.timer().activeTaskTitle || props.sessionTitle().trim() || "当前专注回合"}　·　今日第 {Math.max(1, props.timer().currentRound)} 回合</small>
          <button type="button" class="cc-lime-button" disabled={actionDisabled()} onClick={() => void runPrimaryAction()}>{actionLabel()}</button>
          <span class="cc-possession-dots" aria-hidden="true"><i class="active" /><i /><i /><i /></span>
        </div>
      </section>
      <aside class="cc-tactics-board">
        <div class="cc-chalk-label">LOCKER ROOM　/　战术板</div>
        <h2>本回合布置</h2>
        <label>专注任务<input name="clutchSessionTitle" value={props.sessionTitle()} placeholder="输入本回合目标" disabled={locked()} onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label>
        <label>关联待办<select name="clutchLinkedTodo" value={props.linkedTodoId() ?? ""} disabled={locked()} onChange={(event) => linkedChange(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
        <Show when={linked()}>{(todo) => <small class="cc-linked-note">当前战术连接：{todo().title}</small>}</Show>
        <div class="cc-mode-switch" role="group" aria-label="计时模式"><button type="button" classList={{ active: props.timer().modeKey !== "countdown" }} disabled={locked()} onClick={() => void props.onChangeMode("stopwatch")}>正向计时</button><button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={locked()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button></div>
        <Show when={props.timer().modeKey === "countdown"}><label>目标时长（分钟）<input type="number" min="1" max="720" value={props.countdownMinutes()} disabled={locked()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /></label></Show>
        <label class="cc-check"><input type="checkbox" checked={props.completeLinkedTodo()} disabled={locked() || !props.linkedTodoId()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} />完成时同步标记关联待办</label>
        <div class="cc-timer-actions">
          <button type="button" class="cc-secondary-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}>完成并记录</button>
          <button type="button" class="cc-secondary-button" disabled={props.busy() || !props.ready()} onClick={() => void props.onReset()}><RotateCcw size={14} />重置</button>
        </div>
        <Show when={props.savedConfirmation()}><p class="cc-confirm" role="status">本回合已写入 box score。</p></Show>
        <div class="cc-tactics-actions"><button type="button" disabled={props.busy()} onClick={() => void props.onOpenRecords()}>查看 box score</button></div>
        <small>24 SEC 是球场主题铭牌，不是实际递减计时。</small>
      </aside>
    </div>
    <footer class="cc-page-footer"><span>今日完成 {props.todaySessionCount()} 回合</span><span>每一回合只记录真实投入时间</span><Show when={props.timerHasProgress()}><button type="button" onClick={() => void props.onShowFocusFloating()}>打开迷你工作台</button></Show></footer>
  </section>;
}

function CcTodoRow(props: { item: TodoItem; surface: TodoSurfaceProps; number: number; lane: string }) {
  const overdue = () => props.surface.overdueTodos().some((item) => item.id === props.item.id);
  const state = () => overdue() ? "已过期" : props.item.isCompleted ? "已记录" : props.lane;
  return (
    <article classList={{ "cc-task-row": true, complete: props.item.isCompleted, overdue: overdue() }}>
      <Show
        when={props.surface.editingTodo()?.id !== props.item.id}
        fallback={<span class="cc-jersey" aria-hidden="true">{String(props.number).padStart(2, "0")}</span>}
      >
        <button type="button" class="cc-jersey cc-task-check" aria-label={(props.item.isCompleted ? "恢复 " : "完成 ") + props.item.title} disabled={props.surface.busy()} onClick={() => props.surface.onToggle(props.item.id)}>
          {String(props.number).padStart(2, "0")}
        </button>
      </Show>
      <Show
        when={props.surface.editingTodo()?.id === props.item.id}
        fallback={
          <>
            <div><strong>{props.item.title}</strong><small>{props.surface.formatTodoDue(props.item)}　·　{ccImportance(props.item.importanceKey)}</small></div>
            <span class="cc-task-state">{state()}</span>
            <div class="cc-task-actions">
              <button type="button" disabled={props.surface.busy() || props.surface.timerHasProgress()} onClick={() => props.surface.onUseForFocus(props.item)}>开始</button>
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
  const [formOpen, setFormOpen] = createSignal(false);
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
    <section class="cc-page cc-todos-page" aria-label="战术板待办">
      <ClutchHeader
        eyebrow="PLAYBOOK　/　06 POSSESSIONS"
        title="把待办排成回合"
        description="今日战术清楚，下一回合就知道往哪里跑。"
        trailing={
          <div class="cc-todos-header-actions">
            <ButlerCard variant="playbook" />
            <button type="button" class="cc-orange-button" onClick={() => setFormOpen((open) => !open)}>
              <Plus size={16} />{formOpen() ? "收起新回合" : "布置新回合"}
            </button>
          </div>
        }
      />
      <Show when={formOpen()}>
        <form class="cc-create-play" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); setFormOpen(false); }}>
          <span class="cc-chalk-label">NEW PLAY　/　布置新回合</span>
          <label>任务名称<input name="clutchTodoTitle" value={props.todoTitle()} placeholder="写下这一回合的任务" required onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /></label>
          <label>安排日期<input type="date" name="clutchTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /></label>
          <label>开始时间<input type="time" name="clutchTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /></label>
          <label>优先级<select name="clutchTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高</option><option value="medium">普通</option><option value="low">低</option></select></label>
          <button type="submit" class="cc-lime-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "确认布置"}</button>
        </form>
      </Show>
      <div class="cc-playbook-grid">
        <section class="cc-lane cc-lane--current">
          <header><span>01　CURRENT</span><h2>本场战术</h2><b>{currentPlay().length}</b></header>
          <Show when={currentPlay().length} fallback={<p class="cc-empty">今天还没有回合。布置一个新回合开始比赛。</p>}>
            <For each={currentPlay()}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} lane={item.id === currentId() ? "进行中" : "待开始"} />}</For>
          </Show>
          <footer>点击当前战术开始专注　·　今日完成 {props.todayCompletedTodos().length} / {todays().length}</footer>
        </section>
        <section class="cc-lane cc-lane--warmup">
          <header><span>02　ON DECK</span><h2>热身准备</h2><b>{upcoming().length + props.overdueTodos().length}</b></header>
          <Show when={upcoming().length + props.overdueTodos().length} fallback={<p class="cc-empty">当前没有待发、未安排或过期事项。</p>}>
            <For each={[...props.overdueTodos(), ...upcoming()]}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} lane={props.overdueTodos().some((todo) => todo.id === item.id) ? "已过期" : item.scheduledDate ? "待开始" : "未安排"} />}</For>
          </Show>
          <footer>替补席　·　未安排事项与过期回合都在此保留</footer>
        </section>
        <section class="cc-lane cc-lane--made">
          <header><span>03　MADE</span><h2>已命中</h2><b>{props.completedTodos().length}</b></header>
          <Show when={props.completedTodos().length} fallback={<p class="cc-empty">完成事项后，它会记入 box score。</p>}>
            <For each={props.completedTodos()}>{(item) => <CcTodoRow item={item} surface={props} number={roundNumber(item)} lane="已记录" />}</For>
          </Show>
          <footer>完成数只统计已完成事项，不生成虚假比分</footer>
        </section>
      </div>
      <footer class="cc-page-footer">
        <span>未安排 {props.todos().filter((item) => !item.isCompleted && !item.scheduledDate).length}</span>
        <span>未来 {futureCount()}</span>
        <span>过期 {props.overdueTodos().length}</span>
        <span>替补席保留临时任务</span>
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
  const bands = [{ name: "上午", start: 5, end: 11 }, { name: "午后", start: 11, end: 17 }, { name: "傍晚", start: 17, end: 21 }, { name: "夜间", start: 21, end: 29 }];
  return bands.map((band) => ({ ...band, ms: records.filter((record) => { const hour = Number.parseInt(ccRecordTime(record), 10); return Number.isFinite(hour) && hour >= band.start && hour < band.end; }).reduce((total, record) => total + record.durationMs, 0) }));
}
export function ClutchCourtRecords(props: RecordsSurfaceProps) {
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const days = createMemo(() => props.archiveDays().slice(-7));
  const geometry = createMemo(() => buildWeeklyChartGeometry(days()));
  const total = createMemo(() => selectedRecords().reduce((sum, record) => sum + record.durationMs, 0));
  const sessions = createMemo(() => props.analytics()?.sessionCount ?? props.records().length);
  const avg = createMemo(() => sessions() > 0 ? ccCompactDuration((props.analytics()?.totalFocusDurationMs ?? total()) / sessions()) : "0m");
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
    <section class="cc-page cc-records-page" aria-label="比赛记录 box score">
      <ClutchHeader
        eyebrow="BOX SCORE　/　WEEKLY SHOT CHART"
        title="七日投篮图"
        description="按日期查看专注投入；这里记录时间，不虚构命中率或比赛比分。"
        trailing={
          <div class="cc-records-head-actions">
            <span>{props.formatRecordDay(selectedDate())}<small>{dateRange()}</small></span>
            <button type="button" class="cc-secondary-button" onClick={() => props.onSelectDate(latest())}>回到最近</button>
          </div>
        }
      />
      <section class="cc-boxscore">
        <div><div><span>FOCUS TOTAL</span><small>累计专注</small></div><strong>{((props.analytics()?.totalFocusDurationMs ?? props.recentWeekDurationMs()) / 3_600_000).toFixed(1)}h</strong></div>
        <div><div><span>SESSIONS</span><small>记录段数</small></div><strong>{sessions()}</strong></div>
        <div><div><span>AVG. SESSION</span><small>平均时长</small></div><strong>{avg()}</strong></div>
        <div><div><span>STREAK</span><small>连续专注</small></div><strong>{props.analytics()?.currentStreakDays ?? 0} 天</strong></div>
      </section>
      <div class="cc-records-overview-grid">
        <section class="cc-shot-chart">
          <div class="cc-panel-heading"><span>七日投篮图</span><span>每个点与日期使用同一坐标</span></div>
          <div class="cc-chart" role="group" aria-label="最近七日专注时长">
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
          <div class="cc-panel-heading"><span>{props.formatRecordDay(selectedDate())}　·　当日比赛日志</span><span>{selectedRecords().length} 段　/　{props.formatDurationMs(total())}</span></div>
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
        <div class="cc-panel-heading"><span>全部 box score　/　完整历史</span><strong>{props.records().length} 条记录</strong></div>
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
