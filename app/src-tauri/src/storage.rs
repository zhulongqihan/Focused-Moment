use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{AppPreferences, FocusPlanState, FocusRecord, TimerPreferences, TodoItem};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";
const RUNTIME_FILE_NAME: &str = "focused-moment-runtime.json";
const STATE_BACKUP_FILE_NAME: &str = "focused-moment-state.backup.json";
const RUNTIME_BACKUP_FILE_NAME: &str = "focused-moment-runtime.backup.json";
const TRANSACTION_PENDING_FILE_NAME: &str = "focused-moment-transaction.pending";
const TRANSACTION_COMMITTED_FILE_NAME: &str = "focused-moment-transaction.committed";
const TRANSACTION_TEMP_FILE_NAME: &str = "focused-moment-transaction.pending.tmp";
const RECOVERY_MATERIAL_FORMAT: &str = "focused-moment-recovery-material";
const TRANSACTION_LOG_FORMAT_VERSION: u64 = 1;
pub const CURRENT_STORAGE_SCHEMA_VERSION: u64 = 3;
const USER_BACKUP_DIR_NAME: &str = "Focused Moment Backups";
const USER_BACKUP_PREFIX: &str = "focused-moment-backup-v3-";
const COMPAT_USER_BACKUP_PREFIX: &str = "focused-moment-backup-v2-";
const LEGACY_USER_BACKUP_PREFIX: &str = "focused-moment-backup-v1-";
const USER_BACKUP_SUFFIX: &str = ".json";

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StoragePlatform {
    Windows,
    MacOs,
    Other,
}

