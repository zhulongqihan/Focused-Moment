import { expect, test } from "@playwright/test";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function bootWithTauriMock(page, { includeOverdue = false, includeRecords = false, windowLabel = "main", pausedFocus = false, completedCountdown = false } = {}) {
  await page.addInitScript(({ today, includeOverdue, includeRecords, windowLabel, pausedFocus, completedCountdown }) => {
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterdayDate = dateKey(yesterday);
    const overdueDate = yesterdayDate;
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
    let focusRecords = includeRecords ? [
      {
        id: 3,
        title: "完成产品复盘",
        durationMs: 45 * 60 * 1000,
        durationLabel: "00:45:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: 1,
        linkedTodoTitle: "写完产品复盘",
        completedAt: `${today}T11:30:00`,
        completedDate: today,
        completedTime: "11:30",
      },
      {
        id: 2,
        title: "整理研究资料",
        durationMs: 30 * 60 * 1000,
        durationLabel: "00:30:00",
        modeKey: "countdown",
        modeLabel: "倒计时",
        phaseLabel: "倒计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${yesterdayDate}T22:40:00`,
        completedDate: yesterdayDate,
        completedTime: "22:40",
      },
      {
        id: 1,
        title: "阅读行业报告",
        durationMs: 15 * 60 * 1000,
        durationLabel: "00:15:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${yesterdayDate}T21:10:00`,
        completedDate: yesterdayDate,
        completedTime: "21:10",
      },
    ] : [];
    window.__todoItemsCalls = 0;
    window.__timerSnapshotCalls = 0;
    window.__focusFloatingShown = false;
    window.__focusFloatingUnlocked = false;
    window.__mainWindowDragged = false;
    window.__flashMainWindowAttention = false;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    let timerPreferences = {
      pomodoroFocusMinutes: 25,
      pomodoroBreakMinutes: 5,
      stopwatchReminderMinutes: 25,
      toastReminderEnabled: true,
      windowAttentionReminderEnabled: true,
      soundReminderEnabled: true,
      alertSoundKey: "soft_chime",
    };
    let timer = {
      modeKey: completedCountdown ? "countdown" : "stopwatch",
      phaseKey: completedCountdown ? "countdown" : "stopwatch",
      mode: completedCountdown ? "倒计时" : "正向计时",
      phaseLabel: completedCountdown ? "倒计时" : "正向计时",
      status: completedCountdown ? "已结束" : "待开始",
      isRunning: false,
      elapsedMs: completedCountdown ? 60 * 60 * 1000 : pausedFocus ? 30_000 : 0,
      elapsedLabel: completedCountdown ? "00:00:00" : pausedFocus ? "00:00:30" : "00:00:00",
      targetDurationMs: completedCountdown ? 60 * 60 * 1000 : 25 * 60 * 1000,
      remainingMs: completedCountdown ? 0 : null,
      secondaryLabel: completedCountdown ? "本轮剩余时间" : "已累计时长",
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
      alertKey: completedCountdown ? "countdown_complete" : null,
      alertTitle: completedCountdown ? "倒计时已结束" : null,
      alertMessage: completedCountdown ? "倒计时已完成，已累计专注 60 分钟。点击“保存并记录”后写入专注记录。" : null,
    };
    window.__replaceTimer = (patch) => {
      timer = { ...timer, ...patch };
    };
    const analytics = {
      totalFocusDurationMs: focusRecords.reduce((total, record) => total + record.durationMs, 0),
      totalFocusDurationLabel: includeRecords ? "01:30:00" : "0 分钟",
      sessionCount: focusRecords.length,
      linkedSessionCount: includeRecords ? 1 : 0,
      independentSessionCount: includeRecords ? 2 : 0,
      pendingTodoCount: todos.length,
      completedTodoCount: 0,
      activeDays: includeRecords ? 2 : 0,
      averageDailyDurationLabel: includeRecords ? "00:45:00" : "0 分钟",
      todayFocusDurationLabel: includeRecords ? "00:45:00" : "0 分钟",
      todaySessionCount: includeRecords ? 1 : 0,
      currentStreakDays: includeRecords ? 2 : 0,
      bestFocusDate: includeRecords ? today : null,
      bestFocusDurationLabel: includeRecords ? "00:45:00" : null,
      dailyBreakdown: includeRecords ? [
        {
          date: today,
          totalDurationMs: 45 * 60 * 1000,
          totalDurationLabel: "00:45:00",
          sessionCount: 1,
          linkedSessionCount: 1,
          independentSessionCount: 0,
        },
        {
          date: yesterdayDate,
          totalDurationMs: 45 * 60 * 1000,
          totalDurationLabel: "00:45:00",
          sessionCount: 2,
          linkedSessionCount: 0,
          independentSessionCount: 2,
        },
      ] : [],
    };

    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: windowLabel },
        currentWebview: { label: windowLabel },
      },
      transformCallback: (callback) => {
        window.__floatingWorkspaceEventCallback = callback;
        return 1;
      },
      invoke: async (command, args = {}) => {
        switch (command) {
          case "plugin:event|listen":
            return 1;
          case "plugin:event|unlisten":
            return null;
          case "get_timer_snapshot":
            window.__timerSnapshotCalls += 1;
            return timer;
          case "get_timer_preferences":
            return timerPreferences;
          case "get_todo_items":
            window.__todoItemsCalls += 1;
            return todos;
          case "get_focus_records":
            return focusRecords;
          case "update_focus_record_title":
            focusRecords = focusRecords.map((record) => record.id === args.id
              ? { ...record, title: args.title }
              : record);
            return focusRecords;
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
          case "show_focus_floating":
            window.__focusFloatingShown = true;
            return null;
          case "unlock_focus_floating":
            window.__focusFloatingUnlocked = true;
            return null;
          case "start_dragging_main_window":
            window.__mainWindowDragged = true;
            return null;
          case "flash_main_window_attention":
            window.__flashMainWindowAttention = true;
            return null;
          case "update_timer_preferences":
            timerPreferences = args.preferences;
            return timerPreferences;
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
  }, { today: localDate(), includeOverdue, includeRecords, windowLabel, pausedFocus, completedCountdown });

  await page.goto("/");
  if (windowLabel === "main") {
    await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  } else if (windowLabel === "todo-unlock" || windowLabel === "focus-unlock") {
    await expect(page.getByRole("button", { name: /解除.*锁定/ })).toBeVisible();
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

test("main window keeps its top bar available while scrolling and exposes a drag surface", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await expect(page.locator(".app-bar")).toHaveCSS("position", "sticky");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(".app-bar")).toBeVisible();

  await page.locator(".app-bar").click({ position: { x: 220, y: 24 } });
  await expect.poll(() => page.evaluate(() => window.__mainWindowDragged)).toBe(true);
});

