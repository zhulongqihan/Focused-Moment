import { createSignal, Show } from "solid-js";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { BackupPreview } from "../lib/contracts";

interface PortableBackupPanelProps {
  path: string;
  preview: BackupPreview | null;
  restoreTodos: boolean;
  restoreRecords: boolean;
  restoreAppPreferences: boolean;
  busy: boolean;
  onPathChange: (path: string) => void;
  onExportPathChange?: (path: string) => void;
  onPreview: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onRestoreTodosChange: (value: boolean) => void;
  onRestoreRecordsChange: (value: boolean) => void;
  onRestoreAppPreferencesChange: (value: boolean) => void;
}

export default function PortableBackupPanel(props: PortableBackupPanelProps) {
  const [dialogError, setDialogError] = createSignal("");

  async function chooseBackupPath() {
    setDialogError("");
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Focused Moment backup", extensions: ["json"] }],
      });
      if (typeof selected === "string") {
        props.onPathChange(selected);
      }
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "无法打开文件选择器，请重试选择文件。");
    }
  }

  async function chooseExportPath() {
    setDialogError("");
    try {
      const selected = await save({
        defaultPath: "focused-moment-backup.json",
        filters: [{ name: "Focused Moment backup", extensions: ["json"] }],
      });
      if (selected) {
        (props.onExportPathChange ?? props.onPathChange)(selected);
      }
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "无法打开保存位置选择器，请重试。");
    }
  }

  return (
    <section class="portable-backup-panel" aria-label="便携备份">
      <header><div><span>PORTABLE BACKUP / V3</span><h2>完整备份与恢复</h2><p>预览不会修改当前数据；确认导入前会自动生成回滚备份。</p><p>仅恢复待办或记录时保留当前计时；同时恢复两项时也恢复备份中的计时。未选中的设置保持不变。</p></div><div class="portable-backup-panel__file-actions"><button type="button" class="secondary-button" disabled={props.busy} onClick={() => void chooseBackupPath()}>选择 JSON 文件</button><button type="button" class="secondary-button" disabled={props.busy} onClick={() => void chooseExportPath()}>选择导出位置</button></div></header>
        <div class="portable-backup-panel__path"><input aria-label="外部备份文件路径" value={props.path} placeholder="请通过文件选择器选择 JSON 文件或导出位置" readOnly /><button type="button" class="secondary-button" disabled={props.busy || !props.path.trim()} onClick={() => void props.onPreview()}>预览</button><button type="button" class="secondary-button" disabled={props.busy || !props.path.trim()} onClick={() => void props.onExport()}>导出到此路径</button></div>
        <Show when={dialogError()}><p class="portable-backup-panel__error" role="alert">{dialogError()}</p></Show>
        <Show when={props.preview}>
          {(preview) => <div class="portable-backup-panel__preview"><div><span>应用版本</span><strong>{preview().appVersion}</strong></div><div><span>格式 / Schema</span><strong>v{preview().formatVersion} / v{preview().schemaVersion}</strong></div><div><span>导出时间</span><strong>{preview().exportedAt}</strong></div><div><span>数据</span><strong>{preview().todoCount} 项待办 · {preview().focusRecordCount} 条记录</strong></div><div><span>未完成计时</span><strong>{preview().hasRuntimeSession ? "包含" : "不包含"}</strong></div><div><span>外观与音效</span><strong>{preview().hasAppPreferences ? "包含设置" : "不包含设置"} · {preview().hasCustomAlertSound ? "含自定义音效" : "无自定义音效"}</strong></div><Show when={preview().warnings.length > 0}><div class="portable-backup-panel__warnings"><span>导入提示</span><ul><ForWarnings warnings={preview().warnings} /></ul></div></Show><fieldset class="portable-backup-panel__restore-options"><legend>选择要恢复的内容</legend><label class="portable-backup-panel__restore-option"><input type="checkbox" checked={props.restoreTodos} onChange={(event) => props.onRestoreTodosChange(event.currentTarget.checked)} /><span>待办、收件箱和当前事项</span></label><label class="portable-backup-panel__restore-option"><input type="checkbox" checked={props.restoreRecords} onChange={(event) => props.onRestoreRecordsChange(event.currentTarget.checked)} /><span>专注记录和统计</span></label><label class="portable-backup-panel__restore-option"><input type="checkbox" checked={props.restoreAppPreferences} onChange={(event) => props.onRestoreAppPreferencesChange(event.currentTarget.checked)} /><span>主题、视觉设置和自定义音效（含计时设置）</span></label></fieldset><div class="portable-backup-panel__actions"><button type="button" class="primary-button" disabled={props.busy || (!props.restoreTodos && !props.restoreRecords && !props.restoreAppPreferences)} onClick={() => void props.onImport()}>确认导入并生成回滚</button></div></div>}
        </Show>
    </section>
  );
}

function ForWarnings(props: { warnings: string[] }) {
  return <>{props.warnings.map((warning) => <li>{warning}</li>)}</>;
}
