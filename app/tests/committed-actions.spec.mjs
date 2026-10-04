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

test("a committed manual record closes once even when analytics fail; retry only refreshes", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "补录专注" }).click();
  const dialog = page.getByRole("dialog", { name: "补录一段专注" });
  await dialog.getByRole("textbox", { name: "标题" }).fill("只应保存一次");
  await failCommands(page, ["get_analytics_snapshot"]);
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
  await failCommands(page, ["get_analytics_snapshot"]);
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
  await failCommands(page, ["get_analytics_snapshot"]);
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("记录已保存，统计暂未刷新。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__recordUpdateCalls)).toBe(1);
});
