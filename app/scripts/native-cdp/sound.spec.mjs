import { test, expect, chromium } from '@playwright/test';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { tmpdir } from 'node:os';

test('real IPC sound configuration after isolated process restart', async () => {
  const fixture = JSON.parse(process.env.FOCUSED_MOMENT_CDP_FIXTURE || 'null');
  expect(fixture).toBeTruthy();
  expect(fixture.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  const isolated = await realpath(fixture.isolationRoot);
  const temp = await realpath(tmpdir());
  const canonical = await realpath(fixture.canonicalDirectory);
  for (const [parent, child] of [[temp, isolated], [isolated, canonical]]) {
    const path = relative(parent, child);
    expect(path && !isAbsolute(path) && path !== '..' && !path.startsWith('..\\') && !path.startsWith('../')).toBeTruthy();
  }
  expect(basename(isolated)).toMatch(/^focused-moment-windows-native-[a-f0-9]{32}$/);
  const expected = { 'sound-seed': 'bright_bell', 'sound-restart': 'wooden_tick', 'sound-legacy': 'soft_chime' }[fixture.phase];
  expect(expected).toBeTruthy();
  const browser = await chromium.connectOverCDP(fixture.endpoint, { timeout: 15_000 });
  const evidence = { evidenceClass: 'native-IPC + isolated-process-restart', phase: fixture.phase, processId: fixture.processId, sourceHash: fixture.sourceHash, expected, status: 'INCOMPLETE_OR_FAIL', manual: ['audible output', 'OS notification'] };
  try {
    let page;
    await expect.poll(async () => {
      for (const context of browser.contexts()) {
        for (const candidate of context.pages()) {
          if (await candidate.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null) === 'main') {
            page = candidate;
            return true;
          }
        }
      }
      return false;
    }).toBe(true);
    const invoke = (command, args = {}) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
    const preferences = await invoke('get_timer_preferences');
    expect(preferences.alertSoundKey).toBe(expected);
    expect(preferences.soundReminderEnabled).toBe(true);
    evidence.loaded = preferences;
    // A real configuration update proves persistence; it does not prove audible playback.
    if (fixture.phase === 'sound-seed') {
      await invoke('update_timer_preferences', { preferences: { ...preferences, alertSoundKey: 'wooden_tick' } });
    } else if (fixture.phase === 'sound-legacy') {
      await invoke('update_timer_preferences', { preferences });
    }
    const persisted = JSON.parse(await readFile(resolve(canonical, 'focused-moment-state.json'), 'utf8'));
    expect(persisted.timerPreferences.alertSoundKey).toBe(fixture.phase === 'sound-seed' ? 'wooden_tick' : expected);
    expect(persisted.timerPreferences.soundReminderEnabled).toBe(true);
    // Verify the synthetic interaction data survived real process restarts too.
    expect(await invoke('get_todo_items')).toHaveLength(1);
    expect(await invoke('get_focus_records')).toHaveLength(3);
    evidence.persisted = persisted.timerPreferences;
    evidence.status = 'PASS';
  } finally {
    try { await writeFile(test.info().outputPath('sound-restart.json'), JSON.stringify(evidence, null, 2)); }
    finally { await browser.close(); }
  }
});
