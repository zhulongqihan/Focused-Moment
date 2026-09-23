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


const themeLayouts = {
  "night-valley": { prefix: "nv", today: ".trail-page", landmark: ".trail-map", secondary: ".trail-focus-panel", picker: ".nv-theme-card", preview: ".nv-settings-theme-lab", task: ".trail-node--current", pause: "暂停" },
  "editorial-paper": { prefix: "ep", today: ".ep-today-page", landmark: ".ep-field-sheet", secondary: ".ep-next-card", picker: ".ep-theme-swatch", preview: ".ep-live-preview", task: ".ep-next-card .ep-paper-button--green", pause: "暂停" },
  "graphite-console": { prefix: "gc", today: ".gc-today-page", landmark: ".gc-sequence-panel", secondary: ".gc-operation-panel", picker: ".gc-theme-card", preview: ".gc-settings-footer", task: ".gc-operation-card .gc-lime-button", pause: "暂停本段" },
  // ec8ed25 names these controls bubbles and books, not generic cards.
  "aurora-ocean": { prefix: "ao", today: ".ao-today-page", landmark: ".ao-orbit-stage", secondary: ".ao-next-capsule", picker: ".ao-theme-bubble", preview: ".ao-settings-preview", task: ".ao-intro-actions .ao-aqua-button", pause: "暂停此潮" },
  "botanical-library": { prefix: "bl", today: ".bl-today-page", landmark: ".bl-library-stilllife", secondary: ".bl-stilllife-paper", picker: ".bl-theme-book", preview: ".bl-settings-preview", task: ".bl-intro-actions .bl-ink-button", pause: "暂停这一页" },
};

