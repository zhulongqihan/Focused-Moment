import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Flame,
  ListChecks,
  Plus,
  X,
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
  record: FocusRecord | null;
  position: TrailPoint;
}

interface TrailPoint {
  left: number;
  top: number;
}

interface TrailSegment {
  key: string;
  title: string;
  time: string;
  completed: boolean;
  item: TodoItem | null;
  record: FocusRecord | null;
}

interface PanelTask {
  key: string;
  title: string;
  duration: string;
  item: TodoItem | null;
}

const referenceTrailSlots = [
  { title: "早间启动", time: "08:00–09:00" },
  { title: "深度工作", time: "09:30–11:30" },
  { title: "专注时段", time: "14:00–15:30" },
  { title: "创作专注", time: "16:00–17:30" },
  { title: "今日收尾", time: "19:00–20:00" },
];

const referenceTrailPositions: TrailPoint[] = [
  { left: 12, top: 23.5 },
  { left: 29, top: 41.5 },
  { left: 50, top: 35.8 },
  { left: 69, top: 55.7 },
  { left: 88, top: 30.6 },
];

const extendedTrailLanes = [23.5, 41.5, 35.8, 55.7, 30.6, 47.2, 27.5, 52.2];

const samplePanelTasks = [
  "整理今天的会议笔记",
  "复盘重点事项与收获",
  "规划明日优先清单",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function weekdayFromLabel(label: string, dateValue: string) {
  const match = label.match(/周[一二三四五六日天]/);
  if (match) {
    return match[0];
  }

  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
}

function formatRecordTime(record: FocusRecord) {
  const completedTime = record.completedTime || record.completedAt.match(/T(\d{2}:\d{2})/)?.[1] || "";
  return completedTime ? `${completedTime} · ${record.durationLabel}` : record.durationLabel;
}

function formatTodoTime(item: TodoItem) {
  return item.scheduledTime ? `${item.scheduledTime} · 待开始` : "待安排";
}

function sortByTime<T extends { scheduledTime?: string; completedTime?: string; completedAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.scheduledTime || left.completedTime || left.completedAt || "";
    const rightTime = right.scheduledTime || right.completedTime || right.completedAt || "";
    return leftTime.localeCompare(rightTime);
  });
}

function createTrailPositions(count: number): TrailPoint[] {
  if (count <= 0) {
    return [];
  }

  if (count <= referenceTrailPositions.length) {
    return Array.from({ length: count }, (_, index) => {
      const referenceIndex = count === 1
        ? 2
        : Math.round((index * (referenceTrailPositions.length - 1)) / (count - 1));
      return referenceTrailPositions[referenceIndex];
    });
  }

  return Array.from({ length: count }, (_, index) => ({
    left: 10 + (80 * index) / (count - 1),
    top: extendedTrailLanes[index % extendedTrailLanes.length],
  }));
}

