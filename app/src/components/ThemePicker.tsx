import { For } from "solid-js";
import { themes, type ThemeId } from "../lib/themes";

interface ThemePickerProps {
  value: ThemeId;
  onChange: (themeId: ThemeId) => void;
  className?: string;
}

/** One accessible theme selector shared by every visual surface. */
export default function ThemePicker(props: ThemePickerProps) {
  return (
    <div class={`theme-picker${props.className ? ` ${props.className}` : ""}`} aria-label="主题选择">
      <For each={themes}>
        {(theme) => (
          <button
            type="button"
            class="theme-picker__option"
            classList={{ "is-selected": props.value === theme.id }}
            aria-pressed={props.value === theme.id}
            title={`使用${theme.name}主题`}
            onClick={() => props.onChange(theme.id)}
          >
            <img src={theme.preview} alt={`${theme.englishName} 主题预览`} />
            <span>{theme.name}</span>
          </button>
        )}
      </For>
    </div>
  );
}
