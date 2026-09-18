import { For, Show } from "solid-js";
import { X } from "lucide-solid";
import type { TodoItem } from "../lib/contracts";

export interface FocusRecordEditDraft {
  id: number;
  title: string;
  durationMinutes: number;
  completedDate: string;
  completedTime: string;
  linkedTodoId: number | null;
}

interface FocusRecordEditDialogProps {
  open: boolean;
  draft: FocusRecordEditDraft | null;
  todos: TodoItem[];
  busy: boolean;
  onChange: (patch: Partial<FocusRecordEditDraft>) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
}

export default function FocusRecordEditDialog(props: FocusRecordEditDialogProps) {
  return (
    <Show when={props.open && props.draft}>
      {(draft) => (
        <div class="modal-backdrop focus-record-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
          <section class="focus-record-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-record-dialog-title">
            <header class="focus-record-dialog__header">
              <div><span>RECORD CORRECTION</span><h2 id="focus-record-dialog-title">编辑专注记录</h2><p>只修正记录本身，不改变关联待办的完成状态。</p></div>
              <button type="button" class="icon-button" aria-label="关闭编辑记录" onClick={props.onClose}><X size={18} /></button>
            </header>
            <div class="focus-record-dialog__form">
              <label><span>标题</span><input type="text" value={draft().title} maxlength="200" autofocus onInput={(event) => props.onChange({ title: event.currentTarget.value })} /></label>
              <label><span>时长（分钟）</span><input type="number" min="1" max="1440" value={draft().durationMinutes} onInput={(event) => props.onChange({ durationMinutes: Math.min(1440, Math.max(1, Number(event.currentTarget.value) || 1)) })} /></label>
              <label><span>完成日期</span><input type="date" value={draft().completedDate} onInput={(event) => props.onChange({ completedDate: event.currentTarget.value })} /></label>
              <label><span>完成时间（可选）</span><input type="time" value={draft().completedTime} onInput={(event) => props.onChange({ completedTime: event.currentTarget.value })} /></label>
              <label class="focus-record-dialog__wide"><span>关联任务（可选）</span><select value={draft().linkedTodoId ?? ""} onChange={(event) => props.onChange({ linkedTodoId: event.currentTarget.value ? Number(event.currentTarget.value) : null })}><option value="">不关联任务</option><For each={props.todos}>{(todo) => <option value={todo.id}>{todo.title}</option>}</For></select></label>
            </div>
            <footer class="focus-record-dialog__actions"><button type="button" class="secondary-button" disabled={props.busy} onClick={props.onClose}>取消</button><button type="button" class="primary-button" disabled={props.busy || !draft().title.trim() || !draft().completedDate} onClick={() => void props.onSubmit()}>保存修改</button></footer>
          </section>
        </div>
      )}
    </Show>
  );
}
