use super::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

const MAX_EXTERNAL_BACKUP_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupPreview {
    source_path: String,
    app_version: String,
    format_version: u64,
    schema_version: u64,
    exported_at: String,
    focus_record_count: usize,
    todo_count: usize,
    has_runtime_session: bool,
    has_app_preferences: bool,
    has_custom_alert_sound: bool,
    migration_needed: bool,
    warnings: Vec<String>,
}

fn external_backup_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("备份路径不能为空。".to_string());
    }
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("备份文件必须是 JSON 文件。".to_string());
    }
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取备份文件：{error}"))?;
    if !metadata.is_file() {
        return Err("备份路径必须指向一个文件。".to_string());
    }
    if metadata.len() > MAX_EXTERNAL_BACKUP_BYTES {
        return Err("备份文件超过 32MB，已拒绝读取。".to_string());
    }
    Ok(path)
}

fn read_external_backup(path: &Path) -> Result<(AppBackupFile, Option<u64>, u64, u64), String> {
    let raw = fs::read_to_string(path).map_err(|error| format!("读取备份失败：{error}"))?;
    let original = crate::storage::parse_backup_file(&raw)
        .map_err(|error| format!("备份文件格式损坏：{error}"))?;
    let original_format = original.format_version;
    let original_schema = original.schema_version;
    let (backup, migrated_from_format_version) = crate::migrate_backup_file(original.clone())?;
    normalize_persisted_collections(
        backup.state.todo_items.clone(),
        backup.state.focus_records.clone(),
    )?;
    backup.state.app_preferences.clone().normalized()?;
    backup.state.timer_preferences.normalized()?;
    Ok((
        original,
        migrated_from_format_version,
        original_format,
        original_schema,
    ))
}

fn backup_has_runtime_session(backup: &AppBackupFile) -> bool {
    backup.runtime.is_running
        || backup.runtime.stopwatch_elapsed_ms > 0
        || backup.runtime.countdown_elapsed_ms > 0
        || backup.runtime.pomodoro_elapsed_ms > 0
        || backup.runtime.pending_pomodoro_record_ms.is_some()
        || !backup.runtime.current_task_title.trim().is_empty()
        || backup.runtime.linked_todo_id.is_some()
}

fn backup_preview(
    path: &Path,
    backup: &AppBackupFile,
    migration_needed: bool,
    original_format: u64,
    original_schema: u64,
) -> BackupPreview {
    let mut warnings = Vec::new();
    if migration_needed {
        warnings.push(format!(
            "这份备份将从格式 v{original_format} 迁移到 v{APP_BACKUP_FORMAT_VERSION}。"
        ));
    }
    if original_schema < CURRENT_STORAGE_SCHEMA_VERSION {
        warnings.push("备份中的数据 schema 需要升级。".to_string());
    }
    if backup.state.focus_records.iter().any(|record| {
        record
            .linked_todo_id
            .is_some_and(|id| !backup.state.todo_items.iter().any(|item| item.id == id))
    }) {
        warnings.push("部分记录的关联待办不在备份中。恢复时按保留的待办校验关联，无法匹配时保留历史标题和时长，解除无效关联。".to_string());
    }
    BackupPreview {
        source_path: path.display().to_string(),
        app_version: backup.app_version.clone(),
        format_version: original_format,
        schema_version: original_schema,
        exported_at: backup.exported_at.clone(),
        focus_record_count: backup.state.focus_records.len(),
        todo_count: backup.state.todo_items.len(),
        has_runtime_session: backup_has_runtime_session(backup),
        has_app_preferences: original_format >= APP_BACKUP_FORMAT_VERSION
            && original_schema >= CURRENT_STORAGE_SCHEMA_VERSION,
        has_custom_alert_sound: backup
            .state
            .app_preferences
            .custom_alert_sound_data
            .is_some(),
        migration_needed,
        warnings,
    }
}

#[cfg(test)]
mod rc_backup_preview_tests {
    use super::*;

