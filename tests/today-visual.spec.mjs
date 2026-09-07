import { expect, test } from "@playwright/test";

const referenceDate = "2026-09-05";

async function bootTodayReferenceMock(page) {
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

  await page.addInitScript(({ today }) => {
    const focusRecords = [
      ["晨间计划", "08:10"],
      ["阅读行业报告", "09:35"],
      ["整理研究资料", "11:00"],
      ["完成产品复盘", "13:20"],
      ["拆解交互细节", "15:05"],
      ["写下发布清单", "17:15"],
      ["收束今天的工作", "19:10"],
    ].map(([title, completedTime], index) => ({
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
    }));

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
          case "start_timer":
            timer = { ...timer, isRunning: true, status: "倒计时中", canCompleteSession: true };
            return timer;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "update_timer_context":
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
  }, { today: referenceDate });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
}

test("Today reference composition stays aligned at the concept viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await expect(page.locator(".trail-node")).toHaveCount(8);
  await expect(page.getByText(/今天已完成 7 段专注/)).toBeVisible();
  await expect(page.getByText("连续 9 天", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始下一件事" })).toBeVisible();
  await page.screenshot({ path: "output/playwright/today-after.png" });
});

test("Today route keeps the panel and path usable as the window narrows", async ({ page }) => {
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
    await page.screenshot({ path: screenshotPath });
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
    await page.screenshot({ path: `output/playwright/${screenshotName}` });
  }
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

test("Theme registry exposes one implemented surface and four disabled previews", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootTodayReferenceMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();

  const themeCards = page.locator(".nv-theme-card");
  await expect(themeCards).toHaveCount(5);
  await expect(themeCards.filter({ hasText: "夜谷" })).toBeEnabled();
  await expect(themeCards.filter({ hasText: "夜谷" })).toHaveAttribute("aria-pressed", "true");
  await expect(themeCards.filter({ hasText: "尚未实现" })).toHaveCount(4);
  await expect(themeCards.filter({ hasText: "尚未实现" }).first()).toBeDisabled();
  await expect(themeCards.locator("img")).toHaveCount(5);

  await themeCards.filter({ hasText: "编辑纸页" }).click({ force: true });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await expect(themeCards.filter({ hasText: "夜谷" })).toHaveAttribute("aria-pressed", "true");
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
      await page.screenshot({ path: `output/playwright/night-valley-${label}-${width}.png` });
    }
  }
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
