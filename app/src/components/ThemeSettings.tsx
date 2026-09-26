import { For, Show, createMemo } from "solid-js";
import { BookOpen, SlidersHorizontal, Volume2 } from "lucide-solid";
import type { AlertSoundKey } from "../lib/contracts";
import type { SettingsSurfaceProps } from "../lib/theme-contracts";
import { themes } from "../lib/themes";
import PortableBackupPanel from "./PortableBackupPanel";

type ThemeSettingsProps = SettingsSurfaceProps & { variant: "metro" | "clutch" };
type TimerNumberKey = "pomodoroFocusMinutes" | "pomodoroBreakMinutes" | "stopwatchReminderMinutes";

const motionText = (value: number) => value <= 0
  ? { label: "关闭", detail: "不播放装饰过渡；状态变化通过文字和图形直接提示。" }
  : value < 50
    ? { label: "轻量", detail: "短促淡入与焦点提示，切换保持克制。" }
    : { label: "完整", detail: "启用路线推进与卡片过渡，变化幅度明显但不遮挡内容。" };
const densityText = (_value: "roomy" | "compact") => "舒展留白更多；紧凑同屏显示更多。";

function ThemeSettingsBody(props: ThemeSettingsProps) {
  let soundInput: HTMLInputElement | undefined;
  const clutch = () => props.variant === "clutch";
  const selectedTheme = createMemo(() => themes.find((theme) => theme.id === props.themeId()) ?? themes[0]);
  const motion = createMemo(() => motionText(props.motionIntensity()));
  const saveNumber = (key: TimerNumberKey, raw: string, min: number, max: number) => {
    const value = Math.min(max, Math.max(min, Number(raw) || min));
    void props.onSaveTimerPreferences({ [key]: value });
  };
  const toggle = (key: "toastReminderEnabled" | "windowAttentionReminderEnabled" | "soundReminderEnabled", value: boolean) => {
    void props.onSaveTimerPreferences({ [key]: value });
  };
  return <section classList={{ "nt-page": true, "nt-settings-page": true, "nt-settings-page--metro": !clutch(), "nt-settings-page--clutch": clutch() }} aria-label={clutch() ? "更衣室设置" : "站台控制设置"}>
    <header class="nt-settings-head"><span class="nt-eyebrow">{clutch() ? "LOCKER ROOM　/　HOME COURT CONTROLS" : "PLATFORM CONTROL　/　PREFERENCES"}</span><h1>{clutch() ? "更衣室" : "站台控制"}</h1><p>{clutch() ? "每项调整都会影响主场体验，并自动保存。" : "调整会立即生效并自动保存，不需要手动保存。"}</p><span class="nt-autosave">●　偏好自动保存</span></header>
    <div class="nt-settings-grid">
      <section class="nt-settings-card nt-identity-response"><section class="nt-theme-picker" aria-label="选择主题"><div class="nt-section-title"><div><span>01　/　VISUAL IDENTITY</span><h2>{clutch() ? "主场球衣" : "主题线路"}</h2></div><span>{clutch() ? "5 THEMES" : "THEME　/　01"}</span></div><div class="nt-theme-list"><For each={themes}>{(theme, index) => <button type="button" classList={{ "nt-theme-choice": true, selected: props.themeId() === theme.id, "nt-theme-choice--jersey": clutch() }} aria-pressed={props.themeId() === theme.id} onClick={() => props.onThemeSelect(theme.id)}><span class="nt-theme-art"><img src={theme.preview} alt="" /><i>{clutch() ? ["01", "02", "03", "04", "22"][index()] : String(index() + 1).padStart(2, "0")}</i></span><strong>{theme.name}</strong><small>{props.themeId() === theme.id ? "当前使用" : theme.englishName}</small></button>}</For></div></section>
      <section class="nt-visual-controls"><div class="nt-section-title"><div><span>DISPLAY RESPONSE　/　02</span><h2>{clutch() ? "场馆氛围" : "线路显示"}</h2></div><SlidersHorizontal size={19} /></div>
        <label class="nt-slider-control"><span><strong>{clutch() ? "场馆灯光" : "界面明度"}</strong><b>{props.visualIntensity()}%</b></span><input aria-label="画面明暗" type="range" min="0" max="100" value={props.visualIntensity()} style={{ "--nt-range-progress": `${props.visualIntensity()}%` }} onInput={(event) => props.onVisualIntensityChange(Number(event.currentTarget.value))} /><small>{clutch() ? "影响球场背景、木地板亮度与文字对比。" : "影响底色与卡片对比，不会隐藏任何内容。"}</small></label>
        <label class="nt-slider-control"><span><strong>{clutch() ? "回合动效" : "页面动效"}</strong><b>{props.motionIntensity()}%　·　{motion().label}</b></span><input aria-label="动效程度" type="range" min="0" max="100" value={props.motionIntensity()} style={{ "--nt-range-progress": `${props.motionIntensity()}%` }} onInput={(event) => props.onMotionIntensityChange(Number(event.currentTarget.value))} /><small>{motion().detail}</small></label>
        <div class="nt-density-control"><div><strong>{clutch() ? "球场信息密度" : "信息密度"}</strong><small>{densityText(props.density())}</small></div><div role="group" aria-label="信息密度"><button type="button" classList={{ selected: props.density() === "roomy" }} aria-pressed={props.density() === "roomy"} onClick={() => props.onDensityChange("roomy")}>舒展</button><button type="button" classList={{ selected: props.density() === "compact" }} aria-pressed={props.density() === "compact"} onClick={() => props.onDensityChange("compact")}>紧凑</button></div></div>
        <div class="nt-live-preview" data-motion={props.motionIntensity() === 0 ? "off" : props.motionIntensity() < 50 ? "subtle" : "full"} data-density={props.density()} style={{ "--nt-visual": String(0.35 + props.visualIntensity() / 155), "--nt-motion": Math.max(120, 900 - props.motionIntensity() * 7) + "ms" }}>
          <div class="nt-live-preview__label">
            <span>{clutch() ? "LIVE HOME-COURT PREVIEW" : "LIVE PREVIEW　/　即时预览"}</span>
            <strong>{clutch() ? "JIMMY BUTLER　/　#10" : `${selectedTheme().name}　·　${motion().label}`}</strong>
            <Show when={clutch()}><p>{selectedTheme().name}主场　·　场馆灯光 {props.visualIntensity()}%　·　{motion().label}动效。{densityText(props.density())}</p></Show>
          </div>
          <Show when={!clutch()}>
            <div class="nt-preview-sample"><span class="nt-preview-sample__number">04</span><div><small>NEXT DEPARTURE</small><strong>下一班</strong><span>按真实班次显示状态与信息层级</span></div><i aria-hidden="true" /></div>
            <div class="nt-preview-list"><span>今日专注　02:45</span><span>已完成　03 项</span><span>下一步　准备开始</span></div>
            <p>{densityText(props.density())} {motion().detail}</p>
          </Show>
          <Show when={clutch()}><img class="nt-jimmy-preview" src="/theme-assets/jimmy-butler-settings-composed.png" alt="Jimmy Butler 球星视觉预览" /></Show>
        </div>
      </section></section>
      <section class="nt-settings-card nt-clock-settings"><div class="nt-section-title"><div><span>TIMER SETTINGS　/　02</span><h2>{clutch() ? "比赛时钟" : "班次参数"}</h2></div><span class="nt-number-mark">02</span></div>
        <label class="nt-toggle-row"><span><strong>正向计时提醒</strong><small>达到设定分钟后提示，不改变计时记录。</small></span><div class="nt-number-field"><input aria-label="正向计时提醒分钟数" type="number" min="5" max="180" step="5" value={props.timerPreferences().stopwatchReminderMinutes ?? props.timerPreferences().pomodoroFocusMinutes} disabled={props.busy()} onChange={(event) => saveNumber("stopwatchReminderMinutes", event.currentTarget.value, 5, 180)} /><span>分钟</span></div></label>
        <label class="nt-toggle-row"><span><strong>番茄专注时长</strong><small>新建番茄专注时使用的默认分钟数。</small></span><div class="nt-number-field"><input aria-label="番茄专注时长分钟数" type="number" min="5" max="180" step="5" value={props.timerPreferences().pomodoroFocusMinutes} disabled={props.busy()} onChange={(event) => saveNumber("pomodoroFocusMinutes", event.currentTarget.value, 5, 180)} /><span>分钟</span></div></label>
        <label class="nt-toggle-row"><span><strong>番茄休息时长</strong><small>完成一轮专注后的默认休息长度。</small></span><div class="nt-number-field"><input aria-label="番茄休息时长分钟数" type="number" min="1" max="60" value={props.timerPreferences().pomodoroBreakMinutes} disabled={props.busy()} onChange={(event) => saveNumber("pomodoroBreakMinutes", event.currentTarget.value, 1, 60)} /><span>分钟</span></div></label>
        <label class="nt-check-row"><input type="checkbox" checked={props.autoMiniOnStart()} disabled={props.busy()} onChange={(event) => props.onAutoMiniOnStartChange(event.currentTarget.checked)} /><span><strong>{clutch() ? "开始专注时自动打开迷你工作台" : "自动打开迷你工作台"}</strong><small>{clutch() ? "偏好立即保存；仅影响新开始的正向或倒计时。" : "开始专注时弹出工作台；偏好立即保存。"}</small></span></label>
      </section>
      <section class="nt-settings-card nt-alert-settings"><div class="nt-section-title"><div><span>ALERTS　/　03</span><h2>{clutch() ? "场边提示" : "到站提示"}</h2></div><Volume2 size={19} /></div>
        <label class="nt-check-row"><input type="checkbox" checked={props.timerPreferences().toastReminderEnabled} disabled={props.busy()} onChange={(event) => toggle("toastReminderEnabled", event.currentTarget.checked)} /><span><strong>应用内完成提醒</strong><small>计时结束时在应用中显示状态提示。</small></span></label>
        <label class="nt-check-row"><input type="checkbox" checked={props.timerPreferences().windowAttentionReminderEnabled} disabled={props.busy()} onChange={(event) => toggle("windowAttentionReminderEnabled", event.currentTarget.checked)} /><span><strong>桌面窗口提醒</strong><small>窗口处于后台时提醒你回到专注。</small></span></label>
        <label class="nt-check-row"><input type="checkbox" checked={props.timerPreferences().soundReminderEnabled} disabled={props.busy()} onChange={(event) => toggle("soundReminderEnabled", event.currentTarget.checked)} /><span><strong>结束音效</strong><small>仅在本机播放，不上传音频内容。</small></span></label>
        <label class="nt-select-row"><span>提醒音效<select value={props.timerPreferences().alertSoundKey} disabled={props.busy()} onChange={(event) => void props.onSaveTimerPreferences({ alertSoundKey: event.currentTarget.value as AlertSoundKey })}><option value="soft_chime">柔和铃音</option><option value="bright_bell">明亮三连</option><option value="deep_pulse">沉稳脉冲</option><option value="wooden_tick">木鱼单击</option><option value="glass_ping">玻璃回响</option><option value="morning_chord">晨光和弦</option><option value="custom" disabled={!props.customAlertSoundName()}>自定义音效</option></select></span><div class="nt-audio-actions"><button type="button" disabled={props.busy()} onClick={props.onPreviewAlertSound}>试听</button><button type="button" disabled={props.busy()} onClick={() => soundInput?.click()}>导入自定义</button><Show when={props.customAlertSoundName()}><button type="button" disabled={props.busy()} onClick={() => void props.onClearCustomAlertSound()}>清除</button></Show><input ref={(element) => { soundInput = element; }} class="sr-only" type="file" accept="audio/*" aria-label="导入自定义音效" onChange={(event) => void props.onChooseCustomAlertSound(event)} /></div></label>
      </section>
      <section class="nt-settings-card nt-data-settings"><div class="nt-section-title"><div><span>LOCAL DATA　/　04</span><h2>{clutch() ? "本地录像与备份" : "本地数据与备份"}</h2></div><BookOpen size={19} /></div><p>待办、专注记录及未完成计时保存在本机。清空操作前建议先导出备份。</p><Show when={props.backupLoadState() === "loading"}><small>正在读取备份列表…</small></Show><Show when={props.backupLoadState() === "error"}><div class="nt-preference-error" role="alert"><span>备份列表读取失败：{props.backupLoadError()}</span><button type="button" onClick={() => void props.onLoadBackups()}>重试</button></div></Show><Show when={props.backupLoadState() === "ready" && props.backups().length > 0}><label class="nt-backup-select"><span>最近备份　/　选择恢复点</span><select value={props.selectedBackupFile()} onChange={(event) => props.onSelectedBackupFile(event.currentTarget.value)}><For each={props.backups()}>{(backup) => <option value={backup.fileName}>{backup.fileName}　·　{backup.focusRecordCount} 条记录</option>}</For></select></label><Show when={props.selectedBackup()}>{(backup) => <small>{backup().todoCount} 项待办 · {backup().focusRecordCount} 条记录 · v{backup().appVersion}</small>}</Show></Show><Show when={props.backupLoadState() === "ready" && props.backups().length === 0}><small>尚无本地备份；可以立即导出一份。</small></Show><div class="nt-data-actions"><button type="button" class="nt-primary-action" disabled={props.busy()} onClick={() => void props.onCreateBackup()}>{props.busy() ? props.busyLabel() : "导出备份"}</button><button type="button" disabled={props.busy() || !props.selectedBackupFile()} onClick={() => void props.onRestoreBackup()}>导入并替换当前数据</button><button type="button" disabled={props.busy()} onClick={() => void props.onOpenBackupFolder()}>打开备份目录</button><button type="button" class="danger" disabled={props.busy()} onClick={() => void props.onClearAllData()}>清空当前数据</button></div><Show when={props.lastBackupPath()}><small class="nt-backup-path">最近备份：{props.lastBackupPath()}</small></Show><details class="nt-portable-backup-details"><summary>完整 JSON 文件备份　·　选择文件、预览与导入</summary><div class="nt-portable-backup"><PortableBackupPanel path={props.portableBackupPath()} preview={props.portableBackupPreview()} restoreAppPreferences={props.restorePortableAppPreferences()} busy={props.busy()} onPathChange={props.onPortableBackupPathChange} onPreview={props.onPreviewPortableBackup} onExport={props.onExportPortableBackup} onImport={props.onImportPortableBackup} onRestoreAppPreferencesChange={props.onRestorePortableAppPreferencesChange} /></div></details></section>
    </div>
    <Show when={props.appPreferenceSaveError()}><div class="nt-preference-error" role="alert"><span>{props.appPreferenceSaveError()}</span><button type="button" disabled={props.appPreferenceSaveBusy()} onClick={props.onRetryAppPreferenceSave}>重试保存偏好</button></div></Show>
    <footer class="nt-settings-footer"><span>{selectedTheme().name}　/　PREFERENCES AUTO-SAVED</span><span>主题、明度、动效、密度、提醒及数据工具均无需手动保存</span></footer>
  </section>;
}

export function MetroThemeSettings(props: SettingsSurfaceProps & { variant: "metro" }) {
  return <ThemeSettingsBody {...props} />;
}
export function ClutchThemeSettings(props: SettingsSurfaceProps & { variant: "clutch" }) {
  return <ThemeSettingsBody {...props} />;
}
