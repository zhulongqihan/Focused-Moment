import { expect, test } from "@playwright/test";

import { testOutputPath } from "./helpers/test-output.mjs";

const today = "2026-09-05";
const themes = [
  ["night-valley", "夜谷"],
  ["editorial-paper", "编辑纸页"],
  ["graphite-console", "石墨控制台"],
  ["metro-pulse", "今日班次"],
  ["clutch-court", "今日赛场"],
];


const themeLayouts = {
  "night-valley": { prefix: "nv", today: ".trail-page", landmark: ".trail-map", secondary: ".trail-focus-panel", picker: ".nv-theme-card", preview: ".nv-settings-theme-lab", task: ".trail-node--current", pause: "暂停" },
  "editorial-paper": { prefix: "ep", today: ".ep-today-page", landmark: ".ep-field-sheet", secondary: ".ep-next-card", picker: ".ep-theme-swatch", preview: ".ep-live-preview", task: ".ep-next-card .ep-paper-button--green", pause: "暂停" },
  "graphite-console": { prefix: "gc", today: ".gc-today-page", landmark: ".gc-sequence-panel", secondary: ".gc-operation-panel", picker: ".gc-theme-card", preview: ".gc-settings-footer", task: ".gc-operation-card .gc-lime-button", pause: "暂停本段" },
  "metro-pulse": { prefix: "mp", today: ".mp-today-page", landmark: ".mp-route-panel", secondary: ".mp-departure-card", picker: ".nt-theme-choice", preview: ".nt-live-preview", task: ".mp-departure-card .mp-orange-button", pause: "Ⅱ　暂停专注" },
  "clutch-court": { prefix: "cc", today: ".cc-today-page", landmark: ".cc-home-court", secondary: ".cc-center-clock", picker: ".nt-theme-choice", preview: ".nt-live-preview", task: ".cc-center-clock .cc-lime-button", pause: "Ⅱ　暂停专注" },
};

function surfaceSelector(themeId, view) {
  const layout = themeLayouts[themeId];
  if (view === "today") return layout.today;
  if ((themeId === "metro-pulse" || themeId === "clutch-court") && view === "settings") return ".nt-settings-page";
  if (themeId === "night-valley" && view === "todos") return ".nv-todo-page";
  return `.${layout.prefix}-${view}-page`;
}

async function selectTheme(page, themeId, themeName) {
  await navButton(page, "设置").click();
  const activeTheme = await page.locator(".minimal-app").getAttribute("data-theme");
  await page.locator(themeLayouts[activeTheme].picker).filter({ hasText: themeName }).click();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", themeId);
  await expect(page.locator(themeLayouts[themeId].picker).filter({ hasText: themeName })).toHaveAttribute("aria-pressed", "true");
}

async function expectOriginalToday(page, themeId) {
  const layout = themeLayouts[themeId];
  await expect(page.locator(layout.today)).toBeVisible();
  await expect(page.locator(layout.landmark)).toBeVisible();
  await expect(page.locator(layout.secondary)).toBeVisible();
  if (["night-valley", "editorial-paper", "graphite-console"].includes(themeId)) {
    await expect(page.locator(`.daily-focus-line--${themeId}`)).toHaveCount(1);
  }
  await expect(page.locator(".unified-today-page, .continuity-board, .today-continuity-grid")).toHaveCount(0);
  for (const [otherId, other] of Object.entries(themeLayouts)) {
    if (otherId !== themeId) await expect(page.locator(other.today)).toHaveCount(0);
  }
}

function navButton(page, label) {
  return page.locator(".minimal-nav > button").filter({ hasText: label }).first();
}

