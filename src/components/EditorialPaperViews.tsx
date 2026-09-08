import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleCheck,
  Clock3,
  Plus,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
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

function formatPreviewMinutes(value: number) {
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function focusDisplayTime(snapshot: TimerSnapshot, countdownMinutes: number, countdownDraftDirty: boolean) {
  if (snapshot.modeKey === "countdown" && countdownDraftDirty) {
    return formatPreviewMinutes(countdownMinutes);
  }
  if (snapshot.modeKey === "countdown" && snapshot.elapsedLabel.startsWith("00:")) {
    return snapshot.elapsedLabel.slice(3);
  }
  return snapshot.elapsedLabel;
}

function timerProgress(snapshot: TimerSnapshot, hasProgress: boolean) {
  if (!hasProgress) {
    return 0;
  }
  if (snapshot.modeKey === "countdown" && snapshot.targetDurationMs && snapshot.remainingMs !== null) {
    return Math.min(1, Math.max(0, 1 - snapshot.remainingMs / snapshot.targetDurationMs));
  }
  return Math.min(1, Math.max(0, snapshot.elapsedMs / Math.max(snapshot.targetDurationMs ?? 45 * 60 * 1000, 45 * 60 * 1000)));
}

function formatRecordTime(record: FocusRecord) {
  return record.completedTime ? `${record.completedDate} · ${record.completedTime}` : record.completedDate;
}

function analyticsValue(analytics: AnalyticsSnapshot | null, key: keyof AnalyticsSnapshot, fallback: string) {
  const value = analytics?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

export function EditorialPaperToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const completionCount = createMemo(() => props.todayCompletedTodos().length);
  const totalTodayCount = createMemo(() => completionCount() + props.todayTodos().length);
  const timerLabel = createMemo(() => {
    const snapshot = props.timer();
    if (snapshot.isRunning) {
      return "正在专注";
    }
    return props.timerHasProgress() ? "已暂停" : "准备开始";
  });

  return (
    <section class="ep-page ep-today-page" aria-label="今日节奏">
      <header class="ep-page-header ep-today-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / DAILY FIELD NOTES</span><time>{props.todayLabel}</time></div>
        <div class="ep-heading-row">
          <div>
            <span class="ep-kicker">DAILY PLAN · VOL. 0905</span>
            <h1>今日节奏</h1>
            <p>把注意力放在真正重要的事上，时间会给出回应。</p>
          </div>
          <div class="ep-stamp" aria-label={`连续 ${streak()} 天`}>
            <span>连续</span>
            <strong>{streak()}</strong>
            <span>日</span>
          </div>
        </div>
      </header>

      <div class="ep-today-grid">
        <section class="ep-paper ep-field-sheet" aria-labelledby="ep-field-sheet-title">
          <div class="ep-sheet-topline">
            <span id="ep-field-sheet-title">FIELD NOTE / {props.todayDate.replace(/-/g, ".")}</span>
            <strong>{completionCount()} / {totalTodayCount()} DONE</strong>
          </div>
          <div class="ep-field-list">
            <Show when={props.ready()} fallback={<p class="ep-empty">正在读取今天的节奏…</p>}>
              <For each={props.todayTodos()}>
                {(item, index) => (
                  <button
                    type="button"
                    class="ep-field-row"
                    disabled={props.busy() || props.timerHasProgress()}
                    onClick={() => props.onUseTodo(item)}
                  >
                    <span class="ep-field-row__index">{String(index() + 1).padStart(2, "0")}</span>
                    <span class="ep-field-row__copy"><strong>{item.title}</strong><small>{props.formatTodoDue(item)}</small></span>
                    <span class="ep-field-row__tag">{props.importanceLabel(item.importanceKey)}</span>
                    <span class="ep-field-row__mark" aria-label="待开始">○</span>
                  </button>
                )}
              </For>
              <Show when={props.todayTodos().length === 0}>
                <p class="ep-empty">今天还没有待办，先写下一件要完成的事。</p>
              </Show>
            </Show>
          </div>
          <Show when={props.todayCompletedTodos().length > 0}>
            <div class="ep-completed-notes">
              <span class="ep-section-label">已完成的页签</span>
              <For each={props.todayCompletedTodos().slice(0, 4)}>
                {(item) => <span><CircleCheck size={15} strokeWidth={1.6} aria-hidden="true" />{item.title}</span>}
              </For>
            </div>
          </Show>
          <div class="ep-sheet-footer"><span>先做最重要的三件事。</span><span>少而精 &gt; 多而杂</span></div>
        </section>

        <aside class="ep-next-card" aria-label="下一件专注">
          <div class="ep-card-corner ep-card-corner--tl" /><div class="ep-card-corner ep-card-corner--br" />
          <span class="ep-card-label">下一页 / NEXT PAGE</span>
          <Show
            when={props.nextTodo()}
            fallback={<><h2>留白也有意义</h2><p>添加一件待办，就能从这里开始下一页。</p><button type="button" class="ep-paper-button" onClick={props.onOpenTodos}>整理待办 <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" /></button></>}
          >
            {(item) => <>
              <h2>{item().title}</h2>
              <span class="ep-next-card__duration">预计 <strong>{props.defaultFocusMinutes()}</strong> 分钟</span>
              <p>{props.formatTodoDue(item())}</p>
              <button type="button" class="ep-paper-button ep-paper-button--green" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item())}>开始专注 <ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" /></button>
            </>}
          </Show>
          <div class="ep-next-card__seal"><span>FOCUSED</span><strong>MOMENT</strong><i /></div>
        </aside>
      </div>

      <section class="ep-today-timer-strip" aria-label="当前计时">
        <div class="ep-timer-strip__status"><span classList={{ "ep-live-dot": true, "is-running": props.timer().isRunning }} /> <span>{timerLabel()}</span><strong>{props.timer().elapsedLabel}</strong></div>
        <div class="ep-timer-strip__actions">
          <Show when={props.timer().isRunning} fallback={<button type="button" class="ep-text-button" disabled={props.busy() || !props.timerCanContinue() && !props.nextTodo()} onClick={props.timerHasProgress() ? props.onContinue : props.onStartNext}>{props.timerHasProgress() ? "继续专注" : "开始下一件事"}</button>}>
            <button type="button" class="ep-text-button" disabled={props.busy()} onClick={props.onPause}>暂停</button>
          </Show>
          <button type="button" class="ep-text-button" disabled={props.busy() || !props.timerHasProgress()} onClick={props.onFinish}>完成并记录</button>
        </div>
      </section>

      <footer class="ep-facts-row">
        <div><span>今日专注</span><strong>{analyticsValue(props.analytics(), "todayFocusDurationLabel", "0 分钟")}</strong></div>
        <div><span>完成段数</span><strong>{analyticsValue(props.analytics(), "todaySessionCount", "0")}</strong></div>
        <div><span>当前步调</span><strong>{streak()} 日连续</strong></div>
        <div class="ep-facts-row__actions"><button type="button" class="ep-text-button" onClick={props.onOpenRecords}><BookOpen size={15} strokeWidth={1.6} aria-hidden="true" />回看记录</button><button type="button" class="ep-text-button" onClick={props.onOpenTodos}>打开待办</button></div>
      </footer>
    </section>
  );
}