    #[test]
    fn external_preview_is_read_only_validates_contents_and_preserves_migration_origin() {
        let root = std::env::temp_dir().join(format!(
            "focused-moment-preview-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("synthetic.json");
        for version in [1, 2, 3] {
            let backup = AppBackupFile {
                kind: APP_BACKUP_KIND.into(),
                format_version: version,
                schema_version: version,
                app_version: "2.11.11".into(),
                exported_at: "2026-09-19T12:00:00+08:00".into(),
                state: PersistedState {
                    schema_version: version,
                    ..PersistedState::default()
                },
                runtime: PersistedRuntimeState {
                    schema_version: version,
                    ..PersistedRuntimeState::default()
                },
            };
            let raw = serde_json::to_vec(&backup).unwrap();
            fs::write(&path, &raw).unwrap();
            let (read, migration, format, schema) =
                read_external_backup(&external_backup_path(path.to_str().unwrap()).unwrap())
                    .unwrap();
            let preview = backup_preview(&path, &read, migration.is_some(), format, schema);
            assert_eq!(preview.format_version, version);
            assert_eq!(preview.migration_needed, version < 3);
            assert_eq!(
                read.format_version, version,
                "import must still know migration origin"
            );
            assert_eq!(
                fs::read(&path).unwrap(),
                raw,
                "preview must not rewrite input"
            );
        }
        for raw in ["{", "{}", "null"] {
            fs::write(&path, raw).unwrap();
            assert!(read_external_backup(&path).is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), raw);
        }
        let file = fs::File::create(&path).unwrap();
        file.set_len(MAX_EXTERNAL_BACKUP_BYTES + 1).unwrap();
        drop(file);
        assert!(external_backup_path(path.to_str().unwrap()).is_err());
        // Only the exact unique synthetic directory created above is removed.
        fs::remove_dir_all(root).unwrap();
    }
}

#[tauri::command]
pub(crate) fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: APP_VERSION,
        milestone: APP_MILESTONE,
        slogan: "\u{7528}\u{66f4}\u{8f7b}\u{7684}\u{65b9}\u{5f0f}\u{4e13}\u{6ce8}\u{3001}\u{5b89}\u{6392}\u{548c}\u{590d}\u{76d8}\u{6bcf}\u{4e00}\u{5929}\u{3002}",
        surfaces: vec![
            ShellPanel {
                id: "timer",
                title: "\u{65f6}\u{95f4}\u{5f15}\u{64ce}",
                phase: "v0.2-v0.3",
                status: "\u{5df2}\u{5b8c}\u{6210}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{3001}\u{756a}\u{8304}\u{949f}\u{4ee5}\u{53ca}\u{540e}\u{53f0}/\u{4f11}\u{7720}\u{6062}\u{590d}\u{540e}\u{7684}\u{771f}\u{5b9e}\u{65f6}\u{95f4}\u{6821}\u{6b63}\u{3002}",
            },
            ShellPanel {
                id: "tasks",
                title: "\u{4efb}\u{52a1}\u{9762}\u{677f}",
                phase: "v0.4.0-v1.2.0",
                status: "\u{5df2}\u{589e}\u{5f3a}",
                summary: "\u{4efb}\u{52a1}\u{533a}\u{73b0}\u{5728}\u{652f}\u{6301}\u{641c}\u{7d22}\u{3001}\u{7b5b}\u{9009}\u{4e0e}\u{6392}\u{5e8f}\u{ff0c}\u{66f4}\u{9002}\u{5408}\u{65e5}\u{5e38}\u{7ef4}\u{62a4}\u{548c}\u{5feb}\u{901f}\u{627e}\u{4efb}\u{52a1}\u{3002}",
            },
            ShellPanel {
                id: "analytics",
                title: "\u{6570}\u{636e}\u{590d}\u{76d8}",
                phase: "v0.7.0-v1.1.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{65f6}\u{95f4}\u{8303}\u{56f4}\u{7b5b}\u{9009}\u{3001}\u{5355}\u{6761}\u{5220}\u{9664}\u{4e0e}\u{8303}\u{56f4}\u{6e05}\u{7406}\u{ff0c}\u{590d}\u{76d8}\u{9875}\u{7684}\u{65e5}\u{5e38}\u{53ef}\u{7528}\u{6027}\u{66f4}\u{5b8c}\u{6574}\u{4e86}\u{3002}",
            },
            ShellPanel {
                id: "tray",
                title: "\u{540e}\u{53f0}\u{5e38}\u{9a7b}",
                phase: "v0.9.0-v1.0.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5173}\u{95ed}\u{4e3b}\u{7a97}\u{53e3}\u{540e}\u{4f1a}\u{9690}\u{85cf}\u{5230}\u{7cfb}\u{7edf}\u{6258}\u{76d8}\u{ff0c}\u{53ef}\u{4ee5}\u{4ece}\u{6258}\u{76d8}\u{91cd}\u{65b0}\u{6253}\u{5f00}\u{6216}\u{9000}\u{51fa}\u{5e94}\u{7528}\u{3002}",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "focus-reminders",
                title: "\u{4e13}\u{6ce8}\u{63d0}\u{9192}",
                phase: "v1.3.0-v1.3.3",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{756a}\u{8304}\u{4e13}\u{6ce8}\u{7ed3}\u{675f}\u{3001}\u{4f11}\u{606f}\u{7ed3}\u{675f}\u{4e0e}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{5230}\u{70b9}\u{73b0}\u{5728}\u{90fd}\u{53ef}\u{4ee5}\u{89e6}\u{53d1}\u{7cfb}\u{7edf}\u{901a}\u{77e5}\u{6216}\u{7a97}\u{53e3}\u{63d0}\u{9192}\u{3002}",
            },
            ShellPanel {
                id: "session-recovery",
                title: "\u{4f1a}\u{8bdd}\u{6062}\u{590d}",
                phase: "v1.2.6-v1.3.3",
                status: "\u{5df2}\u{589e}\u{5f3a}",
                summary: "运行中的会话会独立落盘并保留快照备份，启动时优先恢复核心计时与任务上下文。",
            },
            ShellPanel {
                id: "data-backup",
                title: "\u{6570}\u{636e}\u{5907}\u{4efd}\u{4e0e}\u{6062}\u{590d}",
                phase: "v1.4.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "主状态和运行中会话现在都会在写入前自动生成本地备份，为后续回退和排查留下一层保护。",
            },
            ShellPanel {
                id: "safe-rendering",
                title: "\u{7a33}\u{5b9a}\u{6e32}\u{67d3}",
                phase: "v1.3.3",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "主界面默认优先使用更轻的渲染模式，减少多层模糊和毛玻璃对 Windows 桌面环境的压力。",
            },
        ],
    }
}

