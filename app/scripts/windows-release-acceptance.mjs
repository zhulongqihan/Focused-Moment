import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = path.dirname(appRoot);
const pwsh = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
export const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');

export async function uia(instance, action = 'Inspect', options = {}) {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(appRoot, 'scripts/windows-release-uia.ps1'), '-ProcessId', String(instance.child.pid), '-Action', action];
  if (instance.windowHandle && !['Windows','OpenTray','MenuInspect','MenuClick'].includes(action)) args.push('-WindowHandle', String(instance.windowHandle));
  for (const [name, value] of Object.entries(options)) args.push(`-${name}`, String(value));
  const trace=path.join(instance.fixture,'uia-actions.jsonl');const stamp={action,windowHandle:instance.windowHandle??null,...options};await fs.appendFile(trace,JSON.stringify({at:new Date().toISOString(),phase:'start',...stamp})+'\n');
  try{const result = await exec(pwsh, args, { windowsHide: true, timeout: 25000, maxBuffer: 8 * 1024 * 1024 });const parsed=JSON.parse(result.stdout.trim());await fs.appendFile(trace,JSON.stringify({at:new Date().toISOString(),phase:'complete',...stamp,...(parsed.method?{method:parsed.method}:{})})+'\n');return parsed;}catch(error){await fs.appendFile(trace,JSON.stringify({at:new Date().toISOString(),phase:'failed',...stamp,error:error.message})+'\n');throw error;}
}

export function fixtureState() {
  return { schemaVersion: 3, nextRecordId: 1, nextTodoId: 2, focusRecords: [],
    todoItems: [{ id: 1, title: 'Release QA synthetic task', isCompleted: false, scheduledDate: '', scheduledTime: '', importanceKey: 'normal', continuationNote: '', continuationUpdatedAt: null }],
    timerPreferences: { pomodoroFocusMinutes: 25, pomodoroBreakMinutes: 5, stopwatchReminderMinutes: 25, toastReminderEnabled: true, windowAttentionReminderEnabled: false, soundReminderEnabled: false, alertSoundKey: 'soft_chime' },
    appPreferences: { schemaVersion: 3, themeId: 'night-valley', visualIntensity: 0, motionIntensity: 0, density: 'roomy', floatingOpacity: 100, autoMiniOnStart: false, customAlertSoundName: '', customAlertSoundData: null },
    focusPlan: { currentTodoId: 1, todayPickIds: [1] } };
}
export function fixtureRuntime(patch = {}) {
 return { schemaVersion: 3, modeKey: 'stopwatch', stopwatchElapsedMs: 0, countdownElapsedMs: 0, countdownDurationMs: 60000, pomodoroElapsedMs: 0, pomodoroPhaseKey: 'focus', pendingPomodoroRecordMs: null, isRunning: false, anchorWallClockMs: null, currentTaskTitle: 'Release QA synthetic task', linkedTodoId: 1, completeLinkedTodoOnFinish: false, completedFocusCount: 0, completedBreakCount: 0, alertSequence: 0, activeAlertKey: null, stopwatchTargetAlerted: false, stopwatchStageIndex: 0, ...patch };
}

export async function createRun(scenario, executable = path.join(repositoryRoot, 'Focused Moment.exe')) {
 assert.equal(process.platform, 'win32');
 assert.ok(['probe','tray','hidden-audio','minimized-attention','floating','backup','upgrade'].includes(scenario), 'Unknown native acceptance scenario.');
 const bytes = await fs.readFile(executable);
 const sha256 = hash(bytes);
 const buildRoot = path.join(repositoryRoot, 'artifacts/builds/local');
 let provenance;
 for (const dir of await fs.readdir(buildRoot)) { try {const manifest = JSON.parse(await fs.readFile(path.join(buildRoot, dir, 'manifest.json'), 'utf8'));if(manifest.profile === 'release' && manifest.rootExecutable?.sha256.toUpperCase() === sha256) provenance = {buildId: manifest.buildId, version: manifest.version, sourceHead: manifest.source.head};} catch {} }
 assert.ok(provenance, 'Candidate does not match existing local Release provenance.');
 const runId = `release-acceptance-${scenario}-${new Date().toISOString().replace(/[-:.]/g,'')}-${randomUUID().slice(0,8)}`;
 const output = path.join(repositoryRoot, 'artifacts/qa/native', runId);
 await fs.mkdir(output, {recursive:true});
 const copiedExecutable = path.join(output, 'Focused Moment.exe');
 await fs.writeFile(copiedExecutable, bytes, {flag:'wx'});
 assert.equal(hash(await fs.readFile(copiedExecutable)), sha256);
 const run = {runId, output, scenario, sourceExecutable: executable, copiedExecutable, sha256, provenance};
 await writeJson(path.join(output, 'run.json'), run);
 console.log(JSON.stringify(run));
 return run;
}

