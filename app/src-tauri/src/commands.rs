use super::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::Emitter;

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
    let original = serde_json::from_str::<AppBackupFile>(&raw)
        .map_err(|error| format!("备份文件格式损坏：{error}"))?;
    let original_format = original.format_version;
    let original_schema = original.schema_version;
    let (backup, migrated_from_format_version) = crate::migrate_backup_file(original)?;
    Ok((
        backup,
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
    let operation = state.read_operation()?;
    let snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;
    drop(operation);
    refresh_system_tray_menu(&snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn get_data_revisions(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<DataRevisions, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    Ok(state.revision_snapshot())
}

#[tauri::command]
pub(crate) fn get_sync_snapshot(
    state: tauri::State<'_, TimerEngineState>,
    domains: Vec<SyncDomain>,
    include_analytics: bool,
) -> Result<SyncSnapshot, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    let has_todos = domains.contains(&SyncDomain::Todos);
    let has_records = domains.contains(&SyncDomain::Records);
    let wants_analytics = include_analytics || domains.contains(&SyncDomain::Analytics);

    let todos = if has_todos || wants_analytics {
        Some(
            state
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?
                .clone(),
        )
    } else {
        None
    };
    let records = if has_records || wants_analytics {
        Some(
            state
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?
                .clone(),
        )
    } else {
        None
    };
    let analytics = if wants_analytics {
        match (&records, &todos) {
            (Some(records), Some(todos)) => Some(analytics_snapshot(records, todos)),
            _ => None,
        }
    } else {
        None
    };
    let app_preferences = if domains.contains(&SyncDomain::AppPreferences) {
        Some(
            state
                .app_preferences
                .lock()
                .map_err(|_| "应用设置状态锁定失败".to_string())?
                .view(),
        )
    } else {
        None
    };
    let timer_preferences = if domains.contains(&SyncDomain::TimerPreferences) {
        Some(
            state
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?
                .snapshot(),
        )
    } else {
        None
    };
    let focus_plan = if domains.contains(&SyncDomain::FocusPlan) {
        Some(
            state
                .focus_plan
                .lock()
                .map_err(|_| "专注计划状态锁定失败".to_string())?
                .clone(),
        )
    } else {
        None
    };

    Ok(SyncSnapshot {
        revisions: state.revision_snapshot(),
        todos: has_todos.then_some(todos).flatten(),
        records: has_records.then_some(records).flatten(),
        analytics,
        app_preferences,
        timer_preferences,
        focus_plan,
    })
}

#[tauri::command]
pub(crate) fn get_timer_sync_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerSyncSnapshot, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    let revisions = state.revision_snapshot();
    let timer = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;
    Ok(TimerSyncSnapshot {
        process_id: revisions.process_id,
        sample_sequence: state.next_timer_sample_sequence(),
        timer_operation_revision: revisions.timer_operation_revision,
        timer,
    })
}

#[tauri::command]
pub(crate) fn get_custom_alert_audio(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<CustomAlertAudio, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    let revisions = state.revision_snapshot();
    let preferences = state
        .app_preferences
        .lock()
        .map_err(|_| "应用设置状态锁定失败".to_string())?;
    Ok(CustomAlertAudio {
        process_id: revisions.process_id,
        revision: revisions.audio_revision,
        name: preferences.custom_alert_sound_name.clone(),
        data: preferences.custom_alert_sound_data.clone(),
    })
}

#[tauri::command]
pub(crate) fn acknowledge_timer_alert(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let snapshot = with_timer_engine(&state, |engine| {
        engine.clear_alert();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn get_timer_preferences(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<TimerPreferencesSnapshot, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    let preferences = *state
        .timer_preferences
        .lock()
        .map_err(|_| "计时设置状态锁定失败".to_string())?;

    Ok(preferences.snapshot())
}

#[tauri::command]
pub(crate) fn update_timer_preferences(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    preferences: TimerPreferences,
) -> Result<RevisionedResult<TimerPreferencesSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
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
    let revisions = transaction
        .commit(RevisionChanges::TIMER_PREFERENCES.with(RevisionChanges::TIMER_OPERATION));
    Ok(revisioned_result(
        &app,
        revisions,
        normalized_preferences.snapshot(),
    ))
}

#[tauri::command]
pub(crate) fn get_app_preferences(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AppPreferencesView, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    state
        .app_preferences
        .lock()
        .map_err(|_| "应用设置状态锁定失败".to_string())
        .map(|preferences| preferences.view())
}

#[tauri::command]
pub(crate) fn update_app_preferences(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    preferences: AppPreferencesPatch,
) -> Result<RevisionedResult<AppPreferencesView>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
    state.ensure_ready()?;
    let normalized = {
        let mut stored = state
            .app_preferences
            .lock()
            .map_err(|_| "应用设置状态锁定失败".to_string())?;
        preferences.apply(&mut stored)?;
        stored.view()
    };
    state.persist()?;
    let revisions = transaction.commit(RevisionChanges::APP_PREFERENCES);
    Ok(revisioned_result(&app, revisions, normalized))
}

#[tauri::command]
pub(crate) fn update_custom_alert_audio(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    name: String,
    data: Option<String>,
) -> Result<RevisionedResult<CustomAlertAudioMetadata>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
    state.ensure_ready()?;
    let (name, data) = {
        let mut stored = state
            .app_preferences
            .lock()
            .map_err(|_| "应用设置状态锁定失败".to_string())?;
        stored.custom_alert_sound_name = name;
        stored.custom_alert_sound_data = data;
        let normalized = stored.clone().normalized()?;
        *stored = normalized;
        (
            stored.custom_alert_sound_name.clone(),
            stored.custom_alert_sound_data.clone(),
        )
    };
    state.persist()?;
    let revisions =
        transaction.commit(RevisionChanges::APP_PREFERENCES.with(RevisionChanges::AUDIO));
    let audio = CustomAlertAudioMetadata {
        process_id: revisions.process_id,
        revision: revisions.audio_revision,
        name,
        has_custom_alert_sound: data.is_some(),
    };
    Ok(revisioned_result(&app, revisions, audio))
}

#[tauri::command]
pub(crate) fn get_focus_plan(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<FocusPlanState, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    state
        .focus_plan
        .lock()
        .map_err(|_| "专注计划状态锁定失败".to_string())
        .map(|plan| plan.clone())
}

#[tauri::command]
pub(crate) fn update_focus_plan(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    current_todo_id: Option<u64>,
    today_pick_ids: Vec<u64>,
) -> Result<RevisionedResult<FocusPlanState>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::FOCUS_PLAN);
    Ok(revisioned_result(&app, revisions, next))
}

