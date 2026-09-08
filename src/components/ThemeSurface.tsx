import { Show, createMemo } from "solid-js";
import TodayDashboard, { type TodayDashboardProps } from "./TodayDashboard";
import {
  NightValleyFocus,
  NightValleyRecords,
  NightValleySettings,
  NightValleyTodo,
  type NightValleyFocusProps,
  type NightValleyRecordsProps,
  type NightValleySettingsProps,
  type NightValleyTodoProps,
} from "./NightValleyViews";
import { getTheme, type ThemeId } from "../lib/themes";
import "./ThemeSurface.css";

export type ThemeSurfaceView = "today" | "focus" | "todos" | "records" | "settings";

export interface ThemeSurfaceProps {
  activeView: () => ThemeSurfaceView;
  themeId: () => ThemeId;
  today: TodayDashboardProps;
  focus: NightValleyFocusProps;
  todos: NightValleyTodoProps;
  records: NightValleyRecordsProps;
  settings: NightValleySettingsProps;
}

type ThemeImplementation = "night-valley";

function resolveThemeImplementation(themeId: ThemeId): ThemeImplementation {
  switch (getTheme(themeId).id) {
    case "night-valley":
      return "night-valley";
    default:
      return "night-valley";
  }
}

/**
 * The shell owns data and actions; this boundary owns which visual surface renders them.
 * A future theme can replace the implementation behind this boundary without copying the
 * timer, storage, or navigation orchestration from MainShell.
 */
export default function ThemeSurface(props: ThemeSurfaceProps) {
  const themeImplementation = createMemo(() => resolveThemeImplementation(props.themeId()));

  return (
    <Show
      when={themeImplementation() === "night-valley"}
      fallback={
        <section class="theme-surface-unavailable" role="status">
          当前主题尚未实现，已回退到可用主题。
        </section>
      }
    >
      <Show when={props.activeView() === "today"}>
        <TodayDashboard {...props.today} />
      </Show>
      <Show when={props.activeView() === "focus"}>
        <NightValleyFocus {...props.focus} />
      </Show>
      <Show when={props.activeView() === "todos"}>
        <NightValleyTodo {...props.todos} />
      </Show>
      <Show when={props.activeView() === "records"}>
        <NightValleyRecords {...props.records} />
      </Show>
      <Show when={props.activeView() === "settings"}>
        <NightValleySettings {...props.settings} />
      </Show>
    </Show>
  );
}
