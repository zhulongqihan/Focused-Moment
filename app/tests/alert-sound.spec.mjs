import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

async function observeAudio(page) {
  await page.addInitScript(() => {
    window.__audioSources = [];
    window.Audio = class {
      constructor(source) { this.source = source; }
      play() { window.__audioSources.push(this.source); return Promise.resolve(); }
    };
  });
}

async function triggerAlert(page, sequence) {
  await page.evaluate(async (alertSequence) => {
    window.__replaceTimer({ alertSequence, alertKey: "stopwatch_target", alertTitle: "专注提醒", alertMessage: "已到提醒时间" });
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", {
      event: "app-state-sync", payload: window.__getAppStateSyncPayload(),
    });
  }, sequence);
}

test("custom sound preview and automatic alerts use the saved source after migration, replacement and clearing", async ({ page }) => {
  await observeAudio(page);
  await page.addInitScript(() => {
    localStorage.setItem("focused-moment.custom-alert-sound.data", "data:audio/wav;base64,TEVHQUNZ");
    localStorage.setItem("focused-moment.custom-alert-sound.name", "legacy.wav");
  });
  await bootWithTauriMock(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("focused-moment.custom-alert-sound.data"))).toBeNull();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const input = page.locator('input[type="file"][accept*="audio"]');
  await input.setInputFiles({ name: "first.wav", mimeType: "audio/wav", buffer: Buffer.from("FIRST") });
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).customAlertSoundName)).toBe("first.wav");
  await page.getByRole("button", { name: /试听/ }).click();
  await triggerAlert(page, 1);
  await expect.poll(() => page.evaluate(() => window.__audioSources)).toEqual([
    "data:audio/wav;base64,RklSU1Q=", "data:audio/wav;base64,RklSU1Q=",
  ]);
  await triggerAlert(page, 1);
  await expect.poll(() => page.evaluate(() => window.__audioSources.length)).toBe(2);
  await input.setInputFiles({ name: "second.wav", mimeType: "audio/wav", buffer: Buffer.from("SECOND") });
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).customAlertSoundName)).toBe("second.wav");
  await triggerAlert(page, 2);
  await expect.poll(() => page.evaluate(() => window.__audioSources.at(-1))).toBe("data:audio/wav;base64,U0VDT05E");
  await page.getByRole("button", { name: "移除自定义", exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_preferences")).alertSoundKey)).toBe("soft_chime");
  await triggerAlert(page, 3);
  await expect.poll(() => page.evaluate(() => window.__audioSources.length)).toBe(3);
});

test("restored preferences supply custom audio without a legacy localStorage key", async ({ page }) => {
  await observeAudio(page);
  await bootWithTauriMock(page);
  await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    await invoke("update_app_preferences", { preferences: { ...await invoke("get_app_preferences"), customAlertSoundName: "restored.wav", customAlertSoundData: "data:audio/wav;base64,UkVTVE9SRUQ=" } });
    await invoke("update_timer_preferences", { preferences: { ...await invoke("get_timer_preferences"), alertSoundKey: "custom" } });
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByText("restored.wav").first()).toBeVisible();
  await triggerAlert(page, 2);
  await expect.poll(() => page.evaluate(() => window.__audioSources)).toEqual(["data:audio/wav;base64,UkVTVE9SRUQ="]);
});

test("floating windows display the same alert without playing a second sound", async ({ context, page }) => {
  await observeAudio(page);
  await bootWithTauriMock(page);
  const floating = await context.newPage();
  await observeAudio(floating);
  await bootWithTauriMock(floating, { windowLabel: "todo-float" });
  for (const target of [page, floating]) {
    await target.evaluate(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      await invoke("update_timer_preferences", { preferences: { ...await invoke("get_timer_preferences"), alertSoundKey: "custom" } });
      await invoke("update_app_preferences", { preferences: { ...await invoke("get_app_preferences"), customAlertSoundName: "shared.wav", customAlertSoundData: "data:audio/wav;base64,U0hBUkVE" } });
    });
  }
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByText("shared.wav").first()).toBeVisible();
  await triggerAlert(floating, 5);
  await triggerAlert(page, 5);
  await expect.poll(() => page.evaluate(() => window.__audioSources.length)).toBe(1);
  expect(await floating.evaluate(() => window.__audioSources)).toEqual([]);
  await floating.close();
});
