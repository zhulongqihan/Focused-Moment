import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const referenceDate = "2026-09-05";
const baselineSha = process.env.NV04_BASELINE_SHA ?? execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const baselineDirectory = `output/qa/NV-04/${baselineSha}`;
const editorialDirectory = `output/qa/TH-02/${process.env.TH02_BASELINE_SHA ?? baselineSha}`;
const graphiteDirectory = `output/qa/TH-03/${process.env.TH03_BASELINE_SHA ?? baselineSha}`;
const auroraDirectory = `output/qa/TH-04/${process.env.TH04_BASELINE_SHA ?? baselineSha}`;
const botanicalDirectory = `output/qa/TH-05/${process.env.TH05_BASELINE_SHA ?? baselineSha}`;
const performanceDirectory = `output/qa/PERF-01/${process.env.PERF_BASELINE_SHA ?? baselineSha}`;

const nightValleyPages = [
  ["今日", ".trail-map", ".trail-page"],
  ["计时", ".nv-focus-panel", ".nv-page"],
  ["待办", ".nv-todo-board", ".nv-page"],
  ["记录", ".nv-records-archive", ".nv-page"],
  ["设置", ".nv-settings-layout", ".nv-page"],
];

function pageButton(page, label) {
  return page.locator(".minimal-nav > button").filter({ hasText: label });
}

async function bootTodayReferenceMock(page, { expectedHeading = "今天，从一件事开始", recordCount = 7, includeTodo = true, todoTitles = ["明日规划"], completedTodoTitles = [], dailyBreakdown = [], recordDates = [], recordTitlePrefix = "", analyticsPatch = {}, freezeClock = true } = {}) {
  if (freezeClock) {
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
  }

  await page.addInitScript(({ today, recordCount, includeTodo, todoTitles, completedTodoTitles, dailyBreakdown, recordDates, recordTitlePrefix, analyticsPatch }) => {
    const focusRecordSeeds = [
      ["晨间计划", "08:10"],
      ["阅读行业报告", "09:35"],
      ["整理研究资料", "11:00"],
      ["完成产品复盘", "13:20"],
      ["拆解交互细节", "15:05"],
      ["写下发布清单", "17:15"],
      ["收束今天的工作", "19:10"],
    ];
    const focusRecords = Array.from({ length: recordCount }, (_, index) => {
      const [seedTitle, completedTime] = focusRecordSeeds[index % focusRecordSeeds.length];
      const title = recordTitlePrefix ? `${recordTitlePrefix} ${index + 1}` : recordCount > focusRecordSeeds.length ? `${seedTitle} ${index + 1}` : seedTitle;
      const completedDate = recordDates[index] ?? today;
      return {
      id: index + 1,
      title,
      durationMs: 45 * 60 * 1000,
      durationLabel: "00:45:00",
      modeKey: "stopwatch",
      modeLabel: "正向计时",
      phaseLabel: "正向计时",
      linkedTodoId: null,
      linkedTodoTitle: title,
      completedAt: `${completedDate}T${completedTime}:00`,
      completedDate,
      completedTime,
      };
    });

    let todos = [
      ...(includeTodo ? todoTitles : []).map((title, index) => ({
        id: 101 + index,
        title,
        isCompleted: false,
        scheduledDate: today,
        scheduledTime: "21:00",
        importanceKey: "medium",
      })),
      ...completedTodoTitles.map((title, index) => ({
        id: 201 + index,
        title,
        isCompleted: true,
        scheduledDate: today,
        scheduledTime: "18:00",
        importanceKey: "low",
      })),
    ];

    let timer = {
      modeKey: "countdown",
      phaseKey: "countdown",
      mode: "倒计时",
      phaseLabel: "倒计时",
      status: "待开始",
      isRunning: false,
      elapsedMs: 0,
      elapsedLabel: "00:45:00",
      targetDurationMs: 45 * 60 * 1000,
      remainingMs: 45 * 60 * 1000,
      secondaryLabel: "本轮剩余时间",
      canCompleteSession: false,
      hasUnsubmittedProgress: false,
      activeTaskTitle: "",
      linkedTodoId: null,
      completeLinkedTodoOnFinish: false,
      currentRound: 1,
      completedFocusCount: 7,
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
      pomodoroFocusMinutes: 45,
      pomodoroBreakMinutes: 5,
      stopwatchReminderMinutes: 45,
      toastReminderEnabled: true,
      windowAttentionReminderEnabled: true,
      soundReminderEnabled: true,
      alertSoundKey: "soft_chime",
    };

    const analytics = {
      totalFocusDurationMs: focusRecords.length * 45 * 60 * 1000,
      totalFocusDurationLabel: "05:15:00",
      sessionCount: focusRecords.length,
      linkedSessionCount: 0,
      independentSessionCount: focusRecords.length,
      pendingTodoCount: includeTodo ? todoTitles.length : 0,
      completedTodoCount: completedTodoTitles.length,
      activeDays: 9,
      averageDailyDurationLabel: "00:35:00",
      todayFocusDurationLabel: "05:15:00",
      todaySessionCount: focusRecords.length,
      currentStreakDays: 9,
      bestFocusDate: today,
      bestFocusDurationLabel: "05:15:00",
      dailyBreakdown,
      ...analyticsPatch,
    };

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
            return 1;
          case "plugin:event|unlisten":
            return null;
          case "get_timer_snapshot":
            return timer;
          case "get_timer_preferences":
            return timerPreferences;
          case "get_todo_items":
            return todos;
          case "get_focus_records":
            return focusRecords;
          case "get_analytics_snapshot":
            return analytics;
          case "list_app_backups":
            return [];
          case "set_countdown_minutes":
            timer = {
              ...timer,
              targetDurationMs: Number(args.minutes) * 60 * 1000,
              remainingMs: Number(args.minutes) * 60 * 1000,
              elapsedLabel: `00:${String(Number(args.minutes)).padStart(2, "0")}:00`,
            };
            return timer;
          case "start_timer":
            timer = { ...timer, isRunning: true, hasUnsubmittedProgress: true, status: "倒计时中", canCompleteSession: true };
            return timer;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "update_timer_context":
            timer = {
              ...timer,
              activeTaskTitle: args.title ?? "",
              linkedTodoId: args.linkedTodoId ?? null,
              completeLinkedTodoOnFinish: Boolean(args.completeLinkedTodoOnFinish),
            };
            return timer;
          case "reset_timer":
            return timer;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id ? { ...item, isCompleted: !item.isCompleted } : item);
            return todos;
          default:
            return null;
        }
      },
    };
  }, { today: referenceDate, recordCount, includeTodo, todoTitles, completedTodoTitles, dailyBreakdown, recordDates, recordTitlePrefix, analyticsPatch });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
}

test("Today reference composition stays aligned at the concept viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await expect(page.locator(".trail-node")).toHaveCount(8);
  await expect(page.getByText(/今天已完成 7 段专注/)).toBeVisible();
  await expect(page.getByText("连续 9 天", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-page__clock")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(page.getByText("05:15:00", { exact: true })).toBeVisible();
  await expect(page.getByText("0 / 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看计时", exact: true })).toHaveCount(0);
  await expect(page.locator(".trail-timer")).toHaveCount(0);
  await expect(page.locator(".minimal-app--trail .command-trigger")).toBeHidden();
  await page.screenshot({ path: "output/playwright/today-after.png", animations: "disabled" });
});

test("Every theme carries one stable daily focus line on Today", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  const themeHeadings = [
    ["night-valley", "今天，从一件事开始"],
    ["editorial-paper", "今日节奏"],
    ["graphite-console", "TODAY / 节奏调度"],
    ["aurora-ocean", "TIDE / 潮汐轨迹"],
    ["botanical-library", "GROWTH / 今日生长"],
  ];
  const copyIds = [];

  for (const [theme, heading] of themeHeadings) {
    await page.evaluate((selectedTheme) => {
      localStorage.setItem("focused-moment.theme", selectedTheme);
    }, theme);
    await page.reload();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();

    const line = page.locator(".daily-focus-line--" + theme);
    await expect(line).toHaveCount(1);
    await expect(line).toHaveAttribute("data-copy-id", /^copy-/);
    await expect(line.locator("blockquote")).toHaveText(/\S/);
    copyIds.push(await line.getAttribute("data-copy-id"));
  }

  expect(new Set(copyIds).size).toBe(1);
});

test("Today fullscreen keeps the summary visible and uses a smooth winding route", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1368 });
  await bootTodayReferenceMock(page, { recordCount: 1, includeTodo: false });

  await expect(page.locator(".trail-node")).toHaveCount(1);
  await expect(page.getByText(/今天已完成 1 段专注/)).toBeVisible();

  const footerBounds = await page.locator(".trail-map__footer").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  });
  expect(footerBounds.top).toBeGreaterThanOrEqual(0);
  expect(footerBounds.bottom).toBeLessThanOrEqual(1368);

  const routePath = await page.locator(".trail-map__route-line").getAttribute("d");
  expect(routePath).toBeTruthy();
  expect(routePath).toMatch(/^M\s/);
  expect(routePath).not.toMatch(/\bL\b/);
  expect((routePath?.match(/\bC\b/g) ?? []).length).toBeGreaterThanOrEqual(12);
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-page__clock")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await page.screenshot({ path: "output/playwright/today-fullscreen-refined.png", animations: "disabled" });
});

test("Today keeps node information visible and keeps timing in the focus tab", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await expect(page.locator(".trail-node__meta").first()).toContainText("晨间计划");
  await expect(page.locator(".trail-node__meta").first()).toHaveCSS("visibility", "visible");
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看计时", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".nv-focus-page")).toBeVisible();
});

test("Today route keeps the panel and path usable as the window narrows", async ({ page }) => {
  test.setTimeout(60_000);
  for (const [width, height, screenshotPath] of [
    [1280, 900, "output/playwright/today-1280.png"],
    [1024, 900, "output/playwright/today-1024.png"],
  ]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page);

    const layout = await page.locator(".trail-map, .trail-focus-panel").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { className: element.className, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
      }),
    );
    const map = layout.find((item) => item.className === "trail-map");
    const panel = layout.find((item) => item.className.includes("trail-focus-panel"));
    expect(panel.right).toBeLessThanOrEqual(width);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    if (width <= 1160) {
      expect(panel.y).toBeLessThan(map.bottom);
      expect(panel.bottom).toBeLessThanOrEqual(height);
      await expect(page.locator(".trail-nav__brand")).toBeVisible();
      await expect(page.locator(".trail-nav__icon").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: screenshotPath, animations: "disabled" });
  }
});

test("Night Valley pages expose the measured reference surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  const pages = [
    ["计时", "night-valley-timer.png"],
    ["待办", "night-valley-todo.png"],
    ["记录", "night-valley-records.png"],
    ["设置", "night-valley-settings.png"],
  ];

  for (const [label, screenshotName] of pages) {
    await page.getByRole("button", { name: label === "待办" ? /^待办/ : label, exact: label !== "待办" }).click();
    await expect(page.locator(".nv-page").first()).toBeVisible();
    await page.screenshot({ path: `output/playwright/${screenshotName}`, animations: "disabled" });
  }
});

test("Night Valley tabs share the live clock and hide the command trigger", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  for (const [label] of nightValleyPages) {
    await pageButton(page, label).click();
    await expect(page.locator('time[aria-label^="当前时间"]')).toHaveCount(1);
    await expect(page.locator('time[aria-label^="当前时间"]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    await expect(page.locator(".command-trigger")).toBeHidden();
  }
});

test("Night Valley baseline records five-page geometry and environment metadata", async ({ page }) => {
  const viewport = { width: 1487, height: 1058 };
  const capturedAt = new Date().toISOString();
  await page.setViewportSize(viewport);
  await bootTodayReferenceMock(page);

  const pages = {};
  for (const [label, surfaceSelector, rootSelector] of nightValleyPages) {
    await pageButton(page, label).click();
    await expect(page.locator(rootSelector).first()).toBeVisible();
    pages[label] = await page.evaluate(({ selector, root }) => {
      const toRect = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          bottom: Number(rect.bottom.toFixed(2)),
        };
      };
      const pageElement = document.querySelector(root);
      const heading = pageElement?.querySelector("h1");
      const bodyStyle = getComputedStyle(document.body);
      const pageStyle = pageElement ? getComputedStyle(pageElement) : null;
      return {
        pageRect: toRect(pageElement),
        surfaceRect: toRect(document.querySelector(selector)),
        navigationRect: toRect(document.querySelector(".minimal-nav")),
        headingRect: toRect(heading),
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        fontFamily: pageStyle?.fontFamily ?? bodyStyle.fontFamily,
        headingFontFamily: heading ? getComputedStyle(heading).fontFamily : null,
        documentFontStatus: document.fonts.status,
      };
    }, { selector: surfaceSelector, root: rootSelector });
  }

  const environment = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    documentFonts: Array.from(document.fonts).map((font) => ({ family: font.family, status: font.status })),
  }));

  mkdirSync(baselineDirectory, { recursive: true });
  writeFileSync(`${baselineDirectory}/geometry.json`, JSON.stringify({
    taskId: "NV-04",
    sha: baselineSha,
    capturedAt,
    fixture: {
      referenceDate,
      focusRecords: 7,
      focusDuration: "00:45:00",
      pendingTodos: 1,
      transport: "Chromium + Tauri mock",
    },
    viewport,
    environment,
    pages,
  }, null, 2));

  expect(Object.keys(pages)).toHaveLength(5);
  expect(Object.values(pages).every((snapshot) => snapshot.pageRect && snapshot.surfaceRect)).toBe(true);
  expect(Object.values(pages).every((snapshot) => snapshot.scrollWidth <= viewport.width)).toBe(true);
});

test("Night Valley baseline checks native-size and desktop-scale proxies", async ({ browser }) => {
  test.setTimeout(120_000);
  const cases = [
    { id: "default-window", width: 1440, height: 1024, deviceScaleFactor: 1, source: "Tauri default window" },
    { id: "configured-minimum", width: 1120, height: 760, deviceScaleFactor: 1, source: "Tauri configured minimum" },
    { id: "maximized-proxy", width: 1920, height: 1080, deviceScaleFactor: 1, source: "desktop maximized proxy" },
    { id: "scale-125-proxy", width: 1440, height: 1024, deviceScaleFactor: 1.25, source: "125% DPR proxy" },
    { id: "scale-150-proxy", width: 1440, height: 1024, deviceScaleFactor: 1.5, source: "150% DPR proxy" },
    { id: "scale-200-proxy", width: 1440, height: 1024, deviceScaleFactor: 2, source: "200% DPR proxy" },
  ];
  const results = [];

  for (const testCase of cases) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: testCase.deviceScaleFactor,
    });
    const page = await context.newPage();

    try {
      await bootTodayReferenceMock(page);
      const pages = {};
      for (const [label, surfaceSelector] of nightValleyPages) {
        await pageButton(page, label).click();
        const measurement = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          const rect = element?.getBoundingClientRect();
          return {
            scrollWidth: document.documentElement.scrollWidth,
            right: rect ? Number(rect.right.toFixed(2)) : null,
            left: rect ? Number(rect.left.toFixed(2)) : null,
            devicePixelRatio: window.devicePixelRatio,
          };
        }, surfaceSelector);
        expect(measurement.right).not.toBeNull();
        expect(measurement.left).toBeGreaterThanOrEqual(0);
        expect(measurement.right).toBeLessThanOrEqual(testCase.width);
        expect(measurement.scrollWidth).toBeLessThanOrEqual(testCase.width);
        pages[label] = measurement;
      }
      results.push({ ...testCase, pages });
    } finally {
      await context.close();
    }
  }

  mkdirSync(baselineDirectory, { recursive: true });
  writeFileSync(`${baselineDirectory}/scale-matrix.json`, JSON.stringify({
    taskId: "NV-04",
    sha: baselineSha,
    capturedAt: new Date().toISOString(),
    fixture: { referenceDate, transport: "Chromium + Tauri mock" },
    note: "DPR proxies are not a substitute for changing native Windows display scaling; current host registry records 150% (LogPixels=144).",
    cases: results,
  }, null, 2));

  expect(results).toHaveLength(cases.length);
});

test("Night Valley records explain the natural seven-day range and averages", async ({ page }) => {
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.locator(".nv-records-chart__labels")).toContainText("最近 7 天");
  await expect(page.locator(".nv-records-range")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出记录", exact: true })).toHaveCount(0);
  await expect(page.locator(".nv-records-trend h2")).toHaveText("最近 7 天，平均每天 00:45:00。");
  await expect(page.locator(".records-archive__stats")).toContainText("活跃日平均 00:35:00");

  const archiveLayout = await page.locator(".records-archive__summary, .records-archive__timeline, .records-archive__stats, .records-archive__body").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: rect.width,
      height: rect.height,
      opacity: style.opacity,
      visibility: style.visibility,
    };
  }));
  expect(archiveLayout).toHaveLength(4);
  expect(archiveLayout.every((section) => section.width > 0 && section.height > 0 && section.opacity !== "0" && section.visibility !== "hidden")).toBe(true);
});

test("Night Valley keeps one shared brand mark across every page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await bootTodayReferenceMock(page);

  const brandStates = [];
  for (const label of ["今日", "计时", "待办", "记录", "设置"]) {
    await page.locator(".minimal-nav > button").filter({ hasText: label }).click();
    brandStates.push(await page.locator(".trail-nav__brand").evaluate((brand) => {
      const ring = brand.querySelector(".trail-nav__logo-ring");
      const dot = brand.querySelector(".trail-nav__logo-dot");
      const brandStyle = getComputedStyle(brand);
      const ringStyle = getComputedStyle(ring);
      const ringRect = ring.getBoundingClientRect();
      const dotRect = dot.getBoundingClientRect();
      const ringCenterX = ringRect.left + ringRect.width / 2;
      const ringCenterY = ringRect.top + ringRect.height / 2;
      const dotCenterX = dotRect.left + dotRect.width / 2;
      const dotCenterY = dotRect.top + dotRect.height / 2;
      const dotAngle = (Math.atan2(dotCenterX - ringCenterX, ringCenterY - dotCenterY) * 180) / Math.PI;
      return {
        text: brand.textContent?.replace(/\s+/g, "").trim(),
        brandGap: brandStyle.gap,
        brandTextTransform: brandStyle.textTransform,
        ringBackground: ringStyle.backgroundImage,
        ringMask: ringStyle.maskImage,
        dotAngle,
      };
    }));
  }

  expect(new Set(brandStates.map((state) => state.text))).toEqual(new Set(["FocusedMoment"]));
  expect(new Set(brandStates.map((state) => state.brandGap))).toEqual(new Set(["17px"]));
  expect(new Set(brandStates.map((state) => state.brandTextTransform))).toEqual(new Set(["none"]));
  expect(new Set(brandStates.map((state) => state.ringBackground)).size).toBe(1);
  expect(new Set(brandStates.map((state) => state.ringMask)).size).toBe(1);
  expect(brandStates.every((state) => state.ringBackground.includes("from 28deg"))).toBe(true);
  expect(brandStates.every((state) => state.dotAngle > 28 && state.dotAngle < 82)).toBe(true);
});

