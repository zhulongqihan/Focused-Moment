import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

async function failCommands(page, commands) {
  await page.evaluate((names) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__failingCommands = names;
    window.__TAURI_INTERNALS__.invoke = (name, args) => {
      if (window.__failingCommands.includes(name)) return Promise.reject(new Error("模拟后续步骤失败"));
      return invoke(name, args);
    };
  }, commands);
}

async function countCommands(page, commands) {
  await page.evaluate((names) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__commandCalls = Object.fromEntries(names.map((name) => [name, 0]));
    window.__TAURI_INTERNALS__.invoke = (name, args) => {
      if (Object.prototype.hasOwnProperty.call(window.__commandCalls, name)) {
        window.__commandCalls[name] += 1;
      }
      return invoke(name, args);
    };
  }, commands);
}

async function openSettings(page) {
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "设置", exact: true }).click();
}

test("a committed manual record closes once even when analytics fail; retry only refreshes", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "补录专注" }).click();
  const dialog = page.getByRole("dialog", { name: "补录一段专注" });
  await dialog.getByRole("textbox", { name: "标题" }).fill("只应保存一次");
  await failCommands(page, ["get_sync_snapshot"]);
  await dialog.getByRole("button", { name: "补录记录" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("记录已保存，统计暂未刷新。", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__manualRecordCalls)).toBe(1);
  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect(page.getByText("记录已保存，统计暂未刷新。", { exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.__manualRecordCalls)).toBe(1);
  expect(await page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_focus_records")).filter((record) => record.title === "只应保存一次").length)).toBe(1);
});

test("a failed manual write retains its draft and can be submitted after recovery", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "补录专注" }).click();
  const dialog = page.getByRole("dialog", { name: "补录一段专注" });
  await dialog.getByRole("textbox", { name: "标题" }).fill("不要清掉我的草稿");
  await failCommands(page, ["create_manual_focus_record"]);
  await dialog.getByRole("button", { name: "补录记录" }).click();
  await expect(dialog.getByRole("textbox", { name: "标题" })).toHaveValue("不要清掉我的草稿");
  await expect(dialog.getByRole("button", { name: "补录记录" })).toBeEnabled();
  expect(await page.evaluate(() => window.__manualRecordCalls)).toBe(0);
  await page.evaluate(() => { window.__failingCommands = []; });
  await dialog.getByRole("button", { name: "补录记录" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__manualRecordCalls)).toBe(1);
});

test("finishing applies the committed timer before analytics can fail", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "计时", exact: true }).click();
  await failCommands(page, ["get_sync_snapshot"]);
  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect(page.getByText("记录已保存，统计暂未刷新。", { exact: true })).toBeVisible();
  await expect(page.getByRole("timer", { name: "这次专注计时" })).toContainText("保存成功");
  await expect(page.getByRole("timer", { name: "这次专注计时" })).toContainText("00:00:00");
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
});

test("a committed record edit closes even when its analytics refresh fails", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "详细编辑" }).first().click();
  const dialog = page.getByRole("dialog", { name: "编辑专注记录" });
  await dialog.getByRole("textbox", { name: "标题" }).fill("修改已提交");
  await failCommands(page, ["get_sync_snapshot"]);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("记录已保存，统计暂未刷新。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__recordUpdateCalls)).toBe(1);
});

test("a committed portable import retries only the replacement read after refresh fails", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await openSettings(page);
  await page.getByRole("textbox", { name: "外部备份文件路径" }).fill("C:/backups/focus.json");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByText("2.12.1", { exact: true })).toBeVisible();

  await failCommands(page, ["get_sync_snapshot"]);
  await countCommands(page, ["import_app_backup_path", "get_sync_snapshot"]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "确认导入并生成回滚" }).click();

  const noticeText = "数据替换已完成，界面暂未刷新。请重试读取，无需再次导入或清空。";
  const notice = page.getByText(noticeText, { exact: true });
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => window.__commandCalls.import_app_backup_path)).toBe(1);
  const failedReadCount = await page.evaluate(() => window.__commandCalls.get_sync_snapshot);

  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect(notice).toBeHidden();
  expect(await page.evaluate(() => window.__commandCalls.import_app_backup_path)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.get_sync_snapshot)).toBeGreaterThan(failedReadCount);
});

test("a committed data clear retries only the replacement read after refresh fails", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await openSettings(page);

  await failCommands(page, ["get_sync_snapshot"]);
  await countCommands(page, ["clear_app_data", "get_sync_snapshot"]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空当前数据", exact: true }).click();

  const noticeText = "数据替换已完成，界面暂未刷新。请重试读取，无需再次导入或清空。";
  const notice = page.getByText(noticeText, { exact: true });
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => window.__clearAppDataCalls)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.clear_app_data)).toBe(1);
  const failedReadCount = await page.evaluate(() => window.__commandCalls.get_sync_snapshot);

  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect(notice).toBeHidden();
  expect(await page.evaluate(() => window.__commandCalls.clear_app_data)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.get_sync_snapshot)).toBeGreaterThan(failedReadCount);
  expect(await page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_todo_items")).length)).toBe(0);
  expect(await page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_focus_records")).length)).toBe(0);
});

test("retrying an automatic mini-workspace switch does not start the timer twice", async ({ page }) => {
  await bootWithTauriMock(page, { autoMiniOnStart: true });
  await failCommands(page, ["show_floating_todos"]);
  await countCommands(page, ["start_timer", "show_floating_todos"]);

  await page.keyboard.press("Control+Enter");
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect(page.getByText("计时已开始，迷你工作台暂未打开。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__commandCalls.show_floating_todos)).toBe(1);

  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect(page.getByText("计时已开始，迷你工作台暂未打开。", { exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.start_timer)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.show_floating_todos)).toBe(2);
  expect(await page.evaluate(() => window.__floatingTodosShown)).toBe(true);
});

test("retrying a failed return to the main window does not complete focus twice", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-float", pausedFocus: true });
  await failCommands(page, ["restore_main_from_focus_floating"]);
  await countCommands(page, ["complete_focus_session", "restore_main_from_focus_floating"]);

  await page.getByRole("button", { name: /完成/ }).last().click();
  await expect(page.getByText("记录已保存，主窗口暂未恢复。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.complete_focus_session)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.restore_main_from_focus_floating)).toBe(1);

  await page.evaluate(() => { window.__failingCommands = []; });
  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect(page.getByText("记录已保存，主窗口暂未恢复。", { exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.complete_focus_session)).toBe(1);
  expect(await page.evaluate(() => window.__commandCalls.restore_main_from_focus_floating)).toBe(2);
  expect(await page.evaluate(() => window.__mainRestored)).toBe(true);
});

test("a failed quick-capture write keeps the draft for one later retry", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("快速收进收件箱");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  const title = dialog.getByRole("textbox");
  await title.fill("写入失败时保留草稿");
  await failCommands(page, ["create_todo_item"]);
  await countCommands(page, ["create_todo_item"]);

  await dialog.getByRole("button", { name: "放入收件箱" }).click();
  await expect(title).toHaveValue("写入失败时保留草稿");
  await expect(dialog.getByRole("button", { name: "放入收件箱" })).toBeEnabled();
  expect(await page.evaluate(() => window.__commandCalls.create_todo_item)).toBe(1);
  expect(await page.evaluate(() => window.__quickCaptureCalls)).toBe(0);

  await page.evaluate(() => { window.__failingCommands = []; });
  await dialog.getByRole("button", { name: "放入收件箱" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__commandCalls.create_todo_item)).toBe(2);
  expect(await page.evaluate(() => window.__quickCaptureCalls)).toBe(1);
});
