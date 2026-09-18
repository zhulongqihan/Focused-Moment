import { createEffect, createSignal, Show, type Accessor } from "solid-js";

interface ContinuationNotePromptProps {
  prompt: Accessor<{ todoId: number; title: string } | null>;
  error: Accessor<string>;
  busy: Accessor<boolean>;
  onSave: (id: number, note: string) => void | Promise<void>;
  onSkip: () => void;
}

export default function ContinuationNotePrompt(props: ContinuationNotePromptProps) {
  const [note, setNote] = createSignal("");
  createEffect(() => {
    props.prompt()?.todoId;
    setNote("");
  });

  return (
    <Show when={props.prompt()}>
      {(prompt) => (
        <section class="continuation-prompt" role="dialog" aria-label="保存停笔书签">
          <div>
            <span class="continuation-prompt__eyebrow">NEXT MARK / 下次继续</span>
            <strong>“{prompt().title}”</strong>
            <p>这一轮已经记下来了。下次从哪里继续？</p>
          </div>
          <Show when={props.error()}><p class="continuation-prompt__error" role="alert">{props.error()}</p></Show>
          <textarea value={note()} placeholder="例如：从第三段的例子开始" onInput={(event) => setNote(event.currentTarget.value)} />
          <div class="continuation-prompt__actions">
            <button type="button" class="text-button" disabled={props.busy()} onClick={props.onSkip}>暂不记录</button>
            <button type="button" class="primary-button" disabled={props.busy() || !note().trim()} onClick={() => void props.onSave(prompt().todoId, note())}>{props.error() ? "重试保存" : "保存下次位置"}</button>
          </div>
        </section>
      )}
    </Show>
  );
}