#[derive(Clone)]
pub struct PersistenceStore {
    state_path: PathBuf,
    runtime_path: PathBuf,
    state_backup_path: PathBuf,
    runtime_backup_path: PathBuf,
    transaction_pending_path: PathBuf,
    transaction_committed_path: PathBuf,
    transaction_temp_path: PathBuf,
    transaction_gate: std::sync::Arc<std::sync::Mutex<()>>,
    backup_dir: PathBuf,
    legacy_backup_dir: PathBuf,
    #[cfg(test)]
    failure: std::sync::Arc<std::sync::Mutex<Option<SaveStage>>>,
    #[cfg(test)]
    transaction_fault: std::sync::Arc<std::sync::Mutex<Option<TransactionFault>>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TransactionFile {
    State,
    StateBackup,
    StateTemp,
    StateBackupTemp,
    StateSwapOld,
    Runtime,
    RuntimeBackup,
    RuntimeTemp,
    RuntimeBackupTemp,
    RuntimeSwapOld,
}

const RUNTIME_TRANSACTION_FILES: [TransactionFile; 5] = [
    TransactionFile::Runtime,
    TransactionFile::RuntimeBackup,
    TransactionFile::RuntimeTemp,
    TransactionFile::RuntimeBackupTemp,
    TransactionFile::RuntimeSwapOld,
];

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AffectedFile {
    file: TransactionFile,
    before_hex: Option<String>,
    after_sha256: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransactionLog {
    format_version: u64,
    transaction_id: String,
    affected_files: Vec<AffectedFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecoveryMaterial {
    pub(crate) format: &'static str,
    pub(crate) format_version: u64,
    pub(crate) generated_at: String,
    pub(crate) blocked_reason: Option<String>,
    pub(crate) files: Vec<RecoveryMaterialFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecoveryMaterialFile {
    pub(crate) name: String,
    pub(crate) content_hex: Option<String>,
}

#[derive(Debug)]
pub(crate) enum TransactionError {
    Failed(String),
    RecoveryRequired(String),
}

impl TransactionError {
    pub(crate) fn into_message(self) -> String {
        match self {
            Self::Failed(message) => message,
            Self::RecoveryRequired(message) => format!(
                "本地事务恢复受阻，已保留恢复现场并禁止写入：{message}。可导出恢复材料后检查。"
            ),
        }
    }
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TransactionStage {
    PendingPersisted,
    StateTempWritten,
    StateBackupPromoted,
    StatePrimaryDisplaced,
    StatePrimaryPromoted,
    RuntimeTempWritten,
    RuntimeBackupPromoted,
    RuntimePrimaryDisplaced,
    RuntimePrimaryPromoted,
    TargetsValidated,
    Committed,
    RecoveryFileRestored,
    RecoveryJournalRemoved,
    CommittedJournalRemoved,
    BeforeCommittedJournalCleanup,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug)]
pub(crate) struct TransactionFault {
    pub(crate) stage: TransactionStage,
    pub(crate) action: TransactionFaultAction,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug)]
pub(crate) enum TransactionFaultAction {
    ReturnError,
    AbortProcess,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SaveStage {
    WriteTemp,
    Backup,
    MoveCurrent,
    PromoteNew,
    RuntimeWriteTemp,
    RuntimeBackup,
    RuntimeMoveCurrent,
    RuntimePromoteNew,
}

fn resolve_app_directory() -> Result<PathBuf, String> {
    if let Ok(executable_path) = env::current_exe() {
        if let Some(parent) = executable_path.parent() {
            return Ok(parent.to_path_buf());
        }
    }

    env::current_dir().map_err(|error| error.to_string())
}

fn app_data_base_dir_for(
    platform: StoragePlatform,
    local_app_data: Option<PathBuf>,
    roaming_app_data: Option<PathBuf>,
    home: Option<PathBuf>,
    fallback: PathBuf,
) -> PathBuf {
    match platform {
        StoragePlatform::Windows => local_app_data.or(roaming_app_data).unwrap_or(fallback),
        StoragePlatform::MacOs => home
            .map(|path| path.join("Library").join("Application Support"))
            .unwrap_or(fallback),
        StoragePlatform::Other => fallback,
    }
}

fn resolve_storage_base_dir() -> Result<PathBuf, String> {
    let fallback = env::current_dir().map_err(|error| error.to_string())?;

    #[cfg(windows)]
    {
        return Ok(app_data_base_dir_for(
            StoragePlatform::Windows,
            env::var_os("LOCALAPPDATA").map(PathBuf::from),
            env::var_os("APPDATA").map(PathBuf::from),
            None,
            fallback,
        ));
    }

    #[cfg(target_os = "macos")]
    {
        return Ok(app_data_base_dir_for(
            StoragePlatform::MacOs,
            None,
            None,
            env::var_os("HOME").map(PathBuf::from),
            fallback,
        ));
    }

    #[cfg(not(any(windows, target_os = "macos")))]
    {
        Ok(app_data_base_dir_for(
            StoragePlatform::Other,
            None,
            None,
            None,
            fallback,
        ))
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBackupFile {
    pub kind: String,
    pub format_version: u64,
    #[serde(default = "legacy_schema_version")]
    pub schema_version: u64,
    pub app_version: String,
    pub exported_at: String,
    pub state: PersistedState,
    pub runtime: PersistedRuntimeState,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    #[serde(default = "legacy_schema_version")]
    pub schema_version: u64,
    #[serde(default)]
    pub focus_records: Vec<FocusRecord>,
    #[serde(default)]
    pub next_record_id: u64,
    #[serde(default)]
    pub todo_items: Vec<TodoItem>,
    #[serde(default)]
    pub next_todo_id: u64,
    #[serde(default)]
    pub timer_preferences: TimerPreferences,
    #[serde(default)]
    pub app_preferences: AppPreferences,
    #[serde(default)]
    pub focus_plan: FocusPlanState,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedRuntimeState {
    #[serde(default = "legacy_schema_version")]
    pub schema_version: u64,
    #[serde(default)]
    pub mode_key: String,
    #[serde(default)]
    pub stopwatch_elapsed_ms: u64,
    #[serde(default)]
    pub countdown_elapsed_ms: u64,
    #[serde(default)]
    pub countdown_duration_ms: u64,
    #[serde(default)]
    pub pomodoro_elapsed_ms: u64,
    #[serde(default)]
    pub pomodoro_phase_key: String,
    #[serde(default)]
    pub pending_pomodoro_record_ms: Option<u64>,
    #[serde(default)]
    pub is_running: bool,
    #[serde(default)]
    pub anchor_wall_clock_ms: Option<u64>,
    #[serde(default)]
    pub current_task_title: String,
    #[serde(default)]
    pub linked_todo_id: Option<u64>,
    #[serde(default)]
    pub complete_linked_todo_on_finish: bool,
    #[serde(default)]
    pub completed_focus_count: u64,
    #[serde(default)]
    pub completed_break_count: u64,
    #[serde(default)]
    pub alert_sequence: u64,
    #[serde(default)]
    pub active_alert_key: Option<String>,
    #[serde(default)]
    pub stopwatch_target_alerted: bool,
    #[serde(default)]
    pub stopwatch_stage_index: usize,
}

fn legacy_schema_version() -> u64 {
    1
}

impl PersistenceStore {
    pub fn new() -> Result<Self, String> {
        let store = Self::from_base_dir(resolve_storage_base_dir()?)?;
        let legacy_storage_dir = env::current_dir()
            .map_err(|error| error.to_string())?
            .join(STORAGE_DIR_NAME);
        migrate_legacy_storage(&legacy_storage_dir, store.storage_dir())?;
        Ok(store)
    }

    fn from_base_dir(base_dir: PathBuf) -> Result<Self, String> {
        Self::from_storage_dir(base_dir.join(STORAGE_DIR_NAME))
    }

    fn from_storage_dir(storage_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&storage_dir).map_err(|error| error.to_string())?;
        let legacy_backup_dir = resolve_app_directory()?.join(USER_BACKUP_DIR_NAME);

        Ok(Self {
            state_path: storage_dir.join(STORAGE_FILE_NAME),
            runtime_path: storage_dir.join(RUNTIME_FILE_NAME),
            state_backup_path: storage_dir.join(STATE_BACKUP_FILE_NAME),
            runtime_backup_path: storage_dir.join(RUNTIME_BACKUP_FILE_NAME),
            transaction_pending_path: storage_dir.join(TRANSACTION_PENDING_FILE_NAME),
            transaction_committed_path: storage_dir.join(TRANSACTION_COMMITTED_FILE_NAME),
            transaction_temp_path: storage_dir.join(TRANSACTION_TEMP_FILE_NAME),
            transaction_gate: std::sync::Arc::new(std::sync::Mutex::new(())),
            backup_dir: storage_dir.join(USER_BACKUP_DIR_NAME),
            legacy_backup_dir,
            #[cfg(test)]
            failure: std::sync::Arc::new(std::sync::Mutex::new(None)),
            #[cfg(test)]
            transaction_fault: std::sync::Arc::new(std::sync::Mutex::new(None)),
        })
    }

    fn storage_dir(&self) -> &Path {
        self.state_path
            .parent()
            .expect("state path must have a storage directory")
    }

    #[cfg(test)]
    pub(crate) fn for_test(base_dir: &Path) -> Result<Self, String> {
        Self::from_base_dir(base_dir.to_path_buf())
    }

    #[cfg(test)]
    pub(crate) fn for_test_with_failure(base_dir: &Path, stage: SaveStage) -> Result<Self, String> {
        let store = Self::for_test(base_dir)?;
        *store
            .failure
            .lock()
            .map_err(|_| "测试故障注入锁定失败".to_string())? = Some(stage);
        Ok(store)
    }

    pub fn load(&self) -> Result<PersistedState, String> {
        let _guard = self
            .transaction_gate
            .lock()
            .map_err(|_| "本地事务锁定失败，无法读取状态。".to_string())?;
        self.recover_transactions_locked(false)
            .map_err(TransactionError::into_message)?;
        read_json_with_backup(&self.state_path, &self.state_backup_path, "状态")
    }

    pub fn save(&self, state: &PersistedState) -> Result<(), String> {
        self.save_transaction(Some(state), None)
            .map_err(TransactionError::into_message)
    }

    pub fn load_runtime(&self) -> Result<PersistedRuntimeState, String> {
        let _guard = self
            .transaction_gate
            .lock()
            .map_err(|_| "本地事务锁定失败，无法读取运行态。".to_string())?;
        self.recover_transactions_locked(false)
            .map_err(TransactionError::into_message)?;
        read_json_with_backup(&self.runtime_path, &self.runtime_backup_path, "运行态")
    }

    pub fn save_runtime(&self, state: &PersistedRuntimeState) -> Result<(), String> {
        self.save_transaction(None, Some(state))
            .map_err(TransactionError::into_message)
    }

    pub fn save_all(
        &self,
        state: &PersistedState,
        runtime: &PersistedRuntimeState,
    ) -> Result<(), TransactionError> {
        self.save_transaction(Some(state), Some(runtime))
    }

    pub fn ensure_ready_for_write(&self) -> Result<(), TransactionError> {
        let _guard = self
            .transaction_gate
            .lock()
            .map_err(|_| TransactionError::RecoveryRequired("本地事务锁定失败。".to_string()))?;
        self.recover_transactions_locked(true)
    }

    fn save_transaction(
        &self,
        state: Option<&PersistedState>,
        runtime: Option<&PersistedRuntimeState>,
    ) -> Result<(), TransactionError> {
        self.execute_transaction(state, runtime, false)
    }

    fn execute_transaction(
        &self,
        state: Option<&PersistedState>,
        runtime: Option<&PersistedRuntimeState>,
        clear_runtime: bool,
    ) -> Result<(), TransactionError> {
        if state.is_none() && runtime.is_none() && !clear_runtime {
            return Err(TransactionError::Failed("空事务未执行。".to_string()));
        }

        let _guard = self
            .transaction_gate
            .lock()
            .map_err(|_| TransactionError::RecoveryRequired("本地事务锁定失败。".to_string()))?;
        self.recover_transactions_locked(true)?;

        let mut affected_files = Vec::new();
        let state_bytes = state
            .map(serde_json::to_vec_pretty)
            .transpose()
            .map_err(|error| TransactionError::Failed(error.to_string()))?;
        let runtime_bytes = runtime
            .map(serde_json::to_vec_pretty)
            .transpose()
            .map_err(|error| TransactionError::Failed(error.to_string()))?;

        if let Some(bytes) = state_bytes.as_deref() {
            affected_files.extend(
                self.plan_json_file::<PersistedState>(
                    TransactionFile::State,
                    TransactionFile::StateBackup,
                    TransactionFile::StateTemp,
                    TransactionFile::StateBackupTemp,
                    TransactionFile::StateSwapOld,
                    bytes,
                )
                .map_err(TransactionError::Failed)?,
            );
        }
        if let Some(bytes) = runtime_bytes.as_deref() {
            affected_files.extend(
                self.plan_json_file::<PersistedRuntimeState>(
                    TransactionFile::Runtime,
                    TransactionFile::RuntimeBackup,
                    TransactionFile::RuntimeTemp,
                    TransactionFile::RuntimeBackupTemp,
                    TransactionFile::RuntimeSwapOld,
                    bytes,
                )
                .map_err(TransactionError::Failed)?,
            );
        }
        if clear_runtime {
            for file in RUNTIME_TRANSACTION_FILES {
                let before = read_optional_file(&self.path_for_file(file))
                    .map_err(TransactionError::Failed)?;
                affected_files.push(self.affected_file(file, before, None));
            }
        }

        let transaction_id = transaction_id();
        let log = TransactionLog {
            format_version: TRANSACTION_LOG_FORMAT_VERSION,
            transaction_id,
            affected_files,
        };
        let serialized_log = serde_json::to_vec_pretty(&log)
            .map_err(|error| TransactionError::Failed(error.to_string()))?;

        remove_if_exists(&self.transaction_temp_path).map_err(TransactionError::Failed)?;
        write_durable(&self.transaction_temp_path, &serialized_log)
            .map_err(|error| TransactionError::Failed(format!("写入 pending 日志失败：{error}")))?;
        durable_rename(&self.transaction_temp_path, &self.transaction_pending_path)
            .map_err(|error| TransactionError::Failed(format!("安装 pending 日志失败：{error}")))?;

        #[cfg(test)]
        if let Err(error) = self.maybe_fail_transaction_at(TransactionStage::PendingPersisted) {
            return self.rollback_pending_after_failure(error);
        }

        let write_result = (|| {
            if let (Some(value), Some(_bytes)) = (state, state_bytes.as_deref()) {
                save_json_with_backup(
                    self,
                    &self.state_path,
                    &self.state_backup_path,
                    value,
                    "状态",
                )?;
            }
            if let (Some(value), Some(_bytes)) = (runtime, runtime_bytes.as_deref()) {
                save_json_with_backup(
                    self,
                    &self.runtime_path,
                    &self.runtime_backup_path,
                    value,
                    "运行态",
                )?;
            }
            if clear_runtime {
                for file in RUNTIME_TRANSACTION_FILES {
                    remove_if_exists(&self.path_for_file(file))?;
                }
            }
            Ok::<(), String>(())
        })();

        if let Err(error) = write_result {
            return self.rollback_pending_after_failure(error);
        }

        if let Err(error) = self.validate_after_images(&log) {
            return Err(TransactionError::RecoveryRequired(format!(
                "事务目标校验冲突：{error}"
            )));
        }

        #[cfg(test)]
        if let Err(error) = self.maybe_fail_transaction_at(TransactionStage::TargetsValidated) {
            return self.rollback_pending_after_failure(error);
        }

        if let Err(error) = durable_rename(
            &self.transaction_pending_path,
            &self.transaction_committed_path,
        ) {
            return self.rollback_pending_after_failure(format!("原子提交事务日志失败：{error}"));
        }

        #[cfg(test)]
        {
            if let Err(error) = self.maybe_fail_transaction_at(TransactionStage::Committed) {
                eprintln!("FOCUSED_MOMENT_COMMITTED_JOURNAL_CLEANUP_PENDING={error}");
                return Ok(());
            }
            if let Err(error) =
                self.maybe_fail_transaction_at(TransactionStage::BeforeCommittedJournalCleanup)
            {
                eprintln!("FOCUSED_MOMENT_COMMITTED_JOURNAL_CLEANUP_PENDING={error}");
                return Ok(());
            }
        }

        if let Err(error) = remove_if_exists(&self.transaction_committed_path) {
            eprintln!("FOCUSED_MOMENT_COMMITTED_JOURNAL_CLEANUP_PENDING={error}");
            return Ok(());
        }

        #[cfg(test)]
        if let Err(error) =
            self.maybe_fail_transaction_at(TransactionStage::CommittedJournalRemoved)
        {
            eprintln!("FOCUSED_MOMENT_COMMITTED_JOURNAL_CLEANUP_COMPLETE={error}");
        }

        Ok(())
    }

    fn plan_json_file<T: DeserializeOwned>(
        &self,
        primary: TransactionFile,
        backup: TransactionFile,
        temp: TransactionFile,
        backup_temp: TransactionFile,
        swap_old: TransactionFile,
        new_primary: &[u8],
    ) -> Result<Vec<AffectedFile>, String> {
        let primary_path = self.path_for_file(primary);
        let backup_path = self.path_for_file(backup);
        let before_primary = read_optional_file(&primary_path)?;
        let before_backup = read_optional_file(&backup_path)?;
        let new_backup = if before_primary
            .as_deref()
            .is_some_and(|bytes| serde_json::from_slice::<T>(bytes).is_ok())
        {
            before_primary.clone()
        } else {
            before_backup
        };

        Ok(vec![
            self.affected_file(primary, before_primary, Some(new_primary)),
            self.affected_file(
                backup,
                read_optional_file(&backup_path)?,
                new_backup.as_deref(),
            ),
            self.affected_file(temp, read_optional_file(&self.path_for_file(temp))?, None),
            self.affected_file(
                backup_temp,
                read_optional_file(&self.path_for_file(backup_temp))?,
                None,
            ),
            self.affected_file(
                swap_old,
                read_optional_file(&self.path_for_file(swap_old))?,
                None,
            ),
        ])
    }

    fn affected_file(
        &self,
        file: TransactionFile,
        before: Option<Vec<u8>>,
        after: Option<&[u8]>,
    ) -> AffectedFile {
        AffectedFile {
            file,
            before_hex: before.as_deref().map(bytes_to_hex),
            after_sha256: after.map(sha256_hex),
        }
    }

    fn path_for_file(&self, file: TransactionFile) -> PathBuf {
        let name = match file {
            TransactionFile::State => STORAGE_FILE_NAME,
            TransactionFile::StateBackup => STATE_BACKUP_FILE_NAME,
            TransactionFile::StateTemp => "focused-moment-state.json.tmp",
            TransactionFile::StateBackupTemp => "focused-moment-state.json.backup-tmp",
            TransactionFile::StateSwapOld => "focused-moment-state.json.swap-old",
            TransactionFile::Runtime => RUNTIME_FILE_NAME,
            TransactionFile::RuntimeBackup => RUNTIME_BACKUP_FILE_NAME,
            TransactionFile::RuntimeTemp => "focused-moment-runtime.json.tmp",
            TransactionFile::RuntimeBackupTemp => "focused-moment-runtime.json.backup-tmp",
            TransactionFile::RuntimeSwapOld => "focused-moment-runtime.json.swap-old",
        };
        self.storage_dir().join(name)
    }

    fn validate_after_images(&self, log: &TransactionLog) -> Result<(), String> {
        for affected in &log.affected_files {
            let path = self.path_for_file(affected.file);
            let current = read_optional_file(&path)?;
            let current_hash = current.as_deref().map(sha256_hex);
            if current_hash != affected.after_sha256 {
                return Err(format!(
                    "{} 的实际校验值与事务日志不一致。",
                    path.file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("未知文件")
                ));
            }
        }
        Ok(())
    }

    fn rollback_pending_after_failure(&self, failure: String) -> Result<(), TransactionError> {
        match self.recover_pending_locked() {
            Ok(()) => Err(TransactionError::Failed(failure)),
            Err(recovery_error) => Err(TransactionError::RecoveryRequired(format!(
                "{failure}；回滚失败：{recovery_error}"
            ))),
        }
    }

    fn recover_transactions_locked(&self, require_cleanup: bool) -> Result<(), TransactionError> {
        let pending_exists = path_exists(&self.transaction_pending_path)
            .map_err(TransactionError::RecoveryRequired)?;
        let committed_exists = path_exists(&self.transaction_committed_path)
            .map_err(TransactionError::RecoveryRequired)?;

        if pending_exists && committed_exists {
            return Err(TransactionError::RecoveryRequired(
                "pending 与 committed 日志同时存在，无法判断唯一提交点。".to_string(),
            ));
        }
        if pending_exists {
            self.recover_pending_locked()
                .map_err(TransactionError::RecoveryRequired)?;
        } else if committed_exists {
            let log = self.read_transaction_log(&self.transaction_committed_path)?;
            self.validate_after_images(&log).map_err(|error| {
                TransactionError::RecoveryRequired(format!("已提交事务的目标校验冲突：{error}"))
            })?;
            if let Err(error) = remove_if_exists(&self.transaction_committed_path) {
                eprintln!("FOCUSED_MOMENT_COMMITTED_JOURNAL_CLEANUP_PENDING={error}");
                if require_cleanup {
                    return Err(TransactionError::RecoveryRequired(format!(
                        "已提交状态有效，但清理事务日志失败：{error}"
                    )));
                }
            }
        } else if let Err(error) = remove_if_exists(&self.transaction_temp_path) {
            return Err(TransactionError::RecoveryRequired(format!(
                "清理未安装的 pending 临时日志失败：{error}"
            )));
        }
        Ok(())
    }

    fn read_transaction_log(&self, path: &Path) -> Result<TransactionLog, TransactionError> {
        let raw = fs::read(path).map_err(|error| {
            TransactionError::RecoveryRequired(format!("读取事务日志失败：{error}"))
        })?;
        let log = serde_json::from_slice::<TransactionLog>(&raw).map_err(|error| {
            TransactionError::RecoveryRequired(format!("事务日志损坏：{error}"))
        })?;
        self.validate_transaction_log(&log)?;
        Ok(log)
    }

    fn validate_transaction_log(&self, log: &TransactionLog) -> Result<(), TransactionError> {
        if log.format_version != TRANSACTION_LOG_FORMAT_VERSION
            || log.transaction_id.trim().is_empty()
            || log.affected_files.is_empty()
        {
            return Err(TransactionError::RecoveryRequired(
                "事务日志版本或必需字段无效。".to_string(),
            ));
        }
        let mut seen = std::collections::HashSet::new();
        for affected in &log.affected_files {
            if !seen.insert(affected.file) {
                return Err(TransactionError::RecoveryRequired(
                    "事务日志重复列出同一文件。".to_string(),
                ));
            }
            if let Some(before_hex) = &affected.before_hex {
                decode_hex(before_hex).map_err(|_| {
                    TransactionError::RecoveryRequired(
                        "事务日志中的修改前内容不是有效十六进制。".to_string(),
                    )
                })?;
            }
            if affected.after_sha256.as_ref().is_some_and(|hash| {
                hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit())
            }) {
                return Err(TransactionError::RecoveryRequired(
                    "事务日志中的修改后校验值无效。".to_string(),
                ));
            }
        }
        Ok(())
    }

    fn recover_pending_locked(&self) -> Result<(), String> {
        if !path_exists(&self.transaction_pending_path)? {
            return Ok(());
        }
        let log = self
            .read_transaction_log(&self.transaction_pending_path)
            .map_err(TransactionError::into_message)?;
        for affected in &log.affected_files {
            let path = self.path_for_file(affected.file);
            match affected.before_hex.as_deref() {
                Some(before_hex) => {
                    let before = decode_hex(before_hex)
                        .map_err(|error| format!("事务日志修改前内容损坏：{error}"))?;
                    write_durable(&path, &before)
                        .map_err(|error| format!("恢复 {} 失败：{error}", path.display()))?;
                    if read_optional_file(&path)?.as_deref() != Some(before.as_slice()) {
                        return Err(format!("恢复 {} 后内容校验失败。", path.display()));
                    }
                }
                None => {
                    remove_if_exists(&path)
                        .map_err(|error| format!("清理 {} 失败：{error}", path.display()))?;
                    if path_exists(&path)? {
                        return Err(format!("清理 {} 后文件仍存在。", path.display()));
                    }
                }
            }
            #[cfg(test)]
            self.maybe_fail_transaction_at(TransactionStage::RecoveryFileRestored)?;
        }
        remove_if_exists(&self.transaction_pending_path)
            .map_err(|error| format!("移除已恢复事务日志失败：{error}"))?;
        #[cfg(test)]
        if let Err(error) = self.maybe_fail_transaction_at(TransactionStage::RecoveryJournalRemoved)
        {
            eprintln!("FOCUSED_MOMENT_RECOVERY_JOURNAL_REMOVED={error}");
        }
        Ok(())
    }

    pub fn recovery_material(
        &self,
        blocked_reason: Option<String>,
    ) -> Result<RecoveryMaterial, String> {
        let _guard = self
            .transaction_gate
            .lock()
            .map_err(|_| "本地事务锁定失败，无法导出恢复材料。".to_string())?;
        let mut files = Vec::new();
        let state_temp_path = self.path_for_file(TransactionFile::StateTemp);
        let state_backup_temp_path = self.path_for_file(TransactionFile::StateBackupTemp);
        let state_swap_old_path = self.path_for_file(TransactionFile::StateSwapOld);
        let runtime_temp_path = self.path_for_file(TransactionFile::RuntimeTemp);
        let runtime_backup_temp_path = self.path_for_file(TransactionFile::RuntimeBackupTemp);
        let runtime_swap_old_path = self.path_for_file(TransactionFile::RuntimeSwapOld);
        for (name, path) in [
            (STORAGE_FILE_NAME, self.state_path.as_path()),
            (STATE_BACKUP_FILE_NAME, self.state_backup_path.as_path()),
            ("focused-moment-state.json.tmp", state_temp_path.as_path()),
            (
                "focused-moment-state.json.backup-tmp",
                state_backup_temp_path.as_path(),
            ),
            (
                "focused-moment-state.json.swap-old",
                state_swap_old_path.as_path(),
            ),
            (RUNTIME_FILE_NAME, self.runtime_path.as_path()),
            (RUNTIME_BACKUP_FILE_NAME, self.runtime_backup_path.as_path()),
            (
                "focused-moment-runtime.json.tmp",
                runtime_temp_path.as_path(),
            ),
            (
                "focused-moment-runtime.json.backup-tmp",
                runtime_backup_temp_path.as_path(),
            ),
            (
                "focused-moment-runtime.json.swap-old",
                runtime_swap_old_path.as_path(),
            ),
            (
                TRANSACTION_PENDING_FILE_NAME,
                self.transaction_pending_path.as_path(),
            ),
            (
                TRANSACTION_COMMITTED_FILE_NAME,
                self.transaction_committed_path.as_path(),
            ),
            (
                TRANSACTION_TEMP_FILE_NAME,
                self.transaction_temp_path.as_path(),
            ),
        ] {
            files.push(RecoveryMaterialFile {
                name: name.to_string(),
                content_hex: read_optional_file(path)?.as_deref().map(bytes_to_hex),
            });
        }
        Ok(RecoveryMaterial {
            format: RECOVERY_MATERIAL_FORMAT,
            format_version: 1,
            generated_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs().to_string())
                .unwrap_or_else(|_| "clock-error".to_string()),
            blocked_reason,
            files,
        })
    }

    #[cfg(test)]
    pub(crate) fn inject_transaction_fault(
        &self,
        stage: TransactionStage,
        action: TransactionFaultAction,
    ) -> Result<(), String> {
        *self
            .transaction_fault
            .lock()
            .map_err(|_| "测试事务故障注入锁定失败".to_string())? =
            Some(TransactionFault { stage, action });
        Ok(())
    }

    #[cfg(test)]
    fn maybe_fail_transaction_at(&self, stage: TransactionStage) -> Result<(), String> {
        let mut fault = self
            .transaction_fault
            .lock()
            .map_err(|_| "测试事务故障注入锁定失败".to_string())?;
        if fault.is_some_and(|fault| fault.stage == stage) {
            let fault = fault.take().expect("fault was checked above");
            return match fault.action {
                TransactionFaultAction::ReturnError => Err(format!("注入事务故障：{stage:?}")),
                TransactionFaultAction::AbortProcess => std::process::abort(),
            };
        }
        Ok(())
    }

    #[cfg(test)]
    pub fn clear_runtime(&self) -> Result<(), String> {
        self.execute_transaction(None, None, true)
            .map_err(TransactionError::into_message)
    }

    pub fn user_backup_dir(&self) -> Result<PathBuf, String> {
        fs::create_dir_all(&self.backup_dir).map_err(|error| error.to_string())?;
        Ok(self.backup_dir.clone())
    }

    pub fn save_user_backup(
        &self,
        file_name: &str,
        backup: &AppBackupFile,
    ) -> Result<PathBuf, String> {
        let backup_dir = self.user_backup_dir()?;
        let backup_path = backup_dir.join(file_name);
        let serialized = serde_json::to_string_pretty(backup).map_err(|error| error.to_string())?;
        fs::write(&backup_path, serialized).map_err(|error| error.to_string())?;
        Ok(backup_path)
    }

    pub fn load_user_backup(&self, file_name: &str) -> Result<AppBackupFile, String> {
        if !Self::is_supported_backup_file_name(file_name) {
            return Err("备份文件名不合法。".to_string());
        }

        let backup_path = self.user_backup_dir()?.join(file_name);
        let legacy_backup_path = self.legacy_backup_dir.join(file_name);
        let path = if backup_path.exists() {
            backup_path
        } else if legacy_backup_path.exists() {
            legacy_backup_path
        } else {
            return Err("找不到这份本地备份。".to_string());
        };
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn list_user_backups(&self) -> Result<Vec<(String, AppBackupFile)>, String> {
        let mut backups = Vec::new();
        let mut seen_names = std::collections::HashSet::new();
        let backup_dirs = [self.user_backup_dir()?, self.legacy_backup_dir.clone()];

        for backup_dir in backup_dirs {
            if !backup_dir.exists() {
                continue;
            }

            for entry in fs::read_dir(&backup_dir).map_err(|error| error.to_string())? {
                let entry = entry.map_err(|error| error.to_string())?;
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                    continue;
                };

                if !Self::is_supported_backup_file_name(file_name) {
                    continue;
                }

                if !seen_names.insert(file_name.to_string()) {
                    continue;
                }

                let raw = match fs::read_to_string(&path) {
                    Ok(raw) => raw,
                    Err(_) => continue,
                };

                let backup = match serde_json::from_str::<AppBackupFile>(&raw) {
                    Ok(backup) => backup,
                    Err(_) => continue,
                };

                backups.push((file_name.to_string(), backup));
            }
        }

        backups.sort_by(|left, right| right.0.cmp(&left.0));
        Ok(backups)
    }

    pub fn is_supported_backup_file_name(file_name: &str) -> bool {
        (file_name.starts_with(USER_BACKUP_PREFIX)
            || file_name.starts_with(COMPAT_USER_BACKUP_PREFIX)
            || file_name.starts_with(LEGACY_USER_BACKUP_PREFIX))
            && file_name.ends_with(USER_BACKUP_SUFFIX)
            && !file_name.contains(['\\', '/', ':'])
    }

    #[cfg(test)]
    fn maybe_fail_for_path(&self, path: &Path, stage: SaveStage) -> Result<(), String> {
        let stage = if path == self.runtime_path.as_path() {
            match stage {
                SaveStage::WriteTemp => SaveStage::RuntimeWriteTemp,
                SaveStage::Backup => SaveStage::RuntimeBackup,
                SaveStage::MoveCurrent => SaveStage::RuntimeMoveCurrent,
                SaveStage::PromoteNew => SaveStage::RuntimePromoteNew,
                runtime_stage => runtime_stage,
            }
        } else {
            stage
        };
        let mut failure = self
            .failure
            .lock()
            .map_err(|_| "测试故障注入锁定失败".to_string())?;
        if *failure == Some(stage) {
            *failure = None;
            return Err(format!("注入存储故障：{stage:?}"));
        }

        Ok(())
    }
}

fn transaction_id() -> String {
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let sequence = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{}-{now}-{sequence}", std::process::id())
}

fn read_optional_file(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("读取 {} 失败：{error}", path.display())),
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 {
        return Err("十六进制内容长度不是偶数".to_string());
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = (pair[0] as char)
                .to_digit(16)
                .ok_or_else(|| "十六进制内容包含无效字符".to_string())?;
            let low = (pair[1] as char)
                .to_digit(16)
                .ok_or_else(|| "十六进制内容包含无效字符".to_string())?;
            Ok(((high << 4) | low) as u8)
        })
        .collect()
}

fn durable_rename(source: &Path, destination: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let source_wide = source
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>();
        let destination_wide = destination
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>();
        let result = unsafe {
            windows_sys::Win32::Storage::FileSystem::MoveFileExW(
                source_wide.as_ptr(),
                destination_wide.as_ptr(),
                windows_sys::Win32::Storage::FileSystem::MOVEFILE_WRITE_THROUGH,
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        fs::rename(source, destination).map_err(|error| error.to_string())?;
        if let Some(parent) = destination.parent() {
            fs::File::open(parent)
                .and_then(|directory| directory.sync_all())
                .map_err(|error| format!("同步事务目录失败：{error}"))?;
        }
        Ok(())
    }
}

#[derive(Debug)]
enum JsonFileError {
    Missing,
    Io(String),
    Invalid(String),
}

fn sibling_path(path: &Path, suffix: &str) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("focused-moment-storage");
    path.with_file_name(format!("{file_name}.{suffix}"))
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

fn directory_is_empty(path: &Path) -> Result<bool, String> {
    let mut entries = fs::read_dir(path).map_err(|error| error.to_string())?;
    Ok(entries
        .next()
        .transpose()
        .map_err(|error| error.to_string())?
        .is_none())
}

fn migration_suffix() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "clock-error".to_string())
}

fn unique_migration_sibling(path: &Path, label: &str) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("focused-moment-storage");
    let suffix = migration_suffix();