export async function launch(run, name, state, runtime, executable = run.copiedExecutable) {
 assert.match(name, /^[a-z0-9-]+$/);
 const fixture = path.join(run.output, name);
 const storage = path.join(fixture, 'LocalAppData/FocusedMoment');
 for (const dir of [storage, ...['AppData','Temp','UserProfile','WebView2','workdir'].map(v=>path.join(fixture,v))]) await fs.mkdir(dir,{recursive:true});
 if(state) await writeJson(path.join(storage,'focused-moment-state.json'), state);
 if(runtime) await writeJson(path.join(storage,'focused-moment-runtime.json'), runtime);
 const child = spawn(executable, [], {cwd:path.join(fixture,'workdir'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,LOCALAPPDATA:path.join(fixture,'LocalAppData'),APPDATA:path.join(fixture,'AppData'),TEMP:path.join(fixture,'Temp'),TMP:path.join(fixture,'Temp'),USERPROFILE:path.join(fixture,'UserProfile'),HOME:path.join(fixture,'UserProfile'),WEBVIEW2_USER_DATA_FOLDER:path.join(fixture,'WebView2'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--force-renderer-accessibility=complete',FOCUSED_MOMENT_NATIVE_SMOKE:'1'}});
 let log='';child.stdout.on('data',v=>{log+=v});child.stderr.on('data',v=>{log+=v});
 const instance={run,name,fixture,storage,child};
 instance.stop=async()=>{if(child.exitCode===null)await exec('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}).catch(()=>{});await fs.writeFile(path.join(fixture,'native.log'),log);};
 const started=performance.now();
 try {
  while(performance.now()-started<45000){
   if(child.exitCode!==null)throw new Error(`Isolated candidate exited with ${child.exitCode}`);
   const windows=await uia(instance,'Windows');
   const main=windows.find(v=>v.OwnerPid===child.pid && v.Visible && v.Width>1000 && v.Height>600);
   if(main){instance.windowHandle=main.Handle;const tree=await uia(instance);if(tree.elements.some(v=>v.controlType==='ControlType.Button'&&v.name==='计时')){await writeJson(path.join(fixture,'launch.json'),{pid:child.pid,windowHandle:main.Handle,windows,readyMs:performance.now()-started,exeSha256:hash(await fs.readFile(executable)),isolationRoot:fixture});await writeJson(path.join(fixture,'initial-uia.json'),tree);console.log(JSON.stringify({ready:true,pid:child.pid,handle:main.Handle,fixture}));return instance;}}
   await wait(250);
  }
  throw new Error('No owned visible main window with actionable UIA timer control within 45 seconds.');
 } catch(error){await instance.stop();throw error;}
}

export const readState = instance => fs.readFile(path.join(instance.storage,'focused-moment-state.json'),'utf8').then(JSON.parse);
export const readRuntime = instance => fs.readFile(path.join(instance.storage,'focused-moment-runtime.json'),'utf8').then(JSON.parse);
export async function click(instance,name){await uia(instance,'Click',{Name:name});await wait(300);}
export async function capture(instance,label){await writeJson(path.join(instance.fixture,`${label}-uia.json`),await uia(instance));await uia(instance,'Screenshot',{OutputPath:path.join(instance.fixture,`${label}.png`)});}
async function confirmNativeImport(instance,label,before,accept=true){
 const deadline=Date.now()+12000;let observation=0;
 while(Date.now()<deadline){
  const windows=await uia(instance,'Windows');await writeJson(path.join(instance.fixture,`${label}-windows-${observation++}.json`),{at:new Date().toISOString(),windows,state:await readState(instance)});
  for(const window of windows.filter(v=>v.Visible&&v.ClassName==='#32770')){
   const target={...instance,windowHandle:window.Handle};const tree=await uia(target);const button=tree.elements.find(v=>(v.controlType==='ControlType.Button'||(window.ClassName==='#32770'&&v.controlType==='ControlType.Pane'&&/^CommandButton_[12]$/.test(v.automationId)))&&(accept?['确定','OK','Ok','是','Yes']:['取消','Cancel','否','No']).includes(v.name));
   if(button){await capture(target,label);assert.deepEqual(await readState(instance),before,'Data must remain unchanged until the confirmation is accepted.');if(window.ClassName==='#32770'){await uia(target,'DialogClick',{Name:button.name});await wait(300);}else{await click(target,button.name);}return;}
  }
  await wait(150);
 }
 throw new Error('The isolated candidate did not expose a native backup replacement confirmation.');
}
async function findFloating(instance){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){for(const window of await uia(instance,'Windows')){if(!window.Visible||window.Handle===instance.windowHandle||window.Width<100||window.Height<100)continue;const candidate={...instance,windowHandle:window.Handle};const tree=await uia(candidate);if(tree.elements.some(v=>v.controlType==='ControlType.Button'&&v.name==='完成并记录'))return candidate;}await wait(200);}
 throw new Error('No owned floating window with a completion button became ready.');
}

function toneWav(seconds=3){
 const b=Buffer.alloc(44+seconds*16000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=0;i<seconds*8000;i++)b.writeInt16LE(Math.round(1300*Math.sin(2*Math.PI*440*i/8000)),44+i*2);return `data:audio/wav;base64,${b.toString('base64')}`;
}
async function measureAudio(instance,seconds,action){
 const output=path.join(instance.fixture,'audio-meter.json');
 const child=spawn(pwsh,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(appRoot,'scripts/windows-release-audio.ps1'),'-ProcessId',String(instance.child.pid),'-OutputPath',output,'-Seconds',String(seconds)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',v=>{errors+=v});
 const ready=new Promise(resolve=>child.stdout.on('data',v=>{if(String(v).includes('READY'))resolve()}));
 const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Meter exit ${code}: ${errors}`)))});completion.catch(()=>{});
 try{await Promise.race([ready,completion.then(()=>{throw new Error('Meter exited before READY')}),wait(15000).then(()=>{throw new Error('Meter READY timeout')})]);await action();await completion;return JSON.parse(await fs.readFile(output,'utf8'));}finally{if(child.exitCode===null)child.kill();}
}
async function measureAttention(instance,seconds,action){
 const output=path.join(instance.fixture,'window-attention.json');
 const child=spawn(pwsh,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(appRoot,'scripts/windows-release-uia.ps1'),'-ProcessId',String(instance.child.pid),'-WindowHandle',String(instance.windowHandle),'-Action','WatchAttention','-OutputPath',output,'-Seconds',String(seconds)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',v=>{errors+=v});const ready=new Promise(resolve=>child.stdout.on('data',v=>{if(String(v).includes('READY'))resolve()}));const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Attention observer exit ${code}: ${errors}`)))});completion.catch(()=>{});
 try{await Promise.race([ready,completion.then(()=>{throw new Error('Attention observer exited before READY')}),wait(15000).then(()=>{throw new Error('Attention observer READY timeout')})]);const result=await action(async()=>{await fs.writeFile(output+'.background','Move foreground to the separate QA helper.\n');const deadline=Date.now()+5000;while(Date.now()<deadline){const evidence=await fs.readFile(output+'.background-ready.json','utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(evidence){const state=JSON.parse(evidence.replace(/^\uFEFF/,''));assert.equal(state.HelperForeground,true,'The separate QA helper must own foreground.');assert.equal(state.CandidateForeground,false,'The candidate must be in background before testing TIMERNOFG.');return state;}await wait(100);}throw new Error('Background QA helper was not acknowledged.');});await completion;return {result,attention:JSON.parse((await fs.readFile(output,'utf8')).replace(/^\uFEFF/,''))};}finally{if(child.exitCode===null)child.kill();}
}

async function upgrade(run,report){
 const previous=path.join(run.output,'public-v2.11.10');await fs.mkdir(previous);
 const metadata=JSON.parse((await exec('gh',['release','view','v2.11.10','--repo','zhulongqihan/Focused-Moment','--json','assets'],{windowsHide:true})).stdout);
 const asset=metadata.assets.find(v=>v.name==='Focused.Moment.v2.11.10.exe');assert.ok(asset);
 await exec('gh',['release','download','v2.11.10','--repo','zhulongqihan/Focused-Moment','--pattern',asset.name,'--dir',previous],{windowsHide:true,timeout:120000});
 const oldExe=path.join(previous,'Focused Moment.exe');await fs.rename(path.join(previous,asset.name),oldExe);const oldHash=hash(await fs.readFile(oldExe));assert.equal(oldHash,asset.digest.slice(7).toUpperCase());assert.equal(oldHash,'9A1985D232CA91508A68A063BF62430C57C999E6CC2CB690C1F6EAF3A171EA9A');await writeJson(path.join(previous,'release-asset.json'),asset);
 const legacy=fixtureState();legacy.schemaVersion=2;legacy.appPreferences.schemaVersion=1;delete legacy.focusPlan;for(const todo of legacy.todoItems){delete todo.continuationNote;delete todo.continuationUpdatedAt;}const runtime=fixtureRuntime({schemaVersion:2,currentTaskTitle:'Release QA legacy session'});
 let instance;
 try{
  instance=await launch(run,'upgrade-data',legacy,runtime,oldExe);await click(instance,'计时');await click(instance,'开始');assert.equal((await readRuntime(instance)).isRunning,true);await wait(1000);await writeJson(path.join(instance.fixture,'legacy-running-windows.json'),await uia(instance,'Windows'));const oldControls=await uia(instance);await writeJson(path.join(instance.fixture,'legacy-running-uia.json'),oldControls);const completionTarget=oldControls.visible?instance:await findFloating(instance);await click(completionTarget,'完成并记录');const oldState=await readState(instance);assert.equal(oldState.focusRecords.length,1);assert.equal(oldState.focusRecords[0].title,'Release QA legacy session');await capture(instance,'old-version-saved');await writeJson(path.join(run.output,'old-version-produced-state.json'),oldState);await instance.stop();instance=undefined;
  report.assertions.push('Public v2.11.10 portable asset matches the published SHA-256 and writes one native UI-created focus record.');
  instance=await launch(run,'upgrade-data');await click(instance,'记录');const nextState=await readState(instance);await writeJson(path.join(run.output,'upgraded-state.json'),nextState);assert.equal(nextState.schemaVersion,3);assert.equal(nextState.focusRecords.length,1);assert.equal(nextState.focusRecords[0].title,oldState.focusRecords[0].title);assert.equal(nextState.focusRecords[0].durationMs,oldState.focusRecords[0].durationMs);assert.equal(nextState.todoItems.length,oldState.todoItems.length);assert.equal(nextState.todoItems[0].title,oldState.todoItems[0].title);const tree=await uia(instance);assert.ok(tree.elements.some(v=>v.name?.includes('Release QA legacy session')));report.assertions.push('Current Release upgrades the old app-produced state to schema 3 and displays the preserved record and task without duplication.');await capture(instance,'upgraded-records');await instance.stop();instance=undefined;
  instance=await launch(run,'upgrade-data');const restarted=await readState(instance);assert.deepEqual(restarted.focusRecords,nextState.focusRecords);assert.deepEqual(restarted.todoItems,nextState.todoItems);report.assertions.push('Upgraded records and tasks remain unchanged after another candidate restart.');report.previousVersion={version:'2.11.10',sha256:oldHash,assetUrl:asset.url};
 }finally{await instance?.stop();}
}

async function main(){
 const scenario=process.argv[2]??'probe';
 const run=await createRun(scenario);
 const report={evidenceClass:'Windows Release native UIAutomation',scenario,sha256:run.sha256,assertions:[],status:'running'};
 let instance;
 try {
  if(scenario==='upgrade'){await upgrade(run,report);report.status='passed';return;}
  const state=fixtureState();
  const runtime=fixtureRuntime();
  if(['hidden-audio','minimized-attention'].includes(scenario)){state.timerPreferences.soundReminderEnabled=true;state.timerPreferences.windowAttentionReminderEnabled=true;state.timerPreferences.alertSoundKey='custom';state.appPreferences.customAlertSoundName='release-qa-three-second-tone.wav';state.appPreferences.customAlertSoundData=toneWav();Object.assign(runtime,{modeKey:'countdown',countdownElapsedMs:45000,currentTaskTitle:'Release QA hidden reminder'});}
  instance=await launch(run,'workflow',state,runtime);
  if(scenario==='probe') {await capture(instance,'initial');console.log('Probe remains active until stdin closes or a newline is received.');await new Promise(resolve=>{process.stdin.resume();process.stdin.once('data',resolve);process.stdin.once('end',resolve);});}
  else if(scenario==='tray') {
   await click(instance,'计时');await click(instance,'开始');assert.equal((await readRuntime(instance)).isRunning,true);report.assertions.push('Native main UI starts the Rust timer.');
   await uia(instance,'OpenTray');await wait(300);await writeJson(path.join(instance.fixture,'running-menu.json'),await uia(instance,'MenuInspect'));
   await uia(instance,'MenuClick',{Name:'暂停计时'});await wait(300);assert.equal((await readRuntime(instance)).isRunning,false);report.assertions.push('Owned native tray menu pauses the Rust timer.');
   await uia(instance,'OpenTray');await wait(300);await writeJson(path.join(instance.fixture,'paused-menu.json'),await uia(instance,'MenuInspect'));
   await uia(instance,'MenuClick',{Name:'继续计时'});await wait(300);assert.equal((await readRuntime(instance)).isRunning,true);report.assertions.push('Owned native tray menu resumes the same timer.');
   assert.equal((await readState(instance)).focusRecords.length,0);report.assertions.push('Pause/resume does not save or duplicate a focus record.');await capture(instance,'resumed');
  } else if(['hidden-audio','minimized-attention'].includes(scenario)){
   await click(instance,'计时');
   const minimized=scenario==='minimized-attention';const observed=await measureAttention(instance,32,background=>measureAudio(instance,25,async()=>{await click(instance,'继续');await click(instance,minimized?'最小化窗口':'关闭窗口');const hiddenState=await uia(instance);assert.equal(minimized?hiddenState.minimized:!hiddenState.visible,true);report.background=await background();report.assertions.push(`Native window control ${minimized?'minimizes the main window':'hides the main window to the tray'} after countdown continuation; a separate QA window holds foreground.`);}));const meter=observed.result;report.attention=observed.attention;report.attention.status=observed.attention.events.length?'observed':'not-observed';assert.ok(observed.attention.events.length,'Background reminder must produce a Windows shell attention event for the candidate.');assert.ok(observed.attention.events.every(event=>!event.Foreground),'The candidate must stay in background while attention events fire.');report.assertions.push('Windows shell emits HSHELL_FLASH for the owned background main window after the countdown reminder.');
   const nonzero=meter.samples.filter(v=>v.peak>0.0001);assert.ok(nonzero.length>5,'Hidden reminder must produce measurable audio from the isolated process tree.');
   const backgroundState=await uia(instance);assert.equal(minimized?backgroundState.minimized:!backgroundState.visible,true);report.assertions.push(`Audio reminder fires while the main window remains ${minimized?'minimized':'hidden'}.`);
   report.audio={peak:Math.max(...nonzero.map(v=>v.peak)),nonzeroSamples:nonzero.length,spanSeconds:nonzero.at(-1).seconds-nonzero[0].seconds,limitation:meter.limitation};
   assert.equal((await readState(instance)).appPreferences.customAlertSoundData,state.appPreferences.customAlertSoundData);report.assertions.push('Saved custom test audio remains byte-identical.');
   await uia(instance,'Show');let reminderVisible=false;const deadline=Date.now()+8000;while(Date.now()<deadline){const tree=await uia(instance);if(tree.elements.some(v=>v.name?.includes('倒计时已完成'))){reminderVisible=true;break;}await wait(200);}assert.ok(reminderVisible,'Restored main UI must display the countdown completion reminder.');report.assertions.push('Restored main UI displays the countdown completion reminder.');await capture(instance,'hidden-alert-restored');
  } else if(scenario==='floating'){
   await click(instance,'计时');await click(instance,'开始');await wait(500);
   const tree=await uia(instance);const mini=tree.elements.find(v=>v.controlType==='ControlType.Button'&&v.name?.includes('迷你工作台'));assert.ok(mini,'Floating opener must be present.');await click(instance,mini.name);
   const floatingInstance=await findFloating(instance);await capture(floatingInstance,'floating-running');await click(floatingInstance,'完成并记录');
   let saved=await readState(instance);assert.equal(saved.focusRecords.length,1);assert.equal(saved.focusRecords[0].linkedTodoId,1);assert.equal(saved.todoItems[0].isCompleted,false);report.assertions.push('Floating completion saves one linked record and keeps the task unfinished.');
   const prompt=await uia(instance);await writeJson(path.join(instance.fixture,'bookmark-prompt-uia.json'),prompt);assert.ok(prompt.elements.some(v=>v.name==='保存停笔书签'));await click(instance,'暂不记录');assert.equal((await readState(instance)).focusRecords.length,1);report.assertions.push('Skipping a bookmark preserves the single saved record.');
   await click(instance,'今日');await click(instance,'开始专注');await click(instance,'计时');await wait(500);await capture(instance,'after-second-start');await writeJson(path.join(instance.fixture,'second-running.json'),await readRuntime(instance));assert.equal((await readRuntime(instance)).isRunning,true,'Second native start must run before opening floating view.');const tree2=await uia(instance);await click(instance,tree2.elements.find(v=>v.controlType==='ControlType.Button'&&v.name?.includes('迷你工作台')).name);await click(await findFloating(instance),'完成并记录');
   const prompt2=await uia(instance);const input=prompt2.elements.find(v=>v.controlType==='ControlType.Edit'&&v.name==='例如：从第三段的例子开始');assert.ok(input);await uia(instance,'TypeText',{Name:input.name,Value:'Resume at synthetic paragraph 3'});await capture(instance,'bookmark-filled');
   const save=prompt2.elements.find(v=>v.controlType==='ControlType.Button'&&v.name.includes('保存'));assert.ok(save);await uia(instance,'ClickPhysical',{Name:save.name});await wait(500);saved=await readState(instance);assert.equal(saved.focusRecords.length,2);assert.equal(new Set(saved.focusRecords.map(v=>v.id)).size,2);assert.equal(saved.todoItems[0].continuationNote,'Resume at synthetic paragraph 3');assert.equal(saved.todoItems[0].isCompleted,false);report.assertions.push('Second floating completion and bookmark save keep exactly two unique records and preserve the unfinished task.');await capture(instance,'bookmark-saved');
  } else if(scenario==='backup'){
   await click(instance,'计时');await click(instance,'开始');await wait(500);await click(instance,'完成并记录');await click(instance,'暂不记录');const before=await readState(instance);
   await click(instance,'设置');await capture(instance,'settings-before-backup');await click(instance,'导出备份');const backupDir=path.join(instance.storage,'Focused Moment Backups');const files=(await fs.readdir(backupDir)).filter(v=>v.endsWith('.json'));assert.equal(files.length,1);await writeJson(path.join(instance.fixture,'exported-backup.json'),JSON.parse(await fs.readFile(path.join(backupDir,files[0]),'utf8')));report.assertions.push('Native settings export creates a portable JSON backup.');
   const portable=path.join(run.output,'portable-export.json');await uia(instance,'TypeText',{Name:'外部备份文件路径',Value:portable});await click(instance,'导出到此路径');const exported=JSON.parse(await fs.readFile(portable,'utf8'));assert.equal(exported.formatVersion,3);assert.deepEqual(exported.state.focusRecords,before.focusRecords);assert.deepEqual(exported.state.todoItems,before.todoItems);report.assertions.push('Native external-path export writes a v3 backup with the exact saved record and task.');
   await click(instance,'今日');await click(instance,'开始专注');await click(instance,'计时');await wait(500);await click(instance,'完成并记录');await click(instance,'暂不记录');assert.equal((await readState(instance)).focusRecords.length,2);
   await click(instance,'设置');await click(instance,'Graphite Console 概念预览 石墨控制台 已实现');await wait(700);const changed=await readState(instance);assert.equal(changed.appPreferences.themeId,'graphite-console');await writeJson(path.join(run.output,'before-restore-mutated-state.json'),changed);
   await uia(instance,'TypeText',{Name:'外部备份文件路径',Value:portable});await click(instance,'预览');await capture(instance,'portable-preview');assert.deepEqual((await readState(instance)).focusRecords,changed.focusRecords);report.assertions.push('Preview leaves the deliberately changed current data untouched.');
   await click(instance,'确认导入并生成回滚');await confirmNativeImport(instance,'restore-cancel',changed,false);assert.deepEqual(await readState(instance),changed);assert.deepEqual((await fs.readdir(backupDir)).filter(v=>v.endsWith('.json')),files);report.assertions.push('Cancelling the native replacement confirmation preserves current records and creates no rollback.');
   await click(instance,'确认导入并生成回滚');await confirmNativeImport(instance,'restore-confirmation',changed);let after=await readState(instance);assert.deepEqual(after.focusRecords,before.focusRecords);assert.deepEqual(after.todoItems,before.todoItems);assert.equal(after.appPreferences.themeId,'graphite-console');report.assertions.push('Native external import replaces two records with the exported one only after confirmation, preserves tasks, and keeps the current theme by default.');
   const rollbackFiles=(await fs.readdir(backupDir)).filter(v=>v.endsWith('.json')&&!files.includes(v));const rollbacks=await Promise.all(rollbackFiles.map(async file=>({file,backup:JSON.parse(await fs.readFile(path.join(backupDir,file),'utf8'))})));assert.ok(rollbacks.some(v=>JSON.stringify(v.backup.state.focusRecords)===JSON.stringify(changed.focusRecords)),'Rollback must contain the two records that import replaces.');await writeJson(path.join(run.output,'rollback-verification.json'),rollbacks.map(v=>({file:v.file,recordCount:v.backup.state.focusRecords.length,theme:v.backup.state.appPreferences.themeId})));report.assertions.push('The generated rollback backup retains the replaced two-record state.');
   await click(instance,'预览');const toggled=await uia(instance,'Toggle',{Name:'同时恢复主题、视觉设置和自定义音效'});assert.equal(toggled.before,'Off');await click(instance,'确认导入并生成回滚');await confirmNativeImport(instance,'restore-preferences-confirmation',after);after=await readState(instance);assert.deepEqual(after.focusRecords,before.focusRecords);assert.equal(after.appPreferences.themeId,'night-valley');report.assertions.push('Opting into preference restoration restores the exported Night Valley theme without duplicating records.');await capture(instance,'restored');await instance.stop();instance=await launch(run,'workflow');const restarted=await readState(instance);assert.deepEqual(restarted.focusRecords,after.focusRecords);assert.deepEqual(restarted.todoItems,after.todoItems);assert.deepEqual(restarted.appPreferences,after.appPreferences);report.assertions.push('Restored data and preferences survive a candidate restart.');
   await click(instance,'设置');const finalBackupFiles=await fs.readdir(backupDir);await click(instance,'导入并替换当前数据');await confirmNativeImport(instance,'local-restore-cancel',restarted,false);assert.deepEqual(await readState(instance),restarted);assert.deepEqual(await fs.readdir(backupDir),finalBackupFiles);report.assertions.push('Cancelling the local-backup restore also preserves all data and existing backups.');
   await click(instance,'清空当前数据');await confirmNativeImport(instance,'clear-data-cancel',restarted,false);assert.deepEqual(await readState(instance),restarted);assert.deepEqual(await fs.readdir(backupDir),finalBackupFiles);report.assertions.push('Cancelling clear-data preserves records, tasks, preferences, and backup files.');
  } else {throw new Error(`Scenario is not implemented: ${scenario}`);}
  report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;process.exitCode=1;if(instance)await capture(instance,'failure').catch(()=>{});}
 finally {await instance?.stop();await writeJson(path.join(run.output,'report.json'),report);console.log(JSON.stringify(report));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
