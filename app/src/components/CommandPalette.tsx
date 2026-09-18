import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

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
  const filteredCommands = createMemo(() => {
    const query = props.search().trim().toLocaleLowerCase();
    return props.commands().filter((command) =>
      !query || `${command.label} ${command.detail}`.toLocaleLowerCase().includes(query)
    );
  });
  const [activeIndex, setActiveIndex] = createSignal(0);

  createEffect(() => {
    props.open();
    props.search();
    setActiveIndex(0);
  });

  createEffect(() => {
    const commandCount = filteredCommands().length;
    if (commandCount === 0) {
      setActiveIndex(0);
    } else if (activeIndex() >= commandCount) {
      setActiveIndex(commandCount - 1);
    }
  });

  const activeCommand = () => filteredCommands()[activeIndex()] ?? null;
  const activeCommandId = () => (activeCommand() ? `command-palette-option-${activeCommand()!.id}` : undefined);

  function moveActive(delta: number) {
    const commandCount = filteredCommands().length;
    if (commandCount === 0) {
      return;
    }

    setActiveIndex((current) => (current + delta + commandCount) % commandCount);
  }

  function executeActive() {
    const command = activeCommand();
    if (command) {
      props.onExecute(command.id);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        if (filteredCommands().length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (filteredCommands().length > 0) {
          event.preventDefault();
          setActiveIndex(filteredCommands().length - 1);
        }
        break;
      case "Enter":
        event.preventDefault();
        executeActive();
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        props.onClose();
        break;
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent) {
    if (event.key !== "Tab") {
      return;
    }

    cycleFocus(event, event.currentTarget as HTMLElement);
  }

  function cycleFocus(event: KeyboardEvent, currentElement: HTMLElement) {
    const dialog = currentElement.closest<HTMLElement>("[role='dialog']");
    if (!dialog) {
      return;
    }

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]):not([role='option']), input:not([disabled])"));
    if (focusable.length === 0) {
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
      : currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;

    event.preventDefault();
    event.stopPropagation();
    focusable[nextIndex]?.focus();
  }

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
          onKeyDown={handleDialogKeyDown}
        >
          <div class="command-palette__header">
            <div>
              <span>快速操作</span>
              <h2 id="command-palette-title">你想做什么？</h2>
            </div>
            <button
              type="button"
              class="icon-button"
              onClick={props.onClose}
              onKeyDown={(event) => {
                if (event.key === "Tab") {
                  cycleFocus(event, event.currentTarget as HTMLElement);
                }
              }}
              aria-label="关闭命令面板"
            >
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
            aria-controls="command-palette-list"
            aria-activedescendant={activeCommandId()}
            autocomplete="off"
            onInput={(event) => props.onSearch(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                cycleFocus(event, event.currentTarget as HTMLElement);
              } else {
                handleInputKeyDown(event);
              }
            }}
          />
          <div id="command-palette-list" class="command-palette__list" role="listbox" aria-label="可用命令">
            <Show when={filteredCommands().length > 0} fallback={<p class="command-palette__empty">没有匹配的操作。</p>}>
              <For each={filteredCommands()}>
                {(command, index) => (
                  <button
                    type="button"
                    class="command-palette__item"
                    classList={{ "is-active": index() === activeIndex() }}
                    role="option"
                    id={`command-palette-option-${command.id}`}
                    tabIndex={-1}
                    aria-selected={index() === activeIndex()}
                    onMouseEnter={() => setActiveIndex(index())}
                    onFocus={() => setActiveIndex(index())}
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
