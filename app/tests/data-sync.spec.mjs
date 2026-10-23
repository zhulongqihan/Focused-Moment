import { expect, test } from "@playwright/test";

import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

async function waitForInitialSync(page) {
  await expect.poll(() => page.evaluate(() => window.__revisionEventReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__businessSyncCalls)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__customAlertAudioReads)).toBeGreaterThan(0);
}

test("a stable main window makes no periodic business reads or audio rereads for sixty seconds", async ({ page }) => {
  test.setTimeout(90_000);
  await bootWithTauriMock(page);
  await waitForInitialSync(page);

  const before = await page.evaluate(() => ({
    business: window.__businessSyncCalls,
    audio: window.__customAlertAudioReads,
    timerReads: window.__timerSyncSnapshotCalls,
    timerBroadcasts: window.__timerSyncSampleEmits,
  }));
  await page.waitForTimeout(60_000);
  const after = await page.evaluate(() => ({
    business: window.__businessSyncCalls,
    audio: window.__customAlertAudioReads,
    timerReads: window.__timerSyncSnapshotCalls,
    timerBroadcasts: window.__timerSyncSampleEmits,
    fullBusinessBroadcasts: window.__fullBusinessBroadcastEmits,
  }));

  expect(after.business).toBe(before.business);
  expect(after.audio).toBe(before.audio);
  expect(after.timerReads).toBeGreaterThan(before.timerReads + 40);
  expect(after.timerBroadcasts).toBeGreaterThan(before.timerBroadcasts + 40);
  expect(after.fullBusinessBroadcasts).toBe(0);
});

test("a slow stale snapshot stays single-flight and applies the latest revision", async ({ page }) => {
  await bootWithTauriMock(page);
  await waitForInitialSync(page);
  await page.getByRole("button", { name: /^待办/ }).click();
  await expect(page.getByText("写完产品复盘", { exact: true }).first()).toBeVisible();

  const callsBefore = await page.evaluate(() => window.__businessSyncCalls);
  await page.evaluate(() => {
    window.__holdNextSyncSnapshot = true;
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ todoRevision: revisions.todoRevision + 1 });
  });
  await expect.poll(() => page.evaluate(() => window.__releaseSyncSnapshot !== null)).toBe(true);

  await page.evaluate(() => {
    const nextTodos = window.__getAppStateSyncPayload().todos.map((item) => item.id === 1
      ? { ...item, title: "慢请求期间提交的最新待办" }
      : item);
    window.__replaceTodos(nextTodos);
    const revisions = window.__getDataRevisions();
    window.__setDataRevisions({ todoRevision: revisions.todoRevision + 1 });
    window.__releaseSyncSnapshot?.();
    window.__releaseSyncSnapshot = null;
  });

  await expect(page.getByText("慢请求期间提交的最新待办", { exact: true }).first()).toBeVisible();
  const metrics = await page.evaluate(() => ({
    calls: window.__businessSyncCalls,
    maximumInFlight: window.__maxBusinessSyncInFlight,
  }));
  expect(metrics.calls).toBeGreaterThanOrEqual(callsBefore + 2);
  expect(metrics.maximumInFlight).toBe(1);
});

test("the thirty-second revision calibration recovers a missed event", async ({ page }) => {
  await bootWithTauriMock(page);
  await waitForInitialSync(page);
  await page.getByRole("button", { name: /^待办/ }).click();

  const before = await page.evaluate(() => ({
    calls: window.__businessSyncCalls,
    calibrationIntervals: window.__revisionCalibrationCallbacks.length,
  }));
  expect(before.calibrationIntervals).toBeGreaterThan(0);
  await page.evaluate(() => {
    const nextTodos = window.__getAppStateSyncPayload().todos.map((item) => item.id === 1
      ? { ...item, title: "漏掉事件后校准发现的待办" }
      : item);
    window.__replaceTodos(nextTodos);
    const revisions = window.__getDataRevisions();
    window.__setDataRevisionsSilently({ todoRevision: revisions.todoRevision + 1 });
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(before.calls);

  await page.evaluate(() => window.__triggerRevisionCalibration());
  await expect(page.getByText("漏掉事件后校准发现的待办", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBeGreaterThan(before.calls);
});

test("unchanged revision traffic stays fixed-size with ten thousand records and five megabytes of audio", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await waitForInitialSync(page);

  const baselineLength = await page.evaluate(async () => JSON.stringify(
    await window.__TAURI_INTERNALS__.invoke("get_data_revisions"),
  ).length);
  for (const recordCount of [1_000, 10_000]) {
    await page.evaluate((count) => {
      const today = new Date().toISOString().slice(0, 10);
      window.__replaceRecords(Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        title: `记录 ${index + 1}`,
        durationMs: 60_000,
        durationLabel: "00:01:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${today}T12:00:00`,
        completedDate: today,
        completedTime: "12:00",
        source: "timer",
        timeBasis: "completion_day",
        editedAt: null,
      })));
    }, recordCount);
    if (recordCount === 10_000) {
      await page.evaluate(() => window.__setCustomAlertAudioData("large-audio.wav", "A".repeat(5 * 1024 * 1024)));
    }
    const response = await page.evaluate(async () => window.__TAURI_INTERNALS__.invoke("get_sync_snapshot", {
      domains: [],
      includeAnalytics: false,
    }));
    const revisionLength = await page.evaluate(async () => JSON.stringify(
      await window.__TAURI_INTERNALS__.invoke("get_data_revisions"),
    ).length);
    expect(revisionLength).toBe(baselineLength);
    expect(Object.keys(response).sort()).toEqual(["revisions"]);
  }
  expect(await page.evaluate(() => window.__customAlertAudioReads)).toBe(1);
});

