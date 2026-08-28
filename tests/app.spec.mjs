import { expect, test } from "@playwright/test";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function bootWithTauriMock(page, { includeOverdue = false, windowLabel = "main", pausedFocus = false } = {}) {
  await page.addInitScript(({ today, includeOverdue, windowLabel, pausedFocus }) => {
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = yesterday.toISOString().slice(0, 10);
    let todos = [
      {
        id: 1,
        title: "写完产品复盘",
        isCompleted: false,
        scheduledDate: today,
        scheduledTime: "10:00",
        importanceKey: "high",
      },
    ];
    if (includeOverdue) {
      todos.push({
        id: 2,
        title: "过期事项",
        isCompleted: false,
        scheduledDate: overdueDate,
        scheduledTime: "",
        importanceKey: "medium",
      });
    }
    window.__todoItemsCalls = 0;
    let timer = {
      modeKey: "stopwatch",
      phaseKey: "stopwatch",
      mode: "正向计时",
      phaseLabel: "正向计时",
      status: "待开始",
      isRunning: false,
      elapsedMs: pausedFocus ? 30_000 : 0,
      elapsedLabel: pausedFocus ? "00:00:30" : "00:00:00",
      targetDurationMs: 25 * 60 * 1000,
      remainingMs: null,
      secondaryLabel: "已累计时长",
      canCompleteSession: true,
      activeTaskTitle: pausedFocus ? "写完产品复盘" : "",
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
      pendingTodoCount: todos.length,
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
        currentWindow: { label: windowLabel },
        currentWebview: { label: windowLabel },
      },
      invoke: async (command, args = {}) => {
        switch (command) {
          case "get_timer_snapshot":
            return timer;
          case "get_todo_items":
            window.__todoItemsCalls += 1;
            return todos;
          case "get_focus_records":
            return [];
          case "get_analytics_snapshot":
            return analytics;
          case "update_todo_item":
            todos = todos.map((item) => item.id === args.id
              ? {
                  ...item,
                  title: args.title,
                  scheduledDate: args.scheduledDate,
                  scheduledTime: args.scheduledTime,
                  importanceKey: args.importanceKey,
                }
              : item);
            return todos;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id
              ? { ...item, isCompleted: !item.isCompleted }
              : item);
            return todos;
          case "list_app_backups":
            return [];
          case "start_timer":
            timer = { ...timer, isRunning: true, status: "正向计时中" };
            return timer;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "reset_timer":
          case "update_timer_context":
            return timer;
          case "switch_timer_mode":
            timer = {
              ...timer,
              modeKey: args.mode,
              mode: args.mode === "countdown" ? "倒计时" : "正向计时",
              phaseKey: args.mode,
              phaseLabel: args.mode === "countdown" ? "倒计时" : "正向计时",
              targetDurationMs: args.mode === "countdown" ? 25 * 60 * 1000 : null,
              remainingMs: args.mode === "countdown" ? 25 * 60 * 1000 : null,
            };
            return timer;
          case "set_countdown_minutes":
            timer = {
              ...timer,
              targetDurationMs: Number(args.minutes) * 60 * 1000,
              remainingMs: Number(args.minutes) * 60 * 1000,
            };
            return timer;
          default:
            return null;
        }
      },
    };
  }, { today: localDate(), includeOverdue, windowLabel, pausedFocus });

  await page.goto("/");
  if (windowLabel === "main") {
    await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
  }
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

test("countdown duration keeps the user value while timer snapshots refresh", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();

  const durationInput = page.locator('input[name="countdownMinutes"]');
  await durationInput.fill("60");
  await page.waitForTimeout(1200);

  await expect(durationInput).toHaveValue("60");
});

test("stopwatch shows the next staged target instead of a one-minute target", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".timer-readout")).toContainText("下一阶段目标：25 分钟");
  await expect(page.locator(".timer-readout")).not.toContainText("1 分钟");
});

test("paused focus floating window can continue without returning to the main window", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-float", pausedFocus: true });

  await expect(page.getByRole("button", { name: "继续" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "暂停" })).toBeHidden();

  await page.getByRole("button", { name: "继续" }).click();

  await expect(page.getByRole("button", { name: "暂停" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "继续" })).toBeHidden();
});

test("todo editor saves a date selected from the native date picker", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: /^待办/ }).click();
  await page.getByRole("button", { name: "编辑" }).click();

  const todoItemsCallsBeforeWaiting = await page.evaluate(() => window.__todoItemsCalls);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__todoItemsCalls)).toBe(todoItemsCallsBeforeWaiting);

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

test("completing a todo keeps it visible in the completed section", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: /^待办/ }).click();
  await page.getByRole("button", { name: "标记“写完产品复盘”完成" }).click();

  await expect(page.locator(".completed-section")).toContainText("写完产品复盘");
  await expect(page.locator(".app-message")).toContainText("已完成“写完产品复盘”");
});

test("overdue todos are shown in their own status section", async ({ page }) => {
  await bootWithTauriMock(page, { includeOverdue: true });

  await page.getByRole("button", { name: /^待办/ }).click();

  const overdueSection = page.locator(".todo-status-section--overdue");
  await expect(page.getByRole("heading", { name: "已过期" })).toBeVisible();
  await expect(overdueSection).toContainText("过期事项");
  await expect(overdueSection.getByRole("button", { name: "编辑" })).toBeVisible();

  await overdueSection.getByRole("button", { name: "标记“过期事项”完成" }).click();
  await expect(page.locator(".completed-section")).toContainText("过期事项");
  await expect(overdueSection).toBeHidden();
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
