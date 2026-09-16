import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleCheck,
  Clock3,
  Plus,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Volume2,
  X,
} from "lucide-solid";
import type { AlertSoundKey, AnalyticsSnapshot, FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";
import { themes } from "../lib/themes";
import type { TodayDashboardProps } from "./TodayDashboard";
import DailyFocusLine from "./DailyFocusLine";
import type {
  NightValleyFocusProps,
  NightValleyRecordsProps,
  NightValleySettingsProps,
  NightValleyTodoProps,
} from "./NightValleyViews";
import { groupTodosByDate, TodoDateGroupList } from "./NightValleyViews";
import { NightValleyClock } from "./NightValleyDateStamp";

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

function currentEditorialDateLabel() {
  return new Date()
    .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");
}

function EditorialPaperDateTime(props: { date?: string }) {
  return (
    <span class="ep-date-time">
      <time class="ep-date-time__date">{props.date ?? currentEditorialDateLabel()}</time>
      <NightValleyClock className="ep-date-time__clock" />
    </span>
  );
}

export function EditorialPaperToday(props: TodayDashboardProps) {
  const streak = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const completionCount = createMemo(() => props.todayCompletedTodos().length);
  const totalTodayCount = createMemo(() => completionCount() + props.todayTodos().length);

  return (
    <section class="ep-page ep-today-page" aria-label="今日节奏">
      <header class="ep-page-header ep-today-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / DAILY FIELD NOTES</span><EditorialPaperDateTime /></div>
        <div class="ep-heading-row">
          <div>
            <span class="ep-kicker">DAILY PLAN · {props.todayDate.replace(/-/g, ".")}</span>
            <h1>今日节奏</h1>
            <p>把注意力放在真正重要的事上，时间会给出回应。</p>
          </div>
          <div class="ep-stamp" aria-label={`连续 ${streak()} 天`}>
            <span>连续</span>
            <strong>{streak()}</strong>
            <span>日</span>
          </div>
        </div>
        <DailyFocusLine date={props.todayDate} theme="editorial-paper" />
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
                    <span class="ep-field-row__copy"><strong>{item.title}</strong><small>{props.formatTodoDue(item)}<span class="ep-field-row__importance-mobile"> · {props.importanceLabel(item.importanceKey)}</span></small></span>
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
              <For each={props.todayCompletedTodos()}>
                {(item) => <span><CircleCheck size={15} strokeWidth={1.6} aria-hidden="true" /><span class="ep-completed-notes__title">{item.title}</span></span>}
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
  const resetLabel = createMemo(() => props.timerHasProgress() ? "重置本次专注" : "清空设置");
  const resetDescription = createMemo(() => props.timerHasProgress()
    ? "放弃当前计时并清除本次专注设置"
    : "清除当前标题、时长和待办选择");

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
        <div class="ep-meta-line"><span>FOCUSED MOMENT / FOCUS CARD</span><span class="ep-page-meta"><span class="ep-page-index">02 / 05</span><EditorialPaperDateTime /></span></div>
        <span class="ep-kicker">A GENTLE APPOINTMENT WITH ATTENTION</span>
        <h1>专注时刻</h1>
        <p>给眼前这一段完整的注意力。</p>
      </header>

      <div class="ep-focus-layout">
        <aside class="ep-note-stack ep-note-stack--left">
          <div class="ep-taped-note ep-taped-note--ochre"><span>当前状态</span><strong>{props.timer().isRunning ? "进行中" : props.timerHasProgress() ? "已暂停" : "准备开始"}</strong><small>{props.timer().phaseLabel}</small></div>
          <div class="ep-taped-note ep-taped-note--sage"><span>今日专注</span><strong>{props.todaySessionCount()} 段完成</strong><small>每一段都算数</small></div>
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
            <Show when={props.timer().isRunning} fallback={<button type="button" class="ep-primary-button" disabled={props.busy() || !props.ready() || props.timer().isRunning || (props.timer().modeKey === "countdown" && props.timer().remainingMs === 0)} onClick={() => void props.onStart()}>{props.busy() ? props.busyLabel() : props.timerHasProgress() ? "继续专注" : "开始专注"}</button>}>
              <button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onPause()}>{props.busy() ? props.busyLabel() : "暂停"}</button>
            </Show>
            <button type="button" class="ep-secondary-button" disabled={props.busy() || !props.canFinish()} onClick={() => void props.onFinish()}>{props.busy() && props.canFinish() ? props.busyLabel() : "完成并记录"}</button>
            <button type="button" class="ep-text-button" disabled={props.busy() || !props.ready()} title={resetDescription()} aria-label={resetLabel()} onClick={() => void props.onReset()}><RotateCcw size={14} strokeWidth={1.6} aria-hidden="true" />{resetLabel()}</button>
          </div>
          <Show when={props.savedConfirmation()}><p class="ep-inline-confirmation" role="status"><CircleCheck size={15} strokeWidth={1.7} aria-hidden="true" />这一段已经收进记录。</p></Show>
        </section>

        <aside class="ep-focus-notes">
          <div class="ep-note-paper"><span class="ep-section-label">FOCUS NOTE / 本次专注图</span><label><span>我想专注于…</span><input type="text" name="editorialSessionTitle" value={props.sessionTitle()} placeholder="写下这一页的主题" disabled={props.busy() || !props.ready() || props.timerHasProgress()} onInput={(event) => { props.onSessionTitleDirty(); props.onSessionTitleChange(event.currentTarget.value); }} /></label><label><span>关联待办</span><select name="editorialLinkedTodo" value={props.linkedTodoId() ?? ""} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => handleLinkedTodoChange(event.currentTarget.value)}><option value="">不关联待办</option><For each={props.pendingTodos()}>{(item) => <option value={item.id}>{item.title}</option>}</For></select></label><Show when={currentTodo()}><p class="ep-note-paper__linked"><Check size={14} strokeWidth={1.8} aria-hidden="true" />{currentTodo()?.title}</p></Show><label class="ep-check-label"><input type="checkbox" name="editorialCompleteLinkedTodo" checked={props.completeLinkedTodo()} disabled={props.busy() || !props.ready() || props.timerHasProgress()} onChange={(event) => props.onCompleteLinkedTodoChange(event.currentTarget.checked)} /><span>本轮完成后同时标记关联待办</span></label></div>
          <div class="ep-mini-note"><span>下一次休息</span><strong>{props.timerPreferences().pomodoroBreakMinutes} 分钟</strong><small>让节奏留下余地。</small></div>
        </aside>
      </div>

      <footer class="ep-focus-footer"><span><Clock3 size={15} strokeWidth={1.6} aria-hidden="true" />{props.timerCanContinue() ? "可以继续回来" : "准备好时，从这里开始"}</span><Show when={props.timerHasProgress()}><button type="button" class="ep-secondary-button ep-focus-floating-link" title="隐藏主窗口，回到悬浮计时" onClick={() => void props.onShowFocusFloating()}>进入悬浮窗 <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" /></button></Show><span>FOCUSED MOMENT · FM-2026</span><span>{props.timer().activeTaskTitle || "一段完整的注意力"}</span></footer>
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
  const pendingDateGroups = createMemo(() => groupTodosByDate([...props.overdueTodos(), ...props.activeTodos()]));
  const pendingTodoCount = createMemo(() => props.overdueTodos().length + props.activeTodos().length);
  const todayTodoTotal = createMemo(() => props.todayTodos().length + props.todayCompletedTodos().length);
  const completionPercent = createMemo(() => todayTodoTotal() === 0 ? 0 : Math.round((props.todayCompletedTodos().length / todayTodoTotal()) * 100));

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
        <div class="ep-meta-line"><span>FOCUSED MOMENT / FIELD NOTES</span><span class="ep-page-meta"><span class="ep-page-index">03 / 05</span><EditorialPaperDateTime /></span></div>
        <span class="ep-kicker">SORT THE NOISE INTO A NEXT STEP</span>
        <h1>待办清单</h1>
        <p>把杂乱的念头整理成下一步。</p>
      </header>

      <div class="ep-todo-toolbar"><div><span>今日完成</span><strong>{props.todayCompletedTodos().length}</strong><span>项 · 待处理 <b>{props.activeTodos().length}</b> 项</span></div><button type="button" class="ep-paper-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen() ? <X size={16} strokeWidth={1.6} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.6} aria-hidden="true" />}{createOpen() ? "收起" : "新增待办"}</button></div>

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
        <section class="ep-todo-column ep-todo-column--pending"><header><span>01 / BY DATE</span><h2>待办</h2><strong>{pendingTodoCount()}</strong></header><div class="ep-todo-column__list"><Show when={props.ready()} fallback={<p class="ep-empty">正在读取…</p>}><Show when={pendingDateGroups().length > 0} fallback={<p class="ep-empty">没有待办事项。今天可以留一点空白。</p>}><TodoDateGroupList groups={pendingDateGroups} listLabel="按日期分组的待办" renderItem={(item) => <EditorialTodoRow item={item} {...rowProps} />} editingTodo={props.editingTodo} busy={props.busy} timerHasProgress={props.timerHasProgress} formatTodoDue={props.formatTodoDue} importanceLabel={props.importanceLabel} onToggle={props.onToggle} onBeginEdit={props.onBeginEdit} onUseForFocus={props.onUseForFocus} onRemove={props.onRemove} onPatch={props.onPatch} onSave={props.onSave} onCancel={props.onCancel} /></Show></Show></div></section>
        <section class="ep-todo-column ep-todo-column--done"><header><span>02 / ARCHIVE</span><h2>已完成</h2><strong>{props.completedTodos().length}</strong></header><div class="ep-todo-column__list ep-todo-column__list--completed"><Show when={props.completedTodos().length > 0} fallback={<p class="ep-empty">完成一项后，它会留在这张纸上。</p>}><For each={props.completedTodos()}>{(item) => <EditorialTodoRow item={item} {...rowProps} />}</For></Show></div></section>
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
  const selectedRecordCount = createMemo(() => selectedRecords().length);
  let previousHistoryKey: string | null = null;

  createEffect(() => {
    const date = selectedDate();
    const recordCount = selectedRecordCount();
    const historyKey = `${date}:${recordCount}`;
    if (historyKey === previousHistoryKey) return;
    previousHistoryKey = historyKey;
    setVisibleRecordCount(initialVisibleRecordCount);
    setExpandedHistoryDate(recordCount <= initialVisibleRecordCount ? date : null);
  });

  return (
    <section class="ep-page ep-records-page" aria-label="专注年鉴">
      <header class="ep-page-header ep-records-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / PERSONAL ARCHIVE</span><span class="ep-page-meta"><span class="ep-page-index">04 / 05</span><EditorialPaperDateTime /></span></div>
        <span class="ep-kicker">RETURN TO THE RHYTHM YOU HAVE BUILT</span>
        <h1>专注年鉴</h1>
        <p>回看节奏，给下一页留下证据。</p>
      </header>

      <section class="ep-archive-paper" aria-label="最近七天统计">
        <div class="ep-archive-chart"><div class="ep-chart-heading"><span>近七日 / NATURAL DAYS</span><strong>{props.formatDurationMs(props.recentWeekDurationMs())}</strong></div><div class="ep-chart-bars"><For each={props.archiveDays()}>{(day) => <button type="button" classList={{ "ep-chart-bar": true, active: day.date === selectedDate() }} title={`${props.formatAnalyticsDate(day.date)} · ${day.totalDurationLabel}`} onClick={() => props.onSelectDate(day.date)}><span class="ep-chart-bar__value">{day.totalDurationLabel}</span><span class="ep-chart-bar__column"><i style={{ height: `${Math.max(4, (day.totalDurationMs / maxDuration()) * 100)}%` }} /></span><strong>{props.formatAnalyticsDate(day.date)}</strong></button>}</For></div></div>
        <div class="ep-archive-summary"><span class="ep-section-label">TODAY / {props.formatAnalyticsDate(selectedDate())}</span><strong>{analyticsValue(analytics(), "todayFocusDurationLabel", "0 分钟")}</strong><span>今日专注</span><div><span>完成段数</span><b>{analyticsValue(analytics(), "sessionCount", "0")}</b></div><div><span>连续</span><b>{analyticsValue(analytics(), "currentStreakDays", "0")} 日</b></div></div>
      </section>

      <section class="ep-records-spread">
        <div class="ep-records-list"><div class="ep-section-heading"><div><span class="ep-section-label">{props.formatAnalyticsDate(selectedDate())} · 节奏回顾</span><h2>每一段都留下痕迹</h2></div><button type="button" class="ep-text-button" onClick={() => props.onSelectDate(props.archiveDays()[props.archiveDays().length - 1]?.date ?? props.selectedArchiveDate())}>回到最近</button></div><Show when={selectedRecords().length > 0} fallback={<p class="ep-empty">这一天还没有专注记录。</p>}><For each={visibleSelectedRecords()}>{(record) => <article class="ep-record-entry"><span class="ep-record-entry__time">{record.completedTime}</span><span class="ep-record-entry__line" /><div><Show when={props.editingRecord()?.id === record.id} fallback={<><strong title={record.title}>{record.title}</strong><small>{record.durationLabel} · {record.modeLabel} · {formatRecordTime(record)}</small></>}><input type="text" aria-label="记录名称" value={props.editingRecord()?.title ?? ""} onInput={(event) => props.onPatchEdit(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void props.onSaveEdit(); if (event.key === "Escape") props.onCancelEdit(); }} /><div class="ep-record-entry__edit-actions"><button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onSaveEdit()}>保存</button><button type="button" class="ep-text-button" disabled={props.busy()} onClick={props.onCancelEdit}>取消</button></div></Show></div><Show when={props.editingRecord()?.id !== record.id}><span class="ep-record-entry__duration">{record.durationLabel}</span><div class="ep-record-entry__actions"><button type="button" class="ep-text-button" disabled={props.busy()} onClick={() => props.onBeginEdit(record)}>编辑</button><button type="button" class="ep-text-button ep-text-button--danger" disabled={props.busy()} onClick={() => void props.onRemove(record.id)}>删除</button></div></Show></article>}</For><Show when={visibleRecordCount() < selectedRecords().length}><button type="button" class="ep-records-load-more" onClick={() => setVisibleRecordCount((count) => Math.min(count + initialVisibleRecordCount, selectedRecords().length))}>继续展开记录 · 已显示 {visibleRecordCount()} / {selectedRecords().length}</button></Show></Show></div>
        <aside class="ep-insight-paper"><span class="ep-section-label">今日洞察 / FIELD NOTE</span><Show when={analytics()} fallback={<p>完成一段专注后，这里会出现可回看的事实。</p>}><p>你已经为今天留下 <strong>{analyticsValue(analytics(), "todayFocusDurationLabel", "0 分钟")}</strong> 的注意力。早上的输入会让下午的创作更稳定，晚上可以用下一段安静的回看收束今天。</p></Show><div class="ep-insight-signature">FOCUSED MOMENT<br /><small>FM-ARCHIVE / 2026</small></div></aside>
      </section>

      <section class="ep-full-history"><div class="ep-section-heading"><div><span class="ep-section-label">FULL INDEX / ALL RECORDS</span><h2>全部记录</h2></div><span>{props.records().length} 轮</span></div><Show when={props.ready() && props.records().length > 0} fallback={<p class="ep-empty">完成一次计时后，记录会显示在这里。</p>}><For each={props.recordGroups()}>{(group) => <details class="ep-history-day" open={expandedHistoryDate() === group.date}><summary onClick={(event) => { event.preventDefault(); setExpandedHistoryDate((date) => date === group.date ? null : group.date); }}><span>{props.formatRecordDay(group.date)}</span><strong>{group.records.length} 轮 · {props.formatDurationMs(group.totalDurationMs)}</strong></summary><Show when={expandedHistoryDate() === group.date}><div>{group.records.map((record) => <span>{record.title} · {record.durationLabel}</span>)}</div></Show></details>}</For></Show></section>
    </section>
  );
}

