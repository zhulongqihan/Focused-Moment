import { Match, Show, Switch, createMemo } from "solid-js";
import TodayDashboard, { type TodayDashboardProps } from "./TodayDashboard";
import {
  EditorialPaperFocus,
  EditorialPaperRecords,
  EditorialPaperSettings,
  EditorialPaperToday,
  EditorialPaperTodos,
} from "./EditorialPaperViews";
import {
  GraphiteConsoleFocus,
  GraphiteConsoleRecords,
  GraphiteConsoleSettings,
  GraphiteConsoleToday,
  GraphiteConsoleTodos,
} from "./GraphiteConsoleViews";
import {
  AuroraOceanFocus,
  AuroraOceanRecords,
  AuroraOceanSettings,
  AuroraOceanToday,
  AuroraOceanTodos,
} from "./AuroraOceanViews";
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

type ThemeImplementation = "night-valley" | "editorial-paper" | "graphite-console" | "aurora-ocean";

function resolveThemeImplementation(themeId: ThemeId): ThemeImplementation {
  switch (getTheme(themeId).id) {
    case "night-valley":
      return "night-valley";
    case "editorial-paper":
      return "editorial-paper";
    case "graphite-console":
      return "graphite-console";
    case "aurora-ocean":
      return "aurora-ocean";
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
    <Switch fallback={<section class="theme-surface-unavailable" role="status">当前主题暂不可用，已回退到可用主题。</section>}>
      <Match when={themeImplementation() === "night-valley"}>
        <Show when={props.activeView() === "today"}><TodayDashboard {...props.today} /></Show>
        <Show when={props.activeView() === "focus"}><NightValleyFocus {...props.focus} /></Show>
        <Show when={props.activeView() === "todos"}><NightValleyTodo {...props.todos} /></Show>
        <Show when={props.activeView() === "records"}><NightValleyRecords {...props.records} /></Show>
        <Show when={props.activeView() === "settings"}><NightValleySettings {...props.settings} /></Show>
      </Match>
      <Match when={themeImplementation() === "editorial-paper"}>
        <Show when={props.activeView() === "today"}><EditorialPaperToday {...props.today} /></Show>
        <Show when={props.activeView() === "focus"}><EditorialPaperFocus {...props.focus} /></Show>
        <Show when={props.activeView() === "todos"}><EditorialPaperTodos {...props.todos} /></Show>
        <Show when={props.activeView() === "records"}><EditorialPaperRecords {...props.records} /></Show>
        <Show when={props.activeView() === "settings"}><EditorialPaperSettings {...props.settings} /></Show>
      </Match>
      <Match when={themeImplementation() === "graphite-console"}>
        <Show when={props.activeView() === "today"}><GraphiteConsoleToday {...props.today} /></Show>
        <Show when={props.activeView() === "focus"}><GraphiteConsoleFocus {...props.focus} /></Show>
        <Show when={props.activeView() === "todos"}><GraphiteConsoleTodos {...props.todos} /></Show>
        <Show when={props.activeView() === "records"}><GraphiteConsoleRecords {...props.records} /></Show>
        <Show when={props.activeView() === "settings"}><GraphiteConsoleSettings {...props.settings} /></Show>
      </Match>
      <Match when={themeImplementation() === "aurora-ocean"}>
        <Show when={props.activeView() === "today"}><AuroraOceanToday {...props.today} /></Show>
        <Show when={props.activeView() === "focus"}><AuroraOceanFocus {...props.focus} /></Show>
        <Show when={props.activeView() === "todos"}><AuroraOceanTodos {...props.todos} /></Show>
        <Show when={props.activeView() === "records"}><AuroraOceanRecords {...props.records} /></Show>
        <Show when={props.activeView() === "settings"}><AuroraOceanSettings {...props.settings} /></Show>
      </Match>
    </Switch>
  );
}
