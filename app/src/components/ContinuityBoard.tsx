import { BookOpen, Plus } from "lucide-solid";
import { For, Show, createMemo } from "solid-js";
import type { FocusRecord } from "../lib/contracts";
import type { TodaySurfaceProps } from "../lib/theme-contracts";

function formatDuration(durationMs: number) {
  const minutes = Math.round(Math.max(0, durationMs) / 60_000);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function todoFocusStats(records: FocusRecord[], todoId: number) {
  const linked = records.filter((record) => record.linkedTodoId === todoId);
  return { rounds: linked.length, durationMs: linked.reduce((total, record) => total + record.durationMs, 0) };
}

export default function ContinuityBoard(props: TodaySurfaceProps) {
  const currentStats = createMemo(() => {
    const item = props.currentTodo();
    return item ? todoFocusStats(props.records(), item.id) : { rounds: 0, durationMs: 0 };
  });
  const todayRecords = createMemo(() => props.records().filter((record) => record.completedDate === props.todayDate));
  const todayDuration = createMemo(() => todayRecords().reduce((total, record) => total + record.durationMs, 0));

  return (
    <section class="continuity-board" aria-label="从想到到继续">
      <article class="continuity-board__card continuity-board__card--current">
        <div class="continuity-board__heading"><span>当前事项</span><button type="button" class="continuity-board__link" onClick={props.onQuickCapture}><Plus size={14} />快速记一件事</button></div>
        <Show when={props.currentTodo()} fallback={<div class="continuity-board__empty"><strong>选择一件事开始</strong><span>从待办或收件箱选一项。</span><button type="button" onClick={props.onOpenTodos}>打开待办</button></div>}>
          {(item) => <><h2>{item().title}</h2><div class="continuity-board__meta"><span>{currentStats().rounds} 轮</span><span>{formatDuration(currentStats().durationMs)} 累计</span></div><Show when={item().continuationNote}><p>下次继续：{item().continuationNote}</p></Show><button type="button" class="continuity-board__primary" disabled={props.busy()} onClick={() => props.timerHasProgress() ? props.onOpenFocus() : void props.onStartTodo(item())}>{props.timerHasProgress() ? "查看当前专注" : currentStats().rounds ? "继续专注" : "开始专注"}</button><button type="button" class="continuity-board__link" disabled={props.busy()} onClick={() => void props.onSetCurrentTodo(null)}>取消当前</button></>}
        </Show>
      </article>
      <article class="continuity-board__card">
        <div class="continuity-board__heading"><span>今日精选</span><small>{props.todayPickTodos().length} / 3</small></div>
        <Show when={props.todayPickTodos().length > 0} fallback={<div class="continuity-board__empty"><strong>从待办或收件箱加入</strong><span>最多保留三件。</span></div>}>
          <div class="continuity-board__picks"><For each={props.todayPickTodos()}>{(item) => <div><button type="button" aria-label={`设为当前：${item.title}`} aria-pressed={props.currentTodo()?.id === item.id} disabled={props.busy()} onClick={() => void props.onSetCurrentTodo(item.id)}>{item.title}</button><button type="button" class="continuity-board__pick-start" disabled={props.busy() || props.timerHasProgress()} onClick={() => void props.onStartTodo(item)}>开始</button><button type="button" aria-label={`移出今日精选：${item.title}`} onClick={() => void props.onToggleTodayPick(item.id)}>移出</button></div>}</For></div>
        </Show>
        <button type="button" class="continuity-board__link" onClick={props.onOpenTodos}>管理精选</button>
      </article>
      <article class="continuity-board__card continuity-board__card--investment">
        <div class="continuity-board__heading"><span>今日投入</span><button type="button" class="continuity-board__link" onClick={props.onOpenRecords}><BookOpen size={14} />查看记录</button></div>
        <strong class="continuity-board__value">{formatDuration(todayDuration())}</strong>
        <div class="continuity-board__meta"><span>{todayRecords().length} 段完成</span><span>{props.todayCompletedTodos().length} 项待办完成</span></div>
      </article>
    </section>
  );
}