export function EditorialPaperSettings(props: NightValleySettingsProps) {
  let customAlertSoundInput: HTMLInputElement | undefined;
  const activeTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const rhythmPresets = [
    { label: "深度", focus: 50, break: 10, note: "适合完整任务" },
    { label: "标准", focus: 25, break: 5, note: "日常节奏" },
    { label: "短冲", focus: 15, break: 3, note: "先启动再展开" },
  ];
  const saveRhythmMinutes = (key: "pomodoroFocusMinutes" | "pomodoroBreakMinutes" | "stopwatchReminderMinutes", value: string, min: number, max: number) => {
    const minutes = Math.min(max, Math.max(min, Number(value) || min));
    void props.onSaveTimerPreferences({ [key]: minutes });
  };
  const applyRhythmPreset = (focus: number, breakMinutes: number) => {
    void props.onSaveTimerPreferences({ pomodoroFocusMinutes: focus, pomodoroBreakMinutes: breakMinutes });
  };

  return (
    <section class="ep-page ep-settings-page" aria-label="专注手册">
      <header class="ep-page-header ep-settings-header">
        <div class="ep-meta-line"><span>FOCUSED MOMENT / PERSONAL MANUAL</span><span class="ep-page-meta"><span class="ep-page-index">05 / 05</span><EditorialPaperDateTime /></span></div>
        <span class="ep-kicker">TUNE THE BOUNDARIES OF YOUR ATTENTION</span>
        <h1>你的专注手册</h1>
        <p>调整纸面之外，也调整注意力的边界。</p>
      </header>

      <div class="ep-settings-spread">
        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">01 / APPEARANCE</span><h2>外观样式</h2></div><SlidersHorizontal size={18} strokeWidth={1.4} aria-hidden="true" /></div><div class="ep-theme-swatches"><For each={themes}>{(theme) => <button type="button" classList={{ "ep-theme-swatch": true, selected: props.themeId() === theme.id, disabled: !theme.implemented }} disabled={!theme.implemented} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class={`ep-theme-swatch__paper ep-theme-swatch__paper--${theme.id}`} /><strong>{theme.name}</strong><small>{theme.implemented ? "可用" : "尚未实现"}</small></button>}</For></div><div class="ep-live-preview"><span>当前样式预览</span><div class={`ep-live-preview__paper ep-live-preview__paper--${activeTheme().id}`}><strong>{activeTheme().name}</strong><small>{activeTheme().description}</small></div></div></section>

        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">02 / BEHAVIOR</span><h2>专注行为</h2></div><Settings size={18} strokeWidth={1.4} aria-hidden="true" /></div><div class="ep-setting-list"><label><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ toastReminderEnabled: event.currentTarget.checked })} /><span><strong>完成后自动回到下一段</strong><small>无缝衔接，保持节奏。</small></span></label><label><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ windowAttentionReminderEnabled: event.currentTarget.checked })} /><span><strong>结束时提醒我</strong><small>回顾本次专注收获。</small></span></label><label><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ soundReminderEnabled: event.currentTarget.checked })} /><span><strong>持续专注提醒</strong><small>长时间专注时轻柔提醒。</small></span></label></div><p class="ep-hand-note">边界清晰，节奏自然。</p></section>

        <section class="ep-settings-paper"><div class="ep-section-heading"><div><span class="ep-section-label">03 / SOUND</span><h2>声音与提示</h2></div><Volume2 size={18} strokeWidth={1.4} aria-hidden="true" /></div><label class="ep-select-row"><span>提醒音效</span><select name="editorialAlertSound" value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="wooden_tick">木鱼单击</option><option value="glass_ping">玻璃回响</option><option value="morning_chord">晨光和弦</option><option value="viral_quote">老牧师原声</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></label><div class="ep-sound-actions"><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={props.onPreviewAlertSound}><Volume2 size={15} strokeWidth={1.6} aria-hidden="true" />试听</button><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={() => customAlertSoundInput?.click()}>导入音效</button><Show when={props.customAlertSoundName()}><button type="button" class="ep-text-button" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>移除自定义</button></Show><input ref={(element) => { customAlertSoundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></section>

        <section class="ep-settings-paper ep-settings-paper--rhythm"><div class="ep-section-heading"><div><span class="ep-section-label">04 / RHYTHM</span><h2>专注节奏</h2></div><Clock3 size={18} strokeWidth={1.4} aria-hidden="true" /></div><p class="ep-rhythm-note">这里决定下一次番茄钟的专注与休息长度；秒表达到提醒分钟数时会提示一次。当前正在进行的计时不会被改写。</p><div class="ep-rhythm-presets" role="group" aria-label="节奏预设"><span>快速套用</span><For each={rhythmPresets}>{(preset) => <button type="button" classList={{ "ep-rhythm-preset": true, selected: props.timerPreferences().pomodoroFocusMinutes === preset.focus && props.timerPreferences().pomodoroBreakMinutes === preset.break }} aria-pressed={props.timerPreferences().pomodoroFocusMinutes === preset.focus && props.timerPreferences().pomodoroBreakMinutes === preset.break} disabled={props.busy()} onClick={() => applyRhythmPreset(preset.focus, preset.break)}><strong>{preset.label} {preset.focus}/{preset.break}</strong><small>{preset.note}</small></button>}</For></div><div class="ep-rhythm-grid"><label><span>默认专注 <small>分钟</small></span><input aria-label="默认专注分钟" type="number" min="5" max="180" step="5" value={props.timerPreferences().pomodoroFocusMinutes} disabled={props.busy()} onChange={(event) => saveRhythmMinutes("pomodoroFocusMinutes", event.currentTarget.value, 5, 180)} /></label><label><span>默认休息 <small>分钟</small></span><input aria-label="默认休息分钟" type="number" min="1" max="60" step="1" value={props.timerPreferences().pomodoroBreakMinutes} disabled={props.busy()} onChange={(event) => saveRhythmMinutes("pomodoroBreakMinutes", event.currentTarget.value, 1, 60)} /></label><label><span>秒表提醒 <small>分钟</small></span><input aria-label="秒表提醒分钟" type="number" min="1" max="720" step="1" value={props.timerPreferences().stopwatchReminderMinutes ?? props.timerPreferences().pomodoroFocusMinutes} disabled={props.busy()} onChange={(event) => saveRhythmMinutes("stopwatchReminderMinutes", event.currentTarget.value, 1, 720)} /></label></div><div class="ep-rhythm-summary" aria-live="polite"><strong>下一次番茄钟</strong><span>{props.timerPreferences().pomodoroFocusMinutes} 分钟专注 · {props.timerPreferences().pomodoroBreakMinutes} 分钟休息</span><small>秒表 {props.timerPreferences().stopwatchReminderMinutes ?? props.timerPreferences().pomodoroFocusMinutes} 分钟提醒</small></div><p class="ep-rhythm-apply-note">保存后立即用于下一次计时。</p></section>

        <section class="ep-settings-paper ep-settings-paper--backup"><div class="ep-section-heading"><div><span class="ep-section-label">05 / DATA</span><h2>数据与备份</h2></div><BookOpen size={18} strokeWidth={1.4} aria-hidden="true" /></div><p>待办、专注记录和未完成计时状态留在这台电脑上。</p><div class="ep-settings-actions"><button type="button" class="ep-primary-button" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" class="ep-secondary-button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开备份目录</button></div><Show when={props.lastBackupPath()}><p class="ep-path">最近备份：{props.lastBackupPath()}</p></Show><Show when={props.backupLoadState() === "loading"}><p class="ep-empty">正在读取备份列表…</p></Show><Show when={props.backupLoadState() === "error"}><div class="ep-error"><strong>备份列表读取失败</strong><span>{props.backupLoadError()}</span><button type="button" class="ep-text-button" onClick={() => void props.onLoadBackups()}>重试读取</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="ep-select-row"><span>选择备份</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}</option>}</For></select></label><button type="button" class="ep-secondary-button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button></Show><Show when={props.backupLoadState() === "ready" && props.backups().length === 0}><p class="ep-empty">还没有备份。建议在清理前先导出一份。</p></Show><button type="button" class="ep-danger-button" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空当前数据</button></section>
      </div>

      <footer class="ep-settings-footer"><span>当前样式：{activeTheme().name}</span><span>主题与提醒设置会立即保存。</span></footer>
    </section>
  );
}
