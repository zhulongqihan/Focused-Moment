import { Show, type Accessor } from "solid-js";
import { isComposingKey, useDialogFocus } from "../features/shared/useDialogFocus";

interface QuickCaptureDialogProps {
  open: Accessor<boolean>;
  title: Accessor<string>;
  busy: Accessor<boolean>;
  onTitleChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}

export default function QuickCaptureDialog(props: QuickCaptureDialogProps) {
  const dialog = useDialogFocus({ open: props.open, busy: props.busy, onClose: props.onClose });
  const save = () => {
    if (!props.busy() && props.title().trim()) void props.onSave();
  };
  return (
    <Show when={props.open()}>
      <div class="workflow-dialog-backdrop" role="presentation" onMouseDown={dialog.onBackdropMouseDown}>
        <section ref={dialog.setDialogRef} class="workflow-dialog" role="dialog" aria-modal="true" aria-busy={props.busy()} aria-labelledby="quick-capture-title" data-focus-dialog tabIndex={-1} onKeyDown={dialog.onKeyDown}>
          <div class="workflow-dialog__eyebrow">INBOX / QUICK CAPTURE</div>
          <h2 id="quick-capture-title">先记下来，稍后再整理</h2>
          <p>不填日期、不填优先级也可以。它会进入“收件箱 · 未安排”。</p>
          <label class="workflow-dialog__field">
            <span>想记住什么？</span>
            <input
              data-dialog-initial-focus
              value={props.title()}
              placeholder="例如：把刚才想到的开头记下来"
              onInput={(event) => props.onTitleChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isComposingKey(event)) {
                  event.preventDefault();
                  event.stopPropagation();
                  save();
                }
              }}
            />
          </label>
          <div class="workflow-dialog__actions">
            <button type="button" class="secondary-button" disabled={props.busy()} onClick={dialog.requestClose}>取消</button>
            <button type="button" class="primary-button" disabled={props.busy() || !props.title().trim()} onClick={save}>
              {props.busy() ? "正在收进…" : "放入收件箱"}
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
