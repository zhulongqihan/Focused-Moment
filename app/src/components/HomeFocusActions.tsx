import { Show, createMemo, type JSX } from "solid-js";
import type { TodaySurfaceProps } from "../lib/theme-contracts";
import { homeFocusTime, resolveHomeFocusAction, type HomeFocusActionKind } from "../features/shared/home-focus-action";
import "./HomeFocusActions.css";

interface HomeFocusActionsProps extends TodaySurfaceProps {
  primaryClass: string;
  finishClass: string;
  primaryContent?: (action: { kind: HomeFocusActionKind; label: string }) => JSX.Element;
}

/** A fragment preserves each theme's existing button placement and direct-child styles. */
export default function HomeFocusActions(props: HomeFocusActionsProps) {
  const action = createMemo(() => resolveHomeFocusAction({
    timer: props.timer(), ready: props.ready(), busy: props.busy(), hasNextTodo: Boolean(props.nextTodo() && !props.nextTodo()!.isCompleted),
  }));
  function performPrimary() {
    if (action().disabled) return;
    switch (action().kind) {
      case "pause": return props.onPause();
      case "continue": return props.onContinue();
      case "finish": return props.onFinish();
      case "start": {
        const item = props.nextTodo();
        if (item && !item.isCompleted) return props.onStartTodo(item);
        return;
      }
      case "add": return props.onQuickCapture();
    }
  }
  return <>
    <button type="button" class={props.primaryClass} data-home-focus-primary={action().kind}
      aria-label={action().label} disabled={action().disabled} onClick={() => void performPrimary()}>
      {props.primaryContent ? props.primaryContent(action()) : action().label}
    </button>
    <Show when={action().showFinish}>
      <button type="button" class={`${props.finishClass} home-focus-save`} data-home-focus-save
        disabled={action().finishDisabled} onClick={() => { if (!action().finishDisabled) void props.onFinish(); }}>
        完成并记录
      </button>
    </Show>
  </>;
}

export function HomeFocusStatus(props: TodaySurfaceProps) {
  const state = () => resolveHomeFocusAction({ timer: props.timer(), ready: props.ready(), busy: props.busy(), hasNextTodo: Boolean(props.nextTodo() && !props.nextTodo()!.isCompleted) });
  return <Show when={props.timerHasProgress()}>
    <div class="home-focus-status" aria-label="当前专注状态">
      <strong>{props.timer().activeTaskTitle || "当前专注"}</strong>
      <span>{state().status} · {props.timer().modeKey === "countdown" ? "剩余" : "已用"} {homeFocusTime(props.timer())}</span>
    </div>
  </Show>;
}