    for attempt in 0..100u32 {
        let candidate = path.with_file_name(format!(
            "{file_name}.{label}-{suffix}{attempt_suffix}",
            attempt_suffix = if attempt == 0 {
                String::new()
            } else {
                format!("-{attempt}")
            }
        ));
        if !path_exists(&candidate)? {
            return Ok(candidate);
        }
    }

    Err(format!("无法为旧数据迁移创建唯一的 {label} 路径。"))
}

fn copy_directory_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;

    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_path).map_err(|error| error.to_string())?;

        if metadata.file_type().is_symlink() {
            return Err(format!(
                "旧数据目录包含不支持迁移的符号链接：{}",
                source_path.display()
            ));
        }

        if metadata.is_dir() {
            copy_directory_recursive(&source_path, &destination_path)?;
        } else if metadata.is_file() {
            fs::copy(&source_path, &destination_path).map_err(|error| error.to_string())?;
        } else {
            return Err(format!(
                "旧数据目录包含不支持迁移的文件类型：{}",
                source_path.display()
            ));
        }
    }

    Ok(())
}

fn migrate_legacy_storage(
    legacy_storage_dir: &Path,
    canonical_storage_dir: &Path,
) -> Result<bool, String> {
    if legacy_storage_dir == canonical_storage_dir {
        return Ok(false);
    }

    if !path_exists(legacy_storage_dir)? {
        return Ok(false);
    }

    if path_exists(canonical_storage_dir)? && !directory_is_empty(canonical_storage_dir)? {
        return Ok(false);
    }

    let backup_dir = unique_migration_sibling(legacy_storage_dir, "migration-backup")?;
    copy_directory_recursive(legacy_storage_dir, &backup_dir)
        .map_err(|error| format!("迁移前备份旧数据失败：{error}"))?;

    let staging_dir = match unique_migration_sibling(canonical_storage_dir, "migration-tmp") {
        Ok(path) => path,
        Err(error) => {
            return Err(format!("准备旧数据迁移目录失败：{error}"));
        }
    };

    if let Err(error) = copy_directory_recursive(legacy_storage_dir, &staging_dir) {
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(format!("复制旧数据到迁移暂存目录失败：{error}"));
    }

    let staging_store = match PersistenceStore::from_storage_dir(staging_dir.clone()) {
        Ok(store) => store,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(format!("准备旧数据迁移验证失败：{error}"));
        }
    };
    if let Err(error) = staging_store
        .load()
        .and_then(|_| staging_store.load_runtime())
        .map(|_| ())
    {
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(format!("旧数据迁移验证失败：{error}"));
    }

    let displaced_dir = if path_exists(canonical_storage_dir)? {
        let path = unique_migration_sibling(canonical_storage_dir, "migration-old")?;
        if let Err(error) = fs::rename(canonical_storage_dir, &path) {
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(format!("切换旧数据迁移目录失败：{error}"));
        }
        Some(path)
    } else {
        None
    };

    if let Err(error) = fs::rename(&staging_dir, canonical_storage_dir) {
        if let Some(displaced_dir) = displaced_dir.as_ref() {
            let _ = fs::rename(displaced_dir, canonical_storage_dir);
        }
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(format!("提交旧数据迁移结果失败：{error}"));
    }

    if let Some(displaced_dir) = displaced_dir {
        let _ = fs::remove_dir_all(displaced_dir);
    }

    Ok(true)
}

