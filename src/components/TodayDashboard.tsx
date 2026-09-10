import { For, Show, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
} from "lucide-solid";
import type { AnalyticsSnapshot, FocusRecord, TodoImportance, TodoItem, TimerSnapshot } from "../lib/contracts";
import { NightValleyClock } from "./NightValleyDateStamp";

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

interface TrailCoordinate {
  x: number;
  y: number;
}

interface TrailSegment {
  key: string;
  title: string;
  time: string;
  completed: boolean;
  item: TodoItem | null;
  record: FocusRecord | null;
}

const referenceTrailPositions: TrailPoint[] = [
  { left: 10, top: 34 },
  { left: 28, top: 49 },
  { left: 45, top: 40 },
  { left: 63, top: 57 },
  { left: 81, top: 46 },
];

const extendedTrailLanes = [34, 47, 54, 63, 68, 60, 48, 61];
const extendedReferenceTrailPositions: TrailPoint[] = [
  { left: 10, top: 34 },
  { left: 22, top: 47 },
  { left: 35, top: 54 },
  { left: 48, top: 63 },
  { left: 60, top: 68 },
  { left: 72, top: 60 },
  { left: 84, top: 48 },
  { left: 96, top: 61 },
];

const compactTrailPositions: Record<number, TrailPoint[]> = {
  1: [{ left: 50, top: 38 }],
  2: [
    { left: 20, top: 38 },
    { left: 72, top: 52 },
  ],
  3: [
    { left: 14, top: 37 },
    { left: 45, top: 53 },
    { left: 78, top: 43 },
  ],
  4: [
    { left: 12, top: 35 },
    { left: 37, top: 51 },
    { left: 62, top: 41 },
    { left: 84, top: 56 },
  ],
};

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

function formatDurationMs(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":");
}

function formatRecordsDuration(records: FocusRecord[]) {
  return formatDurationMs(records.reduce((total, record) => total + record.durationMs, 0));
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

  if (count < referenceTrailPositions.length) {
    return compactTrailPositions[count].map((point) => ({ ...point }));
  }

  if (count === referenceTrailPositions.length) {
    return referenceTrailPositions.map((point) => ({ ...point }));
  }

  if (count <= extendedReferenceTrailPositions.length) {
    return extendedReferenceTrailPositions.slice(0, count).map((point) => ({ ...point }));
  }

  return Array.from({ length: count }, (_, index) => ({
    left: 8 + (83 * index) / (count - 1),
    top: extendedTrailLanes[index % extendedTrailLanes.length],
  }));
}

function pushTrailCoordinate(route: TrailCoordinate[], point: TrailCoordinate) {
  const previous = route[route.length - 1];
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5) {
    route.push(point);
  }
}

function appendWindingTrailLeg(
  route: TrailCoordinate[],
  from: TrailCoordinate,
  to: TrailCoordinate,
  legIndex: number,
  guideCount: number,
) {
  const deltaX = to.x - from.x;
  if (Math.abs(deltaX) < 1) {
    pushTrailCoordinate(route, to);
    return;
  }

  const waveOffsets = [0.76, -0.44, 0.62, -0.7, 0.52, -0.34, 0.58, -0.46];
  const amplitude = clamp(50 + Math.abs(to.y - from.y) * 0.3, 54, 108);
  const direction = legIndex % 2 === 0 ? 1 : -1;

  for (let index = 1; index <= guideCount; index += 1) {
    const fraction = index / (guideCount + 1);
    const baseline = from.y + (to.y - from.y) * fraction;
    const offset = waveOffsets[(index - 1 + legIndex) % waveOffsets.length];
    pushTrailCoordinate(route, {
      x: from.x + deltaX * fraction,
      y: clamp(baseline + direction * amplitude * offset, 64, 736),
    });
  }

  pushTrailCoordinate(route, to);
}

function trailCoordinatesToSmoothPath(points: TrailCoordinate[]) {
  if (points.length === 0) {
    return "M 0 320";
  }

  if (points.length === 1) {
    return "M " + points[0].x + " " + points[0].y;
  }

  const tension = 0.9;
  const segments = points.slice(0, -1).map((point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const after = points[index + 2] ?? next;
    const controlOne = {
      x: point.x + ((next.x - previous.x) * tension) / 6,
      y: point.y + ((next.y - previous.y) * tension) / 6,
    };
    const controlTwo = {
      x: next.x - ((after.x - point.x) * tension) / 6,
      y: next.y - ((after.y - point.y) * tension) / 6,
    };
    return [
      "C",
      controlOne.x,
      controlOne.y,
      controlTwo.x,
      controlTwo.y,
      next.x,
      next.y,
    ].join(" ");
  });

  return ["M", points[0].x, points[0].y, ...segments].join(" ");
}