#[tauri::command]
pub(crate) fn update_timer_context(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    linked_todo_id: Option<u64>,
    complete_linked_todo_on_finish: bool,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
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
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn switch_timer_mode(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    mode: String,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let next_mode = parse_mode(&mode)?;
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != next_mode && engine.has_unsubmitted_progress() {
            return Err("当前计时还有未提交的进度，请先完成记录或重置后再切换模式。".to_string());
        }
        engine.switch_mode(next_mode);
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn set_countdown_minutes(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    minutes: u64,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let snapshot = with_timer_engine(&state, |engine| {
        if engine.mode != TimerMode::Countdown {
            return Err("请先切换到倒计时模式。".to_string());
        }
        engine.set_countdown_minutes(minutes)?;
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn get_focus_records(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<FocusRecord>, String> {
    let _operation = state.read_operation()?;
    state.ensure_ready()?;
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(records.clone())
}

#[tauri::command]
pub(crate) fn update_focus_record_title(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn create_manual_focus_record(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    duration_minutes: u64,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
        mode_key: "manual".to_string(),
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn update_focus_record(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    duration_minutes: u64,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn delete_focus_record(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn restore_focus_record(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    record: FocusRecord,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn delete_focus_records(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<RevisionedResult<Vec<FocusRecord>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::RECORDS);
    Ok(revisioned_result(&app, revisions, records))
}

#[tauri::command]
pub(crate) fn get_analytics_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AnalyticsSnapshot, String> {
    let _operation = state.read_operation()?;
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
pub(crate) fn clear_app_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RevisionedResult<()>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    state.clear_all()?;
    let revisions = transaction.commit(
        RevisionChanges::RECORDS
            .with(RevisionChanges::TODOS)
            .with(RevisionChanges::TIMER_PREFERENCES)
            .with(RevisionChanges::FOCUS_PLAN)
            .with(RevisionChanges::TIMER_OPERATION),
    );
    Ok(revisioned_result(&app, revisions, ()))
}

#[tauri::command]
pub(crate) fn list_app_backups(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<BackupListItem>, String> {
    let _operation = state.read_operation()?;
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
    let _operation = state.read_operation()?;
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
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    file_name: String,
) -> Result<RevisionedResult<BackupImportResult>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    let store = state.persistence_store()?;

    let backup = store.load_user_backup(&file_name)?;
    let rollback = state.export_backup_file()?;
    let rollback_file_name =
        create_backup_file_name("focused-moment-backup-v3-rollback-before-import-");
    store.save_user_backup(&rollback_file_name, &rollback)?;

    let mut result = state.apply_backup_file_with_options(backup, false)?;
    result.imported_file_name = file_name;
    result.rollback_file_name = rollback_file_name;
    let revisions = transaction.commit(
        RevisionChanges::RECORDS
            .with(RevisionChanges::TODOS)
            .with(RevisionChanges::TIMER_PREFERENCES)
            .with(RevisionChanges::FOCUS_PLAN)
            .with(RevisionChanges::TIMER_OPERATION),
    );
    Ok(revisioned_result(&app, revisions, result))
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
    let _operation = state.read_operation()?;
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
    let serialized = serde_json::to_string_pretty(&backup).map_err(|error| error.to_string())?;
    fs::write(&path, serialized).map_err(|error| format!("写入备份失败：{error}"))?;
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
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    path: String,
    restore_app_preferences: bool,
) -> Result<RevisionedResult<BackupImportResult>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    let previous_audio = {
        let preferences = state
            .app_preferences
            .lock()
            .map_err(|_| "应用设置状态锁定失败".to_string())?;
        (
            preferences.custom_alert_sound_name.clone(),
            preferences.custom_alert_sound_data.clone(),
        )
    };
    let path = external_backup_path(&path)?;
    let (backup, _migrated, _original_format, _original_schema) = read_external_backup(&path)?;
    let store = state.persistence_store()?;
    let rollback = state.export_backup_file()?;
    let rollback_file_name =
        create_backup_file_name("focused-moment-backup-v3-rollback-before-import-");
    store.save_user_backup(&rollback_file_name, &rollback)?;
    let mut result = state.apply_backup_file_with_options(backup, restore_app_preferences)?;
    result.imported_file_name = path.display().to_string();
    result.rollback_file_name = rollback_file_name;
    let current_audio = {
        let preferences = state
            .app_preferences
            .lock()
            .map_err(|_| "应用设置状态锁定失败".to_string())?;
        (
            preferences.custom_alert_sound_name.clone(),
            preferences.custom_alert_sound_data.clone(),
        )
    };
    let mut changes = RevisionChanges::RECORDS
        .with(RevisionChanges::TODOS)
        .with(RevisionChanges::TIMER_PREFERENCES)
        .with(RevisionChanges::FOCUS_PLAN)
        .with(RevisionChanges::TIMER_OPERATION);
    if restore_app_preferences {
        changes = changes.with(RevisionChanges::APP_PREFERENCES);
        if previous_audio != current_audio {
            changes = changes.with(RevisionChanges::AUDIO);
        }
    }
    let revisions = transaction.commit(changes);
    Ok(revisioned_result(&app, revisions, result))
}

#[tauri::command]
pub(crate) fn open_app_backup_folder(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<(), String> {
    let _operation = state.read_operation()?;
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
pub(crate) fn export_recovery_material(
    state: tauri::State<'_, TimerEngineState>,
    path: String,
    blocked_reason: Option<String>,
) -> Result<String, String> {
    let _operation = state.read_operation()?;
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("恢复材料路径不能为空。".to_string());
    }
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("恢复材料必须保存为 JSON 文件。".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建恢复材料目录：{error}"))?;
    }
    let store = state
        .persistence
        .as_ref()
        .ok_or_else(|| "本地存储不可用，无法读取恢复材料。".to_string())?;
    let material = store.recovery_material(blocked_reason)?;
    let serialized = serde_json::to_vec_pretty(&material).map_err(|error| error.to_string())?;
    fs::write(&path, serialized).map_err(|error| format!("写入恢复材料失败：{error}"))?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub(crate) fn get_todo_items(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<TodoItem>, String> {
    let _operation = state.read_operation()?;
    with_todo_items(&state, |items| {
        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })
}

#[tauri::command]
pub(crate) fn create_todo_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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
    let revisions = transaction.commit(RevisionChanges::TODOS);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn update_todo_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
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

    state.persist()?;
    let revisions = transaction.commit(RevisionChanges::TODOS);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn update_todo_continuation_note(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    note: String,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
    let items = update_todo_continuation_note_in_transaction(&state, id, note)?;
    let revisions = transaction.commit(RevisionChanges::TODOS);
    Ok(revisioned_result(&app, revisions, items))
}

fn update_todo_continuation_note_in_transaction(
    state: &tauri::State<'_, TimerEngineState>,
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

#[tauri::command]
pub(crate) fn save_continuation_bookmark(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    todo_id: u64,
    record_id: u64,
    note: String,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
    let todo_is_available = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?
        .iter()
        .any(|todo| todo.id == todo_id && !todo.is_completed);
    if !todo_is_available {
        return Err("关联待办已完成或删除，这条停笔书签已失效。".to_string());
    }
    let notice_is_pending = state
        .pending_bookmark_notices
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .contains(record_id, todo_id);
    if !notice_is_pending {
        return Err("这条停笔书签已失效，请刷新后再试。".to_string());
    }

    let items = update_todo_continuation_note_in_transaction(&state, todo_id, note)?;
    // The operation guard keeps the notice stable between validation and acknowledgement.
    state
        .pending_bookmark_notices
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .acknowledge_for(record_id, todo_id);
    let revisions = transaction.commit(RevisionChanges::TODOS);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn get_pending_bookmark_notices(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<PendingBookmarkNotice>, String> {
    let _operation_guard = state.read_operation()?;
    state.ensure_ready()?;
    let todos = state
        .todo_items
        .lock()
        .map_err(|_| "任务列表状态锁定失败".to_string())?;
    let mut pending = state
        .pending_bookmark_notices
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    Ok(pending.available_for(&todos))
}

#[tauri::command]
pub(crate) fn acknowledge_pending_bookmark_notice(
    state: tauri::State<'_, TimerEngineState>,
    record_id: u64,
) -> Result<(), String> {
    let _operation_guard = state.read_operation()?;
    state.ensure_ready()?;
    state
        .pending_bookmark_notices
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .acknowledge(record_id);
    Ok(())
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

#[tauri::command]
pub(crate) fn toggle_todo_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    let timer_was_linked =
        with_timer_engine(&state, |engine| Ok(engine.linked_todo_id == Some(id)))?;
    let focus_plan_was_linked = {
        let plan = state
            .focus_plan
            .lock()
            .map_err(|_| "专注计划状态锁定失败".to_string())?;
        plan.current_todo_id == Some(id) || plan.today_pick_ids.contains(&id)
    };
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
            engine.clear_todo_link(id);
            Ok(())
        })?;
        state.persist_all()?;
    } else {
        state.persist()?;
    }
    let mut changes = RevisionChanges::TODOS;
    if should_clear_timer_link && timer_was_linked {
        changes = changes.with(RevisionChanges::TIMER_OPERATION);
    }
    if should_clear_timer_link && focus_plan_was_linked {
        changes = changes.with(RevisionChanges::FOCUS_PLAN);
    }
    let revisions = transaction.commit(changes);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn delete_todo_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    let timer_was_linked =
        with_timer_engine(&state, |engine| Ok(engine.linked_todo_id == Some(id)))?;
    let focus_plan_was_linked = {
        let plan = state
            .focus_plan
            .lock()
            .map_err(|_| "专注计划状态锁定失败".to_string())?;
        plan.current_todo_id == Some(id) || plan.today_pick_ids.contains(&id)
    };
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
        engine.clear_todo_link(id);
        Ok(())
    })?;
    clear_focus_plan_reference(&state, id)?;
    state.persist_all()?;
    let mut changes = RevisionChanges::TODOS;
    if timer_was_linked {
        changes = changes.with(RevisionChanges::TIMER_OPERATION);
    }
    if focus_plan_was_linked {
        changes = changes.with(RevisionChanges::FOCUS_PLAN);
    }
    let revisions = transaction.commit(changes);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn restore_todo_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    item: TodoItem,
) -> Result<RevisionedResult<Vec<TodoItem>>, String> {
    let transaction = state.begin_transaction(OperationScope::State)?;
    let normalized_item = TodoItem {
        id: item.id,
        title: normalize_todo_title(&item.title)?,
        is_completed: item.is_completed,
        scheduled_date: normalize_scheduled_date(&item.scheduled_date)?,
        scheduled_time: normalize_scheduled_time(&item.scheduled_time)?,
        importance_key: normalize_importance_key(&item.importance_key)?,
        continuation_note: normalize_continuation_note(&item.continuation_note)?,
        continuation_updated_at: item.continuation_updated_at.clone(),
    };
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
    let revisions = transaction.commit(RevisionChanges::TODOS);
    Ok(revisioned_result(&app, revisions, items))
}

#[tauri::command]
pub(crate) fn start_timer(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let snapshot = with_timer_engine(&state, |engine| {
        engine.start();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn pause_timer(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let snapshot = with_timer_engine(&state, |engine| {
        engine.pause();
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn reset_timer(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    session_id: String,
) -> Result<RevisionedResult<TimerSnapshot>, String> {
    let transaction = state.begin_transaction(OperationScope::Runtime)?;
    let snapshot = with_timer_engine(&state, |engine| {
        engine.reset_for_session(&session_id)?;
        Ok(engine.snapshot())
    })?;
    state.persist_runtime()?;
    let revisions = transaction.commit(RevisionChanges::TIMER_OPERATION);
    refresh_system_tray_menu(&snapshot);
    Ok(revisioned_result(&app, revisions, snapshot))
}

#[tauri::command]
pub(crate) fn complete_focus_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, TimerEngineState>,
    title: String,
) -> Result<RevisionedResult<CompletionPayload>, String> {
    let transaction = state.begin_transaction(OperationScope::All)?;
    let completed_session = with_timer_engine(&state, |engine| engine.complete_focus_session())?;
    let (completed_at, completed_date, completed_time) = current_local_markers();
    let record_linked_todo_id = completed_session.linked_todo_id;
    let mut todo_completed = false;
    let mut focus_plan_reference_cleared = false;

    let linked_todo_title = match record_linked_todo_id {
        Some(id) => {
            let items = state.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;

            items
                .iter()
                .find(|item| item.id == id)
                .map(|item| item.title.clone())
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
                    if !item.is_completed {
                        item.is_completed = true;
                        todo_completed = true;
                    }
                }
            }
        }

        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })?;

    let pending_bookmark_notice = record_linked_todo_id.and_then(|todo_id| {
        todo_items
            .iter()
            .find(|item| item.id == todo_id && !item.is_completed)
            .map(|item| PendingBookmarkNotice {
                record_id: next_id,
                todo_id,
                title: item.title.clone(),
            })
    });

    if completed_session.complete_linked_todo_on_finish {
        if let Some(linked_todo_id) = record_linked_todo_id {
            focus_plan_reference_cleared = {
                let plan = state
                    .focus_plan
                    .lock()
                    .map_err(|_| "专注计划状态锁定失败".to_string())?;
                plan.current_todo_id == Some(linked_todo_id)
                    || plan.today_pick_ids.contains(&linked_todo_id)
            };
            clear_focus_plan_reference(&state, linked_todo_id)?;
        }
    }

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;
    state.persist_all()?;
    let queued_bookmark_notice = pending_bookmark_notice
        .map(|notice| {
            state
                .pending_bookmark_notices
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .enqueue(notice)
        })
        .unwrap_or(false);
    let mut changes = RevisionChanges::RECORDS.with(RevisionChanges::TIMER_OPERATION);
    if todo_completed {
        changes = changes.with(RevisionChanges::TODOS);
    }
    if focus_plan_reference_cleared {
        changes = changes.with(RevisionChanges::FOCUS_PLAN);
    }
    let revisions = transaction.commit(changes);
    refresh_system_tray_menu(&timer_snapshot);
    if queued_bookmark_notice {
        if let Err(error) = app.emit_to("main", PENDING_BOOKMARK_NOTICE_EVENT, ()) {
            eprintln!("FOCUSED_MOMENT_BOOKMARK_NOTICE_EVENT_FAILED={error}");
        }
    }

    Ok(revisioned_result(
        &app,
        revisions,
        CompletionPayload {
            timer_snapshot,
            records,
            todo_items,
        },
    ))
}