test("countdown duration keeps the user value while timer snapshots refresh", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();

  const durationInput = page.locator('input[name="countdownMinutes"]');
  await durationInput.fill("60");
  await page.waitForTimeout(1200);

  await expect(durationInput).toHaveValue("60");
  await expect(page.locator(".timer-readout strong")).toHaveText("01:00:00");
});

test("starting a countdown opens the floating workspace", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();
  await page.locator('input[name="countdownMinutes"]').fill("60");
  await page.locator('input[name="sessionTitle"]').fill("完成季度复盘");
  await page.getByRole("button", { name: "开始", exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__focusFloatingShown)).toBe(true);
});

test("floating workspace switches between todos and the active timer", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const todoTab = page.locator(".floating-tab").filter({ hasText: "待办" });
  const timerTab = page.locator(".floating-tab").filter({ hasText: "当前计时" });
  await expect(todoTab).toBeVisible();
  await expect(timerTab).toBeVisible();
  await expect(timerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".floating-timer")).toContainText("00:00:30");
  const workspaceHeight = await page.locator(".floating-todo").evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(workspaceHeight).toBeLessThan(420);
  const controlHeights = await page.locator(".floating-timer .focus-floating__controls button").evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().height))
  );
  expect(Math.max(...controlHeights)).toBeLessThan(60);

  await todoTab.click();
  await expect(todoTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".floating-todo__item")).toContainText("写完产品复盘");

  await timerTab.click();
  await expect(page.locator(".floating-timer")).toContainText("写完产品复盘");
});

test("floating workspace can adjust and remember its opacity", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const opacityButton = page.getByRole("button", { name: "调整悬浮窗透明度" });
  await opacityButton.click();
  await expect(page.getByRole("dialog", { name: "悬浮窗透明度" })).toBeVisible();

  const slider = page.getByRole("slider", { name: "悬浮窗透明度" });
  await slider.fill("62");
  await expect(slider).toHaveValue("62");
  await expect(page.locator(".floating-todo")).toHaveCSS("opacity", "0.62");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("focused-moment.floating-window.opacity"))).toBe("62");
});

test("floating timer refreshes its snapshot every second", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const initialCalls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls), { timeout: 2500 }).toBeGreaterThan(initialCalls);
});