test("appearance changes do not reread audio, audio changes do, and floating windows never load it", async ({ page, context }) => {
  await bootWithTauriMock(page);
  await waitForInitialSync(page);
  const initialAudioReads = await page.evaluate(() => window.__customAlertAudioReads);
  const initialBusinessCalls = await page.evaluate(() => window.__businessSyncCalls);

  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("update_app_preferences", {
    preferences: { themeId: "editorial-paper" },
  }));
  await expect.poll(() => page.evaluate(() => window.__businessSyncCalls)).toBeGreaterThan(initialBusinessCalls);
  expect(await page.evaluate(() => window.__customAlertAudioReads)).toBe(initialAudioReads);

  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("update_custom_alert_audio", {
    name: "test-alert.wav",
    data: "data:audio/wav;base64,AA==",
  }));
  await expect.poll(() => page.evaluate(() => window.__customAlertAudioReads)).toBe(initialAudioReads + 1);

  const floating = await context.newPage();
  await bootWithTauriMock(floating, { windowLabel: "todo-float", pausedFocus: true });
  await expect.poll(() => floating.evaluate(() => window.__revisionEventReady)).toBe(true);
  await expect.poll(() => floating.evaluate(() => window.__businessSyncCalls)).toBeGreaterThan(0);
  expect(await floating.evaluate(() => window.__customAlertAudioReads)).toBe(0);
});

test("a successful business refresh does not cancel an audio-read retry", async ({ page }) => {
  await bootWithTauriMock(page);
  await waitForInitialSync(page);
  const initialAudioReads = await page.evaluate(() => window.__customAlertAudioReads);
  const initialBusinessCalls = await page.evaluate(() => window.__businessSyncCalls);

  await page.evaluate(() => {
    window.__failNextCustomAlertAudioRead = true;
    return window.__TAURI_INTERNALS__.invoke("update_custom_alert_audio", {
      name: "retry-alert.wav",
      data: "data:audio/wav;base64,AA==",
    });
  });
  await expect.poll(() => page.evaluate(() => window.__customAlertAudioReads), { timeout: 3000 })
    .toBe(initialAudioReads + 1);
  await expect.poll(() => page.evaluate(() => window.__businessSyncCalls), { timeout: 3000 })
    .toBeGreaterThan(initialBusinessCalls);
  await expect.poll(() => page.evaluate(() => window.__customAlertAudioReads), { timeout: 4000 })
    .toBe(initialAudioReads + 2);
});

test("floating timer polling starts only after the main sample is stale and rejects older samples", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });
  await expect.poll(() => page.evaluate(() => window.__timerSyncSampleReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__timerSyncSnapshotCalls)).toBeGreaterThan(0);

  const beforeFallback = await page.evaluate(() => window.__timerSyncSnapshotCalls);
  await page.waitForTimeout(2800);
  await expect.poll(() => page.evaluate(() => window.__timerSyncSnapshotCalls), { timeout: 2500 })
    .toBeGreaterThan(beforeFallback);

  await page.evaluate(() => {
    const revisions = window.__getDataRevisions();
    const timer = window.__getAppStateSyncPayload().timer;
    window.__emitTimerSamplePayload({
      processId: revisions.processId,
      sampleSequence: 500,
      timerOperationRevision: revisions.timerOperationRevision,
      timer: { ...timer, elapsedMs: 83_000, elapsedLabel: "00:01:23", status: "已暂停" },
    });
  });
  await expect(page.getByText("00:01:23", { exact: true })).toBeVisible();
  const afterMainSample = await page.evaluate(() => window.__timerSyncSnapshotCalls);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__timerSyncSnapshotCalls)).toBe(afterMainSample);

  await page.evaluate(() => {
    const revisions = window.__getDataRevisions();
    const timer = window.__getAppStateSyncPayload().timer;
    window.__emitTimerSamplePayload({
      processId: revisions.processId,
      sampleSequence: 499,
      timerOperationRevision: revisions.timerOperationRevision,
      timer: { ...timer, elapsedMs: 1_000, elapsedLabel: "00:00:01", status: "过期样本" },
    });
  });
  await page.waitForTimeout(50);
  await expect(page.getByText("00:01:23", { exact: true })).toBeVisible();

  await expect(page.getByText("00:01:23", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__businessSyncCalls)).toBe(1);
});