function surfaceSelector(themeId, view) {
  const layout = themeLayouts[themeId];
  if (view === "today") return layout.today;
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
  await expect(page.locator(`.daily-focus-line--${themeId}`)).toHaveCount(1);
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

  await page.addInitScript(({ today, themeId, includeTodo, includeInbox, recordCount, currentTodoId, todayPickIds }) => {
    const selectedTheme = themeId;
    localStorage.setItem("focused-moment.theme", themeId);
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
        scheduledTime: id === 101 ? "09:00" : id === 102 ? "10:00" : "",
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
  }, { today, themeId, includeTodo, includeInbox, recordCount, currentTodoId, todayPickIds });

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

test("All five themes restore distinct Today compositions and one stable focus line", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootReferenceMock(page);
  const focusLines = [];
  for (const [themeId, themeName] of themes) {
    await selectTheme(page, themeId, themeName);
    await navButton(page, "今日").click();
    await expectOriginalToday(page, themeId);
    await expect(page.locator(themeLayouts[themeId].today)).toContainText("整理研究资料");
    await expect(page.locator(themeLayouts[themeId].today)).toContainText("02:15:00");
    const copyId = await page.locator(".daily-focus-line").getAttribute("data-copy-id");
    expect(copyId).toBeTruthy();
    focusLines.push(copyId);
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
    await expect(surface).toContainText("00:00:00");
    await expect(surface).not.toContainText("整理研究资料");
    await expect(surface).not.toContainText("专注轮次");
    await expect(page.locator(".unified-today-page, .continuity-board, .virtual-record")).toHaveCount(0);
    if (themeId === "night-valley") {
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
    } else if (themeId === "aurora-ocean") {
      await expect(page.locator(".ao-orbit-node")).toHaveCount(0);
      await expect(page.locator(".ao-orbit-empty")).toContainText("轨道还没有节点");
    } else {
      await expect(page.locator(".bl-plant-marker")).toHaveCount(0);
      await expect(page.locator(".bl-shelf-empty")).toContainText("书架还没有新的生长点");
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

test("Aurora and Botanical keep full pages scrollable and align seven-day charts", async ({ page }) => {
  test.setTimeout(60_000);
  for (const [themeId] of [["aurora-ocean"], ["botanical-library"]]) {
    await bootReferenceMock(page, { themeId });
    const prefix = themeId === "aurora-ocean" ? "ao" : "bl";
    const surface = page.locator(`.${prefix}-today-page`);
    const todayMetrics = await page.evaluate((surfaceSelector) => {
      const app = document.querySelector(".minimal-app");
      const target = document.querySelector(surfaceSelector);
      const footer = target?.querySelector("footer");
      if (!app || !target || !footer) return null;
      const rect = footer.getBoundingClientRect();
      return { footerBottom: rect.bottom + window.scrollY, documentHeight: document.documentElement.scrollHeight, appHeight: app.scrollHeight };
    }, `.${prefix}-today-page`);
    expect(todayMetrics).not.toBeNull();
    expect(Math.max(todayMetrics.documentHeight, todayMetrics.appHeight)).toBeGreaterThanOrEqual(todayMetrics.footerBottom - 1);

    await navButton(page, "记录").click();
    const chart = page.locator(`.${prefix === "ao" ? "ao-archive-chart" : "bl-growth-chart"}`);
    const svg = chart.locator("svg");
    const path = chart.locator(`.${prefix === "ao" ? "ao-archive-path" : "bl-growth-path"}`);
    await expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
    const svgBox = await svg.boundingBox();
    const pathBox = await path.boundingBox();
    expect(svgBox).not.toBeNull();
    expect(pathBox).not.toBeNull();
    expect(pathBox.width).toBeGreaterThan(svgBox.width * 0.7);
    const points = await chart.locator(`.${prefix === "ao" ? "ao-archive-point" : "bl-growth-point"}`).evaluateAll((buttons) => buttons.map((button) => ({ left: Number.parseFloat(button.style.left), top: Number.parseFloat(button.style.top) })));
    expect(points.length).toBe(7);
    expect(points[0].left).toBeCloseTo(7, 1);
    expect(points.at(-1).left).toBeCloseTo(93, 1);

    const recordsMetrics = await page.evaluate((surfaceSelector) => {
      const app = document.querySelector(".minimal-app");
      const target = document.querySelector(surfaceSelector);
      const history = target?.querySelector("[class*='history-index']");
      if (!app || !target || !history) return null;
      const rect = history.getBoundingClientRect();
      return { historyBottom: rect.bottom + window.scrollY, documentHeight: document.documentElement.scrollHeight, appHeight: app.scrollHeight };
    }, `.${prefix}-records-page`);
    expect(recordsMetrics).not.toBeNull();
    expect(Math.max(recordsMetrics.documentHeight, recordsMetrics.appHeight)).toBeGreaterThanOrEqual(recordsMetrics.historyBottom - 1);
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
    if (themeId === "aurora-ocean") await expect(page.getByRole("button", { name: "保存光场设置", exact: true })).toHaveCount(0);
    if (themeId === "botanical-library") await expect(page.getByRole("button", { name: "保存书房布置", exact: true })).toHaveCount(0);
    await expect(page.locator(layout.preview)).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).themeId)).toBe(themeId);
  }
  expect(await page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThanOrEqual(4);
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
      await expect(navButton(page, "今日")).toHaveClass(/active/);
      await expect(page.locator(surfaceSelector(themeId, "focus"))).toHaveCount(0);
      expect(await page.evaluate(() => window.__miniWorkspaceShown)).toBe(0);
      await navButton(page, "计时").click();
      const focus = page.locator(surfaceSelector(themeId, "focus"));
      await expect(focus).toBeVisible();
      await expect(focus.getByRole("button", { name: themeLayouts[themeId].pause, exact: true })).toBeVisible();
      await expect(navButton(page, "计时")).toHaveClass(/active/);
      expect(await page.evaluate(() => window.__startTimerCalls)).toBe(1);
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
    for (const width of view === "today" ? [1487, 1024, 560] : [1487]) {
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
        if (view === "focus") await expect(surface.getByRole("button", { name: themeId === "night-valley" ? "开始" : "开始专注", exact: true })).toBeVisible();
        if (view === "todos") {
          await expect(surface).toContainText("回看上次停笔位置");
          const todayGroup = surface.locator(".nv-todo-date-group__toggle").filter({ hasText: "今天 · 9月5日" });
          await expect(todayGroup).toHaveAttribute("aria-expanded", "false");
          await todayGroup.click();
          await expect(todayGroup).toHaveAttribute("aria-expanded", "true");
          await expect(surface).toContainText("整理研究资料");
          await expect(surface).toContainText("写下发布清单");
        }
        if (view === "records") await expect(surface).toContainText("02:15:00");
        if (view === "settings") await expect(page.locator(themeLayouts[themeId].picker)).toHaveCount(5);
        await page.screenshot({ path: testOutputPath("restored-ui", `${themeId}-${view}-${width}.png`), fullPage: true, animations: "disabled" });
        expect(errors).toEqual([]);
      });
    }
  }
}