test("floating workspace only shows todos when there is no active timer", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float" });

  await expect(page.locator(".floating-tab")).toHaveCount(1);
  await expect(page.locator(".floating-tab").first()).toContainText("待办");
  await expect(page.locator(".floating-tab").filter({ hasText: "当前计时" })).toBeHidden();
});

test("completed countdown clearly offers to save the focus record", async ({ page }) => {
  await bootWithTauriMock(page, { completedCountdown: true });

  await expect(page.getByRole("alert")).toContainText("倒计时已结束");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已累计专注 60 分钟");
  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("已累计专注 60 分钟");
  await expect(page.getByRole("button", { name: "保存并记录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "稍后处理" })).toBeVisible();
});

test("reminder settings expose popup, taskbar and custom sound controls", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();

  await expect(page.getByRole("heading", { name: "结束提醒" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /应用内弹窗/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /任务栏闪烁/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /声音提醒/ })).toBeChecked();
  await expect(page.locator('select[name="alertSoundKey"]')).toHaveValue("soft_chime");
  await expect(page.locator('select[name="alertSoundKey"] option[value="viral_quote"]')).toHaveText("胆子真是肥嘟嘟的（老牧师原声）");
  await page.locator('select[name="alertSoundKey"]').selectOption("viral_quote");
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_timer_preferences"))).toMatchObject({
    alertSoundKey: "viral_quote",
  });

  await page.getByRole("checkbox", { name: /任务栏闪烁/ }).uncheck();
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_timer_preferences"))).toMatchObject({
    windowAttentionReminderEnabled: false,
  });
});

test("records page turns a long history into date groups and achievement insights", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.getByRole("heading", { name: "看见自己留下的节奏" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近 7 天" })).toBeVisible();
  await expect(page.locator(".records-hero__streak strong")).toHaveText("2");
  await expect(page.locator(".records-hero__letter-label")).toHaveText("TODAY / 今日一句");
  await expect(page.locator(".records-hero__dial")).toContainText("3");
  await expect(page.locator(".records-trajectory")).toContainText("你的节奏正在成形");
  await expect(page.locator(".records-stats__progress")).toContainText("0%");
  await expect(page.locator(".record-history__heading")).toContainText("3 轮");

  const recordDays = page.locator(".record-day");
  await expect(recordDays).toHaveCount(2);
  await expect(recordDays.first()).toHaveAttribute("open", "");
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();

  await recordDays.nth(1).locator("summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
});

test("record title can be edited and saved without changing its duration", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();

  const input = record.locator('input[name="editRecordTitle-3"]');
  await expect(input).toHaveValue("完成产品复盘");
  await input.fill("完成季度复盘");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(record).toContainText("完成季度复盘");
  await expect(record).toContainText("00:45:00");
  await expect(record).not.toContainText("完成产品复盘");
  await expect(page.locator(".app-message")).toContainText("专注记录名称已更新");
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

test("focus unlock window exposes a retryable unlock control", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-unlock" });

  const unlockButton = page.getByRole("button", { name: "解除专注锁定，恢复计时操作" });
  await expect(unlockButton).toBeVisible();
  await unlockButton.click();
  await expect.poll(() => page.evaluate(() => window.__focusFloatingUnlocked)).toBe(true);
  await expect(unlockButton).toBeVisible();
});

test("main window clears a stale title after another window finishes the session", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  const sessionTitle = page.locator('input[name="sessionTitle"]');
  await expect(sessionTitle).toHaveValue("写完产品复盘");

  await page.evaluate(() => window.__replaceTimer({
    status: "待开始",
    elapsedMs: 0,
    elapsedLabel: "00:00:00",
    activeTaskTitle: "",
    linkedTodoId: null,
    recoveredFromLastSession: false,
  }));

  await expect.poll(() => sessionTitle.inputValue()).toBe("");
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
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

  const completedRow = page.locator(".completed-row").filter({ hasText: "写完产品复盘" });
  await expect(completedRow).toContainText("已完成");
  await expect(completedRow.locator(".completed-row__marker")).toHaveText("✓");
  await expect(completedRow.locator(".completed-row__title")).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator(".app-message")).toContainText("已完成“写完产品复盘”");
});

test("overdue todos are shown in their own status section", async ({ page }) => {
  await bootWithTauriMock(page, { includeOverdue: true });

  await page.getByRole("button", { name: /^待办/ }).click();

  const overdueSection = page.locator(".todo-status-section--overdue");
  await expect(page.getByRole("heading", { name: "已过期" })).toBeVisible();
  await expect(overdueSection).toContainText("过期事项");
  await expect(overdueSection.locator(".todo-row__overdue-label")).toHaveText("已过期");
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
