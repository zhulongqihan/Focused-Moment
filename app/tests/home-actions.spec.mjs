import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";
import { testOutputPath } from "./helpers/test-output.mjs";

const themes = [
  ["night-valley", ".trail-page"],
  ["editorial-paper", ".ep-today-page"],
  ["graphite-console", ".gc-today-page"],
  ["metro-pulse", ".mp-today-page"],
  ["clutch-court", ".cc-today-page"],
  ["legacy-aurora-ocean", ".ao-today-page"],
  ["legacy-botanical-library", ".bl-today-page"],
];

async function selectTheme(page, themeId, surface) {
  // The heading renders before initial sync; wait for application readiness before changing themes.
  await expect(page.locator(".trail-page [data-home-focus-primary]")).toBeEnabled();
  await page.evaluate(async (id) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const preferences = await invoke("get_app_preferences");
    await invoke("update_app_preferences", { preferences: { ...preferences, themeId: id } });
  }, themeId);
  await expect(page.locator(surface)).toBeVisible();
}

async function assertControlsFit(page, surface) {
  for (const control of await page.locator(`${surface} [data-home-focus-primary], ${surface} [data-home-focus-save]`).all()) {
    await expect(control).toBeVisible();
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(bounds.height).toBeGreaterThanOrEqual(28);
    await control.click({ trial: true });
  }
}

for (const [themeId, surface] of themes) {
  test(`${themeId}: Today starts, pauses, resumes and saves the same session`, async ({ page }) => {
    await page.setViewportSize({ width: 1487, height: 1058 });
    await bootWithTauriMock(page);
    await selectTheme(page, themeId, surface);
    const primary = page.locator(`${surface} [data-home-focus-primary]`);
    await expect(primary).toHaveAccessibleName("开始专注");
    await primary.click();
    await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
    await expect(primary).toHaveAccessibleName("暂停专注");
    await expect(page.locator(`${surface} [data-home-focus-save]`)).toBeEnabled();
    await assertControlsFit(page, surface);
    await page.screenshot({ path: testOutputPath("running-desktop.png"), fullPage: true, animations: "disabled" });

    await primary.click();
    await expect.poll(() => page.evaluate(() => window.__pauseTimerCalls)).toBe(1);
    await expect(primary).toHaveAccessibleName("继续专注");
    await primary.click();
    await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(2);
    await expect(primary).toHaveAccessibleName("暂停专注");

    await page.setViewportSize({ width: 390, height: 844 });
    await assertControlsFit(page, surface);
    await page.screenshot({ path: testOutputPath("running-narrow.png"), fullPage: true, animations: "disabled" });
    await page.locator(`${surface} [data-home-focus-save]`).click();
    await expect.poll(() => page.evaluate(() => window.__completedFocusCalls)).toBe(1);
    await expect(primary).toHaveAccessibleName("开始专注");
    const result = await page.evaluate(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      return { timer: await invoke("get_timer_snapshot"), records: await invoke("get_focus_records") };
    });
    expect(result.timer.hasUnsubmittedProgress).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ title: "写完产品复盘", linkedTodoId: 1, durationMs: 60_000 });
    await expect(page.locator(surface)).toBeVisible();
  });

  test(`${themeId}: active unlinked session remains actionable with an empty todo list and expiry saves`, async ({ page }) => {
    await bootWithTauriMock(page, { todayTodoCount: 0, pausedFocus: true });
    await selectTheme(page, themeId, surface);
    const primary = page.locator(`${surface} [data-home-focus-primary]`);
    await expect(primary).toHaveAccessibleName("继续专注");
    await primary.click();
    await expect(primary).toHaveAccessibleName("暂停专注");
    await page.evaluate(() => window.__replaceTimer({
      isRunning: false, modeKey: "countdown", remainingMs: 0, elapsedMs: 60_000,
      elapsedLabel: "00:00:00", activeTaskTitle: "独立专注", linkedTodoId: null,
    }));
    await expect(primary).toHaveAccessibleName("完成并记录");
    await expect(page.locator(`${surface} [data-home-focus-save]`)).toHaveCount(0);
    await primary.click();
    await expect.poll(() => page.evaluate(() => window.__completedFocusCalls)).toBe(1);
    expect(await page.evaluate(() => window.__startTimerCalls)).toBe(1);
    await expect(primary).toHaveAccessibleName("快速记事");
  });

  test(`${themeId}: empty Today opens quick capture without starting a session`, async ({ page }) => {
    await bootWithTauriMock(page, { todayTodoCount: 0 });
    await selectTheme(page, themeId, surface);
    const primary = page.locator(`${surface} [data-home-focus-primary]`);
    await expect(primary).toHaveAccessibleName("快速记事");
    await primary.click();
    await expect(page.getByRole("dialog", { name: "先记下来，稍后再整理" })).toBeVisible();
    expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
    expect(await page.evaluate(() => window.__quickCaptureCalls)).toBe(0);
  });
}

test("Night Valley completed todo node opens todos without starting another session", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 0, completedTodoCount: 1 });
  await page.locator(".trail-node--done").first().click();
  await expect(page.locator(".minimal-nav > button").filter({ hasText: "待办" })).toHaveClass(/active/);
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
});

test("Night Valley record node opens records without starting another session", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 0, includeRecords: true });
  await page.locator(".trail-node--done").first().click();
  await expect(page.locator(".minimal-nav > button").filter({ hasText: "记录" })).toHaveClass(/active/);
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
});
