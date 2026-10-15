import type { TimerSnapshot } from "../../lib/contracts";

export type HomeFocusActionKind = "start" | "pause" | "continue" | "finish" | "add";

export function resolveHomeFocusAction(input: {
  timer: TimerSnapshot;
  ready: boolean;
  busy: boolean;
  hasNextTodo: boolean;
}) {
  const { timer } = input;
  const canFinish = timer.hasUnsubmittedProgress && timer.elapsedMs > 0 && timer.canCompleteSession;
  const ended = timer.hasUnsubmittedProgress && timer.modeKey === "countdown" && timer.remainingMs === 0;
  const kind: HomeFocusActionKind = ended ? "finish"
    : timer.isRunning ? "pause"
      : timer.hasUnsubmittedProgress ? "continue"
        : input.hasNextTodo ? "start" : "add";
  const labels: Record<HomeFocusActionKind, string> = {
    start: "开始专注",
    pause: "暂停专注",
    continue: "继续专注",
    finish: "完成并记录",
    add: "快速记事",
  };
  return {
    kind,
    label: labels[kind],
    disabled: !input.ready || input.busy || (kind === "finish" && !canFinish),
    showFinish: timer.hasUnsubmittedProgress && kind !== "finish",
    finishDisabled: !input.ready || input.busy || !canFinish,
    status: ended ? "已结束 · 待保存" : timer.isRunning ? "专注进行中" : timer.hasUnsubmittedProgress ? "已暂停" : "准备开始",
  };
}

export function homeFocusTime(timer: TimerSnapshot) {
  const milliseconds = timer.modeKey === "countdown" && timer.remainingMs !== null
    ? timer.remainingMs : timer.elapsedMs;
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}
