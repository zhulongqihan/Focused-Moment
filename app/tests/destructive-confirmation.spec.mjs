import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

const operations = [
  { name: "local backup restore", button: "导入并替换当前数据", command: "import_app_backup", success: "已恢复" },
  { name: "portable backup import", button: "确认导入并生成回滚", command: "import_app_backup_path", success: "已恢复", portable: true },
  { name: "clear local data", button: "清空当前数据", command: "clear_app_data", success: "本地数据已清空" },
];

async function savedData(page) {
  return page.evaluate(async () => ({
    todos: await window.__TAURI_INTERNALS__.invoke("get_todo_items"),
    records: await window.__TAURI_INTERNALS__.invoke("get_focus_records"),
  }));
}

for (const operation of operations) {
  test(`${operation.name} waits for the native async confirmation and never writes on cancel or failure`, async ({ page }) => {
    await bootWithTauriMock(page, { includeRecords: true });
    await page.evaluate(() => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const writes = ["import_app_backup", "import_app_backup_path", "clear_app_data"];
      window.__destructiveWrites = [];
      window.__confirmationCount = 0;
      window.__TAURI_INTERNALS__.invoke = (command, args) => {
        if (command === "plugin:dialog|confirm") throw new Error("Legacy dialog command is not registered");
        if (command === "list_app_backups") return Promise.resolve([{
          fileName: "saved-before-upgrade.json",
          exportedAt: "2026-10-22T12:00:00Z",
          formatVersion: 3,
          schemaVersion: 3,
          todoCount: 1,
          focusRecordCount: 1,
          migrationNeeded: false,
        }]);
        if (writes.includes(command)) window.__destructiveWrites.push({ command, args });
        return invoke(command, args);
      };
      const invokeWithWrites = window.__TAURI_INTERNALS__.invoke;
      window.__TAURI_INTERNALS__.invoke = (command, args) => command === "plugin:dialog|message" ? new Promise((resolve, reject) => {
        window.__confirmationCount += 1;
        window.__answerConfirmation = (accepted) => resolve(accepted ? "Ok" : "Cancel");
        window.__failConfirmation = () => reject(new Error("模拟确认框无法打开"));
      }) : invokeWithWrites(command, args);
      // The plugin's legacy window.confirm bridge calls a command no longer registered.
      window.confirm = async () => window.__TAURI_INTERNALS__.invoke("plugin:dialog|confirm");
    });
    const before = await savedData(page);
    await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "设置", exact: true }).click();
    if (operation.portable) {
      await page.getByRole("textbox", { name: "外部备份文件路径" }).fill("C:/backups/before-upgrade.json");
      await page.getByRole("button", { name: "预览", exact: true }).click();
      await expect(page.locator(".portable-backup-panel__preview")).toBeVisible();
    }
    const button = page.getByRole("button", { name: operation.button, exact: true });

    await button.click();
    await expect.poll(() => page.evaluate(() => window.__confirmationCount)).toBe(1);
    expect(await page.evaluate(() => window.__destructiveWrites)).toEqual([]);
    await expect(button).toBeDisabled();
    expect(await savedData(page)).toEqual(before);
    await page.evaluate(() => window.__answerConfirmation(false));
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => window.__destructiveWrites)).toEqual([]);
    expect(await savedData(page)).toEqual(before);

    await button.click();
    await expect.poll(() => page.evaluate(() => window.__confirmationCount)).toBe(2);
    await page.evaluate(() => window.__failConfirmation());
    await expect(page.locator(".app-message")).toContainText("模拟确认框无法打开");
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => window.__destructiveWrites)).toEqual([]);
    expect(await savedData(page)).toEqual(before);

    await button.click();
    await expect.poll(() => page.evaluate(() => window.__confirmationCount)).toBe(3);
    if (operation.portable) {
      await page.getByRole("textbox", { name: "外部备份文件路径" }).fill("C:/backups/changed-while-confirming.json");
      await page.getByRole("checkbox", { name: "同时恢复主题、视觉设置和自定义音效" }).check();
    }
    await page.evaluate(() => window.__answerConfirmation(true));
    await expect(page.locator(".app-message")).toContainText(operation.success);
    const writes = await page.evaluate(() => window.__destructiveWrites);
    expect(writes).toHaveLength(1);
    expect(writes[0].command).toBe(operation.command);
    if (operation.command === "import_app_backup") {
      expect(writes[0].args.fileName).toBe("saved-before-upgrade.json");
    } else if (operation.portable) {
      expect(writes[0].args.path).toBe("C:/backups/before-upgrade.json");
      expect(writes[0].args.restoreAppPreferences).toBe(false);
    } else {
      expect(await savedData(page)).toEqual({ todos: [], records: [] });
    }
  });
}

test("portable import requires the preview to match the selected file", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.evaluate(() => {
    window.__confirmationCount = 0;
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = (command, args) => {
      if (command === "plugin:dialog|message") { window.__confirmationCount += 1; return Promise.resolve("Cancel"); }
      return invoke(command, args);
    };
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const path = page.getByRole("textbox", { name: "外部备份文件路径" });
  await path.fill("C:/backups/previewed.json");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator(".portable-backup-panel__preview")).toBeVisible();
  await path.fill("C:/backups/not-previewed.json");
  await page.getByRole("button", { name: "确认导入并生成回滚" }).click();
  await expect(page.locator(".app-message")).toContainText("请先预览");
  expect(await page.evaluate(() => window.__confirmationCount)).toBe(0);
  expect(await page.evaluate(() => window.__backupImportCalls)).toBe(0);
});