test("Night Valley uses one shared sidebar tab module across every page", async ({ page }) => {
  await page.setViewportSize({ width: 1082, height: 720 });
  await bootTodayReferenceMock(page);

  const tabStates = [];
  for (const label of ["今日", "计时", "待办", "记录", "设置"]) {
    await page.locator(".minimal-nav > button").filter({ hasText: label }).click();
    tabStates.push(await page.locator(".minimal-nav").evaluate((nav) => {
      const navStyle = getComputedStyle(nav);
      const buttons = [...nav.querySelectorAll(":scope > button")];
      return {
        width: navStyle.width,
        activeIndex: buttons.findIndex((button) => button.classList.contains("active")),
        buttons: buttons.map((button) => {
          const style = getComputedStyle(button);
          const icon = button.querySelector(".trail-nav__icon");
          const iconStyle = icon ? getComputedStyle(icon) : null;
          return {
            borderRadius: style.borderRadius,
            display: style.display,
            iconDisplay: iconStyle?.display,
            iconWidth: iconStyle?.width,
            iconHeight: iconStyle?.height,
            backgroundImage: style.backgroundImage,
          };
        }),
      };
    }));
  }

  expect(new Set(tabStates.map((state) => state.width))).toEqual(new Set(["130px"]));
  expect(tabStates.map((state) => state.activeIndex)).toEqual([0, 1, 2, 3, 4]);
  expect(tabStates.every((state) => state.buttons.every((button) => button.display === "flex"))).toBe(true);
  expect(tabStates.every((state) => state.buttons.every((button) => button.iconDisplay !== "none"))).toBe(true);
  expect(tabStates.every((state) => state.buttons.every((button) => button.iconWidth === "22px" && button.iconHeight === "22px"))).toBe(true);
  expect(tabStates.every((state) => state.buttons[state.activeIndex].borderRadius === "28px")).toBe(true);
  expect(tabStates.every((state) => state.buttons[state.activeIndex].backgroundImage.includes("linear-gradient"))).toBe(true);
});

test("Timer workspace keeps orientation useful and removes decorative state chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".nv-focus-brief")).toBeVisible();
  await expect(page.locator(".nv-focus-panel")).toBeVisible();
  await expect(page.locator(".nv-focus-route")).toHaveCount(0);
  await expect(page.locator(".nv-focus-instrument")).toHaveCount(0);
  await expect(page.locator(".nv-focus-footer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "25 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "45 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "60 分钟", exact: true })).toBeVisible();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("未开始");
});

test("Theme registry exposes five implemented surfaces and no disabled preview", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();

  const themeCards = page.locator(".nv-theme-card");
  await expect(themeCards).toHaveCount(5);
  await expect(themeCards.filter({ hasText: "夜谷" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "夜谷" })).toHaveAttribute("aria-pressed", "true");
  await expect(themeCards.filter({ hasText: "编辑纸页" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "石墨控制台" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "极光海面" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "植物书房" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "尚未实现" })).toHaveCount(0);
  await expect(themeCards.locator("img")).toHaveCount(5);

  await themeCards.filter({ hasText: "编辑纸页" }).click({ force: true });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  await expect(page.locator(".ep-theme-swatch").filter({ hasText: "编辑纸页" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ep-settings-page")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("focused-moment.theme"))).toBe("editorial-paper");
  await page.reload();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  await expect(page.getByRole("heading", { name: "今日节奏" })).toBeVisible();
});

test("Graphite Console can be selected from settings and persists after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".nv-theme-card").filter({ hasText: "石墨控制台" }).click({ force: true });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
  await expect(page.locator(".gc-settings-page")).toBeVisible();
  await page.getByRole("button", { name: /APPLY \/ 保存更改/ }).click();
  await expect(page.locator(".app-message--success")).toContainText("下次启动会继续使用");

  await page.reload();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
  await expect(page.getByRole("heading", { name: "TODAY / 节奏调度" })).toBeVisible();
});

test("an invalid persisted theme keeps the Night Valley surface available", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "not-a-real-theme");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await expect(page.locator(".theme-surface-unavailable")).toHaveCount(0);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.locator(".nv-theme-card").filter({ hasText: "夜谷" })).toHaveAttribute("aria-pressed", "true");
});

test("Botanical Library persists as an implemented theme before rendering a page", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "botanical-library");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "GROWTH / 今日生长" });

  await expect(page.getByRole("heading", { name: "GROWTH / 今日生长" })).toBeVisible();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "botanical-library");
  await expect(page.locator(".bl-today-page")).toBeVisible();
  await expect(page.locator(".theme-surface-unavailable")).toHaveCount(0);
});

test("Graphite Console renders all five pages inside the control surface", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "graphite-console");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "TODAY / 节奏调度" });
  mkdirSync(graphiteDirectory, { recursive: true });

  const pages = [
    ["今日", ".gc-today-page", "today.png"],
    ["计时", ".gc-focus-page", "focus.png"],
    ["待办", ".gc-todos-page", "todos.png"],
    ["记录", ".gc-records-page", "records.png"],
    ["设置", ".gc-settings-page", "settings.png"],
  ];
  const geometry = {};
  for (const [label, selector, screenshot] of pages) {
    if (label !== "今日") {
      await pageButton(page, label).click();
    }
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    geometry[label] = await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: Number(rect.x.toFixed(2)), y: Number(rect.y.toFixed(2)), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), right: Number(rect.right.toFixed(2)) };
    });
    expect(geometry[label].width).toBeGreaterThan(600);
    expect(geometry[label].right).toBeLessThanOrEqual(1487);
    await page.screenshot({ path: `${graphiteDirectory}/${screenshot}`, animations: "disabled", fullPage: true });
  }
  await pageButton(page, "今日").click();
  await expect(page.locator(".gc-sequence-row")).toHaveCount(7);
  await expect(page.locator(".gc-sequence-row--empty")).toHaveCount(6);
  await expect(page.locator(".gc-status-strip")).toContainText("STORE");
  await expect(page.locator(".minimal-nav > button.active")).toHaveCSS("border-radius", "0px");

  await pageButton(page, "待办").click();
  await expect(page.locator(".gc-task-bays > .gc-task-bay")).toHaveCount(3);
  const addTaskBox = await page.getByRole("button", { name: /ADD TASK/ }).boundingBox();
  expect(addTaskBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThan(220);
  writeFileSync(`${graphiteDirectory}/geometry.json`, JSON.stringify({ viewport: { width: 1487, height: 1058 }, pages: geometry }, null, 2));
});

test("Graphite Console keeps shared actions and page bounds usable at pressure widths", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "graphite-console");
  });

  for (const [width, height] of [[1120, 760], [820, 720], [560, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "TODAY / 节奏调度" });
    const pages = [
      ["今日", ".gc-today-page"],
      ["计时", ".gc-focus-page"],
      ["待办", ".gc-todos-page"],
      ["记录", ".gc-records-page"],
      ["设置", ".gc-settings-page"],
    ];

    for (const [label, selector] of pages) {
      if (label !== "今日") {
        await pageButton(page, label).click();
      }
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      const bounds = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { right: rect.right, width: rect.width, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(bounds.right).toBeLessThanOrEqual(width + 1);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(width + 1);
    }

    await pageButton(page, "今日").click();
    await page.getByRole("button", { name: /START \/ 开始专注/ }).click();
    await expect(page.locator(".gc-focus-page")).toBeVisible();
    await page.locator(".gc-focus-page").getByRole("button", { name: /开始专注/ }).click();
    await expect(page.locator(".gc-focus-page")).toContainText("运行中");
  }
});

test("Aurora Ocean renders all five pages inside the light field", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "aurora-ocean");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "TIDE / 潮汐轨迹" });
  mkdirSync(auroraDirectory, { recursive: true });

  const pages = [
    ["今日", ".ao-today-page", "today.png"],
    ["计时", ".ao-focus-page", "focus.png"],
    ["待办", ".ao-todos-page", "todos.png"],
    ["记录", ".ao-records-page", "records.png"],
    ["设置", ".ao-settings-page", "settings.png"],
  ];
  const geometry = {};
  for (const [label, selector, screenshot] of pages) {
    if (label !== "今日") {
      await pageButton(page, label).click();
    }
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    if (label === "今日") await expect(page.locator(".ao-orbit-stage")).toBeVisible();
    if (label === "计时") await expect(page.locator(".ao-fluid-timer")).toBeVisible();
    if (label === "待办") await expect(page.locator(".ao-reef-board")).toBeVisible();
    if (label === "记录") await expect(page.locator(".ao-archive-chart")).toBeVisible();
    if (label === "设置") await expect(page.locator(".ao-settings-preview")).toBeVisible();
    geometry[label] = await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: Number(rect.x.toFixed(2)), y: Number(rect.y.toFixed(2)), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), right: Number(rect.right.toFixed(2)) };
    });
    expect(geometry[label].width).toBeGreaterThan(600);
    expect(geometry[label].right).toBeLessThanOrEqual(1487);
    await page.screenshot({ path: `${auroraDirectory}/${screenshot}`, animations: "disabled", fullPage: true });
  }
  writeFileSync(`${auroraDirectory}/geometry.json`, JSON.stringify({ viewport: { width: 1487, height: 1058 }, pages: geometry }, null, 2));
});

test("Aurora Ocean keeps shared actions and page bounds usable at pressure widths", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "aurora-ocean");
  });

  for (const [width, height] of [[1120, 760], [820, 720], [560, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "TIDE / 潮汐轨迹" });
    const pages = [
      ["今日", ".ao-today-page"],
      ["计时", ".ao-focus-page"],
      ["待办", ".ao-todos-page"],
      ["记录", ".ao-records-page"],
      ["设置", ".ao-settings-page"],
    ];

    for (const [label, selector] of pages) {
      if (label !== "今日") {
        await pageButton(page, label).click();
      }
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      const bounds = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { right: rect.right, width: rect.width, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(bounds.right).toBeLessThanOrEqual(width + 1);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(width + 1);
    }

    await pageButton(page, "今日").click();
    await page.getByRole("button", { name: /START \/ 开始专注/ }).click();
    await expect(page.locator(".ao-focus-page")).toBeVisible();
    await page.locator(".ao-focus-page").getByRole("button", { name: /开始专注/ }).click();
    await expect(page.locator(".ao-focus-page")).toContainText("运行中");
  }
});

test("Botanical Library renders all five pages inside the reading room", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "botanical-library");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "GROWTH / 今日生长" });
  mkdirSync(botanicalDirectory, { recursive: true });

  const pages = [
    ["今日", ".bl-today-page", "today.png"],
    ["计时", ".bl-focus-page", "focus.png"],
    ["待办", ".bl-todos-page", "todos.png"],
    ["记录", ".bl-records-page", "records.png"],
    ["设置", ".bl-settings-page", "settings.png"],
  ];
  const geometry = {};
  for (const [label, selector, screenshot] of pages) {
    if (label !== "今日") {
      await pageButton(page, label).click();
    }
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    if (label === "今日") await expect(page.locator(".bl-library-stilllife")).toBeVisible();
    if (label === "计时") await expect(page.locator(".bl-tree-dial")).toBeVisible();
    if (label === "待办") await expect(page.locator(".bl-desk-board")).toBeVisible();
    if (label === "记录") await expect(page.locator(".bl-growth-chart")).toBeVisible();
    if (label === "设置") await expect(page.locator(".bl-preview-room")).toBeVisible();
    geometry[label] = await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: Number(rect.x.toFixed(2)), y: Number(rect.y.toFixed(2)), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), right: Number(rect.right.toFixed(2)) };
    });
    expect(geometry[label].width).toBeGreaterThan(600);
    expect(geometry[label].right).toBeLessThanOrEqual(1487);
    await page.screenshot({ path: `${botanicalDirectory}/${screenshot}`, animations: "disabled", fullPage: true });
  }
  writeFileSync(`${botanicalDirectory}/geometry.json`, JSON.stringify({ viewport: { width: 1487, height: 1058 }, pages: geometry }, null, 2));
});

test("Botanical Library keeps shared actions and page bounds usable at pressure widths", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "botanical-library");
  });

  for (const [width, height] of [[1120, 760], [820, 720], [560, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "GROWTH / 今日生长" });
    const pages = [
      ["今日", ".bl-today-page"],
      ["计时", ".bl-focus-page"],
      ["待办", ".bl-todos-page"],
      ["记录", ".bl-records-page"],
      ["设置", ".bl-settings-page"],
    ];

    for (const [label, selector] of pages) {
      if (label !== "今日") {
        await pageButton(page, label).click();
      }
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      const bounds = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { right: rect.right, width: rect.width, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(bounds.right).toBeLessThanOrEqual(width + 1);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(width + 1);
    }

    await pageButton(page, "今日").click();
    await page.getByRole("button", { name: /START \/ 开始专注/ }).click();
    await expect(page.locator(".bl-focus-page")).toBeVisible();
    await page.locator(".bl-focus-page").getByRole("button", { name: /开始专注/ }).click();
    await expect(page.locator(".bl-focus-page")).toContainText("运行中");
  }
});

test("Editorial Paper renders all five pages inside the desktop surface", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  mkdirSync(editorialDirectory, { recursive: true });

  const pages = [
    ["今日", ".ep-today-page", "today.png"],
    ["计时", ".ep-focus-page", "focus.png"],
    ["待办", ".ep-todos-page", "todos.png"],
    ["记录", ".ep-records-page", "records.png"],
    ["设置", ".ep-settings-page", "settings.png"],
  ];
  const geometry = {};
  for (const [label, selector, screenshot] of pages) {
    if (label !== "今日") {
      await pageButton(page, label).click();
    }
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    geometry[label] = await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), right: Number(rect.right.toFixed(2)) };
    });
    expect(geometry[label].width).toBeGreaterThan(600);
    expect(geometry[label].right).toBeLessThanOrEqual(1487);
    await page.screenshot({ path: `${editorialDirectory}/${screenshot}`, animations: "disabled", fullPage: true });
  }
  writeFileSync(`${editorialDirectory}/geometry.json`, JSON.stringify({ viewport: { width: 1487, height: 1058 }, pages: geometry }, null, 2));
});

test("REFINE-19 TODAY-01 keeps Editorial Paper long node text readable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, {
    expectedHeading: "今日节奏",
    todoTitles: [
      "这是一个用于复现今日节点信息被截断的超长任务名称需要完整显示给用户阅读并且不能因为单行省略而丢失后半段语义",
      "第二条同样很长的任务标题用来确认多条节点在纸页中仍然保留完整语义信息即使窗口变窄也应该可以继续阅读",
      "短任务",
    ],
    completedTodoTitles: ["已经完成但仍应保留在今日页中的长任务记录不能只显示一小段"],
  });

  const readEvidence = () => page.locator(".ep-field-row").evaluateAll((rows) => rows.map((row) => {
    const title = row.querySelector(".ep-field-row__copy strong");
    if (!title) return null;
    const style = getComputedStyle(title);
    return {
      text: title.textContent,
      clientWidth: title.clientWidth,
      scrollWidth: title.scrollWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  }));
  const desktopEvidence = await readEvidence();
  await page.setViewportSize({ width: 420, height: 720 });
  const narrowEvidence = await readEvidence();
  mkdirSync("output/qa/REFINE-19", { recursive: true });
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-01-after-9ecaf59-420.png", animations: "disabled", fullPage: true });
  console.log(`TODAY-01 desktop evidence: ${JSON.stringify(desktopEvidence)}`);
  console.log(`TODAY-01 narrow evidence: ${JSON.stringify(narrowEvidence)}`);
  for (const item of [...desktopEvidence, ...narrowEvidence]) {
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
    expect(item.whiteSpace).toBe("normal");
  }
});

test("REFINE-19 TODAY-02 hides the visual command trigger but keeps Ctrl+K", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const commandTrigger = page.locator(".command-trigger");
  await expect(commandTrigger).toBeHidden();
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-02-after-9ecaf59.png", animations: "disabled", fullPage: true });
  await page.keyboard.press("Escape");
});

test("REFINE-19 TODAY-03 keeps Editorial Paper Today whitespace bounded", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });

  const viewports = [[1487, 1058], [1120, 760], [820, 720], [560, 720], [420, 720]];
  const measurements = [];
  for (const [index, [width, height]] of viewports.entries()) {
    await page.setViewportSize({ width, height });
    if (index > 0) {
      await page.reload();
      await expect(page.getByRole("heading", { name: "今日节奏" })).toBeVisible();
    }
    measurements.push(await page.locator(".ep-today-page").evaluate(() => {
      const header = document.querySelector(".ep-today-header")?.getBoundingClientRect();
      const grid = document.querySelector(".ep-today-grid")?.getBoundingClientRect();
      const firstRow = document.querySelector(".ep-field-row")?.getBoundingClientRect();
      return {
        gap: Number((grid.top - header.bottom).toFixed(2)),
        gridTop: Number(grid.top.toFixed(2)),
        firstRowTop: Number(firstRow.top.toFixed(2)),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
    }));
  }
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-03-pass-9ecaf59-420.png", animations: "disabled", fullPage: true });
  console.log(`TODAY-03 measurements: ${JSON.stringify(measurements)}`);
  for (const measurement of measurements) {
    expect(measurement.gap).toBeLessThanOrEqual(32);
    expect(measurement.gridTop).toBeLessThan(measurement.viewportHeight);
    expect(measurement.firstRowTop).toBeLessThan(measurement.viewportHeight);
    expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.viewportWidth);
  }
});

test("REFINE-19 TODAY-04 keeps timer work in the Editorial Paper focus page", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const timerStrip = page.locator(".ep-today-timer-strip");
  await expect(timerStrip).toHaveCount(0);
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-04-after-9ecaf59.png", animations: "disabled", fullPage: true });
  await page.locator(".ep-next-card").getByRole("button", { name: /开始专注/ }).click();
  await expect(page.locator(".ep-focus-page")).toBeVisible();
  await expect(page.locator(".ep-focus-page").getByRole("button", { name: "开始专注", exact: true })).toBeVisible();
  await page.locator(".ep-focus-page").getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(page.locator(".ep-clock-card")).toContainText("倒计时中");
});

test("REFINE-19 TODAY-05 keeps Editorial Paper Today summary within the viewport", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 2560, height: 1368 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });

  const viewports = [[2560, 1368], [1707, 912], [1487, 1058]];
  const measurements = [];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`)).toBe(`${width}x${height}`);
    const expectedGap = width >= 821 && height <= 1100 ? "14px" : "22px";
    await expect.poll(() => page.locator(".ep-today-page").evaluate((element) => getComputedStyle(element).gap)).toBe(expectedGap);
    measurements.push(await page.locator(".ep-today-page").evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)), height: Number(rect.height.toFixed(2)) };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        sheetFooter: read(".ep-sheet-footer"),
        header: read(".ep-today-header"),
        grid: read(".ep-today-grid"),
        fieldSheet: read(".ep-field-sheet"),
        nextCard: read(".ep-next-card"),
        facts: read(".ep-facts-row"),
        factsActions: read(".ep-facts-row__actions"),
      };
    }));
  }
  mkdirSync("output/qa/REFINE-19", { recursive: true });
  await page.setViewportSize({ width: 1707, height: 912 });
  await expect.poll(() => page.locator(".ep-today-page").evaluate((element) => getComputedStyle(element).gap)).toBe("14px");
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-05-after-9ecaf59-1707x912.png", animations: "disabled" });
  console.log(`TODAY-05 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    expect(item.documentScrollWidth).toBeLessThanOrEqual(item.viewport.width);
    for (const selector of ["sheetFooter", "facts", "factsActions", "nextCard"]) {
      expect(item[selector].bottom).toBeLessThanOrEqual(item.viewport.height);
    }
  }
});

