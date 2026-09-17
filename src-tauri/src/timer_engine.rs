use super::*;

#[derive(Clone, Copy)]
pub(crate) struct RunAnchor {
    pub(crate) monotonic: Instant,
    pub(crate) wall_clock: SystemTime,
}

pub(crate) struct TimerEngineState {
    pub(crate) timer: Mutex<TimerEngine>,
    pub(crate) timer_preferences: Mutex<TimerPreferences>,
    pub(crate) focus_records: Mutex<Vec<FocusRecord>>,
    pub(crate) next_record_id: Mutex<u64>,
    pub(crate) todo_items: Mutex<Vec<TodoItem>>,
    pub(crate) next_todo_id: Mutex<u64>,
    pub(crate) persistence: Option<PersistenceStore>,
    pub(crate) startup_error: Option<String>,
}

pub(crate) struct PersistedBundle {
    pub(crate) state: PersistedState,
    pub(crate) runtime: PersistedRuntimeState,
}

#[derive(Default)]
pub(crate) struct TimerEngine {
    pub(crate) mode: TimerMode,
    pub(crate) running_anchor: Option<RunAnchor>,
    pub(crate) stopwatch_elapsed_ms: u64,
    pub(crate) countdown_elapsed_ms: u64,
    pub(crate) countdown_duration_ms: u64,
    pub(crate) countdown_completed_alerted: bool,
    pub(crate) pomodoro_elapsed_ms: u64,
    pub(crate) pomodoro_phase: PomodoroPhase,
    pub(crate) pending_pomodoro_record_ms: Option<u64>,
    pub(crate) current_task_title: String,
    pub(crate) linked_todo_id: Option<u64>,
    pub(crate) complete_linked_todo_on_finish: bool,
    pub(crate) completed_focus_count: u64,
    pub(crate) completed_break_count: u64,
    pub(crate) recovered_from_last_session: bool,
    pub(crate) pomodoro_focus_ms: u64,
    pub(crate) pomodoro_break_ms: u64,
    pub(crate) stopwatch_reminder_ms: Option<u64>,
    pub(crate) stopwatch_stage_index: usize,
    pub(crate) alert_sequence: u64,
    pub(crate) active_alert_kind: Option<AlertKind>,
}

pub(crate) struct CompletedSession {
    pub(crate) duration_ms: u64,
    pub(crate) mode_key: &'static str,
    pub(crate) mode_label: &'static str,
    pub(crate) phase_label: &'static str,
    pub(crate) task_title: String,
    pub(crate) linked_todo_id: Option<u64>,
    pub(crate) complete_linked_todo_on_finish: bool,
}

impl TimerEngineState {
    pub(crate) fn new() -> Self {
        let mut startup_error = None;
        let persistence = match PersistenceStore::new() {
            Ok(store) => Some(store),
            Err(error) => {
                let message = format!(
                    "本地数据未加载：无法准备存储目录（{error}）。应用已进入恢复保护状态；请检查目录权限后重启。"
                );
                eprintln!("{message}");
                startup_error = Some(message);
                None
            }
        };

        let (persisted, persisted_runtime) = match persistence.as_ref() {
            Some(store) => match (store.load(), store.load_runtime()) {
                (Ok(state), Ok(runtime)) => (state, runtime),
                (Err(error), _) => {
                    let message = format!(
                        "本地数据未加载：状态文件读取失败（{error}）。为避免覆盖有效数据，应用已进入恢复保护状态；请修复数据或备份后重启。"
                    );
                    eprintln!("{message}");
                    startup_error = Some(message);
                    (PersistedState::default(), PersistedRuntimeState::default())
                }
                (_, Err(error)) => {
                    let message = format!(
                        "本地数据未加载：运行态文件读取失败（{error}）。为避免覆盖有效数据，应用已进入恢复保护状态；请修复数据或备份后重启。"
                    );
                    eprintln!("{message}");
                    startup_error = Some(message);
                    (PersistedState::default(), PersistedRuntimeState::default())
                }
            },
            None => (PersistedState::default(), PersistedRuntimeState::default()),
        };
        let should_migrate_persisted_storage = startup_error.is_none()
            && (persisted.schema_version < CURRENT_STORAGE_SCHEMA_VERSION
                || persisted_runtime.schema_version < CURRENT_STORAGE_SCHEMA_VERSION);

        let PersistedState {
            schema_version: _,
            mut focus_records,
            next_record_id,
            mut todo_items,
            next_todo_id,
            timer_preferences,
        } = persisted;

        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);

        let normalized_preferences = timer_preferences
            .normalized()
            .unwrap_or_else(|_| TimerPreferences::default());
        let mut timer =
            TimerEngine::from_persisted_runtime(persisted_runtime, normalized_preferences);
        if let Some(linked_todo_id) = timer.linked_todo_id {
            if !todo_items.iter().any(|item| item.id == linked_todo_id) {
                timer.linked_todo_id = None;
            }
        }

