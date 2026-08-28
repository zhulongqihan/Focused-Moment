import { For, Show } from "solid-js";
import type { AnalyticsSnapshot, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";

export interface TodayDashboardProps {
  todayLabel: string;
  timer: () => TimerSnapshot;
  ready: () => boolean;
  busy: () => boolean;
  timerHasProgress: () => boolean;
  timerCanContinue: () => boolean;
  nextTodo: () => TodoItem | null;
  todayTodos: () => TodoItem[];
  todayCompletedTodos: () => TodoItem[];
  analytics: () => AnalyticsSnapshot | null;
  formatTodoDue: (item: TodoItem) => string;
  importanceLabel: (value: TodoImportance) => string;
  onPause: () => void;
  onContinue: () => void;
  onFinish: () => void;
  onStartNext: () => void;
  onOpenFocus: () => void;
  onUseTodo: (item: TodoItem) => void;
  onOpenTodos: () => void;
}

export default function TodayDashboard(props: TodayDashboardProps) {
  const countdownFinished = () =>
    props.timer().modeKey === "countdown" && props.timer().remainingMs === 0;

  return (
    <section class="today-page">
      <div class="page-heading today-heading">
        <span>{props.todayLabel}</span>
        <h1>今天，从一件事开始</h1>
      </div>

      <section
        classList={{
          "today-hero": true,
          "today-hero--running": props.timer().isRunning,
          "today-hero--paused": !props.timer().isRunning && props.timerHasProgress(),
        }}
        aria-label="今日专注入口"
      >
        <div class="today-hero__copy">
          <span class="today-hero__status">
            {props.timer().isRunning
              ? "正在专注"
              : countdownFinished()
                ? "倒计时已结束"
                : props.timerHasProgress()
                ? "这一轮已暂停"
                : "准备开始"}
          </span>
          <h2>
            {props.timerHasProgress()
              ? props.timer().activeTaskTitle || "未命名事项"
              : props.nextTodo()?.title || "还没有下一件事"}
          </h2>
          <p>
            {props.timer().isRunning
              ? "保持当前节奏，其他事情稍后再处理。"
              : countdownFinished()
                ? "本轮已完成，保存后会写入一条专注记录。"
                : props.timerHasProgress()
                ? "这一轮还没有结束，可以继续或保存为记录。"
                : props.nextTodo()
                  ? `下一件事 · ${props.formatTodoDue(props.nextTodo()!)}`
                  : "写下一件待办，Focused Moment 会帮你把它变成一轮专注。"}
          </p>
          <div class="today-hero__actions">
            <Show when={props.timer().isRunning}>
              <button type="button" class="primary-button" disabled={props.busy()} onClick={props.onPause}>
                暂停这一轮
              </button>
            </Show>
            <Show when={!props.timer().isRunning && props.timerHasProgress()}>
              <Show when={props.timerCanContinue()}>
                <button type="button" class="primary-button" disabled={props.busy()} onClick={props.onContinue}>
                  继续这一轮
                </button>
              </Show>
              <button
                type="button"
                classList={{ "primary-button": countdownFinished(), "secondary-button": !countdownFinished() }}
                disabled={props.busy()}
                onClick={props.onFinish}
              >
                完成并记录
              </button>
            </Show>
            <Show when={!props.timerHasProgress()}>
              <button type="button" class="primary-button" disabled={props.busy() || !props.ready()} onClick={props.onStartNext}>
                {props.nextTodo() ? "开始下一件事" : "写下第一件事"}
              </button>
            </Show>
            <button type="button" class="text-button" disabled={props.busy()} onClick={props.onOpenFocus}>
              打开完整计时
            </button>
          </div>
        </div>
        <div class="today-hero__orbit" aria-hidden="true">
          <span>{props.timer().status}</span>
          <strong>{props.timer().elapsedLabel}</strong>
          <small>{props.timer().mode}</small>
        </div>
      </section>

      <div class="today-grid">
        <section class="today-section today-next">
          <div class="today-section__heading">
            <h2>接下来</h2>
            <span>{props.todayTodos().length} 件今天待办</span>
          </div>
          <Show
            when={props.todayTodos().length > 0}
            fallback={<p class="empty-copy">今天还没有待办，先写一件最重要的事。</p>}
          >
            <For each={props.todayTodos().slice(0, 3)}>
              {(item, index) => (
                <button
                  type="button"
                  classList={{ "today-task": true, "today-task--next": index() === 0 }}
                  disabled={props.busy() || props.timerHasProgress()}
                  onClick={() => props.onUseTodo(item)}
                >
                  <span class="today-task__mark">{index() === 0 ? "→" : "·"}</span>
                  <span class="today-task__copy">
                    <strong>{item.title}</strong>
                    <small>{props.formatTodoDue(item)} · 重要程度：{props.importanceLabel(item.importanceKey)}</small>
                  </span>
                </button>
              )}
            </For>
          </Show>
          <button type="button" class="text-button today-section__link" onClick={props.onOpenTodos}>
            查看全部待办
          </button>
        </section>

        <section class="today-section today-checkpoint">
          <div class="today-section__heading">
            <h2>今天已经留下</h2>
            <span>只看今天的事实</span>
          </div>
          <div class="today-facts">
            <div>
              <strong>{props.analytics()?.todayFocusDurationLabel ?? "0 分钟"}</strong>
              <span>专注投入</span>
            </div>
            <div>
              <strong>{props.analytics()?.todaySessionCount ?? 0}</strong>
              <span>完成轮次</span>
            </div>
            <div>
              <strong>{props.todayCompletedTodos().length}</strong>
              <span>完成待办</span>
            </div>
            <div>
              <strong>{props.analytics()?.currentStreakDays ?? 0}</strong>
              <span>连续投入天数</span>
            </div>
          </div>
          <p class="today-note">
            {props.todayCompletedTodos().length > 0 || (props.analytics()?.todaySessionCount ?? 0) > 0
              ? "有进展就值得被看见，下一步继续保持现在的节奏。"
              : "完成第一轮之后，这里会留下今天的节奏。"}
          </p>
        </section>
      </div>
    </section>
  );
}