export function EditorialPaperFocus(props: NightValleyFocusProps) {
  const displayTime = createMemo(() => focusDisplayTime(props.timer(), props.countdownMinutes(), props.countdownDraftDirty()));
  const progress = createMemo(() => timerProgress(props.timer(), props.timerHasProgress()));
  const currentTodo = createMemo(() => props.todos().find((item) => item.id === props.linkedTodoId()) ?? null);

  function handleLinkedTodoChange(value: string) {
    const id = value ? Number(value) : null;
    const item = props.todos().find((todo) => todo.id === id);
    props.onLinkedTodoChange(id);
    props.onSessionTitleDirty();
    if (item) {
      props.onSessionTitleChange(item.title);
    }
  }

  return (
    <section class="ep-page ep-focus-page" aria-label="专注时刻">
      <header class="ep-page-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / FOCUS CARD</span><span>02 / 05</span></div>
        <span class="ep-kicker">A GENTLE APPOINTMENT WITH ATTENTION</span>
        <h1>专注时刻</h1>
        <p>给眼前这一段完整的注意力。</p>
      </header>

      <div class="ep-focus-layout">
        <aside class="ep-note-stack ep-note-stack--left">
          <div class="ep-taped-note ep-taped-note--ochre"><span>当前状态</span><strong>{props.timer().isRunning ? "进行中" : props.timerHasProgress() ? "已暂停" : "准备开始"}</strong><small>{props.timer().phaseLabel}</small></div>
          <div class="ep-taped-note ep-taped-note--sage"><span>今日专注</span><strong>{props.todos().filter((item) => item.isCompleted).length} 项完成</strong><small>每一段都算数</small></div>
        </aside>

        <section class="ep-clock-card" aria-label="计时器">
          <div class="ep-clock-card__ring" style={`--ep-progress: ${progress() * 100}%;`}>
            <div class="ep-clock-card__tick ep-clock-card__tick--top" /><div class="ep-clock-card__tick ep-clock-card__tick--right" /><div class="ep-clock-card__tick ep-clock-card__tick--bottom" /><div class="ep-clock-card__tick ep-clock-card__tick--left" />
            <div class="ep-clock-card__readout"><span>{props.timer().status}</span><strong>{displayTime()}</strong><small>{props.timer().modeKey === "countdown" ? `设定 ${props.countdownMinutes()} 分钟` : "正向计时 · 保持节奏"}</small></div>
          </div>
          <div class="ep-clock-card__mode" role="group" aria-label="计时模式">
            <button type="button" classList={{ active: props.timer().modeKey === "stopwatch" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("stopwatch")}>正向计时</button>
            <button type="button" classList={{ active: props.timer().modeKey === "countdown" }} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onClick={() => void props.onChangeMode("countdown")}>倒计时</button>
          </div>
          <Show when={props.timer().modeKey === "countdown"}>
            <label class="ep-inline-field"><span>专注时长</span><input type="number" name="editorialCountdownMinutes" min="1" max="720" value={props.countdownMinutes()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onCountdownDraftDirty(); props.onCountdownMinutesChange(Number(event.currentTarget.value || 0)); }} /><em>分钟</em></label>
          </Show>
          <div class="ep-clock-card__actions">
            <Show when={props.timer().isRunning} fallback={<button type="button" class="ep-primary-button" disabled={props.busy() || !props.ready() || props.timer().isRunning || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}>{props.busy() ? props.busyLabel() : "开始专注"}</button>}>
              <button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onPause()}>{props.busy() ? props.busyLabel() : "暂停"}</button>
            </Show>
            <button type="button" class="ep-secondary-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}>{props.busy() && props.canFinish() ? props.busyLabel() : "完成并记录"}</button>
            <button type="button" class="ep-text-button" disabled={props.busy() || !props.timerHasProgress()} onClick={() => void props.onReset()}><RotateCcw size={14} strokeWidth={1.6} aria-hidden="true" />重置</button>
          </div>
          <Show when={props.savedConfirmation()}><p class="ep-inline-confirmation" role="status"><CircleCheck size={15} strokeWidth={1.7} aria-hidden="true" />这一段已经收进记录。</p></Show>
        </section>

        <aside class="ep-focus-notes">
          <div class="ep-note-paper"><span class="ep-section-label">FOCUS NOTE / 本次专注图</span><label><span>我想专注于…</span><input type="text" name="editorialSessionTitle" value={props.sessionTitle()} placeholder="写下这一页的主题" disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label><label><span>关联待办</span><select name="editorialLinkedTodo" value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => handleLinkedTodoChange(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(item) => <option value={item.id}>{item.title}</option>}</For></select></label><Show when={currentTodo()}><p class="ep-note-paper__linked"><Check size={14} strokeWidth={1.8} aria-hidden="true" />{currentTodo()?.title}</p></Show><label class="ep-check-label"><input type="checkbox" name="editorialCompleteLinkedTodo" checked={props.completeLinkedTodo()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>本轮完成后同时标记关联待办</span></label></div>
          <div class="ep-mini-note"><span>下一次休息</span><strong>{props.timerPreferences().pomodoroBreakMinutes} 分钟</strong><small>让节奏留下余地。</small></div>
        </aside>
      </div>

      <footer class="ep-focus-footer"><span><Clock3 size={15} strokeWidth={1.6} aria-hidden="true" />{props.timerCanContinue() ? "可以继续回来" : "准备好时，从这里开始"}</span><span>FOCUSED MOMENT · FM-2026</span><span>{props.timer().activeTaskTitle || "一段完整的注意力"}</span></footer>
    </section>
  );
}

