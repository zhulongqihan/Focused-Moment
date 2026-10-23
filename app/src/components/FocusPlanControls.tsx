import { For, Show } from "solid-js";
import type { TodaySurfaceProps } from "../lib/theme-contracts";

type FocusPlanControlProps = Pick<TodaySurfaceProps,
  "planTodos" | "currentTodo" | "todayPickIds" | "busy" | "timerHasProgress" |
  "formatTodoDue" | "onQuickCapture" | "onSetCurrentTodo" | "onToggleTodayPick" | "onStartTodo"
>;

export default function FocusPlanControls(props: FocusPlanControlProps) {
  return (
    <section class="focus-plan-controls" aria-label="当前事项和今日精选">
      <header class="focus-plan-controls__header">
        <div><span>FOCUS PLAN / 今日推进</span><h2>决定下一步</h2></div>
        <button type="button" class="text-button" onClick={props.onQuickCapture}>快速记一件事</button>
      </header>
      <Show when={props.planTodos().length > 0} fallback={<p class="focus-plan-controls__empty">今天还没有可推进的事项。可以先把想到的事收进收件箱。</p>}>
        <div class="focus-plan-controls__list">
          <For each={props.planTodos()}>
            {(item) => {
              const isCurrent = () => props.currentTodo()?.id === item.id;
              const isPicked = () => props.todayPickIds().includes(item.id);
              return (
                <article classList={{ "focus-plan-controls__row": true, "is-current": isCurrent(), "is-picked": isPicked() }}>
                  <div><strong>{item.title}</strong><small>{props.formatTodoDue(item)}{isCurrent() ? " · 当前事项" : ""}</small><Show when={item.continuationNote}><small>下次继续：{item.continuationNote}</small></Show></div>
                  <div class="focus-plan-controls__actions">
                    <button type="button" class="text-button" disabled={props.busy()} onClick={() => void props.onSetCurrentTodo(isCurrent() ? null : item.id)}>{isCurrent() ? "取消当前" : "设为当前"}</button>
                    <button type="button" class="text-button" disabled={props.busy() || (!isPicked() && props.todayPickIds().length >= 3)} onClick={() => void props.onToggleTodayPick(item.id)}>{isPicked() ? "移出精选" : "加入精选"}</button>
                    <button type="button" class="primary-button" disabled={props.busy() || props.timerHasProgress()} onClick={() => void props.onStartTodo(item)}>开始专注</button>
                  </div>
                </article>
              );
            }}
          </For>
        </div>
      </Show>
    </section>
  );
}
