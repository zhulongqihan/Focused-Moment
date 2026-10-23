import { Show, Suspense, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Component } from "solid-js";
import type {
  FocusSurfaceProps,
  RecordsSurfaceProps,
  SettingsSurfaceProps,
  TodaySurfaceProps,
  TodoSurfaceProps,
} from "../lib/theme-contracts";
import { loadThemeModule, type ThemeModule, type ThemeModuleId } from "../lib/theme-module-loader";
import { getTheme, type ThemeId } from "../lib/themes";
import LegacyThemeShelf from "./LegacyThemeShelf";
import "./ThemeSurface.css";

export type ThemeSurfaceView = "today" | "focus" | "todos" | "records" | "settings";

export interface ThemeSurfaceProps {
  activeView: () => ThemeSurfaceView;
  themeId: () => ThemeId;
  today: TodaySurfaceProps;
  focus: FocusSurfaceProps;
  todos: TodoSurfaceProps;
  records: RecordsSurfaceProps;
  settings: SettingsSurfaceProps;
}

interface LoadedTheme {
  id: ThemeId;
  implementation: ThemeModuleId;
  module: ThemeModule;
}

interface ThemeLoadError {
  themeId: ThemeId;
  initial: boolean;
}

type SurfaceComponent = Component<any>;

function resolveThemeImplementation(themeId: ThemeId): ThemeModuleId {
  if (themeId === "legacy-aurora-ocean") return "aurora-ocean";
  if (themeId === "legacy-botanical-library") return "botanical-library";
  return getTheme(themeId).id as ThemeModuleId;
}

/**
 * The shell owns data and actions; this boundary owns which visual surface renders them.
 * Theme modules are loaded only when selected. A pending selection never replaces the
 * currently rendered module, and a stale load cannot commit over a newer selection.
 */
export default function ThemeSurface(props: ThemeSurfaceProps) {
  const [loadedTheme, setLoadedTheme] = createSignal<LoadedTheme>();
  const [loadingThemeId, setLoadingThemeId] = createSignal<ThemeId | null>(null);
  const [loadError, setLoadError] = createSignal<ThemeLoadError | null>(null);
  let requestSequence = 0;
  let disposed = false;

  onCleanup(() => {
    disposed = true;
    requestSequence += 1;
  });

  function loadCurrentTheme(themeId: ThemeId) {
    const implementation = resolveThemeImplementation(themeId);
    if (untrack(() => loadedTheme()?.implementation === implementation)) return;

    const requestId = ++requestSequence;
    setLoadingThemeId(themeId);
    setLoadError(null);

    void loadThemeModule(implementation).then(
      (module) => {
        if (disposed || requestId !== requestSequence || props.themeId() !== themeId) return;
        setLoadedTheme({ id: themeId, implementation, module });
        setLoadingThemeId(null);
      },
      () => {
        if (disposed || requestId !== requestSequence || props.themeId() !== themeId) return;
        const initial = untrack(() => loadedTheme() === undefined);
        setLoadingThemeId(null);
        setLoadError({ themeId, initial });
      },
    );
  }

  createEffect(() => loadCurrentTheme(props.themeId()));

  async function requestThemeSelection(themeId: ThemeId) {
    const implementation = resolveThemeImplementation(themeId);
    const existing = loadedTheme();
    if (themeId === props.themeId() && existing?.implementation === implementation) {
      requestSequence += 1;
      setLoadingThemeId(null);
      setLoadError(null);
      return;
    }

    const requestId = ++requestSequence;
    setLoadingThemeId(themeId);
    setLoadError(null);
    try {
      const module = await loadThemeModule(implementation);
      if (disposed || requestId !== requestSequence) return;
      setLoadedTheme({ id: themeId, implementation, module });
      setLoadingThemeId(null);
      props.settings.onThemeSelect(themeId);
    } catch {
      if (disposed || requestId !== requestSequence) return;
      setLoadingThemeId(null);
      setLoadError({ themeId, initial: loadedTheme() === undefined });
    }
  }

  function dismissLoadError() {
    const current = loadedTheme();
    const failure = loadError();
    requestSequence += 1;
    setLoadingThemeId(null);
    setLoadError(null);
    if (current) {
      if (current.id !== props.themeId()) props.settings.onThemeSelect(current.id);
      return;
    }
    if (failure && failure.themeId !== "night-valley") {
      void requestThemeSelection("night-valley");
    }
  }

  const activeComponent = createMemo<SurfaceComponent | undefined>(() => {
    const module = loadedTheme()?.module;
    if (!module) return undefined;
    switch (props.activeView()) {
      case "today": return module.today;
      case "focus": return module.focus;
      case "todos": return module.todos;
      case "records": return module.records;
      case "settings": return module.settings;
    }
  });

  const activeProps = createMemo(() => {
    switch (props.activeView()) {
      case "today": return props.today;
      case "focus": return props.focus;
      case "todos": return props.todos;
      case "records": return props.records;
      case "settings": return { ...props.settings, onThemeSelect: requestThemeSelection };
    }
  });

  const loadingThemeName = createMemo(() => {
    const themeId = loadingThemeId();
    return themeId ? getTheme(themeId).name : "";
  });

  const failedThemeName = createMemo(() => {
    const themeId = loadError()?.themeId;
    return themeId ? getTheme(themeId).name : "";
  });

  return (
    <>
      <Show
        when={activeComponent()}
        fallback={<section class="theme-surface-unavailable" role="status">正在准备主题界面…</section>}
      >
        {(component) => (
          <Suspense fallback={<section class="theme-surface-unavailable" role="status">正在准备当前页面…</section>}>
            <Dynamic component={component()} {...activeProps()} />
          </Suspense>
        )}
      </Show>
      <Show when={props.activeView() === "settings"}>
        <LegacyThemeShelf themeId={props.settings.themeId} onThemeSelect={requestThemeSelection} />
      </Show>
      <Show when={loadingThemeId()}>
        <p class="theme-load-feedback theme-load-status" role="status" aria-live="polite">
          正在加载{loadingThemeName()}主题，当前界面仍可操作。
        </p>
      </Show>
      <Show when={loadError()}>
        <div class="theme-load-feedback theme-load-error" role="alert" aria-live="assertive">
          <strong>{failedThemeName()}主题暂时无法加载</strong>
          <span>当前主题仍可使用。可以重试加载，或返回当前主题。</span>
          <div class="theme-load-error__actions">
            <button type="button" class="secondary-button" onClick={() => {
              const failure = loadError();
              if (failure) void requestThemeSelection(failure.themeId);
            }}>
              重试加载
            </button>
            <button type="button" class="text-button" onClick={dismissLoadError}>
              {loadedTheme() || loadError()?.themeId === "night-valley" ? "返回当前主题" : "使用夜谷主题"}
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
