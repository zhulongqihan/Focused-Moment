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

async function bootTodayReferenceMock(page, { expectedHeading = "今天，从一件事开始", recordCount = 7 } = {}) {
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

  await page.addInitScript(({ today, recordCount }) => {
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
      const title = recordCount > focusRecordSeeds.length ? `${seedTitle} ${index + 1}` : seedTitle;
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
      completedAt: `${today}T${completedTime}:00`,
      completedDate: today,
      completedTime,
      };
    });

    let todos = [{
      id: 101,
      title: "明日规划",
      isCompleted: false,
      scheduledDate: today,
      scheduledTime: "21:00",
      importanceKey: "medium",
    }];

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
      pendingTodoCount: 1,
      completedTodoCount: 0,
      activeDays: 9,
      averageDailyDurationLabel: "00:35:00",
      todayFocusDurationLabel: "05:15:00",
      todaySessionCount: focusRecords.length,
      currentStreakDays: 9,
      bestFocusDate: today,
      bestFocusDurationLabel: "05:15:00",
      dailyBreakdown: [],
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
            timer = { ...timer, isRunning: true, status: "倒计时中", canCompleteSession: true };
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
  }, { today: referenceDate, recordCount });

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
  await expect(page.getByRole("button", { name: "开始下一件事" })).toBeVisible();
  await page.screenshot({ path: "output/playwright/today-after.png", animations: "disabled" });
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
    const panel = layout.find((item) => item.className === "trail-focus-panel");
    expect(panel.right).toBeLessThanOrEqual(width);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    if (width <= 1160) {
      expect(panel.y).toBeLessThan(map.bottom);
      expect(panel.bottom).toBeLessThanOrEqual(height);
      await expect(page.locator(".trail-nav__brand")).toBeVisible();
      await expect(page.locator(".trail-nav__icon").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "开始下一件事" })).toBeVisible();
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

  await expect(page.locator(".nv-records-range")).toContainText("8月30日 — 9月5日");
  await expect(page.locator(".nv-records-range")).toBeDisabled();
  await expect(page.locator(".nv-records-trend h2")).toHaveText("最近 7 天，平均每天 00:45:00。");
  await expect(page.locator(".records-archive__stats")).toContainText("活跃日平均 00:35:00");
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

test("Timer route follows a tighter winding concept path", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "计时", exact: true }).click();

  const geometry = await page.locator(".nv-focus-route").evaluate((route) => {
    const routeRect = route.getBoundingClientRect();
    const points = [...route.querySelectorAll(".nv-focus-route__point")].map((point) => {
      const rect = point.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - routeRect.left,
        y: rect.top + rect.height / 2 - routeRect.top,
      };
    });
    const labels = [...route.querySelectorAll(".nv-focus-route__labels span")].map((label) => (
      label.getBoundingClientRect().top - routeRect.top
    ));
    return {
      points,
      labels,
      path: route.querySelector(".nv-focus-route__line")?.getAttribute("d") ?? "",
    };
  });

  expect(geometry.points).toHaveLength(7);
  expect(geometry.points[6].y).toBeGreaterThan(geometry.points[0].y + 180);
  expect(geometry.points[4].x).toBeGreaterThan(geometry.points[3].x + 180);
  expect(geometry.points[5].y).toBeLessThan(geometry.points[4].y);
  expect(geometry.points[6].x).toBeGreaterThan(geometry.points[5].x);
  expect((geometry.path.match(/\bC\b/g) ?? []).length).toBe(6);
  expect(geometry.labels[3]).toBeLessThan(340);
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
  await page.getByRole("button", { name: "保存外观设置", exact: true }).click();
  await expect(page.locator(".app-message--success")).toContainText("下次启动会继续使用");
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
    await page.getByRole("button", { name: "开始下一件事", exact: true }).click();
    await expect(page.locator(".ep-today-timer-strip")).toContainText("正在专注");
  }
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

test("Night Valley appearance settings apply live and persist after explicit save", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();

  const app = page.locator(".minimal-app");
  await expect(page.getByLabel("视觉强调")).toHaveValue("72");
  await expect(page.getByLabel("动效强度")).toHaveValue("44");
  await expect(app).toHaveAttribute("data-density", "roomy");
  await expect(app).toHaveAttribute("data-motion", "subtle");

  for (const [label, value] of [["视觉强调", "20"], ["动效强度", "0"]]) {
    await page.getByLabel(label).evaluate((input, nextValue) => {
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  await page.getByRole("button", { name: "紧凑", exact: true }).click();

  await expect(app).toHaveAttribute("data-density", "compact");
  await expect(app).toHaveAttribute("data-motion", "off");
  const liveStyle = await app.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      intensity: style.getPropertyValue("--nv-visual-intensity").trim(),
      opacity: Number(style.getPropertyValue("--nv-visual-opacity").trim()),
    };
  });
  expect(Number(liveStyle.intensity)).toBeCloseTo(0.2, 3);
  expect(liveStyle.opacity).toBeCloseTo(0.64, 3);

  await page.getByRole("button", { name: "保存外观设置", exact: true }).click();
  await expect(page.locator(".app-message--success")).toContainText("下次启动会继续使用");
  await expect.poll(() => page.evaluate(() => ({
    theme: window.localStorage.getItem("focused-moment.theme"),
    visual: window.localStorage.getItem("focused-moment.visual-intensity"),
    motion: window.localStorage.getItem("focused-moment.motion-intensity"),
    density: window.localStorage.getItem("focused-moment.density"),
  }))).toEqual({
    theme: "night-valley",
    visual: "20",
    motion: "0",
    density: "compact",
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("视觉强调")).toHaveValue("20");
  await expect(page.getByLabel("动效强度")).toHaveValue("0");
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-density", "compact");
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-motion", "off");
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
  await page.getByRole("button", { name: "保存外观设置", exact: true }).click();

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
    await expect(page.locator(".nv-chronograph")).toBeVisible();
    await expect(page.locator(".nv-focus-panel")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1487);
  } finally {
    await context.close();
  }
});
