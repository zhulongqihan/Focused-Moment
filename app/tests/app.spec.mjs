import { expect, test } from "@playwright/test";

import { testOutputPath } from "./helpers/test-output.mjs";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


async function openQuickCaptureFromPalette(page) {
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("快速收进收件箱");
  await page.getByRole("option", { name: "快速收进收件箱 记下一件事，不填日期也可以", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "先记下来，稍后再整理" })).toBeVisible();
}

async function openRestoredFocusPlan(page) {
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: /^待办/ }).click();
  const details = page.locator("details.restored-focus-plan");
  await expect(details).not.toHaveAttribute("open");
  await expect(details.locator(".focus-plan-controls")).toBeHidden();
  await details.locator("summary").filter({ hasText: "当前事项和今日精选" }).click();
  await expect(details).toHaveAttribute("open", "");
  const plan = details.getByRole("region", { name: "当前事项和今日精选" });
  await expect(plan).toBeVisible();
  return plan;
}

async function startRestoredCurrentTodo(page) {
  const plan = await openRestoredFocusPlan(page);
  const current = plan.locator(".focus-plan-controls__row.is-current");
  await expect(current).toContainText("写完产品复盘");
  await current.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(async () => {
    const timer = await window.__TAURI_INTERNALS__.invoke("get_timer_snapshot");
    return { running: timer.isRunning, title: timer.activeTaskTitle, linkedTodoId: timer.linkedTodoId };
  })).toEqual({ running: true, title: "写完产品复盘", linkedTodoId: 1 });
  await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: /^待办/ })).toHaveClass(/active/);
}


test("Today cockpit exposes the overview and command palette", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect(page.getByText("写完产品复盘").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-overview-progress-heading strong")).toHaveText("0 / 1");
  await expect(page.locator(".unified-today-page, .continuity-board, .today-continuity-grid")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看计时", exact: true })).toHaveCount(0);
  await expect(page.locator(".trail-node")).toHaveCount(1);
  await expect(page.locator(".trail-node--current")).toContainText("写完产品复盘");

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("记录");
  await expect(page.getByRole("option", { name: "打开记录" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeHidden();
  await expect(page.getByRole("button", { name: "今日", exact: true })).toBeFocused();
});

test("command palette keeps keyboard focus inside the dialog and executes the active option", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "你想做什么？" });
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  const close = page.getByRole("button", { name: "关闭命令面板" });

  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-today");
  await page.keyboard.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-focus");
  await expect(page.getByRole("option", { name: "打开完整计时" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toHaveClass(/active/);

  await page.keyboard.press("Control+K");
  await expect(search).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await search.fill("没有这个命令");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await close.focus();
  await page.keyboard.press("Space");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeFocused();

  await page.keyboard.press("Control+K");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeFocused();
});

test("command palette searches task and record history and focuses records by task", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, todayRecordCount: 1 });

  await page.keyboard.press("Control+K");
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  await search.fill("产品复盘");

  const taskResult = page.getByRole("option").filter({ hasText: "任务：写完产品复盘" });
  const recordResult = page.getByRole("option").filter({ hasText: "记录：完成产品复盘" });
  await expect(taskResult).toBeVisible();
  await expect(recordResult).toBeVisible();

  await taskResult.click();
  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();
  await expect(page.locator(".records-task-filter")).toContainText("写完产品复盘");
  await expect(page.getByText("完成产品复盘", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "清除任务筛选" }).click();
  await expect(page.locator(".records-task-filter")).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await search.fill(localDate());
  const dateResult = page.getByRole("option").filter({ hasText: `日期：${localDate()}` });
  await expect(dateResult).toBeVisible();
  await dateResult.click();
  await expect(page.locator(".app-message")).toContainText("已定位到日期归档");
});

test("command palette can open the floating workspace", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("迷你工作台");
  await expect(page.getByRole("option", { name: "打开迷你工作台" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect.poll(() => page.evaluate(() => window.__floatingTodosShown)).toBe(true);
});

test("native tray navigation event switches the main window view", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect.poll(() => page.evaluate(() => Boolean(window.__trayNavigationCallback))).toBe(true);
  await page.evaluate(() => window.__trayNavigationCallback({ payload: "records" }));
  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();

  await page.evaluate(() => window.__trayNavigationCallback({ payload: "todos" }));
  await expect(page.getByRole("button", { name: /^待办/ })).toHaveClass(/active/);
});

test("initial data errors stay visible and recover through the retry action", async ({ page }) => {
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 60_000) });
  await page.clock.pauseAt(now);
  await bootWithTauriMock(page, { initialLoadError: true, persistInitialLoadError: true });

  const loadError = page.getByRole("alert");
  await expect(loadError).toContainText("暂时无法读取本地数据");
  await expect(loadError).toContainText("模拟本地数据读取失败");
  const retry = loadError.getByRole("button", { name: "重试读取" });
  await expect(retry).toBeVisible();
  expect(await page.evaluate(() => window.__syncReadAttempts)).toBe(1);

  // A persistent read failure must remain actionable after automatic and manual retries.
  await page.clock.runFor(1_000);
  await expect.poll(() => page.evaluate(() => window.__syncReadAttempts)).toBe(2);
  await expect(loadError).toContainText("模拟本地数据读取失败");
  await retry.click();
  await expect(page.locator(".app-message")).toContainText("模拟本地数据读取失败");
  await expect(loadError).toBeVisible();
  await expect(retry).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__syncReadAttempts)).toBeGreaterThan(2);
  const failedReadAttempts = await page.evaluate(() => window.__syncReadAttempts);

  // Hold the clock while the user retries so background recovery cannot win this branch.
  await page.evaluate(() => { window.__holdInitialLoadError = false; });
  await retry.click();

  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await expect(loadError).toBeHidden();
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-node--current")).toContainText("写完产品复盘");
  await expect.poll(() => page.evaluate(() => window.__syncReadAttempts)).toBe(failedReadAttempts + 1);
  await page.clock.runFor(5_000);
  expect(await page.evaluate(() => window.__syncReadAttempts)).toBe(failedReadAttempts + 1);
});

