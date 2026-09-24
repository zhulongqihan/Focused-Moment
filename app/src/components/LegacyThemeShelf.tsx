import { For, Show, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { legacyThemes, type ThemeId } from "../lib/themes";

interface LegacyThemeShelfProps {
  themeId: Accessor<ThemeId>;
  onThemeSelect: (themeId: ThemeId) => void;
}

export default function LegacyThemeShelf(props: LegacyThemeShelfProps) {
  const selectedTheme = createMemo(() => legacyThemes.find((theme) => theme.id === props.themeId()));

  return (
    <section class="legacy-theme-shelf" aria-label="旧版主题">
      <details class="legacy-theme-shelf__disclosure" open={Boolean(selectedTheme())}>
        <summary>
          <strong>旧版主题</strong>
          <span>两种早期风格，按需切换</span>
        </summary>
        <p class="legacy-theme-shelf__description">
          它们不会出现在常用的五套主题中；切换后立即生效并自动保存，也可以随时切回。
        </p>
        <div class="legacy-theme-shelf__choices" role="group" aria-label="选择旧版主题">
          <For each={legacyThemes}>
            {(theme) => {
              const selected = () => props.themeId() === theme.id;
              return (
                <button
                  type="button"
                  classList={{ "legacy-theme-shelf__choice": true, "is-selected": selected() }}
                  aria-label={`切换到旧版主题：${theme.name}`}
                  aria-pressed={selected()}
                  onClick={() => props.onThemeSelect(theme.id)}
                >
                  <img src={theme.preview} alt="" loading="lazy" />
                  <span class="legacy-theme-shelf__copy">
                    <strong>{theme.name}</strong>
                    <small>{theme.description}</small>
                  </span>
                  <Show when={selected()}>
                    <span class="legacy-theme-shelf__state">正在使用</span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </details>
    </section>
  );
}