fn write_durable(path: &Path, contents: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(contents)
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    Ok(())
}

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<T, JsonFileError> {
    let raw = fs::read_to_string(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            JsonFileError::Missing
        } else {
            JsonFileError::Io(error.to_string())
        }
    })?;

    serde_json::from_str(&raw).map_err(|error| JsonFileError::Invalid(error.to_string()))
}

fn describe_json_error(error: &JsonFileError) -> String {
    match error {
        JsonFileError::Missing => "文件不存在".to_string(),
        JsonFileError::Io(message) => format!("读取失败：{message}"),
        JsonFileError::Invalid(message) => format!("内容无效：{message}"),
    }
}

fn read_json_with_backup<T: DeserializeOwned + Default>(
    primary_path: &Path,
    backup_path: &Path,
    label: &str,
) -> Result<T, String> {
    match read_json_file(primary_path) {
        Ok(value) => Ok(value),
        Err(primary_error) => match read_json_file(backup_path) {
            Ok(value) => Ok(value),
            Err(JsonFileError::Missing) if matches!(&primary_error, JsonFileError::Missing) => {
                Ok(T::default())
            }
            Err(backup_error) => Err(format!(
                "无法读取{label}主文件，且有效快照备份不可用：主文件{}；备份{}。",
                describe_json_error(&primary_error),
                describe_json_error(&backup_error)
            )),
        },
    }
}