test("initial data errors recover automatically without a retry click", async ({ page }) => {
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 60_000) });
  await page.clock.pauseAt(now);
  await bootWithTauriMock(page, { initialLoadError: true });

  const loadError = page.getByRole("alert");
  await expect(loadError).toContainText("模拟本地数据读取失败");
  await expect(loadError.getByRole("button", { name: "重试读取" })).toBeVisible();
  expect(await page.evaluate(() => window.__syncReadAttempts)).toBe(1);

  await page.clock.runFor(1_000);
  await expect.poll(() => page.evaluate(() => window.__syncReadAttempts)).toBe(2);
  await expect(loadError).toBeHidden();
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-node--current")).toContainText("写完产品复盘");
  await page.clock.runFor(5_000);
  expect(await page.evaluate(() => window.__syncReadAttempts)).toBe(2);
});

test("Today overview keeps timing work in the focus page", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日概览", exact: true })).toBeVisible();
  await expect(page.locator(".trail-timer")).toHaveCount(0);
  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.getByText("专注计时", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeVisible();
});

test("Today trail expands into a scrollable route beyond five segments", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, todayRecordCount: 7, todayTodoCount: 6 });
  await expect(page.locator(".trail-node")).toHaveCount(13);
  await expect(page.locator(".trail-node--done")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  const dimensions = await page.locator(".trail-map__viewport").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    canvasWidth: element.querySelector(".trail-map__canvas").getBoundingClientRect().width,
  }));
  expect(dimensions.canvasWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await page.locator(".trail-map__viewport").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect(page.getByRole("button", { name: /^13\./ })).toBeVisible();
});

test("Today trail does not invent tasks when there are no todos", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 0 });

  await expect(page.locator(".trail-node")).toHaveCount(1);
  await expect(page.locator(".trail-node--done")).toHaveCount(0);
  await expect(page.locator(".trail-node__meta")).toContainText("今天的第一段");
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByText("今天还没有安排待办", { exact: true })).toBeVisible();
  await expect(page.locator(".trail-map__footer strong")).toHaveText("今天的第一段，从这里开始");
  await expect(page.getByText("本段任务", { exact: true })).toHaveCount(0);
  await expect(page.getByText("整理今天的会议笔记", { exact: true })).toHaveCount(0);
  await expect(page.getByText("OPEN SLOT", { exact: true })).toHaveCount(0);
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

test("records and settings pages keep all three native window controls clickable", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "设置", exact: true }).click();
  const settingsControls = page.locator(".window-control");
  await expect(settingsControls).toHaveCount(3);
  const settingsHitTargets = await settingsControls.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || hit?.closest(".window-control") === button;
  }));
  expect(settingsHitTargets).toEqual([true, true, true]);

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const controls = page.locator(".window-control");
  await expect(controls).toHaveCount(3);

  const hitTargets = await controls.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || hit?.closest(".window-control") === button;
  }));
  expect(hitTargets).toEqual([true, true, true]);

  await controls.nth(0).click();
  await controls.nth(1).click();
  await controls.nth(2).click();

  await expect.poll(() => page.evaluate(() => ({
    minimize: window.__minimizeMainWindowCalls,
    maximize: window.__toggleMaximizeMainWindowCalls,
    close: window.__closeMainWindowCalls,
    dragged: window.__mainWindowDragged,
  }))).toEqual({ minimize: 1, maximize: 1, close: 1, dragged: false });
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

test("starting a countdown stays in the current page by default", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();
  await page.locator('input[name="countdownMinutes"]').fill("60");
  await page.locator('input[name="sessionTitle"]').fill("完成季度复盘");
  await page.getByRole("button", { name: "开始", exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__miniWorkspaceShown)).toBe(false);
  await expect(page.getByRole("heading", { name: "专注计时", exact: true })).toBeVisible();
});

