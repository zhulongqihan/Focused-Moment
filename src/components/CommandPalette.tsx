import { For, Show } from "solid-js";

export interface PaletteCommand {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
}

export interface CommandPaletteProps {
  open: () => boolean;
  search: () => string;
  commands: () => PaletteCommand[];
  inputRef: (element: HTMLInputElement) => void;
  onSearch: (value: string) => void;
  onClose: () => void;
  onExecute: (commandId: string) => void;
}

export default function CommandPalette(props: CommandPaletteProps) {
  const filteredCommands = () => {
    const query = props.search().trim().toLocaleLowerCase();
    return props.commands().filter((command) =>
      !query || `${command.label} ${command.detail}`.toLocaleLowerCase().includes(query)
    );
  };

  return (
    <Show when={props.open()}>
      <div class="command-palette-backdrop" onClick={props.onClose}>
        <section
          id="command-palette-dialog"
          class="command-palette"
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="command-palette__header">
            <div>
              <span>快速操作</span>
              <h2 id="command-palette-title">你想做什么？</h2>
            </div>
            <button type="button" class="icon-button" onClick={props.onClose} aria-label="关闭命令面板">
              Esc
            </button>
          </div>
          <input
            ref={props.inputRef}
            class="command-palette__input"
            type="search"
            value={props.search()}
            placeholder="输入操作或页面名称…"
            aria-label="搜索命令"
            autocomplete="off"
            onInput={(event) => props.onSearch(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const firstCommand = filteredCommands()[0];
                if (firstCommand) {
                  props.onExecute(firstCommand.id);
                }
              }
            }}
          />
          <div class="command-palette__list" role="listbox" aria-label="可用命令">
            <Show when={filteredCommands().length > 0} fallback={<p class="command-palette__empty">没有匹配的操作。</p>}>
              <For each={filteredCommands()}>
                {(command) => (
                  <button
                    type="button"
                    class="command-palette__item"
                    role="option"
                    onClick={() => props.onExecute(command.id)}
                  >
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </span>
                    <Show when={command.shortcut}>
                      <kbd>{command.shortcut}</kbd>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </div>
          <footer class="command-palette__footer">
            <span>Enter 执行</span>
            <span>Esc 关闭</span>
          </footer>
        </section>
      </div>
    </Show>
  );
}