#[tauri::command]
pub(crate) fn get_timer_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn acknowledge_timer_alert(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.clear_alert();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn get_timer_preferences(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerPreferencesSnapshot, String> {
    state.ensure_ready()?;
    let preferences = *state
        .timer_preferences
        .lock()
        .map_err(|_| "计时设置状态锁定失败".to_string())?;

    Ok(preferences.snapshot())
}

#[tauri::command]
pub(crate) fn update_timer_preferences(
    state: tauri::State<'_, TimerEngineState>,
    preferences: TimerPreferences,
) -> Result<TimerPreferencesSnapshot, String> {
    state.ensure_ready()?;
    let normalized_preferences = preferences.normalized()?;

    {
        let mut engine = state
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?;
        engine.apply_preferences(normalized_preferences);
    }

    {
        let mut stored_preferences = state
            .timer_preferences
            .lock()
            .map_err(|_| "计时设置状态锁定失败".to_string())?;
        *stored_preferences = normalized_preferences;
    }

    state.persist_all()?;
    Ok(normalized_preferences.snapshot())
}

#[tauri::command]
pub(crate) fn get_app_preferences(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AppPreferences, String> {
    state.ensure_ready()?;
    state
        .app_preferences
        .lock()
        .map_err(|_| "应用设置状态锁定失败".to_string())
        .map(|preferences| preferences.clone())
}

#[tauri::command]
pub(crate) fn update_app_preferences(
    state: tauri::State<'_, TimerEngineState>,
    preferences: AppPreferences,
) -> Result<AppPreferences, String> {
    state.ensure_ready()?;
    let normalized = preferences.normalized()?;
    {
        let mut stored = state
            .app_preferences
            .lock()
            .map_err(|_| "应用设置状态锁定失败".to_string())?;
        *stored = normalized.clone();
    }
    state.persist()?;
    Ok(normalized)
}

#[tauri::command]
pub(crate) fn get_focus_plan(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<FocusPlanState, String> {
    state.ensure_ready()?;
    let items = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?
        .clone();
    let mut changed = false;
    let normalized = {
        let mut plan = state
            .focus_plan
            .lock()
            .map_err(|_| "专注计划状态锁定失败".to_string())?;
        let normalized = normalize_focus_plan(plan.clone(), &items, false);
        if *plan != normalized {
            *plan = normalized.clone();
            changed = true;
        }
        normalized
    };

    // Day rollover and todo rescheduling can invalidate picks without a
    // user-facing command. Persist the cleanup once, while keeping reads
    // side-effect free when the plan is already valid.
    if changed {
        state.persist()?;
    }
    Ok(normalized)
}

#[tauri::command]
pub(crate) fn update_focus_plan(
    state: tauri::State<'_, TimerEngineState>,
    current_todo_id: Option<u64>,
    today_pick_ids: Vec<u64>,
) -> Result<FocusPlanState, String> {
    state.ensure_ready()?;
    let items = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?;
    let pending = items
        .iter()
        .filter(|item| !item.is_completed)
        .collect::<Vec<_>>();
    if let Some(id) = current_todo_id {
        if !pending.iter().any(|item| item.id == id) {
            return Err("当前事项不存在或已经完成。".to_string());
        }
    }
    if today_pick_ids.len() > 3 {
        return Err("今日精选最多保留 3 项。".to_string());
    }
    let today = Local::now().format("%Y-%m-%d").to_string();
    let mut seen = HashSet::new();
    for id in &today_pick_ids {
        if !seen.insert(*id) {
            return Err("今日精选不能重复添加同一项。".to_string());
        }
        let item = pending
            .iter()
            .find(|item| item.id == *id)
            .ok_or_else(|| "今日精选只能包含未完成的待办。".to_string())?;
        if !item.scheduled_date.is_empty() && item.scheduled_date != today {
            return Err("今日精选只能包含今天或收件箱中的待办。".to_string());
        }
    }
    drop(items);

    let next = FocusPlanState {
        current_todo_id,
        today_pick_ids,
    };
    {
        let mut plan = state
            .focus_plan
            .lock()
            .map_err(|_| "专注计划状态锁定失败".to_string())?;
        *plan = next.clone();
    }
    state.persist()?;
    Ok(next)
}

#[tauri::command]
pub(crate) fn update_timer_context(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
) -> Result<TimerSnapshot, String> {
    state.ensure_ready()?;
    if let Some(id) = linked_todo_id {
        let items = state.todo_items.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        if !items.iter().any(|item| item.id == id && !item.is_completed) {
            return Err(
                "\u{5f53}\u{524d}\u{5173}\u{8054}\u{7684}\u{4efb}\u{52a1}\u{4e0d}\u{5b58}\u{5728}\u{6216}\u{5df2}\u{5b8c}\u{6210}"
                    .to_string(),
            );
        }
    }

    let snapshot = with_timer_engine(&state, |engine| {
        engine.update_context(
            title.trim().to_string(),
            linked_todo_id,
            complete_linked_todo_on_finish,
        );
        Ok(engine.snapshot())
    })?;

    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn switch_timer_mode(
    state: tauri::State<'_, TimerEngineState>,
    mode: String,
) -> Result<TimerSnapshot, String> {
    let next_mode = parse_mode(&mode)?;
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != next_mode && engine.has_unsubmitted_progress() {
            return Err("当前计时还有未提交的进度，请先完成记录或重置后再切换模式。".to_string());
        }
        engine.switch_mode(next_mode);
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn set_countdown_minutes(
    state: tauri::State<'_, TimerEngineState>,
    minutes: u64,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != TimerMode::Countdown {
            return Err("请先切换到倒计时模式。".to_string());
        }
        engine.set_countdown_minutes(minutes)?;
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn get_focus_records(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<FocusRecord>, String> {
    state.ensure_ready()?;
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(records.clone())
}

#[tauri::command]
pub(crate) fn update_focus_record_title(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
) -> Result<Vec<FocusRecord>, String> {
    let normalized_title = normalize_focus_record_title(&title)?;
    let records = with_focus_records(&state, |records| {
        let record = records
            .iter_mut()
            .find(|record| record.id == id)
            .ok_or_else(|| "未找到要编辑的专注记录".to_string())?;

        record.title = normalized_title;
        record.edited_at = Some(current_local_markers().0);
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn create_manual_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    duration_minutes: u64,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
) -> Result<Vec<FocusRecord>, String> {
    state.ensure_ready()?;
    let normalized_title = normalize_focus_record_title(&title)?;
    if !(1..=1440).contains(&duration_minutes) {
        return Err("手动补录时长需要在 1 到 1440 分钟之间。".to_string());
    }
    let normalized_date = normalize_scheduled_date(&completed_date)?;
    if normalized_date.is_empty() {
        return Err("手动补录需要填写完成日期。".to_string());
    }
    let normalized_time = normalize_scheduled_time(&completed_time)?;
    let linked_todo_title = linked_todo_id
        .map(|id| {
            let items = state
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?;
            items
                .iter()
                .find(|item| item.id == id)
                .map(|item| item.title.clone())
                .ok_or_else(|| "关联的待办不存在。".to_string())
        })
        .transpose()?;
    let id = {
        let mut next = state
            .next_record_id
            .lock()
            .map_err(|_| "记录编号状态锁定失败".to_string())?;
        let id = *next;
        *next += 1;
        id
    };
    let completed_at = format!(
        "{} {}:00",
        normalized_date,
        if normalized_time.is_empty() {
            "00:00"
        } else {
            normalized_time.as_str()
        }
    );
    let record = FocusRecord {
        id,
        title: normalized_title,
        duration_ms: duration_minutes.saturating_mul(60_000),
        duration_label: format_duration_ms(duration_minutes.saturating_mul(60_000)),
        mode_key: "stopwatch".to_string(),
        mode_label: "手动补录".to_string(),
        phase_label: "手动补录".to_string(),
        linked_todo_id,
        linked_todo_title,
        completed_at,
        completed_date: normalized_date,
        completed_time: normalized_time,
        source: "manual".to_string(),
        time_basis: "completion_day".to_string(),
        edited_at: None,
    };
    let records = with_focus_records(&state, |records| {
        records.insert(0, record);
        sort_focus_records(records);
        Ok(records.clone())
    })?;
    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn update_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    duration_minutes: u64,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
) -> Result<Vec<FocusRecord>, String> {
    let normalized_title = normalize_focus_record_title(&title)?;
    if !(1..=1440).contains(&duration_minutes) {
        return Err("记录时长需要在 1 到 1440 分钟之间。".to_string());
    }
    let normalized_date = normalize_scheduled_date(&completed_date)?;
    if normalized_date.is_empty() {
        return Err("记录需要填写完成日期。".to_string());
    }
    let normalized_time = normalize_scheduled_time(&completed_time)?;
    let linked_todo_title = linked_todo_id
        .map(|todo_id| {
            let items = state
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?;
            items
                .iter()
                .find(|item| item.id == todo_id)
                .map(|item| item.title.clone())
                .ok_or_else(|| "关联的待办不存在。".to_string())
        })
        .transpose()?;
    let completed_at = format!(
        "{} {}:00",
        normalized_date,
        if normalized_time.is_empty() {
            "00:00"
        } else {
            normalized_time.as_str()
        }
    );
    let records = with_focus_records(&state, |records| {
        let record = records
            .iter_mut()
            .find(|record| record.id == id)
            .ok_or_else(|| "未找到要编辑的专注记录".to_string())?;
        record.title = normalized_title.clone();
        record.duration_ms = duration_minutes.saturating_mul(60_000);
        record.duration_label = format_duration_ms(record.duration_ms);
        record.completed_at = completed_at.clone();
        record.completed_date = normalized_date.clone();
        record.completed_time = normalized_time.clone();
        record.linked_todo_id = linked_todo_id;
        record.linked_todo_title = linked_todo_title.clone();
        record.edited_at = Some(current_local_markers().0);
        sort_focus_records(records);
        Ok(records.clone())
    })?;
    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn delete_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<FocusRecord>, String> {
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| record.id != id);
        if records.len() == before_len {
            return Err("未找到要删除的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn restore_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    record: FocusRecord,
) -> Result<Vec<FocusRecord>, String> {
    let todo_items = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?
        .clone();
    let record = normalize_focus_record(record, &todo_items)?;
    let record_id = record.id;
    let records = with_focus_records(&state, |records| {
        if records.iter().any(|item| item.id == record_id) {
            return Err("这条专注记录已经存在，无法重复恢复。".to_string());
        }

        records.insert(0, record.clone());
        sort_focus_records(records);
        Ok(records.clone())
    })?;

    {
        let mut next_record_id = state
            .next_record_id
            .lock()
            .map_err(|_| "记录编号状态锁定失败".to_string())?;
        *next_record_id = (*next_record_id).max(record_id.saturating_add(1));
    }

    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn delete_focus_records(
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<Vec<FocusRecord>, String> {
    if ids.is_empty() {
        return Err("当前范围内没有可清理的专注记录".to_string());
    }

    let id_set = ids.into_iter().collect::<HashSet<_>>();
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| !id_set.contains(&record.id));
        if records.len() == before_len {
            return Err("没有找到可清理的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    state.persist()?;
    Ok(records)
}

#[tauri::command]
pub(crate) fn get_analytics_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AnalyticsSnapshot, String> {
    state.ensure_ready()?;
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;
    let todo_items = state.todo_items.lock().map_err(|_| {
        "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(analytics_snapshot(&records, &todo_items))
}

#[tauri::command]
pub(crate) fn clear_app_data(state: tauri::State<'_, TimerEngineState>) -> Result<(), String> {
    state.clear_all()
}

#[tauri::command]
pub(crate) fn list_app_backups(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<BackupListItem>, String> {
    let store = state.persistence_store()?;

    let backups = store.list_user_backups()?;
    Ok(backups
        .into_iter()
        .filter(|(_, backup)| {
            backup.kind == APP_BACKUP_KIND
                && matches!(backup.format_version, 1 | 2 | APP_BACKUP_FORMAT_VERSION)
        })
        .map(|(file_name, backup)| BackupListItem {
            file_name,
            exported_at: backup.exported_at,
            app_version: backup.app_version,
            format_version: backup.format_version,
            schema_version: backup.schema_version,
            migration_needed: backup.format_version != APP_BACKUP_FORMAT_VERSION,
            focus_record_count: backup.state.focus_records.len(),
            todo_count: backup.state.todo_items.len(),
            has_runtime_session: backup.runtime.is_running
                || backup.runtime.stopwatch_elapsed_ms > 0
                || backup.runtime.countdown_elapsed_ms > 0
                || backup.runtime.pomodoro_elapsed_ms > 0
                || backup.runtime.pending_pomodoro_record_ms.is_some()
                || !backup.runtime.current_task_title.trim().is_empty()
                || backup.runtime.linked_todo_id.is_some(),
        })
        .collect())
}

#[tauri::command]
pub(crate) fn export_app_backup(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<BackupExportResult, String> {
    let store = state.persistence_store()?;

    let backup = state.export_backup_file()?;
    let file_name = create_backup_file_name("focused-moment-backup-v3-");
    let exported_at = backup.exported_at.clone();
    let backup_path = store.save_user_backup(&file_name, &backup)?;

    Ok(BackupExportResult {
        file_name,
        file_path: backup_path.display().to_string(),
        exported_at,
    })
}

#[tauri::command]
pub(crate) fn import_app_backup(
    state: tauri::State<'_, TimerEngineState>,
    file_name: String,
) -> Result<BackupImportResult, String> {
    let store = state.persistence_store()?;

    let backup = store.load_user_backup(&file_name)?;
    let rollback = state.export_backup_file()?;
    let rollback_file_name =
        create_backup_file_name("focused-moment-backup-v3-rollback-before-import-");
    store.save_user_backup(&rollback_file_name, &rollback)?;

    let mut result = state.apply_backup_file_with_options(
        backup,
        BackupImportOptions {
            restore_todos: true,
            restore_records: true,
            restore_app_preferences: false,
        },
    )?;
    result.imported_file_name = file_name;
    result.rollback_file_name = rollback_file_name;
    Ok(result)
}

#[tauri::command]
pub(crate) fn preview_app_backup_path(path: String) -> Result<BackupPreview, String> {
    let path = external_backup_path(&path)?;
    let (backup, migrated, original_format, original_schema) = read_external_backup(&path)?;
    Ok(backup_preview(
        &path,
        &backup,
        migrated.is_some() || original_format != APP_BACKUP_FORMAT_VERSION,
        original_format,
        original_schema,
    ))
}

#[tauri::command]
pub(crate) fn export_app_backup_to_path(
    state: tauri::State<'_, TimerEngineState>,
    path: String,
) -> Result<BackupExportResult, String> {
    state.ensure_ready()?;
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("备份路径不能为空。".to_string());
    }
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("备份文件必须是 JSON 文件。".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建备份目录：{error}"))?;
    }
    let backup = state.export_backup_file()?;
    let exported_at = backup.exported_at.clone();
    crate::storage::write_backup_atomic(&path, &backup, true)
        .map_err(|error| format!("写入备份失败：{error}"))?;
    Ok(BackupExportResult {
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("focused-moment-backup.json")
            .to_string(),
        file_path: path.display().to_string(),
        exported_at,
    })
}

#[tauri::command]
pub(crate) fn import_app_backup_path(
    state: tauri::State<'_, TimerEngineState>,
    path: String,
    restore_todos: bool,
    restore_records: bool,
    restore_app_preferences: bool,
) -> Result<BackupImportResult, String> {
    if !restore_todos && !restore_records && !restore_app_preferences {
        return Err("请至少选择一项要恢复的内容。".to_string());
    }
    let path = external_backup_path(&path)?;
    let (backup, _migrated, _original_format, _original_schema) = read_external_backup(&path)?;
    let store = state.persistence_store()?;
    let rollback = state.export_backup_file()?;
    let rollback_file_name =
        create_backup_file_name("focused-moment-backup-v3-rollback-before-import-");
    store.save_user_backup(&rollback_file_name, &rollback)?;
    let mut result = state.apply_backup_file_with_options(
        backup,
        BackupImportOptions {
            restore_todos,
            restore_records,
            restore_app_preferences,
        },
    )?;
    result.imported_file_name = path.display().to_string();
    result.rollback_file_name = rollback_file_name;
    Ok(result)
}

#[tauri::command]
pub(crate) fn open_app_backup_folder(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<(), String> {
    let store = state.persistence_store()?;
    let backup_dir = store.user_backup_dir()?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(&backup_dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&backup_dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let _ = backup_dir;
        Err("当前平台暂不支持打开备份目录。".to_string())
    }
}

#[tauri::command]
pub(crate) fn get_todo_items(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<TodoItem>, String> {
    with_todo_items(&state, |items| {
        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })
}

#[tauri::command]
pub(crate) fn create_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    state.ensure_ready()?;
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let next_id = {
        let mut id_guard = state.next_todo_id.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let items = with_todo_items(&state, |items| {
        items.insert(
            0,
            TodoItem {
                id: next_id,
                title: normalized_title,
                is_completed: false,
                scheduled_date: normalized_date,
                scheduled_time: normalized_time,
                importance_key: normalized_importance,
                continuation_note: String::new(),
                continuation_updated_at: None,
            },
        );
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
pub(crate) fn update_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{7f16}\u{8f91}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.title = normalized_title;
        item.scheduled_date = normalized_date;
        item.scheduled_time = normalized_time;
        item.importance_key = normalized_importance;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    let plan_changed = normalize_focus_plan_references(&state)?;
    if plan_changed {
        state.persist_all()?;
    } else {
        state.persist()?;
    }
    Ok(items)
}

#[tauri::command]
pub(crate) fn update_todo_continuation_note(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    note: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_note = normalize_continuation_note(&note)?;
    let updated_at = if normalized_note.is_empty() {
        None
    } else {
        Some(current_local_markers().0)
    };
    let items = with_todo_items(&state, |items| {
        let item = items
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "未找到要保存停笔书签的待办。".to_string())?;
        item.continuation_note = normalized_note.clone();
        item.continuation_updated_at = updated_at.clone();
        sort_todo_items(items);
        Ok(items.clone())
    })?;
    state.persist()?;
    Ok(items)
}

fn clear_focus_plan_reference(state: &TimerEngineState, id: u64) -> Result<(), String> {
    let mut plan = state
        .focus_plan
        .lock()
        .map_err(|_| "专注计划状态锁定失败".to_string())?;
    if plan.current_todo_id == Some(id) {
        plan.current_todo_id = None;
    }
    plan.today_pick_ids.retain(|candidate| *candidate != id);
    Ok(())
}

fn normalize_focus_plan_references(state: &TimerEngineState) -> Result<bool, String> {
    let items = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?
        .clone();
    let mut plan = state
        .focus_plan
        .lock()
        .map_err(|_| "专注计划状态锁定失败".to_string())?;
    let normalized = normalize_focus_plan(plan.clone(), &items, false);
    let changed = *plan != normalized;
    if changed {
        *plan = normalized;
    }
    Ok(changed)
}

fn clear_todo_record_references(state: &TimerEngineState, id: u64) -> Result<bool, String> {
    let mut records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;
    let mut changed = false;
    for record in records.iter_mut() {
        if record.linked_todo_id == Some(id) {
            record.linked_todo_id = None;
            record.edited_at = Some(current_local_markers().0);
            changed = true;
        }
    }
    Ok(changed)
}

#[tauri::command]
pub(crate) fn toggle_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let mut should_clear_timer_link = false;
    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{66f4}\u{65b0}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.is_completed = !item.is_completed;
        should_clear_timer_link = item.is_completed;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    if should_clear_timer_link {
        clear_focus_plan_reference(&state, id)?;
        with_timer_engine(&state, |engine| {
            if engine.linked_todo_id == Some(id) {
                engine.linked_todo_id = None;
                return Ok(());
            }
            Ok(())
        })?;
        state.persist_all()?;
    } else {
        state.persist()?;
    }
    Ok(items)
}

#[tauri::command]
pub(crate) fn delete_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let items = with_todo_items(&state, |items| {
        let before_len = items.len();
        items.retain(|item| item.id != id);
        if items.len() == before_len {
            return Err(
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5220}\u{9664}\u{7684}\u{4efb}\u{52a1}"
                    .to_string(),
            );
        }

        sort_todo_items(items);
        Ok(items.clone())
    })?;

    with_timer_engine(&state, |engine| {
        if engine.linked_todo_id == Some(id) {
            engine.linked_todo_id = None;
        }
        Ok(())
    })?;
    clear_focus_plan_reference(&state, id)?;
    clear_todo_record_references(&state, id)?;
    state.persist_all()?;
    Ok(items)
}

#[tauri::command]
pub(crate) fn restore_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    item: TodoItem,
) -> Result<Vec<TodoItem>, String> {
    let normalized_item = normalize_todo_item(item)?;
    let item_id = normalized_item.id;

    let items = with_todo_items(&state, |items| {
        if items.iter().any(|current| current.id == item_id) {
            return Err("这个待办已经存在，无法重复恢复。".to_string());
        }

        items.push(normalized_item.clone());
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    {
        let mut next_todo_id = state
            .next_todo_id
            .lock()
            .map_err(|_| "任务编号状态锁定失败".to_string())?;
        *next_todo_id = (*next_todo_id).max(item_id.saturating_add(1));
    }

    state.persist()?;
    Ok(items)
}

#[tauri::command]
pub(crate) fn start_timer(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.start();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn pause_timer(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.pause();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn reset_timer(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSnapshot, String> {
    let snapshot = with_timer_engine(&state, |engine| {
        engine.reset();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn complete_focus_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
) -> Result<CompletionPayload, String> {
    let completed_session = with_timer_engine(&state, |engine| engine.complete_focus_session())?;
    let (completed_at, completed_date, completed_time) = current_local_markers();
    let record_linked_todo_id = completed_session.linked_todo_id;

    let linked_todo_title = match record_linked_todo_id {
        Some(id) => {
            let items = state.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;

            let item = items.iter().find(|item| item.id == id).ok_or_else(|| {
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5173}\u{8054}\u{7684}\u{4efb}\u{52a1}"
                    .to_string()
            })?;

            Some(item.title.clone())
        }
        None => None,
    };

    let next_id = {
        let mut id_guard = state.next_record_id.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let normalized_title = title.trim();
    let completed_task_title = completed_session.task_title.trim();
    let record = FocusRecord {
        id: next_id,
        title: if normalized_title.is_empty() {
            if !completed_task_title.is_empty() {
                completed_task_title.to_string()
            } else {
                linked_todo_title
                    .clone()
                    .unwrap_or_else(|| "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string())
            }
        } else {
            normalized_title.to_string()
        },
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        mode_key: completed_session.mode_key.to_string(),
        mode_label: completed_session.mode_label.to_string(),
        phase_label: completed_session.phase_label.to_string(),
        linked_todo_id: record_linked_todo_id,
        linked_todo_title,
        completed_at,
        completed_date,
        completed_time,
        source: "timer".to_string(),
        time_basis: "completion_day".to_string(),
        edited_at: None,
    };

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        sort_focus_records(&mut records);
        records.clone()
    };

    let todo_items = with_todo_items(&state, |items| {
        if completed_session.complete_linked_todo_on_finish {
            if let Some(linked_todo_id) = record_linked_todo_id {
                if let Some(item) = items.iter_mut().find(|item| item.id == linked_todo_id) {
                    item.is_completed = true;
                }
            }
        }

        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })?;

    if completed_session.complete_linked_todo_on_finish {
        if let Some(linked_todo_id) = record_linked_todo_id {
            clear_focus_plan_reference(&state, linked_todo_id)?;
        }
    }

    state.persist_all()?;

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;
    refresh_system_tray_menu(&timer_snapshot);

    Ok(CompletionPayload {
        timer_snapshot,
        records,
        todo_items,
    })
}