test("auto mini preference opens the mini workspace only after a real start", async ({ page }) => {
  await bootWithTauriMock(page, { autoMiniOnStart: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.locator('input[name="sessionTitle"]').fill("自动打开工作台测试");
  await page.getByRole("button", { name: "开始", exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__miniWorkspaceShown)).toBe(true);
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
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_app_preferences"))).toMatchObject({ floatingOpacity: 62 });
});

test("floating timer receives main-window state sync without polling", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const initialCalls = await page.evaluate(() => window.__timerSyncSnapshotCalls);
  const businessCalls = await page.evaluate(() => window.__businessSyncCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSyncSampleReady)).toBe(true);
  await page.evaluate(() => window.__emitTimerSample({
    elapsedMs: 42_000,
    elapsedLabel: "00:00:42",
    status: "已暂停",
  }));
  await expect(page.getByText("00:00:42", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__timerSyncSnapshotCalls)).toBe(initialCalls);
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(businessCalls);
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

test("reminder settings expose popup, taskbar and a palette of sound controls", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();

  await expect(page.getByRole("heading", { name: "结束提醒" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /应用内弹窗/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /任务栏闪烁/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /声音提醒/ })).toBeChecked();
  await expect(page.locator(".nv-sound-option")).toHaveCount(6);
  await expect(page.locator(".nv-sound-option.is-selected")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /老牧师原声/ })).toHaveCount(0);

  await page.getByRole("checkbox", { name: /任务栏闪烁/ }).uncheck();
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_timer_preferences"))).toMatchObject({
    windowAttentionReminderEnabled: false,
  });
});

test("records page turns a long history into a selectable archive trail", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把时间连成一条路" })).toBeVisible();
  await expect(page.locator(".records-archive__summary")).toContainText("01:30:00");
  await expect(page.locator(".records-archive__timeline-footer")).toContainText("2 天有投入");
  await expect(page.locator(".records-archive__detail")).toContainText("1 段专注");
  await expect(page.locator(".records-archive__detail .records-hero__dial")).toContainText("1");
  await expect(page.locator(".records-archive__stats .records-stats__progress")).toContainText("0%");
  await expect(page.locator(".record-history__heading")).toContainText("3 轮");

  const archiveNodes = page.locator(".records-archive__node");
  await expect(archiveNodes).toHaveCount(7);
  await archiveNodes.nth(5).click();
  await expect(page.locator(".records-archive__detail")).toContainText("昨天");
  await expect(page.locator(".records-archive__detail")).toContainText("2 段专注");

  const recordDays = page.locator(".record-day");
  await expect(recordDays).toHaveCount(2);
  await expect(recordDays.first().locator(".record-day__summary")).toHaveAttribute("aria-expanded", "true");
  await expect(recordDays.nth(1).locator(".record-day__summary")).toHaveAttribute("aria-expanded", "true");
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeVisible();

  await recordDays.nth(1).locator(".record-day__summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();

  await recordDays.nth(1).locator(".record-day__summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
});

test("records page keeps a long archive inside a bounded history viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootWithTauriMock(page, { includeRecords: true, historyDayCount: 28 });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const recordDays = page.locator(".record-day");
  await expect(recordDays).toHaveCount(30);

  const historyViewport = await page.locator(".record-list").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(historyViewport.scrollHeight).toBeGreaterThan(historyViewport.clientHeight);
  expect(historyViewport.clientHeight).toBeLessThanOrEqual(520);
  expect(historyViewport.scrollWidth).toBeLessThanOrEqual(historyViewport.clientWidth);

  const historyList = page.locator(".record-list");
  await historyList.scrollIntoViewIfNeeded();
  await historyList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await recordDays.last().locator(".record-day__summary").scrollIntoViewIfNeeded();
  await expect(recordDays.last().locator(".record-row").first()).toBeVisible();
  await recordDays.last().locator(".record-day__summary").evaluate((element) => element.click());
  await expect(recordDays.last().locator(".record-row").first()).toBeHidden();
  await recordDays.last().locator(".record-day__summary").evaluate((element) => element.click());
  await expect(recordDays.last().locator(".record-row")).toBeVisible();
  await expect(recordDays.last()).toContainText("历史归档 28");
});

test("record day keeps its collapsed state during background refresh", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, freshRecordSnapshots: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const recordDays = page.locator(".record-day");
  await recordDays.nth(1).locator(".record-day__summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();

  await page.evaluate(() => {
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ recordRevision: revisions.recordRevision + 1 });
  });
  await expect.poll(() => page.evaluate(() => window.__businessSyncCalls), { timeout: 3000 })
    .toBeGreaterThan(1);
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();
  await expect(recordDays.nth(1).locator(".record-day__summary")).toHaveAttribute("aria-expanded", "false");
});