async function bootReferenceMock(page, {
  themeId = "night-valley",
  persistedThemeId = themeId,
  includeTodo = true,
  includeInbox = true,
  includeOverdue = false,
  includeFuture = false,
  recordCount = 3,
  currentTodoId,
  todayPickIds = [101, 102, 103],
  demoMode = false,
  settingsDemo = false,
} = {}) {
  const fixtureToday = demoMode ? "2026-09-23" : today;
  const fixtureCurrentTodoId = currentTodoId === undefined ? (demoMode ? 104 : 101) : currentTodoId;
  await page.addInitScript(({ today: fixedToday }) => {
    const NativeDate = Date;
    class ReferenceDate extends NativeDate {
      constructor(...args) {
        super(...(args.length === 0 ? [fixedToday + "T12:00:00+08:00"] : args));
      }

      static now() {
        return new NativeDate(fixedToday + "T12:00:00+08:00").getTime();
      }
    }

    window.Date = ReferenceDate;
  }, { today: fixtureToday });

  await page.addInitScript(({ today, themeId, persistedThemeId, includeTodo, includeInbox, includeOverdue, includeFuture, recordCount, currentTodoId, todayPickIds, demoMode, settingsDemo }) => {
    const selectedTheme = themeId;
    localStorage.setItem("focused-moment.theme", persistedThemeId);
    const todoSeeds = demoMode ? [
      [101, "早间启动", today, true, "08:00"],
      [102, "深度工作", today, true, "09:30"],
      [103, "专注时段", today, true, "14:00"],
      [104, "创作专注", today, false, "16:00"],
      [105, "整理收尾", today, false, "19:00"],
      [106, "阅读沉淀", today, false, "20:30"],
    ] : [
      [101, "整理研究资料", today, false, "09:00"],
      [102, "写下发布清单", today, false, "10:00"],
      [103, "回看上次停笔位置", "", false, ""],
    ];
    if (includeOverdue) todoSeeds.push([107, "补齐昨日复盘", demoMode ? "2026-09-22" : "2026-09-04", false, "22:00"]);
    if (includeFuture) todoSeeds.push([108, "准备下周选题", demoMode ? "2026-09-24" : "2026-09-06", false, "10:30"]);
    let todos = todoSeeds
      .filter(([id]) => demoMode || (includeTodo && id !== 103) || (includeInbox && id === 103))
      .map(([id, title, scheduledDate, isCompleted, scheduledTime]) => ({
        id,
        title,
        isCompleted: Boolean(isCompleted),
        scheduledDate,
        scheduledTime,
        importanceKey: id === 101 || id === 104 ? "high" : id === 106 ? "low" : "medium",
        continuationNote: id === 101 ? "从研究结论的第三段继续" : "",
        continuationUpdatedAt: id === 101 ? `${today}T11:00:00+08:00` : null,
      }));
    const normalRecords = Array.from({ length: recordCount }, (_, index) => {
      const id = index + 1;
      return {
        id,
        title: index === 0 ? "整理研究资料" : `专注轮次 ${id}`,
        durationMs: 45 * 60 * 1000,
        durationLabel: "00:45:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: 101,
        linkedTodoTitle: "整理研究资料",
        completedAt: `${today}T${String(9 + index).padStart(2, "0")}:00:00+08:00`,
        completedDate: today,
        completedTime: `${String(9 + index).padStart(2, "0")}:00`,
        source: "timer",
        timeBasis: "completion_day",
        editedAt: null,
      };
    });
    const demoDays = [
      ["2026-09-17", [40, 40, 40]],
      ["2026-09-18", [45, 45, 45, 45]],
      ["2026-09-19", []],
      ["2026-09-20", [42, 42, 42, 42, 42]],
      ["2026-09-21", [45, 45]],
      ["2026-09-22", [18, 19, 19, 19]],
      ["2026-09-23", [52, 68, 45]],
    ];
    let nextDemoRecordId = 1;
    const demoRecords = demoDays.flatMap(([date, durations]) => durations.map((minutes, index) => {
      const id = nextDemoRecordId++;
      const conceptDayStartMinutes = date === "2026-09-23" ? [8 * 60 + 10, 9 * 60 + 42, 14 * 60 + 6] : null;
      const startMinutes = (conceptDayStartMinutes ?? [8 * 60 + 10, 9 * 60 + 58, 14 * 60 + 37, 16 * 60 + 10, 19 * 60 + 5])[index % (conceptDayStartMinutes?.length ?? 5)];
      const endMinutes = startMinutes + minutes;
      const hour = String(Math.floor(endMinutes / 60)).padStart(2, "0");
      const minute = String(endMinutes % 60).padStart(2, "0");
      const durationMs = minutes * 60 * 1000;
      const durationLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
      return {
        id,
        title: date === today ? ["早间启动", "深度工作", "专注时段"][index] : `专注轮次 ${id}`,
        durationMs,
        durationLabel,
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: date === today ? [101, 102, 103][index] : null,
        linkedTodoTitle: date === today ? ["早间启动", "深度工作", "专注时段"][index] : null,
        completedAt: `${date}T${hour}:${minute}:00+08:00`,
        completedDate: date,
        completedTime: `${hour}:${minute}`,
        source: "timer",
        timeBasis: "completion_day",
        editedAt: null,
      };
    }));
    let focusRecords = demoMode ? demoRecords : normalRecords;
    let timer = {
      modeKey: "stopwatch",
      phaseKey: "stopwatch",
      mode: "正向计时",
      phaseLabel: "正向计时",
      status: "待开始",
      isRunning: false,
      elapsedMs: demoMode ? 45 * 60 * 1000 : 0,
      elapsedLabel: demoMode ? "00:45:00" : "00:00:00",
      targetDurationMs: null,
      remainingMs: null,
      secondaryLabel: "本轮已投入",
      canCompleteSession: false,
      hasUnsubmittedProgress: false,
      activeTaskTitle: demoMode ? "创作专注" : "",
      linkedTodoId: demoMode ? 104 : null,
      completeLinkedTodoOnFinish: demoMode,
      currentRound: demoMode ? 4 : 1,
      completedFocusCount: demoMode ? 3 : recordCount,
      completedBreakCount: 0,
      recoveredFromLastSession: false,
      modeSwitchLocked: false,
      modeSwitchHint: null,
      alertSequence: 0,
      alertKey: null,
      alertTitle: null,
      alertMessage: null,
    };
    const timerPreferences = {
      pomodoroFocusMinutes: demoMode ? 45 : 25,
      pomodoroBreakMinutes: 5,
      stopwatchReminderMinutes: 45,
      toastReminderEnabled: true,
      windowAttentionReminderEnabled: true,
      soundReminderEnabled: true,
      alertSoundKey: "soft_chime",
    };
    let appPreferences = {
      schemaVersion: 3,
      themeId: persistedThemeId,
      visualIntensity: settingsDemo ? 68 : 55,
      motionIntensity: settingsDemo ? 42 : 45,
      density: "roomy",
      floatingOpacity: 92,
      autoMiniOnStart: settingsDemo,
      customAlertSoundName: "",
      customAlertSoundData: null,
    };
    let focusPlan = {
      currentTodoId: todos.some((item) => item.id === currentTodoId) ? currentTodoId : null,
      todayPickIds: todayPickIds.filter((id) => todos.some((item) => item.id === id)).slice(0, 3),
    };
    const demoTotalMinutes = 840;
    const todayDemoMinutes = 165;
    const demoDurationLabel = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
    const demoDailyBreakdown = demoDays.map(([date, durations]) => {
      const durationMinutes = durations.reduce((sum, value) => sum + value, 0);
      const linkedSessionCount = date === today ? durations.length : 0;
      return {
        date,
        totalDurationMs: durationMinutes * 60 * 1000,
        totalDurationLabel: demoDurationLabel(durationMinutes),
        sessionCount: durations.length,
        linkedSessionCount,
        independentSessionCount: durations.length - linkedSessionCount,
      };
    });
    const totalMinutes = demoMode ? demoTotalMinutes : recordCount * 45;
    const totalLabel = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}:00`;
    const analytics = {
      totalFocusDurationMs: totalMinutes * 60 * 1000,
      totalFocusDurationLabel: totalLabel,
      sessionCount: demoMode ? 21 : recordCount,
      linkedSessionCount: demoMode ? 3 : recordCount,
      independentSessionCount: demoMode ? 18 : 0,
      pendingTodoCount: todos.filter((item) => !item.isCompleted).length,
      completedTodoCount: demoMode ? 3 : 0,
      activeDays: demoMode ? 6 : recordCount ? 1 : 0,
      averageDailyDurationLabel: demoMode ? "00:40:00" : recordCount ? "00:45:00" : "00:00:00",
      todayFocusDurationLabel: demoMode ? demoDurationLabel(todayDemoMinutes) : totalLabel,
      todaySessionCount: demoMode ? 3 : recordCount,
      currentStreakDays: demoMode ? 7 : recordCount ? 9 : 0,
      bestFocusDate: demoMode ? today : recordCount ? today : null,
      bestFocusDurationLabel: demoMode ? "02:45:00" : recordCount ? totalLabel : "00:00:00",
      dailyBreakdown: demoMode ? demoDailyBreakdown : [],
    };

    window.__startTimerCalls = 0;
    window.__miniWorkspaceShown = 0;
    window.__appPreferenceUpdateCalls = 0;
    window.__timerPreferenceUpdateCalls = 0;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: (callback) => {
        window.__referenceEventCallback = callback;
        return 1;
      },
      invoke: async (command, args = {}) => {
        switch (command) {
          case "plugin:event|listen":
          case "plugin:event|unlisten":
            return 1;
          case "get_timer_snapshot":
            return timer;
          case "get_timer_preferences":
            return timerPreferences;
          case "update_timer_preferences":
            window.__timerPreferenceUpdateCalls += 1;
            Object.assign(timerPreferences, args.preferences ?? {});
            return timerPreferences;
          case "get_app_preferences":
            return appPreferences;
          case "update_app_preferences":
            window.__appPreferenceUpdateCalls += 1;
            appPreferences = { ...appPreferences, ...(args.preferences ?? {}) };
            return appPreferences;
          case "get_focus_plan":
            return focusPlan;
          case "update_focus_plan":
            focusPlan = {
              currentTodoId: args.currentTodoId ?? null,
              todayPickIds: Array.from(new Set(args.todayPickIds ?? [])).slice(0, 3),
            };
            return focusPlan;
          case "get_todo_items":
            return todos;
          case "create_todo_item":
            todos = [...todos, {
              id: Math.max(0, ...todos.map((item) => item.id)) + 1,
              title: args.title,
              isCompleted: false,
              scheduledDate: args.scheduledDate ?? "",
              scheduledTime: args.scheduledTime ?? "",
              importanceKey: args.importanceKey ?? "medium",
              continuationNote: "",
              continuationUpdatedAt: null,
            }];
            return todos.slice();
          case "update_todo_item":
            todos = todos.map((item) => item.id === args.id ? {
              ...item,
              title: args.title,
              scheduledDate: args.scheduledDate,
              scheduledTime: args.scheduledTime,
              importanceKey: args.importanceKey,
            } : item);
            return todos.slice();
          case "delete_todo_item":
            todos = todos.filter((item) => item.id !== args.id);
            return todos.slice();
          case "restore_todo_item":
            todos = [...todos.filter((item) => item.id !== args.item.id), args.item];
            return todos.slice();
          case "get_focus_records":
            return focusRecords.slice();
          case "create_manual_focus_record":
            {
              const durationMs = args.durationMinutes * 60_000;
              const completedTime = args.completedTime || "12:00";
              const linkedTodo = todos.find((item) => item.id === args.linkedTodoId) ?? null;
              const minutes = Math.floor(args.durationMinutes);
              const durationLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
              focusRecords = [...focusRecords, {
                id: Math.max(0, ...focusRecords.map((record) => record.id)) + 1,
                title: args.title,
                durationMs,
                durationLabel,
                modeKey: "stopwatch",
                modeLabel: "手动补录",
                phaseLabel: "手动补录",
                linkedTodoId: args.linkedTodoId ?? null,
                linkedTodoTitle: linkedTodo?.title ?? null,
                completedAt: `${args.completedDate}T${completedTime}:00+08:00`,
                completedDate: args.completedDate,
                completedTime,
                source: "manual",
                timeBasis: "completion_day",
                editedAt: null,
              }];
            }
            return focusRecords.slice();
          case "update_focus_record_title":
            focusRecords = focusRecords.map((record) => record.id === args.id ? { ...record, title: args.title, editedAt: `${today}T12:00:00+08:00` } : record);
            return focusRecords.slice();
          case "update_focus_record":
            focusRecords = focusRecords.map((record) => record.id === args.id ? {
              ...record,
              title: args.title,
              durationMs: args.durationMinutes * 60_000,
              durationLabel: `${String(Math.floor(args.durationMinutes / 60)).padStart(2, "0")}:${String(args.durationMinutes % 60).padStart(2, "0")}:00`,
              completedDate: args.completedDate,
              completedTime: args.completedTime || "",
              completedAt: `${args.completedDate}T${args.completedTime || "12:00"}:00+08:00`,
              linkedTodoId: args.linkedTodoId ?? null,
              linkedTodoTitle: todos.find((item) => item.id === args.linkedTodoId)?.title ?? null,
              editedAt: `${today}T12:00:00+08:00`,
            } : record);
            return focusRecords.slice();
          case "delete_focus_record":
            focusRecords = focusRecords.filter((record) => record.id !== args.id);
            return focusRecords.slice();
          case "get_analytics_snapshot":
            return { ...analytics, dailyBreakdown: analytics.dailyBreakdown.map((day) => ({ ...day })) };
          case "list_app_backups":
            return [{
              fileName: "focused-moment-backup-v3-20260923.json",
              exportedAt: "2026-09-23T08:00:00",
              appVersion: "2.12.1",
              formatVersion: 3,
              schemaVersion: 3,
              migrationNeeded: false,
              focusRecordCount: 21,
              todoCount: 6,
              hasRuntimeSession: false,
            }];
          case "update_timer_context":
            timer = { ...timer, activeTaskTitle: args.title ?? "", linkedTodoId: args.linkedTodoId ?? null };
            return timer;
          case "switch_timer_mode":
            timer = {
              ...timer,
              modeKey: args.mode === "countdown" ? "countdown" : "stopwatch",
              phaseKey: args.mode === "countdown" ? "countdown" : "stopwatch",
              mode: args.mode === "countdown" ? "倒计时" : "正向计时",
              phaseLabel: args.mode === "countdown" ? "专注倒计时" : "正向计时",
              status: "待开始",
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              targetDurationMs: args.mode === "countdown" ? timerPreferences.pomodoroFocusMinutes * 60_000 : null,
              remainingMs: args.mode === "countdown" ? timerPreferences.pomodoroFocusMinutes * 60_000 : null,
              hasUnsubmittedProgress: false,
              canCompleteSession: false,
            };
            return timer;
          case "set_countdown_minutes":
            timer = { ...timer, targetDurationMs: args.minutes * 60_000, remainingMs: args.minutes * 60_000, status: "准备开始" };
            return timer;
          case "reset_timer":
            timer = {
              ...timer,
              isRunning: false,
              status: "待开始",
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              remainingMs: timer.modeKey === "countdown" ? timer.targetDurationMs : null,
              hasUnsubmittedProgress: false,
              canCompleteSession: false,
            };
            return timer;
          case "start_timer":
            window.__startTimerCalls += 1;
            {
              const isCountdown = timer.modeKey === "countdown";
              const remainingMs = isCountdown ? Math.max(0, (timer.remainingMs ?? timer.targetDurationMs ?? 0) - 60_000) : timer.remainingMs;
              const ended = isCountdown && remainingMs === 0;
              timer = { ...timer, isRunning: !ended, status: ended ? "倒计时结束" : "运行中", elapsedMs: timer.elapsedMs + 60_000, elapsedLabel: "00:01:00", remainingMs, hasUnsubmittedProgress: true, canCompleteSession: true };
            }
            return timer;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "complete_focus_session":
            {
              const linkedTodo = todos.find((item) => item.id === timer.linkedTodoId) ?? null;
              const durationMs = timer.elapsedMs;
              const completedTime = "12:01";
              const completedRecord = {
                id: focusRecords.length + 1,
                title: args.title,
                durationMs,
                durationLabel: "00:01:00",
                modeKey: timer.modeKey,
                modeLabel: timer.mode,
                phaseLabel: timer.phaseLabel,
                linkedTodoId: timer.linkedTodoId,
                linkedTodoTitle: linkedTodo?.title ?? null,
                completedAt: `${today}T${completedTime}:00+08:00`,
                completedDate: today,
                completedTime,
                source: "timer",
                timeBasis: "completion_day",
                editedAt: null,
              };
              focusRecords.push(completedRecord);
              const todayBreakdown = analytics.dailyBreakdown.find((day) => day.date === today);
              if (todayBreakdown) {
                todayBreakdown.totalDurationMs += durationMs;
                todayBreakdown.sessionCount += 1;
                todayBreakdown.totalDurationLabel = "02:46:00";
              }
              analytics.totalFocusDurationMs += durationMs;
              analytics.totalFocusDurationLabel = "14:01:00";
              analytics.todayFocusDurationLabel = "02:46:00";
            }
            if (timer.completeLinkedTodoOnFinish && timer.linkedTodoId !== null) {
              todos = todos.map((item) => item.id === timer.linkedTodoId ? { ...item, isCompleted: true } : item);
            }
            analytics.todaySessionCount += 1;
            analytics.sessionCount += 1;
            analytics.completedTodoCount = todos.filter((item) => item.isCompleted).length;
            timer = {
              ...timer,
              isRunning: false,
              status: "待开始",
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              remainingMs: timer.modeKey === "countdown" ? timer.targetDurationMs : null,
              hasUnsubmittedProgress: false,
              canCompleteSession: false,
              linkedTodoId: null,
              activeTaskTitle: "",
              currentRound: timer.currentRound + 1,
              completedFocusCount: timer.completedFocusCount + 1,
            };
            return { records: focusRecords.slice(), todoItems: todos.slice(), timerSnapshot: { ...timer } };
          case "show_floating_todos":
            window.__miniWorkspaceShown += 1;
            return null;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id ? { ...item, isCompleted: !item.isCompleted } : item);
            return todos.slice();
          default:
            return null;
        }
      },
    };
  }, { today: fixtureToday, themeId, persistedThemeId, includeTodo, includeInbox, includeOverdue, includeFuture, recordCount, currentTodoId: fixtureCurrentTodoId, todayPickIds, demoMode, settingsDemo });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(themeLayouts[themeId].today)).toBeVisible();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", themeId);
}

test("Night Valley restores the trail and real Today overview at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);
  await expectOriginalToday(page, "night-valley");
  await expect(page.locator(".trail-page__heading h1")).toHaveText("今日路径");
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-node")).toHaveCount(5);
  await expect(page.locator(".trail-node--done")).toHaveCount(3);
  await expect(page.locator(".trail-node--current")).toContainText("整理研究资料");
  await expect(page.locator(".trail-overview-lead strong")).toHaveText("02:15:00");
  await expect(page.locator(".trail-overview-progress-heading strong")).toHaveText("0 / 2");
  await expect(page.locator(".trail-streak")).toContainText("连续 9 天");
  await expect(page.locator(".trail-timer")).toHaveCount(0);
  await page.screenshot({ path: testOutputPath("screenshots", "restored-night-valley-desktop.png"), animations: "disabled" });
});

test("All five themes restore distinct Today compositions without changing the first three", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);
  const focusLines = [];
  for (const [themeId, themeName] of themes) {
    await selectTheme(page, themeId, themeName);
    await navButton(page, "今日").click();
    await expectOriginalToday(page, themeId);
    await expect(page.locator(themeLayouts[themeId].today)).toContainText("整理研究资料");
    if (themeId === "metro-pulse") {
      await expect(page.locator(".mp-departure-card")).toContainText("整理研究资料");
    } else if (themeId === "clutch-court") {
      await expect(page.locator(".cc-home-court")).toContainText("整理研究资料");
    } else {
      await expect(page.locator(themeLayouts[themeId].today)).toContainText("02:15:00");
      const copyId = await page.locator(".daily-focus-line").getAttribute("data-copy-id");
      expect(copyId).toBeTruthy();
      focusLines.push(copyId);
    }
  }
  expect(new Set(focusLines).size).toBe(1);
});

test("Restored Today empty states distinguish layout placeholders from real tasks and records", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await bootReferenceMock(page, { includeTodo: false, includeInbox: false, recordCount: 0, currentTodoId: null, todayPickIds: [] });
  for (const [themeId, themeName] of themes) {
    await selectTheme(page, themeId, themeName);
    await navButton(page, "今日").click();
    const surface = page.locator(themeLayouts[themeId].today);
    await expect(surface).toBeVisible();
    await expect(surface).not.toContainText("整理研究资料");
    await expect(surface).not.toContainText("专注轮次");
    await expect(page.locator(".unified-today-page, .continuity-board, .virtual-record")).toHaveCount(0);
    if (themeId === "metro-pulse") {
      await expect(page.locator(".mp-route-stop--empty")).toHaveCount(6);
      await expect(page.locator(".mp-departure-empty")).toContainText("添加第一班");
      await expect(page.locator(".mp-departure-empty h2")).toHaveText("站台等待乘客");
    } else if (themeId === "clutch-court") {
      await expect(page.locator(".cc-round-marker.empty")).toHaveCount(5);
      await expect(page.locator(".cc-center-clock")).toContainText("等待布置第一回合");
      await expect(page.locator(".cc-scoreboard")).toContainText("00");
    } else if (themeId === "night-valley") {
      await expect(page.locator(".trail-node")).toHaveCount(1);
      await expect(page.locator(".trail-node--done")).toHaveCount(0);
      await expect(page.locator(".trail-node")).toContainText("今天的第一段");
      await expect(page.locator(".trail-map__footer strong")).toHaveText("今天的第一段，从这里开始");
      await expect(surface.getByText("今天还没有安排待办", { exact: true })).toBeVisible();
    } else if (themeId === "editorial-paper") {
      await expect(page.locator(".ep-field-row")).toHaveCount(0);
      await expect(page.locator(".ep-next-card h2")).toHaveText("留白也有意义");
    } else if (themeId === "graphite-console") {
      // Original seven non-interactive empty slots are decoration, never fake tasks.
      await expect(page.locator(".gc-sequence-row--empty")).toHaveCount(7);
      await expect(page.locator("button.gc-sequence-row")).toHaveCount(0);
      await expect(page.locator(".gc-operation-empty h2")).toHaveText("等待下一件事");
    }
  }
});

test("Restored Today remains inside the viewport from desktop to narrow mobile", async ({ page }) => {
  test.setTimeout(90_000);
  for (const [width, height, name] of [[1487, 1058, "wide"], [1024, 900, "medium"], [560, 900, "narrow"]]) {
    await page.setViewportSize({ width, height });
    await bootReferenceMock(page);
    for (const selector of [".trail-page", ".trail-map__viewport"]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect).not.toBeNull();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await expect(page.locator(".trail-node")).toHaveCount(5);
    await page.screenshot({ path: testOutputPath("screenshots", `restored-today-${name}.png`), animations: "disabled" });
  }
});

test("Todos keeps inbox semantics and exposes the focus plan only after expanding its footer", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "待办").click();
  const disclosure = page.locator("details.restored-focus-plan");
  await expect(disclosure).toHaveCount(1);
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(page.locator(".focus-plan-controls")).toBeHidden();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.locator(".focus-plan-controls")).toBeVisible();
  const inbox = page.locator(".nv-todo-date-group").filter({ hasText: "收件箱 · 未安排" });
  await expect(inbox).toContainText("回看上次停笔位置");
  await expect(inbox).not.toContainText("已过期");
  await expect(page.locator(".focus-plan-controls")).toContainText("回看上次停笔位置");
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("快速收进收件箱");
  await page.getByRole("option", { name: "快速收进收件箱 记下一件事，不填日期也可以", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "先记下来，稍后再整理" })).toBeVisible();
  await expect(navButton(page, "待办")).toHaveClass(/active/);
});

test("Records keeps long-term statistics and real record source labels", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "记录").click();
  await expect(page.locator(".records-page")).toBeVisible();
  await expect(page.getByText("累计专注", { exact: true })).toBeVisible();
  await expect(page.getByText("今天留下", { exact: true })).toBeVisible();
  await expect(page.getByText(/计时完成/).first()).toBeVisible();
  await expect(page.getByText("连续 9 天", { exact: true })).toHaveCount(0);
});

test("Graphite records show a complete thirty-day trail and aligned rhythm log", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "graphite-console" });
  await navButton(page, "记录").click();

  const trend = page.locator(".gc-trend-panel");
  await expect(trend.locator(".gc-trend-lines > button")).toHaveCount(30);
  await expect(trend.locator(".gc-trend-footer")).toContainText("最近 30 天");
  await expect(trend.locator(".gc-trend-footer")).toContainText("1 天有投入 · 共 02:15:00");
  await expect(trend.getByRole("button", { name: /回到最近/ })).toBeVisible();

  const log = page.locator(".gc-event-log");
  await expect(log).toContainText("每行是一段已保存的专注");
  await expect(log.locator(".gc-event-log__heading > span")).toHaveCount(6);
  await expect(log.locator(".gc-event-log__heading")).toContainText("完成时间");
  await expect(log.locator(".gc-event-log__heading")).toContainText("时长");
  const firstEvent = log.locator(".gc-event-row").first();
  await expect(firstEvent.locator(".gc-event-row__record")).toContainText("正向计时");
  await expect(firstEvent.locator(".gc-event-row__status")).toHaveText("已保存");
  await expect(firstEvent.locator(".gc-event-row__duration")).toContainText("00:45:00");
  await expect(firstEvent.locator(".gc-event-row__source")).toHaveText("计时完成");
  await expect(firstEvent).not.toContainText("OK");
  await expect(firstEvent.locator(".gc-event-row__actions button")).toHaveCount(2);

  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(trend.locator(".gc-trend-lines > button")).toHaveCount(30);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});

test("Night Valley record dates expand and collapse through an explicit control", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "记录").click();
  const day = page.locator(".record-day").first();
  const toggle = day.locator(".record-day__summary");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(day.locator(".record-row")).toHaveCount(3);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(day.locator(".record-day__items")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(day.locator(".record-row")).toHaveCount(3);
});

test("Editorial Paper explains workspace motion and density with a live preview", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "设置").click();
  await selectTheme(page, "editorial-paper", "编辑纸页");
  const workspace = page.locator(".ep-settings-paper--workspace");
  const preview = workspace.locator(".ep-workspace-preview");
  await expect(workspace).toContainText("动效改变切换的存在感");
  await expect(preview).toHaveAttribute("data-motion", "subtle");
  await expect(preview).toContainText("轻盈");
  await workspace.getByRole("slider", { name: "动效程度" }).fill("0");
  await expect(preview).toHaveAttribute("data-motion", "off");
  await expect(preview).toContainText("静息");
  await workspace.getByRole("slider", { name: "动效程度" }).fill("80");
  await expect(preview).toHaveAttribute("data-motion", "full");
  await expect(preview).toContainText("流动");
  await workspace.getByRole("button", { name: "紧凑", exact: true }).click();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-density", "compact");
  await expect(preview).toHaveAttribute("data-density", "compact");
  await expect(preview).toContainText("一屏可以看到更多信息");
});

test("legacy fourth and fifth theme preferences resolve to their new positional themes", async ({ page }) => {
  for (const [themeId, persistedThemeId, themeName] of [
    ["metro-pulse", "aurora-ocean", "今日班次"],
    ["clutch-court", "botanical-library", "今日赛场"],
  ]) {
    await page.setViewportSize({ width: 1487, height: 1058 });
    await bootReferenceMock(page, { themeId, persistedThemeId });
    await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", themeId);
    await navButton(page, "设置").click();
    await expect(page.locator(".nt-theme-choice").filter({ hasText: themeName })).toHaveAttribute("aria-pressed", "true");
  }
});

test("Metro and Clutch seven-day records share chart coordinates and expand the selected date", async ({ page }) => {
  test.setTimeout(60_000);
  for (const [themeId, chartSelector, logSelector] of [
    ["metro-pulse", ".mp-chart", ".mp-day-records"],
    ["clutch-court", ".cc-chart", ".cc-game-log"],
  ]) {
    await page.setViewportSize({ width: 1487, height: 1058 });
    await bootReferenceMock(page, { themeId, demoMode: true });
    await navButton(page, "记录").click();
    const chart = page.locator(chartSelector);
    const svg = chart.locator("svg");
    const path = chart.locator("svg .mp-chart__line, svg .cc-chart__line");
    const points = await chart.locator(".mp-chart-point, .cc-chart-point").evaluateAll((buttons) => buttons.map((button) => Number.parseFloat(button.style.left)));
    const dates = await chart.locator(".mp-chart__dates button, .cc-chart-dates button").evaluateAll((buttons) => buttons.map((button) => Number.parseFloat(button.style.left)));
    const verticalPoints = await chart.locator(".mp-chart-point, .cc-chart-point").evaluateAll((buttons) => buttons.map((button) => Number.parseFloat(button.style.top)));
    expect(points.length).toBe(7);
    expect(dates).toEqual(points);
    expect(points[0]).toBeCloseTo(7, 1);
    expect(points.at(-1)).toBeCloseTo(93, 1);
    expect(verticalPoints[2]).toBeCloseTo(100, 1);
    await expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
    const chartWidth = (await svg.boundingBox()).width;
    expect((await path.boundingBox()).width).toBeGreaterThan(chartWidth * 0.8);
    if (themeId === "metro-pulse") {
      await expect(chart.locator(".mp-chart-bar")).toHaveCount(7);
      await expect(chart.locator("svg .mp-chart__area")).toHaveAttribute("d", /L \d+ 100 L \d+ 100 Z$/);
    } else {
      await expect(chart.locator(".cc-chart-bar, .cc-chart__area")).toHaveCount(0);
    }
    await expect(page.locator(logSelector)).toBeVisible();
    await chart.locator(".mp-chart-point, .cc-chart-point").nth(2).click();
    await expect(page.locator(logSelector)).toContainText("这一天没有专注记录");
    await chart.locator(".mp-chart-point, .cc-chart-point").nth(6).click();
    await expect(themeId === "metro-pulse" ? page.locator(".mp-record-selected") : page.locator(logSelector)).toContainText(themeId === "metro-pulse" ? "2小时45分钟" : "02:45:00");
    if (themeId === "metro-pulse") {
      await expect(page.locator(".mp-period-row")).toHaveCount(4);
      await expect(page.locator(".mp-period-card")).toContainText("52m");
      await expect(page.locator(".mp-day-records .mp-record-row time").first()).toHaveText("08:10 – 09:02");
      await expect(page.locator(".mp-record-footer-actions button")).toHaveCount(3);
      await expect(page.locator(".minimal-nav")).toBeInViewport();
    }
    const openedDate = page.locator(".mp-history-index details[open], .cc-history-index details[open]");
    await expect(openedDate).toHaveCount(1);
    const summary = openedDate.locator("summary");
    await summary.click();
    await expect(openedDate).toHaveCount(0);
    const history = page.locator(themeId === "metro-pulse" ? ".mp-history-index" : ".cc-history-index");
    await history.scrollIntoViewIfNeeded();
    await expect(history).toBeInViewport({ ratio: 0.6 });
    await expect(history).toContainText("完整历史");
    const lastHistorySummary = history.locator("details summary").last();
    await lastHistorySummary.scrollIntoViewIfNeeded();
    await expect(lastHistorySummary).toBeInViewport();
    const summaryBounds = await lastHistorySummary.boundingBox();
    const navBounds = await page.locator(".minimal-nav").boundingBox();
    expect(summaryBounds).not.toBeNull();
    expect(navBounds).not.toBeNull();
    const overlapsNavigation = summaryBounds.y < navBounds.y + navBounds.height && navBounds.y < summaryBounds.y + summaryBounds.height;
    expect(overlapsNavigation).toBe(false);
    for (const width of [1024, 560]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
      await expect(chart.locator(".mp-chart-point, .cc-chart-point")).toHaveCount(7);
    }
  }
});

test("Metro and Clutch task lanes preserve today's schedule, upcoming work, and completed history", async ({ page }) => {
  for (const [themeId, themeName, laneSelector, currentIndex, upcomingIndex, titles] of [
    ["metro-pulse", "今日班次", ".mp-lane", 0, 1, ["创作专注", "整理收尾", "阅读沉淀", "早间启动", "深度工作", "专注时段"]],
    ["clutch-court", "今日赛场", ".cc-lane", 0, 1, ["创作专注", "整理收尾", "阅读沉淀", "早间启动", "深度工作", "专注时段"]],
  ]) {
    await page.setViewportSize({ width: 1487, height: 1058 });
    await bootReferenceMock(page, { themeId, demoMode: true });
    await navButton(page, "待办").click();
    const lanes = page.locator(laneSelector);
    await expect(lanes).toHaveCount(3);
    await expect(lanes.nth(currentIndex)).toContainText(titles[0]);
    await expect(lanes.nth(upcomingIndex)).toContainText(titles[1]);
    await expect(lanes.nth(upcomingIndex)).toContainText(titles[2]);
    for (const completedTitle of titles.slice(3)) await expect(lanes.nth(2)).toContainText(completedTitle);
    if (themeId === "metro-pulse") {
      for (const todaysTitle of titles.slice(3)) await expect(lanes.nth(0)).toContainText(todaysTitle);
      await expect(lanes.nth(0).locator(".mp-task-row")).toHaveCount(4);
      const currentRow = lanes.nth(0).locator(".mp-task-row:not(.is-done)");
      await currentRow.locator(".mp-task-actions button").first().focus();
      await expect(currentRow.locator(".mp-task-actions")).toHaveCSS("opacity", "1");
    }
    await expect(lanes.nth(1)).toContainText("2");
    await expect(lanes.nth(2)).toContainText("3");
  }
});

test("Settings restores each theme's original picker and preview while persisting immediate changes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);
  for (const [themeId, themeName] of themes) {
    await selectTheme(page, themeId, themeName);
    const layout = themeLayouts[themeId];
    const picker = page.locator(layout.picker);
    await expect(picker).toHaveCount(5);
    await expect(page.locator(".theme-picker__option")).toHaveCount(0);
    for (const [, name] of themes) await expect(picker.filter({ hasText: name })).toBeEnabled();
    await expect(picker.filter({ hasText: themeName })).toHaveAttribute("aria-pressed", "true");
    if (themeId === "editorial-paper") {
      await expect(picker.locator(".ep-theme-swatch__paper")).toHaveCount(5);
      await expect(page.locator(".ep-live-preview__paper")).toContainText(themeName);
    } else if (themeId === "graphite-console") {
      await expect(picker.locator(".gc-theme-card__preview")).toHaveCount(5);
      await expect(page.locator(".gc-settings-footer")).toContainText(themeName);
    } else {
      await expect(picker.locator("img")).toHaveCount(5);
      await expect.poll(() => picker.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    }
    if (themeId === "metro-pulse" || themeId === "clutch-court") {
      await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "保存光场设置", exact: true })).toHaveCount(0);
      await expect(page.getByText("偏好自动保存", { exact: false }).first()).toBeVisible();
      const preview = page.locator(".nt-live-preview");
      const motion = page.getByRole("slider", { name: "动效程度" });
      await motion.fill("0");
      await expect(preview).toHaveAttribute("data-motion", "off");
      await expect(preview).toContainText("关闭");
      await motion.fill("80");
      await expect(preview).toHaveAttribute("data-motion", "full");
      await expect(preview).toContainText("完整");
      await page.getByRole("button", { name: "紧凑", exact: true }).click();
      await expect(preview).toHaveAttribute("data-density", "compact");
      await expect(preview).toContainText("同屏显示更多。");
    }
    await expect(page.locator(layout.preview)).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).themeId)).toBe(themeId);
  }
  expect(await page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThanOrEqual(4);
});

test("Metro and Clutch settings expose portable backup actions at desktop, tablet, and phone widths", async ({ page }) => {
  test.setTimeout(90_000);
  for (const [themeId, name] of [["metro-pulse", "今日班次"], ["clutch-court", "今日赛场"]]) {
    for (const width of [1487, 1024, 560]) {
      await page.setViewportSize({ width, height: width === 1487 ? 1058 : 900 });
      await bootReferenceMock(page, { themeId });
      await navButton(page, "设置").click();
      await page.locator(".nt-portable-backup-details summary").click();
      const portableBackup = page.locator(".nt-portable-backup");
      await portableBackup.scrollIntoViewIfNeeded();
      await expect(portableBackup).toBeInViewport({ ratio: 0.55 });
      await expect(portableBackup.getByText("浏览器备用选择", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
      await expect(page.locator(".minimal-nav > button")).toHaveCount(5);
      const backupBounds = await portableBackup.boundingBox();
      const navBounds = await page.locator(".minimal-nav").boundingBox();
      expect(backupBounds).not.toBeNull();
      expect(navBounds).not.toBeNull();
      const overlapsNavigation = backupBounds.y < navBounds.y + navBounds.height && navBounds.y < backupBounds.y + backupBounds.height;
      expect(overlapsNavigation).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
  }
});

test("Every restored Today task starts once without leaving Today or opening mini", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const [themeId] of themes) {
    const context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
    const page = await context.newPage();
    try {
      await bootReferenceMock(page, { themeId });
      await expectOriginalToday(page, themeId);
      await page.locator(themeLayouts[themeId].task).click();
      await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
      await expect.poll(() => page.evaluate(async () => {
        const timer = await window.__TAURI_INTERNALS__.invoke("get_timer_snapshot");
        return { running: timer.isRunning, title: timer.activeTaskTitle, linkedTodoId: timer.linkedTodoId };
      })).toEqual({ running: true, title: "整理研究资料", linkedTodoId: 101 });
      await expectOriginalToday(page, themeId);
      if (themeId === "metro-pulse") {
        await expect(page.locator(".mp-departure-state")).toHaveText("进行中");
        await expect(page.locator(".mp-focus-minute-board")).toHaveClass(/mp-focus-minute-board--live/);
        await expect(page.locator(".mp-focus-minute-board__digits .mp-flip-digit")).toHaveCount(4);
        await page.locator(".mp-departure-card .mp-orange-button").click();
        await expect(page.locator(".mp-departure-state")).toHaveText("已暂停");
        await expect(page.locator(".mp-departure-card .mp-orange-button")).toContainText("继续专注");
        await page.locator(".mp-departure-card .mp-orange-button").click();
        await expect(page.locator(".mp-departure-state")).toHaveText("进行中");
      }
      await expect(navButton(page, "今日")).toHaveClass(/active/);
      await expect(page.locator(surfaceSelector(themeId, "focus"))).toHaveCount(0);
      expect(await page.evaluate(() => window.__miniWorkspaceShown)).toBe(0);
      const startCallsBeforeFocusNavigation = await page.evaluate(() => window.__startTimerCalls);
      await navButton(page, "计时").click();
      const focus = page.locator(surfaceSelector(themeId, "focus"));
      await expect(focus).toBeVisible();
      await expect(focus.getByRole("button", { name: themeLayouts[themeId].pause, exact: true })).toBeVisible();
      await expect(navButton(page, "计时")).toHaveClass(/active/);
      expect(await page.evaluate(() => window.__startTimerCalls)).toBe(startCallsBeforeFocusNavigation);
      await navButton(page, "今日").click();
      await expectOriginalToday(page, themeId);
    } finally {
      await context.close();
    }
  }
});

// This restoration scope intentionally does not import the 101-test legacy RC suite.
for (const [themeId] of themes) {
  for (const [view, label] of [["today", "今日"], ["focus", "计时"], ["todos", "待办"], ["records", "记录"], ["settings", "设置"]]) {
    const widths = view === "today" || ["metro-pulse", "clutch-court"].includes(themeId) ? [1487, 1024, 560] : [1487];
    for (const width of widths) {
      test(`Restored UI screenshot ${themeId} ${view} ${width}`, async ({ page }) => {
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: width === 1487 ? 1058 : 900 });
        await bootReferenceMock(page, { themeId });
        if (view !== "today") await navButton(page, label).click();
        const surface = page.locator(surfaceSelector(themeId, view));
        await expect(surface).toBeVisible();
        await expect(navButton(page, label)).toHaveClass(/active/);
        await expect(page.locator(".unified-today-page, .continuity-board")).toHaveCount(0);
        await expect(page.locator(".minimal-nav > button")).toHaveCount(5);
        await expect(page.locator(".window-control")).toHaveCount(3);
        for (const control of await page.locator(".window-control").all()) {
          await expect(control).toBeVisible();
          await expect(control).toBeEnabled();
        }
        const rect = await surface.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        if (view === "today") await expectOriginalToday(page, themeId);
        if (view === "focus") {
          const startLabel = themeId === "night-valley" ? "开始" : themeId === "metro-pulse" ? "▶　开始专注" : themeId === "clutch-court" ? "▶　开始专注" : "开始专注";
          await expect(surface.getByRole("button", { name: startLabel, exact: true })).toBeVisible();
        }
        if (view === "todos") {
          if (themeId === "night-valley") {
            await expect(surface).toContainText("回看上次停笔位置");
            const todayGroup = surface.locator(".nv-todo-date-group__toggle").filter({ hasText: "今天 · 9月5日" });
            await expect(todayGroup).toHaveAttribute("aria-expanded", "false");
            await todayGroup.click();
            await expect(todayGroup).toHaveAttribute("aria-expanded", "true");
            await expect(surface).toContainText("整理研究资料");
            await expect(surface).toContainText("写下发布清单");
          } else {
            await expect(surface).toContainText("回看上次停笔位置");
            if (themeId === "editorial-paper" || themeId === "graphite-console") {
              const todayGroup = surface.locator(".nv-todo-date-group__toggle").filter({ hasText: "今天 · 9月5日" });
              await expect(todayGroup).toHaveAttribute("aria-expanded", "false");
              await todayGroup.click();
              await expect(todayGroup).toHaveAttribute("aria-expanded", "true");
            }
            await expect(surface).toContainText("整理研究资料");
            await expect(surface).toContainText("写下发布清单");
          }
        }
        if (view === "records") await expect(surface).toContainText("02:15:00");
        if (view === "settings") await expect(page.locator(themeLayouts[themeId].picker)).toHaveCount(5);
        if (themeId === "metro-pulse" && view === "today" && width < 1487) {
          const viewportHeight = page.viewportSize().height;
          const navigation = page.locator(".minimal-nav");
          const assertAboveNavigation = async (locator) => {
            await locator.scrollIntoViewIfNeeded();
            await expect(locator).toBeVisible();
            const [surfaceBox, navigationBox] = await Promise.all([locator.boundingBox(), navigation.boundingBox()]);
            expect(surfaceBox).not.toBeNull();
            expect(surfaceBox.y).toBeGreaterThanOrEqual(0);
            expect(surfaceBox.y + surfaceBox.height).toBeLessThanOrEqual(viewportHeight);
            expect(surfaceBox.y + surfaceBox.height).toBeLessThanOrEqual(navigationBox.y + 1);
          };
          await assertAboveNavigation(page.locator(".mp-departure-card .mp-orange-button"));
          await assertAboveNavigation(page.locator(".mp-stat-band"));
          await page.locator(".mp-today-heading").scrollIntoViewIfNeeded();
        }
        if (themeId === "metro-pulse" && view === "focus" && width < 1487) {
          const viewportHeight = page.viewportSize().height;
          const navigation = page.locator(".minimal-nav");
          const assertAboveNavigation = async (locator) => {
            await locator.scrollIntoViewIfNeeded();
            await expect(locator).toBeVisible();
            const [controlBox, navigationBox] = await Promise.all([locator.boundingBox(), navigation.boundingBox()]);
            expect(controlBox).not.toBeNull();
            expect(controlBox.y).toBeGreaterThanOrEqual(0);
            expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(viewportHeight);
            expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(navigationBox.y + 1);
          };
          await assertAboveNavigation(page.locator(".mp-focus-actions .mp-orange-button"));
          await assertAboveNavigation(page.locator(".mp-timer-settings__footer"));
          await page.locator(".mp-focus-page > header").scrollIntoViewIfNeeded();
        }
        await page.screenshot({ path: testOutputPath("restored-ui", `${themeId}-${view}-${width}.png`), fullPage: true, animations: "disabled" });
        expect(errors).toEqual([]);
      });
    }
  }
}

const conceptScreens = [
  ["MP-01", "metro-pulse", "today", "今日班次"],
  ["MP-02", "metro-pulse", "focus", "班次计时"],
  ["MP-03", "metro-pulse", "todos", "班次待办"],
  ["MP-04", "metro-pulse", "records", "七日班次记录"],
  ["MP-05", "metro-pulse", "settings", "站台控制"],
  ["CC-01", "clutch-court", "today", "今日赛场"],
  ["CC-02", "clutch-court", "focus", "赛场计时"],
  ["CC-03", "clutch-court", "todos", "赛场战术板"],
  ["CC-04", "clutch-court", "records", "七日 box score"],
  ["CC-05", "clutch-court", "settings", "球馆更衣室"],
];
for (const [card, themeId, view, label] of conceptScreens) {
  test(card + " concept comparison capture · " + label, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1487, height: 1058 });
    await bootReferenceMock(page, { themeId, demoMode: true, settingsDemo: card === "MP-05" });
    if (view !== "today") await navButton(page, view === "focus" ? "计时" : view === "todos" ? "待办" : view === "records" ? "记录" : "设置").click();
    const surface = page.locator(surfaceSelector(themeId, view));
    await expect(surface).toBeVisible();
    await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", themeId);
    await expect(page.locator(".minimal-nav > button")).toHaveCount(5);
    if (card === "CC-04") {
      await expect(page.locator(".cc-shot-chart .cc-panel-heading")).toContainText("七日投篮图");
      await expect(page.locator(".cc-shot-chart .cc-panel-heading")).toContainText("每个点与日期使用同一坐标");
      await expect(page.locator(".cc-day-stats")).toContainText("单段平均");
      await expect(page.locator(".cc-day-stats")).toContainText("55m");
      await expect(page.locator(".cc-period-column > strong")).toHaveText(["2h", "45m", "0m", "0m"]);
      await expect(page.locator(".cc-record-footer-actions button")).toHaveCount(2);
      const chartGeometry = await page.locator(".cc-chart").evaluate((chart) => {
        const svg = chart.querySelector("svg");
        const path = svg?.querySelector("path");
        const points = [...chart.querySelectorAll(".cc-chart-point")];
        const dates = [...chart.querySelectorAll(".cc-chart-dates button")];
        const chartRect = chart.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const values = (path?.getAttribute("d")?.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
        const endpoints = values.length >= 2
          ? [[values[0], values[1]], ...Array.from({ length: (values.length - 2) / 6 }, (_, index) => [values[2 + index * 6 + 4], values[2 + index * 6 + 5]])]
          : [];
        return {
          pointCount: points.length,
          dateCount: dates.length,
          endpoints,
          coordinates: points.map((point, index) => {
            const pointRect = point.getBoundingClientRect();
            const dateRect = dates[index]?.getBoundingClientRect();
            return {
              pointX: pointRect.left + pointRect.width / 2,
              pointY: pointRect.top + pointRect.height / 2,
              dateX: dateRect ? dateRect.left + dateRect.width / 2 : null,
              svgX: svgRect.left + endpoints[index]?.[0] / 100 * svgRect.width,
              svgY: svgRect.top + endpoints[index]?.[1] / 100 * svgRect.height,
              relativeX: Number.parseFloat(point.style.left),
            };
          }),
          chartWidth: chartRect.width,
        };
      });
      expect(chartGeometry.pointCount).toBe(7);
      expect(chartGeometry.dateCount).toBe(7);
      expect(chartGeometry.endpoints).toHaveLength(7);
      expect(chartGeometry.coordinates[0].relativeX).toBeGreaterThanOrEqual(6.5);
      expect(chartGeometry.coordinates[6].relativeX).toBeLessThanOrEqual(93.5);
      for (const [index, coordinate] of chartGeometry.coordinates.entries()) {
        expect(Math.abs(coordinate.pointX - coordinate.dateX), `point/date x offset for day ${index}: ${JSON.stringify(chartGeometry)}`).toBeLessThanOrEqual(1);
        expect(Math.abs(coordinate.pointX - coordinate.svgX), `point/curve x offset for day ${index}: ${JSON.stringify(chartGeometry)}`).toBeLessThanOrEqual(1);
        expect(Math.abs(coordinate.pointY - coordinate.svgY), `point/curve y offset for day ${index}: ${JSON.stringify(chartGeometry)}`).toBeLessThanOrEqual(1);
      }
    }
    const shellMetrics = await page.evaluate(() => {
      const pick = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), display: style.display, columns: style.gridTemplateColumns, rows: style.gridTemplateRows, position: style.position, background: style.backgroundImage };
      };
      return [".minimal-app", ".app-bar", ".minimal-workspace", ".minimal-nav", ".minimal-content", ".mp-page"].map(pick);
    });
    const workspace = shellMetrics.find((entry) => entry.selector === ".minimal-workspace");
    const nav = shellMetrics.find((entry) => entry.selector === ".minimal-nav");
    const content = shellMetrics.find((entry) => entry.selector === ".minimal-content");
    expect(workspace.display).toBe("flex");
    expect(nav.width).toBeGreaterThan(1400);
    expect(nav.y).toBeGreaterThanOrEqual(52);
    expect(nav.height).toBeGreaterThan(0);
    if (view === "today") expect(nav.y + nav.height).toBeLessThanOrEqual(1058);
    expect(content.width).toBeGreaterThan(1400);
    if (themeId === "metro-pulse" && view === "today") {
      await expect(page.locator(".app-brand__mark")).toBeVisible();
      const departure = await page.locator(".mp-departure-card").boundingBox();
      const departureLabel = await page.locator(".mp-departure-card__top > span:first-child").boundingBox();
      const navBox = await page.locator(".minimal-nav").boundingBox();
      const activeNav = await page.locator(".minimal-nav > button.active").boundingBox();
      expect(departure.x).toBeGreaterThanOrEqual(950);
      expect(departure.width).toBeGreaterThanOrEqual(520);
      expect(departure.width).toBeLessThanOrEqual(540);
      expect(departure.x + departure.width).toBeGreaterThanOrEqual(1480);
      expect(departure.y).toBeGreaterThanOrEqual(40);
      expect(departure.y).toBeLessThanOrEqual(50);
      expect(departureLabel.y).toBeGreaterThanOrEqual(departure.y + 30);
      expect(departureLabel.y).toBeLessThan(departure.y + 55);
      expect(departure.y + departure.height).toBeLessThan(navBox.y);
      expect(Math.abs(activeNav.height - navBox.height)).toBeLessThanOrEqual(1);
    }
    if (themeId === "metro-pulse" && view === "focus") {
      await expect(page.locator(".app-brand")).toBeVisible();
      await expect(page.locator(".new-theme-bar-center")).toContainText("2026-09-23");
      await expect(page.locator(".mp-mode-tabs button").first()).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".mp-flip-board__top b")).toContainText("正向计时");
      await expect(page.locator(".mp-flip-board__task")).toContainText("创作专注");
      await expect(page.locator(".mp-timer-flip-card").first()).toHaveText("45");
      await expect(page.locator(".mp-timer-flip-card").last()).toHaveText("00");
      await expect(page.locator(".mp-timer-route__stops > span")).toHaveCount(6);
      await expect(page.locator(".mp-timer-route__stops > span.is-done")).toHaveCount(3);
      await expect(page.locator(".mp-timer-route__stops > span.is-current")).toHaveCount(1);
      await expect(page.locator(".mp-linked-task-card")).toContainText("创作专注");
      await expect(page.locator(".mp-countdown-display")).toContainText("45");
      await expect(page.locator(".mp-check-field input")).toBeChecked();
      const [flipBoardBox, timerSettingsBox] = await Promise.all([
        page.locator(".mp-flip-board").boundingBox(),
        page.locator(".mp-timer-settings").boundingBox(),
      ]);
      expect(Math.abs(flipBoardBox.height - 601)).toBeLessThanOrEqual(1);
      expect(Math.abs(timerSettingsBox.height - 600)).toBeLessThanOrEqual(1);
      await expect(page.locator(".minimal-nav > button:first-of-type .lucide-clipboard-list")).toBeVisible();
      const activeNavStyle = await page.locator(".minimal-nav > button.active").evaluate((element) => getComputedStyle(element).backgroundColor);
      const firstNavIcon = await page.locator(".minimal-nav > button:first-of-type .trail-nav__icon").boundingBox();
      expect(activeNavStyle).toBe("rgba(0, 0, 0, 0)");
      expect(firstNavIcon.width).toBeGreaterThanOrEqual(20);
      expect(firstNavIcon.width).toBeLessThanOrEqual(22);
      expect(nav.columns.startsWith("250px")).toBe(true);
      await expect(page.locator(".mp-focus-actions .mp-link-button")).toHaveCSS("border-top-style", "solid");
      expect(nav.y).toBeGreaterThanOrEqual(890);
      expect(nav.y).toBeLessThanOrEqual(925);
    }
    if (themeId === "clutch-court" && view === "focus") {
      await expect(page.locator(".cc-quarter-badge")).toContainText("第 4 回合");
      await expect(page.locator(".cc-quarter-badge")).toContainText("准备开球");
      await expect(page.locator(".cc-quarter-badge")).toHaveCSS("background-color", "rgb(11, 42, 99)");
      const [portrait, center, tactics, timerActions] = await Promise.all([
        page.locator(".cc-timer-layout > .cc-butler-card").boundingBox(),
        page.locator(".cc-center-circle--timer").boundingBox(),
        page.locator(".cc-tactics-board").boundingBox(),
        page.locator(".cc-tactics-board .cc-timer-actions").boundingBox(),
      ]);
      expect(Math.abs(portrait.x - 40)).toBeLessThanOrEqual(3);
      expect(Math.abs(portrait.width - 255)).toBeLessThanOrEqual(8);
      expect(portrait.height).toBeGreaterThanOrEqual(585);
      expect(Math.abs(tactics.x - 1122)).toBeLessThanOrEqual(8);
      expect(Math.abs(tactics.width - 326)).toBeLessThanOrEqual(8);
      expect(tactics.height).toBeGreaterThanOrEqual(585);
      expect(Math.abs(await page.locator(".cc-quarter-badge").evaluate((element) => element.getBoundingClientRect().width) - 162)).toBeLessThanOrEqual(1);
      expect(center.x).toBeGreaterThan(portrait.x + portrait.width);
      expect(center.x + center.width).toBeLessThan(tactics.x);
      expect(timerActions.y).toBeGreaterThan(tactics.y + 250);
      expect(timerActions.y + timerActions.height).toBeLessThan(tactics.y + tactics.height - 80);
      await expect(page.locator(".cc-center-circle--timer > em")).toHaveCount(0);
      await expect(page.locator(".cc-possession-dots > i")).toHaveCount(4);
      await expect(page.locator(".cc-timer-layout > .cc-court-dial > .cc-timer-actions")).toHaveCount(0);
      await expect(page.locator(".cc-tactics-board .cc-timer-actions .cc-secondary-button")).toHaveCount(2);
    }
    if (themeId === "clutch-court" && view === "todos") {
      const currentLane = page.locator(".cc-lane--current");
      const warmupLane = page.locator(".cc-lane--warmup");
      const madeLane = page.locator(".cc-lane--made");
      await expect(currentLane.locator(".cc-task-row")).toHaveCount(1);
      await expect(warmupLane.locator(".cc-task-row")).toHaveCount(2);
      await expect(madeLane.locator(".cc-task-row")).toHaveCount(3);
      await expect(currentLane.locator("header b")).toHaveText("1");
      await expect(warmupLane.locator("header b")).toHaveText("2");
      await expect(madeLane.locator("header b")).toHaveText("3");
      await expect(currentLane.locator(".cc-task-row strong")).toHaveText("创作专注");
      await expect(currentLane.locator(".cc-task-state")).toHaveText("进行中");
      await expect(warmupLane.locator(".cc-task-row .cc-task-state")).toHaveText(["待开始", "待开始"]);
      await expect(madeLane.locator(".cc-task-row .cc-task-state")).toHaveText(["已记录", "已记录", "已记录"]);
      const titles = await page.locator(".cc-task-row strong").allTextContents();
      expect(titles).toEqual(["创作专注", "整理收尾", "阅读沉淀", "早间启动", "深度工作", "专注时段"]);
      expect(new Set(titles).size).toBe(6);
      const metadata = await page.locator(".cc-task-row small").allTextContents();
      expect(metadata).toEqual([
        "今天截止 · 16:00 · 高优先",
        "今天截止 · 19:00 · 普通",
        "今天截止 · 20:30 · 低优先",
        "今天截止 · 08:00 · 高优先",
        "今天截止 · 09:30 · 普通",
        "今天截止 · 14:00 · 普通",
      ]);
      expect(metadata.every((value) => !/\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}/.test(value))).toBeTruthy();
    }
    if (themeId === "metro-pulse" && view === "todos") {
      await expect(surface.getByRole("heading", { name: "把事项排上班次", exact: true })).toBeVisible();
      await expect(surface.getByText("每一件重要的事，都有它的出发时间。", { exact: true })).toBeVisible();
      await expect(surface.getByText("TODAY'S DEPARTURE BOARD　/　06 ROUTES", { exact: true })).toBeVisible();
      await expect(page.locator(".mp-lane")).toHaveCount(3);
      await expect(page.locator(".mp-lane--today > header span")).toHaveText("01 ACTIVE");
      await expect(page.locator(".mp-lane--next > header span")).toHaveText("02 NEXT");
      await expect(page.locator(".mp-lane--arrived > header span")).toHaveText("03 ARRIVED");
      await expect(page.locator(".mp-lane--today .mp-task-row")).toHaveCount(4);
      await expect(page.locator(".mp-lane--next .mp-task-row")).toHaveCount(2);
      await expect(page.locator(".mp-lane--arrived .mp-task-row")).toHaveCount(3);
      await expect(page.locator(".mp-lane--today .mp-task-status")).toHaveText(["已到站", "已到站", "已到站", "正在出发"]);
      await expect(page.locator(".mp-lane--today .mp-task-copy small")).toHaveText(["08:00　·　重要", "09:30　·　普通", "14:00　·　普通", "16:00　·　重要"]);
      await expect(page.locator(".mp-lane--arrived .mp-task-status")).toHaveText(["已完成", "已完成", "已完成"]);
      const arrivedMetadata = page.locator(".mp-lane--arrived .mp-task-copy small");
      await expect(arrivedMetadata).toHaveText(["记录于 09:02　·　专注 52 分", "记录于 10:50　·　专注 68 分", "记录于 14:51　·　专注 45 分"]);
      await expect(page.locator(".mp-lane--next .mp-task-status")).toHaveText(["待开始", "待开始"]);
      await expect(page.locator(".mp-lane--next .mp-task-copy small").last()).toHaveText("20:30　·　低压力");
      await expect(page.locator(".mp-lane--arrived > footer")).toHaveText("已完成班次　3 / 6　·　完成率 50%");
      await expect(page.locator(".mp-lane--today > footer")).toContainText("04");
      await expect(page.locator(".mp-create-card")).toHaveCount(0);
      await expect(surface.getByRole("button", { name: "新增班次", exact: true })).toBeVisible();
      const laneBounds = await page.locator(".mp-lane").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const header = element.querySelector(":scope > header").getBoundingClientRect();
        const firstRow = element.querySelector(":scope > .mp-task-row")?.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, dividerY: header.bottom, firstRowCenterY: firstRow ? firstRow.y + firstRow.height / 2 : null };
      }));
      const referenceLanes = [{ x: 43, width: 473 }, { x: 531, width: 417 }, { x: 963, width: 481 }];
      expect(laneBounds.every((lane, index) => Math.abs(lane.x - referenceLanes[index].x) <= 2 && Math.abs(lane.y - 227) <= 2 && Math.abs(lane.width - referenceLanes[index].width) <= 2 && Math.abs(lane.height - 610) <= 1), JSON.stringify(laneBounds)).toBeTruthy();
      expect(laneBounds.every((lane) => Math.abs(lane.dividerY - 284) <= 2 && Math.abs(lane.firstRowCenterY - 330) <= 3), JSON.stringify(laneBounds)).toBeTruthy();
      await expect(page.locator(".minimal-nav > button.active")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

      const editable = page.locator(".mp-lane--today .mp-task-row").nth(3);
      await editable.hover();
      await editable.getByRole("button", { name: "编辑", exact: true }).click();
      await expect(editable.locator(".mp-task-edit input")).toHaveCount(3);
      await expect(editable.locator(".mp-task-edit select")).toHaveCount(1);
      await editable.getByRole("button", { name: "取消", exact: true }).click();
      await expect(editable.locator(".mp-task-edit")).toHaveCount(0);

      await surface.getByRole("button", { name: "新增班次", exact: true }).click();
      await expect(page.locator('input[name="metroTodoTitle"]')).toBeVisible();
      await expect(page.locator('input[name="metroTodoDate"]')).toBeVisible();
      await expect(page.locator('input[name="metroTodoTime"]')).toBeVisible();
      await expect(page.locator('select[name="metroTodoImportance"]')).toBeVisible();
      await surface.getByRole("button", { name: "收起新增", exact: true }).click();
      await page.mouse.move(800, 870);
    }
    if (themeId === "clutch-court" && view === "todos") {
      await expect(surface.getByRole("heading", { name: "把待办排成回合", exact: true })).toBeVisible();
      await expect(surface.getByRole("button", { name: "布置新回合", exact: true })).toBeVisible();
      await expect(page.locator(".cc-create-play")).toHaveCount(0);
      await expect(page.locator(".cc-lane")).toHaveCount(3);
      await expect(page.locator(".cc-lane--warmup .cc-task-row")).toHaveCount(2);
      await expect(page.locator(".cc-lane--current .cc-task-row")).toHaveCount(1);
      await expect(page.locator(".cc-lane--made .cc-task-row")).toHaveCount(3);
      await expect(page.locator(".cc-lane--current")).toContainText("创作专注");
      await expect(page.locator(".cc-lane--current .cc-task-row:not(.complete) .cc-task-state")).toHaveText("进行中");
      await expect(page.locator(".cc-lane--current > footer")).toContainText("今日完成 3 / 6");
      await expect(page.locator(".cc-lane--warmup")).toContainText("整理收尾");
      await expect(page.locator(".cc-lane--warmup")).toContainText("阅读沉淀");
      await expect(page.locator(".cc-lane--warmup .cc-task-state")).toHaveText(["待开始", "待开始"]);
      await expect(page.locator(".cc-lane--made .cc-task-state")).toHaveText(["已记录", "已记录", "已记录"]);
      const lanes = await page.locator(".cc-lane").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { className: element.className, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      }));
      const currentRowTops = await page.locator(".cc-lane--current .cc-task-row").evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().y)));
      expect(lanes.map((lane) => lane.y)).toEqual([lanes[0].y, lanes[0].y, lanes[0].y]);
      expect(lanes.every((lane) => lane.height >= 620)).toBeTruthy();
      expect(currentRowTops.slice(1).every((top, index) => top - currentRowTops[index] >= 70 && top - currentRowTops[index] <= 84)).toBeTruthy();
      const currentLane = lanes.find((lane) => lane.className.includes("cc-lane--current"));
      const warmupLane = lanes.find((lane) => lane.className.includes("cc-lane--warmup"));
      const madeLane = lanes.find((lane) => lane.className.includes("cc-lane--made"));
      const butler = await page.locator(".cc-todos-header-actions .cc-butler-card").boundingBox();
      const [currentStatus, warmupStatus, addPlay] = await Promise.all([
        page.locator(".cc-lane--current .cc-task-state").boundingBox(),
        page.locator(".cc-lane--warmup .cc-task-state").first().boundingBox(),
        page.locator(".cc-todos-header-actions > .cc-orange-button").boundingBox(),
      ]);
      expect(currentLane.x).toBeLessThan(50);
      expect(currentLane.y).toBeGreaterThanOrEqual(210);
      expect(currentLane.y).toBeLessThanOrEqual(225);
      expect(currentLane.width).toBeGreaterThan(440);
      expect(warmupLane.x).toBeGreaterThan(490);
      expect(madeLane.x + madeLane.width).toBeGreaterThan(1430);
      expect(Math.abs(currentLane.x - 41)).toBeLessThanOrEqual(5);
      expect(Math.abs(currentLane.y - 216)).toBeLessThanOrEqual(5);
      expect(Math.abs(currentLane.width - 458)).toBeLessThanOrEqual(10);
      expect(Math.abs(warmupLane.x - 513)).toBeLessThanOrEqual(5);
      expect(Math.abs(warmupLane.width - 483)).toBeLessThanOrEqual(10);
      expect(Math.abs(madeLane.x - 1009)).toBeLessThanOrEqual(6);
      expect(Math.abs(madeLane.width - 437)).toBeLessThanOrEqual(10);
      expect(Math.abs(currentLane.height - 615)).toBeLessThanOrEqual(8);
      expect(Math.abs(butler.x - 1122)).toBeLessThanOrEqual(6);
      expect(Math.abs(butler.width - 162)).toBeLessThanOrEqual(1);
      expect(Math.abs(addPlay.x - 1323)).toBeLessThanOrEqual(6);
      expect(Math.abs(addPlay.width - 125)).toBeLessThanOrEqual(2);
      await expect(page.locator(".cc-todos-header-actions > .cc-orange-button")).toHaveCSS("white-space", "nowrap");
      expect(Math.abs(addPlay.height - 38)).toBeLessThanOrEqual(2);
      expect(Math.abs(currentStatus.width - 58)).toBeLessThanOrEqual(2);
      expect(Math.abs(warmupStatus.width - 50)).toBeLessThanOrEqual(4);
      await expect(page.locator(".cc-todos-header-actions .cc-butler-card.compact img")).toBeVisible();
      await expect(page.locator(".cc-todos-header-actions .cc-butler-card.compact > div span")).toHaveText("JIMMY BUTLER　·　#22");
      const redundantButlerCopy = page.locator(".cc-todos-header-actions .cc-butler-card.compact > div strong, .cc-todos-header-actions .cc-butler-card.compact > div small");
      await expect(redundantButlerCopy).toHaveCount(2);
      await expect(redundantButlerCopy.nth(0)).toBeHidden();
      await expect(redundantButlerCopy.nth(1)).toBeHidden();
      expect(butler.y).toBeGreaterThanOrEqual(120);
      expect(butler.y).toBeLessThanOrEqual(140);
    }
    if (themeId === "clutch-court" && view === "today") {
      await expect(page.locator(".cc-today-hero .cc-scoreboard--featured")).toBeVisible();
      await expect(page.locator(".cc-scoreboard--featured > div:nth-child(2) > strong > b")).toHaveText("45:00");
      await expect(page.locator(".cc-home-court .cc-center-clock > strong")).toHaveText("45:00");
      await expect(page.locator(".cc-round-markers > .cc-round-marker")).toHaveCount(5);
      await expect(page.locator(".cc-round-markers > .cc-round-marker.done")).toHaveCount(3);
      await expect(page.locator(".cc-round-markers > .cc-round-marker.current")).toHaveCount(1);
      await expect(page.locator(".cc-round-markers > .cc-round-marker:not(.done):not(.current)")).toHaveCount(1);
      await expect(page.locator(".cc-round-markers > .cc-round-marker.current .cc-round-marker__copy > strong")).toHaveText("创作专注");
      await expect(page.locator(".cc-round-markers > .cc-round-marker.current .cc-round-marker__copy > small")).toHaveText("16:00");
      await expect(page.locator(".cc-round-markers > .cc-round-marker.current .cc-round-marker__copy > em")).toHaveText("当前回合");
      await expect(page.locator(".cc-round-markers > .cc-round-marker.current .cc-round-marker__copy")).toContainText("当前回合");
      await expect(page.locator(".cc-round-markers > .cc-round-marker .cc-round-marker__copy > strong")).toHaveText(["早间启动", "深度工作", "专注时段", "创作专注", "整理收尾"]);
      await expect(page.locator(".cc-round-markers > .cc-round-marker .cc-round-marker__copy > small")).toHaveText(["08:00", "09:30", "14:00", "16:00", "19:00"]);
      await expect(page.locator(".cc-round-markers > .cc-round-marker .cc-round-marker__copy > em")).toHaveText(["已完成", "已完成", "已完成", "当前回合", "待开始"]);
      await expect(page.locator(".cc-shotclock-badge")).toContainText("THEME PLATE");
      await expect(page.locator(".cc-round-markers > .cc-round-marker.done").first()).toHaveCSS("opacity", "1");
      const hero = await page.locator(".cc-today-hero").boundingBox();
      const court = await page.locator(".cc-home-court").boundingBox();
      const player = await page.locator(".cc-butler-card--featured").boundingBox();
      const clock = await page.locator(".cc-center-clock").boundingBox();
      const navBox = await page.locator(".minimal-nav").boundingBox();
      const navItemGeometry = await page.locator(".minimal-nav > button, .minimal-nav > .new-theme-nav-note").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { className: element.className, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      }));
      const markerGeometry = await page.locator(".cc-round-markers > .cc-round-marker").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const number = element.querySelector("i").getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), numberX: Math.round(number.x), numberY: Math.round(number.y), background: getComputedStyle(element).backgroundColor };
      }));
      const hoopGeometry = await page.locator(".cc-court-lines > .cc-left-hoop, .cc-court-lines > .cc-right-hoop").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { centerX: Math.round(rect.x + rect.width / 2), centerY: Math.round(rect.y + rect.height / 2) };
      }));
      const footerDisplay = await page.locator(".minimal-workspace").evaluate((element) => getComputedStyle(element, "::after").display);
      expect(Math.abs(hero.height - 180)).toBeLessThanOrEqual(1);
      expect(Math.abs(court.y - (hero.y + hero.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(court.height - 688)).toBeLessThanOrEqual(2);
      expect(Math.abs(navBox.height - 130)).toBeLessThanOrEqual(1);
      expect(Math.abs(navBox.y - (court.y + court.height))).toBeLessThanOrEqual(2);
      const referenceNavX = [223, 404, 584, 765, 945];
      expect(navItemGeometry.slice(0, 5).every((item, index) => Math.abs(item.x - referenceNavX[index]) <= 1 && Math.abs(item.y - (navBox.y + 27)) <= 1 && Math.abs(item.height - 58) <= 1), JSON.stringify(navItemGeometry)).toBeTruthy();
      expect(footerDisplay).toBe("none");
      expect(hoopGeometry[0].centerX).toBeGreaterThan(100);
      expect(hoopGeometry[0].centerX).toBeLessThan(180);
      expect(hoopGeometry[1].centerX).toBeGreaterThan(1180);
      expect(hoopGeometry[1].centerX).toBeLessThan(1250);
      const referenceMarkers = [{ x: 331, y: 297 }, { x: 810, y: 311 }, { x: 287, y: 656 }, { x: 840, y: 656 }, { x: 574, y: 756 }];
      expect(markerGeometry.every((marker, index) => Math.abs(marker.numberX - referenceMarkers[index].x) <= 5 && Math.abs(marker.numberY - referenceMarkers[index].y) <= 6 && Math.abs(marker.width - 250) <= 1), JSON.stringify(markerGeometry)).toBeTruthy();
      expect(Math.abs(clock.x - 462)).toBeLessThanOrEqual(3);
      expect(Math.abs(clock.y - 388)).toBeLessThanOrEqual(8);
      expect(Math.abs(clock.width - 380)).toBeLessThanOrEqual(2);
      expect(Math.abs(clock.height - 380)).toBeLessThanOrEqual(2);
      expect(player.y).toBeGreaterThanOrEqual(hero.y);
      expect(player.y + player.height).toBeGreaterThan(court.y);
      expect(Math.abs(clock.height - clock.width)).toBeLessThanOrEqual(1);
    }
    if (themeId === "clutch-court" && view === "focus") {
      const scoreboard = await page.locator(".cc-focus-page > .cc-scoreboard").boundingBox();
      const portrait = await page.locator(".cc-timer-layout > .cc-butler-card").boundingBox();
      const dial = await page.locator(".cc-court-dial").boundingBox();
      const tactics = await page.locator(".cc-tactics-board").boundingBox();
      await expect(page.locator(".cc-center-circle--timer > strong")).toHaveText("45:00");
      await expect(page.locator(".cc-center-circle--timer > .cc-lime-button")).toHaveText("▶　开始专注");
      await expect(page.locator(".cc-timer-actions .cc-secondary-button")).toHaveCount(2);
      await expect(page.locator(".cc-tactics-board input[name='clutchSessionTitle']")).toBeEnabled();
      await expect(page.locator(".cc-tactics-board select[name='clutchLinkedTodo']")).toHaveValue("104");
      expect(Math.abs(scoreboard.width - 500)).toBeLessThanOrEqual(1);
      expect(Math.abs(portrait.width - 254)).toBeLessThanOrEqual(2);
      expect(dial.width).toBeGreaterThan(680);
      expect(tactics.width).toBeGreaterThanOrEqual(320);
      expect(Math.abs(dial.height - 590)).toBeLessThanOrEqual(1);
      expect(Math.abs(tactics.height - 590)).toBeLessThanOrEqual(1);
      expect(portrait.y).toBeGreaterThanOrEqual(200);
      expect(portrait.y).toBeLessThanOrEqual(230);
      expect(Math.abs(tactics.y - portrait.y)).toBeLessThanOrEqual(1);
    }
    if (themeId === "clutch-court" && view === "records") {
      await expect(page.locator(".cc-boxscore > div")).toHaveCount(4);
      await expect(page.locator(".cc-records-overview-grid")).toBeVisible();
      await expect(page.locator(".cc-day-boxscore .cc-day-stats > div")).toHaveCount(4);
      await expect(page.locator(".cc-period-column")).toHaveCount(4);
      await expect(page.locator(".cc-chart-point")).toHaveCount(7);
      await expect(page.locator(".cc-chart-bar, .cc-chart__area")).toHaveCount(0);
      await expect(page.locator(".cc-chart-dates > button")).toHaveCount(7);
      await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(3);
      const series = await page.locator(".cc-chart").evaluate((chart) => {
        const lefts = (selector) => Array.from(chart.querySelectorAll(selector), (element) => element.style.left);
        const points = Array.from(chart.querySelectorAll(".cc-chart-point"), (element) => element.getBoundingClientRect());
        const dates = Array.from(chart.querySelectorAll(".cc-chart-dates button"), (element) => element.getBoundingClientRect());
        const box = chart.getBoundingClientRect();
        const svgBox = chart.querySelector("svg").getBoundingClientRect();
        const historyTop = chart.closest(".cc-records-page").querySelector(".cc-history-index").getBoundingClientRect().top;
        const navTop = document.querySelector(".minimal-nav").getBoundingClientRect().top;
        return {
          pointLefts: lefts(".cc-chart-point"),
          dateLefts: lefts(".cc-chart-dates button"),
          pointDateCenters: points.map((point, index) => Math.abs((point.left + point.width / 2) - (dates[index].left + dates[index].width / 2))),
          firstPoint: points[0].left + points[0].width / 2 - box.left,
          lastPoint: points[points.length - 1].left + points[points.length - 1].width / 2 - box.left,
          width: box.width,
          chartHeight: box.height,
          svgTop: svgBox.top - box.top,
          svgHeight: svgBox.height,
          historyTop,
          navTop,
          pathSegments: chart.querySelector(".cc-chart__line")?.getAttribute("d")?.match(/ C /g)?.length ?? 0,
        };
      });
      expect(series.pointLefts.map(Number.parseFloat)).toHaveLength(7);
      series.pointLefts.map(Number.parseFloat).forEach((value, index) => expect(value).toBeCloseTo(7 + (index * 86) / 6, 3));
      expect(series.pointLefts).toEqual(series.dateLefts);
      expect(series.pointDateCenters.every((distance) => distance <= 1)).toBeTruthy();
      expect(series.firstPoint).toBeGreaterThan(0);
      expect(series.lastPoint).toBeLessThan(series.width);
      expect(series.svgTop).toBeCloseTo(0, 1);
      expect(series.svgHeight).toBeCloseTo(series.chartHeight, 1);
      expect(series.historyTop).toBeGreaterThanOrEqual(series.navTop);
      expect(series.pathSegments).toBe(6);
      await expect(page.locator(".cc-chart-point.active")).toHaveCount(1);
      await expect(page.locator(".cc-day-boxscore")).toContainText("9/23");
      await expect(page.locator(".cc-game-log")).toContainText("早间启动");
      await expect(page.locator(".cc-period-column").nth(0)).toContainText("2h");
      await expect(page.locator(".cc-period-column").nth(1)).toContainText("45m");
      await expect(page.locator(".cc-period-column").nth(2)).toContainText("0m");
      const upper = await page.locator(".cc-records-overview-grid").boundingBox();
      const chart = await page.locator(".cc-shot-chart").boundingBox();
      const daySummary = await page.locator(".cc-day-boxscore").boundingBox();
      expect(Math.abs(chart.y - daySummary.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(chart.height - daySummary.height)).toBeLessThanOrEqual(1);
      expect(upper.y).toBeGreaterThanOrEqual(285);
      expect(upper.y).toBeLessThanOrEqual(310);
    }
    if (themeId === "clutch-court" && view === "settings") {
      await page.getByRole("slider", { name: "画面明暗" }).fill("72");
      await page.getByRole("slider", { name: "动效程度" }).fill("48");
      await page.getByRole("checkbox", { name: /开始专注时自动打开迷你工作台/ }).check();
      await expect(page.locator(".nt-settings-page--clutch .nt-theme-choice")).toHaveCount(5);
      await expect(page.locator(".nt-settings-page--clutch .nt-settings-grid > .nt-settings-card")).toHaveCount(4);
      await expect(page.locator(".nt-settings-page--clutch .nt-live-preview")).toContainText("JIMMY BUTLER");
      await expect(page.locator(".nt-settings-page--clutch .nt-jimmy-preview")).toHaveAttribute("alt", "Jimmy Butler 球星视觉预览");
      await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "保存光场设置", exact: true })).toHaveCount(0);
      await expect(page.locator(".nt-settings-page--clutch .nt-autosave")).toContainText("偏好自动保存");
      if (card === "CC-05") {
        const timerInputs = page.locator(".nt-clock-settings .nt-number-field input");
        await expect(timerInputs).toHaveCount(3);
        expect(await timerInputs.evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(["45", "45", "5"]);
        await expect(page.locator(".nt-clock-settings > label strong")).toHaveText([
          "正向计时提醒", "番茄专注时长", "番茄休息时长", "开始专注时自动打开迷你工作台",
        ]);
        await expect(page.locator(".nt-clock-settings")).not.toContainText("短休息");
        await expect(page.locator(".nt-clock-settings")).not.toContainText("长休息");
        await expect(page.locator(".nt-clock-settings .nt-check-row input")).toBeChecked();
        await expect(page.locator(".nt-alert-settings .nt-check-row input[type=checkbox]")).toHaveCount(3);
        await expect(page.locator(".nt-alert-settings .nt-check-row strong")).toHaveText(["应用内完成提醒", "桌面窗口提醒", "结束音效"]);
        await expect(page.locator(".nt-alert-settings .nt-check-row input[type=checkbox]").nth(0)).toBeChecked();
        await expect(page.locator(".nt-alert-settings .nt-check-row input[type=checkbox]").nth(1)).toBeChecked();
        await expect(page.locator(".nt-alert-settings .nt-check-row input[type=checkbox]").nth(2)).toBeChecked();
        await expect(page.locator(".nt-alert-settings .nt-select-row select")).toHaveValue("soft_chime");
        await expect(page.locator(".nt-alert-settings .nt-audio-actions button")).toHaveText(["试听", "导入自定义"]);
        await expect(page.locator(".nt-data-settings .nt-backup-select select")).toBeVisible();
        await expect(page.locator(".nt-data-settings .nt-data-actions button")).toHaveText([
          "导出备份", "导入并替换当前数据", "打开备份目录", "清空当前数据",
        ]);
        await expect(page.locator(".nt-portable-backup-details summary")).toContainText("完整 JSON 文件备份");
        await expect(page.locator(".nt-settings-footer")).toContainText("无需手动保存");
      }
      const geometry = await page.evaluate(() => {
        const rect = (selector) => {
          const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, right, bottom };
        };
        const root = document.querySelector(".nt-settings-page--clutch").getBoundingClientRect();
        const grid = document.querySelector(".nt-settings-page--clutch .nt-settings-grid").getBoundingClientRect();
        const preview = document.querySelector(".nt-settings-page--clutch .nt-live-preview").getBoundingClientRect();
        return {
          root: { x: root.x, y: root.y, width: root.width, height: root.height, right: root.right, bottom: root.bottom },
          grid: { x: grid.x, y: grid.y, top: grid.top, width: grid.width, height: grid.height, right: grid.right, bottom: grid.bottom },
          preview: { x: preview.x, y: preview.y, left: preview.left, top: preview.top, width: preview.width, height: preview.height, right: preview.right, bottom: preview.bottom },
          identity: rect(".nt-identity-response"),
          clock: rect(".nt-clock-settings"),
          alerts: rect(".nt-alert-settings"),
          data: rect(".nt-data-settings"),
        };
      });
      for (const [key, expected] of Object.entries({
        identity: { x: 40, y: 215, width: 519, height: 304 },
        clock: { x: 570, y: 215, width: 480, height: 304 },
        alerts: { x: 40, y: 530, width: 519, height: 304 },
        data: { x: 570, y: 530, width: 480, height: 304 },
      })) {
        for (const [dimension, target] of Object.entries(expected)) {
          expect(Math.abs(geometry[key][dimension] - target), `${key}.${dimension}: ${geometry[key][dimension]}`).toBeLessThanOrEqual(2);
        }
      }
      expect(Math.abs(geometry.preview.width - 384)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.preview.height - 620)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.preview.top - geometry.grid.top)).toBeLessThanOrEqual(1);
      expect(geometry.preview.left).toBeGreaterThan(geometry.grid.right);
      expect(geometry.preview.right).toBeLessThanOrEqual(geometry.root.right + 1);
    }
    if (card === "MP-04") {
      const chart = page.locator(".mp-chart");
      const points = chart.locator(".mp-chart-point");
      const dateLabels = chart.locator(".mp-chart__dates button");
      await expect(points).toHaveCount(7);
      await expect(chart.locator(".mp-chart-bar")).toHaveCount(7);
      await expect(dateLabels).toHaveText(["17 四", "18 五", "19 六", "20 日", "21 一", "22 二", "23 三"]);
      await expect(page.locator(".mp-date-range")).toContainText("09.17");
      await expect(page.locator(".mp-date-range")).toContainText("09.23");
      await expect(page.locator(".mp-record-summary")).toContainText("14.0 h");
      await expect(page.locator(".mp-record-summary")).toContainText("6");
      await expect(page.locator(".mp-record-selected")).toContainText("09月23日");
      await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(3);
      await expect(page.locator(".mp-day-records .mp-record-row time")).toHaveText([
        "08:10 – 09:02", "09:42 – 10:50", "14:06 – 14:51",
      ]);
      await expect(page.locator(".mp-period-row > strong")).toHaveText(["52m", "68m", "45m", "0m"]);
      await expect(page.locator(".mp-chart-point.active")).toHaveCount(1);
      await expect(page.locator(".mp-chart__dates button.active")).toHaveAttribute("aria-pressed", "true");

      const geometry = await page.evaluate(() => {
        const rect = (selector) => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height };
        };
        const chart = document.querySelector(".mp-chart").getBoundingClientRect();
        const pointRects = Array.from(document.querySelectorAll(".mp-chart-point"), (element) => element.getBoundingClientRect());
        const labelRects = Array.from(document.querySelectorAll(".mp-chart__dates button"), (element) => element.getBoundingClientRect());
        return {
          week: rect(".mp-week-panel"), summary: rect(".mp-record-summary"),
          records: rect(".mp-day-records"), periods: rect(".mp-period-card"),
          chart: { width: chart.width },
          aligned: pointRects.map((point, index) => Math.abs(point.x + point.width / 2 - labelRects[index].x - labelRects[index].width / 2)),
          pointSpan: pointRects.at(-1).x + pointRects.at(-1).width / 2 - pointRects[0].x - pointRects[0].width / 2,
          lineWidth: document.querySelector(".mp-chart__line").getBoundingClientRect().width,
          activeTab: getComputedStyle(document.querySelector(".minimal-nav > button.active")).backgroundColor,
        };
      });
      for (const [key, expected] of [["week", { x: 43, y: 225, width: 874, height: 370 }], ["summary", { x: 932, y: 225, width: 512, height: 370 }], ["records", { x: 43, y: 610, width: 874, height: 232 }], ["periods", { x: 932, y: 610, width: 512, height: 232 }]]) {
        for (const dimension of Object.keys(expected)) expect(Math.abs(geometry[key][dimension] - expected[dimension]), `${key}.${dimension}: ${geometry[key][dimension]}`).toBeLessThanOrEqual(2);
      }
      expect(geometry.aligned.every((delta) => delta <= 1), JSON.stringify(geometry.aligned)).toBeTruthy();
      expect(geometry.pointSpan).toBeGreaterThan(geometry.chart.width * 0.84);
      expect(geometry.lineWidth).toBeGreaterThan(geometry.chart.width * 0.8);
      expect(geometry.activeTab).toBe("rgba(0, 0, 0, 0)");
    }
    expect(await page.locator(".command-trigger").isVisible()).toBeTruthy();
    expect(await page.locator(".window-controls").isVisible()).toBeTruthy();
    if (themeId === "metro-pulse" && view === "today") expect(await page.locator(".minimal-nav > button:nth-of-type(2) .minimal-nav__label").evaluate((label) => getComputedStyle(label).color)).toBe("rgb(54, 90, 119)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1488);
    if (card === "MP-05") {
      await expect(page.locator(".nt-settings-page--metro .nt-settings-grid > .nt-settings-card")).toHaveCount(4);
      await expect(page.locator(".nt-settings-page--metro .nt-theme-choice")).toHaveCount(5);
      await expect(page.locator(".nt-theme-picker .nt-section-title > span")).toHaveText("THEME　/　01");
      await expect(page.locator(".nt-clock-settings .nt-number-field input")).toHaveCount(3);
      await expect(page.locator(".nt-clock-settings > label strong")).toHaveText([
        "正向计时提醒", "番茄专注时长", "番茄休息时长", "自动打开迷你工作台",
      ]);
      expect(await page.locator(".nt-clock-settings .nt-number-field input").evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(["45", "45", "5"]);
      await expect(page.locator(".nt-clock-settings .nt-check-row input")).toBeChecked();
      await expect(page.locator(".nt-clock-settings")).not.toContainText("长休息");
      await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
      await expect(page.locator(".nt-alert-settings .nt-check-row > input[type=checkbox]")).toHaveCount(3);
      await expect(page.locator(".nt-alert-settings .nt-check-row strong")).toHaveText(["应用内完成提醒", "桌面窗口提醒", "结束音效"]);
      await expect(page.locator(".nt-alert-settings .nt-select-row select")).toHaveValue("soft_chime");
      await expect(page.locator(".nt-alert-settings .nt-audio-actions button")).toHaveText(["试听", "导入自定义"]);
      await expect(page.getByRole("button", { name: "舒展", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".nt-live-preview")).toHaveAttribute("data-motion", "subtle");
      await expect(page.locator(".nt-live-preview")).toHaveAttribute("data-density", "roomy");
      await expect(page.locator(".nt-preview-sample__number")).toHaveText("04");
      expect(await page.locator(".nt-visual-controls input[type=range]").evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(["68", "42"]);
      expect(await page.locator(".nt-visual-controls input[type=range]").evaluateAll((inputs) => inputs.map((input) => input.style.getPropertyValue("--nt-range-progress")))).toEqual(["68%", "42%"]);
      expect(await page.locator(".nt-visual-controls input[type=range]").evaluateAll((inputs) => inputs.map((input) => ({
        height: getComputedStyle(input).height,
        borderWidth: getComputedStyle(input).borderTopWidth,
        backgroundColor: getComputedStyle(input).backgroundColor,
      })))).toEqual([
        { height: "16px", borderWidth: "0px", backgroundColor: "rgba(0, 0, 0, 0)" },
        { height: "16px", borderWidth: "0px", backgroundColor: "rgba(0, 0, 0, 0)" },
      ]);
      const settingsGeometry = await page.evaluate(() => {
        const rect = (selector) => {
          const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, bottom, right };
        };
        return {
          identity: rect(".nt-identity-response"),
          clock: rect(".nt-clock-settings"),
          preview: rect(".nt-live-preview"),
          density: rect(".nt-density-control"),
          timerSwitch: rect(".nt-clock-settings .nt-check-row > input"),
        };
      });
      expect(Math.abs(settingsGeometry.identity.x - 43)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.identity.y - 220)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.identity.width - 729)).toBeLessThanOrEqual(2);
      expect(Math.abs(settingsGeometry.identity.height - 305)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.clock.x - 784)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.clock.y - 220)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.clock.height - 305)).toBeLessThanOrEqual(1);
      expect(settingsGeometry.preview.bottom).toBeLessThan(settingsGeometry.density.y);
      expect(settingsGeometry.density.bottom).toBeLessThanOrEqual(settingsGeometry.identity.bottom - 8);
      expect(settingsGeometry.density.right).toBeLessThanOrEqual(settingsGeometry.identity.right - 12);
      expect(Math.abs(settingsGeometry.timerSwitch.width - 36)).toBeLessThanOrEqual(1);
      expect(Math.abs(settingsGeometry.timerSwitch.height - 20)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testOutputPath("concept-comparison", card + "-" + themeId + "-" + view + ".png"), animations: "disabled" });
    expect(errors).toEqual([]);
  });
}

test("MP-05 live preview reflects brightness, motion, density, and saved preferences", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true, settingsDemo: true });
  await navButton(page, "设置").click();
  const preview = page.locator(".nt-settings-page--metro .nt-live-preview");
  const before = await preview.evaluate((element) => ({
    visual: getComputedStyle(element).getPropertyValue("--nt-visual"),
    padding: getComputedStyle(element).padding,
    samplePadding: getComputedStyle(element.querySelector(".nt-preview-sample")).padding,
  }));

  await page.getByRole("slider", { name: "画面明暗" }).fill("92");
  await expect(page.getByRole("slider", { name: "画面明暗" })).toHaveCSS("--nt-range-progress", "92%");
  const motion = page.getByRole("slider", { name: "动效程度" });
  await motion.fill("0");
  await expect(preview).toHaveAttribute("data-motion", "off");
  await expect.poll(() => preview.locator(".nt-preview-sample > i").evaluate((dot) => getComputedStyle(dot).animationName)).toBe("none");
  await motion.fill("80");
  await expect(motion).toHaveCSS("--nt-range-progress", "80%");
  await expect(preview).toHaveAttribute("data-motion", "full");
  await expect.poll(() => preview.locator(".nt-preview-sample").evaluate((sample) => getComputedStyle(sample).transform)).not.toBe("none");
  await page.getByRole("group", { name: "信息密度" }).getByRole("button", { name: "紧凑", exact: true }).click();
  await expect(preview).toHaveAttribute("data-density", "compact");
  const after = await preview.evaluate((element) => ({
    visual: getComputedStyle(element).getPropertyValue("--nt-visual"),
    padding: getComputedStyle(element).padding,
    samplePadding: getComputedStyle(element.querySelector(".nt-preview-sample")).padding,
  }));
  expect(after.visual).not.toBe(before.visual);
  expect(after.padding).not.toBe(before.padding);
  expect(after.samplePadding).not.toBe(before.samplePadding);

  const reminder = page.getByRole("spinbutton", { name: "正向计时提醒分钟数" });
  await reminder.fill("60");
  await expect(reminder).toHaveValue("60");
  await page.getByRole("checkbox", { name: "自动打开迷你工作台" }).uncheck();
  await expect(page.getByRole("checkbox", { name: "自动打开迷你工作台" })).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testOutputPath("MP-05-settings", "MP-05-live-preview-interactions.png"), fullPage: true, animations: "disabled" });
});

test("MP-05 settings remain reachable without clipping at 1024 and 560 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true, settingsDemo: true });
  await navButton(page, "设置").click();
  const settings = page.locator(".nt-settings-page--metro");
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(settings).toBeVisible();
    await expect(settings.locator(".nt-settings-grid > .nt-settings-card")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await settings.locator(".nt-density-control button").first().scrollIntoViewIfNeeded();
    await expect(settings.locator(".nt-density-control button").first()).toBeVisible();
    await expect(settings.locator(".nt-clock-settings .nt-number-field input").first()).toBeVisible();
    await settings.locator(".nt-data-settings .nt-data-actions button").last().scrollIntoViewIfNeeded();
    await expect(settings.locator(".nt-data-settings .nt-data-actions button").last()).toBeVisible();
    await page.screenshot({ path: testOutputPath("MP-05-responsive", `MP-05-settings-${width}.png`), fullPage: true, animations: "disabled" });
  }
});

test("MP-04 date selection, previous-week navigation, zero days, and return-to-recent stay synchronized", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "记录").click();
  const points = page.locator(".mp-chart-point");
  const labels = page.locator(".mp-chart__dates button");
  const expectedCounts = [3, 4, 0, 5, 2, 4, 3];
  for (let index = 0; index < expectedCounts.length; index += 1) {
    await points.nth(index).click();
    await expect(points.nth(index)).toHaveAttribute("aria-pressed", "true");
    await expect(labels.nth(index)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(expectedCounts[index]);
    if (index === 2) {
      await expect(page.locator(".mp-day-records .mp-empty")).toContainText("这一天没有专注记录");
      await expect(page.locator(".mp-period-row > strong")).toHaveText(["0m", "0m", "0m", "0m"]);
    }
  }
  await labels.nth(0).click();
  await expect(points.nth(0)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "上一周", exact: true }).click();
  const range = page.locator(".mp-date-range > span");
  await expect(range).toContainText("09.10");
  await expect(range).toContainText("09.16");
  await expect(page.locator(".mp-record-summary")).toContainText("0.0 h");
  await expect(page.locator(".mp-record-summary")).toContainText("0 / 7");
  await expect(page.locator(".mp-day-records .mp-empty")).toContainText("这一天没有专注记录");
  await page.getByRole("button", { name: "下一周", exact: true }).click();
  await expect(range).toContainText("09.17");
  await expect(range).toContainText("09.23");
  await page.getByRole("button", { name: "回到最近", exact: true }).click();
  await expect(points.last()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(3);
});

test("MP-04 record supplement, rename, detailed edit, delete, and selected-day history expansion work", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "记录").click();

  let firstRecord = page.locator(".mp-day-records .mp-record-row").first();
  await firstRecord.hover();
  await firstRecord.getByRole("button", { name: "改名", exact: true }).click();
  await page.getByRole("textbox", { name: "记录名称" }).fill("起班专注复盘");
  await page.getByRole("textbox", { name: "记录名称" }).press("Enter");
  await expect(firstRecord).toContainText("起班专注复盘");

  await page.locator(".mp-record-footer-actions").getByRole("button", { name: "补录", exact: true }).click();
  const manualDialog = page.getByRole("dialog", { name: "补录一段专注" });
  await expect(manualDialog).toBeVisible();
  await manualDialog.getByLabel("标题").fill("手动战术复盘");
  await manualDialog.getByLabel("时长（分钟）").fill("32");
  await manualDialog.getByLabel("完成日期").fill("2026-09-23");
  await manualDialog.getByLabel("完成时间（可选）").fill("15:40");
  await manualDialog.getByRole("button", { name: "补录记录", exact: true }).click();
  await expect(manualDialog).toHaveCount(0);
  let manualRecord = page.locator(".mp-day-records .mp-record-row").filter({ hasText: "手动战术复盘" });
  await expect(manualRecord).toHaveCount(1);
  await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(4);

  await manualRecord.hover();
  await manualRecord.getByRole("button", { name: "详细编辑", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "编辑专注记录" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("标题").fill("罚球训练记录");
  await editDialog.getByLabel("时长（分钟）").fill("36");
  await editDialog.getByRole("button", { name: "保存修改", exact: true }).click();
  manualRecord = page.locator(".mp-day-records .mp-record-row").filter({ hasText: "罚球训练记录" });
  await expect(manualRecord.locator(".mp-record-duration")).toContainText("36 分");
  await manualRecord.hover();
  await manualRecord.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".mp-day-records .mp-record-row").filter({ hasText: "罚球训练记录" })).toHaveCount(0);
  await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(3);

  await page.locator(".mp-record-footer-actions").getByRole("button", { name: /展开当日完整记录/ }).click();
  const history = page.locator(".mp-history-index");
  await expect(history).toBeInViewport();
  const selectedDay = history.locator("details[open]");
  await expect(selectedDay).toHaveCount(1);
  await expect(selectedDay).toContainText("起班专注复盘");
});

test("MP-04 zero and dense histories remain accessible and load more than the initial page", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", includeTodo: false, includeInbox: false, recordCount: 0, currentTodoId: null, todayPickIds: [] });
  await navButton(page, "记录").click();
  await expect(page.locator(".mp-chart-point")).toHaveCount(7);
  await expect(page.locator(".mp-chart-point.empty")).toHaveCount(7);
  await expect(page.locator(".mp-record-summary")).toContainText("0.0 h");
  await expect(page.locator(".mp-day-records .mp-empty")).toContainText("这一天没有专注记录");
  await expect(page.locator(".mp-history-index .mp-empty")).toContainText("完整历史会显示在这里");

  await bootReferenceMock(page, { themeId: "metro-pulse", recordCount: 65, includeTodo: false, includeInbox: false, currentTodoId: null, todayPickIds: [] });
  await navButton(page, "记录").click();
  await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(40);
  await page.locator(".mp-record-footer-actions").getByRole("button", { name: "加载更多", exact: true }).click();
  await expect(page.locator(".mp-day-records .mp-record-row")).toHaveCount(65);
  await page.locator(".mp-history-index").scrollIntoViewIfNeeded();
  await expect(page.locator(".mp-history-index")).toBeInViewport();
  await expect(page.locator(".mp-history-index details")).toHaveCount(1);
  await page.screenshot({ path: testOutputPath("MP-04-dense-history", "MP-04-65-records-history.png"), animations: "disabled" });
});

test("MP-04 chart, date labels, records, and long history fit tablet and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "记录").click();
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".mp-records-page")).toBeVisible();
    const measurements = await page.evaluate(() => {
      const chart = document.querySelector(".mp-chart").getBoundingClientRect();
      const pageContent = document.querySelector(".mp-records-page").getBoundingClientRect();
      return { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        chart: { left: chart.left, right: chart.right }, page: { left: pageContent.left, right: pageContent.right } };
    });
    expect(measurements.scroll).toBeLessThanOrEqual(measurements.client + 1);
    expect(measurements.page.left).toBeGreaterThanOrEqual(-1);
    expect(measurements.page.right).toBeLessThanOrEqual(width + 1);
    expect(measurements.chart.left).toBeGreaterThanOrEqual(-1);
    expect(measurements.chart.right).toBeLessThanOrEqual(width + 1);
    await expect(page.locator(".mp-chart-point")).toHaveCount(7);
    await expect(page.locator(".mp-chart__dates button")).toHaveCount(7);
    await page.locator(".mp-chart-point").nth(2).click();
    await expect(page.locator(".mp-day-records .mp-empty")).toContainText("这一天没有专注记录");
    await page.getByRole("button", { name: "回到最近", exact: true }).click();
    await page.locator(".mp-record-footer-actions").getByRole("button", { name: /展开当日完整记录/ }).click();
    await expect(page.locator(".mp-history-index")).toBeInViewport();
    await page.screenshot({ path: testOutputPath("MP-04-responsive", `MP-04-${width}.png`), fullPage: true, animations: "disabled" });
  }
});

test("CC-05 locker room stays reachable at tablet and phone widths", async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await bootReferenceMock(page, { themeId: "clutch-court" });
    await navButton(page, "设置").click();
    await expect(page.locator(".nt-settings-page--clutch .nt-theme-choice")).toHaveCount(5);
    const pageRoot = page.locator(".nt-settings-page--clutch");
    const preview = page.locator(".nt-settings-page--clutch .nt-live-preview");
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeVisible();
    await expect(page.locator(".nt-jimmy-preview")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
    const measurements = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      root: (() => { const rect = document.querySelector(".nt-settings-page--clutch").getBoundingClientRect(); return { left: rect.left, right: rect.right }; })(),
      preview: (() => { const rect = document.querySelector(".nt-settings-page--clutch .nt-live-preview").getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }; })(),
    }));
    expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.viewportWidth + 1);
    expect(measurements.root.left).toBeGreaterThanOrEqual(-1);
    expect(measurements.root.right).toBeLessThanOrEqual(width + 1);
    expect(measurements.preview.left).toBeGreaterThanOrEqual(-1);
    expect(measurements.preview.right).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: testOutputPath("CC-05-responsive", `CC-05-${width}.png`), animations: "disabled" });
  }
});

test("CC-05 settings auto-save and update the live home-court preview", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true, settingsDemo: true });
  await navButton(page, "设置").click();

  const settings = page.locator(".nt-settings-page--clutch");
  const preview = settings.locator(".nt-live-preview");
  const brightness = page.getByRole("slider", { name: "画面明暗" });
  const motion = page.getByRole("slider", { name: "动效程度" });
  const density = page.getByRole("group", { name: "信息密度" });
  const appPreferenceUpdates = await page.evaluate(() => window.__appPreferenceUpdateCalls);
  const timerPreferenceUpdates = await page.evaluate(() => window.__timerPreferenceUpdateCalls);
  const initialVisual = await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--nt-visual"));
  const initialPortraitTransform = await preview.locator(".nt-jimmy-preview").evaluate((element) => getComputedStyle(element).transform);

  await brightness.fill("90");
  await expect(brightness).toHaveCSS("--nt-range-progress", "90%");
  await expect(preview.locator(".nt-live-preview__label p")).toContainText("场馆灯光 90%");
  await expect.poll(() => preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--nt-visual"))).not.toBe(initialVisual);

  await motion.fill("0");
  await expect(preview).toHaveAttribute("data-motion", "off");
  await expect(preview.locator(".nt-live-preview__label p")).toContainText("关闭动效");
  await motion.fill("80");
  await expect(preview).toHaveAttribute("data-motion", "full");
  await expect(preview.locator(".nt-live-preview__label p")).toContainText("完整动效");

  await density.getByRole("button", { name: "紧凑", exact: true }).click();
  await expect(preview).toHaveAttribute("data-density", "compact");
  await expect(preview.locator(".nt-jimmy-preview")).not.toHaveCSS("transform", initialPortraitTransform);

  const stopwatchReminder = page.getByRole("spinbutton", { name: "正向计时提醒分钟数" });
  const focusDuration = page.getByRole("spinbutton", { name: "番茄专注时长分钟数" });
  const breakDuration = page.getByRole("spinbutton", { name: "番茄休息时长分钟数" });
  const saveTimerValue = async (field, value) => {
    const callsBefore = await page.evaluate(() => window.__timerPreferenceUpdateCalls);
    await field.fill(value);
    await field.press("Tab");
    await expect.poll(() => page.evaluate(() => window.__timerPreferenceUpdateCalls)).toBeGreaterThan(callsBefore);
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue(value);
  };
  await saveTimerValue(stopwatchReminder, "60");
  await saveTimerValue(focusDuration, "50");
  await saveTimerValue(breakDuration, "8");
  await expect(page.locator(".nt-clock-settings .nt-number-field input")).toHaveCount(3);

  await page.getByRole("checkbox", { name: "应用内完成提醒" }).uncheck();
  await page.getByRole("checkbox", { name: "开始专注时自动打开迷你工作台" }).uncheck();
  await page.locator(".nt-alert-settings .nt-select-row select").selectOption("deep_pulse");
  await expect(page.locator(".nt-alert-settings .nt-select-row select")).toHaveValue("deep_pulse");
  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThan(appPreferenceUpdates);
  await expect.poll(() => page.evaluate(() => window.__timerPreferenceUpdateCalls)).toBeGreaterThan(timerPreferenceUpdates);

  await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存光场设置", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出备份", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "导入并替换当前数据", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
  await page.screenshot({ path: testOutputPath("CC-05-settings", "CC-05-live-preview-interactions.png"), fullPage: true, animations: "disabled" });
});

test("CC-03 playbook task creation, editing, completion, restoration, and deletion", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "待办").click();

  await expect(page.locator(".cc-lane--current .cc-task-row")).toHaveCount(1);
  await expect(page.locator(".cc-lane--warmup .cc-task-row")).toHaveCount(2);
  await expect(page.locator(".cc-lane--made .cc-task-row")).toHaveCount(3);
  const addButton = page.locator(".cc-todos-page > .cc-page-head").getByRole("button", { name: "布置新回合", exact: true });
  await addButton.click();
  const title = page.locator('input[name="clutchTodoTitle"]');
  await expect(title).toBeVisible();
  expect(await title.evaluate((element) => element.required)).toBeTruthy();
  expect(await title.evaluate((element) => element.checkValidity())).toBeFalsy();
  await title.fill("加练罚球");
  await page.locator('input[name="clutchTodoDate"]').fill("2026-09-24");
  await page.locator('input[name="clutchTodoTime"]').fill("21:15");
  await page.locator('select[name="clutchTodoImportance"]').selectOption("high");
  await page.getByRole("button", { name: "确认布置", exact: true }).click();

  await expect(page.locator(".cc-create-play")).toHaveCount(0);
  let created = page.locator(".cc-lane--warmup .cc-task-row").filter({ hasText: "加练罚球" });
  await expect(created).toContainText("待开始");
  await expect(created.locator("small")).toContainText("高");
  await created.hover();
  await created.getByRole("button", { name: "编辑", exact: true }).click();
  const edit = page.locator(".cc-lane--warmup .cc-task-edit");
  await edit.locator('input:not([type="date"]):not([type="time"])').fill("罚球收尾");
  await edit.locator('input[type="date"]').fill("2026-09-25");
  await edit.locator('input[type="time"]').fill("21:40");
  await edit.locator("select").selectOption("low");
  await edit.getByRole("button", { name: "保存", exact: true }).click();
  created = page.locator(".cc-lane--warmup .cc-task-row").filter({ hasText: "罚球收尾" });
  await expect(created.locator("strong")).toHaveText("罚球收尾");
  await expect(created.locator("small")).toContainText("低");

  await created.hover();
  await created.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".cc-lane--warmup .cc-task-row").filter({ hasText: "罚球收尾" })).toHaveCount(0);

  const current = page.locator(".cc-lane--current .cc-task-row").filter({ hasText: "创作专注" });
  await current.getByRole("button", { name: "完成 创作专注", exact: true }).click();
  const completed = page.locator(".cc-lane--made .cc-task-row").filter({ hasText: "创作专注" });
  await expect(completed).toHaveClass(/complete/);
  await expect(page.locator(".cc-lane--current .cc-task-row")).toHaveCount(1);
  await expect(page.locator(".cc-lane--current .cc-task-row strong")).toHaveText("整理收尾");
  await expect(page.locator(".cc-lane--warmup .cc-task-row")).toHaveCount(1);
  await expect(page.locator(".cc-lane--made .cc-task-row")).toHaveCount(4);
  await completed.getByRole("button", { name: "恢复 创作专注", exact: true }).click();
  await expect(page.locator(".cc-lane--current .cc-task-row")).toHaveCount(1);
  await expect(page.locator(".cc-lane--current .cc-task-row strong")).toHaveText("创作专注");
  await expect(page.locator(".cc-lane--warmup .cc-task-row")).toHaveCount(2);
  await expect(page.locator(".cc-lane--made .cc-task-row")).toHaveCount(3);
});

test("CC-03 warmup preserves inbox, future, and overdue tasks without inventing made plays", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", includeOverdue: true, includeFuture: true });
  await navButton(page, "待办").click();
  const warmup = page.locator(".cc-lane--warmup");
  await expect(warmup.locator(".cc-task-row")).toHaveCount(4);
  await expect(warmup.locator(".cc-task-row.overdue")).toContainText("补齐昨日复盘");
  await expect(warmup.locator(".cc-task-row").filter({ hasText: "回看上次停笔位置" })).toContainText("未安排");
  await expect(warmup.locator(".cc-task-row").filter({ hasText: "准备下周选题" })).toContainText("待开始");
  await expect(page.locator(".cc-lane--made .cc-task-row")).toHaveCount(0);
  await expect(page.locator(".cc-lane--made .cc-empty")).toContainText("完成事项后");
});

test("CC-03 empty playbook has explicit current and completed states", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", includeTodo: false, includeInbox: false, recordCount: 0, currentTodoId: null, todayPickIds: [] });
  await navButton(page, "待办").click();
  await expect(page.locator(".cc-lane--warmup .cc-task-row")).toHaveCount(0);
  await expect(page.locator(".cc-lane--current .cc-empty")).toContainText("今天还没有回合");
  await expect(page.locator(".cc-lane--made .cc-empty")).toContainText("完成事项后");
});

test("CC-03 playbook controls fit tablet and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "待办").click();
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".cc-todos-page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const shellActions = await page.locator(".app-bar__actions").boundingBox();
    const commandButton = await page.locator(".command-trigger").boundingBox();
    expect(shellActions.x).toBeGreaterThanOrEqual(0);
    expect(shellActions.x + shellActions.width).toBeLessThanOrEqual(width + 1);
    expect(commandButton.x).toBeGreaterThanOrEqual(0);
    expect(commandButton.x + commandButton.width).toBeLessThanOrEqual(width + 1);
    if (width === 1024) await expect(page.locator(".command-trigger")).toHaveCSS("white-space", "nowrap");
    const bounds = await page.locator(".cc-lane").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    expect(bounds.every((rect) => rect.left >= -1 && rect.right <= width + 1), JSON.stringify({ width, bounds })).toBeTruthy();
    const add = page.locator(".cc-todos-page > .cc-page-head").getByRole("button", { name: "布置新回合", exact: true });
    await add.click();
    const controls = page.locator(".cc-create-play input, .cc-create-play select, .cc-create-play button");
    await expect(controls).toHaveCount(5);
    const fieldBounds = await controls.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }));
    expect(fieldBounds.every((rect) => rect.left >= -1 && rect.right <= width + 1 && rect.width > 0), JSON.stringify({ width, fieldBounds })).toBeTruthy();
    await page.screenshot({ path: testOutputPath("CC-03-responsive", `CC-03-${width}.png`), animations: "disabled" });
    await page.locator(".cc-todos-page > .cc-page-head").getByRole("button", { name: "收起新回合", exact: true }).click();
  }
});

test("CC-04 selecting any day synchronizes chart, date summary, session map, and game log", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "记录").click();
  const points = page.locator(".cc-chart-point");
  const zeroDay = points.nth(2);
  await zeroDay.click();
  await expect(zeroDay).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cc-chart-point.active")).toHaveCount(1);
  await expect(page.locator(".cc-chart-dates > button.active")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cc-day-boxscore .cc-panel-heading")).toContainText("9/19");
  await expect(page.locator(".cc-game-log .cc-panel-heading")).toContainText("9/19");
  await expect(page.locator(".cc-day-stats")).toContainText("0 段");
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(0);
  await expect(page.locator(".cc-game-log .cc-empty")).toContainText("这一天没有专注记录");
  await expect(page.locator(".cc-period-column > strong")).toHaveText(["0m", "0m", "0m", "0m"]);
  await page.getByRole("button", { name: "回到最近", exact: true }).click();
  await expect(page.locator(".cc-chart-point.active")).toHaveCount(1);
  await expect(points.last()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cc-day-boxscore .cc-panel-heading")).toContainText("9/23");
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(3);
});

test("CC-04 manual supplement, rename, detailed edit, delete, and day history expansion work", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "记录").click();

  let firstRecord = page.locator(".cc-game-log .cc-log-row").first();
  await firstRecord.hover();
  await firstRecord.getByRole("button", { name: "改名", exact: true }).click();
  await page.getByRole("textbox", { name: "记录名称" }).fill("开场战术复盘");
  await page.getByRole("textbox", { name: "记录名称" }).press("Enter");
  await expect(firstRecord.locator("div > strong")).toHaveText("开场战术复盘");

  await page.locator(".cc-record-footer-actions").getByRole("button", { name: "补录", exact: true }).click();
  const manualDialog = page.getByRole("dialog", { name: "补录一段专注" });
  await expect(manualDialog).toBeVisible();
  await manualDialog.getByLabel("标题").fill("手动加练投篮");
  await manualDialog.getByLabel("时长（分钟）").fill("32");
  await manualDialog.getByLabel("完成日期").fill("2026-09-23");
  await manualDialog.getByLabel("完成时间（可选）").fill("15:40");
  await manualDialog.getByRole("button", { name: "补录记录", exact: true }).click();
  await expect(manualDialog).toHaveCount(0);
  let manualRecord = page.locator(".cc-game-log .cc-log-row").filter({ hasText: "手动加练投篮" });
  await expect(manualRecord).toHaveCount(1);
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(4);

  await manualRecord.hover();
  await manualRecord.getByRole("button", { name: "详细编辑", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "编辑专注记录" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("标题").fill("罚球记录");
  await editDialog.getByLabel("时长（分钟）").fill("36");
  await editDialog.getByRole("button", { name: "保存修改", exact: true }).click();
  manualRecord = page.locator(".cc-game-log .cc-log-row").filter({ hasText: "罚球记录" });
  await expect(manualRecord.locator("strong").last()).toHaveText("00:36:00");
  await manualRecord.hover();
  await manualRecord.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".cc-game-log .cc-log-row").filter({ hasText: "罚球记录" })).toHaveCount(0);
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(3);

  await page.locator(".cc-record-footer-actions").getByRole("button", { name: "按日展开完整历史" }).click();
  const history = page.locator("#cc-history-index");
  await expect(history).toBeInViewport();
  const selectedDay = history.locator("details").filter({ has: page.getByText(/9\/23/) }).first();
  await expect(selectedDay).toHaveAttribute("open", "");
  await expect(selectedDay).toContainText("开场战术复盘");
});

test("CC-04 zero-history and dense-history states remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", includeTodo: false, includeInbox: false, recordCount: 0, currentTodoId: null, todayPickIds: [] });
  await navButton(page, "记录").click();
  await expect(page.locator(".cc-chart-point")).toHaveCount(7);
  await expect(page.locator(".cc-chart-point.empty")).toHaveCount(7);
  await expect(page.locator(".cc-day-boxscore")).toContainText("0 段");
  await expect(page.locator(".cc-game-log .cc-empty")).toContainText("这一天没有专注记录");
  await expect(page.locator(".cc-history-index .cc-empty")).toContainText("全部历史会显示在这里");

  await bootReferenceMock(page, { themeId: "clutch-court", recordCount: 65, includeTodo: false, includeInbox: false, currentTodoId: null, todayPickIds: [] });
  await navButton(page, "记录").click();
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(50);
  await page.locator(".cc-record-footer-actions").getByRole("button", { name: /加载更多/ }).click();
  await expect(page.locator(".cc-game-log .cc-log-row")).toHaveCount(65);
  await page.locator("#cc-history-index").scrollIntoViewIfNeeded();
  await expect(page.locator("#cc-history-index")).toBeInViewport();
  await expect(page.locator(".cc-history-index details")).toHaveCount(1);
  await page.screenshot({ path: testOutputPath("CC-04-dense-history", "CC-04-65-records-history.png"), animations: "disabled" });
});

test("CC-04 chart, summary, actions, and full history fit tablet and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "记录").click();
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".cc-records-page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const chartBounds = await page.locator(".cc-chart-point, .cc-chart-dates button").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }));
    expect(chartBounds.every((rect) => rect.left >= -1 && rect.right <= width + 1), JSON.stringify({ width, chartBounds })).toBeTruthy();
    await page.screenshot({ path: testOutputPath("CC-04-responsive", `CC-04-${width}-top.png`), animations: "disabled" });
    await page.locator("#cc-history-index").scrollIntoViewIfNeeded();
    await expect(page.locator("#cc-history-index")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testOutputPath("CC-04-responsive", `CC-04-${width}-history.png`), animations: "disabled" });
  }
});

test("CC-01 home remains complete at tablet and phone widths", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });

  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    const surface = page.locator(".cc-today-page");
    await expect(surface).toBeVisible();
    await expect(page.locator(".cc-round-markers > .cc-round-marker")).toHaveCount(5);
    await expect(page.locator(".cc-home-court .cc-center-clock > strong")).toHaveText("45:00");
    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      markers: Array.from(document.querySelectorAll(".cc-round-markers > .cc-round-marker"), (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
      markersContainer: (() => {
        const element = document.querySelector(".cc-round-markers");
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { left: rect.left, right: rect.right, width: rect.width, display: style.display, gridTemplateColumns: style.gridTemplateColumns, position: style.position, inset: style.inset };
      })(),
      court: (() => {
        const element = document.querySelector(".cc-home-court");
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      })(),
      portraitLoaded: (() => {
        const image = document.querySelector(".cc-butler-card--featured img");
        return Boolean(image?.complete && image.naturalWidth > 0);
      })(),
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.markers.every((rect) => rect.left >= -1 && rect.right <= width + 1), JSON.stringify({ width, ...layout })).toBeTruthy();
    expect(layout.portraitLoaded).toBeTruthy();
    await page.locator(".cc-round-markers > .cc-round-marker").last().scrollIntoViewIfNeeded();
    await expect(page.locator(".cc-round-markers > .cc-round-marker").last()).toBeInViewport();
    await page.screenshot({ path: testOutputPath("responsive", `CC-01-${width}.png`), animations: "disabled" });
  }
  expect(errors).toEqual([]);
});

test("CC-01 empty court can open the playbook to add the first round", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", includeTodo: false, includeInbox: false, recordCount: 0 });
  await expect(page.locator(".cc-round-markers > .cc-round-marker.empty")).toHaveCount(5);
  const addFirst = page.locator(".cc-center-clock .cc-lime-button");
  await expect(addFirst).toHaveText("布置第一回合");
  await expect(addFirst).toBeEnabled();
  await addFirst.click();
  await expect(page.locator(".cc-todos-page")).toBeVisible();
});

test("CC-01 court clock reflects running and paused focus states", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  const clock = page.locator(".cc-home-court .cc-center-clock");
  await page.locator(".cc-round-markers > .cc-round-marker.current").click();
  await expect(clock.locator(".cc-clock-status")).toHaveText("比赛进行中");
  await expect(clock.locator("button")).toContainText("暂停专注");
  await expect(clock.locator("button")).toBeEnabled();
  await page.screenshot({ path: testOutputPath("timer-states", "CC-01-running.png"), animations: "disabled" });

  await clock.locator("button").click();
  await expect(clock.locator(".cc-clock-status")).toHaveText("暂停");
  await expect(clock.locator("button")).toContainText("继续专注");
  await expect(page.locator(".cc-round-markers > .cc-round-marker.current")).toBeDisabled();
  await page.screenshot({ path: testOutputPath("timer-states", "CC-01-paused.png"), animations: "disabled" });
});

test("CC-02 game clock exposes idle, running, paused, countdown-finished, and saved states", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "计时").click();
  const surface = page.locator(".cc-focus-page");
  const primary = surface.locator(".cc-center-circle--timer > .cc-lime-button");
  const status = surface.locator(".cc-quarter-badge");
  await expect(primary).toHaveText("▶　开始专注");
  await expect(surface.locator('select[name="clutchLinkedTodo"]')).toHaveValue("104");
  await page.screenshot({ path: testOutputPath("CC-02-states", "idle.png"), animations: "disabled" });

  await primary.click();
  await expect(status).toContainText("比赛进行中");
  await expect(surface.locator(".cc-center-circle--timer > strong")).toHaveText("1:00");
  await expect(primary).toHaveText("Ⅱ　暂停专注");
  await expect(surface.locator('[aria-label="计时模式"] button').first()).toBeDisabled();
  await expect(surface.locator('[aria-label="计时模式"] button').last()).toBeDisabled();
  await expect(surface.locator('input[name="clutchSessionTitle"]')).toBeDisabled();
  await page.screenshot({ path: testOutputPath("CC-02-states", "running.png"), animations: "disabled" });

  await primary.click();
  await expect(status).toContainText("暂停");
  await expect(primary).toHaveText("▶　继续专注");
  await expect(surface.locator(".cc-timer-actions .cc-secondary-button").first()).toBeEnabled();
  await page.screenshot({ path: testOutputPath("CC-02-states", "paused.png"), animations: "disabled" });

  await surface.locator(".cc-timer-actions .cc-secondary-button").last().click();
  await expect(status).toContainText("准备开球");
  await expect(surface.locator(".cc-center-circle--timer > strong")).toHaveText("0:00");
  await surface.locator('input[name="clutchSessionTitle"]').fill("最后一攻");
  await surface.locator('[aria-label="计时模式"] button').nth(1).click();
  await surface.locator('input[type="number"]').fill("1");
  await primary.click();
  await expect(status).toContainText("时间到 · 待保存");
  await expect(primary).toHaveText("时间到 · 等待记录");
  await expect(primary).toBeDisabled();
  await expect(surface.locator(".cc-timer-actions .cc-secondary-button").first()).toBeEnabled();
  await page.screenshot({ path: testOutputPath("CC-02-states", "countdown-ended-awaiting-save.png"), animations: "disabled" });

  await surface.locator(".cc-timer-actions .cc-secondary-button").first().click();
  await expect(surface.locator('.cc-confirm[role="status"]')).toHaveText("本回合已写入 box score。");
  await expect(surface.locator(".cc-page-footer")).toContainText("今日完成 4 回合");
  await surface.locator(".cc-tactics-actions button").click();
  await expect(page.locator(".cc-records-page")).toBeVisible();
  await expect(page.locator(".cc-records-page .cc-log-row")).toHaveCount(4);
  await expect(page.locator(".cc-records-page .cc-log-row").last()).toContainText("最后一攻");
});

test("CC-02 timer controls stay reachable at tablet and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "clutch-court", demoMode: true });
  await navButton(page, "计时").click();
  for (const width of [1024, 560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".cc-focus-page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator(".cc-center-circle--timer > .cc-lime-button")).toBeVisible();
    await expect(page.locator('input[name="clutchSessionTitle"]')).toBeVisible();
    await expect(page.locator('select[name="clutchLinkedTodo"]')).toBeVisible();
    await expect(page.locator(".cc-tactics-actions button")).toBeEnabled();
    const player = page.locator(".cc-timer-layout > .cc-butler-card");
    await expect(player).toBeVisible();
    const portrait = await player.boundingBox();
    const pageHead = await page.locator(".cc-focus-page > .cc-page-head").boundingBox();
    expect(portrait.y, JSON.stringify({ width, portrait, pageHead })).toBeGreaterThanOrEqual(pageHead.y + pageHead.height - 1);
    const primary = await page.locator(".cc-center-circle--timer > .cc-lime-button").boundingBox();
    expect(primary.x).toBeGreaterThanOrEqual(0);
    expect(primary.x + primary.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testOutputPath("CC-02-responsive", `CC-02-${width}.png`), animations: "disabled" });
  }
});

test("MP-02 timer state captures · running paused continued and countdown awaiting save", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "计时").click();
  const surface = page.locator(".mp-focus-page");
  await surface.locator(".mp-mode-tabs button").nth(1).click();
  const primary = surface.locator(".mp-focus-actions .mp-orange-button");
  await expect(primary).toHaveText(/开始专注/);
  await primary.click();
  await expect(surface.locator(".mp-status-pill")).toContainText("进行中");
  await expect(surface.locator(".mp-timer-flip-card").first()).toHaveText("44");
  await page.screenshot({ path: testOutputPath("MP-02-states", "running.png"), animations: "disabled" });

  await surface.getByRole("button", { name: /暂停专注/ }).click();
  await expect(surface.locator(".mp-status-pill")).toContainText("已暂停");
  await expect(surface.locator(".mp-mode-tabs button").nth(0)).toBeDisabled();
  await expect(surface.locator(".mp-mode-tabs button").nth(1)).toBeDisabled();
  await page.screenshot({ path: testOutputPath("MP-02-states", "paused.png"), animations: "disabled" });
  await surface.getByRole("button", { name: /继续专注/ }).click();
  await expect(surface.locator(".mp-status-pill")).toContainText("进行中");

  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "计时").click();
  const endedSurface = page.locator(".mp-focus-page");
  await endedSurface.locator(".mp-mode-tabs button").nth(1).click();
  await endedSurface.locator('input[name="metroCountdownMinutes"]').fill("1");
  await endedSurface.locator(".mp-focus-actions .mp-orange-button").click();
  await expect(endedSurface.locator(".mp-status-pill")).toContainText("待保存");
  await expect(endedSurface.locator(".mp-focus-actions .mp-orange-button")).toHaveText(/本班已到站/);
  await expect(endedSurface.locator(".mp-focus-actions .mp-orange-button")).toBeDisabled();
  await expect(endedSurface.locator(".mp-focus-actions .mp-outline-button")).toBeEnabled();
  await page.screenshot({ path: testOutputPath("MP-02-states", "countdown-ended-awaiting-save.png"), animations: "disabled" });
});

test("MP-03 lanes and new-shift form remain accessible at desktop, tablet, and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", demoMode: true });
  await navButton(page, "待办").click();

  for (const [width, height] of [[1487, 1058], [1024, 900], [560, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".mp-todos-page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const lane of await page.locator(".mp-lane").all()) {
      await lane.locator(":scope > header").scrollIntoViewIfNeeded();
      await expect(lane.locator(":scope > header")).toBeInViewport();
    }

    await page.locator(".mp-todos-page").getByRole("button", { name: "新增班次", exact: true }).click();
    const controls = page.locator(".mp-create-card input, .mp-create-card select, .mp-create-card button");
    await expect(controls).toHaveCount(5);
    const fieldBounds = await controls.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }));
    expect(fieldBounds.every((rect) => rect.left >= -1 && rect.right <= width + 1 && rect.width > 0), JSON.stringify({ width, fieldBounds })).toBeTruthy();
    await page.screenshot({ path: testOutputPath("MP-03-responsive", `MP-03-${width}-form.png`), animations: "disabled" });
    await page.locator(".mp-todos-page").getByRole("button", { name: "收起新增", exact: true }).click();
  }
});

test("MP-03 edit, completion, add, and start actions update the connected task data", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page, { themeId: "metro-pulse", includeOverdue: true, includeFuture: true });
  await navButton(page, "待办").click();

  const todayRow = page.locator(".mp-lane--today .mp-task-row").first();
  await expect(page.locator(".mp-lane--next .mp-task-row")).toHaveCount(4);
  await expect(page.locator(".mp-lane--next .mp-task-status")).toHaveText(["已过期", "未安排", "待开始", "待开始"]);
  await todayRow.hover();
  await todayRow.getByRole("button", { name: "编辑", exact: true }).click();
  const edit = todayRow.locator(".mp-task-edit");
  await edit.locator('input[type="text"], input:not([type])').first().fill("整理研究资料·修订");
  await edit.locator('input[type="date"]').fill("2026-09-05");
  await edit.locator('input[type="time"]').fill("09:25");
  await edit.locator("select").selectOption("low");
  await edit.getByRole("button", { name: "保存", exact: true }).click();
  await expect(todayRow.locator(".mp-task-copy strong")).toHaveText("整理研究资料·修订");
  await expect(todayRow.locator(".mp-task-copy small")).toHaveText("09:25　·　低压力");
  await todayRow.getByRole("button", { name: "完成“整理研究资料·修订”", exact: true }).click();
  await expect(page.locator(".mp-lane--arrived .mp-task-row").filter({ hasText: "整理研究资料·修订" })).toHaveCount(1);

  await page.locator(".mp-todos-page").getByRole("button", { name: "新增班次", exact: true }).click();
  await page.locator('input[name="metroTodoTitle"]').fill("准备下午复盘");
  await page.locator('input[name="metroTodoDate"]').fill("2026-09-05");
  await page.locator('input[name="metroTodoTime"]').fill("13:20");
  await page.locator('select[name="metroTodoImportance"]').selectOption("high");
  await page.locator(".mp-create-card").getByRole("button", { name: "确认排班", exact: true }).click();
  await expect(page.locator(".mp-lane--next .mp-task-row").filter({ hasText: "准备下午复盘" })).toHaveCount(1);

  const newRow = page.locator(".mp-lane--next .mp-task-row").filter({ hasText: "准备下午复盘" });
  await newRow.hover();
  await newRow.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(page.locator(".mp-focus-page")).toBeVisible();
  await expect(page.locator('input[name="metroSessionTitle"]')).toHaveValue("准备下午复盘");
  await expect(page.locator('select[name="metroLinkedTodo"] option:checked')).toHaveText("准备下午复盘");
});
