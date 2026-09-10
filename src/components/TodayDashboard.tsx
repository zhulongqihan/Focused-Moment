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

function appendHardTrailLeg(route: TrailCoordinate[], from: TrailCoordinate, to: TrailCoordinate, legIndex: number) {
  const deltaX = to.x - from.x;
  if (Math.abs(deltaX) < 1) {
    pushTrailCoordinate(route, to);
    return;
  }

  const detourDistance = Math.min(150, Math.max(104, Math.abs(to.y - from.y) + 72));
  const detourY = clamp(
    (from.y + to.y) / 2 + (legIndex % 2 === 0 ? -detourDistance : detourDistance),
    72,
    728,
  );

  // The short backtrack before each horizontal run creates deliberate
  // switchbacks instead of another rounded Bézier wave.  Two of these turns
  // are over 90 degrees per leg; the single-node route below adds two more.
  pushTrailCoordinate(route, { x: from.x + deltaX * 0.28, y: from.y });
  pushTrailCoordinate(route, { x: from.x + deltaX * 0.12, y: detourY });
  pushTrailCoordinate(route, { x: from.x + deltaX * 0.62, y: detourY });
  pushTrailCoordinate(route, { x: to.x - deltaX * 0.14, y: to.y });
  pushTrailCoordinate(route, to);
}

function trailCoordinatesToPath(points: TrailCoordinate[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function createTrailPath(points: TrailPoint[]) {
  if (points.length === 0) {
    return "M 0 320";
  }

  const coordinates = points.map((point) => ({ x: point.left * 10, y: point.top * 8 }));

  if (points.length === 1) {
    const point = coordinates[0];
    const startY = clamp(point.y + 112, 72, 728);
    const upperY = clamp(point.y - 110, 72, 728);
    const lowerY = clamp(point.y + 126, 72, 728);
    const route: TrailCoordinate[] = [{ x: 0, y: startY }];

    // Keep the single real node as the semantic endpoint, but give the route
    // four visible >90° switchbacks before it reaches that node.
    pushTrailCoordinate(route, { x: point.x * 0.25, y: startY });
    pushTrailCoordinate(route, { x: point.x * 0.1, y: upperY });
    pushTrailCoordinate(route, { x: point.x * 0.55, y: upperY });
    pushTrailCoordinate(route, { x: point.x * 0.38, y: lowerY });
    pushTrailCoordinate(route, { x: point.x * 0.78, y: lowerY });
    pushTrailCoordinate(route, point);
    return trailCoordinatesToPath(route);
  }

  const route: TrailCoordinate[] = [{ x: 0, y: coordinates[0].y }];
  coordinates.forEach((coordinate, index) => {
    appendHardTrailLeg(route, route[route.length - 1], coordinate, index);
  });
  appendHardTrailLeg(
    route,
    route[route.length - 1],
    { x: 1000, y: coordinates[coordinates.length - 1].y },
    coordinates.length,
  );

  return trailCoordinatesToPath(route);
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
  const activeTrailNode = createMemo(() => trailNodes().find((node) => node.state === "current"));

  const focusTitle = () =>
    props.timerHasProgress()
      ? props.timer().activeTaskTitle || "当前专注"
      : activeTrailNode()?.title || "下一段专注";

  const focusSchedule = () =>
    props.timerHasProgress()
      ? props.timer().isRunning
        ? "这一轮正在进行 · 保持当前节奏"
        : "这一轮已暂停 · 可以继续回来"
      : activeTrailNode()?.time || "准备好后再走一段";

  const focusDescription = () =>
    props.timerHasProgress()
      ? "把注意力交给眼前这一件事，其他事情稍后再处理。"
      : activeTrailNode()?.item
        ? "下一段从这里开始，完成后会留在今天的路径里。"
        : activeTrailNode()
          ? "从一段专注开始，为今天留下一个清晰的坐标。"
          : completedNodeCount() > 0
            ? "今天的路径已经留下坐标，想继续就再走一段。"
            : "准备好后，从今天的第一段开始。";

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

        <aside classList={{ "trail-focus-panel": true, "trail-focus-panel--running": props.timer().isRunning }} aria-label="下一站信息">
          <div class="trail-focus-panel__topline">
            <span class="trail-live-indicator" aria-hidden="true" />
            <span>{props.timerHasProgress() ? "当前一段" : "下一站"}</span>
          </div>
          <h2>{focusTitle()}</h2>
          <p class="trail-focus-panel__schedule">{focusSchedule()}</p>
          <p class="trail-focus-panel__description">{focusDescription()}</p>

          <div class="trail-focus-panel__waypoint">
            <span>{props.timerHasProgress() ? "当前状态" : "路径节点"}</span>
            <strong>
              {props.timerHasProgress()
                ? props.timer().status
                : activeTrailNode()
                  ? `第 ${activeTrailNode()!.index} 段`
                  : "准备开始"}
            </strong>
          </div>

          <button type="button" class="trail-action trail-action--primary trail-focus-panel__focus-link" onClick={props.onOpenFocus}>
            <span>{props.timerHasProgress() ? "查看当前计时" : "查看计时"}</span>
            <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>

          <div class="trail-focus-panel__quiet-note">
            {activeTrailNode()?.item
              ? "完成这段后，它会成为今天的新坐标。"
              : "每一次完成，都会成为今天的新坐标。"}
          </div>

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
