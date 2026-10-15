import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

async function openCapture(page) {
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("快速收进收件箱");
  await page.keyboard.press("Enter");
  return page.getByRole("dialog", { name: "先记下来，稍后再整理" });
}

async function openRecords(page) {
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();
}

async function holdWrite(page, command) {
  await page.evaluate((command) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__dialogWriteRequests = 0;
    window.__TAURI_INTERNALS__.invoke = async (name, args) => {
      if (name === command) {
        window.__dialogWriteRequests += 1;
        await new Promise((resolve) => { window.__releaseDialogWrite = resolve; });
      }
      return invoke(name, args);
    };
  }, command);
}

test("command handoff retains dialog focus and ignores IME confirmation", async ({ page }) => {
  await bootWithTauriMock(page);
  const originalTrigger = page.getByRole("button", { name: "今日", exact: true });
  await originalTrigger.focus();
  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "你想做什么？" });
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  await expect(search).toBeFocused();
  await search.fill("快速收进收件箱");
  await search.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await expect(palette).toBeVisible();
  await search.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229 });
  await expect(palette).toBeVisible();
  await page.keyboard.press("Enter");
  const capture = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  const title = capture.getByRole("textbox");
  await expect(title).toBeFocused();
  await title.fill("中文输入确认不提交");
  await title.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await title.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229 });
  expect(await page.evaluate(() => window.__quickCaptureCalls)).toBe(0);
  await page.keyboard.press("Shift+Tab");
  await expect(capture.getByRole("button", { name: "放入收件箱" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(capture).toBeHidden();
  await expect(originalTrigger).toBeFocused();
});

test("manual record keyboard loop restores its trigger in a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 860 });
  await bootWithTauriMock(page, { includeRecords: true });
  await openRecords(page);
  const trigger = page.getByRole("button", { name: "补录专注" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "补录一段专注" });
  const title = dialog.getByRole("textbox", { name: "标题" });
  await expect(title).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await title.fill("键盘补录");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "补录记录" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("manual-dialog-keyboard.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("modal and editable fields block background focus shortcuts", async ({ page }) => {
  await bootWithTauriMock(page);
  const dialog = await openCapture(page);
  await dialog.getByRole("textbox").fill("快捷键只作用于当前弹层");
  await dialog.getByRole("button", { name: "取消" }).focus();
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Shift+E");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(0);
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "计时", exact: true }).click();
  const editable = page.locator(".minimal-content input[type='text']").first();
  await editable.focus();
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Shift+E");
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(0);
});

test("record editor traps reverse Tab and restores the specific row trigger", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await openRecords(page);
  const trigger = page.locator(".record-row").filter({ hasText: "完成产品复盘" }).getByRole("button", { name: "详细编辑" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "编辑专注记录" });
  const title = dialog.getByRole("textbox", { name: "标题" });
  await expect(title).toBeFocused();
  await title.fill("更正后仍保持当前字段焦点");
  const duration = dialog.getByRole("spinbutton", { name: "时长（分钟）" });
  await duration.fill("41");
  await expect(duration).toBeFocused();
  await expect(duration).toHaveValue("41");
  await title.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "关闭编辑记录" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "保存修改" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "关闭编辑记录" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const mode of ["capture", "manual", "edit"]) {
  test(`${mode} refuses dismissal and duplicate submission while writing`, async ({ page }) => {
    await bootWithTauriMock(page, { includeRecords: true });
    let dialog;
    let command;
    let submitName;
    let backdrop;
    if (mode === "capture") {
      dialog = await openCapture(page);
      await dialog.getByRole("textbox").fill("等待保存的收件箱事项");
      command = "create_todo_item";
      submitName = "放入收件箱";
      backdrop = ".workflow-dialog-backdrop";
    } else {
      await openRecords(page);
      if (mode === "manual") {
        await page.getByRole("button", { name: "补录专注" }).click();
        dialog = page.getByRole("dialog", { name: "补录一段专注" });
        await dialog.getByRole("textbox", { name: "标题" }).fill("等待保存的补录");
        command = "create_manual_focus_record";
        submitName = "补录记录";
        backdrop = ".workflow-dialog-backdrop";
      } else {
        await page.locator(".record-row").filter({ hasText: "完成产品复盘" }).getByRole("button", { name: "详细编辑" }).click();
        dialog = page.getByRole("dialog", { name: "编辑专注记录" });
        command = "update_focus_record";
        submitName = "保存修改";
        backdrop = ".focus-record-dialog-backdrop";
      }
    }
    await holdWrite(page, command);
    await dialog.getByRole("button", { name: submitName }).click();
    await expect.poll(() => page.evaluate(() => window.__dialogWriteRequests)).toBe(1);
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(dialog.getByRole("button", { name: "取消" })).toBeDisabled();
    if (mode === "edit") await expect(dialog.getByRole("button", { name: "关闭编辑记录" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.locator(backdrop).dispatchEvent("mousedown");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").first().focus();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => window.__dialogWriteRequests)).toBe(1);
    await page.evaluate(() => window.__releaseDialogWrite());
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.__dialogWriteRequests)).toBe(1);
    if (mode === "manual") await expect(page.getByRole("button", { name: "补录专注" })).toBeFocused();
  });
}
