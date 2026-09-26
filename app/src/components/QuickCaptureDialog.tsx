import { Show, type Accessor } from "solid-js";

interface QuickCaptureDialogProps {
  open: Accessor<boolean>;
  title: Accessor<string>;
  busy: Accessor<boolean>;
  onTitleChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}

export default function QuickCaptureDialog(props: QuickCaptureDialogProps) {
  return (
    <Show when={props.open()}>
      <div class="workflow-dialog-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}>
        <section class="workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-capture-title">
          <div class="workflow-dialog__eyebrow">INBOX / QUICK CAPTURE</div>
          <h2 id="quick-capture-title">先记下来，稍后再整理</h2>
          <p>不填日期、不填优先级也可以。它会进入“收件箱 · 未安排”。</p>
          <label class="workflow-dialog__field">
            <span>想记住什么？</span>
            <input
              autofocus
              value={props.title()}
              placeholder="例如：把刚才想到的开头记下来"
              onInput={(event) => props.onTitleChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.isComposing) {
                  event.preventDefault();
                  void props.onSave();
                }
                if (event.key === "Escape") props.onClose();
              }}
            />
          </label>
          <div class="workflow-dialog__actions">
            <button type="button" class="secondary-button" disabled={props.busy()} onClick={props.onClose}>取消</button>
            <button type="button" class="primary-button" disabled={props.busy() || !props.title().trim()} onClick={() => void props.onSave()}>
              {props.busy() ? "正在收进…" : "放入收件箱"}
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