        let mut state = Self {
            timer: Mutex::new(timer),
            timer_preferences: Mutex::new(normalized_preferences),
            next_record_id: Mutex::new(next_record_id.max(next_focus_record_id(&focus_records))),
            focus_records: Mutex::new(focus_records),
            next_todo_id: Mutex::new(next_todo_id.max(next_todo_id_value(&todo_items))),
            todo_items: Mutex::new(todo_items),
            persistence,
            startup_error,
        };

        if should_migrate_persisted_storage {
            if let Err(error) = state.persist_all() {
                let message = format!(
                    "本地数据升级未完成：{error}。为避免覆盖有效数据，应用已进入恢复保护状态；请重启后重试。"
                );
                eprintln!("{message}");
                state.startup_error = Some(message);
            }
        }

        state
    }

    pub(crate) fn ensure_ready(&self) -> Result<(), String> {
        match &self.startup_error {
            Some(error) => Err(error.clone()),
            None => Ok(()),
        }
    }

    pub(crate) fn persistence_store(&self) -> Result<&PersistenceStore, String> {
        self.ensure_ready()?;
        self.persistence
            .as_ref()
            .ok_or_else(|| "本地数据存储不可用，应用已进入恢复保护状态；请重启后重试。".to_string())
    }

    pub(crate) fn snapshot_state(&self) -> Result<PersistedState, String> {
        Ok(PersistedState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            focus_records: self
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?
                .clone(),
            next_record_id: *self
                .next_record_id
                .lock()
                .map_err(|_| "记录编号状态锁定失败".to_string())?,
            todo_items: self
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?
                .clone(),
            next_todo_id: *self
                .next_todo_id
                .lock()
                .map_err(|_| "任务编号状态锁定失败".to_string())?,
            timer_preferences: *self
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?,
        })
    }

    pub(crate) fn snapshot_runtime_state(&self) -> Result<PersistedRuntimeState, String> {
        let persisted = self
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?
            .persisted_runtime_state();
        Ok(persisted)
    }

    pub(crate) fn export_backup_file(&self) -> Result<AppBackupFile, String> {
        Ok(AppBackupFile {
            kind: APP_BACKUP_KIND.to_string(),
            format_version: APP_BACKUP_FORMAT_VERSION,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: APP_VERSION.to_string(),
            exported_at: Local::now().to_rfc3339(),
            state: self.snapshot_state()?,
            runtime: self.snapshot_runtime_state()?,
        })
    }

    pub(crate) fn snapshot_bundle(&self) -> Result<PersistedBundle, String> {
        Ok(PersistedBundle {
            state: self.snapshot_state()?,
            runtime: self.snapshot_runtime_state()?,
        })
    }

    pub(crate) fn restore_state_snapshot(&self, snapshot: &PersistedState) -> Result<(), String> {
        let normalized_preferences = snapshot
            .timer_preferences
            .normalized()
            .map_err(|_| "无法回退：计时设置快照不合法。".to_string())?;

        {
            let mut timer = self
                .timer
                .lock()
                .map_err(|_| "计时引擎状态锁定失败".to_string())?;
            timer.apply_preferences(normalized_preferences);
        }
        {
            let mut preferences = self
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?;
            *preferences = normalized_preferences;
        }
        {
            let mut records = self
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?;
            *records = snapshot.focus_records.clone();
        }
        {
            let mut next_record_id = self
                .next_record_id
                .lock()
                .map_err(|_| "记录编号状态锁定失败".to_string())?;
            *next_record_id = snapshot
                .next_record_id
                .max(next_focus_record_id(&snapshot.focus_records));
        }
        {
            let mut items = self
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?;
            *items = snapshot.todo_items.clone();
        }
        {
            let mut next_todo_id = self
                .next_todo_id
                .lock()
                .map_err(|_| "任务编号状态锁定失败".to_string())?;
            *next_todo_id = snapshot
                .next_todo_id
                .max(next_todo_id_value(&snapshot.todo_items));
        }

        Ok(())
    }

    pub(crate) fn restore_runtime_snapshot(
        &self,
        snapshot: &PersistedRuntimeState,
    ) -> Result<(), String> {
        let preferences = *self
            .timer_preferences
            .lock()
            .map_err(|_| "计时设置状态锁定失败".to_string())?;
        let mut timer = self
            .timer
            .lock()
            .map_err(|_| "计时引擎状态锁定失败".to_string())?;
        *timer = TimerEngine::from_persisted_runtime(snapshot.clone(), preferences);
        Ok(())
    }

    pub(crate) fn restore_bundle(&self, snapshot: &PersistedBundle) -> Result<(), String> {
        self.restore_state_snapshot(&snapshot.state)?;
        self.restore_runtime_snapshot(&snapshot.runtime)
    }

    pub(crate) fn format_persistence_failure(
        action: &str,
        error: String,
        rollback_errors: Vec<String>,
    ) -> String {
        if rollback_errors.is_empty() {
            format!("{action}失败：{error}。内存状态已回退，未报告虚假成功，请重试。")
        } else {
            format!(
                "{action}失败：{error}。自动回退也未完全成功：{}；请立即重启应用并使用有效备份恢复。",
                rollback_errors.join("；")
            )
        }
    }

    pub(crate) fn apply_backup_file(
        &self,
        backup: AppBackupFile,
    ) -> Result<BackupImportResult, String> {
        let (backup, migrated_from_format_version) = migrate_backup_file(backup)?;
        let AppBackupFile {
            kind,
            format_version: _,
            schema_version: _,
            app_version: _,
            exported_at: _,
            state,
            runtime,
        } = backup;

        debug_assert_eq!(kind, APP_BACKUP_KIND);

        let normalized_preferences = state
            .timer_preferences
            .normalized()
            .map_err(|_| "备份中的计时设置不合法，无法恢复。".to_string())?;
        let mut focus_records = state.focus_records;
        let mut todo_items = state.todo_items;
        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);
        let mut normalized_runtime =
            normalize_imported_runtime(runtime, &todo_items, normalized_preferences);

        {
            let mut timer = self
                .timer
                .lock()
                .map_err(|_| "计时引擎状态锁定失败".to_string())?;
            *timer = TimerEngine::from_persisted_runtime(
                normalized_runtime.clone(),
                normalized_preferences,
            );
            normalized_runtime = timer.persisted_runtime_state();
        }

        {
            let mut preferences = self
                .timer_preferences
                .lock()
                .map_err(|_| "计时设置状态锁定失败".to_string())?;
            *preferences = normalized_preferences;
        }

        {
            let mut records = self
                .focus_records
                .lock()
                .map_err(|_| "记录列表状态锁定失败".to_string())?;
            *records = focus_records.clone();
        }

        {
            let mut next_record_id = self
                .next_record_id
                .lock()
                .map_err(|_| "记录编号状态锁定失败".to_string())?;
            *next_record_id = state
                .next_record_id
                .max(next_focus_record_id(&focus_records));
        }

        {
            let mut items = self
                .todo_items
                .lock()
                .map_err(|_| "任务列表状态锁定失败".to_string())?;
            *items = todo_items.clone();
        }

        {
            let mut next_todo_id = self
                .next_todo_id
                .lock()
                .map_err(|_| "任务编号状态锁定失败".to_string())?;
            *next_todo_id = state.next_todo_id.max(next_todo_id_value(&todo_items));
        }

        self.persist_all()?;

        Ok(BackupImportResult {
            imported_file_name: String::new(),
            rollback_file_name: String::new(),
            focus_record_count: focus_records.len(),
            todo_count: todo_items.len(),
            restored_runtime_session: normalized_runtime.is_running
                || normalized_runtime.stopwatch_elapsed_ms > 0
                || normalized_runtime.countdown_elapsed_ms > 0
                || normalized_runtime.pomodoro_elapsed_ms > 0
                || normalized_runtime.pending_pomodoro_record_ms.is_some()
                || !normalized_runtime.current_task_title.trim().is_empty()
                || normalized_runtime.linked_todo_id.is_some(),
            migrated_from_format_version,
        })
    }

    pub(crate) fn persist(&self) -> Result<(), String> {
        let store = self.persistence_store()?;
        let previous = store.load()?;
        let persisted = self.snapshot_state()?;

        if let Err(error) = store.save(&persisted) {
            let rollback_errors = self
                .restore_state_snapshot(&previous)
                .err()
                .into_iter()
                .collect();
            return Err(Self::format_persistence_failure(
                "保存本地状态",
                error,
                rollback_errors,
            ));
        }

        Ok(())
    }

    pub(crate) fn persist_runtime(&self) -> Result<(), String> {
        let store = self.persistence_store()?;
        let previous = store.load_runtime()?;
        let persisted = self.snapshot_runtime_state()?;

        if let Err(error) = store.save_runtime(&persisted) {
            let rollback_errors = self
                .restore_runtime_snapshot(&previous)
                .err()
                .into_iter()
                .collect();
            return Err(Self::format_persistence_failure(
                "保存本地运行态",
                error,
                rollback_errors,
            ));
        }

        Ok(())
    }

    pub(crate) fn persist_all(&self) -> Result<(), String> {
        let store = self.persistence_store()?;
        let previous = PersistedBundle {
            state: store.load()?,
            runtime: store.load_runtime()?,
        };
        let current = self.snapshot_bundle()?;

        if let Err(error) = store.save(&current.state) {
            let rollback_errors = self.restore_bundle(&previous).err().into_iter().collect();
            return Err(Self::format_persistence_failure(
                "保存本地状态与运行态",
                error,
                rollback_errors,
            ));
        }

        if let Err(error) = store.save_runtime(&current.runtime) {
            let mut rollback_errors = Vec::new();
            if let Err(rollback_error) = store.save(&previous.state) {
                rollback_errors.push(format!("磁盘状态回退失败：{rollback_error}"));
            }
            if let Err(rollback_error) = store.save_runtime(&previous.runtime) {
                rollback_errors.push(format!("磁盘运行态回退失败：{rollback_error}"));
            }
            if let Err(rollback_error) = self.restore_bundle(&previous) {
                rollback_errors.push(format!("内存状态回退失败：{rollback_error}"));
            }
            return Err(Self::format_persistence_failure(
                "保存本地状态与运行态",
                error,
                rollback_errors,
            ));
        }

        Ok(())
    }

    pub(crate) fn clear_all(&self) -> Result<(), String> {
        self.ensure_ready()?;
        {
            let mut timer = self.timer.lock().map_err(|_| {
                "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            timer.reset();
            timer.mode = TimerMode::Stopwatch;
        }

        {
            let mut records = self.focus_records.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            records.clear();
        }

        {
            let mut next_record_id = self.next_record_id.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_record_id = 0;
        }

        {
            let mut items = self.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            items.clear();
        }

        {
            let mut next_todo_id = self.next_todo_id.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_todo_id = 0;
        }

        {
            let mut preferences = self.timer_preferences.lock().map_err(|_| {
                "\u{8ba1}\u{65f6}\u{8bbe}\u{7f6e}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *preferences = TimerPreferences::default();
        }

        self.persist_all()
    }
}

impl TimerEngine {
    pub(crate) fn from_persisted_runtime(
        runtime: PersistedRuntimeState,
        preferences: TimerPreferences,
    ) -> Self {
        let mode = parse_mode_key_value(&runtime.mode_key).unwrap_or_default();
        let pomodoro_phase = parse_phase_key_value(&runtime.pomodoro_phase_key).unwrap_or_default();
        let has_task_title = !runtime.current_task_title.trim().is_empty();
        let stopwatch_stage_index = runtime
            .stopwatch_stage_index
            .max(stopwatch_stage_index_for_elapsed(
                runtime.stopwatch_elapsed_ms,
            ))
            .min(STOPWATCH_STAGE_MINUTES.len());
        let active_alert_kind = runtime
            .active_alert_key
            .as_deref()
            .and_then(parse_alert_key_value);
        let active_alert_kind = match active_alert_kind {
            Some(AlertKind::StopwatchTargetReached) if stopwatch_stage_index == 0 => None,
            other => other,
        };
        let anchor = runtime.anchor_wall_clock_ms.and_then(|milliseconds| {
            if runtime.is_running {
                Some(Self::anchor_from_wall_clock_ms(milliseconds))
            } else {
                None
            }
        });
        let countdown_duration_ms = normalize_countdown_duration_ms(runtime.countdown_duration_ms);

        Self {
            mode,
            running_anchor: anchor,
            stopwatch_elapsed_ms: runtime.stopwatch_elapsed_ms,
            countdown_elapsed_ms: runtime.countdown_elapsed_ms.min(countdown_duration_ms),
            countdown_duration_ms,
            countdown_completed_alerted: matches!(
                runtime.active_alert_key.as_deref(),
                Some("countdown_complete")
            ),
            pomodoro_elapsed_ms: runtime.pomodoro_elapsed_ms,
            pomodoro_phase,
            pending_pomodoro_record_ms: runtime.pending_pomodoro_record_ms,
            current_task_title: runtime.current_task_title,
            linked_todo_id: runtime.linked_todo_id,
            complete_linked_todo_on_finish: runtime.complete_linked_todo_on_finish,
            completed_focus_count: runtime.completed_focus_count,
            completed_break_count: runtime.completed_break_count,
            pomodoro_focus_ms: preferences.pomodoro_focus_ms(),
            pomodoro_break_ms: preferences.pomodoro_break_ms(),
            stopwatch_reminder_ms: preferences.stopwatch_reminder_ms(),
            stopwatch_stage_index,
            alert_sequence: runtime.alert_sequence,
            active_alert_kind,
            recovered_from_last_session: runtime.is_running
                || runtime.stopwatch_elapsed_ms > 0
                || runtime.countdown_elapsed_ms > 0
                || runtime.pomodoro_elapsed_ms > 0
                || runtime.pending_pomodoro_record_ms.is_some()
                || has_task_title
                || runtime.linked_todo_id.is_some(),
        }
    }

    pub(crate) fn persisted_runtime_state(&mut self) -> PersistedRuntimeState {
        self.sync_running_time();
        PersistedRuntimeState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            mode_key: self.mode.key().to_string(),
            stopwatch_elapsed_ms: self.stopwatch_elapsed_ms,
            countdown_elapsed_ms: self.countdown_elapsed_ms,
            countdown_duration_ms: self.countdown_duration_ms,
            pomodoro_elapsed_ms: self.pomodoro_elapsed_ms,
            pomodoro_phase_key: self.pomodoro_phase.key().to_string(),
            pending_pomodoro_record_ms: self.pending_pomodoro_record_ms,
            is_running: self.running_anchor.is_some(),
            anchor_wall_clock_ms: self
                .running_anchor
                .map(|anchor| system_time_to_epoch_ms(anchor.wall_clock)),
            current_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            alert_sequence: self.alert_sequence,
            active_alert_key: self.active_alert_kind.map(|kind| kind.key().to_string()),
            stopwatch_target_alerted: self.stopwatch_stage_index > 0,
            stopwatch_stage_index: self.stopwatch_stage_index,
        }
    }

    pub(crate) fn apply_preferences(&mut self, preferences: TimerPreferences) {
        self.pomodoro_focus_ms = preferences.pomodoro_focus_ms();
        self.pomodoro_break_ms = preferences.pomodoro_break_ms();
        self.stopwatch_reminder_ms = preferences.stopwatch_reminder_ms();
        if self.stopwatch_reminder_ms.is_none() {
            if self.active_alert_kind == Some(AlertKind::StopwatchTargetReached) {
                self.clear_alert();
            }
        } else if self.mode == TimerMode::Stopwatch {
            if self.active_alert_kind == Some(AlertKind::StopwatchTargetReached)
                && self.stopwatch_stage_index == 0
            {
                self.clear_alert();
            }
            let reached_stage_index = stopwatch_stage_index_for_elapsed(self.stopwatch_elapsed_ms);
            if reached_stage_index > self.stopwatch_stage_index {
                self.stopwatch_stage_index = reached_stage_index;
                self.mark_alert(AlertKind::StopwatchTargetReached);
            }
        }
    }

    pub(crate) fn update_context(
        &mut self,
        title: String,
        linked_todo_id: Option<u64>,
        complete_linked_todo_on_finish: bool,
    ) {
        self.current_task_title = title;
        self.linked_todo_id = linked_todo_id;
        self.complete_linked_todo_on_finish = complete_linked_todo_on_finish;
    }

    pub(crate) fn clear_context(&mut self) {
        self.current_task_title.clear();
        self.linked_todo_id = None;
        self.complete_linked_todo_on_finish = false;
    }

    pub(crate) fn clear_recovery_flag(&mut self) {
        self.recovered_from_last_session = false;
    }

    pub(crate) fn clear_alert(&mut self) {
        self.active_alert_kind = None;
    }

    pub(crate) fn stopwatch_alert_message(&self) -> String {
        let completed_stage_index = self.stopwatch_stage_index.saturating_sub(1);
        let completed_minutes = STOPWATCH_STAGE_MINUTES
            .get(completed_stage_index)
            .copied()
            .unwrap_or(DEFAULT_STOPWATCH_REMINDER_MINUTES);
        match STOPWATCH_STAGE_MINUTES.get(self.stopwatch_stage_index) {
            Some(next_minutes) => format!(
                "已达到第 {} 个阶段性目标：累计专注 {} 分钟。下一目标是 {} 分钟。",
                completed_stage_index + 1,
                completed_minutes,
                next_minutes
            ),
            None => format!(
                "已完成全部阶段性目标：累计专注 {} 分钟。计时仍会继续。",
                completed_minutes
            ),
        }
    }

    pub(crate) fn mark_alert(&mut self, alert_kind: AlertKind) {
        self.alert_sequence = self.alert_sequence.saturating_add(1);
        self.active_alert_kind = Some(alert_kind);
    }

    pub(crate) fn current_round(&self) -> u64 {
        match self.mode {
            TimerMode::Stopwatch => 1,
            TimerMode::Countdown => 1,
            TimerMode::Pomodoro => match self.pomodoro_phase {
                PomodoroPhase::Focus => self.completed_focus_count + 1,
                PomodoroPhase::Break => self.completed_focus_count.max(1),
            },
        }
    }

    pub(crate) fn has_unsubmitted_progress(&self) -> bool {
        self.running_anchor.is_some()
            || self.stopwatch_elapsed_ms > 0
            || self.countdown_elapsed_ms > 0
            || self.pomodoro_elapsed_ms > 0
            || self.pending_pomodoro_record_ms.is_some()
            || self.completed_focus_count > 0
            || self.completed_break_count > 0
    }

    pub(crate) fn mode_switch_hint(&self) -> Option<String> {
        if self.has_unsubmitted_progress() {
            Some("当前这轮专注还有未提交进度，请先完成记录或重置后再切换模式。".to_string())
        } else {
            None
        }
    }

    pub(crate) fn start(&mut self) {
        if self.running_anchor.is_none() {
            self.running_anchor = Some(Self::new_anchor());
        }
        self.clear_recovery_flag();
    }

    pub(crate) fn pause(&mut self) {
        self.sync_running_time();
        self.running_anchor = None;
        self.clear_recovery_flag();
    }

    pub(crate) fn reset(&mut self) {
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;
        self.clear_context();
        self.completed_focus_count = 0;
        self.completed_break_count = 0;
        self.stopwatch_stage_index = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        self.clear_recovery_flag();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Countdown => self.countdown_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    pub(crate) fn switch_mode(&mut self, mode: TimerMode) {
        if self.mode == mode {
            return;
        }

        self.mode = mode;
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;
        self.clear_context();
        self.completed_focus_count = 0;
        self.completed_break_count = 0;
        self.stopwatch_stage_index = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        self.clear_recovery_flag();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Countdown => self.countdown_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    pub(crate) fn set_countdown_minutes(&mut self, minutes: u64) -> Result<(), String> {
        if self.has_unsubmitted_progress() {
            return Err("当前计时还有未提交的进度，请先完成记录或重置后再调整倒计时。".to_string());
        }

        if !(MIN_COUNTDOWN_MINUTES..=MAX_COUNTDOWN_MINUTES).contains(&minutes) {
            return Err("倒计时时长需要在 1 到 720 分钟之间。".to_string());
        }

        self.countdown_duration_ms = minutes.saturating_mul(60_000);
        self.countdown_elapsed_ms = 0;
        self.countdown_completed_alerted = false;
        self.clear_alert();
        Ok(())
    }

    pub(crate) fn complete_focus_session(&mut self) -> Result<CompletedSession, String> {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => {
                let elapsed_ms = self.stopwatch_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.stopwatch_elapsed_ms = 0;
                self.running_anchor = None;
                self.clear_context();
                self.stopwatch_stage_index = 0;
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "stopwatch",
                    mode_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
            TimerMode::Countdown => {
                let elapsed_ms = self.countdown_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("当前倒计时还没有累计时间".to_string());
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.countdown_elapsed_ms = 0;
                self.running_anchor = None;
                self.clear_context();
                self.countdown_completed_alerted = false;
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "countdown",
                    mode_label: "倒计时",
                    phase_label: "倒计时",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
            TimerMode::Pomodoro => {
                if let Some(elapsed_ms) = self.pending_pomodoro_record_ms.take() {
                    self.clear_alert();
                    return Ok(CompletedSession {
                        duration_ms: elapsed_ms,
                        mode_key: "pomodoro",
                        mode_label: "\u{756a}\u{8304}\u{949f}",
                        phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                        task_title: self.current_task_title.clone(),
                        linked_todo_id: self.linked_todo_id,
                        complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
                    });
                }

                if self.pomodoro_phase != PomodoroPhase::Focus {
                    return Err(
                        "\u{5f53}\u{524d}\u{5904}\u{4e8e}\u{4f11}\u{606f}\u{9636}\u{6bb5}\u{ff0c}\u{6ca1}\u{6709}\u{53ef}\u{8bb0}\u{5f55}\u{7684}\u{4e13}\u{6ce8}\u{8f6e}\u{6b21}"
                            .to_string(),
                    );
                }

                let elapsed_ms = self.pomodoro_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err(
                        "\u{5f53}\u{524d}\u{756a}\u{8304}\u{4e13}\u{6ce8}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}"
                            .to_string(),
                    );
                }

                let task_title = self.current_task_title.clone();
                let linked_todo_id = self.linked_todo_id;
                let complete_linked_todo_on_finish = self.complete_linked_todo_on_finish;
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Break;
                self.running_anchor = None;
                self.completed_focus_count = self.completed_focus_count.saturating_add(1);
                self.clear_context();
                self.clear_alert();
                self.clear_recovery_flag();

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "pomodoro",
                    mode_label: "\u{756a}\u{8304}\u{949f}",
                    phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                    task_title,
                    linked_todo_id,
                    complete_linked_todo_on_finish,
                })
            }
        }
    }

    pub(crate) fn snapshot(&mut self) -> TimerSnapshot {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_snapshot(),
            TimerMode::Countdown => self.countdown_snapshot(),
            TimerMode::Pomodoro => self.pomodoro_snapshot(),
        }
    }

    pub(crate) fn stopwatch_snapshot(&self) -> TimerSnapshot {
        let elapsed_ms = self.stopwatch_elapsed_ms;
        let status = if self.running_anchor.is_some() {
            "\u{8ba1}\u{65f6}\u{4e2d}"
        } else if elapsed_ms == 0 {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "stopwatch",
            phase_key: "stopwatch",
            mode: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(elapsed_ms),
            target_duration_ms: if self.stopwatch_reminder_ms.is_some() {
                stopwatch_next_target_ms(self.stopwatch_stage_index)
            } else {
                None
            },
            remaining_ms: None,
            secondary_label: "\u{5df2}\u{7d2f}\u{8ba1}\u{4e13}\u{6ce8}\u{65f6}\u{957f}",
            can_complete_session: true,
            has_unsubmitted_progress: self.has_unsubmitted_progress(),
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| match kind {
                AlertKind::StopwatchTargetReached => self.stopwatch_alert_message(),
                _ => kind.message(self.active_preferences()),
            }),
        }
    }

    pub(crate) fn countdown_snapshot(&self) -> TimerSnapshot {
        let duration_ms = self.countdown_duration_ms;
        let elapsed_ms = self.countdown_elapsed_ms.min(duration_ms);
        let remaining_ms = duration_ms.saturating_sub(elapsed_ms);
        let status = if self.running_anchor.is_some() {
            "倒计时中"
        } else if elapsed_ms == 0 {
            "未开始"
        } else if remaining_ms == 0 {
            "已结束"
        } else {
            "已暂停"
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "countdown",
            phase_key: "countdown",
            mode: "倒计时",
            phase_label: "倒计时",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            target_duration_ms: Some(duration_ms),
            remaining_ms: Some(remaining_ms),
            secondary_label: "本轮剩余时间",
            can_complete_session: true,
            has_unsubmitted_progress: self.has_unsubmitted_progress(),
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| match kind {
                AlertKind::CountdownComplete => format!(
                    "倒计时已完成，已累计专注 {} 分钟。点击“保存并记录”后写入专注记录。",
                    duration_ms / 60_000
                ),
                _ => kind.message(self.active_preferences()),
            }),
        }
    }

    pub(crate) fn pomodoro_snapshot(&self) -> TimerSnapshot {
        let duration_ms = self.current_pomodoro_duration_ms();
        let elapsed_ms = self.pomodoro_elapsed_ms.min(duration_ms);
        let remaining_ms = duration_ms.saturating_sub(elapsed_ms);
        let status = if self.running_anchor.is_some() {
            match self.pomodoro_phase {
                PomodoroPhase::Focus => "\u{4e13}\u{6ce8}\u{4e2d}",
                PomodoroPhase::Break => "\u{4f11}\u{606f}\u{4e2d}",
            }
        } else if elapsed_ms == 0 && self.pomodoro_phase == PomodoroPhase::Focus {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        let phase_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
            PomodoroPhase::Break => "\u{77ed}\u{4f11}\u{606f}",
        };

        let secondary_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{672c}\u{8f6e}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
            PomodoroPhase::Break => "\u{4f11}\u{606f}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
        };

        let active_alert_kind = self.active_alert_kind;
        let mode_switch_hint = self.mode_switch_hint();
        TimerSnapshot {
            mode_key: "pomodoro",
            phase_key: match self.pomodoro_phase {
                PomodoroPhase::Focus => "focus",
                PomodoroPhase::Break => "break",
            },
            mode: "\u{756a}\u{8304}\u{949f}",
            phase_label,
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            target_duration_ms: Some(duration_ms),
            remaining_ms: Some(remaining_ms),
            secondary_label,
            can_complete_session: self.pending_pomodoro_record_ms.is_some()
                || self.pomodoro_phase == PomodoroPhase::Focus,
            has_unsubmitted_progress: self.has_unsubmitted_progress(),
            active_task_title: self.current_task_title.clone(),
            linked_todo_id: self.linked_todo_id,
            complete_linked_todo_on_finish: self.complete_linked_todo_on_finish,
            current_round: self.current_round(),
            completed_focus_count: self.completed_focus_count,
            completed_break_count: self.completed_break_count,
            recovered_from_last_session: self.recovered_from_last_session,
            mode_switch_locked: mode_switch_hint.is_some(),
            mode_switch_hint,
            alert_sequence: self.alert_sequence,
            alert_key: active_alert_kind.map(|kind| kind.key()),
            alert_title: active_alert_kind.map(|kind| kind.title()),
            alert_message: active_alert_kind.map(|kind| kind.message(self.active_preferences())),
        }
    }

    pub(crate) fn current_pomodoro_duration_ms(&self) -> u64 {
        match self.pomodoro_phase {
            PomodoroPhase::Focus => self.pomodoro_focus_ms,
            PomodoroPhase::Break => self.pomodoro_break_ms,
        }
    }

    pub(crate) fn active_preferences(&self) -> TimerPreferences {
        TimerPreferences {
            pomodoro_focus_minutes: (self.pomodoro_focus_ms / 60_000).max(1),
            pomodoro_break_minutes: (self.pomodoro_break_ms / 60_000).max(1),
            stopwatch_reminder_minutes: self
                .stopwatch_reminder_ms
                .map(|milliseconds| (milliseconds / 60_000).max(1)),
            toast_reminder_enabled: true,
            window_attention_reminder_enabled: true,
            sound_reminder_enabled: true,
            alert_sound_key: AlertSoundKey::SoftChime,
        }
    }

    pub(crate) fn sync_running_time(&mut self) {
        let Some(anchor) = self.running_anchor else {
            return;
        };

        let delta_ms = elapsed_since_anchor_ms(anchor);
        if delta_ms == 0 {
            return;
        }

        let keep_running = match self.mode {
            TimerMode::Stopwatch => {
                self.stopwatch_elapsed_ms = self.stopwatch_elapsed_ms.saturating_add(delta_ms);
                if self.stopwatch_reminder_ms.is_some() {
                    let reached_stage_index =
                        stopwatch_stage_index_for_elapsed(self.stopwatch_elapsed_ms);
                    if reached_stage_index > self.stopwatch_stage_index {
                        self.stopwatch_stage_index = reached_stage_index;
                        self.mark_alert(AlertKind::StopwatchTargetReached);
                    }
                }
                true
            }
            TimerMode::Countdown => {
                self.countdown_elapsed_ms = self
                    .countdown_elapsed_ms
                    .saturating_add(delta_ms)
                    .min(self.countdown_duration_ms);
                if self.countdown_elapsed_ms >= self.countdown_duration_ms {
                    if !self.countdown_completed_alerted {
                        self.countdown_completed_alerted = true;
                        self.mark_alert(AlertKind::CountdownComplete);
                    }
                    false
                } else {
                    true
                }
            }
            TimerMode::Pomodoro => {
                let mut total_elapsed = self.pomodoro_elapsed_ms.saturating_add(delta_ms);
                loop {
                    let phase_duration = self.current_pomodoro_duration_ms();
                    if total_elapsed < phase_duration {
                        break;
                    }

                    total_elapsed -= phase_duration;
                    if self.pomodoro_phase == PomodoroPhase::Focus {
                        self.pending_pomodoro_record_ms = Some(
                            self.pending_pomodoro_record_ms
                                .unwrap_or_default()
                                .saturating_add(phase_duration),
                        );
                        self.completed_focus_count = self.completed_focus_count.saturating_add(1);
                        self.mark_alert(AlertKind::PomodoroFocusComplete);
                    }
                    self.pomodoro_phase = match self.pomodoro_phase {
                        PomodoroPhase::Focus => PomodoroPhase::Break,
                        PomodoroPhase::Break => {
                            self.completed_break_count =
                                self.completed_break_count.saturating_add(1);
                            self.mark_alert(AlertKind::PomodoroBreakComplete);
                            PomodoroPhase::Focus
                        }
                    };
                }

                self.pomodoro_elapsed_ms = total_elapsed;
                true
            }
        };

        self.running_anchor = keep_running.then(Self::new_anchor);
    }

    pub(crate) fn new_anchor() -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: SystemTime::now(),
        }
    }

    pub(crate) fn anchor_from_wall_clock_ms(milliseconds: u64) -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: UNIX_EPOCH + Duration::from_millis(milliseconds),
        }
    }
}

