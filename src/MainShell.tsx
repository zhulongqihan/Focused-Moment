import { invoke } from "@tauri-apps/api/core";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type {
  AnalyticsSnapshot,
  DailyInsight,
  FocusRecord,
  ShellSnapshot,
  TimerSnapshot,
  TodoDraft,
  TodoImportance,
  TodoItem,
} from "./lib/contracts";
import {
  createTodoItem,
  deleteTodoItem,
  getTodoItems,
  toggleTodoItem,
  updateTodoItem,
} from "./lib/tasks";
import {
  clearAppData,
  completeFocusSession,
  deleteFocusRecord,
  deleteFocusRecords,
  exportFocusRecordsCsv,
  getAnalyticsSnapshot,
  getFocusRecords,
  getTimerSnapshot,
  pauseTimer,
  resetTimer,
  startTimer,
  switchTimerMode,
} from "./lib/timer";
import {
  closeMainWindow,
  minimizeMainWindow,
  quitApplication,
  startDraggingMainWindow,
  toggleMaximizeMainWindow,
} from "./lib/window-controls";
import "./App.css";

type ViewKey = "focus" | "tasks" | "insights" | "lab";
type ReviewRangeKey = "today" | "7d" | "30d" | "all" | "custom";
type TodoFilterKey = "all" | "pending" | "completed" | "today" | "high";
type TodoSortKey = "smart" | "schedule" | "importance" | "newest" | "title";

type ReviewSummary = {
  totalFocusDurationMs: number;
  totalFocusDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
  activeDays: number;
  averageDailyDurationLabel: string;
  stopwatchSessionCount: number;
  pomodoroSessionCount: number;
  linkedTaskCount: number;
  dailyBreakdown: DailyInsight[];
};

const viewItems = [
  {
    key: "focus",
    label: "\u5f00\u59cb\u4e13\u6ce8",
    summary: "\u6b63\u5411\u8ba1\u65f6\u4e0e\u756a\u8304\u949f",
  },
  {
    key: "tasks",
    label: "\u7ba1\u7406\u5f85\u529e",
    summary: "\u5b89\u6392\u4eca\u5929\u8981\u505a\u7684\u4e8b",
  },
  {
    key: "insights",
    label: "\u67e5\u770b\u590d\u76d8",
    summary: "\u770b\u770b\u6700\u8fd1\u7684\u4e13\u6ce8\u53d8\u5316",
  },
  {
    key: "lab",
    label: "\u5f00\u53d1\u8005\u4fe1\u606f",
    summary: "\u7248\u672c\u3001\u72b6\u6001\u4e0e\u4e3b\u7ebf\u8def\u7ebf",
  },
] as const;

const importanceOptions = [
  { key: "high", label: "\u9ad8\u4f18\u5148\u7ea7" },
  { key: "medium", label: "\u4e2d\u4f18\u5148\u7ea7" },
  { key: "low", label: "\u4f4e\u4f18\u5148\u7ea7" },
] as const;

const reviewRangeOptions = [
  { key: "today", label: "\u4eca\u5929" },
  { key: "7d", label: "\u8fd1 7 \u5929" },
  { key: "30d", label: "\u8fd1 30 \u5929" },
  { key: "all", label: "\u5168\u90e8" },
  { key: "custom", label: "\u81ea\u5b9a\u4e49" },
] as const;

const todoFilterOptions = [
  { key: "all", label: "\u5168\u90e8" },
  { key: "pending", label: "\u8fdb\u884c\u4e2d" },
  { key: "completed", label: "\u5df2\u5b8c\u6210" },
  { key: "today", label: "\u4eca\u5929" },
  { key: "high", label: "\u9ad8\u4f18\u5148\u7ea7" },
] as const;

const todoSortOptions = [
  { key: "smart", label: "\u9ed8\u8ba4\u6392\u5e8f" },
  { key: "schedule", label: "\u6309\u65f6\u95f4\u6392" },
  { key: "importance", label: "\u6309\u91cd\u8981\u7a0b\u5ea6" },
  { key: "newest", label: "\u6700\u65b0\u521b\u5efa" },
  { key: "title", label: "\u6309\u540d\u79f0" },
] as const;

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatScheduledTimeLabel(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : "\u672a\u8bbe\u7f6e";
}

function getTodoScheduleSortValue(
  item: Pick<TodoItem, "scheduledDate" | "scheduledTime">
) {
  return `${item.scheduledDate} ${item.scheduledTime.trim() || "99:99"}`;
}

function createDefaultTodoDraft(title = ""): TodoDraft {
  return {
    title,
    scheduledDate: getLocalDateValue(),
    scheduledTime: "",
    importanceKey: "medium",
  };
}

function getImportanceLabel(importanceKey: TodoImportance) {
  return (
    importanceOptions.find((option) => option.key === importanceKey)?.label ??
    "\u672a\u8bbe\u7f6e"
  );
}

