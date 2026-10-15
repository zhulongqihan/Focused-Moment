import { For, Show } from "solid-js";
import "./FollowUpNotice.css";

interface FollowUpNoticeProps {
  tasks: () => { id: string; message: string }[];
  busy: () => boolean;
  onRetry: (id: string) => void | Promise<void>;
}

export default function FollowUpNotice(props: FollowUpNoticeProps) {
  return <Show when={props.tasks().length > 0}><div class="follow-up-notices"><For each={props.tasks()}>{(task) => (
    <div class="follow-up-notice" role="status" aria-live="polite">
      <span>{task.message}</span>
      <button type="button" class="text-button" disabled={props.busy()} onClick={() => void props.onRetry(task.id)}>重试后续步骤</button>
    </div>
  )}</For></div></Show>;
}