pub(crate) fn elapsed_since_anchor_ms(anchor: RunAnchor) -> u64 {
    elapsed_since_anchor_ms_at(anchor, Instant::now(), SystemTime::now())
}

pub(crate) fn elapsed_since_anchor_ms_at(
    anchor: RunAnchor,
    monotonic_now: Instant,
    wall_clock_now: SystemTime,
) -> u64 {
    let monotonic_ms = monotonic_now
        .saturating_duration_since(anchor.monotonic)
        .as_millis() as u64;
    let wall_ms = wall_clock_now
        .duration_since(anchor.wall_clock)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64;

    monotonic_ms.max(wall_ms)
}

pub(crate) fn with_timer_engine<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut TimerEngine) -> Result<T, String>,
) -> Result<T, String> {
    state.ensure_ready()?;
    let mut engine = state.timer.lock().map_err(|_| {
        "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    f(&mut engine)
}

pub(crate) fn format_duration_ms(total_ms: u64) -> String {
    let total_seconds = total_ms / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

pub(crate) fn system_time_to_epoch_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64
}

pub(crate) fn parse_mode(mode: &str) -> Result<TimerMode, String> {
    match mode {
        "stopwatch" => Ok(TimerMode::Stopwatch),
        "countdown" => Ok(TimerMode::Countdown),
        "pomodoro" => Ok(TimerMode::Pomodoro),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{8ba1}\u{65f6}\u{6a21}\u{5f0f}".to_string()),
    }
}

pub(crate) fn parse_mode_key_value(mode: &str) -> Result<TimerMode, String> {
    parse_mode(mode)
}

pub(crate) fn parse_phase_key_value(value: &str) -> Result<PomodoroPhase, String> {
    match value {
        "focus" => Ok(PomodoroPhase::Focus),
        "break" => Ok(PomodoroPhase::Break),
        _ => Err(
            "\u{4e0d}\u{652f}\u{6301}\u{7684}\u{756a}\u{8304}\u{95f4}\u{9694}\u{9636}\u{6bb5}"
                .to_string(),
        ),
    }
}

pub(crate) fn normalize_countdown_duration_ms(duration_ms: u64) -> u64 {
    let minimum = MIN_COUNTDOWN_MINUTES.saturating_mul(60_000);
    let maximum = MAX_COUNTDOWN_MINUTES.saturating_mul(60_000);
    let is_valid = (minimum..=maximum).contains(&duration_ms) && duration_ms % 60_000 == 0;

    if is_valid {
        duration_ms
    } else {
        DEFAULT_COUNTDOWN_MINUTES.saturating_mul(60_000)
    }
}

pub(crate) fn parse_alert_key_value(value: &str) -> Option<AlertKind> {
    match value {
        "pomodoro_focus_complete" => Some(AlertKind::PomodoroFocusComplete),
        "pomodoro_break_complete" => Some(AlertKind::PomodoroBreakComplete),
        "stopwatch_target_reached" => Some(AlertKind::StopwatchTargetReached),
        "countdown_complete" => Some(AlertKind::CountdownComplete),
        _ => None,
    }
}
