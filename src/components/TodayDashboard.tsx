import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Flame,
  ListChecks,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-solid";
import type { AnalyticsSnapshot, FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";

export interface TodayDashboardProps {
  todayDate: string;
  todayLabel: string;
  timer: () => TimerSnapshot;
  ready: () => boolean;
  busy: () => boolean;
  timerHasProgress: () => boolean;
  timerCanContinue: () => boolean;
  nextTodo: () => TodoItem | null;
  todayTodos: () => TodoItem[];
  todayCompletedTodos: () => TodoItem[];
  records: () => FocusRecord[];
  analytics: () => AnalyticsSnapshot | null;
  defaultFocusMinutes: () => number;
  formatTodoDue: (item: TodoItem) => string;
  importanceLabel: (value: TodoImportance) => string;
  onPause: () => void;
  onContinue: () => void;
  onFinish: () => void | Promise<void>;
  onStartNext: () => void;
  onOpenFocus: () => void;
  onOpenRecords: () => void;
  onUseTodo: (item: TodoItem) => void;
  onOpenTodos: () => void;
}

type TrailNodeState = "done" | "current" | "upcoming";

interface TrailNode {
  key: string;
  index: number;
  title: string;
  time: string;
  state: TrailNodeState;
  item: TodoItem | null;
}

const nodePositions = [
  { left: 12, top: 51 },
  { left: 29, top: 76 },
  { left: 50, top: 60 },
  { left: 69, top: 82 },
  { left: 88, top: 52 },
];

function formatTime(value: string) {
  if (!value) {
    return "下一段";
  }
  return value.slice(0, 5);
}

function formatShortDate(date: string) {
  return date.replace(/-/g, " · ");
}

function recordTime(record: FocusRecord) {
  const completedAt = new Date(record.completedAt);
  if (!Number.isNaN(completedAt.getTime())) {
    return `${String(completedAt.getHours()).padStart(2, "0")}:${String(completedAt.getMinutes()).padStart(2, "0")}`;
  }
  return formatTime(record.completedTime);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function TodayDashboard(props: TodayDashboardProps) {
  const [completionCueVisible, setCompletionCueVisible] = createSignal(false);
  let completionCueTimer: number | undefined;

  onCleanup(() => {
    if (completionCueTimer !== undefined) {
      window.clearTimeout(completionCueTimer);
    }
  });

  const countdownFinished = () =>
    props.timer().modeKey === "countdown" && props.timer().remainingMs === 0;

  const focusTitle = () =>
    props.timerHasProgress()
      ? props.timer().activeTaskTitle || "未命名事项"
      : props.nextTodo()?.title || "写下下一件事";

  const focusTime = () => {
    if (props.timerHasProgress()) {
      return props.timer().elapsedLabel;
    }
    return `${String(Math.max(1, Math.round(props.defaultFocusMinutes()))).padStart(2, "0")}:00`;
  };

  const focusProgress = () => {
    const timer = props.timer();
    if (!props.timerHasProgress()) {
      return 0;
    }
    if (timer.modeKey === "countdown" && timer.targetDurationMs && timer.remainingMs !== null) {
      return clamp(1 - timer.remainingMs / timer.targetDurationMs, 0, 1);
    }
    return clamp(timer.elapsedMs / Math.max(timer.targetDurationMs ?? 25 * 60 * 1000, 25 * 60 * 1000), 0, 1);
  };

  const trailNodes = createMemo<TrailNode[]>(() => {
    const items: TrailNode[] = [];
    const todayRecords = props.records().filter((record) => record.completedDate === props.todayDate);

    todayRecords.slice(0, 3).forEach((record, index) => {
      items.push({
        key: `record-${record.id}`,
        index: index + 1,
        title: record.title,
        time: recordTime(record),
        state: "done",
        item: null,
      });
    });

    if (props.timerHasProgress()) {
      items.push({
        key: "active-session",
        index: items.length + 1,
        title: props.timer().activeTaskTitle || "当前专注",
        time: props.timer().isRunning ? "进行中" : "已暂停",
        state: "current",
        item: null,
      });
    }

    props.todayTodos()
      .filter((item) => item.id !== props.timer().linkedTodoId)
      .slice(0, 4)
      .forEach((item) => {
        if (items.length >= 5) {
          return;
        }
        items.push({
          key: `todo-${item.id}`,
          index: items.length + 1,
          title: item.title,
          time: formatTime(item.scheduledTime),
          state: items.length === todayRecords.length && !props.timerHasProgress() ? "current" : "upcoming",
          item,
        });
      });

    const fallbacks = ["下一段专注", "今日收尾", "继续回来"];
    fallbacks.forEach((title) => {
      if (items.length >= 5) {
        return;
      }
      items.push({
        key: `fallback-${items.length}`,
        index: items.length + 1,
        title,
        time: items.length === 0 ? "现在" : "待安排",
        state: items.length === 0 ? "current" : "upcoming",
        item: null,
      });
    });

    return items.slice(0, 5).map((node, index) => ({ ...node, index: index + 1 }));
  });

  const completedNodeCount = () => trailNodes().filter((node) => node.state === "done").length;
  const trailCompletion = () => Math.round((completedNodeCount() / 5) * 100);

  async function finishWithCue() {
    await props.onFinish();
    setCompletionCueVisible(true);
    if (completionCueTimer !== undefined) {
      window.clearTimeout(completionCueTimer);
    }
    completionCueTimer = window.setTimeout(() => setCompletionCueVisible(false), 5200);
  }

  return (
    <section class="today-page trail-page">
      <header class="trail-page__heading">
        <div class="trail-page__date">
          <CalendarDays size={15} strokeWidth={1.6} aria-hidden="true" />
          <strong>{formatShortDate(props.todayDate)}</strong>
          <span>{props.todayLabel.split(" ").slice(-1)[0] ?? props.todayLabel}</span>
        </div>
        <h1 aria-label="今天，从一件事开始">今日路径</h1>
        <p>专注让时间更清晰，你正在走出属于自己的节奏。</p>
      </header>

      <div class="trail-page__headline-actions">
        <div class="trail-streak">
          <span class="trail-streak__icon"><Flame size={18} strokeWidth={1.8} aria-hidden="true" /></span>
          <div>
            <strong>连续 {props.analytics()?.currentStreakDays ?? 0} 天</strong>
            <small>{props.analytics()?.currentStreakDays ? "保持节奏，继续前行。" : "完成一轮，重新点亮这条路径。"}</small>
          </div>
        </div>
        <button type="button" class="trail-link-button" onClick={props.onOpenRecords}>
          <BookOpen size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>专注记录</span>
          <ArrowUpRight size={15} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      <section class="trail-stage" aria-label="今日专注路径">
        <div class="trail-map">
          <div class="trail-map__stars" aria-hidden="true" />
          <div class="trail-map__horizon" aria-hidden="true" />
          <svg class="trail-map__route" viewBox="0 0 900 420" role="img" aria-label="今日专注节点路径">
            <defs>
              <linearGradient id="trail-route-gradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stop-color="#e5ae62" />
                <stop offset="0.52" stop-color="#e9bf73" />
                <stop offset="1" stop-color="#c8f1d7" />
              </linearGradient>
              <filter id="trail-route-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path class="trail-map__route-shadow" d="M 42 218 C 100 186 105 249 170 269 S 244 316 305 279 S 392 183 465 227 S 534 345 615 316 S 695 238 758 271 S 822 207 878 198" />
            <path class="trail-map__route-line" d="M 42 218 C 100 186 105 249 170 269 S 244 316 305 279 S 392 183 465 227 S 534 345 615 316 S 695 238 758 271 S 822 207 878 198" />
            <path class="trail-map__route-dash" d="M 42 218 C 100 186 105 249 170 269 S 244 316 305 279 S 392 183 465 227 S 534 345 615 316 S 695 238 758 271 S 822 207 878 198" />
          </svg>

          <For each={trailNodes()}>
            {(node, index) => {
              const position = nodePositions[index()];
              return (
                <button
                  type="button"
                  classList={{
                    "trail-node": true,
                    "trail-node--done": node.state === "done",
                    "trail-node--current": node.state === "current",
                    "trail-node--upcoming": node.state === "upcoming",
                  }}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  aria-label={`${node.index}. ${node.title} · ${node.time}`}
                  disabled={props.busy() || (node.state === "done" && !node.item)}
                  onClick={() => node.item ? props.onUseTodo(node.item) : props.onOpenFocus()}
                >
                  <span class="trail-node__meta">
                    <b>{node.index}</b>
                    <strong>{node.title}</strong>
                    <small>{node.time}</small>
                  </span>
                  <span class="trail-node__orb" aria-hidden="true">
                    <Show when={node.state === "done"} fallback={<Show when={node.state === "current"}><MapPin size={18} strokeWidth={1.7} /></Show>}>
                      <Check size={17} strokeWidth={2.4} />
                    </Show>
                  </span>
                </button>
              );
            }}
          </For>

          <div class="trail-map__footer">
            <div>
              <strong>已走 {completedNodeCount()} / 5 段</strong>
              <span>{completedNodeCount() > 0 ? "完成的每一段，都会让路径更亮。" : "先走一小段，路径会从这里亮起来。"}</span>
            </div>
            <div class="trail-map__progress" aria-label={`已完成 ${trailCompletion()}%`}>
              <span style={{ width: `${trailCompletion()}%` }} />
            </div>
          </div>
          <button type="button" class="trail-add-button" onClick={props.onOpenTodos}>
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            添加时段
          </button>
        </div>

        <aside classList={{ "trail-focus-panel": true, "trail-focus-panel--running": props.timer().isRunning }} aria-label="下一站专注">
          <div class="trail-focus-panel__topline">
            <span class="trail-live-indicator" aria-hidden="true" />
            <span>{props.timer().isRunning ? "专注中 · 不可打扰" : props.timerHasProgress() ? "已暂停 · 可以继续" : "下一站 · 准备开始"}</span>
            <kbd>Ctrl ↵</kbd>
          </div>
          <span class="trail-focus-panel__eyebrow">{props.timerHasProgress() ? "CURRENT SESSION" : "NEXT STATION"}</span>
          <h2>{focusTitle()}</h2>
          <Show when={props.nextTodo() && !props.timerHasProgress()} fallback={<p>{props.timer().isRunning ? "保持当前节奏，其他事情稍后再处理。" : "这一轮还没有结束，可以继续或保存为记录。"}</p>}>
            <p>{props.formatTodoDue(props.nextTodo()!)}</p>
          </Show>

          <div class="trail-timer" aria-label={`当前计时 ${focusTime()}`}>
            <svg class="trail-timer__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="trail-timer__track" cx="50" cy="50" r="42" />
              <circle class="trail-timer__arc" cx="50" cy="50" r="42" style={{ "stroke-dashoffset": `${264 - focusProgress() * 264}` }} />
            </svg>
            <div class="trail-timer__center">
              <strong>{focusTime()}</strong>
              <span>{props.timerHasProgress() ? props.timer().status : "准备开始"}</span>
            </div>
          </div>

          <div class="trail-focus-panel__actions">
            <Show when={props.timer().isRunning}>
              <button type="button" class="trail-action trail-action--secondary" disabled={props.busy()} onClick={props.onPause}>
                <Clock3 size={16} strokeWidth={1.8} aria-hidden="true" />
                暂停这一轮
              </button>
            </Show>
            <Show when={!props.timer().isRunning && props.timerHasProgress()}>
              <button type="button" class="trail-action trail-action--primary" disabled={props.busy() || !props.timerCanContinue()} onClick={props.onContinue}>
                继续这一轮
                <span>Ctrl ↵</span>
              </button>
              <button type="button" class="trail-action trail-action--secondary" disabled={props.busy() || !props.timer().canCompleteSession} onClick={() => void finishWithCue()}>
                <CircleCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                完成并留下
              </button>
            </Show>
            <Show when={!props.timerHasProgress()}>
              <button type="button" class="trail-action trail-action--primary" disabled={props.busy() || !props.ready()} onClick={props.onStartNext}>
                <span>开始下一件事</span>
                <span>Ctrl ↵</span>
              </button>
            </Show>
          </div>

          <details class="trail-task-list" open>
            <summary>
              <span><ListChecks size={15} strokeWidth={1.8} aria-hidden="true" /> 本段任务 {props.todayTodos().length}</span>
              <ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" />
            </summary>
            <div class="trail-task-list__items">
              <Show when={props.todayTodos().length > 0} fallback={<p>还没有今天的待办，去写下一件事。</p>}>
                <For each={props.todayTodos().slice(0, 3)}>
                  {(item, index) => (
                    <button type="button" class="trail-task-row" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseTodo(item)}>
                      <span class="trail-task-row__check"><Show when={index() > 0}><Check size={12} strokeWidth={2.4} /></Show></span>
                      <span class="trail-task-row__copy">
                        <strong>{item.title}</strong>
                        <small>{props.formatTodoDue(item)} · {props.importanceLabel(item.importanceKey)}优先</small>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </details>
        </aside>
      </section>

      <div class="trail-page__facts">
        <div class="trail-fact">
          <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>今日留下</span>
          <strong>{props.analytics()?.todaySessionCount ?? 0} 轮</strong>
        </div>
        <div class="trail-fact">
          <Clock3 size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>专注时长</span>
          <strong>{props.analytics()?.todayFocusDurationLabel ?? "0 分钟"}</strong>
        </div>
        <div class="trail-fact">
          <CircleCheck size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>今日待办</span>
          <strong>{props.todayCompletedTodos().length} / {props.todayTodos().length + props.todayCompletedTodos().length}</strong>
        </div>
        <div class="trail-fact trail-fact--message">
          <MapPin size={16} strokeWidth={1.7} aria-hidden="true" />
          <span>{countdownFinished() ? "倒计时已结束" : "今天的提醒"}</span>
          <strong>{countdownFinished() ? "保存这一轮，让它抵达记录。" : "不需要走很远，只要继续回来。"}</strong>
        </div>
      </div>

      <Show when={completionCueVisible()}>
        <div class="trail-arrival-cue" role="status" aria-live="polite">
          <span class="trail-arrival-cue__icon"><Check size={17} strokeWidth={2.6} /></span>
          <span><strong>已到达 · +1 节点</strong><small>这段专注已写入今日记录。</small></span>
        </div>
      </Show>
    </section>
  );
}
