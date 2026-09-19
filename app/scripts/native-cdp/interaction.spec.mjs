import { test, expect, chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// No mock injection, browser launch, Vite server, or access to the real user profile.
test('isolated release WebView2: capture, timer, records, backup and reload', async () => {
  const fixture = JSON.parse(process.env.FOCUSED_MOMENT_CDP_FIXTURE || 'null');
  expect(fixture, 'Launch only through windows-native-smoke.ps1 -CdpInteraction').toBeTruthy();
  expect(fixture.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  const isolated = await realpath(fixture.isolationRoot);
  const temp = await realpath(tmpdir());
  const inside = (parent, child) => {
    const path = relative(parent, child);
    expect(path && !isAbsolute(path) && path !== '..' && !path.startsWith(`..\\`) && !path.startsWith('../')).toBeTruthy();
  };
  inside(temp, isolated);
  expect(basename(isolated)).toMatch(/^focused-moment-windows-native-[a-f0-9]{32}$/);
  const canonical = await realpath(fixture.canonicalDirectory);
  inside(isolated, canonical);
  const statePath = resolve(canonical, 'focused-moment-state.json');
  const state = async () => JSON.parse(await readFile(statePath, 'utf8'));
  // Abort before interaction if the purported fresh fixture contains any data.
  expect((await state()).todoItems).toEqual([]);
  expect((await state()).focusRecords).toEqual([]);

  const checks = [];
  const browser = await chromium.connectOverCDP(fixture.endpoint, { timeout: 15_000 });
  let page;
  let passed = false;
  const errors = [];
  const hwndEvidence = [];
  const inspectWindows = async () => {
    const windowsPowerShell = resolve(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const { stdout } = await promisify(execFile)(windowsPowerShell, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('./inspect-windows.ps1', import.meta.url)),
      '-ApplicationProcessId', String(fixture.processId), '-ExpectedExecutable', fixture.executable,
    ], { windowsHide: true, timeout: 15_000, encoding: 'utf8' });
    return JSON.parse(stdout.replace(/^\uFEFF/, ''));
  };
  const evidence = async (name, data) => {
    const path = test.info().outputPath(name);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2));
  };
  try {
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
    page.on('pageerror', error => errors.push(error.message));
    const invoke = (command, args = {}) => page.evaluate(({ command, args }) =>
      window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
    expect((await invoke('bootstrap_shell')).version).toBe(JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version);
    const nav = name => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true });
    const title = `RC synthetic ${fixture.runId}`;
    await page.getByRole('button', { name: '快速记一件事', exact: true }).click();
    const capture = page.getByRole('dialog', { name: '先记下来，稍后再整理' });
    await capture.getByRole('textbox').fill(title);
    await capture.getByRole('button', { name: '放入收件箱' }).click();
    await expect(capture).toBeHidden();
    await expect.poll(async () => (await state()).todoItems.length).toBe(1);
    const todo = (await invoke('get_todo_items'))[0];
    expect(todo.title).toBe(title);
    expect(todo.scheduledDate).toBe('');
    checks.push('UI capture -> Rust -> synthetic disk; inbox date empty');

    await nav('待办').click();
    const row = page.locator('.focus-plan-controls__row').filter({ hasText: title });
    await row.getByRole('button', { name: '设为当前', exact: true }).click();
    await expect.poll(async () => (await invoke('get_focus_plan')).currentTodoId).toBe(todo.id);
    await row.getByRole('button', { name: '加入精选', exact: true }).click();
    await expect.poll(async () => (await invoke('get_focus_plan')).todayPickIds).toEqual([todo.id]);
    await row.getByRole('button', { name: '开始专注', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(true);
    expect((await invoke('get_timer_snapshot')).linkedTodoId).toBe(todo.id);
    expect((await invoke('get_app_preferences')).autoMiniOnStart).toBe(false);
    // Hidden/lazy CDP pages do not prove native window visibility. Sample real HWNDs.
    for (let sample = 0; sample < 3; sample += 1) {
      const windows = await inspectWindows();
      hwndEvidence.push({ stage: 'default-start', ...windows });
      expect(windows.windows.some(x => x.title === 'Focused Moment' && x.visible)).toBe(true);
      expect(windows.windows.filter(x => ['Focused Moment 迷你工作台', 'Focused Moment 专注'].includes(x.title) && x.visible)).toEqual([]);
      await page.waitForTimeout(250);
    }
    await nav('计时').click();
    await page.getByRole('button', { name: '迷你工作台', exact: true }).click();
    let mini;
    await expect.poll(async () => {
      for (const context of browser.contexts()) {
        for (const candidate of context.pages()) {
          if (await candidate.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null) === 'todo-float') {
            mini = candidate;
            return true;
          }
        }
      }
      return false;
    }).toBe(true);
    await expect.poll(async () => (await inspectWindows()).windows.some(x => x.title === 'Focused Moment 迷你工作台' && x.visible)).toBe(true);
    hwndEvidence.push({ stage: 'explicit-mini-open', ...await inspectWindows() });
    // Opening mini intentionally hides main. Show main for the existing cross-window checks.
    await invoke('show_main_window_from_tray');
    await expect.poll(async () => (await inspectWindows()).windows.some(x => x.title === 'Focused Moment' && x.visible)).toBe(true);
    mini.on('pageerror', error => errors.push(`mini: ${error.message}`));
    await mini.getByRole('navigation', { name: '悬浮内容' }).getByRole('button', { name: /当前计时/ }).click();
    const miniInvoke = command => mini.evaluate(command => window.__TAURI_INTERNALS__.invoke(command), command);
    await mini.getByRole('button', { name: '暂停', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(false);
    await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await expect.poll(async () => (await miniInvoke('get_timer_snapshot')).isRunning).toBe(true);
    await expect(mini.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(mini.getByRole('button', { name: '继续', exact: true })).toBeVisible();
    await mini.getByRole('button', { name: '继续', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(true);
    checks.push('UI+HWND: no visible mini on default start; explicit mini click; cross-window pause/resume with Rust reads');
    await mini.getByRole('button', { name: '返回', exact: true }).click();
    await expect.poll(async () => (await inspectWindows()).windows.filter(x => x.title === 'Focused Moment 迷你工作台').length).toBe(0);
    // Compatibility IPC must recreate the new mini, never a hidden or visible old focus-float.
    await invoke('show_focus_floating');
    let aliasMini;
    let aliasLabels = [];
    await expect.poll(async () => {
      const pages = browser.contexts().flatMap(context => context.pages());
      aliasLabels = await Promise.all(pages.map(candidate => candidate.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null)));
      aliasMini = pages[aliasLabels.indexOf('todo-float')];
      return aliasLabels.filter(label => label === 'todo-float').length === 1;
    }).toBe(true);
    expect(aliasLabels).not.toContain('focus-float');
    const aliasWindows = await inspectWindows();
    expect(aliasWindows.windows.filter(x => x.title === 'Focused Moment 迷你工作台' && x.visible)).toHaveLength(1);
    expect(aliasWindows.windows.filter(x => x.title === 'Focused Moment 专注')).toEqual([]);
    hwndEvidence.push({ stage: 'legacy-IPC-alias', labels: aliasLabels, ...aliasWindows });
    await aliasMini.getByRole('button', { name: '返回', exact: true }).click();
    await expect.poll(async () => (await inspectWindows()).windows.some(x => x.title === 'Focused Moment' && x.visible)).toBe(true);
    checks.push('IPC+HWND+CDP: legacy show_focus_floating creates one new todo-float; no old focus-float page or HWND; real return button restores main');
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(false);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(true);
    await page.waitForTimeout(1500); // Real elapsed time: no fake clock or synthetic completion.
    await page.getByRole('button', { name: '完成并记录', exact: true }).click();
    const bookmark = page.getByRole('dialog', { name: '保存停笔书签' });
    await bookmark.getByRole('textbox').fill('RC synthetic continuation');
    await bookmark.getByRole('button', { name: '保存下次位置' }).click();
    await expect(bookmark).toBeHidden();
    const records = await invoke('get_focus_records');
    expect(records).toHaveLength(1);
    expect(records[0].linkedTodoId).toBe(todo.id);
    expect(records[0].durationMs).toBeGreaterThan(0);
    expect((await invoke('get_todo_items'))[0].isCompleted).toBe(false);
    expect((await invoke('get_todo_items'))[0].continuationNote).toBe('RC synthetic continuation');
    checks.push('UI current/pick/start/pause/resume/finish/bookmark; real Rust state; todo stays open');

    await nav('今日').click();
    await page.getByRole('button', { name: '继续专注', exact: true }).click();
    await expect.poll(async () => (await invoke('get_timer_snapshot')).isRunning).toBe(true);
    await page.waitForTimeout(1500);
    await nav('计时').click();
    await page.getByRole('button', { name: '完成并记录', exact: true }).click();
    await bookmark.getByRole('button', { name: '暂不记录', exact: true }).click();
    await expect(bookmark).toBeHidden();
    expect(await invoke('get_focus_records')).toHaveLength(2);
    expect((await invoke('get_todo_items'))[0].isCompleted).toBe(false);
    checks.push('second real round on same todo; skip bookmark; no auto-completion');

    await nav('记录').click();
    await page.getByRole('button', { name: '补录专注', exact: true }).click();
    const manual = page.getByRole('dialog', { name: '补录一段专注' });
    await manual.getByRole('textbox', { name: '标题', exact: true }).fill('RC synthetic manual');
    await manual.getByRole('spinbutton', { name: '时长（分钟）' }).fill('35');
    await manual.getByRole('button', { name: '补录记录', exact: true }).click();
    const record = page.locator('.record-row').filter({ hasText: 'RC synthetic manual' });
    await record.getByRole('button', { name: '详细编辑', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '编辑专注记录' });
    await editor.getByRole('spinbutton', { name: '时长（分钟）' }).fill('40');
    await editor.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect.poll(async () => (await invoke('get_focus_records')).find(x => x.title === 'RC synthetic manual')?.durationMs).toBe(40 * 60_000);
    checks.push('UI manual record and duration edit -> real Rust');

    await nav('设置').click();
    await expect(page.getByRole('textbox', { name: '外部备份文件路径' })).toHaveAttribute('readonly', '');
    // These are real native IPC checks. Never fill the readonly path or mock the OS picker.
    // IPC bypasses exportPortableBackup's overwrite confirm. Its accept/cancel UI is MANUAL;
    // a future UI export case must handle the real confirm explicitly after OS path selection.
    const backupPath = resolve(isolated, 'rc-synthetic-backup.json');
    await invoke('export_app_backup_to_path', { path: backupPath });
    const baseline = JSON.parse(await readFile(backupPath, 'utf8'));
    const baselineTimer = await invoke('get_timer_snapshot');
    expect(baseline.state.todoItems[0].title).toBe(title);
    const baselineStateBytes = await readFile(statePath, 'utf8');
    const preview = await invoke('preview_app_backup_path', { path: backupPath });
    expect(preview.todoCount).toBe(1);
    expect(preview.focusRecordCount).toBe(3);
    expect(await readFile(statePath, 'utf8')).toBe(baselineStateBytes);
    const seeded = structuredClone(baseline);
    seeded.state.todoItems[0].title = 'RC synthetic imported replacement';
    const seededRecord = seeded.state.focusRecords.find(x => x.title === 'RC synthetic manual');
    seededRecord.durationMs = 17 * 60_000;
    seededRecord.durationLabel = '00:17:00';
    seeded.state.timerPreferences.alertSoundKey = 'bright_bell';
    const importPath = resolve(isolated, 'rc-synthetic-import.json');
    await writeFile(importPath, JSON.stringify(seeded));
    const importOptions = { restoreTodos: true, restoreRecords: true, restoreAppPreferences: true };
    const importResult = await invoke('import_app_backup_path', { path: importPath, ...importOptions });
    expect(importResult.migratedFromFormatVersion).toBeNull();
    expect((await invoke('get_todo_items'))[0].title).toBe(seeded.state.todoItems[0].title);
    expect((await invoke('get_focus_records')).find(x => x.title === 'RC synthetic manual').durationMs).toBe(17 * 60_000);
    expect((await invoke('get_timer_preferences')).alertSoundKey).toBe('bright_bell');
    expect((await state()).todoItems[0].title).toBe(seeded.state.todoItems[0].title);
    // Resolve only a single returned filename inside this run's canonical backup directory.
    expect(importResult.rollbackFileName).toMatch(/^focused-moment-backup-v3-rollback-before-import-[\w.-]+\.json$/);
    const rollbackPath = resolve(canonical, 'Focused Moment Backups', importResult.rollbackFileName);
    inside(canonical, await realpath(rollbackPath));
    const rollback = JSON.parse(await readFile(rollbackPath, 'utf8'));
    expect(rollback.state).toEqual(baseline.state);
    expect(rollback.runtime).toEqual(baseline.runtime);
    await invoke('import_app_backup_path', { path: rollbackPath, ...importOptions });
    expect(await state()).toEqual(baseline.state);
    expect(await invoke('get_todo_items')).toEqual(baseline.state.todoItems);
    expect(await invoke('get_focus_records')).toEqual(baseline.state.focusRecords);
    expect(await invoke('get_timer_preferences')).toEqual(baseline.state.timerPreferences);
    expect(JSON.parse(await readFile(resolve(canonical, 'focused-moment-runtime.json'), 'utf8'))).toEqual(baseline.runtime);
    expect((await invoke('get_timer_snapshot')).isRunning).toBe(baselineTimer.isRunning);
    expect((await invoke('get_timer_snapshot')).linkedTodoId).toBe(baselineTimer.linkedTodoId);
    checks.push('IPC: export/preview byte-stable; changed synthetic import; generated rollback contents; actual rollback re-import restores Rust and disk');

    // Records-only must not import the seed's changed todo or sound preferences.
    await invoke('import_app_backup_path', { path: importPath, restoreTodos: false, restoreRecords: true, restoreAppPreferences: false });
    expect(await invoke('get_todo_items')).toEqual(baseline.state.todoItems);
    expect(await invoke('get_timer_preferences')).toEqual(baseline.state.timerPreferences);
    expect(await invoke('get_app_preferences')).toEqual(baseline.state.appPreferences);
    expect(await invoke('get_focus_plan')).toEqual(baseline.state.focusPlan);
    expect(JSON.parse(await readFile(resolve(canonical, 'focused-moment-runtime.json'), 'utf8'))).toEqual(baseline.runtime);
    expect((await invoke('get_focus_records')).find(x => x.title === 'RC synthetic manual').durationMs).toBe(17 * 60_000);
    await invoke('import_app_backup_path', { path: rollbackPath, ...importOptions });
    expect(await state()).toEqual(baseline.state);
    const invalidPath = resolve(isolated, 'rc-synthetic-invalid.json');
    await writeFile(invalidPath, '{invalid JSON');
    const beforeRejectedImport = await readFile(statePath, 'utf8');
    await expect(invoke('import_app_backup_path', { path: invalidPath, ...importOptions })).rejects.toBeTruthy();
    expect(await readFile(statePath, 'utf8')).toBe(beforeRejectedImport);
    expect(await invoke('get_todo_items')).toEqual(baseline.state.todoItems);
    expect(await invoke('get_focus_records')).toEqual(baseline.state.focusRecords);
    checks.push('IPC: records-only scope preserves todo/sound; malformed import rejects without state mutation (not simulated IO failure)');
    for (const sourceVersion of [1, 2]) {
      const legacy = structuredClone(baseline);
      legacy.formatVersion = sourceVersion;
      legacy.schemaVersion = sourceVersion;
      legacy.state.schemaVersion = sourceVersion;
      legacy.runtime.schemaVersion = sourceVersion;
      delete legacy.state.appPreferences;
      delete legacy.state.focusPlan;
      const legacyPath = resolve(isolated, `rc-synthetic-backup-v${sourceVersion}.json`);
      await writeFile(legacyPath, JSON.stringify(legacy));
      const legacyBytes = await readFile(legacyPath, 'utf8');
      const beforeLegacyPreview = await readFile(statePath, 'utf8');
      const legacyPreview = await invoke('preview_app_backup_path', { path: legacyPath });
      expect(legacyPreview.formatVersion).toBe(sourceVersion);
      expect(legacyPreview.schemaVersion).toBe(sourceVersion);
      expect(legacyPreview.migrationNeeded).toBe(true);
      expect(await readFile(statePath, 'utf8')).toBe(beforeLegacyPreview);
      const migrated = await invoke('import_app_backup_path', {
        path: legacyPath, restoreTodos: true, restoreRecords: true, restoreAppPreferences: false,
      });
      expect(migrated.migratedFromFormatVersion).toBe(sourceVersion);
      expect((await state()).schemaVersion).toBe(3);
      expect(await invoke('get_focus_records')).toHaveLength(3);
      expect(await readFile(legacyPath, 'utf8')).toBe(legacyBytes);
      await invoke('import_app_backup_path', { path: rollbackPath, ...importOptions });
      expect(await state()).toEqual(baseline.state);
    }
    checks.push('IPC: v1/v2 preview retains source versions; import reports original migratedFromFormatVersion; v3 import reports null; source fixtures unchanged');
    await page.reload();
    await expect(nav('今日')).toBeVisible();
    expect((await invoke('get_todo_items'))[0].title).toBe(title);
    expect(await invoke('get_focus_records')).toHaveLength(3);
    expect(errors).toEqual([]);
    checks.push('WebView reload retains Rust state (not a process restart test)');
    // Final idle case; reset is real IPC setup and does not remove synthetic todos/records.
    const idle = await invoke('reset_timer');
    expect(idle.isRunning).toBe(false);
    expect(idle.elapsedMs).toBe(0);
    expect(idle.hasUnsubmittedProgress).toBe(false);
    await page.reload();
    await page.getByRole('button', { name: '迷你工作台', exact: true }).click();
    let idleMini;
    await expect.poll(async () => {
      for (const candidate of browser.contexts().flatMap(context => context.pages())) {
        if (await candidate.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null) === 'todo-float') {
          idleMini = candidate;
          return true;
        }
      }
      return false;
    }).toBe(true);
    const idleTabs = idleMini.getByRole('navigation', { name: '悬浮内容' });
    await expect(idleTabs.getByRole('button')).toHaveCount(1);
    await expect(idleTabs.getByRole('button', { name: /^待办/ })).toHaveAttribute('aria-selected', 'true');
    await expect(idleTabs.getByRole('button', { name: /当前计时/ })).toHaveCount(0);
    await expect(idleMini.getByRole('tabpanel', { name: '待办列表' })).toContainText(title);
    await expect(idleMini.getByRole('button', { name: /^(暂停|继续|完成并记录)$/ })).toHaveCount(0);
    const idleWindows = await inspectWindows();
    expect(idleWindows.windows.some(x => x.title === 'Focused Moment 迷你工作台' && x.visible)).toBe(true);
    hwndEvidence.push({ stage: 'idle-mini-todos-only', ...idleWindows });
    await idleMini.screenshot({ path: test.info().outputPath('native-idle-mini.png') });
    await idleMini.getByRole('button', { name: '返回', exact: true }).click();
    expect(await invoke('get_focus_records')).toHaveLength(3);
    checks.push('UI+HWND: idle mini opens with only selected todos tab and synthetic todo; no timer tab/controls (tray menu enablement is static review only)');
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('native-final.png') });
    passed = true;
  } finally {
    await evidence('native-interaction.json', {
      evidenceClass: 'real-WebView2-CDP + native-IPC + Win32-HWND', fixture, checks, errors, hwndEvidence,
      status: passed ? 'PASS' : 'INCOMPLETE_OR_FAIL',
      manual: ['tray', 'OS picker open/save/cancel and readonly path population', 'export overwrite confirmation accept/cancel', 'import confirmation UI/cancel', 'audible sound', 'notification visibility', 'click-through/unlock', 'graceful quit', 'IO-failure rollback'],
    });
    await browser.close(); // Disconnect CDP; PowerShell owns process cleanup.
  }
});
