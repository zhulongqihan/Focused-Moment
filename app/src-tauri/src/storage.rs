use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::{AppPreferences, FocusPlanState, FocusRecord, TimerPreferences, TodoItem};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";
const RUNTIME_FILE_NAME: &str = "focused-moment-runtime.json";
const STATE_BACKUP_FILE_NAME: &str = "focused-moment-state.backup.json";
const RUNTIME_BACKUP_FILE_NAME: &str = "focused-moment-runtime.backup.json";
const TRANSACTION_FILE_NAME: &str = "focused-moment-transaction.json";
// Serialize journal replay and ordinary writes, including cloned store handles.
// The application enforces one process; this is not an inter-process lock.
static STORAGE_ACCESS: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn storage_access() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    STORAGE_ACCESS
        .lock()
        .map_err(|_| "存储锁不可用，已停止存储访问。".to_string())
}

// Fixed positions, never paths supplied by a journal. Preserve missing files and
// exact bytes (including an invalid primary with a valid fallback).
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageTransaction {
    version: u32,
    before: [BeforeFile; 4],
}

#[derive(Serialize, Deserialize)]
enum BeforeFile {
    Missing,
    Bytes(Vec<u8>),
}
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
    backup_dir: PathBuf,
    legacy_backup_dir: PathBuf,
    #[cfg(test)]
    failure: std::sync::Arc<std::sync::Mutex<Option<SaveStage>>>,
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

pub(crate) fn parse_backup_file(raw: &str) -> Result<AppBackupFile, String> {
    let value: serde_json::Value = serde_json::from_str(raw).map_err(|error| error.to_string())?;
    let state = value
        .get("state")
        .and_then(serde_json::Value::as_object)
        .ok_or("备份缺少业务数据，无法安全恢复。")?;
    // Defaults are for migrating optional fields, never for interpreting a
    // truncated backup as an intentional request to erase entire collections.
    for key in ["todoItems", "focusRecords"] {
        if !state.get(key).is_some_and(serde_json::Value::is_array) {
            return Err(format!("备份缺少 {key} 数组，无法安全恢复。"));
        }
    }
    if value
        .get("formatVersion")
        .and_then(serde_json::Value::as_u64)
        == Some(3)
    {
        for key in ["timerPreferences", "appPreferences", "focusPlan"] {
            if !state.get(key).is_some_and(serde_json::Value::is_object) {
                return Err(format!("v3 备份缺少 {key}，无法安全恢复。"));
            }
        }
    }
    serde_json::from_value(value).map_err(|error| error.to_string())
}

