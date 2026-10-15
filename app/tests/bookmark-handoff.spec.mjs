import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

test("main window reads pending bookmark notices on startup and saves with acknowledgement", async ({ page }) => {
  await bootWithTauriMock(page, {
    initialPendingBookmarkNotices: [{ recordId: 41, todoId: 1, title: "旧标题" }],
  });

  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByText("“写完产品复盘”")).toBeVisible();
  await prompt.locator("textarea").fill("从验证结论开始");
  await prompt.getByRole("button", { name: "保存下次位置" }).click();
  await expect(prompt).toHaveCount(0);

  const result = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    return {
      notices: await invoke("get_pending_bookmark_notices"),
      todos: await invoke("get_todo_items"),
      saves: window.__bookmarkSaveCalls,
      acknowledgements: window.__bookmarkAcknowledgementCalls,
    };
  });
  expect(result.notices).toEqual([]);
  expect(result.todos.find((item) => item.id === 1).continuationNote).toBe("从验证结论开始");
  expect(result.saves).toBe(1);
  expect(result.acknowledgements).toBe(0);
});

test("main queries the native queue after a completion notification", async ({ page }) => {
  await bootWithTauriMock(page);
  await expect.poll(() => page.evaluate(() => window.__pendingBookmarkEventReady)).toBe(true);

  await page.evaluate(async () => {
    window.__replaceTimer({
      elapsedMs: 60_000,
      linkedTodoId: 1,
      activeTaskTitle: "写完产品复盘",
      completeLinkedTodoOnFinish: false,
    });
    await window.__TAURI_INTERNALS__.invoke("complete_focus_session", { title: "写完产品复盘" });
  });

  await expect(page.getByRole("dialog", { name: "保存停笔书签" })).toBeVisible();
  expect(await page.evaluate(() => window.__pendingBookmarkQueryCalls)).toBeGreaterThan(0);
});

test("showing the main window re-queries pending notices", async ({ page }) => {
  await bootWithTauriMock(page);
  await expect.poll(() => page.evaluate(() => window.__mainWindowShownEventReady)).toBe(true);
  const queriesBefore = await page.evaluate(() => window.__pendingBookmarkQueryCalls);

  await page.evaluate(async () => {
    window.__queuePendingBookmarkNotice({ recordId: 45, todoId: 1, title: "写完产品复盘" });
    await window.__TAURI_INTERNALS__.invoke("restore_main_from_focus_floating");
  });

  await expect(page.getByRole("dialog", { name: "保存停笔书签" })).toBeVisible();
  expect(await page.evaluate(() => window.__pendingBookmarkQueryCalls)).toBeGreaterThan(queriesBefore);
});

test("explicitly skipping a pending bookmark removes only its notice", async ({ page }) => {
  await bootWithTauriMock(page, {
    initialPendingBookmarkNotices: [
      { recordId: 51, todoId: 1, title: "写完产品复盘" },
      { recordId: 52, todoId: 1, title: "写完产品复盘" },
    ],
  });

  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "暂不记录" }).click();
  await expect(prompt).toBeVisible();

  const result = await page.evaluate(async () => ({
    notices: await window.__TAURI_INTERNALS__.invoke("get_pending_bookmark_notices"),
    acknowledgements: window.__bookmarkAcknowledgementCalls,
    saves: window.__bookmarkSaveCalls,
  }));
  expect(result.notices.map((notice) => notice.recordId)).toEqual([52]);
  expect(result.acknowledgements).toBe(1);
  expect(result.saves).toBe(0);
});

test("completed and deleted linked todos do not surface stale bookmark prompts", async ({ page }) => {
  await bootWithTauriMock(page, {
    completedTodoCount: 1,
    initialPendingBookmarkNotices: [
      { recordId: 61, todoId: 600, title: "已完成事项 1" },
      { recordId: 62, todoId: 999, title: "已删除事项" },
    ],
  });

  await expect.poll(() => page.evaluate(() => window.__pendingBookmarkQueryCalls)).toBeGreaterThan(0);
  await expect(page.getByRole("dialog", { name: "保存停笔书签" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_pending_bookmark_notices"))).toEqual([]);
});

test("floating completion queues one notice and retrying main restoration never saves again", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-float", pausedFocus: true });
  await page.evaluate(() => {
    window.__replaceTimer({ linkedTodoId: 1, activeTaskTitle: "写完产品复盘" });
    window.__failNextMainRestore = true;
  });

  await page.getByRole("button", { name: "完成并记录" }).click();
  await expect.poll(() => page.evaluate(() => window.__completedFocusCalls)).toBe(1);
  await expect(page.getByRole("button", { name: "重试后续步骤" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mainRestoreCalls)).toBe(1);

  const queued = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_pending_bookmark_notices"));
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({ recordId: 1000, todoId: 1, title: "写完产品复盘" });
  await expect(page.getByRole("dialog", { name: "保存停笔书签" })).toHaveCount(0);

  await page.getByRole("button", { name: "重试后续步骤" }).click();
  await expect.poll(() => page.evaluate(() => window.__mainRestoreCalls)).toBe(2);
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
  expect(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_pending_bookmark_notices"))).toHaveLength(1);
});