interface EditorialTodoRowProps {
  item: TodoItem;
  editingTodo: NightValleyTodoProps["editingTodo"];
  busy: NightValleyTodoProps["busy"];
  timerHasProgress: NightValleyTodoProps["timerHasProgress"];
  onToggle: NightValleyTodoProps["onToggle"];
  onBeginEdit: NightValleyTodoProps["onBeginEdit"];
  onUseForFocus: NightValleyTodoProps["onUseForFocus"];
  onRemove: NightValleyTodoProps["onRemove"];
  onPatch: NightValleyTodoProps["onPatch"];
  onSave: NightValleyTodoProps["onSave"];
  onCancel: NightValleyTodoProps["onCancel"];
  formatTodoDue: NightValleyTodoProps["formatTodoDue"];
  importanceLabel: NightValleyTodoProps["importanceLabel"];
}

function EditorialTodoRow(props: EditorialTodoRowProps) {
  return (
    <article class="ep-todo-row">
      <Show
        when={props.editingTodo()?.id === props.item.id}
        fallback={<>
          <button type="button" class="ep-todo-check" aria-label={`标记“${props.item.title}”完成`} disabled={props.busy()} onClick={() => props.onToggle(props.item.id)}><Show when={props.item.isCompleted}><Check size={13} strokeWidth={2} aria-hidden="true" /></Show></button>
          <div class="ep-todo-row__copy"><strong title={props.item.title}>{props.item.title}</strong><small>{props.formatTodoDue(props.item)} · {props.importanceLabel(props.item.importanceKey)}</small></div>
          <div class="ep-todo-row__actions"><button type="button" class="ep-text-button" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button><button type="button" class="ep-text-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(props.item)}>专注</button><button type="button" class="ep-text-button ep-text-button--danger" disabled={props.busy()} onClick={() => void props.onRemove(props.item.id)}>删除</button></div>
        </>}
      >
        <div class="ep-todo-edit-grid"><label><span>事项</span><input type="text" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /></label><label><span>日期</span><input type="date" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /></label><label><span>时间</span><input type="time" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /></label><label><span>重要度</span><select value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoImportance })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label><div><button type="button" class="ep-primary-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="ep-text-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div></div>
      </Show>
    </article>
  );
}