test("records page aligns route points and explains focus hours", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.locator(".nv-records-distribution__heading h2")).toHaveText("你通常在什么时候进入状态？");
  await expect(page.locator(".nv-records-distribution")).toContainText("上午");
  await expect(page.locator(".nv-records-distribution")).toContainText("晚间");
  await expect(page.locator(".nv-records-distribution")).toContainText("45 分钟");
  await expect(page.locator(".nv-records-distribution")).not.toContainText("节点高度按当天真实投入时长变化");

  const distributionHeights = await page.locator(".nv-records-distribution__track > span").evaluateAll((bars) => bars.map((bar) => bar.style.height));
  expect(distributionHeights).toEqual(["0%", "100%", "0%", "100%"]);

  const chartGeometry = await page.locator(".records-archive__map").evaluate((map) => {
    const mapRect = map.getBoundingClientRect();
    const svg = map.querySelector("svg");
    const path = map.querySelector(".records-archive__route-line");
    if (!svg || !path) throw new Error("archive chart is incomplete");

    const svgRect = svg.getBoundingClientRect();
    const nodes = Array.from(map.querySelectorAll(".records-archive__node"));
    const nodePoints = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2 - mapRect.left) / mapRect.width) * 100,
        y: ((rect.top + rect.height / 2 - mapRect.top) / mapRect.height) * 100,
      };
    });
    const totalLength = path.getTotalLength();
    const samples = Array.from({ length: 500 }, (_, index) => path.getPointAtLength((totalLength * index) / 499));
    const distances = nodePoints.map((point) => Math.min(...samples.map((sample) => Math.hypot(sample.x - point.x, sample.y - point.y))));

    return {
      map: { width: mapRect.width, height: mapRect.height },
      svg: { left: svgRect.left - mapRect.left, top: svgRect.top - mapRect.top, width: svgRect.width, height: svgRect.height },
      nodePoints,
      distances,
    };
  });

  expect(Math.abs(chartGeometry.svg.left)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.top)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.width - chartGeometry.map.width)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.height - chartGeometry.map.height)).toBeLessThan(1.5);
  expect(chartGeometry.nodePoints[0].x).toBeCloseTo(7, 0);
  expect(chartGeometry.nodePoints.at(-1).x).toBeCloseTo(93, 0);
  expect(chartGeometry.distances.every((distance) => distance < 1.5)).toBe(true);
});

test("records page keeps empty seven-day data at zero", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.locator(".nv-records-trend h2")).toHaveText("最近 7 天，平均每天 00:00:00。");
  await expect(page.locator(".records-archive__stats")).toContainText("活跃日平均 0 分钟");
  await expect.poll(() => page.locator(".nv-records-distribution__track > span").evaluateAll((bars) => bars.map((bar) => bar.style.height))).toEqual([
    "0%",
    "0%",
    "0%",
    "0%",
  ]);
});

test("record title can be edited and saved without changing its duration", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();

  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();

  const input = record.locator('input[name="editRecordTitle-3"]');
  await expect(input).toHaveValue("完成产品复盘");
  await input.fill("完成季度复盘");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(record).toContainText("完成季度复盘");
  await expect(record).toContainText("00:45:00");
  await expect(record).not.toContainText("完成产品复盘");
  await expect(page.locator(".app-message")).toContainText("专注记录已更新");
});

test("timer snapshots keep refreshing while a record draft is open", async ({ page }) => {
  test.setTimeout(60_000);
  await bootWithTauriMock(page, { includeRecords: true, pausedFocus: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();

  const input = record.locator('input[name="editRecordTitle-3"]');
  await input.fill("仍在编辑中的草稿");
  const timerCallsBefore = await page.evaluate(() => window.__timerSyncSnapshotCalls);
  const businessCallsBefore = await page.evaluate(() => window.__businessSyncCalls);
  await page.evaluate(() => window.__replaceTimer({
    status: "运行中",
    isRunning: true,
    elapsedMs: 31_000,
    elapsedLabel: "00:00:31",
  }));

  await expect.poll(() => page.evaluate(() => window.__timerSyncSnapshotCalls), { timeout: 2500 })
    .toBeGreaterThan(timerCallsBefore);
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(businessCallsBefore);
  await expect(input).toHaveValue("仍在编辑中的草稿");

  await page.waitForTimeout(30_000);
  await expect.poll(() => page.evaluate(() => window.__timerSyncSnapshotCalls), { timeout: 5000 })
    .toBeGreaterThan(timerCallsBefore + 20);
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(businessCallsBefore);
  await expect(input).toHaveValue("仍在编辑中的草稿");

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".timer-readout")).toContainText("00:00:31");
});

test("stopwatch shows a clear target duration instead of a one-minute target", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".timer-readout")).toContainText("目标 25 分钟");
  await expect(page.locator(".timer-readout")).not.toContainText("1 分钟");
});

test("timer page uses the current day's saved session count", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".nv-focus-brief__stats")).toContainText("今天已记录1 段");
  await expect(page.locator(".nv-focus-panel__session-data")).toContainText("今日已完成1 段");
  await expect(page.locator(".nv-focus-brief__stats")).not.toContainText("0 段");
  await expect(page.locator(".nv-focus-panel__session-data")).not.toContainText("0 段");
});