function getImportanceRank(importanceKey: TodoImportance) {
  switch (importanceKey) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

const copy = {
  versionEyebrow: "\u4e13\u6ce8\u684c\u9762\u52a9\u624b",
  focusEyebrow: "\u4e13\u6ce8\u8ba1\u65f6",
  focusTitle: "\u4eca\u5929\u60f3\u5148\u5b8c\u6210\u54ea\u4ef6\u4e8b\uff1f",
  focusSummary:
    "\u9009\u4e00\u4e2a\u4efb\u52a1\uff0c\u7136\u540e\u7528\u6b63\u5411\u8ba1\u65f6\u6216\u756a\u8304\u949f\u628a\u5b83\u5b89\u9759\u5730\u505a\u5b8c\u3002",
  loading: "\u6b63\u5728\u8f7d\u5165 Focused Moment...",
  ready: "\u51c6\u5907\u597d\u4e86\uff0c\u4f60\u53ef\u4ee5\u968f\u65f6\u5f00\u59cb\u4e00\u8f6e\u4e13\u6ce8\u3002",
  fallback: "\u5e94\u7528\u5df2\u4f7f\u7528\u56de\u9000\u6570\u636e\u542f\u52a8\u3002",
  shellFallback: "\u8f7d\u5165\u684c\u9762\u58f3\u5c42\u6570\u636e\u5931\u8d25\u3002",
  minimize: "\u6700\u5c0f\u5316",
  maximize: "\u6700\u5927\u5316",
  close: "\u9690\u85cf",
  quit: "\u9000\u51fa",
  dragHint: "\u6309\u4f4f\u9876\u90e8\u7a7a\u767d\u533a\u53ef\u62d6\u52a8\u7a97\u53e3",
  dragSubhint: "\u53cc\u51fb\u8fd9\u5757\u533a\u57df\u53ef\u5207\u6362\u6700\u5927\u5316",
  trayHint: "\u70b9\u51fb\u201c\u9690\u85cf\u201d\u540e\u4f1a\u9a7b\u7559\u5728\u7cfb\u7edf\u6258\u76d8\uff0c\u53ef\u4ece\u6258\u76d8\u56fe\u6807\u91cd\u65b0\u6253\u5f00\uff1b\u5982\u9700\u5b8c\u5168\u5173\u95ed\uff0c\u8bf7\u70b9\u51fb\u201c\u9000\u51fa\u201d\u3002",
  focusTodayLabel: "\u4eca\u65e5\u4e13\u6ce8",
  focusTodayNote: "\u4eca\u5929\u7d2f\u8ba1\u5b8c\u6210\u7684\u4e13\u6ce8\u65f6\u957f",
  focusRecordsLabel: "\u5df2\u8bb0\u4e0b",
  focusRecordsNote: "\u8fd9\u6bb5\u65f6\u95f4\u4fdd\u5b58\u4e0b\u6765\u7684\u4e13\u6ce8\u8bb0\u5f55",
  focusPendingLabel: "\u5f85\u529e\u4e8b\u9879",
  focusPendingNote: "\u8fd8\u6ca1\u6709\u5b8c\u6210\u7684\u4efb\u52a1\u6570\u91cf",
  focusModeLabel: "\u5f53\u524d\u8282\u594f",
  focusModeNote: "\u4f60\u73b0\u5728\u6b63\u5728\u4f7f\u7528\u7684\u4e13\u6ce8\u65b9\u5f0f",
  modeSwitchEyebrow: "\u8ba1\u65f6\u6a21\u5f0f",
  stopwatchMode: "\u6b63\u5411\u8ba1\u65f6",
  pomodoroMode: "\u756a\u8304\u949f",
  modeEyebrow: "\u5f53\u524d\u6a21\u5f0f",
  currentTaskEyebrow: "\u5f53\u524d\u4e8b\u52a1",
  currentTaskTitle: "\u8fd9\u4e00\u6b21\u4e13\u6ce8\uff0c\u51c6\u5907\u8bb0\u6210\u4ec0\u4e48",
  currentTaskHint:
    "\u4f60\u53ef\u4ee5\u76f4\u63a5\u8f93\u5165\u4e00\u4e2a\u72ec\u7acb\u4e8b\u52a1\u540d\u79f0\uff0c\u5b8c\u6210\u540e\u4f1a\u5355\u72ec\u8bb0\u6210\u4e00\u6761\u4e13\u6ce8\u4e8b\u4ef6\u3002",
  pomodoroTaskHint:
    "\u756a\u8304\u949f\u4e0b\u4e5f\u53ef\u4ee5\u586b\u5199\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9\uff1b\u5230\u70b9\u540e\u6216\u63d0\u524d\u7ed3\u675f\u65f6\uff0c\u90fd\u53ef\u4ee5\u628a\u8fd9\u4e00\u8f6e\u8bb0\u6210\u72ec\u7acb\u4e8b\u4ef6\u6216\u5173\u8054\u4efb\u52a1\u3002",
  taskPlaceholder: "\u4f8b\u5982\uff1a\u6574\u7406\u4eca\u65e5\u65b9\u6848\u521d\u7a3f",
  linkTodoLabel: "\u5173\u8054\u4efb\u52a1",
  linkTodoHint: "\u4e0d\u9009\u62e9\u4efb\u52a1\u65f6\uff0c\u8fd9\u6761\u8bb0\u5f55\u4f1a\u4f5c\u4e3a\u72ec\u7acb\u4e13\u6ce8\u4e8b\u4ef6\u4fdd\u5b58\u3002",
  linkTodoEmpty: "\u4e0d\u5173\u8054\u4efb\u52a1\uff0c\u5355\u72ec\u8bb0\u5f55",
  linkTodoPrefix: "\u5f53\u524d\u5c06\u5173\u8054\u5230\u4efb\u52a1\uff1a",
  currentFocusLabel: "\u5f53\u524d\u4e13\u6ce8\u5185\u5bb9",
  start: "\u5f00\u59cb\u8ba1\u65f6",
  pause: "\u6682\u505c",
  reset: "\u91cd\u7f6e",
  complete: "\u5b8c\u6210\u5e76\u8bb0\u5f55",
  completePomodoro: "\u5b8c\u6210\u672c\u8f6e\u5e76\u8bb0\u5f55",
  completePomodoroPending: "\u8bb0\u5f55\u4e0a\u4e00\u8f6e\u4e13\u6ce8",
  pomodoroHint:
    "\u756a\u8304\u949f\u4f1a\u5728 25 \u5206\u949f\u4e13\u6ce8\u548c 5 \u5206\u949f\u77ed\u4f11\u606f\u4e4b\u95f4\u5207\u6362\u3002\u8fdb\u5165\u4f11\u606f\u9636\u6bb5\u540e\uff0c\u4ecd\u53ef\u8865\u8bb0\u521a\u7ed3\u675f\u7684\u4e0a\u4e00\u8f6e\u4e13\u6ce8\u3002",
  engineOwner: "\u5f15\u64ce\u5f52\u5c5e",
  engineOwnerNote: "\u65f6\u95f4\u7d2f\u8ba1\u4e0d\u4f9d\u8d56\u524d\u7aef\u5b9a\u65f6\u5668",
  currentStatus: "\u5f53\u524d\u72b6\u6001",
  currentStatusNote: "\u652f\u6301\u5f00\u59cb\u3001\u6682\u505c\u3001\u91cd\u7f6e\u4e0e\u5b8c\u6210\u8bb0\u5f55",
  runtimeTarget: "\u8fd0\u884c\u76ee\u6807",
  runtimeTargetNote: "\u4f4e\u5360\u7528\u684c\u9762\u5e38\u9a7b\u5f62\u6001",
  timingCorrection: "\u6821\u6b63\u65b9\u5f0f",
  timingCorrectionNote: "\u5df2\u8003\u8651\u540e\u53f0\u8fd0\u884c\u548c\u7cfb\u7edf\u4f11\u7720\u540e\u7684\u65f6\u95f4\u5dee\u503c",
  recordsEyebrow: "\u4e13\u6ce8\u8bb0\u5f55",
  recordsTitle: "\u6700\u8fd1\u8bb0\u4e0b\u6765\u7684\u4e13\u6ce8",
  recordsEmpty: "\u8fd8\u6ca1\u6709\u4e13\u6ce8\u8bb0\u5f55\uff0c\u5b8c\u6210\u7b2c\u4e00\u8f6e\u540e\u5c31\u4f1a\u51fa\u73b0\u5728\u8fd9\u91cc\u3002",
  recordsWindowNote: "\u9ed8\u8ba4\u53ea\u663e\u793a\u8fd1 7 \u5929\u5185\u7684\u6700\u65b0 6 \u6761\u8bb0\u5f55\uff0c\u66f4\u65e9\u7684\u5185\u5bb9\u53ef\u4ee5\u5728\u201c\u67e5\u770b\u590d\u76d8\u201d\u91cc\u7ee7\u7eed\u770b\u3002",
  recordsRecentEmpty: "\u6700\u8fd1 7 \u5929\u6682\u65f6\u8fd8\u6ca1\u6709\u65b0\u7684\u4e13\u6ce8\u8bb0\u5f55\uff0c\u66f4\u65e9\u7684\u5386\u53f2\u53ef\u4ee5\u5728\u201c\u67e5\u770b\u590d\u76d8\u201d\u91cc\u67e5\u770b\u3002",
  unnamedTask: "\u672a\u547d\u540d\u4e8b\u52a1",
  recordIndependent: "\u72ec\u7acb\u4e8b\u4ef6",
  recordLinkedPrefix: "\u5173\u8054\u4efb\u52a1\uff1a",
  todoEyebrow: "\u5f85\u529e\u7ba1\u7406",
  todoTitle: "\u628a\u4eca\u5929\u8981\u505a\u7684\u4e8b\u6392\u6e05\u695a",
  todoSummary:
    "\u628a\u60f3\u505a\u7684\u4e8b\u3001\u65e5\u671f\u3001\u53ef\u9009\u7684\u5f00\u59cb\u65f6\u95f4\u548c\u91cd\u8981\u7a0b\u5ea6\u8bb0\u4e0b\u6765\uff0c\u7b49\u5f00\u59cb\u4e13\u6ce8\u65f6\u518d\u76f4\u63a5\u5173\u8054\u5b83\u3002",
  todoPlaceholder: "\u65b0\u589e\u4e00\u4e2a\u4efb\u52a1\uff0c\u4f8b\u5982\uff1a\u8865\u5b8c\u5468\u62a5\u521d\u7a3f",
  todoSearchPlaceholder: "\u641c\u7d22\u4efb\u52a1\u540d\u79f0\uff0c\u5feb\u901f\u627e\u5230\u8981\u5904\u7406\u7684\u4e8b",
  todoToolsEyebrow: "\u4efb\u52a1\u5de5\u5177",
  todoToolsTitle: "\u66f4\u5feb\u627e\u5230\u4f60\u73b0\u5728\u60f3\u5904\u7406\u7684\u4efb\u52a1",
  todoToolsSummary:
    "\u53ef\u4ee5\u5148\u641c\u7d22\uff0c\u518d\u6309\u72b6\u6001\u6216\u91cd\u8981\u7a0b\u5ea6\u7b5b\u9009\uff0c\u6700\u540e\u7528\u6392\u5e8f\u628a\u4efb\u52a1\u5217\u8868\u8c03\u6210\u66f4\u987a\u624b\u7684\u89c6\u56fe\u3002",
  todoFilterLabel: "\u7b5b\u9009",
  todoSortLabel: "\u6392\u5e8f",
  todoVisibleCount: "\u5f53\u524d\u53ef\u89c1",
  todoFilteredEmpty: "\u8fd9\u4e2a\u7b5b\u9009\u7ec4\u5408\u4e0b\u8fd8\u6ca1\u6709\u5339\u914d\u7684\u4efb\u52a1\uff0c\u53ef\u4ee5\u6362\u4e2a\u6761\u4ef6\u8bd5\u8bd5\u3002",
  todoDateLabel: "\u65e5\u671f",
  todoTimeLabel: "\u5f00\u59cb\u65f6\u95f4\uff08\u53ef\u9009\uff09",
  todoImportanceLabel: "\u91cd\u8981\u7a0b\u5ea6",
  todoCreate: "\u6dfb\u52a0\u4efb\u52a1",
  todoEmpty: "\u8fd8\u6ca1\u6709\u4efb\u52a1\uff0c\u5148\u6dfb\u52a0\u4e00\u9879\u4eca\u5929\u60f3\u63a8\u8fdb\u7684\u4e8b\u60c5\u5427\u3002",
  todoPendingCount: "\u5f85\u63a8\u8fdb",
  todoCompletedCount: "\u5df2\u5b8c\u6210",
  todoCompletedSection: "\u5df2\u5b8c\u6210\u4efb\u52a1",
  todoCompletedSectionNote: "\u8fd9\u90e8\u5206\u9ed8\u8ba4\u6536\u8d77\uff0c\u9700\u8981\u65f6\u518d\u5c55\u5f00\uff0c\u53ef\u4ee5\u8ba9\u5f53\u524d\u5f85\u63a8\u8fdb\u7684\u4efb\u52a1\u66f4\u805a\u7126\u3002",
  todoCompletedToggleOpen: "\u5c55\u5f00",
  todoCompletedToggleClose: "\u6536\u8d77",
  todoEdit: "\u7f16\u8f91",
  todoDelete: "\u5220\u9664",
  todoSave: "\u4fdd\u5b58",
  todoCancel: "\u53d6\u6d88",
  todoStatusDone: "\u5df2\u5b8c\u6210",
  todoStatusPending: "\u8fdb\u884c\u4e2d",
  todoDateValueLabel: "\u65e5\u671f",
  todoTimeValueLabel: "\u5f00\u59cb",
  todoImportanceValueLabel: "\u91cd\u8981",
  switcherEyebrow: "\u529f\u80fd\u5bfc\u822a",
  switcherTitle: "\u4eca\u5929\u60f3\u5148\u505a\u4ec0\u4e48\uff1f",
  switcherSummary:
    "\u5728\u4e13\u6ce8\u3001\u5f85\u529e\u548c\u590d\u76d8\u4e4b\u95f4\u5207\u6362\u3002\u5982\u679c\u4f60\u9700\u8981\u770b\u7248\u672c\u3001\u72b6\u6001\u6216\u5176\u4ed6\u5185\u90e8\u4fe1\u606f\uff0c\u53ef\u4ee5\u53bb\u201c\u5f00\u53d1\u8005\u4fe1\u606f\u201d\u9875\u9762\u3002",
  insightEyebrow: "\u6570\u636e\u590d\u76d8",
  insightTitle: "\u770b\u770b\u8fd9\u6bb5\u65f6\u95f4\u7684\u4e13\u6ce8\u8282\u594f",
  insightSummary:
    "\u5728\u8fd9\u91cc\u770b\u603b\u65f6\u957f\u3001\u8fdb\u5ea6\u548c\u8fd1\u671f\u53d8\u5316\uff0c\u4f60\u4f1a\u66f4\u5bb9\u6613\u77e5\u9053\u81ea\u5df1\u6700\u8fd1\u7684\u72b6\u6001\u600e\u4e48\u6837\u3002",
  insightFilterEyebrow: "\u590d\u76d8\u8303\u56f4",
  insightFilterTitle: "\u5148\u9009\u4e00\u4e2a\u4f60\u60f3\u770b\u7684\u65f6\u95f4\u6bb5",
  insightFilterSummary:
    "\u53ef\u4ee5\u5207\u5230\u4eca\u5929\u3001\u8fd1 7 \u5929\u3001\u8fd1 30 \u5929\u6216\u81ea\u5b9a\u4e49\u65f6\u95f4\uff0c\u4e0b\u9762\u7684\u6307\u6807\u3001\u56fe\u8868\u548c\u8bb0\u5f55\u90fd\u4f1a\u8ddf\u7740\u4e00\u8d77\u53d8\u3002",
  insightCustomStart: "\u5f00\u59cb\u65e5\u671f",
  insightCustomEnd: "\u7ed3\u675f\u65e5\u671f",
  insightRangeLabelPrefix: "\u5f53\u524d\u8303\u56f4",
  insightTotalFocus: "\u8303\u56f4\u5185\u4e13\u6ce8\u65f6\u957f",
  insightTotalFocusNote: "\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u5185\u6240\u6709\u4e13\u6ce8\u8bb0\u5f55\u7684\u7d2f\u79ef\u65f6\u957f",
  insightSessions: "\u8303\u56f4\u5185\u4e13\u6ce8\u6b21\u6570",
  insightSessionsNote: "\u5f53\u524d\u8303\u56f4\u5185\u5df2\u7ecf\u8bb0\u4e0b\u6765\u7684\u4e13\u6ce8\u4e8b\u4ef6\u6570\u91cf",
  insightActiveDays: "\u6d3b\u8dc3\u5929\u6570",
  insightActiveDaysNote: "\u5f53\u524d\u8303\u56f4\u5185\u51fa\u73b0\u8fc7\u4e13\u6ce8\u8bb0\u5f55\u7684\u81ea\u7136\u65e5\u6570",
  insightAverageDaily: "\u65e5\u5747\u4e13\u6ce8",
  insightAverageDailyNote: "\u6309\u6709\u8bb0\u5f55\u7684\u5929\u6570\u8ba1\u7b97\u5f97\u5230\u7684\u8303\u56f4\u5185\u65e5\u5747\u65f6\u957f",
  insightStopwatch: "\u6b63\u5411\u8ba1\u65f6",
  insightStopwatchNote: "\u5f53\u524d\u8303\u56f4\u5185\u6709\u591a\u5c11\u8f6e\u662f\u4ee5\u6b63\u5411\u8ba1\u65f6\u5b8c\u6210\u7684",
  insightPomodoro: "\u756a\u8304\u949f",
  insightPomodoroNote: "\u5f53\u524d\u8303\u56f4\u5185\u6709\u591a\u5c11\u8f6e\u662f\u4ee5\u756a\u8304\u949f\u5b8c\u6210\u7684",
  insightTaskProgress: "\u5f53\u524d\u5f85\u529e",
  insightTaskProgressNote: "\u8fd9\u662f\u4f60\u73b0\u5728\u5f85\u63a8\u8fdb\u548c\u5df2\u5b8c\u6210\u7684\u4efb\u52a1\u6570\u91cf",
  insightRelation: "\u5173\u8054\u60c5\u51b5",
  insightRelationNote: "\u5f53\u524d\u8303\u56f4\u5185\u6709\u591a\u5c11\u8f6e\u4e13\u6ce8\u662f\u4e0e\u4efb\u52a1\u5173\u8054\u7684",
  insightLinkedTasks: "\u5173\u8054\u4efb\u52a1\u6570",
  insightLinkedTasksNote: "\u5f53\u524d\u8303\u56f4\u5185\u88ab\u4e13\u6ce8\u8bb0\u5f55\u5173\u8054\u5230\u7684\u4efb\u52a1\u6570\u91cf",
  insightDailyEyebrow: "\u6309\u65e5\u590d\u76d8",
  insightDailyTitle: "\u6700\u8fd1\u7684\u4e13\u6ce8\u6c89\u6dc0\u8282\u594f",
  insightDailyEmpty: "\u8fd8\u6ca1\u6709\u5f62\u6210\u6309\u65e5\u805a\u5408\u6570\u636e\uff0c\u5b8c\u6210\u51e0\u8f6e\u4e13\u6ce8\u540e\u518d\u56de\u6765\u770b\u3002",
  insightDailySessions: "\u6b21\u4e13\u6ce8",
  insightDailyLinked: "\u5173\u8054\u4efb\u52a1",
  insightDailyIndependent: "\u72ec\u7acb\u4e8b\u4ef6",
  insightTrendEyebrow: "\u8d8b\u52bf\u56fe\u8868",
  insightTrendTitle: "\u6700\u8fd1\u51e0\u5929\u7684\u4e13\u6ce8\u8d8b\u52bf",
  insightTrendSummary:
    "\u4e0a\u65b9\u5148\u770b\u8fd1\u671f\u8282\u594f\u4e0e\u5cf0\u503c\uff0c\u4e0b\u65b9\u518d\u7528\u66f4\u67d4\u548c\u7684\u8d8b\u52bf\u7ebf\u548c\u6bd4\u8f83\u6761\u5feb\u901f\u5bf9\u6bd4\u6bcf\u4e00\u5929\u7684\u6c89\u6dc0\u5dee\u5f02\u3002",
  insightTrendEmpty: "\u6682\u65f6\u8fd8\u6ca1\u6709\u8db3\u591f\u7684\u6309\u65e5\u6570\u636e\u6765\u7ed8\u5236\u8d8b\u52bf\u56fe\u8868\u3002",
  insightTrendPeak: "\u8fd1\u671f\u5cf0\u503c",
  insightTrendLatest: "\u6700\u65b0\u8bb0\u5f55",
  insightTrendSessions: "\u7a97\u53e3\u5185\u4e13\u6ce8\u6b21\u6570",
  insightTrendSingleDay: "\u5f53\u524d\u53ea\u6709 1 \u5929\u6570\u636e\uff0c\u5148\u7528\u805a\u7126\u5361\u7247\u5e2e\u4f60\u770b\u6e05\u8fd9\u4e00\u5929\u7684\u8282\u594f\u3002",
  recordCompletedAt: "\u8bb0\u5f55\u65f6\u95f4",
  insightRecordsEyebrow: "\u8be6\u7ec6\u8bb0\u5f55",
  insightRecordsTitle: "\u5f53\u524d\u8303\u56f4\u5185\u7684\u6bcf\u4e00\u6761\u4e13\u6ce8",
  insightRecordsEmpty: "\u5f53\u524d\u8303\u56f4\u91cc\u8fd8\u6ca1\u6709\u4e13\u6ce8\u8bb0\u5f55\u3002",
  recordDelete: "\u5220\u9664\u8fd9\u6761",
  exportCsv: "\u5bfc\u51fa\u5f53\u524d\u8303\u56f4 CSV",
  exportDonePrefix: "CSV \u5df2\u5bfc\u51fa\u5230",
  clearRange: "\u6e05\u7406\u5f53\u524d\u8303\u56f4",
  clearRangeConfirm:
    "\u8fd9\u4f1a\u5220\u6389\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u5185\u7684\u4e13\u6ce8\u8bb0\u5f55\uff0c\u4f46\u4e0d\u4f1a\u78b0\u5f85\u529e\u4efb\u52a1\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f",
  clearRangeDone: "\u5df2\u6e05\u7406\u5f53\u524d\u8303\u56f4\u7684\u4e13\u6ce8\u8bb0\u5f55",
  clearData: "\u6e05\u7a7a\u672c\u5730\u6570\u636e",
  clearDataConfirm:
    "\u8fd9\u4f1a\u6e05\u7a7a\u672c\u5730\u7684\u4efb\u52a1\u3001\u4e13\u6ce8\u8bb0\u5f55\u548c\u7edf\u8ba1\u7ed3\u679c\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f",
  clearDataDone: "\u5df2\u6e05\u7a7a\u672c\u5730\u6570\u636e",
  developerEyebrow: "\u5f00\u53d1\u8005\u4fe1\u606f",
  developerTitle: "\u8fd9\u4e9b\u5185\u90e8\u4fe1\u606f\u90fd\u6536\u5728\u8fd9\u91cc",
  developerSummary:
    "\u7248\u672c\u53f7\u3001\u8fd0\u884c\u72b6\u6001\u3001\u65f6\u95f4\u6821\u6b63\u65b9\u5f0f\u3001\u4ea7\u54c1\u4e3b\u7ebf\u548c\u540e\u7eed\u7eaf\u6548\u7387\u5de5\u5177\u9884\u7559\u90fd\u6536\u5728\u8fd9\u4e2a\u9875\u9762\uff0c\u65e5\u5e38\u4f7f\u7528\u65f6\u53ef\u4ee5\u76f4\u63a5\u5ffd\u7565\u5b83\u3002",
  developerVersionLabel: "\u5e94\u7528\u7248\u672c",
  developerVersionNote: "\u5f53\u524d\u6784\u5efa\u6240\u5bf9\u5e94\u7684\u7248\u672c\u53f7",
  developerMilestoneLabel: "\u5f53\u524d\u9636\u6bb5",
  developerMilestoneNote: "\u8fd9\u4e00\u7248\u5185\u90e8\u6807\u8bb0\u7684\u7814\u53d1\u9636\u6bb5",
  developerStatusLabel: "\u8fd0\u884c\u72b6\u6001",
  developerStatusNote: "\u542f\u52a8\u548c\u4ea4\u4e92\u8fc7\u7a0b\u4e2d\u7684\u6700\u65b0\u72b6\u6001\u6587\u5b57",
  developerStorageLabel: "\u6570\u636e\u5b58\u50a8",
  developerStorageNote: "\u6240\u6709\u4efb\u52a1\u548c\u4e13\u6ce8\u8bb0\u5f55\u9ed8\u8ba4\u4fdd\u5b58\u5728\u672c\u5730",
  developerInfoEyebrow: "\u8fd0\u884c\u4fe1\u606f",
  developerInfoTitle: "\u4e0e\u8fd9\u4e2a\u7248\u672c\u76f8\u5173\u7684\u5185\u90e8\u8bf4\u660e",
  developerModulesEyebrow: "\u6a21\u5757\u8def\u7ebf",
  developerModulesTitle: "\u5df2\u5b8c\u6210\u548c\u9884\u7559\u7684\u80fd\u529b",
  developerModulesSummary:
    "\u8fd9\u91cc\u4f1a\u96c6\u4e2d\u663e\u793a\u5df2\u63a5\u5165\u7684\u6a21\u5757\u3001\u5f53\u524d\u7684\u5f00\u53d1\u9636\u6bb5\uff0c\u4ee5\u53ca\u540e\u7eed\u4e13\u6ce8\u63d0\u9192\u3001\u4f1a\u8bdd\u6062\u590d\u548c\u6570\u636e\u5907\u4efd\u65b9\u5411\u7684\u9884\u7559\u3002",
  fallbackPrefix: "\u8f7d\u5165\u56de\u9000\u4fe1\u606f\uff1a",
  windows: "Windows",
  defaultError: "\u64cd\u4f5c\u6ca1\u6709\u6210\u529f\uff0c\u8bf7\u91cd\u8bd5\u3002",
} as const;

const emptySnapshot: ShellSnapshot = {
  productName: "Focused Moment",
  version: "1.2.4",
  milestone: "v1.2.4 \u4e3b\u754c\u9762\u7a7a\u95f4\u4f18\u5316\u7248",
  slogan:
    "\u7528\u66f4\u8f7b\u7684\u65b9\u5f0f\u4e13\u6ce8\u3001\u5b89\u6392\u548c\u590d\u76d8\u6bcf\u4e00\u5929\u3002",
  surfaces: [],
  reservedExtensions: [],
};

const emptyTimerSnapshot: TimerSnapshot = {
  modeKey: "stopwatch",
  phaseKey: "stopwatch",
  mode: "\u6b63\u5411\u8ba1\u65f6",
  phaseLabel: "\u6b63\u5411\u8ba1\u65f6",
  status: "\u672a\u5f00\u59cb",
  isRunning: false,
  elapsedMs: 0,
  elapsedLabel: "00:00:00",
  secondaryLabel: "\u5df2\u7d2f\u8ba1\u4e13\u6ce8\u65f6\u957f",
  canCompleteSession: true,
};

const emptyAnalyticsSnapshot: AnalyticsSnapshot = {
  totalFocusDurationMs: 0,
  totalFocusDurationLabel: "00:00:00",
  sessionCount: 0,
  linkedSessionCount: 0,
  independentSessionCount: 0,
  pendingTodoCount: 0,
  completedTodoCount: 0,
  activeDays: 0,
  averageDailyDurationLabel: "00:00:00",
  todayFocusDurationLabel: "00:00:00",
  todaySessionCount: 0,
  dailyBreakdown: [],
};

function formatTrendDateLabel(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }

  return `${match[2]}/${match[3]}`;
}

function formatDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = `${Math.floor(totalSeconds / 3600)}`.padStart(2, "0");
  const minutes = `${Math.floor((totalSeconds % 3600) / 60)}`.padStart(2, "0");
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function isIsoDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysToIsoDate(baseDate: string, offsetDays: number) {
  const nextDate = new Date(`${baseDate}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return nextDate.toISOString().slice(0, 10);
}

function normalizeCustomRange(startDate: string, endDate: string) {
  if (!isIsoDateValue(startDate) && !isIsoDateValue(endDate)) {
    return { startDate: "", endDate: "" };
  }

  if (!isIsoDateValue(startDate)) {
    return { startDate: endDate, endDate };
  }

  if (!isIsoDateValue(endDate)) {
    return { startDate, endDate: startDate };
  }

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}

function buildDailyBreakdown(records: FocusRecord[]): DailyInsight[] {
  const groups = new Map<
    string,
    {
      totalDurationMs: number;
      sessionCount: number;
      linkedSessionCount: number;
      independentSessionCount: number;
    }
  >();

  for (const record of records) {
    const dateKey =
      record.completedDate && isIsoDateValue(record.completedDate)
        ? record.completedDate
        : "\u672a\u8bb0\u5f55\u65e5\u671f";
    const current = groups.get(dateKey) ?? {
      totalDurationMs: 0,
      sessionCount: 0,
      linkedSessionCount: 0,
      independentSessionCount: 0,
    };

    current.totalDurationMs += record.durationMs;
    current.sessionCount += 1;
    if (record.linkedTodoId !== null) {
      current.linkedSessionCount += 1;
    } else {
      current.independentSessionCount += 1;
    }

    groups.set(dateKey, current);
  }

  return [...groups.entries()]
    .map(([date, summary]) => ({
      date,
      totalDurationMs: summary.totalDurationMs,
      totalDurationLabel: formatDurationLabel(summary.totalDurationMs),
      sessionCount: summary.sessionCount,
      linkedSessionCount: summary.linkedSessionCount,
      independentSessionCount: summary.independentSessionCount,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function buildReviewSummary(records: FocusRecord[]): ReviewSummary {
  const totalFocusDurationMs = records.reduce(
    (total, record) => total + record.durationMs,
    0
  );
  const dailyBreakdown = buildDailyBreakdown(records);
  const linkedSessionCount = records.filter(
    (record) => record.linkedTodoId !== null
  ).length;
  const sessionCount = records.length;
  const activeDays = dailyBreakdown.filter((day) => isIsoDateValue(day.date)).length;
  const stopwatchSessionCount = records.filter(
    (record) => record.modeKey === "stopwatch"
  ).length;
  const pomodoroSessionCount = records.filter(
    (record) => record.modeKey === "pomodoro"
  ).length;
  const linkedTaskCount = new Set(
    records
      .map((record) => record.linkedTodoId)
      .filter((id): id is number => id !== null)
  ).size;

  return {
    totalFocusDurationMs,
    totalFocusDurationLabel: formatDurationLabel(totalFocusDurationMs),
    sessionCount,
    linkedSessionCount,
    independentSessionCount: sessionCount - linkedSessionCount,
    activeDays,
    averageDailyDurationLabel:
      activeDays > 0
        ? formatDurationLabel(totalFocusDurationMs / activeDays)
        : "00:00:00",
    stopwatchSessionCount,
    pomodoroSessionCount,
    linkedTaskCount,
    dailyBreakdown,
  };
}

function MainShell() {
  const [snapshot, setSnapshot] = createSignal<ShellSnapshot>(emptySnapshot);
  const [timerSnapshot, setTimerSnapshot] =
    createSignal<TimerSnapshot>(emptyTimerSnapshot);
  const [currentTaskTitle, setCurrentTaskTitle] = createSignal("");
  const [linkedTodoId, setLinkedTodoId] = createSignal<number | null>(null);
  const [records, setRecords] = createSignal<FocusRecord[]>([]);
  const [analyticsSnapshot, setAnalyticsSnapshot] =
    createSignal<AnalyticsSnapshot>(emptyAnalyticsSnapshot);
  const [todoItems, setTodoItems] = createSignal<TodoItem[]>([]);
  const [todoDraft, setTodoDraft] =
    createSignal<TodoDraft>(createDefaultTodoDraft());
  const [editingTodoId, setEditingTodoId] = createSignal<number | null>(null);
  const [editingTodoDraft, setEditingTodoDraft] =
    createSignal<TodoDraft>(createDefaultTodoDraft());
  const [statusText, setStatusText] = createSignal<string>(copy.loading);
  const [bootError, setBootError] = createSignal<string | null>(null);
  const [timerBusy, setTimerBusy] = createSignal(false);
  const [todoBusy, setTodoBusy] = createSignal(false);
  const [activeView, setActiveView] = createSignal<ViewKey>("focus");
  const [reviewRange, setReviewRange] = createSignal<ReviewRangeKey>("7d");
  const [customStartDate, setCustomStartDate] = createSignal(getLocalDateValue());
  const [customEndDate, setCustomEndDate] = createSignal(getLocalDateValue());
  const [todoSearchQuery, setTodoSearchQuery] = createSignal("");
  const [todoFilter, setTodoFilter] = createSignal<TodoFilterKey>("all");
  const [todoSort, setTodoSort] = createSignal<TodoSortKey>("smart");
  const [showCompletedTodos, setShowCompletedTodos] = createSignal(false);

  const timerReady = () => !bootError();
  const taskHintText = () =>
    timerSnapshot().modeKey === "pomodoro"
      ? copy.pomodoroTaskHint
      : copy.currentTaskHint;
  const pendingTodoCount = () =>
    todoItems().filter((item) => !item.isCompleted).length;
  const completedTodoCount = () =>
    todoItems().filter((item) => item.isCompleted).length;
  const linkableTodoItems = () =>
    todoItems().filter((item) => !item.isCompleted);
  const recentFocusRecords = () => {
    const threshold = addDaysToIsoDate(getLocalDateValue(), -6);
    return records()
      .filter(
        (record) =>
          !isIsoDateValue(record.completedDate) || record.completedDate >= threshold
      )
      .slice(0, 6);
  };
  const visibleTodoItems = () => {
    const searchQuery = todoSearchQuery().trim().toLowerCase();
    const today = getLocalDateValue();
    const filteredItems = todoItems().filter((item) => {
      if (
        searchQuery &&
        !item.title.toLowerCase().includes(searchQuery)
      ) {
        return false;
      }

      switch (todoFilter()) {
        case "pending":
          return !item.isCompleted;
        case "completed":
          return item.isCompleted;
        case "today":
          return item.scheduledDate === today;
        case "high":
          return item.importanceKey === "high";
        default:
          return true;
      }
    });

    if (todoSort() === "smart") {
      return filteredItems;
    }

    return filteredItems.slice().sort((left, right) => {
      if (todoSort() === "schedule") {
        return getTodoScheduleSortValue(left).localeCompare(
          getTodoScheduleSortValue(right)
        );
      }

      if (todoSort() === "importance") {
        return (
          getImportanceRank(left.importanceKey) -
            getImportanceRank(right.importanceKey) ||
          Number(left.isCompleted) - Number(right.isCompleted) ||
          right.id - left.id
        );
      }

      if (todoSort() === "newest") {
        return right.id - left.id;
      }

      return left.title.localeCompare(right.title, "zh-Hans-CN");
    });
  };
  const visiblePendingTodoItems = () =>
    visibleTodoItems().filter((item) => !item.isCompleted);
  const visibleCompletedTodoItems = () =>
    visibleTodoItems().filter((item) => item.isCompleted);
  const shouldShowCompletedTodoSection = () =>
    visibleCompletedTodoItems().length > 0;
  const isCompletedTodoSectionExpanded = () =>
    todoFilter() === "completed" || showCompletedTodos();
  const displayedTodoCount = () =>
    visiblePendingTodoItems().length +
    (isCompletedTodoSectionExpanded() ? visibleCompletedTodoItems().length : 0);
  const storedRecordCount = () => analyticsSnapshot().sessionCount;
  const linkedTodoItem = () =>
    linkableTodoItems().find((item) => item.id === linkedTodoId()) ?? null;
  const linkedTodoValue = () =>
    linkedTodoId() === null ? "" : String(linkedTodoId());
  const taskLinkSummary = () =>
    linkedTodoItem()
      ? `${copy.linkTodoPrefix}${linkedTodoItem()?.title ?? ""}`
      : copy.linkTodoHint;
  const completionLabel = () => {
    if (timerSnapshot().modeKey !== "pomodoro") {
      return copy.complete;
    }

    return timerSnapshot().phaseKey === "break"
      ? copy.completePomodoroPending
      : copy.completePomodoro;
  };
  const completionTitle = () =>
    currentTaskTitle().trim() || linkedTodoItem()?.title || copy.unnamedTask;
  const canCompleteAction = () =>
    timerSnapshot().canCompleteSession &&
    !(
      timerSnapshot().phaseKey !== "break" &&
      timerSnapshot().elapsedMs === 0 &&
      !timerSnapshot().isRunning
    );
  const normalizedCustomRange = () =>
    normalizeCustomRange(customStartDate(), customEndDate());
  const reviewRangeLabel = () => {
    const option = reviewRangeOptions.find((item) => item.key === reviewRange());
    if (reviewRange() !== "custom") {
      return option?.label ?? copy.defaultError;
    }

    const { startDate, endDate } = normalizedCustomRange();
    if (!startDate || !endDate) {
      return option?.label ?? copy.defaultError;
    }

    return `${formatTrendDateLabel(startDate)} - ${formatTrendDateLabel(endDate)}`;
  };
  const filteredInsightRecords = () => {
    const preset = reviewRange();
    const today = getLocalDateValue();
    const { startDate, endDate } = normalizedCustomRange();

    return records().filter((record) => {
      if (preset === "all") {
        return true;
      }

      if (!isIsoDateValue(record.completedDate)) {
        return false;
      }

      switch (preset) {
        case "today":
          return record.completedDate === today;
        case "7d":
          return record.completedDate >= addDaysToIsoDate(today, -6);
        case "30d":
          return record.completedDate >= addDaysToIsoDate(today, -29);
        case "custom":
          if (!startDate || !endDate) {
            return false;
          }
          return (
            record.completedDate >= startDate && record.completedDate <= endDate
          );
        default:
          return true;
      }
    });
  };
  const filteredReviewSummary = () => buildReviewSummary(filteredInsightRecords());
  const latestDailyBreakdown = () =>
    filteredReviewSummary().dailyBreakdown.slice(0, 7);
  const orderedTrendDays = () => latestDailyBreakdown().slice().reverse();
  const latestTrendDay = () => {
    const days = orderedTrendDays();
    return days.length > 0 ? days[days.length - 1] : null;
  };
  const peakTrendDay = () => {
    const days = orderedTrendDays();
    if (days.length === 0) {
      return null;
    }

    return days.reduce((peak, current) =>
      current.totalDurationMs > peak.totalDurationMs ? current : peak
    );
  };
  const trendSessionTotal = () =>
    orderedTrendDays().reduce((total, day) => total + day.sessionCount, 0);
  const trendAverageDurationLabel = () => {
    const days = orderedTrendDays();
    if (days.length === 0) {
      return "00:00:00";
    }

    const totalDurationMs = days.reduce(
      (total, day) => total + day.totalDurationMs,
      0
    );
    return formatDurationLabel(totalDurationMs / days.length);
  };
  const trendMaxDurationMs = () =>
    Math.max(1, ...orderedTrendDays().map((day) => day.totalDurationMs));
  const trendPointX = (index: number, total: number) =>
    total <= 1 ? 296 : 42 + (index * 508) / (total - 1);
  const trendPointY = (value: number, max: number) => 164 - (value / max) * 116;
  const trendLinePoints = () => {
    const days = orderedTrendDays();
    const max = trendMaxDurationMs();
    return days
      .map((day, index) =>
        `${trendPointX(index, days.length)},${trendPointY(day.totalDurationMs, max)}`
      )
      .join(" ");
  };
  const trendAreaPoints = () => {
    const days = orderedTrendDays();
    if (days.length === 0) {
      return "";
    }

    const line = trendLinePoints();
    const firstX = trendPointX(0, days.length);
    const lastX = trendPointX(days.length - 1, days.length);
      return `${firstX},164 ${line} ${lastX},164`;
    };

  createEffect(() => {
    const activeLinkedTodoId = linkedTodoId();
    if (
      activeLinkedTodoId !== null &&
      !linkableTodoItems().some((item) => item.id === activeLinkedTodoId)
    ) {
      setLinkedTodoId(null);
    }
  });

  function renderTodoCard(item: TodoItem) {
    return (
      <article
        classList={{
          "todo-card": true,
          "todo-card--completed": item.isCompleted,
        }}
      >
        <button
          type="button"
          classList={{
            "todo-toggle": true,
            "todo-toggle--completed": item.isCompleted,
          }}
          disabled={todoBusy()}
          onClick={() => void handleToggleTodo(item.id)}
        >
          {item.isCompleted ? "\u2713" : ""}
        </button>

        <div class="todo-card__body">
          {editingTodoId() === item.id ? (
            <div class="todo-edit-row">
              <input
                class="task-input"
                type="text"
                value={editingTodoDraft().title}
                disabled={todoBusy()}
                onInput={(event) =>
                  patchEditingTodoDraft({
                    title: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSaveTodo(item.id);
                  }
                }}
              />
              <div class="todo-form-grid">
                <label class="todo-form-field">
                  <span>{copy.todoDateLabel}</span>
                  <input
                    class="task-input"
                    type="date"
                    value={editingTodoDraft().scheduledDate}
                    disabled={todoBusy()}
                    onInput={(event) =>
                      patchEditingTodoDraft({
                        scheduledDate: event.currentTarget.value,
                      })
                    }
                  />
                </label>
                <label class="todo-form-field">
                  <span>{copy.todoTimeLabel}</span>
                  <input
                    class="task-input"
                    type="time"
                    value={editingTodoDraft().scheduledTime}
                    disabled={todoBusy()}
                    onInput={(event) =>
                      patchEditingTodoDraft({
                        scheduledTime: event.currentTarget.value,
                      })
                    }
                  />
                </label>
                <label class="todo-form-field">
                  <span>{copy.todoImportanceLabel}</span>
                  <select
                    class="task-input task-select"
                    value={editingTodoDraft().importanceKey}
                    disabled={todoBusy()}
                    onChange={(event) =>
                      patchEditingTodoDraft({
                        importanceKey: event.currentTarget.value as TodoImportance,
                      })
                    }
                  >
                    <For each={importanceOptions}>
                      {(option) => <option value={option.key}>{option.label}</option>}
                    </For>
                  </select>
                </label>
              </div>
              <div class="todo-inline-actions">
                <button
                  type="button"
                  class="action-button action-button--success"
                  disabled={todoBusy() || !editingTodoDraft().title.trim()}
                  onClick={() => void handleSaveTodo(item.id)}
                >
                  {copy.todoSave}
                </button>
                <button
                  type="button"
                  class="action-button"
                  disabled={todoBusy()}
                  onClick={() => cancelTodoEditing()}
                >
                  {copy.todoCancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div class="todo-card__title-row">
                <strong>{item.title}</strong>
                <span class="todo-status-pill">
                  {item.isCompleted ? copy.todoStatusDone : copy.todoStatusPending}
                </span>
              </div>
              <div class="todo-attribute-row">
                <span class="todo-attribute">
                  {copy.todoDateValueLabel}
                  {`\uff1a${item.scheduledDate}`}
                </span>
                <span class="todo-attribute">
                  {copy.todoTimeValueLabel}
                  {`\uff1a${formatScheduledTimeLabel(item.scheduledTime)}`}
                </span>
                <span
                  classList={{
                    "todo-attribute": true,
                    "todo-attribute--high": item.importanceKey === "high",
                    "todo-attribute--medium": item.importanceKey === "medium",
                    "todo-attribute--low": item.importanceKey === "low",
                  }}
                >
                  {copy.todoImportanceValueLabel}
                  {`\uff1a${getImportanceLabel(item.importanceKey)}`}
                </span>
              </div>
            </>
          )}
        </div>

        {editingTodoId() !== item.id && (
          <div class="todo-inline-actions">
            <button
              type="button"
              class="action-button"
              disabled={todoBusy()}
              onClick={() => beginTodoEditing(item)}
            >
              {copy.todoEdit}
            </button>
            <button
              type="button"
              class="action-button"
              disabled={todoBusy()}
              onClick={() => void handleDeleteTodo(item.id)}
            >
              {copy.todoDelete}
            </button>
          </div>
        )}
      </article>
    );
  }

  function patchTodoDraft(patch: Partial<TodoDraft>) {
    setTodoDraft((current) => ({ ...current, ...patch }));
  }

  function patchEditingTodoDraft(patch: Partial<TodoDraft>) {
    setEditingTodoDraft((current) => ({ ...current, ...patch }));
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return copy.defaultError;
  }

  async function refreshTimerSnapshot() {
    const nextTimerSnapshot = await getTimerSnapshot();
    setTimerSnapshot(nextTimerSnapshot);
  }

  async function refreshFocusRecords() {
    const nextRecords = await getFocusRecords();
    setRecords(nextRecords);
  }

  async function refreshAnalyticsSummary() {
    const nextAnalyticsSnapshot = await getAnalyticsSnapshot();
    setAnalyticsSnapshot(nextAnalyticsSnapshot);
  }

  async function refreshTodoItems() {
    const nextTodoItems = await getTodoItems();
    setTodoItems(nextTodoItems);
  }

  async function runTimerAction(action: () => Promise<TimerSnapshot>) {
    if (timerBusy()) {
      return;
    }

    setTimerBusy(true);

    try {
      const nextTimerSnapshot = await action();
      setTimerSnapshot(nextTimerSnapshot);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function runTodoAction(action: () => Promise<TodoItem[]>) {
    if (todoBusy()) {
      return;
    }

    setTodoBusy(true);

    try {
      const nextTodoItems = await action();
      setTodoItems(nextTodoItems);
      await refreshAnalyticsSummary();
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTodoBusy(false);
    }
  }

  async function handleCreateTodo() {
    const draft = todoDraft();
    const normalizedTitle = draft.title.trim();
    if (!normalizedTitle) {
      return;
    }

    await runTodoAction(() =>
      createTodoItem({
        ...draft,
        title: normalizedTitle,
      })
    );
    patchTodoDraft({ title: "" });
    setStatusText(`\u5df2\u6dfb\u52a0\u4efb\u52a1\uff1a${normalizedTitle}`);
  }

  async function handleToggleTodo(id: number) {
    await runTodoAction(() => toggleTodoItem(id));
  }

  async function handleDeleteTodo(id: number) {
    await runTodoAction(() => deleteTodoItem(id));

    if (editingTodoId() === id) {
      setEditingTodoId(null);
      setEditingTodoDraft(createDefaultTodoDraft());
    }

    if (linkedTodoId() === id) {
      setLinkedTodoId(null);
    }
  }

  function beginTodoEditing(item: TodoItem) {
    setEditingTodoId(item.id);
    setEditingTodoDraft({
      title: item.title,
      scheduledDate: item.scheduledDate,
      scheduledTime: item.scheduledTime,
      importanceKey: item.importanceKey,
    });
  }

  function cancelTodoEditing() {
    setEditingTodoId(null);
    setEditingTodoDraft(createDefaultTodoDraft());
  }

  async function handleSaveTodo(id: number) {
    const draft = editingTodoDraft();
    const normalizedTitle = draft.title.trim();
    if (!normalizedTitle) {
      return;
    }

    await runTodoAction(() =>
      updateTodoItem(id, {
        ...draft,
        title: normalizedTitle,
      })
    );
    setEditingTodoId(null);
    setEditingTodoDraft(createDefaultTodoDraft());
    setStatusText(`\u5df2\u66f4\u65b0\u4efb\u52a1\uff1a${normalizedTitle}`);
  }

  async function handleCompleteSession() {
    if (timerBusy()) {
      return;
    }

    setTimerBusy(true);

    try {
      const payload = await completeFocusSession(
        currentTaskTitle(),
        linkedTodoId()
      );
      setTimerSnapshot(payload.timerSnapshot);
      setRecords(payload.records);
      await refreshAnalyticsSummary();
      setStatusText(`\u5df2\u8bb0\u5f55\uff1a${completionTitle()}`);
      setCurrentTaskTitle("");
      setLinkedTodoId(null);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleClearAppData() {
    if (todoBusy() || timerBusy()) {
      return;
    }

    const shouldClear = window.confirm(copy.clearDataConfirm);
    if (!shouldClear) {
      return;
    }

    setTodoBusy(true);
    setTimerBusy(true);

    try {
      await clearAppData();
      setCurrentTaskTitle("");
      setLinkedTodoId(null);
      setEditingTodoId(null);
      setEditingTodoDraft(createDefaultTodoDraft());
      setTodoDraft(createDefaultTodoDraft());
      await refreshTimerSnapshot();
      await refreshFocusRecords();
      await refreshTodoItems();
      await refreshAnalyticsSummary();
      setStatusText(copy.clearDataDone);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTodoBusy(false);
      setTimerBusy(false);
    }
  }

  async function handleDeleteRecord(id: number, title: string) {
    if (timerBusy()) {
      return;
    }

    const shouldDelete = window.confirm(`确定删除这条专注记录吗？\n\n${title}`);
    if (!shouldDelete) {
      return;
    }

    setTimerBusy(true);

    try {
      const nextRecords = await deleteFocusRecord(id);
      setRecords(nextRecords);
      await refreshAnalyticsSummary();
      setStatusText(`已删除专注记录：${title}`);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleClearRangeRecords() {
    if (timerBusy()) {
      return;
    }

    const ids = filteredInsightRecords().map((record) => record.id);
    if (ids.length === 0) {
      setStatusText(copy.insightRecordsEmpty);
      return;
    }

    const shouldClear = window.confirm(copy.clearRangeConfirm);
    if (!shouldClear) {
      return;
    }

    setTimerBusy(true);

    try {
      const nextRecords = await deleteFocusRecords(ids);
      setRecords(nextRecords);
      await refreshAnalyticsSummary();
      setStatusText(copy.clearRangeDone);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleExportRangeRecords() {
    if (timerBusy()) {
      return;
    }

    const ids = filteredInsightRecords().map((record) => record.id);
    if (ids.length === 0) {
      setStatusText(copy.insightRecordsEmpty);
      return;
    }

    setTimerBusy(true);

    try {
      const exportPath = await exportFocusRecordsCsv(ids);
      setStatusText(`${copy.exportDonePrefix} ${exportPath}`);
    } catch (error) {
      setStatusText(getErrorMessage(error));
    } finally {
      setTimerBusy(false);
    }
  }

  function handleWindowDragRegionPointerDown(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (
      !target ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea")
    ) {
      return;
    }

    void startDraggingMainWindow().catch(() => {
      // Ignore transient drag errors and keep the current interaction.
    });
  }

  onMount(async () => {
    try {
      const nextSnapshot = await invoke<ShellSnapshot>("bootstrap_shell");
      setSnapshot(nextSnapshot);
      await refreshTimerSnapshot();
      await refreshFocusRecords();
      await refreshTodoItems();
      await refreshAnalyticsSummary();
      setStatusText(copy.ready);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : copy.shellFallback;
      setBootError(message);
      setStatusText(copy.fallback);
    }

    const timerId = window.setInterval(() => {
      void refreshTimerSnapshot().catch(() => {
        // Ignore transient polling errors and keep the last valid timer state.
      });
    }, 250);

    onCleanup(() => {
      window.clearInterval(timerId);
    });
  });

  return (
    <div class="shell">
      <header class="window-chrome">
        <div class="brand-lockup">
          <div class="brand-mark">
            <span class="brand-mark__dot" />
          </div>
          <div class="brand-copy">
            <span class="brand-copy__eyebrow">{copy.versionEyebrow}</span>
            <strong>{snapshot().productName}</strong>
          </div>
        </div>

        <div
          class="window-drag-region"
          data-tauri-drag-region
          onMouseDown={handleWindowDragRegionPointerDown}
          onDblClick={() => void toggleMaximizeMainWindow()}
        >
          <div class="window-drag-hint">{copy.dragHint}</div>
          <div class="window-drag-subhint">{copy.dragSubhint}</div>
        </div>

        <div class="window-actions">
          <button
            type="button"
            class="window-button"
            onClick={() => void minimizeMainWindow()}
          >
            {copy.minimize}
          </button>
          <button
            type="button"
            class="window-button"
            onClick={() => void toggleMaximizeMainWindow()}
          >
            {copy.maximize}
          </button>
          <button
            type="button"
            class="window-button window-button--danger"
            onClick={() => void closeMainWindow()}
          >
            {copy.close}
          </button>
          <button
            type="button"
            class="window-button window-button--danger"
            onClick={() => void quitApplication()}
          >
            {copy.quit}
          </button>
        </div>
      </header>

      <main class="workspace workspace--single">
        <section class="panel view-switcher">
          <div class="view-switcher__copy">
            <span class="eyebrow">{copy.switcherEyebrow}</span>
            <h2>{copy.switcherTitle}</h2>
            <p>{copy.switcherSummary}</p>
          </div>

          <div class="view-switcher__actions">
            <For each={viewItems}>
              {(item) => (
                <button
                  type="button"
                  classList={{
                    "view-chip": true,
                    "view-chip--active": activeView() === item.key,
                  }}
                  onClick={() => setActiveView(item.key)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                </button>
              )}
            </For>
          </div>
        </section>

        <Show when={activeView() === "focus"}>
          <section class="hero-panel panel">
            <div class="hero-copy timer-hero">
              <span class="eyebrow">{copy.focusEyebrow}</span>
              <h1>{copy.focusTitle}</h1>
              <p class="hero-text">{snapshot().slogan}</p>
              <p class="hero-subtext">{copy.focusSummary}</p>
            </div>

            <p class="tray-copy">{copy.trayHint}</p>

            <div class="metric-grid">
              <article class="metric-card">
                <span class="metric-label">{copy.focusTodayLabel}</span>
                <strong>{analyticsSnapshot().todayFocusDurationLabel}</strong>
                <span class="metric-footnote">{copy.focusTodayNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.focusRecordsLabel}</span>
                <strong>{storedRecordCount()}</strong>
                <span class="metric-footnote">{copy.focusRecordsNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.focusPendingLabel}</span>
                <strong>{pendingTodoCount()}</strong>
                <span class="metric-footnote">{copy.focusPendingNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.focusModeLabel}</span>
                <strong>{timerSnapshot().mode}</strong>
                <span class="metric-footnote">{copy.focusModeNote}</span>
              </article>
            </div>

            <section class="timer-panel">
              <div class="mode-switch">
                <span class="eyebrow">{copy.modeSwitchEyebrow}</span>
                <div class="mode-switch__actions">
                  <button
                    type="button"
                    classList={{
                      "mode-chip": true,
                      "mode-chip--active": timerSnapshot().modeKey === "stopwatch",
                    }}
                    disabled={timerBusy()}
                    onClick={() => void runTimerAction(() => switchTimerMode("stopwatch"))}
                  >
                    {copy.stopwatchMode}
                  </button>
                  <button
                    type="button"
                    classList={{
                      "mode-chip": true,
                      "mode-chip--active": timerSnapshot().modeKey === "pomodoro",
                    }}
                    disabled={timerBusy()}
                    onClick={() => void runTimerAction(() => switchTimerMode("pomodoro"))}
                  >
                    {copy.pomodoroMode}
                  </button>
                </div>
              </div>

              <div class="task-entry">
                <div class="task-entry__copy">
                  <span class="eyebrow">{copy.currentTaskEyebrow}</span>
                  <h2>{copy.currentTaskTitle}</h2>
                  <p>{taskHintText()}</p>
                </div>

                <div class="task-entry__controls">
                  <label class="task-entry__field">
                    <input
                      class="task-input"
                      type="text"
                      value={currentTaskTitle()}
                      placeholder={copy.taskPlaceholder}
                      onInput={(event) =>
                        setCurrentTaskTitle(event.currentTarget.value)
                      }
                    />
                  </label>

                  <label class="todo-form-field task-entry__field task-entry__field--compact">
                    <span>{copy.linkTodoLabel}</span>
                    <select
                      class="task-input task-select"
                      value={linkedTodoValue()}
                      onChange={(event) =>
                        setLinkedTodoId(
                          event.currentTarget.value
                            ? Number(event.currentTarget.value)
                            : null
                        )
                      }
                    >
                      <option value="">{copy.linkTodoEmpty}</option>
                      <For each={linkableTodoItems()}>
                        {(item) => (
                          <option value={item.id}>
                            {`${item.title} - ${item.scheduledDate} ${formatScheduledTimeLabel(item.scheduledTime)}`}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                </div>

                <p class="task-link-hint">{taskLinkSummary()}</p>
              </div>

              <div class="timer-panel__header">
                <div>
                  <span class="eyebrow">{copy.modeEyebrow}</span>
                  <h2>{timerSnapshot().phaseLabel}</h2>
                </div>
                <span
                  classList={{
                    "timer-status": true,
                    "timer-status--running": timerSnapshot().isRunning,
                  }}
                >
                  {timerSnapshot().status}
                </span>
              </div>

              <p class="timer-secondary">{timerSnapshot().secondaryLabel}</p>
              {currentTaskTitle().trim() && (
                <p class="timer-focus-copy">
                  {copy.currentFocusLabel}
                  {`\uff1a${currentTaskTitle().trim()}`}
                </p>
              )}
              <div class="timer-display">{timerSnapshot().elapsedLabel}</div>
              {timerSnapshot().modeKey === "pomodoro" && (
                <p class="timer-mode-hint">{copy.pomodoroHint}</p>
              )}

              <div class="timer-actions">
                <button
                  type="button"
                  class="action-button action-button--primary"
                  disabled={timerBusy() || timerSnapshot().isRunning || !timerReady()}
                  onClick={() => void runTimerAction(startTimer)}
                >
                  {copy.start}
                </button>
                <button
                  type="button"
                  class="action-button"
                  disabled={timerBusy() || !timerSnapshot().isRunning || !timerReady()}
                  onClick={() => void runTimerAction(pauseTimer)}
                >
                  {copy.pause}
                </button>
                <button
                  type="button"
                  class="action-button"
                  disabled={
                    timerBusy() ||
                    (timerSnapshot().elapsedMs === 0 && !timerSnapshot().isRunning) ||
                    !timerReady()
                  }
                  onClick={() => void runTimerAction(resetTimer)}
                >
                  {copy.reset}
                </button>
                <button
                  type="button"
                  class="action-button action-button--success"
                  disabled={
                    timerBusy() ||
                    !canCompleteAction() ||
                    !timerReady()
                  }
                  onClick={() => void handleCompleteSession()}
                >
                  {completionLabel()}
                </button>
              </div>

              <section class="records-panel">
                <div class="records-panel__header">
                  <div>
                    <span class="eyebrow">{copy.recordsEyebrow}</span>
                    <h3>{copy.recordsTitle}</h3>
                  </div>
                  <p class="records-panel__summary">{copy.recordsWindowNote}</p>
                </div>

                <div class="records-list">
                  <For each={recentFocusRecords()}>
                    {(record) => (
                      <article class="record-card">
                        <div class="record-card__main">
                          <div class="record-card__copy">
                            <strong>{record.title}</strong>
                            <div class="record-card__meta">
                              <span class="record-pill">{record.phaseLabel}</span>
                              <span
                                classList={{
                                  "record-pill": true,
                                  "record-pill--muted": !record.linkedTodoTitle,
                                }}
                              >
                                {record.linkedTodoTitle
                                  ? `${copy.recordLinkedPrefix}${record.linkedTodoTitle}`
                                  : copy.recordIndependent}
                              </span>
                              {record.completedAt && (
                                <span class="record-pill record-pill--muted">
                                  {`${copy.recordCompletedAt}\uff1a${record.completedDate} ${record.completedTime}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <span>{record.durationLabel}</span>
                        </div>
                      </article>
                    )}
                  </For>
                  {records().length === 0 && (
                    <p class="records-empty">{copy.recordsEmpty}</p>
                  )}
                  {records().length > 0 && recentFocusRecords().length === 0 && (
                    <p class="records-empty">{copy.recordsRecentEmpty}</p>
                  )}
                </div>
              </section>
            </section>
          </section>
        </Show>

        <Show when={activeView() === "tasks"}>
          <section class="panel section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">{copy.todoEyebrow}</span>
              <h2>{copy.todoTitle}</h2>
            </div>
            <p>{copy.todoSummary}</p>
          </div>

          <div class="todo-creation">
            <input
              class="task-input"
              type="text"
              value={todoDraft().title}
              placeholder={copy.todoPlaceholder}
              disabled={todoBusy()}
              onInput={(event) =>
                patchTodoDraft({ title: event.currentTarget.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateTodo();
                }
              }}
            />
            <div class="todo-form-grid">
              <label class="todo-form-field">
                <span>{copy.todoDateLabel}</span>
                <input
                  class="task-input"
                  type="date"
                  value={todoDraft().scheduledDate}
                  disabled={todoBusy()}
                  onInput={(event) =>
                    patchTodoDraft({ scheduledDate: event.currentTarget.value })
                  }
                />
              </label>
              <label class="todo-form-field">
                <span>{copy.todoTimeLabel}</span>
                <input
                  class="task-input"
                  type="time"
                  value={todoDraft().scheduledTime}
                  disabled={todoBusy()}
                  onInput={(event) =>
                    patchTodoDraft({ scheduledTime: event.currentTarget.value })
                  }
                />
              </label>
              <label class="todo-form-field">
                <span>{copy.todoImportanceLabel}</span>
                <select
                  class="task-input task-select"
                  value={todoDraft().importanceKey}
                  disabled={todoBusy()}
                  onChange={(event) =>
                    patchTodoDraft({
                      importanceKey: event.currentTarget.value as TodoImportance,
                    })
                  }
                >
                  <For each={importanceOptions}>
                    {(option) => (
                      <option value={option.key}>{option.label}</option>
                    )}
                  </For>
                </select>
              </label>
            </div>
            <button
              type="button"
              class="action-button action-button--primary"
              disabled={todoBusy() || !todoDraft().title.trim()}
              onClick={() => void handleCreateTodo()}
            >
              {copy.todoCreate}
            </button>
          </div>

          <div class="todo-metrics">
            <article class="todo-metric-card">
              <span class="metric-label">{copy.todoPendingCount}</span>
              <strong>{pendingTodoCount()}</strong>
            </article>
            <article class="todo-metric-card">
              <span class="metric-label">{copy.todoCompletedCount}</span>
              <strong>{completedTodoCount()}</strong>
            </article>
            <article class="todo-metric-card">
              <span class="metric-label">{copy.todoVisibleCount}</span>
              <strong>{displayedTodoCount()}</strong>
            </article>
          </div>

          <section class="records-panel todo-tools-panel">
            <div class="records-panel__header">
              <div>
                <span class="eyebrow">{copy.todoToolsEyebrow}</span>
                <h3>{copy.todoToolsTitle}</h3>
              </div>
              <p class="chart-panel__summary">{copy.todoToolsSummary}</p>
            </div>

            <div class="todo-tools-panel__controls">
              <input
                class="task-input"
                type="text"
                value={todoSearchQuery()}
                placeholder={copy.todoSearchPlaceholder}
                onInput={(event) => setTodoSearchQuery(event.currentTarget.value)}
              />

              <div class="todo-filter-field">
                <span>{copy.todoFilterLabel}</span>
                <div class="review-range-group">
                  <For each={todoFilterOptions}>
                    {(option) => (
                      <button
                        type="button"
                        classList={{
                          "filter-chip": true,
                          "filter-chip--active": todoFilter() === option.key,
                        }}
                        onClick={() => setTodoFilter(option.key)}
                      >
                        {option.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <label class="todo-form-field todo-sort-field">
                <span>{copy.todoSortLabel}</span>
                <select
                  class="task-input task-select"
                  value={todoSort()}
                  onChange={(event) =>
                    setTodoSort(event.currentTarget.value as TodoSortKey)
                  }
                >
                  <For each={todoSortOptions}>
                    {(option) => (
                      <option value={option.key}>{option.label}</option>
                    )}
                  </For>
                </select>
              </label>
            </div>
          </section>

          <div class="todo-list">
            <For each={visiblePendingTodoItems()}>
              {(item) => renderTodoCard(item)}
            </For>

            <Show when={shouldShowCompletedTodoSection()}>
              <section class="todo-completed-section">
                <button
                  type="button"
                  class="todo-collapse-toggle"
                  onClick={() => setShowCompletedTodos((current) => !current)}
                >
                  <div class="todo-collapse-toggle__copy">
                    <strong>{copy.todoCompletedSection}</strong>
                    <span>{copy.todoCompletedSectionNote}</span>
                  </div>
                  <div class="todo-collapse-toggle__meta">
                    <span class="todo-collapse-toggle__count">
                      {visibleCompletedTodoItems().length}
                    </span>
                    <span
                      classList={{
                        "todo-collapse-toggle__chevron": true,
                        "todo-collapse-toggle__chevron--open":
                          isCompletedTodoSectionExpanded(),
                      }}
                    >
                      {isCompletedTodoSectionExpanded()
                        ? copy.todoCompletedToggleClose
                        : copy.todoCompletedToggleOpen}
                    </span>
                  </div>
                </button>

                <Show when={isCompletedTodoSectionExpanded()}>
                  <div class="todo-completed-list">
                    <For each={visibleCompletedTodoItems()}>
                      {(item) => renderTodoCard(item)}
                    </For>
                  </div>
                </Show>
              </section>
            </Show>

            {todoItems().length === 0 && (
              <p class="records-empty">{copy.todoEmpty}</p>
            )}

            {todoItems().length > 0 && visibleTodoItems().length === 0 && (
              <p class="records-empty">{copy.todoFilteredEmpty}</p>
            )}
          </div>
        </section>
        </Show>

        <Show when={activeView() === "insights"}>
          <section class="panel insights-panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">{copy.insightEyebrow}</span>
                <h2>{copy.insightTitle}</h2>
              </div>
              <p>{copy.insightSummary}</p>
            </div>

            <section class="panel chart-panel review-toolbar">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.insightFilterEyebrow}</span>
                  <h3>{copy.insightFilterTitle}</h3>
                </div>
                <p class="chart-panel__summary">{copy.insightFilterSummary}</p>
              </div>

              <div class="review-toolbar__controls">
                <div class="review-range-group">
                  <For each={reviewRangeOptions}>
                    {(option) => (
                      <button
                        type="button"
                        classList={{
                          "filter-chip": true,
                          "filter-chip--active": reviewRange() === option.key,
                        }}
                        onClick={() => setReviewRange(option.key)}
                      >
                        {option.label}
                      </button>
                    )}
                  </For>
                </div>

                <Show when={reviewRange() === "custom"}>
                  <div class="date-range-inputs">
                    <label class="todo-form-field">
                      <span>{copy.insightCustomStart}</span>
                      <input
                        class="task-input"
                        type="date"
                        value={customStartDate()}
                        onInput={(event) =>
                          setCustomStartDate(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label class="todo-form-field">
                      <span>{copy.insightCustomEnd}</span>
                      <input
                        class="task-input"
                        type="date"
                        value={customEndDate()}
                        onInput={(event) =>
                          setCustomEndDate(event.currentTarget.value)
                        }
                      />
                    </label>
                  </div>
                </Show>
              </div>

              <div class="review-toolbar__footer">
                <span class="record-pill">{`${copy.insightRangeLabelPrefix}：${reviewRangeLabel()}`}</span>
                <div class="review-toolbar__actions">
                  <button
                    type="button"
                    class="action-button"
                    disabled={timerBusy() || filteredInsightRecords().length === 0}
                    onClick={() => void handleExportRangeRecords()}
                  >
                    {copy.exportCsv}
                  </button>
                  <button
                    type="button"
                    class="action-button"
                    disabled={timerBusy() || filteredInsightRecords().length === 0}
                    onClick={() => void handleClearRangeRecords()}
                  >
                    {copy.clearRange}
                  </button>
                  <button
                    type="button"
                    class="action-button"
                    disabled={todoBusy() || timerBusy()}
                    onClick={() => void handleClearAppData()}
                  >
                    {copy.clearData}
                  </button>
                </div>
              </div>
            </section>

            <div class="metric-grid">
              <article class="metric-card">
                <span class="metric-label">{copy.insightTotalFocus}</span>
                <strong>{filteredReviewSummary().totalFocusDurationLabel}</strong>
                <span class="metric-footnote">{copy.insightTotalFocusNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightSessions}</span>
                <strong>{filteredReviewSummary().sessionCount}</strong>
                <span class="metric-footnote">{copy.insightSessionsNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightActiveDays}</span>
                <strong>{filteredReviewSummary().activeDays}</strong>
                <span class="metric-footnote">{copy.insightActiveDaysNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightAverageDaily}</span>
                <strong>{filteredReviewSummary().averageDailyDurationLabel}</strong>
                <span class="metric-footnote">{copy.insightAverageDailyNote}</span>
              </article>
            </div>

            <div class="metric-grid">
              <article class="metric-card">
                <span class="metric-label">{copy.insightStopwatch}</span>
                <strong>{filteredReviewSummary().stopwatchSessionCount}</strong>
                <span class="metric-footnote">{copy.insightStopwatchNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightPomodoro}</span>
                <strong>
                  {filteredReviewSummary().pomodoroSessionCount}
                </strong>
                <span class="metric-footnote">{copy.insightPomodoroNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightLinkedTasks}</span>
                <strong>
                  {filteredReviewSummary().linkedTaskCount}
                </strong>
                <span class="metric-footnote">{copy.insightLinkedTasksNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.insightRelation}</span>
                <strong>
                  {`${filteredReviewSummary().linkedSessionCount} / ${filteredReviewSummary().independentSessionCount}`}
                </strong>
                <span class="metric-footnote">
                  {`${copy.insightRelationNote}\uff1a${copy.insightDailyLinked} ${filteredReviewSummary().linkedSessionCount}\uff0c${copy.insightDailyIndependent} ${filteredReviewSummary().independentSessionCount}`}
                </span>
              </article>
            </div>

            <section class="panel chart-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.insightTrendEyebrow}</span>
                  <h3>{copy.insightTrendTitle}</h3>
                </div>
                <p class="chart-panel__summary">{copy.insightTrendSummary}</p>
              </div>

              <Show
                when={orderedTrendDays().length > 0}
                fallback={<p class="records-empty">{copy.insightTrendEmpty}</p>}
              >
                <div class="trend-shell">
                  <div class="trend-highlights">
                    <article class="trend-highlight-card trend-highlight-card--accent">
                      <span class="trend-highlight-card__label">
                        {copy.insightTrendPeak}
                      </span>
                      <strong>
                        {peakTrendDay()?.totalDurationLabel ?? "00:00:00"}
                      </strong>
                      <p>
                        {peakTrendDay()
                          ? `${formatTrendDateLabel(peakTrendDay()!.date)} · ${peakTrendDay()!.sessionCount}${copy.insightDailySessions}`
                          : copy.insightTrendEmpty}
                      </p>
                    </article>
                    <article class="trend-highlight-card">
                      <span class="trend-highlight-card__label">
                        {copy.insightTrendLatest}
                      </span>
                      <strong>
                        {latestTrendDay()?.totalDurationLabel ?? "00:00:00"}
                      </strong>
                      <p>
                        {latestTrendDay()
                          ? `${formatTrendDateLabel(latestTrendDay()!.date)} · ${copy.insightDailyLinked} ${latestTrendDay()!.linkedSessionCount}`
                          : copy.insightTrendEmpty}
                      </p>
                    </article>
                    <article class="trend-highlight-card">
                      <span class="trend-highlight-card__label">
                        {copy.insightTrendSessions}
                      </span>
                      <strong>{trendSessionTotal()}</strong>
                      <p>{`\u8fd1 ${orderedTrendDays().length} \u5929\u65e5\u5747 ${trendAverageDurationLabel()}`}</p>
                    </article>
                  </div>

                  <Show
                    when={orderedTrendDays().length > 1}
                    fallback={
                      <div class="trend-single-day">
                        <div class="trend-single-day__halo" />
                        <div class="trend-single-day__content">
                          <span class="trend-single-day__date">
                            {latestTrendDay()
                              ? formatTrendDateLabel(latestTrendDay()!.date)
                              : "--/--"}
                          </span>
                          <strong>
                            {latestTrendDay()?.totalDurationLabel ?? "00:00:00"}
                          </strong>
                          <p>{copy.insightTrendSingleDay}</p>
                        </div>
                      </div>
                    }
                  >
                    <div class="trend-chart-card">
                      <svg
                        class="trend-chart__svg"
                        viewBox="0 0 592 196"
                        preserveAspectRatio="none"
                        aria-label={copy.insightTrendTitle}
                      >
                        <defs>
                          <linearGradient
                            id="trend-area-gradient"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop
                              offset="0%"
                              stop-color="rgba(81, 104, 93, 0.24)"
                            />
                            <stop
                              offset="100%"
                              stop-color="rgba(81, 104, 93, 0.02)"
                            />
                          </linearGradient>
                        </defs>
                        <line
                          x1="42"
                          y1="48"
                          x2="550"
                          y2="48"
                          class="trend-chart__guide trend-chart__guide--horizontal"
                        />
                        <line
                          x1="42"
                          y1="106"
                          x2="550"
                          y2="106"
                          class="trend-chart__guide trend-chart__guide--horizontal"
                        />
                        <line x1="42" y1="164" x2="550" y2="164" class="trend-chart__axis" />
                        <polyline
                          class="trend-chart__area"
                          points={trendAreaPoints()}
                        />
                        <polyline
                          class="trend-chart__line"
                          points={trendLinePoints()}
                        />
                        <For each={orderedTrendDays()}>
                          {(day, index) => {
                            const x = () => trendPointX(index(), orderedTrendDays().length);
                            const y = () =>
                              trendPointY(day.totalDurationMs, trendMaxDurationMs());
                            return (
                              <>
                                <line
                                  x1={x()}
                                  y1="164"
                                  x2={x()}
                                  y2={y()}
                                  class="trend-chart__guide"
                                />
                                <circle
                                  cx={x()}
                                  cy={y()}
                                  r="5"
                                  class="trend-chart__dot"
                                />
                                <text
                                  x={x()}
                                  y="186"
                                  text-anchor="middle"
                                  class="trend-chart__label"
                                >
                                  {formatTrendDateLabel(day.date)}
                                </text>
                              </>
                            );
                          }}
                        </For>
                      </svg>
                    </div>
                  </Show>

                  <div class="trend-bars">
                    <For each={orderedTrendDays()}>
                      {(day) => (
                        <article class="trend-bar">
                          <div class="trend-bar__meta">
                            <div class="trend-bar__copy">
                              <strong>{formatTrendDateLabel(day.date)}</strong>
                              <span>{`${day.sessionCount}${copy.insightDailySessions}`}</span>
                            </div>
                            <span>{day.totalDurationLabel}</span>
                          </div>
                          <div class="trend-bar__track">
                            <div
                              class="trend-bar__fill"
                              style={{
                                width: `${Math.max(
                                  12,
                                  (day.totalDurationMs / trendMaxDurationMs()) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </section>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.insightDailyEyebrow}</span>
                  <h3>{copy.insightDailyTitle}</h3>
                </div>
              </div>

              <div class="records-list">
                <For each={latestDailyBreakdown()}>
                  {(day: DailyInsight) => (
                    <article class="record-card">
                      <div class="record-card__main">
                        <div class="record-card__copy">
                          <strong>{day.date}</strong>
                          <div class="record-card__meta">
                            <span class="record-pill">
                              {`${day.sessionCount}${copy.insightDailySessions}`}
                            </span>
                            <span class="record-pill record-pill--muted">
                              {`${copy.insightDailyLinked}\uff1a${day.linkedSessionCount}`}
                            </span>
                            <span class="record-pill record-pill--muted">
                              {`${copy.insightDailyIndependent}\uff1a${day.independentSessionCount}`}
                            </span>
                          </div>
                        </div>
                        <span>{day.totalDurationLabel}</span>
                      </div>
                    </article>
                  )}
                </For>

                {latestDailyBreakdown().length === 0 && (
                  <p class="records-empty">{copy.insightDailyEmpty}</p>
                )}
              </div>
            </section>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.insightRecordsEyebrow}</span>
                  <h3>{copy.insightRecordsTitle}</h3>
                </div>
              </div>

              <div class="records-list">
                <For each={filteredInsightRecords()}>
                  {(record) => (
                    <article class="record-card">
                      <div class="record-card__main">
                        <div class="record-card__copy">
                          <strong>{record.title}</strong>
                          <div class="record-card__meta">
                            <span class="record-pill">{record.phaseLabel}</span>
                            <span class="record-pill record-pill--muted">
                              {record.modeLabel}
                            </span>
                            <span
                              classList={{
                                "record-pill": true,
                                "record-pill--muted": !record.linkedTodoTitle,
                              }}
                            >
                              {record.linkedTodoTitle
                                ? `${copy.recordLinkedPrefix}${record.linkedTodoTitle}`
                                : copy.recordIndependent}
                            </span>
                            {record.completedAt && (
                              <span class="record-pill record-pill--muted">
                                {`${copy.recordCompletedAt}\uff1a${record.completedDate} ${record.completedTime}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div class="record-card__actions">
                          <span>{record.durationLabel}</span>
                          <button
                            type="button"
                            class="action-button"
                            disabled={timerBusy()}
                            onClick={() =>
                              void handleDeleteRecord(record.id, record.title)
                            }
                          >
                            {copy.recordDelete}
                          </button>
                        </div>
                      </div>
                    </article>
                  )}
                </For>

                {filteredInsightRecords().length === 0 && (
                  <p class="records-empty">{copy.insightRecordsEmpty}</p>
                )}
              </div>
            </section>
          </section>
        </Show>

        <Show when={activeView() === "lab"}>
          <section class="panel insights-panel developer-panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">{copy.developerEyebrow}</span>
                <h2>{copy.developerTitle}</h2>
              </div>
              <p>{copy.developerSummary}</p>
              {bootError() && (
                <p class="error-copy">
                  {copy.fallbackPrefix}
                  {bootError()}
                </p>
              )}
            </div>

            <div class="metric-grid developer-metric-grid">
              <article class="metric-card">
                <span class="metric-label">{copy.developerVersionLabel}</span>
                <strong>{snapshot().version}</strong>
                <span class="metric-footnote">{copy.developerVersionNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.developerMilestoneLabel}</span>
                <strong>{snapshot().milestone}</strong>
                <span class="metric-footnote">{copy.developerMilestoneNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.developerStatusLabel}</span>
                <strong>{statusText()}</strong>
                <span class="metric-footnote">{copy.developerStatusNote}</span>
              </article>
              <article class="metric-card">
                <span class="metric-label">{copy.developerStorageLabel}</span>
                <strong>Local</strong>
                <span class="metric-footnote">{copy.developerStorageNote}</span>
              </article>
            </div>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.developerInfoEyebrow}</span>
                  <h3>{copy.developerInfoTitle}</h3>
                </div>
              </div>

              <div class="card-grid developer-card-grid">
                <article class="detail-card">
                  <div class="detail-card__meta">
                    <span>{copy.engineOwner}</span>
                    <span>Rust</span>
                  </div>
                  <h3>{copy.engineOwnerNote}</h3>
                </article>
                <article class="detail-card">
                  <div class="detail-card__meta">
                    <span>{copy.runtimeTarget}</span>
                    <span>{copy.windows}</span>
                  </div>
                  <h3>{copy.runtimeTargetNote}</h3>
                </article>
                <article class="detail-card">
                  <div class="detail-card__meta">
                    <span>{copy.timingCorrection}</span>
                    <span>Dual Clock</span>
                  </div>
                  <h3>{copy.timingCorrectionNote}</h3>
                </article>
                <article class="detail-card">
                  <div class="detail-card__meta">
                    <span>{copy.currentStatus}</span>
                    <span>{timerSnapshot().status}</span>
                  </div>
                  <h3>{copy.currentStatusNote}</h3>
                </article>
              </div>
            </section>

            <section class="records-panel">
              <div class="records-panel__header">
                <div>
                  <span class="eyebrow">{copy.developerModulesEyebrow}</span>
                  <h3>{copy.developerModulesTitle}</h3>
                </div>
                <p class="chart-panel__summary">{copy.developerModulesSummary}</p>
              </div>

              <div class="stack-list">
                <For each={snapshot().surfaces}>
                  {(module) => (
                    <article class="stack-card">
                      <span class="stack-card__phase">{module.phase}</span>
                      <div>
                        <h3>{module.title}</h3>
                        <p>{module.summary}</p>
                      </div>
                    </article>
                  )}
                </For>
                <For each={snapshot().reservedExtensions}>
                  {(module) => (
                    <article class="stack-card">
                      <span class="stack-card__phase">{module.phase}</span>
                      <div>
                        <h3>{module.title}</h3>
                        <p>{module.summary}</p>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </section>
          </section>
        </Show>
      </main>
    </div>
  );
}

export default MainShell;