export function EditorialPaperTodos(props: NightValleyTodoProps) {
  const [createOpen, setCreateOpen] = createSignal(true);
  const focusTodoId = createMemo(() => props.timer().linkedTodoId);
  const startItems = createMemo(() => props.activeTodos().filter((item) => item.id !== focusTodoId()));
  const focusItems = createMemo(() => props.activeTodos().filter((item) => item.id === focusTodoId()));
  const completionPercent = createMemo(() => props.todos().length === 0 ? 0 : Math.round((props.completedTodos().length / props.todos().length) * 100));

  const rowProps = {
    editingTodo: props.editingTodo,
    busy: props.busy,
    timerHasProgress: props.timerHasProgress,
    onToggle: props.onToggle,
    onBeginEdit: props.onBeginEdit,
    onUseForFocus: props.onUseForFocus,
    onRemove: props.onRemove,
    onPatch: props.onPatch,
    onSave: props.onSave,
    onCancel: props.onCancel,
    formatTodoDue: props.formatTodoDue,
    importanceLabel: props.importanceLabel,
  } satisfies Omit<EditorialTodoRowProps, "item">;

  return (
    <section class="ep-page ep-todos-page" aria-label="待办清单">
      <header class="ep-page-header ep-todos-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / FIELD NOTES</span><span>03 / 05</span></div>
        <span class="ep-kicker">SORT THE NOISE INTO A NEXT STEP</span>
        <h1>待办清单</h1>
        <p>把杂乱的念头整理成下一步。</p>
      </header>

      <div class="ep-todo-toolbar"><div><span>今日完成</span><strong>{props.completedTodos().length}</strong><span>项 · 待处理 <b>{props.activeTodos().length}</b> 项</span></div><button type="button" class="ep-paper-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} strokeWidth={1.6} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.6} aria-hidden="true" />}{createOpen() ? "收起" : "新增待办"}</button></div>

      <Show when={createOpen()}>
        <form class="ep-create-paper" onSubmit={(event) => { event.preventDefault(); void props.onAddTodo(); }}>
          <span class="ep-section-label">NEW FIELD NOTE</span>
          <label><span>写下一件事</span><input type="text" name="editorialTodoTitle" value={props.todoTitle()} placeholder="给大脑一个落点…" onInput={(event) => props.onTodoTitleChange(event.currentTarget.value)} /></label>
          <label><span>截止日期</span><input type="date" name="editorialTodoDate" value={props.todoDueDate()} onChange={(event) => props.onTodoDueDateChange(event.currentTarget.value)} /></label>
          <label><span>时间</span><input type="time" name="editorialTodoTime" value={props.todoDueTime()} onInput={(event) => props.onTodoDueTimeChange(event.currentTarget.value)} /></label>
          <label><span>重要度</span><select name="editorialTodoImportance" value={props.todoImportance()} onChange={(event) => props.onTodoImportanceChange(event.currentTarget.value as TodoImportance)}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
          <button type="submit" class="ep-primary-button" disabled={props.busy()}>{props.busy() ? props.busyLabel() : "保存这一页"}</button>
        </form>
      </Show>

      <div class="ep-todo-book">
        <section class="ep-todo-column ep-todo-column--today"><header><span>01 / TODAY</span><h2>今天</h2><strong>{startItems().length}</strong></header><div class="ep-todo-column__list"><Show when={props.ready()} fallback={<p class="ep-empty">正在读取…</p>}><For each={startItems()}>{(item) => <EditorialTodoRow item={item} {...rowProps} />}</For><Show when={startItems().length === 0}><p class="ep-empty">没有待开始事项。今天可以留一点空白。</p></Show></Show></div></section>
        <section class="ep-todo-column ep-todo-column--focus"><header><span>02 / FOCUS</span><h2>稍后</h2><strong>{focusItems().length}</strong></header><div class="ep-todo-column__list"><Show when={focusItems().length > 0} fallback={<div class="ep-empty-card"><Clock3 size={18} strokeWidth={1.5} aria-hidden="true" /><strong>还没有进行中的事项</strong><small>开始一段专注后，当前任务会留在这里。</small></div>}><For each={focusItems()}>{(item) => <EditorialTodoRow item={item} {...rowProps} />}</For></Show><Show when={props.overdueTodos().length > 0}><div class="ep-overdue-note"><span>已过期 / {props.overdueTodos().length}</span><For each={props.overdueTodos()}>{(item) => <EditorialTodoRow item={item} {...rowProps} />}</For></div></Show></div></section>
        <section class="ep-todo-column ep-todo-column--done"><header><span>03 / ARCHIVE</span><h2>已完成</h2><strong>{props.completedTodos().length}</strong></header><div class="ep-todo-column__list"><Show when={props.completedTodos().length > 0} fallback={<p class="ep-empty">完成一项后，它会留在这张纸上。</p>}><For each={props.completedTodos()}>{(item) => <EditorialTodoRow item={item} {...rowProps} />}</For></Show></div></section>
      </div>

      <footer class="ep-todo-footer"><div><span>今日完成度</span><strong>{completionPercent()}%</strong></div><div class="ep-todo-footer__meter"><span style={{ width: `${completionPercent()}%` }} /></div><span>FOCUS IS A CHOICE · KEEP BUILDING WHAT MATTERS</span></footer>
    </section>
  );
}

