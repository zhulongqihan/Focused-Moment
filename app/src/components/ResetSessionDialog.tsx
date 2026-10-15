import { Show, type Accessor } from "solid-js";
import { useDialogFocus } from "../features/shared/useDialogFocus";

interface ResetSessionDialogProps {
  open: Accessor<boolean>;
  taskTitle: Accessor<string>;
  elapsedLabel: Accessor<string>;
  busy: Accessor<boolean>;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ResetSessionDialog(props: ResetSessionDialogProps) {
  const dialog = useDialogFocus({ open: props.open, busy: props.busy, onClose: props.onClose });

  return (
    <Show when={props.open()}>
      <div class="workflow-dialog-backdrop" role="presentation" onMouseDown={dialog.onBackdropMouseDown}>
        <section
          ref={dialog.setDialogRef}
          class="workflow-dialog"
          role="dialog"
          aria-modal="true"
          aria-busy={props.busy()}
          aria-labelledby="reset-session-title"
          aria-describedby="reset-session-description"
          data-focus-dialog
          tabIndex={-1}
          onKeyDown={dialog.onKeyDown}
        >
          <div class="workflow-dialog__eyebrow">FOCUS / RESET CURRENT SESSION</div>
          <h2 id="reset-session-title">重置本轮计时？</h2>
          <p id="reset-session-description">重置会清除当前进度，不会生成专注记录。</p>
          <div class="workflow-dialog__field">
            <span>本轮事项</span>
            <strong>{props.taskTitle().trim() || "独立计时"}</strong>
          </div>
          <div class="workflow-dialog__field">
            <span>当前累计时长</span>
            <strong>{props.elapsedLabel()}</strong>
          </div>
          <div class="workflow-dialog__actions">
            <button
              type="button"
              class="secondary-button"
              data-dialog-initial-focus
              disabled={props.busy()}
              onClick={dialog.requestClose}
            >
              保留本轮
            </button>
            <button
              type="button"
              class="primary-button"
              disabled={props.busy()}
              onClick={() => void props.onConfirm()}
            >
              {props.busy() ? "正在重置…" : "确认重置"}
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
