import { createEffect, createSignal, For, Show, type Accessor } from "solid-js";
import type { TodoItem } from "../lib/contracts";

export interface ManualFocusRecordPayload {
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
}

interface ManualFocusRecordDialogProps {
  open: Accessor<boolean>;
  busy: Accessor<boolean>;
  todayDate: string;
  todos: Accessor<TodoItem[]>;
  onSubmit: (payload: ManualFocusRecordPayload) => void | Promise<void>;
  onClose: () => void;
}

export default function ManualFocusRecordDialog(props: ManualFocusRecordDialogProps) {
  const [title, setTitle] = createSignal("");
  const [durationMinutes, setDurationMinutes] = createSignal(25);
  const [completedDate, setCompletedDate] = createSignal(props.todayDate);
  const [completedTime, setCompletedTime] = createSignal("");
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);

  createEffect(() => {
    if (props.open()) {
      setTitle("");
      setDurationMinutes(25);
      setCompletedDate(props.todayDate);
      setCompletedTime("");
      setLinkedTodoId(null);
    }
  });

  function submit() {
    const normalizedTitle = title().trim();
    const minutes = Math.round(Number(durationMinutes()));
    if (!normalizedTitle || !completedDate() || minutes < 1 || minutes > 1440) return;
    void props.onSubmit({
      title: normalizedTitle,
      durationMinutes: minutes,
      completedDate: completedDate(),
      completedTime: completedTime(),
      linkedTodoId: linkedTodoId(),
    });
  }

  return (
    <Show when={props.open()}>
      <div class="workflow-dialog-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}>
        <section class="workflow-dialog workflow-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="manual-record-title">
          <div class="workflow-dialog__eyebrow">RECORDS / MANUAL ENTRY</div>
          <h2 id="manual-record-title">补录一段专注</h2>
          <p>记录归属于完成日，不会根据时长推算跨午夜区间。</p>
          <div class="workflow-dialog__grid">
            <label class="workflow-dialog__field workflow-dialog__field--wide"><span>标题</span><input autofocus value={title()} onInput={(event) => setTitle(event.currentTarget.value)} /></label>
            <label class="workflow-dialog__field"><span>时长（分钟）</span><input type="number" min="1" max="1440" value={durationMinutes()} onInput={(event) => setDurationMinutes(Number(event.currentTarget.value))} /></label>
            <label class="workflow-dialog__field"><span>完成日期</span><input type="date" value={completedDate()} onInput={(event) => setCompletedDate(event.currentTarget.value)} /></label>
            <label class="workflow-dialog__field"><span>完成时间（可选）</span><input type="time" value={completedTime()} onInput={(event) => setCompletedTime(event.currentTarget.value)} /></label>
            <label class="workflow-dialog__field workflow-dialog__field--wide"><span>关联任务（可选）</span><select value={linkedTodoId() ?? ""} onChange={(event) => setLinkedTodoId(event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">不关联任务</option><For each={props.todos()}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
          </div>
          <div class="workflow-dialog__actions">
            <button type="button" class="secondary-button" disabled={props.busy()} onClick={props.onClose}>取消</button>
            <button type="button" class="primary-button" disabled={props.busy() || !title().trim() || !completedDate() || durationMinutes() < 1 || durationMinutes() > 1440} onClick={submit}>补录记录</button>
          </div>
        </section>
      </div>
    </Show>
  );
}
