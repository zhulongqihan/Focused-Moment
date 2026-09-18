import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1487, height: 1058 } });
await page.addInitScript(() => {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const timer = {
    modeKey: "stopwatch", phaseKey: "stopwatch", mode: "正向计时", phaseLabel: "正向计时",
    status: "待开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:00:00", targetDurationMs: null,
    remainingMs: null, secondaryLabel: "已累计时长", canCompleteSession: true, hasUnsubmittedProgress: false,
    activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, currentRound: 1,
    completedFocusCount: 0, completedBreakCount: 0, recoveredFromLastSession: false, modeSwitchLocked: false,
    modeSwitchHint: null, alertSequence: 0, alertKey: null, alertTitle: null, alertMessage: null,
  };
  const prefs = { pomodoroFocusMinutes: 25, pomodoroBreakMinutes: 5, stopwatchReminderMinutes: 25, toastReminderEnabled: true, windowAttentionReminderEnabled: true, soundReminderEnabled: false, alertSoundKey: "soft_chime" };
  const analytics = { totalFocusDurationMs: 0, totalFocusDurationLabel: "0 分钟", sessionCount: 0, linkedSessionCount: 0, independentSessionCount: 0, pendingTodoCount: 0, completedTodoCount: 0, activeDays: 0, averageDailyDurationLabel: "0 分钟", todayFocusDurationLabel: "0 分钟", todaySessionCount: 0, currentStreakDays: 0, bestFocusDate: null, bestFocusDurationLabel: null, dailyBreakdown: [] };
  window.__invokeLog = [];
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: () => 1,
    invoke: async (command) => {
      window.__invokeLog.push(command);
      switch (command) {
        case "get_timer_snapshot": return timer;
        case "get_timer_preferences": return prefs;
        case "get_todo_items": return [];
        case "get_focus_records": return [];
        case "get_analytics_snapshot": return analytics;
        case "list_app_backups": return [];
        case "plugin:event|listen": return 1;
        case "plugin:event|unlisten": return null;
        default: return null;
      }
    },
  };
});
await page.goto("http://127.0.0.1:1420/");
await page.getByRole("button", { name: "记录", exact: true }).click(); await page.waitForTimeout(300); await page.locator(".window-control").first().waitFor();
await page.waitForTimeout(500);
const details = await page.locator(".window-control").evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  const style = getComputedStyle(button);
  const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    label: button.getAttribute("aria-label"),
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    display: style.display, visibility: style.visibility, opacity: style.opacity, pointerEvents: style.pointerEvents, zIndex: style.zIndex, position: style.position,
    centerTag: center?.tagName, centerClass: center?.className, centerLabel: center?.getAttribute?.("aria-label"),
    parentPointerEvents: getComputedStyle(button.parentElement).pointerEvents,
  };
}));
console.log(JSON.stringify({ details, invokeLog: await page.evaluate(() => window.__invokeLog), bodyClass: await page.locator("body").getAttribute("class") }, null, 2));
for (const button of await page.locator(".window-control").all()) {
  try { await button.click({ timeout: 3000 }); } catch (error) { console.log("CLICK_ERROR", String(error)); }
}
await page.waitForTimeout(100);
console.log(JSON.stringify({ afterClick: await page.evaluate(() => window.__invokeLog) }, null, 2));
await browser.close();