test("REFINE-19 TODAY-05 keeps the summary in document flow with long todo data", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const longTodoTitles = Array.from({ length: 21 }, (_, index) => `活动${String(index + 1).padStart(2, "0")}｜10月${(index % 9) + 1}日 10:00-12:00｜仙林校区会议与材料准备`);
  const completedTodoTitles = Array.from({ length: 5 }, (_, index) => `已完成事项${index + 1}｜跨页面长标题压力数据｜归档复盘`);
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: longTodoTitles, completedTodoTitles });
    const evidence = await page.locator(".ep-today-page").evaluate(() => {
      const facts = document.querySelector(".ep-facts-row")?.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        documentScrollHeight: document.documentElement.scrollHeight,
        facts: facts ? { top: facts.top, bottom: facts.bottom, height: facts.height } : null,
        rows: document.querySelectorAll(".ep-field-row").length,
      };
    });
    expect(evidence.rows).toBe(21);
    expect(evidence.facts).not.toBeNull();
    expect(evidence.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(evidence.documentScrollHeight).toBeGreaterThan(height);
    expect(evidence.facts.bottom).toBeLessThanOrEqual(evidence.documentScrollHeight);
    if (width === 1487) {
      await page.screenshot({ path: "output/qa/REFINE-19/TODAY-05-reaudit-data-1487.png", animations: "disabled", fullPage: true });
    } else {
      await page.screenshot({ path: "output/qa/REFINE-19/TODAY-05-reaudit-data-420.png", animations: "disabled", fullPage: true });
    }
  }
});

test("REFINE-19 TODAY-06 marks the Editorial Paper winding route as not applicable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await expect(page.locator(".ep-today-page")).toBeVisible();
  await expect(page.locator(".trail-map__route-line")).toHaveCount(0);
  await expect(page.locator(".ep-field-list")).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-06-not-applicable-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODAY-07 keeps the Editorial Paper bottom summary visible", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1707, height: 912 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const summary = page.locator(".ep-facts-row");
  await expect(summary).toBeVisible();
  const bounds = await summary.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-07-pass-9ecaf59-1707x912.png", animations: "disabled" });
});

test("REFINE-19 TODAY-08 marks the Editorial Paper hard route geometry as not applicable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await expect(page.locator(".ep-today-page")).toBeVisible();
  await expect(page.locator(".trail-map__route-line")).toHaveCount(0);
  await expect(page.locator(".ep-field-row").first()).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-08-not-applicable-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODAY-09 Editorial Paper Today exposes a live clock after the date", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const date = page.locator(".ep-date-time__date");
  const clock = page.locator('time[aria-label^="当前时间"]');
  await expect(date).toHaveCount(1);
  await expect(clock).toHaveCount(1);
  await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  const fonts = await page.locator(".ep-date-time").evaluate((element) => ({
    date: getComputedStyle(element.querySelector(".ep-date-time__date")).fontFamily,
    clock: getComputedStyle(element.querySelector(".ep-date-time__clock")).fontFamily,
  }));
  expect(fonts.date).not.toBe(fonts.clock);
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-09-after-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODAY-10 keeps real next-step value in the Editorial Paper side card", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const nextCard = page.locator(".ep-next-card");
  await expect(nextCard).toContainText("明日规划");
  await expect(nextCard.locator(".ep-next-card__duration strong")).toHaveText("45");
  await expect(nextCard).toContainText("今天截止");
  await expect(nextCard.getByRole("button", { name: /开始专注/ })).toHaveCount(1);
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-10-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODAY-11 records the undefined audit-plan item without inventing a UI issue", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await expect(page.locator(".ep-today-page")).toBeVisible();
  await expect(page.locator(".ep-page-header h1")).toHaveText("今日节奏");
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-11-not-applicable-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("Editorial Paper keeps shared actions and page bounds usable at pressure widths", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });

  for (const [width, height] of [[1120, 760], [820, 720], [560, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    const pages = [
      ["今日", ".ep-today-page"],
      ["计时", ".ep-focus-page"],
      ["待办", ".ep-todos-page"],
      ["记录", ".ep-records-page"],
      ["设置", ".ep-settings-page"],
    ];

    for (const [label, selector] of pages) {
      if (label !== "今日") {
        await pageButton(page, label).click();
      }
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      const bounds = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { right: rect.right, width: rect.width, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(bounds.right).toBeLessThanOrEqual(width + 1);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(width + 1);
    }

    await pageButton(page, "今日").click();
    await expect(page.locator(".ep-today-timer-strip")).toHaveCount(0);
    await page.locator(".ep-next-card").getByRole("button", { name: /开始专注/ }).click();
    await expect(page.locator(".ep-focus-page")).toBeVisible();
  }
});

test("REFINE-19 TIMER-01 gives every Editorial Paper tab the same live date and clock", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    for (const [label, selector] of [
      ["今日", ".ep-today-page"],
      ["计时", ".ep-focus-page"],
      ["待办", ".ep-todos-page"],
      ["记录", ".ep-records-page"],
      ["设置", ".ep-settings-page"],
    ]) {
      if (label !== "今日") {
        await pageButton(page, label).click();
      }
      await expect(page.locator(selector)).toBeVisible();
      const slug = label === "今日" ? "today" : label === "计时" ? "focus" : label === "待办" ? "todos" : label === "记录" ? "records" : "settings";
      const date = page.locator(".ep-date-time__date");
      const clock = page.locator('time[aria-label^="当前时间"]');
      await expect(date).toHaveCount(1);
      await expect(clock).toHaveCount(1);
      await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
      await expect(page.locator(".ep-date-time")).toBeVisible();
      const layout = await page.locator(".ep-date-time").evaluate((element) => {
        const dateRect = element.querySelector(".ep-date-time__date").getBoundingClientRect();
        const clockRect = element.querySelector(".ep-date-time__clock").getBoundingClientRect();
        const navRect = document.querySelector(".minimal-nav").getBoundingClientRect();
        return { dateRight: dateRect.right, clockLeft: clockRect.left, clockTop: clockRect.top, clockBottom: clockRect.bottom, navBottom: navRect.bottom, viewportWidth: innerWidth };
      });
      expect(layout.clockLeft).toBeGreaterThanOrEqual(layout.dateRight);
      expect(layout.clockBottom).toBeLessThanOrEqual(height);
      if (width <= 820) {
        expect(layout.clockTop).toBeGreaterThanOrEqual(layout.navBottom);
      }
      const fonts = await page.locator(".ep-date-time").evaluate((element) => ({
        date: getComputedStyle(element.querySelector(".ep-date-time__date")).fontFamily,
        clock: getComputedStyle(element.querySelector(".ep-date-time__clock")).fontFamily,
      }));
      expect(fonts.date).not.toBe(fonts.clock);
      await page.screenshot({ path: `output/qa/REFINE-19/TIMER-01-after-9ecaf59-${slug}-${width}.png`, animations: "disabled", fullPage: true });
    }
  }
});

test("REFINE-19 TIMER-02 keeps Editorial Paper timer hierarchy readable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  for (const viewport of [
    { width: 1487, height: 1058 },
    { width: 420, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    await pageButton(page, "计时").click();
    await expect(page.locator(".ep-focus-page")).toBeVisible();
    const metrics = await page.locator(".ep-focus-page").evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return rect ? { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)) } : null;
      };
      return {
        focusLayout: read(".ep-focus-layout"),
        clockCard: read(".ep-clock-card"),
        ring: read(".ep-clock-card__ring"),
        readout: read(".ep-clock-card__readout > strong"),
        primaryAction: read(".ep-clock-card__actions .ep-primary-button"),
        mode: read(".ep-clock-card__mode"),
        inlineField: read(".ep-inline-field"),
        readoutFontSize: getComputedStyle(document.querySelector(".ep-clock-card__readout > strong")).fontSize,
      };
    });
    expect(metrics.ring).not.toBeNull();
    expect(metrics.readout).not.toBeNull();
    expect(metrics.primaryAction).not.toBeNull();
    expect(metrics.mode).not.toBeNull();
    expect(metrics.inlineField).not.toBeNull();
    expect(metrics.ring.width).toBeLessThanOrEqual(Math.min(300.5, metrics.clockCard.width * 0.72 + 1));
    expect(metrics.ring.width / metrics.clockCard.width).toBeLessThanOrEqual(0.72);
    expect(Number.parseFloat(metrics.readoutFontSize)).toBeLessThanOrEqual(52);
    expect(metrics.readout.bottom).toBeLessThan(metrics.mode.top);
    expect(metrics.mode.bottom).toBeLessThan(metrics.inlineField.top);
    expect(metrics.primaryAction.bottom).toBeLessThanOrEqual(metrics.clockCard.bottom);
    await page.screenshot({ path: `output/qa/REFINE-19/TIMER-02-reaudit-pass-${viewport.width}.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 TIMER-03 keeps Editorial Paper lines semantic", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await pageButton(page, "计时").click();
  await expect(page.locator(".ep-focus-page")).toBeVisible();
  await expect(page.locator(".ep-clock-card__ring")).toBeVisible();
  await expect(page.locator(".ep-focus-footer")).toBeVisible();
  await expect(page.locator(".ep-clock-card__tick")).toHaveCount(4);
  expect(await page.locator(".ep-focus-page .trail-map__route-line").count()).toBe(0);
  expect(await page.locator(".ep-focus-page .nv-focus-route").count()).toBe(0);
  expect(await page.locator(".ep-focus-page [data-route]").count()).toBe(0);
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-03-not-applicable-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-04 keeps Editorial Paper focus content in the full-screen safe area", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 2560, height: 1368 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await pageButton(page, "计时").click();
  await expect(page.locator(".ep-focus-page")).toBeVisible();
  const measurements = [];
  for (const [width, height] of [[2560, 1368], [1707, 912], [1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    measurements.push(await page.locator(".ep-focus-page").evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)), height: Number(rect.height.toFixed(2)) };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentScrollHeight: document.documentElement.scrollHeight,
        page: read(".ep-focus-page"),
        header: read(".ep-page-header"),
        layout: read(".ep-focus-layout"),
        clockCard: read(".ep-clock-card"),
        leftNotes: read(".ep-note-stack--left"),
        rightNotes: read(".ep-focus-notes"),
        footer: read(".ep-focus-footer"),
        readout: read(".ep-clock-card__readout"),
        inlineField: read(".ep-inline-field"),
        actions: read(".ep-clock-card__actions"),
      };
    }));
  }
  mkdirSync("output/qa/REFINE-19", { recursive: true });
  await page.setViewportSize({ width: 1707, height: 912 });
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-04-pass-9ecaf59-1707x912.png", animations: "disabled" });
  console.log(`TIMER-04 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    expect(item.page).not.toBeNull();
    expect(item.header).not.toBeNull();
    expect(item.layout).not.toBeNull();
    expect(item.clockCard).not.toBeNull();
    expect(item.readout).not.toBeNull();
    expect(item.inlineField).not.toBeNull();
    expect(item.actions).not.toBeNull();
    expect(item.footer).not.toBeNull();
    expect(item.page.top).toBeGreaterThanOrEqual(0);
    expect(item.documentScrollHeight).toBeGreaterThanOrEqual(item.page.bottom);
    if (item.viewport.width >= 821) {
      expect(item.page.bottom).toBeLessThanOrEqual(item.viewport.height);
      for (const key of ["readout", "inlineField", "actions", "footer"]) {
        expect(item[key].bottom).toBeLessThanOrEqual(item.viewport.height);
      }
    }
  }
});

test("REFINE-19 TIMER-05 keeps Editorial Paper timer fields explicit", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  await expect(focusPage).toBeVisible();
  await expect(focusPage).toContainText("当前状态");
  await expect(focusPage).toContainText("正向计时");
  await expect(focusPage).toContainText("倒计时");
  await expect(focusPage).toContainText("专注时长");
  await expect(focusPage).toContainText("今日专注");
  for (const label of ["开始专注", "完成并记录", "清空设置", "我想专注于…", "关联待办", "本轮完成后同时标记关联待办"]) {
    await expect(focusPage).toContainText(label);
  }
  const noteFields = await focusPage.locator(".ep-note-paper label").evaluateAll((labels) => labels.map((label) => {
    const rect = label.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
  }));
  expect(noteFields).toHaveLength(3);
  expect(noteFields[0].bottom).toBeLessThanOrEqual(noteFields[1].top);
  expect(noteFields[1].bottom).toBeLessThanOrEqual(noteFields[2].top);
  expect(await focusPage.locator(".ep-focus-notes").locator(".ep-note-paper").count()).toBe(1);
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-05-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-06 hides the command trigger on every Editorial Paper tab", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  for (const [label, selector, slug] of [
    ["今日", ".ep-today-page", "today"],
    ["计时", ".ep-focus-page", "focus"],
    ["待办", ".ep-todos-page", "todos"],
    ["记录", ".ep-records-page", "records"],
    ["设置", ".ep-settings-page", "settings"],
  ]) {
    if (label !== "今日") await pageButton(page, label).click();
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(".command-trigger")).toBeHidden();
    await page.screenshot({ path: `output/qa/REFINE-19/TIMER-06-after-9ecaf59-${slug}.png`, animations: "disabled", fullPage: true });
  }
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("REFINE-19 TIMER-07 makes Editorial Paper focus fields drive the real timer flow", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epTimerInvoke = [];
    let syntheticSnapshot = null;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epTimerInvoke.push(command);
      if (command === "get_timer_snapshot" && syntheticSnapshot) {
        return syntheticSnapshot;
      }
      const result = await nativeInvoke(command, args);
      if (command === "start_timer" || command === "pause_timer") {
        syntheticSnapshot = { ...result, elapsedMs: 1000, elapsedLabel: "00:00:01", canCompleteSession: true, hasUnsubmittedProgress: true };
        return syntheticSnapshot;
      }
      if (command === "complete_focus_session") {
        const current = syntheticSnapshot ?? await nativeInvoke("get_timer_snapshot");
        const records = await nativeInvoke("get_focus_records");
        const todoItems = await nativeInvoke("get_todo_items");
        syntheticSnapshot = null;
        return {
          timerSnapshot: { ...current, status: "未开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:00:00", hasUnsubmittedProgress: false, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false },
          records,
          todoItems,
        };
      }
      return result;
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  const clockCard = page.locator(".ep-clock-card");
  await expect(focusPage).toBeVisible();

  await focusPage.locator('input[name="editorialSessionTitle"]').fill("整理审计证据");
  await focusPage.locator('input[name="editorialCountdownMinutes"]').fill("60");
  await expect(clockCard.locator(".ep-clock-card__readout > strong")).toHaveText("01:00:00");
  await expect(clockCard).toContainText("设定 60 分钟");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(clockCard).toContainText("倒计时中");
  await expect(clockCard.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  await expect(clockCard.getByRole("button", { name: "完成并记录", exact: true })).toBeVisible();
  await expect(focusPage.locator('input[name="editorialSessionTitle"]')).toBeDisabled();
  await expect(focusPage.locator('input[name="editorialCountdownMinutes"]')).toBeDisabled();

  await clockCard.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(clockCard).toContainText("已暂停");
  await expect(clockCard.getByRole("button", { name: "继续专注", exact: true })).toBeVisible();
  await expect(clockCard.getByRole("button", { name: "重置本次专注", exact: true })).toBeEnabled();
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-07-after-9ecaf59.png", animations: "disabled", fullPage: true });
  await expect(clockCard.getByRole("button", { name: "完成并记录", exact: true })).toBeEnabled();
  await clockCard.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect(focusPage.locator(".ep-inline-confirmation")).toContainText("这一段已经收进记录");
  const commands = await page.evaluate(() => window.__epTimerInvoke);
  expect(commands).toEqual(expect.arrayContaining(["set_countdown_minutes", "update_timer_context", "start_timer", "pause_timer", "complete_focus_session"]));
});