test("timer workspace keeps only actionable controls and state copy", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".nv-focus-panel .nv-panel-kicker")).toContainText("本次专注");
  await expect(page.locator(".nv-focus-panel .timer-readout")).toBeVisible();
  await expect(page.locator(".nv-chronograph__bezel")).toHaveCount(0);
  await expect(page.locator(".nv-focus-brief")).toBeVisible();
  await expect(page.locator(".nv-focus-route")).toHaveCount(0);
  await expect(page.locator(".nv-focus-instrument")).toHaveCount(0);
  await expect(page.locator(".nv-focus-footer")).toHaveCount(0);
  await expect(page.locator(".nv-focus-panel__shortcut")).toHaveCount(0);
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已暂停");

  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("运行中");

  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已暂停");

  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("保存成功");
  await expect.poll(() => page.evaluate(() => window.__completedFocusCalls)).toBe(1);

  await page.getByRole("button", { name: "清空设置", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
});

for (const scenario of [
  { name: "running", options: { runningFocus: true } },
  { name: "expired", options: { completedCountdown: true } },
]) {
  test(`reset confirmation protects ${scenario.name} session progress`, async ({ page }) => {
    await bootWithTauriMock(page, scenario.options);
    await page.getByRole("button", { name: "计时", exact: true }).click();
    await page.getByRole("button", { name: "重置本次专注", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "保留本轮" })).toBeFocused();
    await dialog.getByRole("button", { name: "保留本轮" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.hasUnsubmittedProgress)).toBe(true);
  });
}

test("reset confirmation shows the current session and can be cancelled without losing progress", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  const resetButton = page.getByRole("button", { name: "重置本次专注", exact: true });
  await resetButton.click();

  let dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
  await expect(dialog).toContainText("写完产品复盘");
  await expect(dialog).toContainText("00:00:30");
  await expect(dialog.getByRole("button", { name: "保留本轮" })).toBeFocused();
  await page.screenshot({ path: testOutputPath("screenshots", "reset-session-confirmation.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.elapsedMs)).toBe(30_000);

  await resetButton.click();
  dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
  await expect(dialog).toBeVisible();
  await page.locator(".workflow-dialog-backdrop").dispatchEvent("mousedown");
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.hasUnsubmittedProgress)).toBe(true);
});

test("reset confirmation sends its captured session id and commits only once", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "重置本次专注", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
  await page.evaluate(() => { window.__holdNextResetTimer = true; });
  const confirmButton = dialog.getByRole("button", { name: "确认重置" });
  await confirmButton.click();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
  const busyButton = dialog.getByRole("button", { name: "正在重置…" });
  await expect(busyButton).toBeDisabled();
  await busyButton.dispatchEvent("click");
  await page.evaluate(() => window.__releaseResetTimer?.());

  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__resetTimerArgs)).toEqual([{ sessionId: "mock-session-1" }]);
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.hasUnsubmittedProgress)).toBe(false);
});

test("failed reset keeps progress for retry and a stale confirmation cannot clear a new session", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "重置本次专注", exact: true }).click();

  let dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
  await page.evaluate(() => { window.__failResetTimer = true; });
  await dialog.getByRole("button", { name: "确认重置" }).click();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.elapsedMs)).toBe(30_000);
  await dialog.getByRole("button", { name: "确认重置" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__resetTimerSuccessCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__resetTimerArgs)).toEqual([
    { sessionId: "mock-session-1" },
    { sessionId: "mock-session-1" },
  ]);

  await page.evaluate(() => {
    window.__replaceTimer({
      sessionId: "other-window-session",
      elapsedMs: 90_000,
      elapsedLabel: "00:01:30",
      activeTaskTitle: "新一轮事项",
      isRunning: false,
      status: "已暂停",
      hasUnsubmittedProgress: true,
    });
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ timerOperationRevision: revisions.timerOperationRevision + 1 });
  });
  await expect(page.locator(".timer-readout")).toContainText("00:01:30");
  await page.getByRole("button", { name: "重置本次专注", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "重置本轮计时？" });
  await expect(dialog).toContainText("新一轮事项");
  await page.evaluate(() => {
    window.__replaceTimer({
      sessionId: "newer-window-session",
      elapsedMs: 120_000,
      elapsedLabel: "00:02:00",
      activeTaskTitle: "更新后的事项",
      isRunning: false,
      status: "已暂停",
      hasUnsubmittedProgress: true,
    });
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ timerOperationRevision: revisions.timerOperationRevision + 1 });
  });
  await expect(page.locator(".timer-readout")).toContainText("00:02:00");
  await dialog.getByRole("button", { name: "确认重置" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("本轮已在其他窗口发生变化，请检查当前状态后重新操作。")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__resetTimerSuccessCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().timer.elapsedMs)).toBe(120_000);
});