/// Publish a synced backup from a unique sibling file. The caller must obtain
/// overwrite confirmation before passing `true`. A failed write/publication
/// leaves an existing destination intact; it is never truncated or removed.
pub(crate) fn write_backup_atomic(
    path: &Path,
    backup: &AppBackupFile,
    overwrite: bool,
) -> Result<(), String> {
    let serialized = serde_json::to_vec_pretty(backup).map_err(|error| error.to_string())?;
    let temp_path = unique_migration_sibling(path, "writing")?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|error| error.to_string())?;
    let written = file.write_all(&serialized).and_then(|_| file.sync_all());
    drop(file);
    let result = written.and_then(|_| {
        if overwrite {
            // Same-filesystem rename replaces the directory entry, including on
            // Windows. Never use remove(destination) followed by rename here.
            fs::rename(&temp_path, path)
        } else {
            // Atomic no-clobber publication. Unsupported filesystems fail safely.
            fs::hard_link(&temp_path, path)
        }
    });
    let _ = remove_if_exists(&temp_path);
    result.map_err(|error| format!("原子写入备份失败：{error}"))
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

        let store = Self {
            state_path: storage_dir.join(STORAGE_FILE_NAME),
            runtime_path: storage_dir.join(RUNTIME_FILE_NAME),
            state_backup_path: storage_dir.join(STATE_BACKUP_FILE_NAME),
            runtime_backup_path: storage_dir.join(RUNTIME_BACKUP_FILE_NAME),
            backup_dir: storage_dir.join(USER_BACKUP_DIR_NAME),
            legacy_backup_dir,
            #[cfg(test)]
            failure: std::sync::Arc::new(std::sync::Mutex::new(None)),
        };
        let _access = storage_access()?;
        store.recover_transaction()?;
        Ok(store)
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
        let _access = storage_access()?;
        self.recover_transaction()?;
        read_json_with_backup(&self.state_path, &self.state_backup_path, "状态")
    }

    pub fn save(&self, state: &PersistedState) -> Result<(), String> {
        let _access = storage_access()?;
        self.recover_transaction()?;
        save_json_with_backup(
            self,
            &self.state_path,
            &self.state_backup_path,
            state,
            "状态",
        )
    }

    pub fn load_runtime(&self) -> Result<PersistedRuntimeState, String> {
        let _access = storage_access()?;
        self.recover_transaction()?;
        read_json_with_backup(&self.runtime_path, &self.runtime_backup_path, "运行态")
    }

    pub fn save_runtime(&self, state: &PersistedRuntimeState) -> Result<(), String> {
        let _access = storage_access()?;
        self.recover_transaction()?;
        save_json_with_backup(
            self,
            &self.runtime_path,
            &self.runtime_backup_path,
            state,
            "运行态",
        )
    }

    #[allow(dead_code)]
    pub fn clear_runtime(&self) -> Result<(), String> {
        let _access = storage_access()?;
        self.recover_transaction()?;
        remove_if_exists(&self.runtime_path)?;
        remove_if_exists(&self.runtime_backup_path)?;
        remove_if_exists(&sibling_path(&self.runtime_path, "tmp"))?;
        remove_if_exists(&sibling_path(&self.runtime_path, "backup-tmp"))?;
        remove_if_exists(&sibling_path(&self.runtime_path, "swap-old"))?;
        Ok(())
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
        if !Self::is_supported_backup_file_name(file_name) {
            return Err("备份文件名不合法。".to_string());
        }
        let backup_dir = self.user_backup_dir()?;
        let backup_path = backup_dir.join(file_name);
        write_backup_atomic(&backup_path, backup, false)?;
        Ok(backup_path)
    }

    fn transaction_paths(&self) -> [&Path; 4] {
        [
            &self.state_path,
            &self.runtime_path,
            &self.state_backup_path,
            &self.runtime_backup_path,
        ]
    }

    fn prepare_transaction(&self) -> Result<(), String> {
        self.recover_transaction()?;
        // Refuse to transact over unreadable data, instead of treating it as empty.
        read_json_with_backup::<PersistedState>(&self.state_path, &self.state_backup_path, "状态")?;
        read_json_with_backup::<PersistedRuntimeState>(
            &self.runtime_path,
            &self.runtime_backup_path,
            "运行态",
        )?;
        let mut before = Vec::new();
        for path in self.transaction_paths() {
            before.push(match fs::read(path) {
                Ok(bytes) => BeforeFile::Bytes(bytes),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => BeforeFile::Missing,
                Err(error) => return Err(error.to_string()),
            });
        }
        let journal = StorageTransaction {
            version: 1,
            before: before.try_into().map_err(|_| "事务文件数量错误")?,
        };
        let path = self.storage_dir().join(TRANSACTION_FILE_NAME);
        let temp = sibling_path(&path, "tmp");
        write_durable(
            &temp,
            &serde_json::to_vec(&journal).map_err(|e| e.to_string())?,
        )?;
        fs::rename(&temp, &path).map_err(|e| e.to_string())
    }

    fn recover_transaction(&self) -> Result<(), String> {
        let path = self.storage_dir().join(TRANSACTION_FILE_NAME);
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(format!("无法读取事务日志，已停止存储访问：{error}")),
        };
        let journal: StorageTransaction = serde_json::from_slice(&bytes)
            .map_err(|error| format!("事务日志损坏，保留原数据：{error}"))?;
        if journal.version != 1 {
            return Err("不支持的事务日志版本，保留原数据。".to_string());
        }
        // Validate every target and stage every before image before replacing any
        // file. The immutable journal survives failed/repeated recovery attempts.
        for target in self.transaction_paths() {
            match fs::symlink_metadata(target) {
                Ok(metadata) if !metadata.file_type().is_file() => {
                    return Err("事务恢复目标不是普通文件，保留原数据。".to_string())
                }
                Ok(_) => (),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.to_string()),
            }
        }
        for (target, before) in self.transaction_paths().into_iter().zip(&journal.before) {
            if let BeforeFile::Bytes(bytes) = before {
                write_durable(&sibling_path(target, "recover"), bytes)?;
            }
        }
        for (target, before) in self.transaction_paths().into_iter().zip(&journal.before) {
            remove_if_exists(target)?;
            if let BeforeFile::Bytes(_) = before {
                fs::rename(sibling_path(target, "recover"), target).map_err(|e| e.to_string())?;
            }
        }
        // A crash anywhere above is safe: next startup replays the same before.
        remove_if_exists(&path)
    }

    pub fn save_bundle(
        &self,
        state: &PersistedState,
        runtime: &PersistedRuntimeState,
    ) -> Result<(), String> {
        let _access = storage_access()?;
        self.prepare_transaction()?;
        let result = save_json_with_backup(
            self,
            &self.state_path,
            &self.state_backup_path,
            state,
            "状态",
        )
        .and_then(|_| {
            save_json_with_backup(
                self,
                &self.runtime_path,
                &self.runtime_backup_path,
                runtime,
                "运行态",
            )
        })
        .and_then(|_| remove_if_exists(&self.storage_dir().join(TRANSACTION_FILE_NAME)));
        if let Err(error) = result {
            return match self.recover_transaction() {
                Ok(()) => Err(error),
                Err(rollback) => Err(format!("{error}；事务回退失败（日志已保留）：{rollback}")),
            };
        }
        Ok(())
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
        parse_backup_file(&raw)
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

    #[cfg(test)]
    store.maybe_fail_for_path(destination_path, SaveStage::WriteTemp)?;
    write_durable(&temp_path, &serialized)
        .map_err(|error| format!("写入{label}临时文件失败：{error}"))?;

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
        }
    }

    if destination_exists {
        #[cfg(test)]
        store.maybe_fail_for_path(destination_path, SaveStage::MoveCurrent)?;
        remove_if_exists(&displaced_path)?;
        fs::rename(destination_path, &displaced_path)
            .map_err(|error| format!("准备替换{label}主文件失败：{error}"))?;
    }

    #[cfg(test)]
    store.maybe_fail_for_path(destination_path, SaveStage::PromoteNew)?;

    if let Err(error) = fs::rename(&temp_path, destination_path) {
        if destination_exists {
            let _ = fs::rename(&displaced_path, destination_path);
        }
        return Err(format!("提交{label}主文件失败：{error}"));
    }

    let _ = remove_if_exists(&displaced_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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

    fn disk_bundle(store: &PersistenceStore) -> Vec<Option<Vec<u8>>> {
        store
            .transaction_paths()
            .into_iter()
            .map(|p| fs::read(p).ok())
            .collect()
    }

    #[test]
    fn interrupted_bundle_replays_exact_before_images_at_each_commit_boundary() {
        // Construct on-disk crash states directly. No error handler/rollback runs.
        for boundary in 0..=4 {
            for initially_empty in [false, true] {
                let root = temp_root();
                let store = PersistenceStore::for_test(&root).unwrap();
                if !initially_empty {
                    store.save_bundle(&state(1), &runtime(10)).unwrap();
                    store.save_bundle(&state(2), &runtime(20)).unwrap();
                }
                let before = disk_bundle(&store);
                store.prepare_transaction().unwrap();
                if boundary >= 1 {
                    // Crash after displacing the first primary, before promotion.
                    if store.state_path.exists() {
                        fs::rename(
                            &store.state_path,
                            sibling_path(&store.state_path, "swap-old"),
                        )
                        .unwrap();
                    }
                }
                if boundary >= 2 {
                    save_json_with_backup(
                        &store,
                        &store.state_path,
                        &store.state_backup_path,
                        &state(9),
                        "状态",
                    )
                    .unwrap();
                }
                if boundary >= 3 && store.runtime_path.exists() {
                    fs::rename(
                        &store.runtime_path,
                        sibling_path(&store.runtime_path, "swap-old"),
                    )
                    .unwrap();
                }
                if boundary >= 4 {
                    save_json_with_backup(
                        &store,
                        &store.runtime_path,
                        &store.runtime_backup_path,
                        &runtime(90),
                        "运行态",
                    )
                    .unwrap();
                }
                drop(store);
                let reopened = PersistenceStore::for_test(&root).unwrap();
                assert_eq!(
                    disk_bundle(&reopened),
                    before,
                    "boundary {boundary}, empty {initially_empty}"
                );
                assert!(!reopened.storage_dir().join(TRANSACTION_FILE_NAME).exists());
                assert_eq!(
                    disk_bundle(&PersistenceStore::for_test(&root).unwrap()),
                    before
                );
                cleanup(&root);
            }
        }
    }

    #[test]
    fn interrupted_recovery_is_repeatable_and_bad_journal_blocks_writes() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).unwrap();
        store.save_bundle(&state(1), &runtime(10)).unwrap();
        let before = disk_bundle(&store);
        store.prepare_transaction().unwrap();
        fs::write(&store.state_path, serde_json::to_vec(&state(9)).unwrap()).unwrap();
        fs::remove_file(&store.runtime_path).unwrap(); // interrupted recovery after remove
        let reopened = PersistenceStore::for_test(&root).unwrap();
        assert_eq!(disk_bundle(&reopened), before);

        let journal = store.storage_dir().join(TRANSACTION_FILE_NAME);
        for bad in [
            b"{truncated".as_slice(),
            br#"{"version":1,"before":[]}"#,
            br#"{"version":2,"before":["Missing","Missing","Missing","Missing"]}"#,
        ] {
            fs::write(&journal, bad).unwrap();
            assert!(PersistenceStore::for_test(&root).is_err());
            assert!(store.save_bundle(&state(99), &runtime(99)).is_err());
            assert!(store.save(&state(99)).is_err());
            assert!(store.save_runtime(&runtime(99)).is_err());
            assert!(store.clear_runtime().is_err());
            assert_eq!(disk_bundle(&store), before);
            assert_eq!(fs::read(&journal).unwrap(), bad);
        }
        cleanup(&root);
    }

    #[test]
    fn recovery_failure_preserves_journal_and_can_be_retried() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).unwrap();
        store.save_bundle(&state(1), &runtime(10)).unwrap();
        let before = disk_bundle(&store);
        store.prepare_transaction().unwrap();
        fs::write(&store.state_path, b"interrupted state").unwrap();
        // A blocked staging path must be detected before any primary is replaced.
        let blocked = sibling_path(&store.runtime_path, "recover");
        fs::create_dir(&blocked).unwrap();
        let interrupted = disk_bundle(&store);
        assert!(PersistenceStore::for_test(&root).is_err());
        assert_eq!(disk_bundle(&store), interrupted);
        assert!(store.storage_dir().join(TRANSACTION_FILE_NAME).exists());
        fs::remove_dir(&blocked).unwrap();
        let reopened = PersistenceStore::for_test(&root).unwrap();
        assert_eq!(disk_bundle(&reopened), before);
        cleanup(&root);
    }

    #[test]
    fn bundle_failures_restore_backups_as_well_as_primaries() {
        for stage in [
            SaveStage::WriteTemp,
            SaveStage::Backup,
            SaveStage::MoveCurrent,
            SaveStage::PromoteNew,
            SaveStage::RuntimeWriteTemp,
            SaveStage::RuntimeBackup,
            SaveStage::RuntimeMoveCurrent,
            SaveStage::RuntimePromoteNew,
        ] {
            let root = temp_root();
            let store = PersistenceStore::for_test(&root).unwrap();
            store.save_bundle(&state(1), &runtime(10)).unwrap();
            store.save_bundle(&state(2), &runtime(20)).unwrap();
            let before = disk_bundle(&store);
            let faulty = PersistenceStore::for_test_with_failure(&root, stage).unwrap();
            assert!(faulty.save_bundle(&state(9), &runtime(90)).is_err());
            assert_eq!(
                disk_bundle(&PersistenceStore::for_test(&root).unwrap()),
                before,
                "{stage:?}"
            );
            cleanup(&root);
        }
    }

    #[test]
    fn committed_bundle_survives_restart_and_unpublished_journal_is_ignored() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).unwrap();
        store.save_bundle(&state(1), &runtime(10)).unwrap();
        store.save_bundle(&state(2), &runtime(20)).unwrap();
        let committed = disk_bundle(&store);
        // Crash while preparing the journal: primaries cannot yet have changed.
        fs::write(
            sibling_path(&store.storage_dir().join(TRANSACTION_FILE_NAME), "tmp"),
            b"partial",
        )
        .unwrap();
        let reopened = PersistenceStore::for_test(&root).unwrap();
        assert_eq!(disk_bundle(&reopened), committed);
        assert_eq!(reopened.load().unwrap().next_record_id, 2);
        assert_eq!(reopened.load_runtime().unwrap().stopwatch_elapsed_ms, 20);
        reopened.save_bundle(&state(3), &runtime(30)).unwrap();
        cleanup(&root);
    }

    #[test]
    fn legacy_migration_recovers_interrupted_bundle_in_isolated_staging() {
        let root = temp_root();
        let legacy = PersistenceStore::for_test(&root.join("legacy")).unwrap();
        legacy.save_bundle(&state(1), &runtime(10)).unwrap();
        let before = disk_bundle(&legacy);
        legacy.prepare_transaction().unwrap();
        fs::write(&legacy.state_path, serde_json::to_vec(&state(9)).unwrap()).unwrap();
        let interrupted_source = disk_bundle(&legacy);
        let destination = root.join("canonical").join(STORAGE_DIR_NAME);
        assert!(migrate_legacy_storage(legacy.storage_dir(), &destination).unwrap());
        let migrated = PersistenceStore::from_storage_dir(destination).unwrap();
        assert_eq!(disk_bundle(&migrated), before);
        assert_eq!(disk_bundle(&legacy), interrupted_source);
        assert!(legacy.storage_dir().join(TRANSACTION_FILE_NAME).exists());
        cleanup(&root);
    }

    #[test]
    fn user_backup_publication_is_durable_and_never_clobbers() {
        let root = temp_root();
        let store = PersistenceStore::for_test(&root).unwrap();
        let mut backup = AppBackupFile {
            kind: "focused-moment-backup".into(),
            format_version: 3,
            schema_version: CURRENT_STORAGE_SCHEMA_VERSION,
            app_version: "test".into(),
            exported_at: "test".into(),
            state: state(1),
            runtime: runtime(10),
        };
        let name = "focused-moment-backup-v3-test.json";
        let path = store.save_user_backup(name, &backup).unwrap();
        let before = fs::read(&path).unwrap();
        backup.state = state(2);
        assert!(store.save_user_backup(name, &backup).is_err());
        assert_eq!(fs::read(path).unwrap(), before);
        assert!(store.save_user_backup("../escaped.json", &backup).is_err());
        assert_eq!(
            fs::read_dir(store.user_backup_dir().unwrap())
                .unwrap()
                .count(),
            1
        );
        let path = store.user_backup_dir().unwrap().join(name);
        write_backup_atomic(&path, &backup, true).unwrap();
        assert_eq!(
            store.load_user_backup(name).unwrap().state.next_record_id,
            2
        );
        // Publishing to a directory must fail without touching its contents.
        let directory = root.join("blocked.json");
        fs::create_dir(&directory).unwrap();
        fs::write(directory.join("original"), b"preserve").unwrap();
        assert!(write_backup_atomic(&directory, &backup, true).is_err());
        assert_eq!(fs::read(directory.join("original")).unwrap(), b"preserve");
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            let before = fs::read(&path).unwrap();
            let locked = OpenOptions::new()
                .read(true)
                .share_mode(0)
                .open(&path)
                .unwrap();
            backup.state = state(3);
            assert!(write_backup_atomic(&path, &backup, true).is_err());
            drop(locked);
            assert_eq!(fs::read(&path).unwrap(), before);
        }
        cleanup(&root);
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
}