fn promote_backup(temp_path: &Path, backup_path: &Path) -> Result<(), String> {
    remove_if_exists(backup_path)?;
    fs::rename(temp_path, backup_path).map_err(|error| error.to_string())
}

fn save_json_with_backup<T>(
    store: &PersistenceStore,
    destination_path: &Path,
    backup_path: &Path,
    value: &T,
    label: &str,
) -> Result<(), String>
where
    T: Serialize + DeserializeOwned,
{
    #[cfg(not(test))]
    let _ = store;

    let serialized = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    let temp_path = sibling_path(destination_path, "tmp");
    let backup_temp_path = sibling_path(destination_path, "backup-tmp");
    let displaced_path = sibling_path(destination_path, "swap-old");

    remove_if_exists(&temp_path).map_err(|error| format!("清理{label}旧临时文件失败：{error}"))?;
    remove_if_exists(&backup_temp_path)
        .map_err(|error| format!("清理{label}旧备份临时文件失败：{error}"))?;
    remove_if_exists(&displaced_path)
        .map_err(|error| format!("清理{label}旧交换文件失败：{error}"))?;

    #[cfg(test)]
    store.maybe_fail_for_path(destination_path, SaveStage::WriteTemp)?;
    write_durable(&temp_path, &serialized)
        .map_err(|error| format!("写入{label}临时文件失败：{error}"))?;
    #[cfg(test)]
    store.maybe_fail_transaction_at(if destination_path == store.runtime_path.as_path() {
        TransactionStage::RuntimeTempWritten
    } else {
        TransactionStage::StateTempWritten
    })?;

    let destination_exists = path_exists(destination_path)?;
    if destination_exists {
        let current_bytes = fs::read(destination_path).map_err(|error| error.to_string())?;

        if serde_json::from_slice::<T>(&current_bytes).is_ok() {
            #[cfg(test)]
            store.maybe_fail_for_path(destination_path, SaveStage::Backup)?;
            write_durable(&backup_temp_path, &current_bytes)
                .map_err(|error| format!("写入{label}快照备份失败：{error}"))?;
            promote_backup(&backup_temp_path, backup_path)
                .map_err(|error| format!("替换{label}快照备份失败：{error}"))?;
            #[cfg(test)]
            store.maybe_fail_transaction_at(
                if destination_path == store.runtime_path.as_path() {
                    TransactionStage::RuntimeBackupPromoted
                } else {
                    TransactionStage::StateBackupPromoted
                },
            )?;
        }
    }

    if destination_exists {
        #[cfg(test)]
        store.maybe_fail_for_path(destination_path, SaveStage::MoveCurrent)?;
        remove_if_exists(&displaced_path)?;
        fs::rename(destination_path, &displaced_path)
            .map_err(|error| format!("准备替换{label}主文件失败：{error}"))?;
        #[cfg(test)]
        store.maybe_fail_transaction_at(if destination_path == store.runtime_path.as_path() {
            TransactionStage::RuntimePrimaryDisplaced
        } else {
            TransactionStage::StatePrimaryDisplaced
        })?;
    }

    #[cfg(test)]
    store.maybe_fail_for_path(destination_path, SaveStage::PromoteNew)?;

    if let Err(error) = fs::rename(&temp_path, destination_path) {
        if destination_exists {
            let _ = fs::rename(&displaced_path, destination_path);
        }
        return Err(format!("提交{label}主文件失败：{error}"));
    }

    #[cfg(test)]
    store.maybe_fail_transaction_at(if destination_path == store.runtime_path.as_path() {
        TransactionStage::RuntimePrimaryPromoted
    } else {
        TransactionStage::StatePrimaryPromoted
    })?;

    let _ = remove_if_exists(&displaced_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMP_ROOT_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_root() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is before unix epoch")
            .as_nanos();
        let sequence = TEMP_ROOT_COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = env::temp_dir().join(format!(
            "focused-moment-storage-test-{}-{suffix}-{sequence}",
            std::process::id(),
        ));
        fs::create_dir_all(&root).expect("create isolated storage fixture");
        root
    }

    fn cleanup(root: &Path) {
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn platform_data_directory_prefers_expected_locations() {
        let fallback = PathBuf::from(r"C:\fallback");

        assert_eq!(
            app_data_base_dir_for(
                StoragePlatform::Windows,
                Some(PathBuf::from(r"C:\local")),
                Some(PathBuf::from(r"C:\roaming")),
                None,
                fallback.clone(),
            ),
            PathBuf::from(r"C:\local")
        );
        assert_eq!(
            app_data_base_dir_for(
                StoragePlatform::Windows,
                None,
                Some(PathBuf::from(r"C:\roaming")),
                None,
                fallback.clone(),
            ),
            PathBuf::from(r"C:\roaming")
        );
        assert_eq!(
            app_data_base_dir_for(
                StoragePlatform::MacOs,
                None,
                None,
                Some(PathBuf::from(r"C:\Users\Test")),
                fallback.clone(),
            ),
            PathBuf::from(r"C:\Users\Test")
                .join("Library")
                .join("Application Support")
        );
        assert_eq!(
            app_data_base_dir_for(StoragePlatform::Other, None, None, None, fallback.clone(),),
            fallback
        );
    }

    #[test]
    fn legacy_storage_migration_keeps_source_backup_and_validates_destination() {
        let root = temp_root();
        let legacy_parent = root.join("legacy");
        let canonical_parent = root.join("canonical");
        let legacy_store = PersistenceStore::for_test(&legacy_parent).expect("create legacy store");

        legacy_store.save(&state(7)).expect("save legacy state");
        legacy_store
            .save_runtime(&runtime(42))
            .expect("save legacy runtime");

        let migrated = migrate_legacy_storage(
            &legacy_parent.join(STORAGE_DIR_NAME),
            &canonical_parent.join(STORAGE_DIR_NAME),
        )
        .expect("migrate valid legacy storage");
        assert!(migrated);

        let canonical_store =
            PersistenceStore::for_test(&canonical_parent).expect("open canonical store");
        assert_eq!(
            canonical_store
                .load()
                .expect("load migrated state")
                .next_record_id,
            7
        );
        assert_eq!(
            canonical_store
                .load_runtime()
                .expect("load migrated runtime")
                .stopwatch_elapsed_ms,
            42
        );
        assert!(legacy_store.state_path.exists());
        assert!(legacy_store.runtime_path.exists());

        let has_migration_backup = fs::read_dir(&legacy_parent)
            .expect("read legacy parent")
            .filter_map(Result::ok)
            .any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains("migration-backup")
            });
        assert!(has_migration_backup);

        cleanup(&root);
    }

    #[test]
    fn legacy_storage_migration_rejects_invalid_snapshot_without_switching() {
        let root = temp_root();
        let legacy_parent = root.join("legacy");
        let canonical_parent = root.join("canonical");
        let legacy_store = PersistenceStore::for_test(&legacy_parent).expect("create legacy store");

        fs::write(&legacy_store.state_path, b"{invalid state").expect("corrupt legacy state");
        legacy_store
            .save_runtime(&runtime(42))
            .expect("save legacy runtime");

        let error = migrate_legacy_storage(
            &legacy_parent.join(STORAGE_DIR_NAME),
            &canonical_parent.join(STORAGE_DIR_NAME),
        )
        .expect_err("invalid legacy storage must not migrate");
        assert!(error.contains("迁移验证"));
        assert!(legacy_store.state_path.exists());
        assert!(!canonical_parent.join(STORAGE_DIR_NAME).exists());

        let has_migration_backup = fs::read_dir(&legacy_parent)
            .expect("read legacy parent")
            .filter_map(Result::ok)
            .any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains("migration-backup")
            });
        assert!(has_migration_backup);

        cleanup(&root);
    }

    #[test]
    fn legacy_storage_migration_never_overwrites_non_empty_canonical_storage() {
        let root = temp_root();
        let legacy_parent = root.join("legacy");
        let canonical_parent = root.join("canonical");
        let legacy_store = PersistenceStore::for_test(&legacy_parent).expect("create legacy store");
        let canonical_store =
            PersistenceStore::for_test(&canonical_parent).expect("create canonical store");

        legacy_store.save(&state(7)).expect("save legacy state");
        legacy_store
            .save_runtime(&runtime(42))
            .expect("save legacy runtime");
        canonical_store
            .save(&state(9))
            .expect("save canonical state");
        canonical_store
            .save_runtime(&runtime(84))
            .expect("save canonical runtime");

        let migrated = migrate_legacy_storage(
            &legacy_parent.join(STORAGE_DIR_NAME),
            &canonical_parent.join(STORAGE_DIR_NAME),
        )
        .expect("inspect non-empty canonical storage");
        assert!(!migrated);
        assert_eq!(
            canonical_store
                .load()
                .expect("load preserved canonical state")
                .next_record_id,
            9
        );
        assert_eq!(
            canonical_store
                .load_runtime()
                .expect("load preserved canonical runtime")
                .stopwatch_elapsed_ms,
            84
        );
        assert!(legacy_store.state_path.exists());

        let has_migration_backup = fs::read_dir(&legacy_parent)
            .expect("read legacy parent")
            .filter_map(Result::ok)
            .any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains("migration-backup")
            });
        assert!(!has_migration_backup);

        cleanup(&root);
    }

    fn state(next_record_id: u64) -> PersistedState {
        PersistedState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            next_record_id,
            ..PersistedState::default()
        }
    }

    fn runtime(elapsed_ms: u64) -> PersistedRuntimeState {
        PersistedRuntimeState {
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            mode_key: "stopwatch".to_string(),
            stopwatch_elapsed_ms: elapsed_ms,
            ..PersistedRuntimeState::default()
        }
    }

    #[test]
    fn empty_storage_initializes_without_a_backup() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");

        assert_eq!(store.load().expect("load empty state").next_record_id, 0);
        assert_eq!(
            store
                .load_runtime()
                .expect("load empty runtime")
                .stopwatch_elapsed_ms,
            0
        );

        cleanup(&root);
    }

    #[test]
    fn state_and_runtime_keep_the_last_valid_snapshot() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");

        store.save(&state(1)).expect("save first state");
        store
            .save_runtime(&runtime(1_000))
            .expect("save first runtime");
        store.save(&state(2)).expect("save second state");
        store
            .save_runtime(&runtime(2_000))
            .expect("save second runtime");

        assert_eq!(store.load().expect("load current state").next_record_id, 2);
        assert_eq!(
            store
                .load_runtime()
                .expect("load current runtime")
                .stopwatch_elapsed_ms,
            2_000
        );

        fs::remove_file(&store.state_path).expect("remove state primary");
        fs::remove_file(&store.runtime_path).expect("remove runtime primary");
        assert_eq!(
            store.load().expect("recover missing state").next_record_id,
            1
        );
        assert_eq!(
            store
                .load_runtime()
                .expect("recover missing runtime")
                .stopwatch_elapsed_ms,
            1_000
        );

        fs::write(&store.state_path, b"{invalid state").expect("corrupt state primary");
        fs::write(&store.runtime_path, b"{invalid runtime").expect("corrupt runtime primary");
        assert_eq!(
            store.load().expect("recover invalid state").next_record_id,
            1
        );
        assert_eq!(
            store
                .load_runtime()
                .expect("recover invalid runtime")
                .stopwatch_elapsed_ms,
            1_000
        );

        fs::remove_file(&store.state_path).expect("remove invalid state primary");
        fs::create_dir(&store.state_path).expect("create unreadable state primary");
        fs::remove_file(&store.runtime_path).expect("remove invalid runtime primary");
        fs::create_dir(&store.runtime_path).expect("create unreadable runtime primary");
        assert_eq!(
            store
                .load()
                .expect("recover unreadable state")
                .next_record_id,
            1
        );
        assert_eq!(
            store
                .load_runtime()
                .expect("recover unreadable runtime")
                .stopwatch_elapsed_ms,
            1_000
        );

        cleanup(&root);
    }

    #[test]
    fn invalid_primary_is_not_allowed_to_replace_a_valid_backup() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");

        store.save(&state(1)).expect("save first state");
        store.save(&state(2)).expect("save second state");
        fs::write(&store.state_path, b"{invalid state").expect("corrupt state primary");

        store.save(&state(3)).expect("repair state primary");
        fs::remove_file(&store.state_path).expect("remove repaired state primary");
        assert_eq!(
            store
                .load()
                .expect("recover the still-valid backup")
                .next_record_id,
            1
        );

        cleanup(&root);
    }

    #[test]
    fn no_valid_recovery_source_returns_an_explicit_error() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");

        fs::write(&store.state_path, b"{invalid state").expect("corrupt state primary");
        fs::write(&store.runtime_path, b"{invalid runtime").expect("corrupt runtime primary");

        let state_error = match store.load() {
            Ok(_) => panic!("invalid state must fail"),
            Err(error) => error,
        };
        let runtime_error = match store.load_runtime() {
            Ok(_) => panic!("invalid runtime must fail"),
            Err(error) => error,
        };
        assert!(state_error.contains("快照备份"));
        assert!(runtime_error.contains("快照备份"));

        cleanup(&root);
    }

    #[test]
    fn injected_save_failures_preserve_state_and_runtime() {
        let stages = [
            SaveStage::WriteTemp,
            SaveStage::Backup,
            SaveStage::MoveCurrent,
            SaveStage::PromoteNew,
        ];

        for stage in stages {
            let state_root = temp_root();
            let state_store = PersistenceStore::for_test(&state_root).expect("create state store");
            state_store.save(&state(1)).expect("save initial state");
            let faulty_state_store = PersistenceStore::for_test_with_failure(&state_root, stage)
                .expect("create faulty state store");
            assert!(faulty_state_store.save(&state(2)).is_err());
            let recovered_state_store =
                PersistenceStore::for_test(&state_root).expect("reopen state store");
            assert_eq!(
                recovered_state_store
                    .load()
                    .expect("recover state after injected failure")
                    .next_record_id,
                1
            );
            cleanup(&state_root);

            let runtime_root = temp_root();
            let runtime_store =
                PersistenceStore::for_test(&runtime_root).expect("create runtime store");
            runtime_store
                .save_runtime(&runtime(1_000))
                .expect("save initial runtime");
            let runtime_stage = match stage {
                SaveStage::WriteTemp => SaveStage::RuntimeWriteTemp,
                SaveStage::Backup => SaveStage::RuntimeBackup,
                SaveStage::MoveCurrent => SaveStage::RuntimeMoveCurrent,
                SaveStage::PromoteNew => SaveStage::RuntimePromoteNew,
                runtime_stage => runtime_stage,
            };
            let faulty_runtime_store =
                PersistenceStore::for_test_with_failure(&runtime_root, runtime_stage)
                    .expect("create faulty runtime store");
            assert!(faulty_runtime_store.save_runtime(&runtime(2_000)).is_err());
            let recovered_runtime_store =
                PersistenceStore::for_test(&runtime_root).expect("reopen runtime store");
            assert_eq!(
                recovered_runtime_store
                    .load_runtime()
                    .expect("recover runtime after injected failure")
                    .stopwatch_elapsed_ms,
                1_000
            );
            cleanup(&runtime_root);
        }
    }

    #[test]
    fn clearing_runtime_removes_recovery_snapshot_intentionally() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");

        store
            .save_runtime(&runtime(1_000))
            .expect("save first runtime");
        store
            .save_runtime(&runtime(2_000))
            .expect("save second runtime");
        store.clear_runtime().expect("clear runtime");

        assert_eq!(
            store
                .load_runtime()
                .expect("load intentionally cleared runtime")
                .stopwatch_elapsed_ms,
            0
        );
        assert!(!store.runtime_backup_path.exists());

        cleanup(&root);
    }

    #[test]
    fn clearing_runtime_rolls_back_from_its_pending_journal() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");
        store
            .save_runtime(&runtime(1_000))
            .expect("save initial runtime");
        store
            .save_runtime(&runtime(2_000))
            .expect("save current runtime");
        let before_primary = fs::read(&store.runtime_path).expect("read current runtime");
        let before_backup = fs::read(&store.runtime_backup_path).expect("read runtime backup");
        store
            .inject_transaction_fault(
                TransactionStage::PendingPersisted,
                TransactionFaultAction::ReturnError,
            )
            .expect("inject pending failure");

        assert!(store.clear_runtime().is_err());

        assert_eq!(fs::read(&store.runtime_path).unwrap(), before_primary);
        assert_eq!(fs::read(&store.runtime_backup_path).unwrap(), before_backup);
        assert!(!store.transaction_pending_path.exists());
        assert_eq!(store.load_runtime().unwrap().stopwatch_elapsed_ms, 2_000);
        cleanup(&root);
    }

    #[test]
    fn save_removes_stale_scratch_files_when_primary_is_missing() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");
        for suffix in ["tmp", "backup-tmp", "swap-old"] {
            let path = sibling_path(&store.runtime_path, suffix);
            fs::write(path, b"stale scratch").expect("write stale scratch file");
        }

        store
            .save_runtime(&runtime(2_000))
            .expect("save runtime and clean old scratch files");

        for suffix in ["tmp", "backup-tmp", "swap-old"] {
            assert!(!sibling_path(&store.runtime_path, suffix).exists());
        }
        assert_eq!(store.load_runtime().unwrap().stopwatch_elapsed_ms, 2_000);
        cleanup(&root);
    }

    fn seed_transaction_boundary_fixture(root: &Path) {
        let store = PersistenceStore::for_test(root).expect("create transaction fixture");
        store.save(&state(0)).expect("save initial state");
        store.save(&state(1)).expect("save baseline state");
        store
            .save_runtime(&runtime(0))
            .expect("save initial runtime");
        store
            .save_runtime(&runtime(1_000))
            .expect("save baseline runtime");
    }

    fn run_transaction_abort_child(root: &Path, stage: &str) -> std::process::Output {
        Command::new(std::env::current_exe().expect("find current test executable"))
            .args([
                "--exact",
                "storage::tests::transaction_crash_child_process",
                "--ignored",
            ])
            .env("FOCUSED_MOMENT_TXN_TEST_ROOT", root)
            .env("FOCUSED_MOMENT_TXN_TEST_STAGE", stage)
            .output()
            .expect("start isolated transaction crash child")
    }

    fn assert_child_recovered_bundle(root: &Path, expected_state: u64, expected_runtime: u64) {
        let reopened = PersistenceStore::for_test(root).expect("reopen transaction fixture");
        assert_eq!(
            reopened
                .load()
                .expect("load state after child exit")
                .next_record_id,
            expected_state
        );
        assert_eq!(
            reopened
                .load_runtime()
                .expect("load runtime after child exit")
                .stopwatch_elapsed_ms,
            expected_runtime
        );
        assert!(!reopened.transaction_pending_path.exists());
        assert!(!reopened.transaction_committed_path.exists());
    }

    #[test]
    fn child_process_aborts_at_each_write_and_commit_boundary() {
        let stages = [
            ("PendingPersisted", false),
            ("StateTempWritten", false),
            ("StateBackupPromoted", false),
            ("StatePrimaryDisplaced", false),
            ("StatePrimaryPromoted", false),
            ("RuntimeTempWritten", false),
            ("RuntimeBackupPromoted", false),
            ("RuntimePrimaryDisplaced", false),
            ("RuntimePrimaryPromoted", false),
            ("TargetsValidated", false),
            ("Committed", true),
            ("BeforeCommittedJournalCleanup", true),
        ];

        for (stage, committed) in stages {
            let root = temp_root();
            seed_transaction_boundary_fixture(&root);
            let output = run_transaction_abort_child(&root, stage);
            assert!(
                !output.status.success(),
                "child did not abort at {stage}: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            let output_text = format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            assert!(
                !output_text.contains("TRANSACTION_FAULT_DID_NOT_ABORT"),
                "child returned before the injected abort at {stage}: {output_text}"
            );
            if committed {
                assert_child_recovered_bundle(&root, 2, 2_000);
            } else {
                assert_child_recovered_bundle(&root, 1, 1_000);
            }
            cleanup(&root);
        }
    }

    #[test]
    fn child_exit_during_recovery_is_idempotent() {
        let root = temp_root();
        seed_transaction_boundary_fixture(&root);
        let first_exit = run_transaction_abort_child(&root, "StatePrimaryPromoted");
        assert!(!first_exit.status.success());

        let recovery_exit = run_transaction_abort_child(&root, "RecoveryFileRestored");
        assert!(!recovery_exit.status.success());
        let recovery_output = format!(
            "{}{}",
            String::from_utf8_lossy(&recovery_exit.stdout),
            String::from_utf8_lossy(&recovery_exit.stderr)
        );
        assert!(!recovery_output.contains("TRANSACTION_FAULT_DID_NOT_ABORT"));

        assert_child_recovered_bundle(&root, 1, 1_000);
        cleanup(&root);
    }

    #[test]
    fn committed_cleanup_failure_is_success_and_blocks_no_duplicate_retry() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");
        store.save(&state(1)).expect("save baseline state");
        store
            .inject_transaction_fault(
                TransactionStage::BeforeCommittedJournalCleanup,
                TransactionFaultAction::ReturnError,
            )
            .expect("inject committed cleanup failure");

        store
            .save(&state(2))
            .expect("committed write must not be reported as failed");
        assert!(store.transaction_committed_path.exists());
        assert_eq!(
            store.load().expect("read committed state").next_record_id,
            2
        );
        assert!(!store.transaction_committed_path.exists());

        cleanup(&root);
    }

    #[test]
    fn committed_checksum_conflict_preserves_scene_and_blocks_writes() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).expect("create store");
        store.save(&state(1)).expect("save baseline state");
        let output = run_transaction_abort_child(&root, "Committed");
        assert!(!output.status.success());
        let conflicted = PersistenceStore::for_test(&root).expect("open committed fixture");
        fs::write(
            &conflicted.state_path,
            serde_json::to_vec(&state(9)).unwrap(),
        )
        .expect("inject external checksum conflict");

        let error = conflicted
            .save(&state(10))
            .expect_err("checksum conflict must prevent another write");
        assert!(error.contains("校验冲突"));
        assert!(conflicted.transaction_committed_path.exists());
        let read_error = match conflicted.load() {
            Ok(_) => panic!("committed checksum conflict must block reads"),
            Err(error) => error,
        };
        assert!(read_error.contains("校验冲突"));

        cleanup(&root);
    }

    #[test]
    #[ignore = "invoked only as an isolated subprocess by crash boundary tests"]
    fn transaction_crash_child_process() {
        let Ok(root) = env::var("FOCUSED_MOMENT_TXN_TEST_ROOT") else {
            return;
        };
        let stage_name =
            env::var("FOCUSED_MOMENT_TXN_TEST_STAGE").expect("child stage must be set by parent");
        let store = PersistenceStore::for_test(Path::new(&root)).expect("open child store");
        if stage_name == "RecoveryFileRestored" {
            store
                .inject_transaction_fault(
                    TransactionStage::RecoveryFileRestored,
                    TransactionFaultAction::AbortProcess,
                )
                .expect("inject abort during recovery");
            let _ = store.load();
            panic!("TRANSACTION_FAULT_DID_NOT_ABORT");
        }

        let stage = match stage_name.as_str() {
            "PendingPersisted" => TransactionStage::PendingPersisted,
            "StateTempWritten" => TransactionStage::StateTempWritten,
            "StateBackupPromoted" => TransactionStage::StateBackupPromoted,
            "StatePrimaryDisplaced" => TransactionStage::StatePrimaryDisplaced,
            "StatePrimaryPromoted" => TransactionStage::StatePrimaryPromoted,
            "RuntimeTempWritten" => TransactionStage::RuntimeTempWritten,
            "RuntimeBackupPromoted" => TransactionStage::RuntimeBackupPromoted,
            "RuntimePrimaryDisplaced" => TransactionStage::RuntimePrimaryDisplaced,
            "RuntimePrimaryPromoted" => TransactionStage::RuntimePrimaryPromoted,
            "TargetsValidated" => TransactionStage::TargetsValidated,
            "Committed" => TransactionStage::Committed,
            "BeforeCommittedJournalCleanup" => TransactionStage::BeforeCommittedJournalCleanup,
            _ => panic!("unknown transaction stage: {stage_name}"),
        };
        store
            .inject_transaction_fault(stage, TransactionFaultAction::AbortProcess)
            .expect("inject child abort at transaction stage");
        store
            .save_all(&state(2), &runtime(2_000))
            .expect("transaction child must abort before returning");
        panic!("TRANSACTION_FAULT_DID_NOT_ABORT");
    }
}