test("timer workspace distinguishes a completed countdown", async ({ page }) => {
  await bootWithTauriMock(page, { completedCountdown: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("到点待保存");
  await expect(page.locator(".nv-focus-panel__status")).toContainText("保存后会写入专注记录");
});

test("timer workspace distinguishes a recovered session", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.evaluate(() => window.__replaceTimer({ recoveredFromLastSession: true }));
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已恢复");
  await expect(page.locator(".nv-focus-panel__status")).toContainText("可以继续、保存或清空");
});

test("timer workspace offers quick durations and a usable pre-start reset", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.getByRole("button", { name: "进入悬浮窗", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "25 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "45 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "60 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "清空设置", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "45 分钟", exact: true }).click();
  await expect(page.locator(".nv-mode-switcher button.active")).toHaveText("倒计时");
  await expect(page.locator(".timer-readout")).toContainText("45:00");

  const idleSessionId = await page.evaluate(() => window.__getAppStateSyncPayload().timer.sessionId);
  await page.getByRole("button", { name: "清空设置", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "重置本轮计时？" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__resetTimerArgs[0])).toEqual({ sessionId: idleSessionId });
});

test("timer page can reopen the focus floating window after returning to main", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();

  const floatingButton = page.getByRole("button", { name: "打开迷你工作台", exact: true });
  await expect(floatingButton).toBeVisible();
  await expect(floatingButton).toBeEnabled();
  await expect(floatingButton).toBeInViewport();

  await floatingButton.click();

  await expect.poll(() => page.evaluate(() => window.__floatingTodosShown)).toBe(true);
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

  const businessSyncCallsBeforeWaiting = await page.evaluate(() => window.__businessSyncCalls);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(businessSyncCallsBeforeWaiting);

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

test("app messages appear as dismissible top-right toasts and auto-dismiss", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();
  await record.locator('input[name="editRecordTitle-3"]').fill("完成季度复盘");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  const toast = page.locator(".app-message");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("position", "fixed");
  const toastBox = await toast.boundingBox();
  expect(toastBox?.x ?? 0).toBeGreaterThan(700);
  expect(toastBox?.y ?? 999).toBeLessThan(140);

  await toast.click();
  await expect(toast).toBeHidden();

  await record.getByRole("button", { name: "编辑记录“完成季度复盘”" }).click();
  await record.locator('input[name="editRecordTitle-3"]').fill("完成季度复盘二次");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 6500 });
});

test("todo board keeps completed actions aligned without a needless scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootWithTauriMock(page, { todayTodoCount: 0, completedTodoCount: 9 });

  await page.getByRole("button", { name: /^待办/ }).click();

  const layout = await page.evaluate(() => {
    const board = document.querySelector(".nv-todo-board");
    const columns = [...document.querySelectorAll(".nv-todo-column")];
    const completedList = document.querySelector(".nv-todo-column--done .nv-todo-column__list");
    const completedRow = document.querySelector(".nv-completed-row");
    const title = completedRow?.querySelector(".completed-row__title");
    const actions = completedRow ? [...completedRow.querySelectorAll(".row-action")].map((element) => element.getBoundingClientRect()) : [];
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    return {
      board: rect(board),
      columns: columns.map(rect),
      completedList: completedList ? { clientHeight: completedList.clientHeight, scrollHeight: completedList.scrollHeight } : null,
      completedRow: rect(completedRow),
      title: rect(title),
      actions: actions.map((value) => ({ left: value.left, right: value.right, top: value.top, bottom: value.bottom })),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(layout.board?.width).toBeGreaterThan(700);
  expect(layout.columns).toHaveLength(2);
  expect(layout.columns[0].right).toBeLessThanOrEqual(layout.columns[1].left + 0.5);
  expect(Math.abs(layout.columns[0].height - layout.columns[1].height)).toBeLessThan(2);
  expect(layout.completedList?.scrollHeight).toBe(layout.completedList?.clientHeight);
  expect(layout.title?.right).toBeLessThanOrEqual(layout.actions[0].left + 1);
  expect(Math.abs(layout.actions[0].top - layout.actions[1].top)).toBeLessThan(2);
  expect(layout.scrollWidth).toBeLessThanOrEqual(1487);
  await expect(page.locator(".completed-row")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "恢复" })).toHaveCount(9);
  await page.screenshot({ path: testOutputPath("screenshots", "night-valley-todo-completed-layout.png"), animations: "disabled", fullPage: true });
});

test("todo workspace stacks cleanly on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 860 });
  await bootWithTauriMock(page, { todayTodoCount: 0, completedTodoCount: 3 });

  await page.getByRole("button", { name: /^待办/ }).click();

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
    };
    return {
      page: rect(".nv-todo-page"),
      board: rect(".nv-todo-board"),
      focus: rect(".nv-todo-focus-panel"),
      columns: [...document.querySelectorAll(".nv-todo-column")].map((element) => {
        const value = element.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      }),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(560);
  expect(layout.page?.left).toBeGreaterThanOrEqual(0);
  expect(layout.page?.right).toBeLessThanOrEqual(560);
  expect(layout.board?.left).toBeGreaterThanOrEqual(layout.page?.left ?? 0);
  expect(layout.board?.right).toBeLessThanOrEqual(layout.page?.right ?? 560);
  expect(layout.columns[0].bottom).toBeLessThanOrEqual(layout.columns[1].top + 1);
  expect(layout.columns).toHaveLength(2);
  expect(layout.board?.bottom).toBeLessThanOrEqual(layout.focus?.top ?? 0);
  await expect(page.getByRole("button", { name: "添加待办" })).toBeVisible();
  await expect(page.locator(".completed-row")).toHaveCount(3);
  await page.screenshot({ path: testOutputPath("screenshots", "night-valley-todo-phone-layout.png"), animations: "disabled", fullPage: true });
});

