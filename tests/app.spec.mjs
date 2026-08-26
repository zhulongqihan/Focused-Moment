import { expect, test } from "@playwright/test";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function bootWithTauriMock(page) {
  await page.addInitScript(({ today }) => {
    let todo = {
      id: 1,
      title: "写完产品复盘",
      isCompleted: false,
      scheduledDate: today,
      scheduledTime: "10:00",
      importanceKey: "high",
    };
    const timer = {
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
      secondaryLabel: "已累计时长",
      canCompleteSession: true,
      activeTaskTitle: "",
      linkedTodoId: null,
      completeLinkedTodoOnFinish: false,
      currentRound: 1,
      completedFocusCount: 0,
      completedBreakCount: 0,
      recoveredFromLastSession: false,
      modeSwitchLocked: false,
      modeSwitchHint: null,
      alertSequence: 0,
      alertKey: null,
      alertTitle: null,
      alertMessage: null,
    };
    const analytics = {
      totalFocusDurationMs: 0,
      totalFocusDurationLabel: "0 分钟",
      sessionCount: 0,
      linkedSessionCount: 0,
      independentSessionCount: 0,
      pendingTodoCount: 1,
      completedTodoCount: 0,
      activeDays: 0,
      averageDailyDurationLabel: "0 分钟",
      todayFocusDurationLabel: "0 分钟",
      todaySessionCount: 0,
      currentStreakDays: 0,
      bestFocusDate: null,
      bestFocusDurationLabel: null,
      dailyBreakdown: [],
    };

    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      invoke: async (command, args = {}) => {
        switch (command) {
          case "get_timer_snapshot":
            return timer;
          case "get_todo_items":
            return [todo];
          case "get_focus_records":
            return [];
          case "get_analytics_snapshot":
            return analytics;
          case "update_todo_item":
            todo = {
              ...todo,
              title: args.title,
              scheduledDate: args.scheduledDate,
              scheduledTime: args.scheduledTime,
              importanceKey: args.importanceKey,
            };
            return [todo];
          case "list_app_backups":
            return [];
          case "start_timer":
          case "pause_timer":
          case "reset_timer":
          case "update_timer_context":
          case "switch_timer_mode":
            return timer;
          default:
            return null;
        }
      },
    };
  }, { today: localDate() });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
}

test("Today cockpit exposes the next action and command palette", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect(page.getByText("写完产品复盘").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "开始下一件事" })).toBeVisible();

  await page.getByRole("button", { name: /命令 Ctrl K/ }).click();
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("记录");
  await expect(page.getByRole("option", { name: "打开记录" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeHidden();
  await expect(page.getByRole("button", { name: /命令 Ctrl K/ })).toBeFocused();
});

test("todo editor saves a date selected from the native date picker", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: /^待办/ }).click();
  await page.getByRole("button", { name: "编辑" }).click();

  const dateInput = page.locator('input[name="editTodoDate-1"]');
  const geometry = await page.evaluate(() => {
    const selectors = {
      date: 'input[name="editTodoDate-1"]',
      time: 'input[name="editTodoTime-1"]',
      save: '.todo-edit-form button.primary-button',
    };
    return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      const points = [
        [rect.left + 2, rect.top + rect.height / 2],
        [rect.right - 2, rect.top + rect.height / 2],
      ];
      return [key, {
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        hits: points.map(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 80)),
      }];
    }));
  });
  expect(geometry.date.rect.right).toBeLessThanOrEqual(geometry.time.rect.left);
  expect(geometry.date.hits[1]).toContain('editTodoDate-1');

  const tomorrow = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  });

  await dateInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, tomorrow);
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.locator(".todo-row").getByText("明天截止 · 10:00")).toBeVisible();
});

test("Today cockpit remains usable on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 860 });
  await bootWithTauriMock(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("button", { name: "开始下一件事" })).toBeVisible();
});