export function EditorialPaperRecords(props: NightValleyRecordsProps) {
  const initialVisibleRecordCount = 200;
  const analytics = createMemo(() => props.analytics());
  const maxDuration = createMemo(() => Math.max(1, ...props.archiveDays().map((day) => day.totalDurationMs)));
  const selectedDate = createMemo(() => props.selectedArchiveDay()?.date ?? props.selectedArchiveDate());
  const selectedRecords = createMemo(() => props.selectedArchiveRecords());
  const [visibleRecordCount, setVisibleRecordCount] = createSignal(initialVisibleRecordCount);
  const [expandedHistoryDate, setExpandedHistoryDate] = createSignal<string | null>(null);
  const visibleSelectedRecords = createMemo(() => selectedRecords().slice(0, visibleRecordCount()));

  createEffect(() => {
    const date = selectedDate();
    const records = selectedRecords();
    setVisibleRecordCount(initialVisibleRecordCount);
    setExpandedHistoryDate(records.length <= initialVisibleRecordCount ? date : null);
  });

  return (
    <section class="ep-page ep-records-page" aria-label="专注年鉴">
      <header class="ep-page-header ep-records-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / PERSONAL ARCHIVE</span><span>04 / 05</span></div>
        <span class="ep-kicker">RETURN TO THE RHYTHM YOU HAVE BUILT</span>
        <h1>专注年鉴</h1>
        <p>回看节奏，给下一页留下证据。</p>
      </header>

      <section class="ep-archive-paper" aria-label="最近七天统计">
        <div class="ep-archive-chart"><div class="ep-chart-heading"><span>近七日 / NATURAL DAYS</span><strong>{props.formatDurationMs(props.recentWeekDurationMs())}</strong></div><div class="ep-chart-bars"><For each={props.archiveDays()}>{(day) => <button type="button" classList={{ "ep-chart-bar": true, active: day.date === selectedDate() }} title={`${props.formatAnalyticsDate(day.date)} · ${day.totalDurationLabel}`} onClick={() => props.onSelectDate(day.date)}><span class="ep-chart-bar__value">{day.totalDurationLabel}</span><span class="ep-chart-bar__column"><i style={{ height: `${Math.max(4, (day.totalDurationMs / maxDuration()) * 100)}%` }} /></span><strong>{props.formatAnalyticsDate(day.date)}</strong></button>}</For></div></div>
        <div class="ep-archive-summary"><span class="ep-section-label">TODAY / {props.formatAnalyticsDate(selectedDate())}</span><strong>{analyticsValue(analytics(), "todayFocusDurationLabel", "0 分钟")}</strong><span>今日专注</span><div><span>完成段数</span><b>{analyticsValue(analytics(), "sessionCount", "0")}</b></div><div><span>连续</span><b>{analyticsValue(analytics(), "currentStreakDays", "0")} 日</b></div></div>
      </section>

      <section class="ep-records-spread">
        <div class="ep-records-list"><div class="ep-section-heading"><div><span class="ep-section-label">{props.formatAnalyticsDate(selectedDate())} · 节奏回顾</span><h2>每一段都留下痕迹</h2></div><button type="button" class="ep-text-button" onClick={() => props.onSelectDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? props.selectedArchiveDate())}>回到最近</button></div><Show when={selectedRecords().length > 0} fallback={<p class="ep-empty">这一天还没有专注记录。</p>}><For each={visibleSelectedRecords()}>{(record) => <article class="ep-record-entry"><span class="ep-record-entry__time">{record.completedTime}</span><span class="ep-record-entry__line" /><div><Show when={props.editingRecord()?.id === record.id} fallback={<><strong>{record.title}</strong><small>{record.durationLabel} · {record.modeLabel} · {formatRecordTime(record)}</small></>}><input type="text" aria-label="记录名称" value={props.editingRecord()?.title ?? ""} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void props.onSaveEdit(); if (event.key === "Escape") props.onCancelEdit(); }} /><div class="ep-record-entry__edit-actions"><button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onSaveEdit()}>保存</button><button type="button" class="ep-text-button" disabled={props.busy()} onClick={props.onCancelEdit}>取消</button></div></Show></div><Show when={props.editingRecord()?.id !== record.id}><span class="ep-record-entry__duration">{record.durationLabel}</span><div class="ep-record-entry__actions"><button type="button" class="ep-text-button" disabled={props.busy()} onClick={() => props.onBeginEdit(record)}>编辑</button><button type="button" class="ep-text-button ep-text-button--danger" disabled={props.busy()} onClick={() => void props.onRemove(record.id)}>删除</button></div></Show></article>}</For><Show when={visibleRecordCount() < selectedRecords().length}><button type="button" class="ep-records-load-more" onClick={() => setVisibleRecordCount((count) => Math.min(count + initialVisibleRecordCount, selectedRecords().length))}>继续展开记录 · 已显示 {visibleRecordCount()} / {selectedRecords().length}</button></Show></Show></div>
        <aside class="ep-insight-paper"><span class="ep-section-label">今日洞察 / FIELD NOTE</span><Show when={analytics()} fallback={<p>完成一段专注后，这里会出现可回看的事实。</p>}><p>你已经为今天留下 <strong>{analyticsValue(analytics(), "todayFocusDurationLabel", "0 分钟")}</strong> 的注意力。早上的输入会让下午的创作更稳定，晚上可以用下一段安静的回看收束今天。</p></Show><div class="ep-insight-signature">FOCUSED MOMENT<br /><small>FM-ARCHIVE / 2026</small></div></aside>
      </section>

      <section class="ep-full-history"><div class="ep-section-heading"><div><span class="ep-section-label">FULL INDEX / ALL RECORDS</span><h2>全部记录</h2></div><span>{props.records().length} 轮</span></div><Show when={props.ready() && props.records().length > 0} fallback={<p class="ep-empty">完成一次计时后，记录会显示在这里。</p>}><For each={props.recordGroups()}>{(group) => <details class="ep-history-day" open={expandedHistoryDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedHistoryDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedHistoryDate() === group.date}><div>{group.records.map((record) => <span>{record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
    </section>
  );
}

export function EditorialPaperSettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);

  return (
    <section class="ep-page ep-settings-page" aria-label="专注手册">
      <header class="ep-page-header ep-settings-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / PERSONAL MANUAL</span><span>05 / 05</span></div>
        <span class="ep-kicker">TUNE THE BOUNDARIES OF YOUR ATTENTION</span>
        <h1>你的专注手册</h1>
        <p>调整纸面之外，也调整注意力的边界。</p>
      </header>

      <div class="ep-settings-spread">
        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">01 / APPEARANCE</span><h2>外观样式</h2></div><SlidersHorizontal size={18} strokeWidth={1.4} aria-hidden="true" /></div><div class="ep-theme-swatches"><For each={themes}>{(theme) => <button type="button" classList={{ "ep-theme-swatch": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class={`ep-theme-swatch__paper ep-theme-swatch__paper--${theme.id}`} /><strong>{theme.name}</strong><small>{theme.implemented ? "可用" : "尚未实现"}</small></button>}</For></div><label class="ep-slider-row"><span>纸面亮度 <b>{props.visualIntensity()}%</b></span><input type="range" min="0" max="100" value={props.visualIntensity()} onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /></label><label class="ep-slider-row"><span>动效程度 <b>{props.motionIntensity()}%</b></span><input type="range" min="0" max="100" value={props.motionIntensity()} onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /></label><label class="ep-density-row"><span>界面密度</span><div><button type="button" classList={{ selected: props.density() === "roomy" }} onClick={() => props.onDensityChange("roomy")}>宽松</button><button type="button" classList={{ selected: props.density() === "compact" }} onClick={() => props.onDensityChange("compact")}>紧凑</button></div></label><div class="ep-live-preview"><span>当前样式预览</span><div class={`ep-live-preview__paper ep-live-preview__paper--${activeTheme().id}`}><strong>{activeTheme().name}</strong><small>{activeTheme().description}</small></div></div></section>

        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">02 / BEHAVIOR</span><h2>专注行为</h2></div><Settings size={18} strokeWidth={1.4} aria-hidden="true" /></div><div class="ep-setting-list"><label><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ toastReminderEnabled: event.currentTarget.checked })} /><span><strong>完成后自动回到下一段</strong><small>无缝衔接，保持节奏。</small></span></label><label><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ windowAttentionReminderEnabled: event.currentTarget.checked })} /><span><strong>结束时提醒我</strong><small>回顾本次专注收获。</small></span></label><label><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ soundReminderEnabled: event.currentTarget.checked })} /><span><strong>持续专注提醒</strong><small>长时间专注时轻柔提醒。</small></span></label></div><p class="ep-hand-note">边界清晰，节奏自然。</p></section>

        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">03 / SOUND</span><h2>声音与提示</h2></div><Volume2 size={18} strokeWidth={1.4} aria-hidden="true" /></div><label class="ep-select-row"><span>提醒音效</span><select name="editorialAlertSound" value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></label><div class="ep-sound-actions"><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} strokeWidth={1.6} aria-hidden="true" />试听</button><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入音效</button><Show when={props.customAlertSoundName()}><button type="button" class="ep-text-button" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>移除自定义</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></section>

        <section class="ep-settings-paper ep-settings-paper--shortcuts"><div class="ep-section-heading"><div><span class="ep-section-label">04 / SHORTCUTS</span><h2>快捷键</h2></div><Clock3 size={18} strokeWidth={1.4} aria-hidden="true" /></div><div class="ep-shortcut-list"><div><span>开始 / 继续</span><kbd>Ctrl</kbd><i>+</i><kbd>Enter</kbd></div><div><span>结束本段</span><kbd>Ctrl</kbd><i>+</i><kbd>Shift</kbd><i>+</i><kbd>E</kbd></div><div><span>命令面板</span><kbd>Ctrl</kbd><i>+</i><kbd>K</kbd></div></div></section>

        <section class="ep-settings-paper ep-settings-paper--backup"><div class="ep-section-heading"><div><span class="ep-section-label">05 / DATA</span><h2>数据与备份</h2></div><BookOpen size={18} strokeWidth={1.4} aria-hidden="true" /></div><p>待办、专注记录和未完成计时状态留在这台电脑上。</p><div class="ep-settings-actions"><button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开备份目录</button></div><Show when={props.lastBackupPath()}><p class="ep-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "loading"}><p class="ep-empty">正在读取备份列表…</p></Show><Show when={props.backupLoadState() === "error"}><div class="ep-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="ep-text-button" onClick={() => void props.onLoadBackups()}>重试读取</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="ep-select-row"><span>选择备份</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></label><button type="button" class="ep-secondary-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show><Show when={props.backupLoadState() === "ready" && props.backups().length === 0}><p class="ep-empty">还没有备份。建议在清理前先导出一份。</p></Show><button type="button" class="ep-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空当前数据</button></section>
      </div>

      <footer class="ep-settings-footer"><span>当前样式：{activeTheme().name}</span><button type="button" class="ep-primary-button" onClick={props.onSaveVisualSettings}><Save size={15} strokeWidth={1.6} aria-hidden="true" />保存外观设置</button><span>更改将在下次打开应用时生效。</span></footer>
    </section>
  );
}