test("todo board groups pending items by date and keeps one group open", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 12, futureTodoCount: 4 });

  await page.getByRole("button", { name: /^待办/ }).click();

  await expect(page.locator(".nv-todo-column")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "进行中" })).toHaveCount(0);
  await expect(page.locator(".nv-todo-summary")).not.toContainText("进行中");

  const navGeometry = await page.locator(".minimal-nav > button").nth(2).evaluate((button) => {
    const label = button.querySelector(".minimal-nav__label")?.getBoundingClientRect();
    const count = button.querySelector(".minimal-nav__count")?.getBoundingClientRect();
    if (!label || !count) throw new Error("todo navigation count is incomplete");
    return { labelRight: label.right, countLeft: count.left, countWidth: count.width };
  });
  expect(navGeometry.labelRight).toBeLessThanOrEqual(navGeometry.countLeft + 0.5);
  expect(navGeometry.countWidth).toBeGreaterThanOrEqual(18);

  const groups = page.locator(".nv-todo-date-group");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(groups.nth(1).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(groups.nth(0).locator(".nv-todo-card")).toHaveCount(12);
  await expect(groups.nth(1).locator(".nv-todo-card")).toHaveCount(0);

  const openGroupViewport = await groups.nth(0).locator(".nv-todo-date-group__items").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(openGroupViewport.scrollHeight).toBeGreaterThan(openGroupViewport.clientHeight);
  expect(openGroupViewport.clientHeight).toBeLessThanOrEqual(430);

  await groups.nth(1).locator(".nv-todo-date-group__toggle").click();
  await expect(groups.nth(0).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(groups.nth(1).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(groups.nth(1).locator(".nv-todo-card")).toHaveCount(2);
});

test("todo date group keeps its scroll position during background refresh", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 18, freshTodoSnapshots: true });

  await page.getByRole("button", { name: /^待办/ }).click();

  const items = page.locator(".nv-todo-date-group").first().locator(".nv-todo-date-group__items");
  const callsBeforeScroll = await page.evaluate(() => window.__businessSyncCalls);
  await items.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.evaluate(() => {
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ todoRevision: revisions.todoRevision + 1 });
  });
  await expect.poll(() => page.evaluate(() => window.__businessSyncCalls), { timeout: 3000 })
    .toBeGreaterThan(callsBeforeScroll);
  expect(await items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("records overview info explains the seven-day chart on hover and focus", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const info = page.locator(".nv-info-tip");
  const tooltip = page.locator("#records-overview-help");
  await expect(info).toBeVisible();
  await info.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("最近 7 个自然日");

  await info.focus();
  await expect(tooltip).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
});