test("REFINE-19 TIMER-08 keeps long Editorial Paper focus-note text readable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const longTodoTitle = "整理一份很长的研究审计证据清单并确认每个字段都能被完整回看";
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: [longTodoTitle] });
    await pageButton(page, "计时").click();
    const focusPage = page.locator(".ep-focus-page");
    const notePaper = focusPage.locator(".ep-note-paper");
    await expect(notePaper).toBeVisible();
    await focusPage.locator('input[name="editorialSessionTitle"]').fill("这是一个很长的本轮专注主题用于核对右侧卡片文字换行是否会遮挡其他字段与操作");
    await focusPage.locator('select[name="editorialLinkedTodo"]').selectOption("101");
    await expect(notePaper.locator(".ep-note-paper__linked")).toContainText(longTodoTitle);
    const bounds = await notePaper.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const textBlocks = [...element.querySelectorAll("label, .ep-note-paper__linked")].map((child) => {
        const childRect = child.getBoundingClientRect();
        return { left: childRect.left, right: childRect.right, top: childRect.top, bottom: childRect.bottom, scrollWidth: child.scrollWidth, clientWidth: child.clientWidth };
      });
      return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, textBlocks, documentScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    expect(bounds.textBlocks.every((block) => block.left >= 0 && block.right <= bounds.viewportWidth + 1 && block.scrollWidth <= block.clientWidth + 1)).toBe(true);
    expect(bounds.documentScrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/qa/REFINE-19/TIMER-08-pass-9ecaf59-${width}.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 TIMER-09 makes Editorial Paper reset explicit and usable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      const result = await nativeInvoke(command, args);
      if (command === "reset_timer") {
        return { ...result, status: "未开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:45:00", targetDurationMs: 45 * 60 * 1000, remainingMs: 45 * 60 * 1000, hasUnsubmittedProgress: false, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false };
      }
      return result;
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  const clockCard = page.locator(".ep-clock-card");
  const clearSettings = clockCard.getByRole("button", { name: "清空设置", exact: true });
  await expect(clearSettings).toBeEnabled();
  await expect(clearSettings).toHaveAttribute("title", "清除当前标题、时长和待办选择");
  await focusPage.locator('input[name="editorialSessionTitle"]').fill("临时专注主题");
  await focusPage.locator('input[name="editorialCountdownMinutes"]').fill("60");
  await clearSettings.click();
  await expect(focusPage.locator('input[name="editorialSessionTitle"]')).toHaveValue("");
  await expect(focusPage.locator('input[name="editorialCountdownMinutes"]')).toHaveValue("45");
  await expect(clockCard.getByRole("button", { name: "清空设置", exact: true })).toBeEnabled();
  await expect(page.locator(".app-message")).toContainText("本轮已重置，没有生成记录");

  await focusPage.locator('input[name="editorialSessionTitle"]').fill("正式专注主题");
  await clockCard.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(clockCard.getByRole("button", { name: "重置本次专注", exact: true })).toBeEnabled();
  await expect(clockCard.getByRole("button", { name: "重置本次专注", exact: true })).toHaveAttribute("title", "放弃当前计时并清除本次专注设置");
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-09-after-active-9ecaf59.png", animations: "disabled", fullPage: true });
  await clockCard.getByRole("button", { name: "重置本次专注", exact: true }).click();
  await expect(clockCard.getByRole("button", { name: "清空设置", exact: true })).toBeEnabled();
  await expect(focusPage.locator('input[name="editorialSessionTitle"]')).toHaveValue("");
  await expect(focusPage.locator('input[name="editorialCountdownMinutes"]')).toHaveValue("45");
  await expect(page.locator(".app-message")).toContainText("本轮已重置，没有生成记录");
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-09-after-clear-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-10 keeps only real Editorial Paper shortcut guidance", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", includeTodo: false });
  await pageButton(page, "计时").click();
  await expect(page.locator(".ep-focus-footer")).not.toContainText("Ctrl");
  await expect(page.locator(".ep-focus-page kbd")).toHaveCount(0);

  await pageButton(page, "设置").click();
  const shortcuts = page.locator(".ep-settings-paper--shortcuts");
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts).toContainText("开始 / 继续");
  await expect(shortcuts).toContainText("结束本段");
  await expect(shortcuts).toContainText("命令面板");
  await expect(shortcuts.locator("kbd")).toHaveCount(7);

  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".app-message")).toContainText("先写下一件要完成的事");
  await page.keyboard.press("Control+Shift+E");
  await expect(page.locator(".app-message")).toContainText("当前还没有可以保存的专注进度");
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.keyboard.press("Escape");
  await pageButton(page, "设置").click();
  await expect(shortcuts).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-10-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-11 keeps the Editorial Paper right note readable fullscreen", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 2560, height: 1368 });
  const measurements = [];
  for (const [width, height] of [[2560, 1368], [1707, 912], [1487, 1058]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    await pageButton(page, "计时").click();
    const result = await page.locator(".ep-focus-notes").evaluate((notes) => {
      const read = (selector) => [...notes.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector, left: Number(rect.left.toFixed(2)), right: Number(rect.right.toFixed(2)), top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
      });
      const blocks = [
        ...read(".ep-note-paper > .ep-section-label"),
        ...read(".ep-note-paper > label"),
        ...read(".ep-note-paper > .ep-note-paper__linked"),
        ...read(".ep-mini-note"),
      ];
      const overlaps = [];
      for (let index = 0; index < blocks.length; index += 1) {
        for (let next = index + 1; next < blocks.length; next += 1) {
          const a = blocks[index];
          const b = blocks[next];
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push([index, next]);
        }
      }
      const notesRect = notes.getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, notes: { left: notesRect.left, right: notesRect.right, top: notesRect.top, bottom: notesRect.bottom }, blocks, overlaps, documentScrollWidth: document.documentElement.scrollWidth };
    });
    measurements.push(result);
    if (width === 1707) {
      await page.screenshot({ path: "output/qa/REFINE-19/TIMER-11-pass-9ecaf59-1707x912.png", animations: "disabled", fullPage: true });
    }
  }
  console.log(`TIMER-11 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    expect(item.notes.left).toBeGreaterThanOrEqual(0);
    expect(item.notes.right).toBeLessThanOrEqual(item.viewport.width + 1);
    expect(item.overlaps).toEqual([]);
    expect(item.documentScrollWidth).toBeLessThanOrEqual(item.viewport.width + 1);
    expect(item.blocks.every((block) => block.left >= 0 && block.right <= item.viewport.width + 1 && block.height > 0)).toBe(true);
    if (item.viewport.width >= 821) expect(item.notes.bottom).toBeLessThanOrEqual(item.viewport.height);
  }
});

test("REFINE-19 TIMER-12 keeps a 01:00:00 Editorial Paper readout away from stats", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 2560, height: 1368 });
  const measurements = [];
  for (const [width, height] of [[2560, 1368], [1707, 912], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    await pageButton(page, "计时").click();
    const focusPage = page.locator(".ep-focus-page");
    await focusPage.locator('input[name="editorialCountdownMinutes"]').fill("60");
    await expect(focusPage.locator(".ep-clock-card__readout > strong")).toHaveText("01:00:00");
    measurements.push(await focusPage.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        ring: read(".ep-clock-card__ring"),
        readout: read(".ep-clock-card__readout"),
        mode: read(".ep-clock-card__mode"),
        target: read(".ep-inline-field"),
        actions: read(".ep-clock-card__actions"),
        todayFocus: read(".ep-taped-note--sage"),
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    }));
    if (width === 1707) {
      await page.screenshot({ path: "output/qa/REFINE-19/TIMER-12-pass-9ecaf59-1707x912.png", animations: "disabled", fullPage: true });
    }
  }
  console.log(`TIMER-12 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    for (const key of ["ring", "readout", "mode", "target", "actions", "todayFocus"]) expect(item[key]).not.toBeNull();
    expect(item.readout.left).toBeGreaterThanOrEqual(item.ring.left);
    expect(item.readout.right).toBeLessThanOrEqual(item.ring.right);
    const blocks = [item.readout, item.mode, item.target, item.actions, item.todayFocus];
    for (let index = 0; index < blocks.length; index += 1) {
      for (let next = index + 1; next < blocks.length; next += 1) {
        const a = blocks[index];
        const b = blocks[next];
        expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top).toBe(false);
      }
    }
    expect(item.documentScrollWidth).toBeLessThanOrEqual(item.viewport.width + 1);
  }
});

