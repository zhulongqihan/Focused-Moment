import { expect, test } from "@playwright/test";

import { testOutputPath } from "./helpers/test-output.mjs";

const today = "2026-09-05";
const themes = [
  ["night-valley", "夜谷"],
  ["editorial-paper", "编辑纸页"],
  ["graphite-console", "石墨控制台"],
  ["aurora-ocean", "极光海面"],
  ["botanical-library", "植物书房"],
];

function navButton(page, label) {
  return page.locator(".minimal-nav > button").filter({ hasText: label }).first();
}

async function bootReferenceMock(page, {
  includeTodo = true,
  includeInbox = true,
  recordCount = 3,
  currentTodoId = 101,
  todayPickIds = [101, 102, 103],
} = {}) {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class ReferenceDate extends NativeDate {
      constructor(...args) {
        super(...(args.length === 0 ? ["2026-09-05T12:00:00+08:00"] : args));
      }

      static now() {
        return new NativeDate("2026-09-05T12:00:00+08:00").getTime();
      }
    }

    window.Date = ReferenceDate;
  });

  await page.addInitScript(({ today, includeTodo, includeInbox, recordCount, currentTodoId, todayPickIds }) => {
    const selectedTheme = localStorage.getItem("focused-moment.theme") || "night-valley";
    const todoSeeds = [
      [101, "整理研究资料", today],
      [102, "写下发布清单", today],
      [103, "回看上次停笔位置", ""],
    ];
    let todos = todoSeeds
      .filter(([id]) => (includeTodo && id !== 103) || (includeInbox && id === 103))
      .map(([id, title, scheduledDate]) => ({
        id,
        title,
        isCompleted: false,
        scheduledDate,
        scheduledTime: "",
        importanceKey: "medium",
        continuationNote: id === 101 ? "从研究结论的第三段继续" : "",
        continuationUpdatedAt: id === 101 ? `${today}T11:00:00+08:00` : null,
      }));
    const focusRecords = Array.from({ length: recordCount }, (_, index) => {
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
    let timer = {
      modeKey: "stopwatch",
      phaseKey: "stopwatch",
      mode: "正向计时",
      phaseLabel: "正向计时",
      status: "待开始",
      isRunning: false,
      elapsedMs: 0,
      elapsedLabel: "00:00:00",
      targetDurationMs: null,
      remainingMs: null,
      secondaryLabel: "本轮已投入",
      canCompleteSession: false,
      hasUnsubmittedProgress: false,
      activeTaskTitle: "",
      linkedTodoId: null,
      completeLinkedTodoOnFinish: false,
      currentRound: 1,
      completedFocusCount: recordCount,
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
      pomodoroFocusMinutes: 25,
      pomodoroBreakMinutes: 5,
      stopwatchReminderMinutes: 45,
      toastReminderEnabled: true,
      windowAttentionReminderEnabled: true,
      soundReminderEnabled: true,
      alertSoundKey: "soft_chime",
    };
    let appPreferences = {
      schemaVersion: 3,
      themeId: selectedTheme,
      visualIntensity: 55,
      motionIntensity: 45,
      density: "roomy",
      floatingOpacity: 92,
      autoMiniOnStart: false,
      customAlertSoundName: "",
      customAlertSoundData: null,
    };
    let focusPlan = {
      currentTodoId: todos.some((item) => item.id === currentTodoId) ? currentTodoId : null,
      todayPickIds: todayPickIds.filter((id) => todos.some((item) => item.id === id)).slice(0, 3),
    };
    const totalMinutes = recordCount * 45;
    const totalLabel = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}:00`;
    const analytics = {
      totalFocusDurationMs: recordCount * 45 * 60 * 1000,
      totalFocusDurationLabel: totalLabel,
      sessionCount: recordCount,
      linkedSessionCount: recordCount,
      independentSessionCount: 0,
      pendingTodoCount: todos.filter((item) => !item.isCompleted).length,
      completedTodoCount: 0,
      activeDays: recordCount ? 1 : 0,
      averageDailyDurationLabel: recordCount ? "00:45:00" : "00:00:00",
      todayFocusDurationLabel: totalLabel,
      todaySessionCount: recordCount,
      currentStreakDays: recordCount ? 9 : 0,
      bestFocusDate: recordCount ? today : null,
      bestFocusDurationLabel: recordCount ? totalLabel : "00:00:00",
      dailyBreakdown: [],
    };

    window.__startTimerCalls = 0;
    window.__miniWorkspaceShown = 0;
    window.__appPreferenceUpdateCalls = 0;
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
          case "get_focus_records":
            return focusRecords;
          case "get_analytics_snapshot":
            return analytics;
          case "list_app_backups":
            return [];
          case "update_timer_context":
            timer = { ...timer, activeTaskTitle: args.title ?? "", linkedTodoId: args.linkedTodoId ?? null };
            return timer;
          case "start_timer":
            window.__startTimerCalls += 1;
            timer = { ...timer, isRunning: true, status: "运行中", elapsedMs: 60_000, elapsedLabel: "00:01:00", hasUnsubmittedProgress: true, canCompleteSession: true };
            return timer;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "show_floating_todos":
            window.__miniWorkspaceShown += 1;
            return null;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id ? { ...item, isCompleted: !item.isCompleted } : item);
            return todos;
          default:
            return null;
        }
      },
    };
  }, { today, includeTodo, includeInbox, recordCount, currentTodoId, todayPickIds });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
}

test("Today exposes the three continuity layers and real data at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);

  await expect(page.locator(".unified-today-page")).toBeVisible();
  await expect(page.locator(".continuity-board__card")).toHaveCount(3);
  await expect(page.getByText("当前事项", { exact: true })).toBeVisible();
  await expect(page.getByText("今日精选", { exact: true })).toBeVisible();
  await expect(page.getByText("今日投入", { exact: true })).toBeVisible();
  await expect(page.getByText("整理研究资料", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2 小时 15 分钟", { exact: true })).toBeVisible();
  await expect(page.locator(".trail-node, .trail-map, .gc-sequence-row, .ao-orbit-stage, .bl-library-stilllife")).toHaveCount(0);
  await expect(page.getByText("连续 9 天", { exact: true })).toHaveCount(0);
  await expect(page.getByText("OPEN SLOT", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testOutputPath("screenshots", "today-continuity-desktop.png"), animations: "disabled" });
});

test("All five themes share the same Today workflow and one focus line", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);

  for (const [themeId, themeName] of themes) {
    await navButton(page, "设置").click();
    await page.locator(".theme-picker__option").filter({ hasText: themeName }).click({ force: true });
    await navButton(page, "今日").click();
    await expect(page.locator(`.unified-today-page--${themeId}`)).toBeVisible();
    await expect(page.locator(`.daily-focus-line--${themeId}`)).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
    await expect(page.locator(".continuity-board__card")).toHaveCount(3);
  }
});

test("Today empty states contain no virtual records or slots", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await bootReferenceMock(page, { includeTodo: false, includeInbox: false, recordCount: 0, currentTodoId: null, todayPickIds: [] });

  await expect(page.getByText("选择一件事开始", { exact: true })).toBeVisible();
  await expect(page.getByText("从待办或收件箱加入", { exact: true })).toBeVisible();
  await expect(page.getByText("0 分钟", { exact: true })).toBeVisible();
  await expect(page.locator(".continuity-board__card")).toHaveCount(3);
  await expect(page.locator(".trail-node, .gc-sequence-row--empty, .todo-placeholder, .virtual-record")).toHaveCount(0);
});

test("Today remains inside the viewport from desktop to narrow mobile", async ({ page }) => {
  test.setTimeout(90_000);
  for (const [width, height, name] of [[1487, 1058, "wide"], [1024, 900, "medium"], [560, 900, "narrow"]]) {
    await page.setViewportSize({ width, height });
    await bootReferenceMock(page);
    const rect = await page.locator(".unified-today-page").boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    const boardRect = await page.locator(".continuity-board").boundingBox();
    expect(boardRect).not.toBeNull();
    expect(boardRect.x).toBeGreaterThanOrEqual(0);
    expect(boardRect.x + boardRect.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: testOutputPath("screenshots", `today-${name}.png`), animations: "disabled" });
  }
});

test("Todos exposes the inbox and focus-plan controls without fabricating a due date", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "待办").click();
  await expect(page.locator(".focus-plan-controls")).toBeVisible();
  await expect(page.getByText("收件箱 · 未安排", { exact: true })).toBeVisible();
  await expect(page.locator(".focus-plan-controls")).toContainText("回看上次停笔位置");
  await expect(page.getByRole("button", { name: "快速记一件事", exact: true })).toBeVisible();
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

test("Settings uses five real previews, immediate theme changes, and no developer status copy", async ({ page }) => {
  await bootReferenceMock(page);
  await navButton(page, "设置").click();
  const picker = page.locator(".theme-picker__option");
  await expect(picker).toHaveCount(5);
  await expect(picker.locator("img")).toHaveCount(5);
  await expect(picker.filter({ hasText: "夜谷" })).toHaveAttribute("aria-pressed", "true");
  for (const [, name] of themes.slice(1)) {
    await picker.filter({ hasText: name }).click({ force: true });
    await expect(picker.filter({ hasText: name })).toHaveAttribute("aria-pressed", "true");
  }
  const bodyText = await page.locator("body").innerText();
  for (const forbidden of ["已实现", "已接入", "尚未实现", "未装订", "主题观测站", "待排定"]) {
    expect(bodyText).not.toContain(forbidden);
  }
  await expect(page.getByRole("button", { name: /保存书房布置|保存光场设置|保存设置/ })).toHaveCount(0);
});

test("Every theme keeps Focus reachable after Today consolidation", async ({ page }) => {
  test.setTimeout(90_000);
  await bootReferenceMock(page);
  for (const [themeId, themeName] of themes) {
    await navButton(page, "设置").click();
    await page.locator(".theme-picker__option").filter({ hasText: themeName }).click({ force: true });
    await navButton(page, "计时").click();
    await expect(page.locator('[class*="focus-page"]').first()).toBeVisible();
    await expect(page.locator('[class*="focus-page"] button').filter({ hasText: /开始/ }).first()).toBeVisible();
    await navButton(page, "今日").click();
    await expect(page.locator(`.unified-today-page--${themeId}`)).toBeVisible();
  }
});
