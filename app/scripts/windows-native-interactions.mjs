import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const execFileAsync = promisify(execFile);
export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.dirname(appRoot);
const powershellExecutable = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
export const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
export const writeJson = (name, value) => fs.writeFile(name, `${JSON.stringify(value, null, 2)}\n`);

export async function powershell(code) {
  const encoded = Buffer.from(code, "utf16le").toString("base64");
  const { stdout } = await execFileAsync(powershellExecutable, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

export async function nativeUi(instance, action = "Inspect", name, value) {
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(appRoot, "scripts", "windows-native-interactions.ps1"), "-ProcessId", String(instance.child.pid), "-Action", action];
  if (name) args.push(action === "Screenshot" ? "-ScreenshotPath" : "-Name", name);
  if (value) args.push("-Value", value);
  if (instance.windowHandle) args.push("-WindowHandle", String(instance.windowHandle));
  const { stdout } = await execFileAsync(powershellExecutable, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

export async function createRun(kind, executable = path.join(repositoryRoot, "Focused Moment.exe")) {
  assert.equal(process.platform, "win32", "This runner requires Windows.");
  const runId = `${kind}-${new Date().toISOString().replace(/[-:.]/g, "")}-${randomUUID().slice(0, 8)}`;
  const output = path.join(repositoryRoot, "artifacts", "qa", kind === "release-performance" ? "performance" : "native", runId);
  await fs.mkdir(output, { recursive: true });
  const source = path.resolve(executable);
  const bytes = await fs.readFile(source);
  const hash = sha256(bytes);
  let provenance;
  for (const entry of await fs.readdir(path.join(repositoryRoot, "artifacts", "builds", "local"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifestPath = path.join(repositoryRoot, "artifacts", "builds", "local", entry.name, "manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (manifest.profile === "release" && manifest.rootExecutable.sha256.toUpperCase() === hash) provenance = { manifestPath, buildId: manifest.buildId, version: manifest.version, source: manifest.source, hash };
    } catch { /* A pending delivery may not have a manifest yet. */ }
  }
  assert.ok(provenance, "The executable must match an existing local Release provenance manifest.");
  const copiedExecutable = path.join(output, "Focused Moment.exe");
  await fs.writeFile(copiedExecutable, bytes, { flag: "wx" });
  assert.equal(sha256(await fs.readFile(copiedExecutable)), hash);
  const run = { runId, output, source, copiedExecutable, provenance, startedAt: new Date().toISOString(), machine: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemory: os.totalmem() } };
  await writeJson(path.join(output, "run.json"), run);
  console.log(JSON.stringify({ runId, output, version: provenance.version, hash }));
  return run;
}

export function silentWav(byteLength = 8044) {
  const result = Buffer.alloc(Math.max(44, byteLength));
  result.write("RIFF", 0); result.writeUInt32LE(result.length - 8, 4); result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(8000, 24); result.writeUInt32LE(16000, 28); result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34);
  result.write("data", 36); result.writeUInt32LE(result.length - 44, 40);
  return `data:audio/wav;base64,${result.toString("base64")}`;
}

function testToneWav(seconds = 3) {
  const result = Buffer.from(silentWav(44 + seconds * 16000).split(",")[1], "base64");
  for (let sample = 0; sample < seconds * 8000; sample += 1) result.writeInt16LE(Math.round(1300 * Math.sin(2 * Math.PI * 440 * sample / 8000)), 44 + sample * 2);
  return `data:audio/wav;base64,${result.toString("base64")}`;
}

async function meterAudio(instance, label, seconds, action) {
  const output = path.join(instance.fixture, `audio-meter-${label}.json`);
  const child = spawn(powershellExecutable, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(appRoot, "scripts", "windows-native-interactions.audio.ps1"), "-ProcessId", String(instance.child.pid), "-OutputPath", output, "-Seconds", String(seconds)], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let errors = "";
  child.stderr.on("data", (value) => { errors += value; });
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Audio meter exited ${code}: ${errors}`)));
  });
  completion.catch(() => {});
  try {
    await Promise.race([new Promise((resolve) => child.stdout.on("data", (data) => { if (data.toString().includes("READY")) resolve(); })), completion.then(() => { throw new Error("Audio meter exited before readiness."); }), wait(15000).then(() => { throw new Error("Audio meter readiness timed out."); })]);
    await action();
    await completion;
    const result = JSON.parse(await fs.readFile(output, "utf8"));
    const audible = result.samples.filter((sample) => sample.peak > 0.0001);
    return { evidenceFile: output, matchingProcessCount: new Set(result.samples.map((sample) => sample.processId)).size, peak: Math.max(0, ...result.samples.map((sample) => sample.peak)), nonzeroSamples: audible.length, nonzeroSpanSeconds: audible.length ? audible.at(-1).seconds - audible[0].seconds : 0, limitation: result.limitation };
  } finally { if (child.exitCode === null) child.kill(); }
}

export function fixtureState(recordCount = 0, audioBytes = 0) {
  const focusRecords = Array.from({ length: recordCount }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index % 180));
    const completedDate = date.toISOString().slice(0, 10);
    return { id: index + 1, title: `Synthetic focus ${index + 1}`, durationMs: 1500000, durationLabel: "25:00", modeKey: "stopwatch", modeLabel: "正向计时", phaseLabel: "正向计时", linkedTodoId: null, linkedTodoTitle: null, completedAt: `${completedDate}T10:00:00+08:00`, completedDate, completedTime: "10:00", source: "timer", timeBasis: "completion_day", editedAt: null };
  });
  return {
    schemaVersion: 3, focusRecords, nextRecordId: recordCount + 1, nextTodoId: 2,
    todoItems: [{ id: 1, title: "Native QA synthetic task", isCompleted: false, scheduledDate: "", scheduledTime: "", importanceKey: "normal", continuationNote: "", continuationUpdatedAt: null }],
    timerPreferences: { pomodoroFocusMinutes: 25, pomodoroBreakMinutes: 5, stopwatchReminderMinutes: 25, toastReminderEnabled: true, windowAttentionReminderEnabled: false, soundReminderEnabled: Boolean(audioBytes), alertSoundKey: audioBytes ? "custom" : "soft_chime" },
    appPreferences: { schemaVersion: 3, themeId: "night-valley", visualIntensity: 72, motionIntensity: 44, density: "roomy", floatingOpacity: 100, autoMiniOnStart: false, customAlertSoundName: audioBytes ? "synthetic-silence.wav" : "", customAlertSoundData: audioBytes ? silentWav(audioBytes) : null },
    focusPlan: { currentTodoId: 1, todayPickIds: [1] },
  };
}

export function fixtureRuntime(patch = {}) {
  return { schemaVersion: 3, modeKey: "stopwatch", stopwatchElapsedMs: 0, countdownElapsedMs: 0, countdownDurationMs: 60000, pomodoroElapsedMs: 0, pomodoroPhaseKey: "focus", pendingPomodoroRecordMs: null, isRunning: false, anchorWallClockMs: null, currentTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, completedFocusCount: 0, completedBreakCount: 0, alertSequence: 0, activeAlertKey: null, stopwatchTargetAlerted: false, stopwatchStageIndex: 0, ...patch };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function launchFixture(run, name, state, runtime) {
  assert.match(name, /^[a-z0-9-]+$/);
  const fixture = path.join(run.output, name);
  const local = path.join(fixture, "LocalAppData");
  const storage = path.join(local, "FocusedMoment");
  const webview = path.join(local, "WebView2");
  const workdir = path.join(fixture, "workdir");
  for (const directory of [storage, workdir, webview, "AppData", "Temp", "UserProfile"].map((directory) => path.isAbsolute(directory) ? directory : path.join(fixture, directory))) await fs.mkdir(directory, { recursive: true });
  if (state) await writeJson(path.join(storage, "focused-moment-state.json"), state);
  if (runtime) await writeJson(path.join(storage, "focused-moment-runtime.json"), runtime);
  const port = await freePort();
  const began = performance.now();
  const child = spawn(run.copiedExecutable, [], { cwd: workdir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LOCALAPPDATA: local, APPDATA: path.join(fixture, "AppData"), TEMP: path.join(fixture, "Temp"), TMP: path.join(fixture, "Temp"), USERPROFILE: path.join(fixture, "UserProfile"), HOME: path.join(fixture, "UserProfile"), WEBVIEW2_USER_DATA_FOLDER: webview, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --force-renderer-accessibility=complete`, FOCUSED_MOMENT_NATIVE_SMOKE: "1" } });
  const logs = [];
  child.stdout.on("data", (value) => logs.push(value.toString()));
  child.stderr.on("data", (value) => logs.push(value.toString()));
  let browser;
  let lastCdpError;
  const stop = async () => {
    await browser?.close().catch(() => {});
    if (child.exitCode === null) await execFileAsync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    await fs.writeFile(path.join(fixture, "native.log"), logs.join(""));
  };
  try {
    const deadline = performance.now() + 45000;
    let diagnosticCaptured = false;
    while (performance.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Isolated process exited: ${child.exitCode}. An existing native QA instance may own the test-only mutex.`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); break; }
        lastCdpError = `HTTP ${response.status}`;
      } catch (error) { lastCdpError = `${error.message}: ${error.cause?.message || ""}`; }
      if (!diagnosticCaptured && performance.now() - began > 8000) {
        diagnosticCaptured = true;
        const uia = await nativeUi({ child }).catch((error) => ({ error: error.message }));
        await writeJson(path.join(fixture, "native-uia.json"), uia);
        await nativeUi({ child }, "Screenshot", path.join(fixture, "native-window.png")).catch(() => {});
        if (uia.visible && uia.elements?.some((item) => item.controlType === "ControlType.Button" && item.name === "计时")) {
          const readyMs = performance.now() - began;
          await writeJson(path.join(fixture, "launch.json"), { pid: child.pid, windowHandle: uia.windowHandle, readyMs, controlMethod: "UIAutomation", cdpUnavailable: lastCdpError, isolatedEnvironment: { local, webview, workdir }, executableHash: run.provenance.hash });
          return { run, name, fixture, storage, webview, child, readyMs, stop, windowHandle: uia.windowHandle, controlMethod: "UIAutomation" };
        }
      }
      await wait(200);
    }
    assert.ok(browser, `Isolated WebView2 CDP endpoint did not become available at ${port}: ${lastCdpError}`);
    let page;
    while (performance.now() < deadline) {
      page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => /tauri|localhost/.test(candidate.url()));
      if (page) break;
      await wait(100);
    }
    assert.ok(page, "Native main WebView was not found.");
    await page.locator(".minimal-content:not([inert])").waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: "计时", exact: true }).waitFor({ state: "visible" });
    const readyMs = performance.now() - began;
    await fs.writeFile(path.join(fixture, "initial-aria.yml"), await page.locator("body").ariaSnapshot());
    const result = { run, name, fixture, storage, webview, child, browser, page, readyMs, stop, controlMethod: "CDP" };
    await writeJson(path.join(fixture, "launch.json"), { pid: child.pid, port, readyMs, pageUrl: page.url(), isolatedEnvironment: { local, webview, workdir }, executableHash: run.provenance.hash });
    return result;
  } catch (error) { await stop(); throw error; }
}

export const invoke = (page, command, args = {}) => page.evaluate(([name, values]) => window.__TAURI_INTERNALS__.invoke(name, values), [command, args]);

export async function instrument(page) {
  await page.evaluate(() => {
    if (window.__nativeQa) return;
    const data = window.__nativeQa = { calls: {}, failures: [], audio: [], synthContexts: 0, startedAt: performance.now() };
    const original = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async function(command, args, options) {
      data.calls[command] = (data.calls[command] || 0) + 1;
      try { return await original.call(this, command, args, options); }
      catch (error) { data.failures.push({ command, error: String(error) }); throw error; }
    };
    const AudioOriginal = window.Audio;
    window.Audio = function(source) {
      const audio = new AudioOriginal(source);
      const evidence = { sourcePrefix: String(source).slice(0, 32), sourceLength: String(source).length, playRequested: false, outcome: "not-requested" };
      data.audio.push(evidence);
      const play = audio.play.bind(audio);
      audio.play = async () => {
        evidence.playRequested = true;
        try { const value = await play(); evidence.outcome = "resolved"; return value; }
        catch (error) { evidence.outcome = String(error); throw error; }
      };
      return audio;
    };
    window.Audio.prototype = AudioOriginal.prototype;
    const Context = window.AudioContext;
    if (Context) window.AudioContext = new Proxy(Context, { construct(target, args) { data.synthContexts += 1; return Reflect.construct(target, args); } });
  });
}

async function interactions(run) {
  const report = { evidenceClass: "Windows-native-WebView2-CDP", assertions: [], limitations: ["Audio evidence is API invocation/play-promise evidence, not human listening.", "Tray menu clicks, OS taskbar flashing, and lock-screen notification delivery are not automated by this runner."] };
  const check = (name, value) => { assert.ok(value, name); report.assertions.push(name); };
  let instance;
  try {
    instance = await launchFixture(run, "workflow", fixtureState(), fixtureRuntime());
    if (instance.controlMethod === "UIAutomation") {
      await nativeInteractions(run, instance, report);
      instance = undefined;
      report.status = "completed-with-coverage-limitations";
      return;
    }
    const { page } = instance;
    await instrument(page);
    await page.getByRole("button", { name: "计时", exact: true }).click();
    await page.locator('input[name="sessionTitle"]').fill("Native QA persisted focus");
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await page.getByRole("button", { name: "暂停", exact: true }).waitFor();
    await wait(1400);
    check("Native start button starts Rust timer", (await invoke(page, "get_timer_snapshot")).isRunning);
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    check("Native pause button stops Rust timer", !(await invoke(page, "get_timer_snapshot")).isRunning);
    await page.getByRole("button", { name: "完成并记录", exact: true }).click();
    await wait(500);
    const records = await invoke(page, "get_focus_records");
    check("Native completion creates exactly one record", records.length === 1 && records[0].title === "Native QA persisted focus");
    await page.screenshot({ path: path.join(instance.fixture, "saved.png") });
    report.workflow = await page.evaluate(() => window.__nativeQa);
    await instance.stop(); instance = undefined;
    instance = await launchFixture(run, "workflow");
    check("Saved record survives native process restart", (await invoke(instance.page, "get_focus_records")).length === 1);
    await instance.stop(); instance = undefined;

    instance = await launchFixture(run, "custom-audio", fixtureState(0, 8044), fixtureRuntime({ modeKey: "countdown", countdownElapsedMs: 55000, currentTaskTitle: "Synthetic audio reminder" }));
    await instrument(instance.page);
    await instance.page.getByRole("button", { name: "计时", exact: true }).click();
    await instance.page.getByRole("button", { name: "继续", exact: true }).click();
    await instance.page.locator(".timer-alert").waitFor({ state: "visible", timeout: 15000 });
    await wait(500);
    report.customAudio = await instance.page.evaluate(() => window.__nativeQa);
    report.customAudio.result = report.customAudio.audio.some((entry) => entry.playRequested) ? "custom-audio-requested" : "custom-audio-not-requested";
    await instance.page.screenshot({ path: path.join(instance.fixture, "alert.png") });
    await instance.stop(); instance = undefined;

    const mixed = fixtureState(1);
    mixed.focusRecords[0].title = "Synthetic interrupted commit";
    instance = await launchFixture(run, "mixed-generation", mixed, fixtureRuntime({ stopwatchElapsedMs: 1500000, currentTaskTitle: "Synthetic interrupted commit" }));
    const recovered = await invoke(instance.page, "get_timer_snapshot");
    const recoveredRecords = await invoke(instance.page, "get_focus_records");
    report.crashConsistency = { method: "Synthetic new-state/old-runtime pair at the documented two-file commit boundary; no actual timed process-kill injection.", recordCount: recoveredRecords.length, hasUnsubmittedProgress: recovered.hasUnsubmittedProgress, timerTitle: recovered.activeTaskTitle, result: recoveredRecords.length === 1 && recovered.hasUnsubmittedProgress ? "mixed-generation-accepted-risk-confirmed" : "requires-inspection" };
    await instance.page.screenshot({ path: path.join(instance.fixture, "mixed-generation.png") });
    report.status = "completed";
  } catch (error) { report.status = "failed"; report.error = error.stack; throw error; }
  finally { await instance?.stop(); await writeJson(path.join(run.output, "report.json"), report); }
  console.log(JSON.stringify(report));
}

async function nativeInteractions(run, initialInstance, report) {
  report.evidenceClass = "Windows-native-UIAutomation";
  report.limitations.push("This Release/WebView2 combination did not open the requested CDP port. IPC counts and audio invocation evidence are unavailable. UIAutomation uses forced renderer accessibility for both baseline and candidate.");
  const hasName = (item, text) => typeof item?.name === "string" && item.name.includes(text);
  const disk = async (instance, kind = "state") => JSON.parse(await fs.readFile(path.join(instance.storage, `focused-moment-${kind}.json`), "utf8"));
  const click = async (instance, name) => { await nativeUi(instance, "Click", name); await wait(350); };
  let instance = initialInstance;
  try {
    await click(instance, "计时");
    await writeJson(path.join(instance.fixture, "focus-uia.json"), await nativeUi(instance));
    await nativeUi(instance, "SetText", "要专注什么", "Native QA persisted focus");
    await click(instance, "开始");
    await wait(1600);
    assert.equal((await disk(instance, "runtime")).isRunning, true);
    report.assertions.push("Native start button persists running Rust timer");
    await click(instance, "暂停");
    assert.equal((await disk(instance, "runtime")).isRunning, false);
    report.assertions.push("Native pause button persists paused Rust timer");
    await click(instance, "迷你工作台");
    await wait(1500);
    const windows = await nativeUi(instance, "Windows");
    await writeJson(path.join(instance.fixture, "owned-windows.json"), windows);
    const floating = windows.find((window) => window.visible && hasName(window, "迷你工作台"));
    assert.ok(floating, "Native floating workspace must be visible.");
    const floatingInstance = { ...instance, windowHandle: floating.handle };
    const floatingUia = await nativeUi(floatingInstance);
    await writeJson(path.join(instance.fixture, "floating-uia.json"), floatingUia);
    await nativeUi(floatingInstance, "Screenshot", path.join(instance.fixture, "floating.png"));
    assert.ok(floatingUia.elements.some((item) => hasName(item, "Native QA persisted focus")));
    report.assertions.push("Native floating workspace opens and displays the current task");
    const returnButton = floatingUia.elements.find((item) => item.controlType === "ControlType.Button" && hasName(item, "返回"));
    assert.ok(returnButton, "Floating workspace must offer return-to-main.");
    await click(floatingInstance, returnButton.name);
    assert.equal((await nativeUi(instance)).visible, true);
    report.assertions.push("Native floating return button restores the main window");
    await click(instance, "完成并记录");
    const saved = await disk(instance);
    assert.equal(saved.focusRecords.length, 1);
    assert.ok(saved.focusRecords[0].durationMs > 0);
    report.assertions.push("Native completion persists exactly one nonzero focus record");
    await nativeUi(instance, "Screenshot", path.join(instance.fixture, "saved.png"));
    await instance.stop(); instance = undefined;
    instance = await launchFixture(run, "workflow");
    await click(instance, "记录");
    const afterRestart = await nativeUi(instance);
    await writeJson(path.join(instance.fixture, "restart-records-uia.json"), afterRestart);
    assert.equal((await disk(instance)).focusRecords.length, 1);
    assert.ok(afterRestart.elements.some((item) => hasName(item, saved.focusRecords[0].title)));
    report.assertions.push("Saved record is read and shown after native process restart");
    await instance.stop(); instance = undefined;
    const audioState = fixtureState(0, 8044);
    const meterEnabled = process.argv.includes("--audio-meter");
    if (meterEnabled) audioState.appPreferences.customAlertSoundData = testToneWav();
    instance = await launchFixture(run, "custom-audio", audioState, fixtureRuntime({ modeKey: "countdown", countdownElapsedMs: 55000, currentTaskTitle: "Synthetic audio reminder" }));
    let previewMeter;
    if (meterEnabled) {
      await click(instance, "设置");
      previewMeter = await meterAudio(instance, "preview", 8, () => click(instance, "试听当前"));
    }
    await click(instance, "计时");
    const reminderMeter = meterEnabled ? await meterAudio(instance, "reminder", 14, () => click(instance, "继续")) : undefined;
    if (!meterEnabled) { await click(instance, "继续"); await wait(6000); }
    const alertUia = await nativeUi(instance);
    await writeJson(path.join(instance.fixture, "alert-uia.json"), alertUia);
    report.customAudio = { countdownAlertVisible: alertUia.elements.some((item) => hasName(item, "倒计时已结束")), invocation: "unavailable-without-CDP", hearing: "not-tested", previewMeter, reminderMeter };
    await nativeUi(instance, "Screenshot", path.join(instance.fixture, "alert.png"));
    await instance.stop(); instance = undefined;
    const mixed = fixtureState(1);
    mixed.focusRecords[0].title = "Synthetic interrupted commit";
    instance = await launchFixture(run, "mixed-generation", mixed, fixtureRuntime({ stopwatchElapsedMs: 1500000, currentTaskTitle: "Synthetic interrupted commit" }));
    await click(instance, "计时");
    const mixedUia = await nativeUi(instance);
    await writeJson(path.join(instance.fixture, "mixed-generation-uia.json"), mixedUia);
    const canContinue = mixedUia.elements.some((item) => item.controlType === "ControlType.Button" && item.name === "继续");
    report.crashConsistency = { method: "Synthetic new-state/old-runtime pair at the documented two-file commit boundary; no timed process-kill injection.", recordCount: (await disk(instance)).focusRecords.length, canContinue, result: canContinue ? "mixed-generation-accepted-risk-confirmed" : "requires-inspection" };
    await click(instance, "完成并记录");
    report.crashConsistency.recordCountAfterRepeatSave = (await disk(instance)).focusRecords.length;
    await nativeUi(instance, "Screenshot", path.join(instance.fixture, "mixed-generation.png"));
  } finally { await instance?.stop(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = await createRun("windows-interactions", process.argv.slice(2).find((value) => !value.startsWith("--")));
  await interactions(run);
}