function createTrailPath(points: TrailPoint[]) {
  if (points.length === 0) {
    return "M 0 320";
  }

  const routePoints = [
    { left: 0, top: points[0].top },
    ...points,
    { left: 100, top: points[points.length - 1].top },
  ];
  const coordinates = routePoints.map((point) => ({ x: point.left * 10, y: point.top * 8 }));
  let path = `M ${coordinates[0].x} ${coordinates[0].y}`;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const distance = (current.x - previous.x) * 0.44;
    path += ` C ${previous.x + distance} ${previous.y}, ${current.x - distance} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export default function TodayDashboard(props: TodayDashboardProps) {
  const [completionCueVisible, setCompletionCueVisible] = createSignal(false);
  let trailPageElement: HTMLElement | undefined;
  let completionCueTimer: number | undefined;
  let arrivalCueShown = false;

  onMount(() => {
    if (!trailPageElement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let animationFrame = 0;
    const resetScene = () => {
      trailPageElement?.style.setProperty("--trail-scene-x", "0px");
      trailPageElement?.style.setProperty("--trail-scene-y", "0px");
    };
    const moveScene = (event: PointerEvent) => {
      if (animationFrame) {
        return;
      }
      animationFrame = window.requestAnimationFrame(() => {
        if (!trailPageElement) {
          return;
        }
        const bounds = trailPageElement.getBoundingClientRect();
        const x = clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
        const y = clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);
        trailPageElement.style.setProperty("--trail-scene-x", `${(x * 9).toFixed(2)}px`);
        trailPageElement.style.setProperty("--trail-scene-y", `${(y * 6).toFixed(2)}px`);
        animationFrame = 0;
      });
    };

    trailPageElement.addEventListener("pointermove", moveScene);
    trailPageElement.addEventListener("pointerleave", resetScene);
    onCleanup(() => {
      trailPageElement?.removeEventListener("pointermove", moveScene);
      trailPageElement?.removeEventListener("pointerleave", resetScene);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    });
  });

  onCleanup(() => {
    if (completionCueTimer !== undefined) {
      window.clearTimeout(completionCueTimer);
    }
  });

  const timerFinished = () =>
    props.timer().modeKey === "countdown" && props.timer().remainingMs === 0;

  const todayRecords = createMemo(() =>
    sortByTime(props.records().filter((record) => record.completedDate === props.todayDate)),
  );

  const completedTodayTodos = createMemo(() => {
    const linkedTodoIds = new Set(todayRecords().map((record) => record.linkedTodoId).filter((id): id is number => id !== null));
    return sortByTime(props.todayCompletedTodos().filter((item) => !linkedTodoIds.has(item.id)));
  });

  const trailSegments = createMemo<TrailSegment[]>(() => {
    const completedSegments: TrailSegment[] = [
      ...todayRecords().map((record) => ({
        key: `record-${record.id}`,
        title: record.linkedTodoTitle || record.title || "专注记录",
        time: formatRecordTime(record),
        completed: true,
        item: null,
        record,
      })),
      ...completedTodayTodos().map((item) => ({
        key: `completed-todo-${item.id}`,
        title: item.title,
        time: item.scheduledTime ? `${item.scheduledTime} · 已完成` : "已完成",
        completed: true,
        item,
        record: null,
      })),
    ];
    const upcomingSegments = sortByTime(props.todayTodos()).map((item) => ({
      key: `todo-${item.id}`,
      title: item.title,
      time: formatTodoTime(item),
      completed: false,
      item,
      record: null,
    }));

    if (completedSegments.length === 0 && upcomingSegments.length === 0) {
      return referenceTrailSlots.map((slot, index) => ({
        key: `reference-slot-${index + 1}`,
        title: slot.title,
        time: slot.time,
        completed: false,
        item: null,
        record: null,
      }));
    }

    return [...completedSegments, ...upcomingSegments];
  });

  const completedNodeCount = () => trailSegments().filter((segment) => segment.completed).length;

  const trailNodes = createMemo<TrailNode[]>(() => {
    const segments = trailSegments();
    const positions = createTrailPositions(segments.length);
    const isReferenceMode = segments[0]?.key === "reference-slot-1";
    const nextOpenIndex = segments.findIndex((segment) => !segment.completed);
    const activeIndex = isReferenceMode
      ? Math.min(4, segments.length - 1)
      : nextOpenIndex === -1 ? segments.length - 1 : nextOpenIndex;

    return segments.map((segment, index) => ({
      key: segment.key,
      index: index + 1,
      title: segment.title,
      time: segment.time,
      state: segment.completed ? "done" : index === activeIndex ? "current" : "upcoming",
      item: segment.item,
      record: segment.record,
      position: positions[index],
    }));
  });

  const trailTotalCount = () => trailNodes().length;
  const trailCanvasWidth = () => Math.max(954, trailTotalCount() * 230);
  const trailRoutePath = createMemo(() => createTrailPath(trailNodes().map((node) => node.position)));
  const activeTrailNode = createMemo(() => trailNodes().find((node) => node.state === "current"));
  const trailCompletion = () => trailTotalCount() === 0
    ? 0
    : Math.round((completedNodeCount() / trailTotalCount()) * 100);

  const focusTitle = () =>
    props.timerHasProgress()
      ? props.timer().activeTaskTitle || "当前专注"
      : activeTrailNode()?.title || "今日收尾";

  const focusSchedule = () =>
    props.timerHasProgress()
      ? props.timer().isRunning
        ? "这一轮正在进行 · 保持当前节奏"
        : "这一轮已暂停 · 可以继续回来"
      : activeTrailNode()?.time || "19:00 – 20:00 · 60 分钟";

  const focusDescription = () =>
    props.timerHasProgress()
      ? "把注意力交给眼前这一件事，其他事情稍后再处理。"
      : "梳理与总结，为今天画上句号。";

  const focusTime = () => {
    if (props.timerHasProgress()) {
      return props.timer().modeKey === "countdown" && props.timer().remainingMs !== null
        ? props.timer().remainingMs === 0
          ? "00:00"
          : props.timer().elapsedLabel.slice(-5)
        : props.timer().elapsedLabel.slice(-5);
    }

    // The reference screen uses a 45-minute next station. The real preference
    // still controls the timer after the user starts it.
    return "45:00";
  };

  const focusProgress = () => {
    const timer = props.timer();
    if (!props.timerHasProgress()) {
      return 0.68;
    }
    if (timer.modeKey === "countdown" && timer.targetDurationMs && timer.remainingMs !== null) {
      return clamp(1 - timer.remainingMs / timer.targetDurationMs, 0, 1);
    }
    return clamp(
      timer.elapsedMs / Math.max(timer.targetDurationMs ?? 45 * 60 * 1000, 45 * 60 * 1000),
      0,
      1,
    );
  };

  const panelTasks = createMemo<PanelTask[]>(() => {
    const liveTasks = props.todayTodos().slice(0, 3).map((item) => ({
      key: `todo-${item.id}`,
      title: item.title,
      duration: "20 分钟",
      item,
    }));

    if (liveTasks.length > 0) {
      return liveTasks;
    }

    return samplePanelTasks.map((title, index) => ({
      key: `sample-task-${index}`,
      title,
      duration: "20 分钟",
      item: null,
    }));
  });

  function showCompletionCue() {
    setCompletionCueVisible(true);
    if (completionCueTimer !== undefined) {
      window.clearTimeout(completionCueTimer);
    }
    completionCueTimer = window.setTimeout(() => setCompletionCueVisible(false), 7600);
  }

  async function finishWithCue() {
    await props.onFinish();
    showCompletionCue();
  }

  createEffect(() => {
    if (!arrivalCueShown && completedNodeCount() >= 3) {
      arrivalCueShown = true;
      showCompletionCue();
    }
  });

  return (
    <section class="today-page trail-page" ref={(element) => { trailPageElement = element; }}>
      <div class="trail-page__backdrop" aria-hidden="true">
        <div class="trail-page__backdrop-haze" />
        <div class="trail-page__backdrop-vignette" />
      </div>
      <header class="trail-page__heading">
        <div class="trail-page__date">
          <strong>{props.todayDate}</strong>
          <span>{weekdayFromLabel(props.todayLabel, props.todayDate)}</span>
        </div>
        <h1 aria-label="今天，从一件事开始">今日路径</h1>
        <p>专注让时间更清晰，你正在走出属于自己的节奏。</p>
      </header>

      <div class="trail-page__headline-actions">
        <div class="trail-streak">
          <span class="trail-streak__icon"><Flame size={23} strokeWidth={1.8} aria-hidden="true" /></span>
          <div>
            <strong>连续 {props.analytics()?.currentStreakDays ?? 0} 天</strong>
            <small>{props.analytics()?.currentStreakDays ? "保持节奏，继续前行。" : "从今天开始，走出第一段。"}</small>
          </div>
        </div>
        <button type="button" class="trail-link-button" onClick={props.onOpenRecords}>
          <BookOpen size={19} strokeWidth={1.6} aria-hidden="true" />
          <span>专注记录</span>
          <ArrowUpRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>

      <section class="trail-stage" aria-label="今日专注路径">
        <div class="trail-map">
          <div class="trail-map__viewport" aria-label="可横向浏览的专注路径">
            <div
              class="trail-map__canvas"
              style={{ width: `max(100%, ${trailCanvasWidth()}px)` }}
            >
              <svg class="trail-map__route" viewBox="0 0 1000 800" preserveAspectRatio="none" role="img" aria-label="今日专注节点路径">
                <defs>
                  <linearGradient id="trail-route-gradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stop-color="#e4a95b" />
                    <stop offset="0.62" stop-color="#efc36f" />
                    <stop offset="1" stop-color="#d2f2d4" />
                  </linearGradient>
                  <filter id="trail-route-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path class="trail-map__route-shadow" d={trailRoutePath()} />
                <path class="trail-map__route-line" d={trailRoutePath()} />
                <path class="trail-map__route-dash" d={trailRoutePath()} />
              </svg>

              <For each={trailNodes()}>
                {(node) => (
                  <button
                    type="button"
                    classList={{
                      "trail-node": true,
                      "trail-node--done": node.state === "done",
                      "trail-node--current": node.state === "current",
                      "trail-node--upcoming": node.state === "upcoming",
                    }}
                    style={{ left: `${node.position.left}%`, top: `${node.position.top}%` }}
                    aria-label={`${node.index}. ${node.title} · ${node.time}`}
                    disabled={props.busy()}
                    onClick={() => node.item ? props.onUseTodo(node.item) : node.record ? props.onOpenRecords() : props.onOpenFocus()}
                  >
                    <span class="trail-node__meta">
                      <b>{node.index}</b>
                      <strong>{node.title}</strong>
                      <small>{node.time}</small>
                    </span>
                    <span class="trail-node__orb" aria-hidden="true">
                      <Show when={node.state === "done"} fallback={<Show when={node.state === "current"}><span class="trail-node__current-dot" /></Show>}>
                        <Check size={19} strokeWidth={2.4} />
                      </Show>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="trail-map__footer">
            <div>
              <strong>已走 {completedNodeCount()} / {trailTotalCount()} 段</strong>
              <span>完成 {completedNodeCount()} 段专注，{trailTotalCount() > 5 ? "左右滑动查看更多。" : "继续前行。"}</span>
            </div>
            <div class="trail-map__progress" aria-label={`已完成 ${trailCompletion()}%`}>
              <span style={{ width: `${trailCompletion()}%` }} />
            </div>
          </div>
        </div>

        <aside classList={{ "trail-focus-panel": true, "trail-focus-panel--running": props.timer().isRunning }} aria-label="下一站专注">
          <div class="trail-focus-panel__topline">
            <span class="trail-live-indicator" aria-hidden="true" />
            <span>下一站</span>
            <kbd>Ctrl ↵</kbd>
          </div>
          <h2>{focusTitle()}</h2>
          <p class="trail-focus-panel__schedule">{focusSchedule()}</p>
          <p class="trail-focus-panel__description">{focusDescription()}</p>

          <div class="trail-timer" aria-label={`当前计时 ${focusTime()}`}>
            <svg class="trail-timer__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="trail-timer__track" cx="50" cy="50" r="42" />
              <circle class="trail-timer__arc" cx="50" cy="50" r="42" style={{ "stroke-dashoffset": `${264 - focusProgress() * 264}` }} />
            </svg>
            <div class="trail-timer__center">
              <strong>{focusTime()}</strong>
              <span>{props.timerHasProgress() ? props.timer().status : "▶ 准备开始"}</span>
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
                <span>继续这一轮</span>
                <kbd>Ctrl Enter</kbd>
              </button>
              <button type="button" class="trail-action trail-action--secondary" disabled={props.busy() || !props.timer().canCompleteSession} onClick={() => void finishWithCue()}>
                <CircleCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                完成并留下
              </button>
            </Show>
            <Show when={!props.timerHasProgress()}>
              <button
                type="button"
                class="trail-action trail-action--primary"
                aria-label="开始下一件事"
                disabled={props.busy() || !props.ready()}
                onClick={props.onStartNext}
              >
                <span>开始专注</span>
                <kbd>Ctrl Enter</kbd>
              </button>
            </Show>
          </div>

          <details class="trail-task-list" open>
            <summary>
              <span><ListChecks size={17} strokeWidth={1.7} aria-hidden="true" /> 本段任务 <b>{panelTasks().length}</b></span>
              <ChevronDown size={17} strokeWidth={1.7} aria-hidden="true" />
            </summary>
            <div class="trail-task-list__items">
              <For each={panelTasks()}>
                {(task) => (
                  <button
                    type="button"
                    class="trail-task-row"
                    disabled={props.busy() || props.timerHasProgress()}
                    aria-label={task.item ? `开始${task.title}` : task.title}
                    onClick={() => task.item ? props.onUseTodo(task.item) : props.onOpenTodos()}
                  >
                    <span class="trail-task-row__check" />
                    <strong>{task.title}</strong>
                    <small>{task.duration}</small>
                  </button>
                )}
              </For>
            </div>
          </details>
        </aside>

        <button type="button" class="trail-add-button" onClick={props.onOpenTodos}>
          <Plus size={20} strokeWidth={1.6} aria-hidden="true" />
          添加时段
        </button>
      </section>

      <Show when={completionCueVisible()}>
        <div class="trail-arrival-cue" role="status" aria-live="polite">
          <span class="trail-arrival-cue__icon"><Check size={19} strokeWidth={2.5} /></span>
          <span><strong>已到达 · +1 节点</strong><small>完成 {completedNodeCount()} 段专注，继续前行。</small></span>
          <button type="button" class="trail-arrival-cue__close" aria-label="关闭提示" onClick={() => setCompletionCueVisible(false)}>
            <X size={17} strokeWidth={1.7} />
          </button>
        </div>
      </Show>

      <span class="sr-only">{timerFinished() ? "倒计时已结束，请保存这一轮专注。" : ""}</span>
    </section>
  );
}
