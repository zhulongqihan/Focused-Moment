import type { ThemeModule } from "../../lib/theme-module-loader";
import TodayDashboard from "../TodayDashboard";
import {
  NightValleyFocus,
  NightValleyRecords,
  NightValleySettings,
  NightValleyTodo,
} from "../NightValleyViews";

const module: ThemeModule = {
  today: TodayDashboard,
  focus: NightValleyFocus,
  todos: NightValleyTodo,
  records: NightValleyRecords,
  settings: NightValleySettings,
};

export default module;