function createTrailPath(points: TrailPoint[]) {
  if (points.length === 0) {
    return "M 0 320";
  }

  const coordinates = points.map((point) => ({ x: point.left * 10, y: point.top * 8 }));
  const startY = clamp(coordinates[0].y + (points.length === 1 ? 96 : 60), 72, 728);
  const guideCount = points.length === 1 ? 7 : points.length <= 3 ? 4 : 2;
  const route: TrailCoordinate[] = [{ x: 0, y: startY }];
  coordinates.forEach((coordinate, index) => {
    appendWindingTrailLeg(route, route[route.length - 1], coordinate, index, guideCount);
  });

  const lastPoint = coordinates[coordinates.length - 1];
  appendWindingTrailLeg(
    route,
    route[route.length - 1],
    { x: 1000, y: clamp(lastPoint.y + (points.length % 2 === 0 ? -32 : 28), 72, 728) },
    coordinates.length,
    points.length === 1 ? 7 : 3,
  );

  return trailCoordinatesToSmoothPath(route);
}

export default function TodayDashboard(props: TodayDashboardProps) {
  let trailPageElement: HTMLElement | undefined;
  let trailViewportElement: HTMLDivElement | undefined;
  let trailScrollFrame: number | undefined;
  let previousReadyTrailCount: number | null = null;
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
    if (trailScrollFrame !== undefined) {
      window.cancelAnimationFrame(trailScrollFrame);
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

  const todayFocusDurationLabel = createMemo(() =>
    props.analytics()?.todayFocusDurationLabel || formatRecordsDuration(todayRecords()),
  );
  const todaySessionCount = createMemo(() => props.analytics()?.todaySessionCount ?? todayRecords().length);
  const todayStreakDays = createMemo(() => props.analytics()?.currentStreakDays ?? 0);
  const todayTodoCompletionCount = createMemo(() => props.todayCompletedTodos().length);
  const todayTodoTotal = createMemo(() => todayTodoCompletionCount() + props.todayTodos().length);
  const todayTodoCompletionRate = createMemo(() => {
    const total = todayTodoTotal();
    return total === 0 ? 0 : Math.round((todayTodoCompletionCount() / total) * 100);
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
      return [{
        key: "empty-start",
        title: "今天的第一段",
        time: "准备开始",
        completed: false,
        item: null,
        record: null,
      }];
    }

    return [...completedSegments, ...upcomingSegments];
  });

  const completedNodeCount = () => trailSegments().filter((segment) => segment.completed).length;

  const trailNodes = createMemo<TrailNode[]>(() => {
    const segments = trailSegments();
    const positions = createTrailPositions(segments.length);
    const nextOpenIndex = segments.findIndex((segment) => !segment.completed);
    const activeIndex = nextOpenIndex === -1 ? segments.length - 1 : nextOpenIndex;

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
  // Keep the first eight real segments inside the reference rhythm. Once the
  // route grows beyond that, the viewport becomes horizontally scrollable
  // instead of shrinking labels until they overlap.
  const trailCanvasWidth = () => Math.max(1080, 110 + Math.max(0, trailTotalCount() - 1) * 134);
  const trailRoutePath = createMemo(() => createTrailPath(trailNodes().map((node) => node.position)));

  createEffect(() => {
    if (!props.ready()) {
      previousReadyTrailCount = null;
      return;
    }

    const nodes = trailNodes();
    const viewport = trailViewportElement;
    if (previousReadyTrailCount === null) {
      previousReadyTrailCount = nodes.length;
      return;
    }

    const grewSinceReady = nodes.length > previousReadyTrailCount;
    previousReadyTrailCount = nodes.length;
    if (!grewSinceReady) {
      return;
    }

    const activeIndex = nodes.findIndex((node) => node.state === "current");
    if (!viewport || nodes.length <= referenceTrailPositions.length || activeIndex <= 0) {
      return;
    }

    const activeElement = viewport.querySelector<HTMLElement>(`[data-trail-index="${activeIndex + 1}"]`);
    if (!activeElement) {
      return;
    }

    if (trailScrollFrame !== undefined) {
      window.cancelAnimationFrame(trailScrollFrame);
    }
    trailScrollFrame = window.requestAnimationFrame(() => {
      if (!trailViewportElement || !activeElement.isConnected) {
        return;
      }
      const maxScrollLeft = Math.max(0, trailViewportElement.scrollWidth - trailViewportElement.clientWidth);
      const targetScrollLeft = clamp(
        activeElement.offsetLeft - trailViewportElement.clientWidth * 0.56,
        0,
        maxScrollLeft,
      );
      trailViewportElement.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      trailScrollFrame = undefined;
    });
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
          <NightValleyClock className="trail-page__clock" />
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
          <div class="trail-map__atmosphere trail-map__atmosphere--light" aria-hidden="true" />
          <div class="trail-map__atmosphere trail-map__atmosphere--mist" aria-hidden="true" />
          <div class="trail-map__atmosphere trail-map__atmosphere--foreground" aria-hidden="true" />
          <div
            class="trail-map__viewport"
            aria-label="可横向浏览的专注路径"
            ref={(element) => { trailViewportElement = element; }}
          >
            <div
              class="trail-map__canvas"
              data-trail-count={trailTotalCount()}
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
                <path class="trail-map__route-depth" d={trailRoutePath()} />
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
                    data-trail-index={node.index}
                    aria-label={`${node.index}. ${node.title} · ${node.time}`}
                    disabled={props.busy()}
                    onClick={() => node.item ? props.onUseTodo(node.item) : node.record ? props.onOpenRecords() : props.onOpenFocus()}
                  >
                    <span
                      classList={{
                        "trail-node__meta": true,
                        "trail-node__meta--start": node.position.left <= 15,
                        "trail-node__meta--end": node.position.left >= 85,
                        "trail-node__meta--below": node.position.top <= 28,
                      }}
                    >
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

          <Show when={trailTotalCount() > 5}>
            <div class="trail-map__viewport-controls" aria-label="浏览专注路径">
              <button
                type="button"
                aria-label="查看前面的专注节点"
                onClick={() => trailViewportElement?.scrollBy({ left: -280, behavior: "smooth" })}
              >
                <ChevronLeft size={17} strokeWidth={1.7} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="查看后面的专注节点"
                onClick={() => trailViewportElement?.scrollBy({ left: 280, behavior: "smooth" })}
              >
                <ChevronRight size={17} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </div>
          </Show>

          <div class="trail-map__footer">
            <div>
              <strong>{completedNodeCount() > 0 ? `今天已完成 ${completedNodeCount()} 段专注，继续保持这条节奏` : "今天的第一段，从这里开始"}</strong>
              <span>{completedNodeCount() > 0 ? "继续保持这条节奏。" : "准备好后，开始你的第一段专注。"}</span>
            </div>
            <Show when={trailTotalCount() > 5}>
              <span class="trail-map__scroll-hint">左右滑动，继续看见后面的路</span>
            </Show>
            <div class="trail-map__trace" aria-hidden="true">
              <For each={trailNodes()}>
                {(node) => (
                  <span classList={{
                    "trail-map__trace-node": true,
                    "trail-map__trace-node--done": node.state === "done",
                  }} />
                )}
              </For>
            </div>
          </div>
        </div>

        <aside class="trail-focus-panel trail-focus-panel--overview" aria-label="今日概览">
          <div class="trail-focus-panel__topline">
            <span class="trail-live-indicator" aria-hidden="true" />
            <span>今日数据</span>
          </div>
          <h2>今日概览</h2>

          <div class="trail-overview-lead">
            <span>今天的投入</span>
            <strong>{todayFocusDurationLabel()}</strong>
            <small>{todaySessionCount()} 段专注 · 连续 {todayStreakDays()} 天</small>
          </div>

          <div class="trail-overview-stats">
            <div>
              <span>专注段数</span>
              <strong>{todaySessionCount()}</strong>
              <small>今天已完成</small>
            </div>
            <div>
              <span>连续节奏</span>
              <strong>{todayStreakDays()} 天</strong>
              <small>{todayStreakDays() > 0 ? "连续记录" : "从今天开始"}</small>
            </div>
          </div>

          <div class="trail-overview-progress-block">
            <div class="trail-overview-progress-heading">
              <span>待办进度</span>
              <strong>
                {todayTodoTotal() > 0
                  ? String(todayTodoCompletionCount()) + " / " + String(todayTodoTotal())
                  : "—"}
              </strong>
            </div>
            <div
              class="trail-overview-progress"
              role="progressbar"
              aria-label="今日待办完成进度"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={todayTodoCompletionRate()}
            >
              <span style={{ width: String(todayTodoCompletionRate()) + "%" }} />
            </div>
            <small>
              {todayTodoTotal() > 0
                ? "完成 " + String(todayTodoCompletionRate()) + "% · 今日安排"
                : "今天还没有安排待办"}
            </small>
          </div>

          <div class="trail-focus-panel__quiet-note">每一段专注都会留在今天的路径里。</div>
        </aside>

        <button type="button" class="trail-add-button" onClick={props.onOpenTodos}>
          <Plus size={20} strokeWidth={1.6} aria-hidden="true" />
          添加时段
        </button>
      </section>

      <span class="sr-only">{timerFinished() ? "倒计时已结束，请保存这一轮专注。" : ""}</span>
    </section>
  );
}