test("quick capture creates an inbox item and keeps the current page", async ({ page }) => {
  await bootWithTauriMock(page);

  await openQuickCaptureFromPalette(page);
  const dialog = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  await dialog.getByRole("textbox").fill("临时想到的开头");
  await dialog.getByRole("button", { name: "放入收件箱" }).click();

  await expect.poll(() => page.evaluate(() => window.__quickCaptureCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await expect(page.getByText("已放入收件箱，稍后整理。", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^待办/ }).click();
  const inbox = page.locator(".nv-todo-date-group").filter({ hasText: "收件箱 · 未安排" });
  await expect(inbox).toContainText("临时想到的开头");
  await expect(inbox).not.toContainText("已过期");
});

test("quick capture during a running timer does not pause or navigate", async ({ page }) => {
  await bootWithTauriMock(page);

  await startRestoredCurrentTodo(page);
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();

  await openQuickCaptureFromPalette(page);
  const dialog = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  await dialog.getByRole("textbox").fill("计时中想到的补充");
  await dialog.getByRole("button", { name: "放入收件箱" }).click();

  await expect.poll(() => page.evaluate(() => window.__quickCaptureCalls)).toBe(1);
  expect(await page.evaluate(() => window.__pauseTimerCalls)).toBe(0);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_snapshot")).isRunning)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
});

test("current item and today picks stay user-controlled with a three-item limit", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 4 });

  const plan = await openRestoredFocusPlan(page);
  await expect(plan.getByRole("button", { name: "移出精选" })).toHaveCount(3);
  await expect(plan.getByRole("button", { name: "加入精选" })).toBeDisabled();

  await plan.getByRole("button", { name: "移出精选" }).first().click();
  await expect(plan.getByRole("button", { name: "加入精选" }).first()).toBeEnabled();
  await plan.getByRole("button", { name: "加入精选" }).first().click();
  await expect(plan.getByRole("button", { name: "移出精选" })).toHaveCount(3);

  await plan.getByRole("button", { name: "设为当前" }).first().click();
  await expect(plan.getByRole("button", { name: "取消当前" }).first()).toBeVisible();
  await plan.getByRole("button", { name: "取消当前", exact: true }).click();
  await expect(plan.getByRole("button", { name: "取消当前", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_focus_plan")).currentTodoId)).toBeNull();
});

test("finishing a linked round keeps the todo open and saves a continuation bookmark", async ({ page }) => {
  await bootWithTauriMock(page);

  await startRestoredCurrentTodo(page);
  await page.getByRole("button", { name: "计时", exact: true }).click();
  const finish = page.getByRole("button", { name: "完成并记录", exact: true });
  await expect(finish).toBeEnabled();
  await finish.click();

  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("textbox").fill("从第三段的例子继续");
  await prompt.getByRole("button", { name: "保存下次位置" }).click();

  await expect.poll(() => page.evaluate(() => window.__bookmarkSaveCalls)).toBe(1);
  await expect(prompt).toBeHidden();
  const plan = await openRestoredFocusPlan(page);
  await expect(plan.getByText("下次继续：从第三段的例子继续", { exact: true })).toBeVisible();
  await expect(page.locator(".todo-row").filter({ hasText: "写完产品复盘" })).toBeVisible();
  await expect(page.locator(".completed-row").filter({ hasText: "写完产品复盘" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const records = await window.__TAURI_INTERNALS__.invoke("get_focus_records");
    const todos = await window.__TAURI_INTERNALS__.invoke("get_todo_items");
    const todo = todos.find((item) => item.id === 1);
    return { rounds: records.filter((record) => record.linkedTodoId === 1).length, completed: todo.isCompleted, note: todo.continuationNote };
  })).toEqual({ rounds: 1, completed: false, note: "从第三段的例子继续" });
});

test("records support manual entry and detailed correction", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();

  await page.getByRole("button", { name: "补录专注" }).click();
  const manual = page.getByRole("dialog", { name: "补录一段专注" });
  await manual.getByRole("textbox", { name: "标题" }).fill("手动回顾一段工作");
  await manual.getByRole("spinbutton", { name: "时长（分钟）" }).fill("35");
  await manual.getByRole("button", { name: "补录记录" }).click();
  await expect.poll(() => page.evaluate(() => window.__manualRecordCalls)).toBe(1);
  const manualRecord = page.locator(".record-row").filter({ hasText: "手动回顾一段工作" });
  await expect(manualRecord).toContainText("手动补录");

  const record = manualRecord;
  await record.getByRole("button", { name: "详细编辑" }).click();
  const editor = page.getByRole("dialog", { name: "编辑专注记录" });
  await editor.getByRole("spinbutton", { name: "时长（分钟）" }).fill("40");
  await editor.getByRole("button", { name: "保存修改" }).click();
  await expect.poll(() => page.evaluate(() => window.__recordUpdateCalls)).toBe(1);
  await expect(record).toContainText("00:40:00");
  await expect(record).toContainText("已修正");
});

test("portable backup preview and import expose the v3 restore choice", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();

  const path = page.getByRole("textbox", { name: "外部备份文件路径" });
  await path.fill("C:\\Users\\test\\focused-moment-backup.json");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__backupPreviewCalls)).toBe(1);
  await expect(page.locator(".portable-backup-panel__preview")).toContainText("v3 / v3");
  await expect(page.getByRole("checkbox", { name: "同时恢复主题、视觉设置和自定义音效" })).not.toBeChecked();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "确认导入并生成回滚" }).click();
  await expect.poll(() => page.evaluate(() => window.__backupImportCalls)).toBe(1);
});

test("settings cannot overwrite loaded preferences while the initial snapshot is pending", async ({ page }) => {
  await bootWithTauriMock(page, { delayAppPreferences: true });
  await page.getByRole("button", { name: "设置", exact: true }).click();

  const content = page.locator(".minimal-content");
  const themeChoice = page.locator(".nv-theme-card").filter({ hasText: "编辑纸页" });
  const chooseTheme = themeChoice.click({ timeout: 10_000 });
  await expect(content).toHaveJSProperty("inert", true);
  await expect.poll(() => page.evaluate(() => typeof window.__releaseAppPreferencesLoad)).toBe("function");
  await page.evaluate(() => window.__releaseAppPreferencesLoad?.());
  await chooseTheme;

  await expect(content).toHaveJSProperty("inert", false);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
});

test("failed appearance persistence keeps the live change and offers retry", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.locator(".minimal-content")).toHaveJSProperty("inert", false);
  const initialRevisionEvents = await page.evaluate(() => window.__revisionEventEmits);
  await page.evaluate(() => {
    window.__failAppPreferenceSave = true;
  });
  await page.locator(".nv-theme-card").filter({ hasText: "编辑纸页" }).click();

  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  const error = page.locator(".restored-settings-compatibility").getByRole("alert").filter({ hasText: "外观设置保存失败" });
  await expect(error).toBeVisible({ timeout: 3000 });
  expect(await page.evaluate(() => window.__revisionEventEmits)).toBe(initialRevisionEvents);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  await page.evaluate(() => { window.__failAppPreferenceSave = false; });
  await error.getByRole("button", { name: "重试保存" }).click();
  await expect(error).toBeHidden({ timeout: 3000 });
  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).themeId)).toBe("editorial-paper");
});