test("REFINE-19 TIMER-13 keeps Editorial Paper status and mode copy separated", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 2560, height: 1368 });
  const measurements = [];
  for (const [width, height] of [[2560, 1368], [1707, 912], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
    await pageButton(page, "计时").click();
    const focusPage = page.locator(".ep-focus-page");
    const minutesInput = focusPage.locator('input[name="editorialCountdownMinutes"]');
    for (const [minutes, expectedReadout] of [[45, "00:45:00"], [60, "01:00:00"], [90, "01:30:00"]]) {
      await minutesInput.fill(String(minutes));
      await expect(focusPage.locator(".ep-clock-card__readout > strong")).toHaveText(expectedReadout);
      await expect(focusPage.locator(".ep-clock-card__readout > small")).toHaveText(`设定 ${minutes} 分钟`);
      measurements.push(await focusPage.evaluate(() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        return {
          viewport: { width: innerWidth, height: innerHeight },
          ring: read(".ep-clock-card__ring"),
          status: read(".ep-clock-card__readout > span"),
          readout: read(".ep-clock-card__readout > strong"),
          modeCopy: read(".ep-clock-card__readout > small"),
          modeSwitch: read(".ep-clock-card__mode"),
          target: read(".ep-inline-field"),
          actions: read(".ep-clock-card__actions"),
        };
      }));
    }
    if (width === 1707) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/TIMER-13-pass-9ecaf59-1707x912.png", animations: "disabled", fullPage: true });
    }
  }
  console.log(`TIMER-13 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    for (const key of ["ring", "status", "readout", "modeCopy", "modeSwitch", "target", "actions"]) expect(item[key]).not.toBeNull();
    expect(item.status.bottom).toBeLessThanOrEqual(item.readout.top);
    expect(item.readout.bottom).toBeLessThanOrEqual(item.modeCopy.top);
    expect(item.modeCopy.bottom).toBeLessThanOrEqual(item.ring.bottom);
    expect(item.ring.right).toBeLessThanOrEqual(item.modeSwitch.right + 6);
    expect(item.modeSwitch.bottom).toBeLessThan(item.target.top);
    expect(item.target.bottom).toBeLessThan(item.actions.top);
    expect(item.actions.right).toBeLessThanOrEqual(item.modeSwitch.right + 1);
  }
});

test("REFINE-19 TIMER-14 keeps Editorial Paper focus safe at Windows high DPI", async ({ browser }) => {
  const contexts = [
    { width: 2560, height: 1368, requestedDpr: 1, slug: "physical-2560x1368-dpr1" },
    { width: 1707, height: 912, requestedDpr: 1.5, slug: "css-1707x912-dpr1.5" },
    { width: 1487, height: 1058, requestedDpr: 1, slug: "css-1487x1058-dpr1" },
  ];
  const measurements = [];
  for (const item of contexts) {
    const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: item.requestedDpr });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        localStorage.setItem("focused-moment.theme", "editorial-paper");
      });
      await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
      await pageButton(page, "计时").click();
      const measurement = await page.locator(".ep-focus-page").evaluate(() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
          viewport: { width: innerWidth, height: innerHeight },
          dpr: devicePixelRatio,
          documentScrollWidth: document.documentElement.scrollWidth,
          page: read(".ep-focus-page"),
          clock: read(".ep-clock-card"),
          notes: read(".ep-focus-notes"),
          footer: read(".ep-focus-footer"),
        };
      });
      measurements.push({ ...item, ...measurement });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `output/qa/REFINE-19/TIMER-14-pass-9ecaf59-${item.slug}.png`, animations: "disabled", fullPage: true });
    } finally {
      await context.close();
    }
  }
  console.log(`TIMER-14 measurements: ${JSON.stringify(measurements)}`);
  for (const item of measurements) {
    expect(item.viewport.width).toBe(item.width);
    expect(item.viewport.height).toBe(item.height);
    expect(item.dpr).toBe(item.requestedDpr);
    expect(item.documentScrollWidth).toBeLessThanOrEqual(item.viewport.width + 1);
    for (const key of ["page", "clock", "notes", "footer"]) {
      expect(item[key]).not.toBeNull();
      expect(item[key].left).toBeGreaterThanOrEqual(0);
      expect(item[key].right).toBeLessThanOrEqual(item.viewport.width + 1);
      expect(item[key].bottom).toBeLessThanOrEqual(item.viewport.height);
    }
  }
});

test("REFINE-19 TIMER-15 uses the same daily session count on Today and Focus", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 1, completedTodoTitles: [] });
  const today = page.locator(".ep-today-page");
  await expect(today.locator(".ep-facts-row > div:nth-child(2) strong")).toHaveText("1");
  await pageButton(page, "计时").click();
  const focus = page.locator(".ep-focus-page");
  await expect(focus.locator(".ep-taped-note--sage strong")).toHaveText("1 段完成");
  await expect(focus.locator(".ep-taped-note--sage")).toContainText("今日专注");
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-15-after-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-16 restores the Editorial Paper floating entry after returning", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epFloatingCalls = 0;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === "show_focus_floating") window.__epFloatingCalls += 1;
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  await focusPage.locator('input[name="editorialSessionTitle"]').fill("返回主界面后继续核对悬浮窗入口");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(focusPage).toContainText("倒计时中");

  const floatingEntry = focusPage.getByRole("button", { name: "进入悬浮窗", exact: true });
  await expect(floatingEntry).toBeVisible();
  await expect(floatingEntry).toHaveAttribute("title", "隐藏主窗口，回到悬浮计时");
  const callsBeforeReturn = await page.evaluate(() => window.__epFloatingCalls);
  await floatingEntry.click();
  await expect.poll(() => page.evaluate(() => window.__epFloatingCalls)).toBe(callsBeforeReturn + 1);
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-16-after-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-17 still opens the floating timer after Editorial Paper starts", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epFloatingCalls = 0;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === "show_focus_floating") window.__epFloatingCalls += 1;
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  await focusPage.locator('input[name="editorialSessionTitle"]').fill("核对开始后的悬浮计时状态");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(focusPage).toContainText("倒计时中");
  await expect.poll(() => page.evaluate(() => window.__epFloatingCalls)).toBe(1);
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-17-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-18 delegates main-window hiding to the focus floating command", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epWindowCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epWindowCommands.push(command);
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  await focusPage.locator('input[name="editorialSessionTitle"]').fill("核对主窗口自动隐藏调用链");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(focusPage).toContainText("倒计时中");
  await expect.poll(() => page.evaluate(() => window.__epWindowCommands.includes("show_focus_floating"))).toBe(true);
  const commands = await page.evaluate(() => window.__epWindowCommands);
  expect(commands.filter((command) => command === "show_focus_floating")).toHaveLength(1);
  expect(commands).not.toContain("hide_main_window");
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-18-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-19 keeps the floating entry visible and clickable in Editorial Paper focus states", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epFloatingCalls = 0;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === "show_focus_floating") window.__epFloatingCalls += 1;
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  const clockCard = page.locator(".ep-clock-card");
  await focusPage.locator('input[name="editorialSessionTitle"]').fill("核对悬浮窗入口首屏可达性");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(focusPage).toContainText("倒计时中");
  const floatingEntry = focusPage.getByRole("button", { name: "进入悬浮窗", exact: true });
  await expect(floatingEntry).toBeVisible();
  const firstScreenBounds = await floatingEntry.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
  });
  expect(firstScreenBounds.top).toBeGreaterThanOrEqual(0);
  expect(firstScreenBounds.bottom).toBeLessThanOrEqual(firstScreenBounds.viewportHeight);
  const callsAfterStart = await page.evaluate(() => window.__epFloatingCalls);
  await floatingEntry.click();
  await expect.poll(() => page.evaluate(() => window.__epFloatingCalls)).toBe(callsAfterStart + 1);

  await clockCard.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(clockCard).toContainText("已暂停");
  await expect(floatingEntry).toBeVisible();
  await floatingEntry.click();
  await expect.poll(() => page.evaluate(() => window.__epFloatingCalls)).toBe(callsAfterStart + 2);
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-19-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-20 keeps Editorial Paper timer and interface state synchronized", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    let timerOverride = null;
    window.__epTimerInvoke = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epTimerInvoke.push(command);
      if (command === "get_timer_snapshot" && timerOverride) return timerOverride;
      const result = await nativeInvoke(command, args);
      if (command === "set_countdown_minutes" || command === "update_timer_context") {
        timerOverride = result;
        return timerOverride;
      }
      if (command === "start_timer" || command === "pause_timer") {
        timerOverride = { ...result, elapsedMs: 1000, elapsedLabel: "00:00:01", canCompleteSession: true, hasUnsubmittedProgress: true };
        return timerOverride;
      }
      if (command === "complete_focus_session") {
        const current = timerOverride ?? await nativeInvoke("get_timer_snapshot");
        const records = await nativeInvoke("get_focus_records");
        const todoItems = await nativeInvoke("get_todo_items");
        timerOverride = { ...current, status: "未开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:00:00", hasUnsubmittedProgress: false, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, canCompleteSession: false };
        return { timerSnapshot: timerOverride, records, todoItems };
      }
      if (command === "reset_timer") {
        timerOverride = { ...result, status: "未开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:45:00", hasUnsubmittedProgress: false, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, canCompleteSession: false };
        return timerOverride;
      }
      return result;
    };
  });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  const clockCard = page.locator(".ep-clock-card");
  const titleInput = focusPage.locator('input[name="editorialSessionTitle"]');
  await titleInput.fill("逐步核对计时和界面状态");
  await focusPage.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(clockCard).toContainText("倒计时中");
  await expect(clockCard.getByRole("button", { name: "暂停", exact: true })).toBeVisible();

  await clockCard.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(clockCard).toContainText("已暂停");
  await expect(clockCard.getByRole("button", { name: "继续专注", exact: true })).toBeVisible();

  await clockCard.getByRole("button", { name: "继续专注", exact: true }).click();
  await expect(clockCard).toContainText("倒计时中");
  await expect(clockCard.getByRole("button", { name: "暂停", exact: true })).toBeVisible();

  await pageButton(page, "今日").click();
  await expect(page.locator(".ep-today-page")).toBeVisible();
  await pageButton(page, "计时").click();
  await expect(focusPage).toContainText("倒计时中");
  await expect(titleInput).toBeDisabled();
  await expect(titleInput).toHaveValue("逐步核对计时和界面状态");

  await clockCard.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect(focusPage.locator(".ep-inline-confirmation")).toContainText("这一段已经收进记录");
  await expect(clockCard).toContainText("未开始");
  await expect(clockCard.getByRole("button", { name: "开始专注", exact: true })).toBeVisible();
  await expect(titleInput).toBeEnabled();
  await expect(titleInput).toHaveValue("");
  await expect(focusPage.locator(".ep-focus-floating-link")).toHaveCount(0);

  await titleInput.fill("再次开始后测试重置");
  await clockCard.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(clockCard).toContainText("倒计时中");
  await clockCard.getByRole("button", { name: "重置本次专注", exact: true }).click();
  await expect(clockCard).toContainText("未开始");
  await expect(titleInput).toHaveValue("");
  await expect(clockCard.getByRole("button", { name: "开始专注", exact: true })).toBeVisible();
  await expect(page.locator(".app-message")).toContainText("本轮已重置，没有生成记录");

  const commands = await page.evaluate(() => window.__epTimerInvoke);
  expect(commands).toEqual(expect.arrayContaining(["start_timer", "pause_timer", "complete_focus_session", "reset_timer"]));
  await page.reload();
  await expect(page.getByRole("heading", { name: "今日节奏" })).toBeVisible();
  await pageButton(page, "计时").click();
  await expect(page.locator(".ep-clock-card")).toContainText("待开始");
  await expect(page.locator('input[name="editorialSessionTitle"]')).toHaveValue("");
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-20-pass-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TIMER-21 records when the Editorial Paper focus page has no matching records button", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await pageButton(page, "计时").click();
  const focusPage = page.locator(".ep-focus-page");
  await expect(focusPage).toBeVisible();
  await expect(focusPage.getByRole("button", { name: "查看专注记录", exact: true })).toHaveCount(0);
  await expect(focusPage).not.toContainText("查看专注记录");
  await pageButton(page, "今日").click();
  await expect(page.getByRole("button", { name: "回看记录", exact: true })).toBeVisible();
  await pageButton(page, "计时").click();
  await page.screenshot({ path: "output/qa/REFINE-19/TIMER-21-not-applicable-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODO-01 checks Editorial Paper todo columns for overlap, bounded whitespace, and clear states", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const longTitles = [
    "整理一份跨团队研究审计证据清单并确认每个字段都能被完整回看",
    "完成下一版产品复盘并把关键决策和待验证假设写进记录",
    "准备发布前的最后检查并逐项核对 Windows 构建与安装包",
  ];
  const completedTitles = [
    "回顾昨天的专注记录并标记已经完成的关键事项",
    "收束本周的研究资料并整理成可以复用的索引",
  ];
  for (const [width, height] of [[1487, 1058], [1120, 760], [820, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: longTitles, completedTodoTitles: completedTitles });
    await pageButton(page, "待办").click();
    const todoPage = page.locator(".ep-todos-page");
    await expect(todoPage).toBeVisible();
    const metrics = await todoPage.evaluate(() => {
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const columns = [...document.querySelectorAll(".ep-todo-column")].map((column) => {
        const columnRect = column.getBoundingClientRect();
        const list = column.querySelector(".ep-todo-column__list");
        const listRect = list.getBoundingClientRect();
        const content = [...column.querySelectorAll("header span, header h2, header strong, .ep-todo-row__copy strong, .ep-todo-row__copy small, .ep-todo-row__actions, .ep-empty, .ep-empty-card strong, .ep-empty-card small")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim() ?? "", left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        });
        const overlaps = [];
        for (let index = 0; index < content.length; index += 1) {
          for (let next = index + 1; next < content.length; next += 1) {
            if (overlap(content[index], content[next])) overlaps.push([index, next]);
          }
        }
        return { className: column.className, column: { left: columnRect.left, right: columnRect.right, top: columnRect.top, bottom: columnRect.bottom }, list: { top: listRect.top, bottom: listRect.bottom, height: listRect.height, scrollHeight: list.scrollHeight }, rows: column.querySelectorAll(".ep-todo-row").length, content, overlaps };
      });
      return { viewport: { width: innerWidth, height: innerHeight }, documentScrollWidth: document.documentElement.scrollWidth, columns };
    });
    console.log(`TODO-01 ${width}x${height}: ${JSON.stringify(metrics)}`);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(metrics.columns).toHaveLength(3);
    for (const column of metrics.columns) {
      expect(column.column.left).toBeGreaterThanOrEqual(0);
      expect(column.column.right).toBeLessThanOrEqual(width + 1);
      expect(column.overlaps).toEqual([]);
      expect(column.content.every((item) => item.width >= 0 && item.height >= 0 && item.left >= 0 && item.right <= width + 1)).toBe(true);
      expect(column.list.top).toBeGreaterThanOrEqual(column.column.top);
      if (column.className.includes("ep-todo-column--focus")) expect(column.list.height).toBeLessThan(230);
      expect(column.column.bottom - column.list.bottom).toBeLessThanOrEqual(35);
    }
    await expect(todoPage.locator(".ep-todo-column--today header")).toContainText("今天");
    await expect(todoPage.locator(".ep-todo-column--focus .ep-empty-card")).toContainText("还没有进行中的事项");
    await expect(todoPage.locator(".ep-todo-column--done header")).toContainText("已完成");
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/TODO-01-after-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODO-02 keeps a long completed todo list visible and actionable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const completedTitles = Array.from({ length: 18 }, (_, index) => `已完成事项 ${String(index + 1).padStart(2, "0")}：整理一份可以长期回看的研究与发布证据清单`);
  const restoredTitle = completedTitles[0];
  const editedTitle = "已编辑的长完成事项：把恢复、编辑和删除动作留在同一张纸上";
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: ["待恢复的事项", "保留的待开始事项"], completedTodoTitles: completedTitles });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    let todoOverride = null;
    window.__epTodoCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epTodoCommands.push(command);
      if (command === "get_todo_items") {
        todoOverride = todoOverride ?? await nativeInvoke(command, args);
        return todoOverride;
      }
      if (command === "toggle_todo_item") {
        todoOverride = await nativeInvoke(command, args);
        return todoOverride;
      }
      if (command === "update_todo_item") {
        todoOverride = (todoOverride ?? await nativeInvoke("get_todo_items")).map((item) => item.id === args.id ? { ...item, title: args.title, scheduledDate: args.scheduledDate, scheduledTime: args.scheduledTime, importanceKey: args.importanceKey } : item);
        return todoOverride;
      }
      if (command === "delete_todo_item") {
        todoOverride = (todoOverride ?? await nativeInvoke("get_todo_items")).filter((item) => item.id !== args.id);
        return todoOverride;
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "待办").click();
  const todoPage = page.locator(".ep-todos-page");
  const doneColumn = todoPage.locator(".ep-todo-column--done");
  const todayColumn = todoPage.locator(".ep-todo-column--today");
  await expect(doneColumn.locator(".ep-todo-row")).toHaveCount(completedTitles.length);
  const lastRow = doneColumn.locator(".ep-todo-row").last();
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow.locator("strong")).toHaveAttribute("title", restoredTitle);

  const firstRow = doneColumn.locator(".ep-todo-row").first();
  await firstRow.getByRole("button", { name: "编辑", exact: true }).click();
  await firstRow.locator('input[type="text"]').fill(editedTitle);
  await firstRow.getByRole("button", { name: "保存", exact: true }).click();
  await expect(doneColumn).toContainText(editedTitle);

  await lastRow.locator(".ep-todo-check").click();
  await expect(doneColumn.locator(".ep-todo-row")).toHaveCount(completedTitles.length - 1);
  await expect(todayColumn).toContainText(restoredTitle);

  const desktopTextEvidence = await todoPage.locator(".ep-todo-row__copy strong").evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { text: element.textContent ?? "", clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  }));
  expect(desktopTextEvidence.every((item) => item.scrollWidth <= item.clientWidth && item.whiteSpace === "normal" && item.overflow !== "hidden" && item.textOverflow === "clip")).toBe(true);

  await doneColumn.locator(".ep-todo-row").first().getByRole("button", { name: "删除", exact: true }).click();
  await expect(doneColumn.locator(".ep-todo-row")).toHaveCount(completedTitles.length - 2);
  await expect(page.locator(".app-message")).toContainText("已删除");

  const desktopMetrics = await todoPage.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    doneRows: document.querySelectorAll(".ep-todo-column--done .ep-todo-row").length,
    doneScrollHeight: document.querySelector(".ep-todo-column--done .ep-todo-column__list").scrollHeight,
  }));
  expect(desktopMetrics.documentScrollWidth).toBeLessThanOrEqual(1488);
  expect(desktopMetrics.doneRows).toBe(completedTitles.length - 2);
  expect(desktopMetrics.doneScrollHeight).toBeGreaterThan(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/TODO-02-reaudit-pass-1487.png", animations: "disabled", fullPage: true });

  for (const [width, height] of [[820, 720], [560, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const metrics = await todoPage.evaluate(() => {
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const rows = [...document.querySelectorAll(".ep-todo-row")].map((row) => {
        const rowRect = row.getBoundingClientRect();
        const blocks = [".ep-todo-check", ".ep-todo-row__copy", ".ep-todo-row__actions"].map((selector) => row.querySelector(selector)).filter(Boolean).map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        });
        const overlaps = [];
        for (let index = 0; index < blocks.length; index += 1) {
          for (let next = index + 1; next < blocks.length; next += 1) if (overlap(blocks[index], blocks[next])) overlaps.push([index, next]);
        }
        return { left: rowRect.left, right: rowRect.right, blocks, overlaps };
      });
      return { documentScrollWidth: document.documentElement.scrollWidth, rows };
    });
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(metrics.rows.every((row) => row.left >= 0 && row.right <= width + 1 && row.overlaps.length === 0 && row.blocks.every((block) => block.width >= 0 && block.height >= 0))).toBe(true);
    const textEvidence = await todoPage.locator(".ep-todo-row__copy strong").evaluateAll((elements) => elements.map((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, whiteSpace: getComputedStyle(element).whiteSpace })));
    expect(textEvidence.every((item) => item.scrollWidth <= item.clientWidth && item.whiteSpace === "normal")).toBe(true);
    if (width === 420) await page.screenshot({ path: "output/qa/REFINE-19/TODO-02-reaudit-pass-420.png", animations: "disabled", fullPage: true });
  }
  const commands = await page.evaluate(() => window.__epTodoCommands);
  expect(commands).toEqual(expect.arrayContaining(["update_todo_item", "toggle_todo_item", "delete_todo_item"]));
});

test("REFINE-19 TODO-03 keeps all three Editorial Paper window controls available", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epWindowCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epWindowCommands.push(command);
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "待办").click();
  const todoPage = page.locator(".ep-todos-page");
  const controls = page.locator(".window-controls");
  const buttons = controls.locator(".window-control");
  await expect(todoPage).toBeVisible();
  await expect(controls).toBeVisible();
  await expect(buttons).toHaveCount(3);
  const expectedControls = [
    ["最小化窗口", "最小化", "minimize_main_window"],
    ["最大化或还原窗口", "最大化 / 还原", "toggle_maximize_main_window"],
    ["关闭窗口", "关闭窗口（隐藏到托盘）", "close_main_window"],
  ];
  for (let index = 0; index < expectedControls.length; index += 1) {
    const [ariaLabel, title] = expectedControls[index];
    const button = buttons.nth(index);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", ariaLabel);
    await expect(button).toHaveAttribute("title", title);
    const bounds = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
  }
  for (const [index, [, , command]] of expectedControls.entries()) {
    await buttons.nth(index).click();
    await expect.poll(() => page.evaluate((expectedCommand) => window.__epWindowCommands.filter((item) => item === expectedCommand).length, command)).toBe(1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/TODO-03-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });

  await page.setViewportSize({ width: 420, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(buttons).toHaveCount(3);
  const mobileBounds = await buttons.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }));
  expect(mobileBounds.every((bounds) => bounds.left >= 0 && bounds.right <= bounds.viewportWidth + 1 && bounds.top >= 0 && bounds.bottom <= bounds.viewportHeight)).toBe(true);
  await page.screenshot({ path: "output/qa/REFINE-19/TODO-03-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 RECORDS-01 checks the Editorial Paper records first screen", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const dailyBreakdown = [
    ["2026-08-30", 30, "00:30:00"],
    ["2026-08-31", 45, "00:45:00"],
    ["2026-09-01", 60, "01:00:00"],
    ["2026-09-02", 30, "00:30:00"],
    ["2026-09-03", 45, "00:45:00"],
    ["2026-09-04", 60, "01:00:00"],
    ["2026-09-05", 45, "00:45:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({
    date,
    totalDurationMs: minutes * 60 * 1000,
    totalDurationLabel,
    sessionCount: 1,
    linkedSessionCount: 0,
    independentSessionCount: 1,
  }));
  for (const [width, height] of [[1487, 1058], [1120, 760]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 3, dailyBreakdown });
    await pageButton(page, "记录").click();
    const recordsPage = page.locator(".ep-records-page");
    await expect(recordsPage).toBeVisible();
    await expect(recordsPage.locator(".ep-archive-chart .ep-chart-bar")).toHaveCount(7);
    await expect(recordsPage.locator(".ep-archive-summary")).toBeVisible();
    await expect(recordsPage.locator(".ep-record-entry")).toHaveCount(3);
    const metrics = await recordsPage.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const entries = [...document.querySelectorAll(".ep-record-entry")].map((entry) => {
        const rect = entry.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height, title: entry.querySelector("strong")?.textContent ?? "" };
      });
      const header = read(".ep-records-header");
      const archive = read(".ep-archive-paper");
      const spread = read(".ep-records-spread");
      const firstHeading = read(".ep-records-list .ep-section-heading");
      return { viewport: { width: innerWidth, height: innerHeight }, documentScrollWidth: document.documentElement.scrollWidth, header, archive, spread, firstHeading, entries, scrollHeight: document.documentElement.scrollHeight };
    });
    console.log(`RECORDS-01 ${width}x${height}: ${JSON.stringify(metrics)}`);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    for (const block of [metrics.header, metrics.archive, metrics.spread, metrics.firstHeading]) {
      expect(block).not.toBeNull();
      expect(block.left).toBeGreaterThanOrEqual(0);
      expect(block.right).toBeLessThanOrEqual(width + 1);
    }
    expect(metrics.entries.every((entry) => entry.left >= 0 && entry.right <= width + 1 && entry.height > 0)).toBe(true);
    if (width === 1487) {
      expect(metrics.header.bottom).toBeLessThanOrEqual(height);
      expect(metrics.archive.bottom).toBeLessThanOrEqual(height);
      expect(metrics.firstHeading.bottom).toBeLessThanOrEqual(height);
      expect(metrics.entries[0].bottom).toBeLessThanOrEqual(height);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-01-before-9ecaf59-1487.png", animations: "disabled", fullPage: true });
    } else {
      await recordsPage.locator(".ep-record-entry").first().scrollIntoViewIfNeeded();
      await expect(recordsPage.locator(".ep-record-entry").first()).toBeVisible();
    }
  }
});

test("REFINE-19 RECORDS-02 keeps the Editorial Paper records hierarchy inside its theme boundary", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const dailyBreakdown = [
    ["2026-08-30", 30, "00:30:00"],
    ["2026-08-31", 45, "00:45:00"],
    ["2026-09-01", 60, "01:00:00"],
    ["2026-09-02", 30, "00:30:00"],
    ["2026-09-03", 45, "00:45:00"],
    ["2026-09-04", 60, "01:00:00"],
    ["2026-09-05", 45, "00:45:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({ date, totalDurationMs: minutes * 60 * 1000, totalDurationLabel, sessionCount: 1, linkedSessionCount: 0, independentSessionCount: 1 }));
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 3, dailyBreakdown });
    await pageButton(page, "记录").click();
    const recordsPage = page.locator(".ep-records-page");
    await expect(recordsPage).toBeVisible();
    await expect(page.locator('.minimal-app[data-theme="editorial-paper"]')).toHaveCount(1);
    for (const selector of [".trail-page", ".trail-map", ".nv-page", ".nv-focus-panel", ".nv-records-archive", ".nv-settings-layout"]) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
    const styleMetrics = await recordsPage.evaluate(() => {
      const regions = [".ep-records-header", ".ep-archive-paper", ".ep-records-spread", ".ep-insight-paper", ".ep-full-history"].map((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector, className: element.className, left: rect.left, right: rect.right, backgroundImage: style.backgroundImage, position: style.position, borderStyle: style.borderStyle };
      });
      return { documentScrollWidth: document.documentElement.scrollWidth, regions, rootClasses: document.querySelector(".minimal-app").className };
    });
    expect(styleMetrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(styleMetrics.rootClasses).toContain("minimal-app--records");
    expect(styleMetrics.rootClasses).not.toContain("minimal-app--trail");
    expect(styleMetrics.regions.every((region) => region.left >= 0 && region.right <= width + 1 && !region.backgroundImage.includes("url(") && region.position !== "absolute")).toBe(true);
    expect(styleMetrics.regions.find((region) => region.selector === ".ep-archive-paper").backgroundImage).toContain("linear-gradient");
    if (width === 1487) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-02-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-02-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
    }
  }
});

test("REFINE-19 RECORDS-03 keeps 28-day Editorial Paper history navigable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const recordDates = Array.from({ length: 28 }, (_, index) => new Date(Date.UTC(2026, 7, 9 + index)).toISOString().slice(0, 10));
  recordDates.push("2026-09-05");
  const dailyBreakdown = [
    ["2026-08-30", 30, "00:30:00"],
    ["2026-08-31", 45, "00:45:00"],
    ["2026-09-01", 60, "01:00:00"],
    ["2026-09-02", 30, "00:30:00"],
    ["2026-09-03", 45, "00:45:00"],
    ["2026-09-04", 60, "01:00:00"],
    ["2026-09-05", 90, "01:30:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({ date, totalDurationMs: minutes * 60 * 1000, totalDurationLabel, sessionCount: 1, linkedSessionCount: 0, independentSessionCount: 1 }));
  const longTitlePrefix = "这是一条很长的历史专注记录用于核对日期分组展开编辑删除和窄屏回看";
  const editedTitle = "已编辑的历史专注记录：保持长文本在纸页内可回看";
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, {
    expectedHeading: "今日节奏",
    recordCount: recordDates.length,
    recordDates,
    recordTitlePrefix: longTitlePrefix,
    dailyBreakdown,
    analyticsPatch: { todayFocusDurationLabel: "01:30:00", todaySessionCount: 2, totalFocusDurationLabel: "21:45:00", totalFocusDurationMs: recordDates.length * 45 * 60 * 1000 },
  });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    let recordsOverride = null;
    window.__epRecordCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epRecordCommands.push(command);
      if (command === "get_focus_records") {
        recordsOverride = recordsOverride ?? await nativeInvoke(command, args);
        return recordsOverride;
      }
      if (command === "update_focus_record_title") {
        recordsOverride = (recordsOverride ?? await nativeInvoke("get_focus_records")).map((record) => record.id === args.id ? { ...record, title: args.title, linkedTodoTitle: args.title } : record);
        return recordsOverride;
      }
      if (command === "delete_focus_record") {
        recordsOverride = (recordsOverride ?? await nativeInvoke("get_focus_records")).filter((record) => record.id !== args.id);
        return recordsOverride;
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "记录").click();
  const recordsPage = page.locator(".ep-records-page");
  const history = recordsPage.locator(".ep-full-history");
  await expect(history.locator("details")).toHaveCount(28);
  const oldest = history.locator("details").first();
  await oldest.locator("summary").click();
  await expect(oldest.locator(":scope > div")).toBeVisible();
  await expect(oldest).toContainText(`${longTitlePrefix} 1`);
  await oldest.locator("summary").click();
  await expect(oldest.locator(":scope > div")).toHaveCount(0);
  await oldest.locator("summary").click();

  const selectedEntries = recordsPage.locator(".ep-records-list .ep-record-entry");
  await expect(selectedEntries).toHaveCount(2);
  const desktopTitleEvidence = await selectedEntries.locator("strong").evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { text: element.textContent ?? "", clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  }));
  expect(desktopTitleEvidence.every((item) => item.scrollWidth <= item.clientWidth && item.whiteSpace === "normal" && item.overflow !== "hidden" && item.textOverflow === "clip")).toBe(true);
  await selectedEntries.first().getByRole("button", { name: "编辑", exact: true }).click();
  await selectedEntries.first().locator('input[aria-label="记录名称"]').fill(editedTitle);
  await selectedEntries.first().getByRole("button", { name: "保存", exact: true }).click();
  await expect(selectedEntries.first().locator("strong")).toHaveAttribute("title", editedTitle);
  await selectedEntries.last().getByRole("button", { name: "删除", exact: true }).click();
  await expect(selectedEntries).toHaveCount(1);
  await expect(page.locator(".app-message")).toContainText("已删除");

  await oldest.locator("summary").click();
  await expect(oldest.locator(":scope > div")).toBeVisible();
  await history.locator("details").last().scrollIntoViewIfNeeded();
  const desktopMetrics = await recordsPage.evaluate(() => ({ documentScrollWidth: document.documentElement.scrollWidth, documentScrollHeight: document.documentElement.scrollHeight, scrollY: window.scrollY, historyGroups: document.querySelectorAll(".ep-full-history details").length, oldestExpanded: document.querySelector(".ep-full-history details")?.open ?? false }));
  expect(desktopMetrics.documentScrollWidth).toBeLessThanOrEqual(1488);
  expect(desktopMetrics.documentScrollHeight).toBeGreaterThan(1058);
  expect(desktopMetrics.scrollY).toBeGreaterThan(0);
  expect(desktopMetrics.historyGroups).toBe(28);
  expect(desktopMetrics.oldestExpanded).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-03-reaudit-pass-1487.png", animations: "disabled", fullPage: true });

  await page.setViewportSize({ width: 420, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(history.locator("details")).toHaveCount(28);
  const mobileMetrics = await recordsPage.evaluate(() => ({ documentScrollWidth: document.documentElement.scrollWidth, oldestLeft: document.querySelector(".ep-full-history details")?.getBoundingClientRect().left ?? -1, oldestRight: document.querySelector(".ep-full-history details")?.getBoundingClientRect().right ?? -1 }));
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(mobileMetrics.oldestLeft).toBeGreaterThanOrEqual(0);
  expect(mobileMetrics.oldestRight).toBeLessThanOrEqual(421);
  const mobileTitleEvidence = await recordsPage.locator(".ep-records-list .ep-record-entry strong").evaluateAll((elements) => elements.map((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, whiteSpace: getComputedStyle(element).whiteSpace })));
  expect(mobileTitleEvidence.every((item) => item.scrollWidth <= item.clientWidth && item.whiteSpace === "normal")).toBe(true);
  await oldest.scrollIntoViewIfNeeded();
  await expect(oldest).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-03-reaudit-pass-420.png", animations: "disabled", fullPage: true });
  const commands = await page.evaluate(() => window.__epRecordCommands);
  expect(commands).toEqual(expect.arrayContaining(["update_focus_record_title", "delete_focus_record"]));
});

test("REFINE-19 RECORDS-04 verifies Editorial Paper uses aligned natural-day bars", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const dailyBreakdown = [
    ["2026-08-30", 30, "00:30:00"],
    ["2026-08-31", 45, "00:45:00"],
    ["2026-09-01", 60, "01:00:00"],
    ["2026-09-02", 30, "00:30:00"],
    ["2026-09-03", 45, "00:45:00"],
    ["2026-09-04", 60, "01:00:00"],
    ["2026-09-05", 90, "01:30:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({ date, totalDurationMs: minutes * 60 * 1000, totalDurationLabel, sessionCount: 1, linkedSessionCount: 0, independentSessionCount: 1 }));
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 7, dailyBreakdown });
    await pageButton(page, "记录").click();
    const recordsPage = page.locator(".ep-records-page");
    const chart = recordsPage.locator(".ep-archive-chart");
    await expect(chart).toBeVisible();
    const metrics = await chart.evaluate((element) => {
      const bars = [...element.querySelectorAll(".ep-chart-bar")].map((bar) => {
        const column = bar.querySelector(".ep-chart-bar__column");
        const label = bar.querySelector("strong");
        const value = bar.querySelector(".ep-chart-bar__value");
        const barRect = bar.getBoundingClientRect();
        const columnRect = column.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        return {
          barCenter: (barRect.left + barRect.right) / 2,
          columnCenter: (columnRect.left + columnRect.right) / 2,
          columnBottom: columnRect.bottom,
          labelTop: labelRect.top,
          value: value?.textContent ?? "",
          date: label?.textContent ?? "",
          barWidth: barRect.width,
          columnWidth: columnRect.width,
        };
      });
      return {
        svgLikeNodes: element.querySelectorAll("svg, path, circle, polyline").length,
        heading: element.querySelector(".ep-chart-heading span")?.textContent ?? "",
        bars,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.svgLikeNodes).toBe(0);
    expect(metrics.heading).toContain("近七日 / NATURAL DAYS");
    expect(metrics.bars).toHaveLength(7);
    expect(metrics.bars.map((bar) => bar.value)).toEqual(["00:30:00", "00:45:00", "01:00:00", "00:30:00", "00:45:00", "01:00:00", "01:30:00"]);
    expect(metrics.bars.map((bar) => bar.date)).toEqual(["8/30周日", "8/31周一", "9/1周二", "9/2周三", "9/3周四", "9/4周五", "9/5周六"]);
    expect(metrics.bars.every((bar) => Math.abs(bar.barCenter - bar.columnCenter) < 1 && bar.columnBottom <= bar.labelTop && bar.barWidth > 0 && bar.columnWidth > 0)).toBe(true);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/qa/REFINE-19/RECORDS-04-not-applicable-${width}-9ecaf59.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 RECORDS-05 keeps Editorial Paper history statistics non-duplicative", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const dailyBreakdown = [
    ["2026-08-30", 15, "00:15:00"],
    ["2026-08-31", 30, "00:30:00"],
    ["2026-09-01", 45, "00:45:00"],
    ["2026-09-02", 60, "01:00:00"],
    ["2026-09-03", 75, "01:15:00"],
    ["2026-09-04", 90, "01:30:00"],
    ["2026-09-05", 120, "02:00:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({ date, totalDurationMs: minutes * 60 * 1000, totalDurationLabel, sessionCount: 1, linkedSessionCount: 0, independentSessionCount: 1 }));
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 7, dailyBreakdown });
    await pageButton(page, "记录").click();
    const recordsPage = page.locator(".ep-records-page");
    const metrics = await recordsPage.evaluate(() => ({
      archiveCharts: document.querySelectorAll(".ep-archive-chart").length,
      barGroups: document.querySelectorAll(".ep-chart-bars").length,
      distributionCandidates: document.querySelectorAll('[class*="distribution"], [data-chart="distribution"], [data-visualization="distribution"]').length,
      chartLabel: document.querySelector(".ep-chart-heading span")?.textContent ?? "",
      chartValues: [...document.querySelectorAll(".ep-chart-bar__value")].map((element) => element.textContent ?? ""),
      chartDates: [...document.querySelectorAll(".ep-chart-bar strong")].map((element) => element.textContent ?? ""),
      chartButtons: document.querySelectorAll(".ep-chart-bar").length,
      historySections: document.querySelectorAll(".ep-full-history").length,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.archiveCharts).toBe(1);
    expect(metrics.barGroups).toBe(1);
    expect(metrics.distributionCandidates).toBe(0);
    expect(metrics.chartLabel).toBe("近七日 / NATURAL DAYS");
    expect(metrics.chartValues).toEqual(["00:15:00", "00:30:00", "00:45:00", "01:00:00", "01:15:00", "01:30:00", "02:00:00"]);
    expect(metrics.chartDates).toEqual(["8/30周日", "8/31周一", "9/1周二", "9/2周三", "9/3周四", "9/4周五", "9/5周六"]);
    expect(metrics.chartButtons).toBe(7);
    expect(metrics.historySections).toBe(1);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/qa/REFINE-19/RECORDS-05-not-applicable-${width}-9ecaf59.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 RECORDS-06 keeps all Editorial Paper records usable at scale", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const recordCount = 205;
  const recordDates = Array.from({ length: recordCount }, () => referenceDate);
  const longTitlePrefix = "这是一条很长的全部记录用于核对加载更多编辑保存删除和窄屏回看";
  const editedTitle = "已编辑的全部记录标题：仍然可以完整回看";
  const dailyBreakdown = [
    ["2026-08-30", 0, "00:00:00"],
    ["2026-08-31", 0, "00:00:00"],
    ["2026-09-01", 0, "00:00:00"],
    ["2026-09-02", 0, "00:00:00"],
    ["2026-09-03", 0, "00:00:00"],
    ["2026-09-04", 0, "00:00:00"],
    ["2026-09-05", recordCount * 45, "153:45:00"],
  ].map(([date, minutes, totalDurationLabel]) => ({ date, totalDurationMs: minutes * 60 * 1000, totalDurationLabel, sessionCount: date === referenceDate ? recordCount : 0, linkedSessionCount: 0, independentSessionCount: date === referenceDate ? recordCount : 0 }));
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, {
    expectedHeading: "今日节奏",
    recordCount,
    recordDates,
    recordTitlePrefix: longTitlePrefix,
    dailyBreakdown,
    analyticsPatch: { todayFocusDurationLabel: "153:45:00", todaySessionCount: recordCount, totalFocusDurationLabel: "153:45:00", totalFocusDurationMs: recordCount * 45 * 60 * 1000 },
  });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    let recordsOverride = null;
    window.__epRecordCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epRecordCommands.push(command);
      if (command === "get_focus_records") {
        recordsOverride = recordsOverride ?? await nativeInvoke(command, args);
        return recordsOverride;
      }
      if (command === "update_focus_record_title") {
        recordsOverride = (recordsOverride ?? await nativeInvoke("get_focus_records")).map((record) => record.id === args.id ? { ...record, title: args.title, linkedTodoTitle: args.title } : record);
        return recordsOverride;
      }
      if (command === "delete_focus_record") {
        recordsOverride = (recordsOverride ?? await nativeInvoke("get_focus_records")).filter((record) => record.id !== args.id);
        return recordsOverride;
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "记录").click();
  const recordsPage = page.locator(".ep-records-page");
  const selectedEntries = recordsPage.locator(".ep-records-list .ep-record-entry");
  const history = recordsPage.locator(".ep-full-history");
  const historyDay = history.locator("details").first();
  await expect(history.locator("details")).toHaveCount(1);
  await expect(historyDay.locator("summary")).toContainText("205 轮");
  await expect(selectedEntries).toHaveCount(200);
  const loadMore = recordsPage.getByRole("button", { name: /继续展开记录/ });
  await expect(loadMore).toContainText("200 / 205");
  await loadMore.click();
  await expect(selectedEntries).toHaveCount(205);
  await expect(selectedEntries.last().locator("strong")).toHaveAttribute("title", `${longTitlePrefix} 205`);

  await selectedEntries.first().getByRole("button", { name: "编辑", exact: true }).click();
  await selectedEntries.first().locator('input[aria-label="记录名称"]').fill(editedTitle);
  await selectedEntries.first().getByRole("button", { name: "保存", exact: true }).click();
  await expect(selectedEntries.first().locator("strong")).toHaveAttribute("title", editedTitle);
  await selectedEntries.last().getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".app-message")).toContainText("已删除");
  await expect(historyDay.locator("summary")).toContainText("204 轮");

  await historyDay.locator("summary").click();
  await expect(historyDay.locator(":scope > div span")).toHaveCount(204);
  await expect(historyDay.locator(":scope > div")).toContainText(editedTitle);
  const desktopMetrics = await recordsPage.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentScrollHeight: document.documentElement.scrollHeight,
    historyTextCount: document.querySelectorAll(".ep-full-history details > div span").length,
    selectedCount: document.querySelectorAll(".ep-records-list .ep-record-entry").length,
  }));
  expect(desktopMetrics.documentScrollWidth).toBeLessThanOrEqual(1488);
  expect(desktopMetrics.documentScrollHeight).toBeGreaterThan(1058);
  expect(desktopMetrics.historyTextCount).toBe(204);
  await history.screenshot({ path: "output/qa/REFINE-19/RECORDS-06-pass-1487-9ecaf59.png", animations: "disabled" });

  await page.setViewportSize({ width: 420, height: 720 });
  const mobileMetrics = await recordsPage.evaluate(() => {
    const list = document.querySelector(".ep-records-list");
    const historyElement = document.querySelector(".ep-full-history");
    const listRect = list.getBoundingClientRect();
    const historyRect = historyElement.getBoundingClientRect();
    return { documentScrollWidth: document.documentElement.scrollWidth, listRight: listRect.right, historyRight: historyRect.right, viewportWidth: innerWidth };
  });
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(mobileMetrics.listRight).toBeLessThanOrEqual(mobileMetrics.viewportWidth + 1);
  expect(mobileMetrics.historyRight).toBeLessThanOrEqual(mobileMetrics.viewportWidth + 1);
  await expect(historyDay.locator(":scope > div span")).toHaveCount(204);
  await history.screenshot({ path: "output/qa/REFINE-19/RECORDS-06-pass-420-9ecaf59.png", animations: "disabled" });
  const commands = await page.evaluate(() => window.__epRecordCommands);
  expect(commands).toEqual(expect.arrayContaining(["update_focus_record_title", "delete_focus_record"]));
});

test("REFINE-19 RECORDS-07 keeps all Editorial Paper window controls usable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount: 3 });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epRecordsWindowCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epRecordsWindowCommands.push(command);
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "记录").click();
  const recordsPage = page.locator(".ep-records-page");
  const controls = page.locator(".window-controls");
  const buttons = controls.locator(".window-control");
  await expect(recordsPage).toBeVisible();
  await expect(controls).toBeVisible();
  await expect(buttons).toHaveCount(3);
  await expect(controls).not.toHaveAttribute("data-tauri-drag-region", "true");
  const expectedControls = [
    ["最小化窗口", "最小化", "minimize_main_window"],
    ["最大化或还原窗口", "最大化 / 还原", "toggle_maximize_main_window"],
    ["关闭窗口", "关闭窗口（隐藏到托盘）", "close_main_window"],
  ];
  for (let index = 0; index < expectedControls.length; index += 1) {
    const [ariaLabel, title] = expectedControls[index];
    const button = buttons.nth(index);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", ariaLabel);
    await expect(button).toHaveAttribute("title", title);
    const bounds = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
  }
  for (const [index, [, , command]] of expectedControls.entries()) {
    await buttons.nth(index).click();
    await expect.poll(() => page.evaluate((expectedCommand) => window.__epRecordsWindowCommands.filter((item) => item === expectedCommand).length, command)).toBe(1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-07-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });

  await page.setViewportSize({ width: 420, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const mobileBounds = await buttons.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }));
  expect(mobileBounds.every((bounds) => bounds.left >= 0 && bounds.right <= bounds.viewportWidth + 1 && bounds.top >= 0 && bounds.bottom <= bounds.viewportHeight)).toBe(true);
  await expect(buttons).toHaveCount(3);
  await page.screenshot({ path: "output/qa/REFINE-19/RECORDS-07-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 SETTINGS-01 keeps Editorial Paper settings copy and controls separated", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await pageButton(page, "设置").click();
    const settingsPage = page.locator(".ep-settings-page");
    await expect(settingsPage).toBeVisible();
    const metrics = await settingsPage.evaluate(() => {
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const overlaps = (first, second) => first.left < second.right - 1 && first.right > second.left + 1 && first.top < second.bottom - 1 && first.bottom > second.top + 1;
      const blockSelectors = [
        ".ep-section-heading", ".ep-theme-swatches", ".ep-slider-row", ".ep-density-row", ".ep-live-preview",
        ".ep-setting-list", ".ep-hand-note", ".ep-select-row", ".ep-sound-actions", ".ep-shortcut-list",
        ".ep-settings-paper--backup > p", ".ep-settings-actions", ".ep-error", ".ep-settings-footer",
      ];
      const blockMetrics = [...document.querySelectorAll(".ep-settings-paper")].flatMap((paper, paperIndex) => blockSelectors.map((selector) => {
        const element = paper.querySelector(selector);
        return element ? { paperIndex, selector, ...rect(element) } : null;
      }).filter(Boolean));
      const overlapPairs = [];
      for (let index = 0; index < blockMetrics.length; index += 1) {
        for (let next = index + 1; next < blockMetrics.length; next += 1) {
          const first = blockMetrics[index];
          const second = blockMetrics[next];
          if (first.paperIndex === second.paperIndex && overlaps(first, second)) overlapPairs.push([first.selector, second.selector, first.paperIndex]);
        }
      }
      const swatches = [...document.querySelectorAll(".ep-theme-swatch")].map((element) => ({ ...rect(element), label: element.textContent?.trim() ?? "" }));
      const footerChildren = [...document.querySelectorAll(".ep-settings-footer > *")].map((element) => ({ ...rect(element), tag: element.tagName, text: element.textContent?.trim() ?? "" }));
      return { documentScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, blockMetrics, overlapPairs, swatches, footerChildren };
    });
    console.log(`SETTINGS-01 ${width}x${height}: ${JSON.stringify(metrics)}`);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(metrics.overlapPairs).toEqual([]);
    expect(metrics.swatches.every((swatch) => swatch.left >= 0 && swatch.right <= width + 1 && swatch.height > 0)).toBe(true);
    expect(metrics.footerChildren.every((child) => child.left >= 0 && child.right <= width + 1 && child.height > 0)).toBe(true);
    if (width === 1487) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-01-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-01-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
    }
  }
});

test("REFINE-19 SETTINGS-02 removes Editorial Paper controls with no visible effect", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await pageButton(page, "设置").click();
    const settingsPage = page.locator(".ep-settings-page");
    await expect(settingsPage).toBeVisible();
    await expect(settingsPage.locator(".ep-slider-row")).toHaveCount(0);
    await expect(settingsPage.locator(".ep-density-row")).toHaveCount(0);
    await expect(settingsPage.locator(".ep-theme-swatch")).toHaveCount(5);
    await expect(settingsPage.locator(".ep-live-preview")).toBeVisible();
    const metrics = await settingsPage.evaluate(() => ({
      rootDensity: document.querySelector(".minimal-app")?.getAttribute("data-density") ?? "",
      rootMotion: document.querySelector(".minimal-app")?.getAttribute("data-motion") ?? "",
      visualIntensityVariable: document.querySelector(".minimal-app")?.style.getPropertyValue("--nv-visual-intensity") ?? "",
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.rootDensity).toMatch(/^(roomy|compact)$/);
    expect(metrics.rootMotion).toMatch(/^(off|subtle|full)$/);
    expect(metrics.visualIntensityVariable).not.toBe("");
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/qa/REFINE-19/SETTINGS-02-after-${width}-9ecaf59.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 SETTINGS-03 keeps Editorial Paper sound choices and custom sound flow usable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epSoundCommands = [];
    window.__epSoundPreferences = null;
    window.__epPreviewOscillators = 0;
    class ReferenceAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator() {
        window.__epPreviewOscillators += 1;
        return { type: "sine", frequency: { value: 0 }, connect: () => {}, start: () => {}, stop: () => {} };
      }
      createGain() {
        return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} };
      }
      close() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: ReferenceAudioContext });
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epSoundCommands.push(command);
      if (command === "update_timer_preferences") {
        const current = window.__epSoundPreferences ?? await nativeInvoke("get_timer_preferences");
        window.__epSoundPreferences = { ...current, ...(args.preferences ?? {}) };
        return window.__epSoundPreferences;
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "设置").click();
  const settingsPage = page.locator(".ep-settings-page");
  const soundSelect = settingsPage.locator('select[name="editorialAlertSound"]');
  const soundOptions = soundSelect.locator("option");
  await expect(soundOptions).toHaveCount(8);
  await expect(soundOptions).toHaveText(["柔和铃音", "明亮三连", "沉稳脉冲", "木鱼单击", "玻璃回响", "晨光和弦", "老牧师原声", "自定义音效"]);
  await expect(soundOptions.nth(7)).toHaveJSProperty("disabled", true);
  await soundSelect.selectOption("bright_bell");
  await expect(soundSelect).toHaveValue("bright_bell");
  await expect.poll(() => page.evaluate(() => window.__epSoundCommands.filter((item) => item === "update_timer_preferences").length)).toBe(1);
  await settingsPage.getByRole("button", { name: "试听", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__epPreviewOscillators)).toBeGreaterThan(0);

  await settingsPage.locator('input[type="file"][aria-label="导入自定义音效"]').setInputFiles({ name: "paper-chime.wav", mimeType: "audio/wav", buffer: Buffer.from("RIFF0000WAVEfmt ") });
  await expect(page.locator(".app-message")).toContainText("自定义音效已启用");
  await expect(soundOptions.nth(7)).toHaveJSProperty("disabled", false);
  await expect(soundSelect).toHaveValue("custom");
  await expect(settingsPage.getByRole("button", { name: "移除自定义", exact: true })).toBeVisible();
  await settingsPage.getByRole("button", { name: "移除自定义", exact: true }).click();
  await expect(page.locator(".app-message")).toContainText("已恢复为柔和铃音");
  await expect(soundSelect).toHaveValue("soft_chime");
  await expect(settingsPage.getByRole("button", { name: "移除自定义", exact: true })).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-03-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });
  await page.setViewportSize({ width: 420, height: 720 });
  const mobileMetrics = await settingsPage.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    selectRight: document.querySelector('select[name="editorialAlertSound"]')?.getBoundingClientRect().right ?? -1,
    actionsRight: document.querySelector(".ep-sound-actions")?.getBoundingClientRect().right ?? -1,
  }));
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(mobileMetrics.selectRight).toBeLessThanOrEqual(421);
  expect(mobileMetrics.actionsRight).toBeLessThanOrEqual(421);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-03-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
  const commands = await page.evaluate(() => window.__epSoundCommands);
  expect(commands.filter((command) => command === "update_timer_preferences").length).toBe(3);
});

test("REFINE-19 SETTINGS-04 keeps displayed Editorial Paper shortcuts wired", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epShortcutCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epShortcutCommands.push(command);
      if (command === "start_timer") {
        const snapshot = await nativeInvoke(command, args);
        return { ...snapshot, elapsedMs: 1000, elapsedLabel: "00:00:01", hasUnsubmittedProgress: true, canCompleteSession: true };
      }
      if (command === "complete_focus_session") {
        const snapshot = await nativeInvoke("get_timer_snapshot");
        return {
          records: await nativeInvoke("get_focus_records"),
          todoItems: await nativeInvoke("get_todo_items"),
          timerSnapshot: { ...snapshot, isRunning: false, status: "待开始", elapsedMs: 0, elapsedLabel: "00:00:00", remainingMs: 0, hasUnsubmittedProgress: false, canCompleteSession: false },
        };
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "设置").click();
  const settingsPage = page.locator(".ep-settings-page");
  const shortcutRows = settingsPage.locator(".ep-shortcut-list > div");
  await expect(shortcutRows).toHaveCount(3);
  await expect(shortcutRows.nth(0)).toContainText("开始 / 继续");
  await expect(shortcutRows.nth(0)).toContainText("Ctrl");
  await expect(shortcutRows.nth(0)).toContainText("Enter");
  await expect(shortcutRows.nth(1)).toContainText("结束本段");
  await expect(shortcutRows.nth(1)).toContainText("Shift");
  await expect(shortcutRows.nth(1)).toContainText("E");
  await expect(shortcutRows.nth(2)).toContainText("命令面板");
  await expect(shortcutRows.nth(2)).toContainText("K");

  await page.keyboard.press("Control+K");
  await expect(page.locator("#command-palette-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#command-palette-dialog")).toHaveCount(0);
  await page.keyboard.press("Control+Enter");
  await expect.poll(() => page.evaluate(() => window.__epShortcutCommands.filter((command) => command === "start_timer").length)).toBe(1);
  await page.keyboard.press("Control+Shift+E");
  await expect.poll(() => page.evaluate(() => window.__epShortcutCommands.filter((command) => command === "complete_focus_session").length)).toBe(1);
  await expect(page.locator(".app-message")).toContainText("已保存为一条专注记录");
  const commands = await page.evaluate(() => window.__epShortcutCommands);
  expect(commands).toEqual(expect.arrayContaining(["start_timer", "complete_focus_session"]));

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-04-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });
  await page.setViewportSize({ width: 420, height: 720 });
  const mobileMetrics = await settingsPage.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    shortcutRight: document.querySelector(".ep-shortcut-list")?.getBoundingClientRect().right ?? -1,
  }));
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(mobileMetrics.shortcutRight).toBeLessThanOrEqual(421);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-04-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 SETTINGS-05 keeps Editorial Paper theme preview purposeful", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await pageButton(page, "设置").click();
    const settingsPage = page.locator(".ep-settings-page");
    await expect(settingsPage).toBeVisible();
    await expect(settingsPage.locator(".ep-theme-swatches")).toHaveCount(1);
    await expect(settingsPage.locator(".ep-theme-swatch")).toHaveCount(5);
    const preview = settingsPage.locator(".ep-live-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("当前样式预览");
    await expect(preview.locator(".ep-live-preview__paper")).toContainText("编辑纸页");
    await expect(preview.locator(".ep-live-preview__paper")).toContainText("纸张、铅字与可读性的工作界面。");
    const metrics = await settingsPage.evaluate(() => {
      const previewPaper = document.querySelector(".ep-live-preview__paper");
      const style = previewPaper ? getComputedStyle(previewPaper) : null;
      return {
        nightValleyNodes: document.querySelectorAll('[class^="nv-"], [class*=" nv-"]').length,
        previewImages: document.querySelectorAll(".ep-live-preview img").length,
        previewUrlBackgrounds: style?.backgroundImage.includes("url(") ?? false,
        previewRole: document.querySelector(".ep-live-preview__paper")?.className ?? "",
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.nightValleyNodes).toBe(0);
    expect(metrics.previewImages).toBe(0);
    expect(metrics.previewUrlBackgrounds).toBe(false);
    expect(metrics.previewRole).toContain("ep-live-preview__paper--editorial-paper");
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/qa/REFINE-19/SETTINGS-05-pass-${width}-9ecaf59.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 SETTINGS-06 makes Editorial Paper settings immediate and persistent", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("refine19-settings06-seeded") !== "1") {
      localStorage.setItem("focused-moment.theme", "editorial-paper");
      sessionStorage.setItem("refine19-settings06-seeded", "1");
    }
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epSettings06Commands = [];
    window.__epSettings06FailNext = false;
    window.__epSettings06Preferences = null;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epSettings06Commands.push(command);
      if (command === "get_timer_preferences") {
        window.__epSettings06Preferences = window.__epSettings06Preferences ?? await nativeInvoke(command, args);
        return window.__epSettings06Preferences;
      }
      if (command === "update_timer_preferences") {
        if (window.__epSettings06FailNext) {
          window.__epSettings06FailNext = false;
          throw new Error("模拟保存失败");
        }
        const current = window.__epSettings06Preferences ?? await nativeInvoke("get_timer_preferences");
        const next = { ...current, ...(args.preferences ?? {}) };
        window.__epSettings06Preferences = next;
        localStorage.setItem("refine19-settings06-preferences", JSON.stringify(next));
        return next;
      }
      return nativeInvoke(command, args);
    };
  });
  await pageButton(page, "设置").click();
  let settingsPage = page.locator(".ep-settings-page");
  await expect(settingsPage).toBeVisible();
  await expect(settingsPage.getByRole("button", { name: "保存外观设置", exact: true })).toHaveCount(0);
  await expect(settingsPage).toContainText("主题与提醒设置会立即保存。");
  await expect(settingsPage).not.toContainText("更改将在下次打开应用时生效。");
  await settingsPage.locator(".ep-theme-swatch").filter({ hasText: "编辑纸页" }).click();
  await expect(page.locator(".app-message")).toContainText("设置会自动保留");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("focused-moment.theme"))).toBe("editorial-paper");

  const behaviorToggle = settingsPage.locator('.ep-setting-list input[type="checkbox"]').first();
  await behaviorToggle.uncheck();
  await expect(behaviorToggle).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__epSettings06Commands.filter((command) => command === "update_timer_preferences").length)).toBe(1);
  const soundSelect = settingsPage.locator('select[name="editorialAlertSound"]');
  await page.evaluate(() => { window.__epSettings06FailNext = true; });
  await soundSelect.selectOption("deep_pulse");
  await expect(page.locator(".app-message")).toContainText("模拟保存失败");
  await expect(soundSelect).toHaveValue("soft_chime");
  await soundSelect.selectOption("bright_bell");
  await expect(soundSelect).toHaveValue("bright_bell");
  await expect.poll(() => page.evaluate(() => window.__epSettings06Commands.filter((command) => command === "update_timer_preferences").length)).toBe(3);
  const storedPreferences = await page.evaluate(() => JSON.parse(localStorage.getItem("refine19-settings06-preferences") ?? "{}"));
  expect(storedPreferences.toastReminderEnabled).toBe(false);
  expect(storedPreferences.alertSoundKey).toBe("bright_bell");

  await page.addInitScript(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === "get_timer_preferences") {
        const stored = localStorage.getItem("refine19-settings06-preferences");
        if (stored) return JSON.parse(stored);
      }
      return nativeInvoke(command, args);
    };
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "今日节奏" })).toBeVisible();
  await pageButton(page, "设置").click();
  settingsPage = page.locator(".ep-settings-page");
  await expect(settingsPage.locator('select[name="editorialAlertSound"]')).toHaveValue("bright_bell");
  await expect(settingsPage.locator('.ep-setting-list input[type="checkbox"]').first()).not.toBeChecked();
  await expect(settingsPage.getByRole("button", { name: "保存外观设置", exact: true })).toHaveCount(0);
  await expect(settingsPage).toContainText("主题与提醒设置会立即保存。");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-06-pass-1487-9ecaf59.png", animations: "disabled", fullPage: true });

  await page.setViewportSize({ width: 420, height: 720 });
  const mobileMetrics = await settingsPage.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    footerRight: document.querySelector(".ep-settings-footer")?.getBoundingClientRect().right ?? -1,
  }));
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(mobileMetrics.footerRight).toBeLessThanOrEqual(421);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/qa/REFINE-19/SETTINGS-06-pass-420-9ecaf59.png", animations: "disabled", fullPage: true });
});

test("PERF-01 measures synthetic Editorial Paper history rendering", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });

  const results = [];
  for (const recordCount of [1000, 10000]) {
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", recordCount });
    const switchStartedAt = await page.evaluate(() => performance.now());
    await pageButton(page, "记录").click();
    await expect(page.locator(".ep-records-page")).toBeVisible();
    const switchFinishedAt = await page.evaluate(() => performance.now());
    const frameStats = await page.evaluate(() => new Promise((resolve) => {
      const startedAt = performance.now();
      let frames = 0;
      let longFrames = 0;
      let previousAt = startedAt;
      const sample = (now) => {
        frames += 1;
        if (now - previousAt > 20) longFrames += 1;
        previousAt = now;
        if (now - startedAt >= 1000) {
          resolve({ durationMs: Number((now - startedAt).toFixed(1)), frames, longFrames, fps: Number((frames / ((now - startedAt) / 1000)).toFixed(1)) });
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    const pageStats = await page.evaluate(() => ({
      domNodeCount: document.getElementsByTagName("*").length,
      scrollHeight: document.documentElement.scrollHeight,
      heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
    }));
    results.push({
      recordCount,
      recordsRouteSwitchMs: Number((switchFinishedAt - switchStartedAt).toFixed(1)),
      frameStats,
      pageStats,
    });
  }

  mkdirSync(performanceDirectory, { recursive: true });
  writeFileSync(`${performanceDirectory}/frontend-history.json`, JSON.stringify({
    capturedAt: new Date().toISOString(),
    viewport: { width: 1487, height: 1058 },
    runtime: "Chromium + Tauri mock; synthetic records, not personal data",
    results,
  }, null, 2));
  for (const result of results) {
    expect(result.recordsRouteSwitchMs).toBeLessThan(10_000);
    expect(result.frameStats.frames).toBeGreaterThan(0);
  }
});

test("Night Valley settings use a clear layout and auto-save useful choices", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();

  await expect(page.locator(".nv-settings-subnav a")).toHaveCount(4);
  await expect(page.locator(".nv-setting-sliders")).toHaveCount(0);
  await expect(page.locator(".nv-density-choice")).toHaveCount(0);
  await expect(page.locator("#nv-shortcuts")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "快捷键" })).toHaveCount(0);
  await expect(page.locator(".nv-settings-theme-lab")).toContainText("主题观测站");
  await expect(page.locator(".nv-sound-option")).toHaveCount(7);
  const toggleMetrics = await page.locator(".nv-toggle-row label").evaluateAll((labels) => labels.map((label) => {
    const input = label.querySelector("input");
    const copy = label.querySelector("span");
    const note = label.querySelector("small");
    const rect = (element) => {
      const box = element?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height } : null;
    };
    return { label: rect(label), input: rect(input), copy: rect(copy), note: rect(note), noteDisplay: note ? getComputedStyle(note).display : "" };
  }));
  expect(toggleMetrics.every((metric) => metric.noteDisplay === "block" && (metric.note?.height ?? 0) > 0)).toBe(true);
  expect(toggleMetrics.every((metric) => (metric.input?.right ?? 0) <= (metric.label?.right ?? 0) && (metric.copy?.right ?? 0) <= (metric.label?.right ?? 0))).toBe(true);

  await page.locator(".nv-theme-card").filter({ hasText: "编辑纸页" }).click({ force: true });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  await expect(page.locator(".app-message--success")).toContainText("自动保留");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("focused-moment.theme"))).toBe("editorial-paper");

  await page.reload();
  await expect(page.getByRole("heading", { name: "今日节奏" })).toBeVisible();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
});

test("Night Valley appearance settings explain when local saving fails", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota exceeded");
    };
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".nv-theme-card").filter({ hasText: "夜谷" }).click({ force: true });

  await expect(page.locator(".app-message--error")).toContainText("本地保存失败");
  await expect(page.locator(".app-message--error")).toContainText("重启后不会保留");
});

test("Night Valley secondary widths keep each page inside the viewport", async ({ page }) => {
  const pages = [
    ["计时", ".nv-focus-panel"],
    ["待办", ".nv-todo-focus-panel"],
    ["记录", ".nv-records-archive"],
    ["设置", ".nv-settings-preview"],
  ];

  for (const [width, height] of [[1280, 900], [1024, 900]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page);

    for (const [label, surfaceSelector] of pages) {
      await page.locator(".minimal-nav > button").filter({ hasText: label }).click();
      const surface = page.locator(surfaceSelector);
      await expect(surface).toBeVisible();
      const layout = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(width);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `output/playwright/night-valley-${label}-${width}.png`, animations: "disabled" });
    }
  }
});

test("Night Valley pressure widths preserve the first trail label and settings safety reachability", async ({ page }) => {
  const pages = [
    ["今日", ".trail-map"],
    ["计时", ".nv-focus-panel"],
    ["待办", ".nv-todo-focus-panel"],
    ["记录", ".nv-records-archive"],
    ["设置", ".nv-settings-preview"],
  ];
  const viewports = [
    { width: 1120, height: 760 },
    { width: 820, height: 720 },
    { width: 560, height: 720 },
  ];

  await page.setViewportSize(viewports[0]);
  await bootTodayReferenceMock(page);

  for (const [index, viewport] of viewports.entries()) {
    if (index > 0) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
    }

    const trailViewport = page.locator(".trail-map:visible .trail-map__viewport");
    const trailLabel = await trailViewport.evaluate((viewportElement) => {
      const meta = viewportElement.querySelector(".trail-node .trail-node__meta");
      if (!meta) return null;
      const metaRect = meta.getBoundingClientRect();
      const viewportRect = viewportElement.getBoundingClientRect();
      return { left: metaRect.left, right: metaRect.right, viewportLeft: viewportRect.left, viewportRight: viewportRect.right };
    });
    expect(trailLabel).not.toBeNull();
    expect(trailLabel.left).toBeGreaterThanOrEqual(trailLabel.viewportLeft);
    expect(trailLabel.right).toBeLessThanOrEqual(trailLabel.viewportRight);

    for (const [label, surfaceSelector] of pages) {
      await pageButton(page, label).click();
      const surface = page.locator(surfaceSelector);
      await expect(surface).toBeVisible();
      const layout = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(viewport.width);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
  }

  await page.setViewportSize(viewports[0]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await pageButton(page, "设置").click();
  const backupLink = page.locator('.nv-settings-subnav a[href="#nv-backup"]');
  const exportBackup = page.locator(".nv-settings-panel--backup").getByRole("button", { name: "导出备份" });
  const clearData = page.locator(".nv-settings-panel--danger").getByRole("button", { name: "清空当前数据" });

  await backupLink.click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#nv-backup");
  await expect(exportBackup).toBeInViewport();
  await exportBackup.focus();
  await expect(exportBackup).toBeFocused();

  await clearData.scrollIntoViewIfNeeded();
  await expect(clearData).toBeInViewport();
  await clearData.focus();
  await expect(clearData).toBeFocused();
});

test("Night Valley remains operable on a high-DPI desktop context", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1487, height: 1058 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await bootTodayReferenceMock(page);
    await page.getByRole("button", { name: "计时", exact: true }).click();
    await expect(page.locator(".nv-focus-brief")).toBeVisible();
    await expect(page.locator(".nv-focus-panel")).toBeVisible();
    await expect(page.locator(".nv-focus-panel .timer-readout")).toBeVisible();
    await expect(page.locator(".nv-focus-route")).toHaveCount(0);
    await expect(page.locator(".nv-focus-footer")).toHaveCount(0);
    await expect(page.locator(".command-trigger")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1487);
  } finally {
    await context.close();
  }
});

test("Night Valley timer fullscreen keeps the working workspace readable", async ({ page }) => {
  const viewport = { width: 2560, height: 1368 };
  await page.setViewportSize(viewport);
  await bootTodayReferenceMock(page, { recordCount: 7 });
  await page.getByRole("button", { name: "计时", exact: true }).click();

  const bounds = await page.evaluate(() => {
    const selectors = [".nv-focus-panel", ".nv-focus-brief"];
    return Object.fromEntries(selectors.map((selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return [selector, rect ? { top: rect.top, bottom: rect.bottom, right: rect.right } : null];
    }));
  });

  await expect(page.locator(".nv-focus-panel .timer-readout")).toBeVisible();
  await expect(page.locator(".nv-focus-brief")).toBeVisible();
  await expect(page.locator(".nv-focus-footer")).toHaveCount(0);
  await expect(page.locator(".nv-focus-route")).toHaveCount(0);
  await expect(page.locator(".nv-page-heading__clock")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  expect(bounds[".nv-focus-panel"].bottom).toBeLessThanOrEqual(viewport.height);
  expect(bounds[".nv-focus-panel"].right).toBeLessThanOrEqual(viewport.width);
  expect(bounds[".nv-focus-brief"].bottom).toBeLessThanOrEqual(viewport.height);
  expect(bounds[".nv-focus-brief"].right).toBeLessThanOrEqual(viewport.width);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: "output/playwright/night-valley-timer-fullscreen.png", animations: "disabled" });
});

test("Night Valley timer centers the records link label across viewport sizes", async ({ page }) => {
  await bootTodayReferenceMock(page, { recordCount: 7 });
  await page.getByRole("button", { name: "计时", exact: true }).click();

  for (const viewport of [
    { width: 2560, height: 1368 },
    { width: 1024, height: 768 },
    { width: 540, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => {
      const button = document.querySelector(".nv-focus-records-link");
      const label = button?.querySelector("span");
      const icon = button?.querySelector("svg");
      const read = (element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, center: rect.left + rect.width / 2 } : null;
      };
      const buttonRect = read(button);
      const labelRect = read(label);
      const iconRect = read(icon);
      return buttonRect && labelRect && iconRect
        ? {
            button: buttonRect,
            label: labelRect,
            icon: iconRect,
            labelOffset: Math.abs(labelRect.center - buttonRect.center),
          }
        : null;
    });

    expect(metrics).not.toBeNull();
    expect(metrics.labelOffset, JSON.stringify({ viewport, metrics })).toBeLessThanOrEqual(1);
    expect(metrics.icon.left).toBeGreaterThan(metrics.label.right);
    expect(metrics.icon.right).toBeLessThanOrEqual(metrics.button.right - 10);
    expect(metrics.button.right).toBeLessThanOrEqual(viewport.width);
  }
});

test("Night Valley timer keeps a one-hour readout separate from session facts", async ({ page }) => {
  const viewport = { width: 2560, height: 1368 };
  await page.setViewportSize(viewport);
  await bootTodayReferenceMock(page, { recordCount: 7 });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "60 分钟", exact: true }).click();

  const timer = page.locator(".nv-focus-panel__timer");
  await expect(timer).toContainText("01:00:00");
  const metrics = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null;
    };
    return {
      timer: read(".nv-focus-panel__timer"),
      readout: read(".nv-focus-panel__timer > strong"),
      session: read(".nv-focus-panel__session-data"),
      status: read(".nv-focus-panel__status"),
    };
  });

  expect(metrics.timer).not.toBeNull();
  expect(metrics.readout).not.toBeNull();
  expect(metrics.session).not.toBeNull();
  expect(metrics.status).not.toBeNull();
  expect(metrics.readout.bottom).toBeLessThanOrEqual(metrics.session.top - 8);
  expect(metrics.session.bottom).toBeLessThanOrEqual(metrics.status.top - 8);
  await page.screenshot({ path: "output/playwright/night-valley-timer-one-hour.png", animations: "disabled" });
});

test("Night Valley timer survives a scaled fullscreen CSS viewport", async ({ page }) => {
  // A 2560px physical fullscreen at 150% Windows scaling is about 1707 CSS px.
  const viewport = { width: 1707, height: 912 };
  await page.setViewportSize(viewport);
  await bootTodayReferenceMock(page, { recordCount: 7 });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "60 分钟", exact: true }).click();

  const timer = page.locator(".nv-focus-panel__timer");
  await expect(timer).toContainText("01:00:00");
  const metrics = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null;
    };
    return {
      timer: read(".nv-focus-panel__timer"),
      readout: read(".nv-focus-panel__timer > strong"),
      session: read(".nv-focus-panel__session-data"),
      status: read(".nv-focus-panel__status"),
      panel: read(".nv-focus-panel"),
      panelScroll: (() => {
        const element = document.querySelector(".nv-focus-panel");
        return element ? { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight } : null;
      })(),
    };
  });

  expect(metrics.readout).not.toBeNull();
  expect(metrics.session).not.toBeNull();
  expect(metrics.status).not.toBeNull();
  expect(metrics.panel).not.toBeNull();
  expect(metrics.panelScroll).not.toBeNull();
  expect(metrics.readout.bottom).toBeLessThanOrEqual(metrics.session.top - 8);
  expect(metrics.session.bottom).toBeLessThanOrEqual(metrics.status.top - 8);
  expect(metrics.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(metrics.panelScroll.scrollHeight).toBeLessThanOrEqual(metrics.panelScroll.clientHeight);
  await page.screenshot({ path: "output/playwright/night-valley-timer-scaled-fullscreen.png", animations: "disabled" });
});

test("REFINE-19 SHELL-01 keeps shared window controls usable on every Editorial Paper tab", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  await page.evaluate(() => {
    const nativeInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__epShellCommands = [];
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      window.__epShellCommands.push(command);
      return nativeInvoke(command, args);
    };
  });

  const pages = [
    ["今日", ".ep-today-page"],
    ["计时", ".ep-focus-page"],
    ["待办", ".ep-todos-page"],
    ["记录", ".ep-records-page"],
    ["设置", ".ep-settings-page"],
  ];
  const expectedControls = [
    ["最小化窗口", "minimize_main_window"],
    ["最大化或还原窗口", "toggle_maximize_main_window"],
    ["关闭窗口", "close_main_window"],
  ];
  for (const [index, [label, selector]] of pages.entries()) {
    if (index > 0) await pageButton(page, label).click();
    await expect(page.locator(selector)).toBeVisible();
    const controls = page.locator(".window-controls");
    const buttons = controls.locator(".window-control");
    await expect(buttons).toHaveCount(3);
    await expect(controls).not.toHaveAttribute("data-tauri-drag-region", /.+/);
    for (const [buttonIndex, [ariaLabel, command]] of expectedControls.entries()) {
      const button = buttons.nth(buttonIndex);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("aria-label", ariaLabel);
      await expect(button).not.toHaveAttribute("data-tauri-drag-region", /.+/);
      await button.click();
      await expect.poll(() => page.evaluate((expectedCommand) => window.__epShellCommands.filter((item) => item === expectedCommand).length, command)).toBe(index + 1);
    }
  }
  const commands = await page.evaluate(() => window.__epShellCommands);
  expect(commands.filter((command) => command === "minimize_main_window")).toHaveLength(5);
  expect(commands.filter((command) => command === "toggle_maximize_main_window")).toHaveLength(5);
  expect(commands.filter((command) => command === "close_main_window")).toHaveLength(5);
  await page.screenshot({ path: "output/qa/REFINE-19/SHELL-01-pass-1487.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 SHELL-02 keeps a live date and clock synchronized across Editorial Paper tabs", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const startEpoch = NativeDate.parse("2026-09-05T12:00:00+08:00");
    const startPerformance = performance.now();
    class LiveReferenceDate extends NativeDate {
      constructor(...args) {
        super(...(args.length === 0 ? [startEpoch + (performance.now() - startPerformance)] : args));
      }

      static now() {
        return startEpoch + (performance.now() - startPerformance);
      }
    }

    window.Date = LiveReferenceDate;
  });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", freezeClock: false });
  const pages = [
    ["今日", ".ep-today-page"],
    ["计时", ".ep-focus-page"],
    ["待办", ".ep-todos-page"],
    ["记录", ".ep-records-page"],
    ["设置", ".ep-settings-page"],
  ];
  const readings = [];
  for (const [index, [label, selector]] of pages.entries()) {
    if (index > 0) await pageButton(page, label).click();
    await expect(page.locator(selector)).toBeVisible();
    const clock = page.locator('time[aria-label^="当前时间"]');
    const date = page.locator(".ep-date-time__date");
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    const initialClock = await clock.textContent();
    await expect.poll(() => clock.textContent(), { timeout: 3500 }).not.toBe(initialClock);
    readings.push(await page.locator(".ep-date-time").evaluate((element) => ({
      date: element.querySelector(".ep-date-time__date")?.textContent ?? "",
      clock: element.querySelector(".ep-date-time__clock")?.textContent ?? "",
      dateFont: getComputedStyle(element.querySelector(".ep-date-time__date")).fontFamily,
      clockFont: getComputedStyle(element.querySelector(".ep-date-time__clock")).fontFamily,
    })));
  }
  expect(new Set(readings.map((item) => item.date)).size).toBe(1);
  expect(readings.every((item) => /^\d{2}:\d{2}:\d{2}$/.test(item.clock))).toBe(true);
  expect(new Set(readings.map((item) => item.dateFont)).size).toBe(1);
  expect(new Set(readings.map((item) => item.clockFont)).size).toBe(1);
  expect(readings.every((item) => item.dateFont !== item.clockFont)).toBe(true);
  await page.screenshot({ path: "output/qa/REFINE-19/SHELL-02-pass-settings.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 SHELL-03 hides the visual command entry without removing Ctrl+K", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  for (const [index, [label, selector]] of [
    ["今日", ".ep-today-page"],
    ["计时", ".ep-focus-page"],
    ["待办", ".ep-todos-page"],
    ["记录", ".ep-records-page"],
    ["设置", ".ep-settings-page"],
  ].entries()) {
    if (index > 0) await pageButton(page, label).click();
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(".command-trigger")).toBeHidden();
  }
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.screenshot({ path: "output/qa/REFINE-19/SHELL-03-pass-settings.png", animations: "disabled", fullPage: true });
  await page.keyboard.press("Escape");
});

test("REFINE-19 SHELL-04 keeps the Editorial Paper daily focus line visible and wrap-safe", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏" });
  const line = page.getByRole("complementary", { name: "今日一句 · 页边手记" });
  const quote = line.locator(".daily-focus-line__quote");
  await expect(line).toBeVisible();
  await expect(quote).not.toHaveText(/^“”$/);
  await page.screenshot({ path: "output/qa/REFINE-19/SHELL-04-pass-1487.png", animations: "disabled", fullPage: true });

  for (const [width, height] of [[1487, 1058], [420, 720]]) {
    await page.setViewportSize({ width, height });
    const evidence = await line.evaluate((element) => {
      const quote = element.querySelector(".daily-focus-line__quote");
      if (!quote) return null;
      quote.textContent = `“${"这是一段用于检验每日一句在编辑纸页中长文本换行和可见性的压力语料。".repeat(4)}”`;
      const lineRect = element.getBoundingClientRect();
      const quoteRect = quote.getBoundingClientRect();
      return {
        lineTop: lineRect.top,
        lineBottom: lineRect.bottom,
        quoteWidth: quoteRect.width,
        quoteScrollWidth: quote.scrollWidth,
        quoteClientWidth: quote.clientWidth,
        quoteOverflowWrap: getComputedStyle(quote).overflowWrap,
        documentScrollWidth: document.documentElement.scrollWidth,
        documentScrollHeight: document.documentElement.scrollHeight,
      };
    });
    expect(evidence).not.toBeNull();
    expect(evidence.lineTop).toBeGreaterThanOrEqual(0);
    expect(evidence.lineBottom).toBeLessThanOrEqual(evidence.documentScrollHeight);
    expect(evidence.quoteScrollWidth).toBeLessThanOrEqual(evidence.quoteClientWidth);
    expect(evidence.quoteOverflowWrap).toBe("anywhere");
    expect(evidence.documentScrollWidth).toBeLessThanOrEqual(width + 1);
  }
});

test("REFINE-19 adversarial current-data matrix keeps completed nodes, boundary widths, and history copy visible", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });

  const currentLikeTodoTitles = Array.from({ length: 151 }, (_, index) => `南京大学就业场次 ${index + 1}｜2026-09-${String(15 + (index % 10)).padStart(2, "0")} 09:00｜紫金校区招聘场地与入口说明`);
  const completedTitles = Array.from({ length: 5 }, (_, index) => `已完成事项 ${index + 1}：回看完整的节点信息与后续动作`);

  for (const [width, height] of [[1487, 1058], [821, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, {
      expectedHeading: "今日节奏",
      todoTitles: currentLikeTodoTitles,
      completedTodoTitles: completedTitles,
    });

    const today = page.locator(".ep-today-page");
    const completedNodes = today.locator(".ep-completed-notes > span:not(.ep-section-label)");
    if (width === 1487) {
      await page.screenshot({ path: "output/qa/REFINE-19/TODAY-01-adversarial-completed-before.png", animations: "disabled", fullPage: true });
    }
    await expect(completedNodes).toHaveCount(completedTitles.length);
    expect(new Set(await completedNodes.allTextContents())).toEqual(new Set(completedTitles));
    if (width === 1487) {
      await page.screenshot({ path: "output/qa/REFINE-19/TODAY-01-adversarial-completed-after.png", animations: "disabled", fullPage: true });
    }

    await pageButton(page, "待办").click();
    const todos = page.locator(".ep-todos-page");
    await expect(todos.locator(".ep-todo-row")).toHaveCount(currentLikeTodoTitles.length + completedTitles.length);
    const todoEvidence = await todos.evaluate(() => {
      const read = (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
      };
      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        rows: [...document.querySelectorAll(".ep-todo-row")].map((row) => read(row)),
        footer: [...document.querySelectorAll(".ep-todo-footer > *")].map(read),
      };
    });
    expect(todoEvidence.documentScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(todoEvidence.rows.every((row) => row.left >= 0 && row.right <= width + 1)).toBe(true);
    expect(todoEvidence.footer.every((item) => item.left >= 0 && item.right <= width + 1)).toBe(true);
    await page.screenshot({ path: `output/qa/REFINE-19/adversarial-current-todos-${width}.png`, animations: "disabled", fullPage: true });
  }

  const unbrokenTitle = `RECORD-${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(12)}`;
  await page.setViewportSize({ width: 420, height: 720 });
  await bootTodayReferenceMock(page, {
    expectedHeading: "今日节奏",
    recordCount: 3,
    recordDates: [referenceDate, referenceDate, referenceDate],
    recordTitlePrefix: unbrokenTitle,
  });
  await pageButton(page, "记录").click();
  const records = page.locator(".ep-records-page");
  const historyDay = records.locator(".ep-full-history details").first();
  if (!(await historyDay.evaluate((element) => element.open))) {
    await historyDay.locator("summary").click();
  }
  await expect(historyDay.locator(":scope > div")).toBeVisible();
  const historyEvidence = await historyDay.locator(":scope > div").evaluate((element) => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    items: [...element.querySelectorAll("span")].map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, right: rect.right, clientWidth: item.clientWidth, scrollWidth: item.scrollWidth };
    }),
  }));
  await page.screenshot({ path: "output/qa/REFINE-19/adversarial-unbroken-history-before-420.png", animations: "disabled", fullPage: true });
  expect(historyEvidence.documentScrollWidth).toBeLessThanOrEqual(421);
  expect(historyEvidence.items.every((item) => item.left >= 0 && item.right <= 421 && item.scrollWidth <= item.clientWidth)).toBe(true);
  await page.screenshot({ path: "output/qa/REFINE-19/adversarial-unbroken-history-420.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 adversarial boundary matrix keeps every Editorial Paper surface inside the viewport", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });

  const longTodoTitle = "南京大学就业场次｜2026-09-15 09:00｜紫金校区招聘场地与入口说明和现场核对";
  for (const [width, height] of [[821, 720], [420, 720]]) {
    await page.setViewportSize({ width, height });
    await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: [longTodoTitle] });
    for (const [index, [label, selector]] of [
      ["今日", ".ep-today-page"],
      ["计时", ".ep-focus-page"],
      ["待办", ".ep-todos-page"],
      ["记录", ".ep-records-page"],
      ["设置", ".ep-settings-page"],
    ].entries()) {
      if (index > 0) await pageButton(page, label).click();
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      await page.screenshot({ path: `output/qa/REFINE-19/adversarial-boundary-${label}-${width}.png`, animations: "disabled", fullPage: true });
      const evidence = await surface.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          documentScrollWidth: document.documentElement.scrollWidth,
          surfaceRight: rect.right,
          viewportWidth: innerWidth,
        };
      });
      // The focus note keeps its intentional paper rotation; Chromium reports
      // up to two antialiasing pixels beyond the viewport at the 821px edge.
      expect(evidence.documentScrollWidth).toBeLessThanOrEqual(width + 3);
      expect(evidence.surfaceRight).toBeLessThanOrEqual(width + 1);
    }

    await pageButton(page, "今日").click();
    await page.locator(".ep-field-row").first().click();
    const focus = page.locator(".ep-focus-page");
    await expect(focus).toBeVisible();
    await expect(focus.locator(".ep-note-paper__linked")).toContainText(longTodoTitle);
    await focus.getByRole("button", { name: "开始专注", exact: true }).click();
    await expect(focus).toContainText("倒计时中");
    const focusEvidence = await focus.evaluate(() => {
      const read = (selector) => [...document.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, text: element.textContent?.trim() ?? "" };
      });
      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        footer: read(".ep-focus-footer > *"),
        linked: read(".ep-note-paper__linked"),
      };
    });
    expect(focusEvidence.documentScrollWidth).toBeLessThanOrEqual(width + 3);
    expect(focusEvidence.footer.every((item) => item.left >= 0 && item.right <= width + 1)).toBe(true);
    expect(focusEvidence.linked.every((item) => item.left >= 0 && item.right <= width + 1)).toBe(true);
    expect(focusEvidence.footer.some((item) => item.text.includes(longTodoTitle))).toBe(true);
    await page.screenshot({ path: `output/qa/REFINE-19/adversarial-boundary-focus-${width}.png`, animations: "disabled", fullPage: true });
  }
});

test("REFINE-19 adversarial next-page card keeps an unbroken user title visible", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  const unbrokenTitle = `TODO-${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(12)}`;
  await page.setViewportSize({ width: 420, height: 720 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: [unbrokenTitle] });
  const card = page.locator(".ep-next-card");
  const title = card.locator("h2");
  const evidence = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      text: element.textContent ?? "",
      left: rect.left,
      right: rect.right,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflow: style.overflow,
      overflowWrap: style.overflowWrap,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  });
  await page.screenshot({ path: "output/qa/REFINE-19/adversarial-next-card-unbroken-before-420.png", animations: "disabled", fullPage: true });
  expect(evidence.text).toBe(unbrokenTitle);
  expect(evidence.scrollWidth).toBeLessThanOrEqual(evidence.clientWidth);
  expect(evidence.overflowWrap).toBe("anywhere");
  expect(evidence.left).toBeGreaterThanOrEqual(0);
  expect(evidence.right).toBeLessThanOrEqual(421);
  expect(evidence.documentScrollWidth).toBeLessThanOrEqual(421);
  await page.screenshot({ path: "output/qa/REFINE-19/adversarial-next-card-unbroken-420.png", animations: "disabled", fullPage: true });
});

test("REFINE-19 TODAY-01 adversarial narrow view keeps todo importance visible", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.theme", "editorial-paper");
  });
  await page.setViewportSize({ width: 420, height: 720 });
  await bootTodayReferenceMock(page, { expectedHeading: "今日节奏", todoTitles: ["检查窄屏节点的优先级信息"] });
  const row = page.locator(".ep-field-row").first();
  const importance = row.locator(".ep-field-row__importance-mobile");
  const evidence = await importance.evaluate((element) => ({
    text: element.textContent ?? "",
    display: getComputedStyle(element).display,
    rect: (() => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    })(),
  }));
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-01-adversarial-importance-before-420.png", animations: "disabled", fullPage: true });
  expect(evidence.text).toBe(" · 中");
  expect(evidence.display).not.toBe("none");
  expect(evidence.rect.width).toBeGreaterThan(0);
  expect(evidence.rect.height).toBeGreaterThan(0);
  await page.screenshot({ path: "output/qa/REFINE-19/TODAY-01-adversarial-importance-420.png", animations: "disabled", fullPage: true });
});
