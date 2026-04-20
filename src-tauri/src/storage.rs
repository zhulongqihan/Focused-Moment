use std::env;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{FocusRecord, TimerPreferences, TodoItem};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";
const RUNTIME_FILE_NAME: &str = "focused-moment-runtime.json";
const STATE_BACKUP_FILE_NAME: &str = "focused-moment-state.backup.json";
const RUNTIME_BACKUP_FILE_NAME: &str = "focused-moment-runtime.backup.json";
const USER_BACKUP_DIR_NAME: &str = "Focused Moment Backups";
const USER_BACKUP_PREFIX: &str = "focused-moment-backup-v1-";
const USER_BACKUP_SUFFIX: &str = ".json";

#[derive(Clone)]
pub struct PersistenceStore {
    state_path: PathBuf,
    runtime_path: PathBuf,
    state_backup_path: PathBuf,
    runtime_backup_path: PathBuf,
}

fn resolve_app_directory() -> Result<PathBuf, String> {
    if let Ok(executable_path) = env::current_exe() {
        if let Some(parent) = executable_path.parent() {
            return Ok(parent.to_path_buf());
        }
    }

    env::current_dir().map_err(|error| error.to_string())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBackupFile {
    pub kind: String,
    pub format_version: u64,
    pub app_version: String,
    pub exported_at: String,
    pub state: PersistedState,
    pub runtime: PersistedRuntimeState,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
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
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedRuntimeState {
    #[serde(default)]
    pub mode_key: String,
    #[serde(default)]
    pub stopwatch_elapsed_ms: u64,
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
    pub completed_focus_count: u64,
    #[serde(default)]
    pub completed_break_count: u64,
    #[serde(default)]
    pub alert_sequence: u64,
    #[serde(default)]
    pub active_alert_key: Option<String>,
    #[serde(default)]
    pub stopwatch_target_alerted: bool,
}

impl PersistenceStore {
    pub fn new() -> Result<Self, String> {
        let base_dir = env::var_os("LOCALAPPDATA")
            .or_else(|| env::var_os("APPDATA"))
            .map(PathBuf::from)
            .unwrap_or(env::current_dir().map_err(|error| error.to_string())?);

        let storage_dir = base_dir.join(STORAGE_DIR_NAME);
        fs::create_dir_all(&storage_dir).map_err(|error| error.to_string())?;

        Ok(Self {
            state_path: storage_dir.join(STORAGE_FILE_NAME),
            runtime_path: storage_dir.join(RUNTIME_FILE_NAME),
            state_backup_path: storage_dir.join(STATE_BACKUP_FILE_NAME),
            runtime_backup_path: storage_dir.join(RUNTIME_BACKUP_FILE_NAME),
        })
    }

    pub fn load(&self) -> Result<PersistedState, String> {
        if !self.state_path.exists() {
            return Ok(PersistedState::default());
        }

        let raw = fs::read_to_string(&self.state_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).or_else(|_| self.load_backup_state())
    }

    pub fn save(&self, state: &PersistedState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
        let temp_path = self.state_path.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if self.state_path.exists() {
            fs::copy(&self.state_path, &self.state_backup_path)
                .map_err(|error| error.to_string())?;
            fs::remove_file(&self.state_path).map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &self.state_path).map_err(|error| error.to_string())
    }

    pub fn load_runtime(&self) -> Result<PersistedRuntimeState, String> {
        if !self.runtime_path.exists() {
            return Ok(PersistedRuntimeState::default());
        }

        let raw = fs::read_to_string(&self.runtime_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).or_else(|_| self.load_backup_runtime())
    }

    pub fn save_runtime(&self, state: &PersistedRuntimeState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
        let temp_path = self.runtime_path.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if self.runtime_path.exists() {
            fs::copy(&self.runtime_path, &self.runtime_backup_path)
                .map_err(|error| error.to_string())?;
            fs::remove_file(&self.runtime_path).map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &self.runtime_path).map_err(|error| error.to_string())
    }

    pub fn clear_runtime(&self) -> Result<(), String> {
        if self.runtime_path.exists() {
            fs::remove_file(&self.runtime_path).map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    pub fn user_backup_dir(&self) -> Result<PathBuf, String> {
        let backup_dir = resolve_app_directory()?.join(USER_BACKUP_DIR_NAME);
        fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
        Ok(backup_dir)
    }

    pub fn save_user_backup(
        &self,
        file_name: &str,
        backup: &AppBackupFile,
    ) -> Result<PathBuf, String> {
        let backup_dir = self.user_backup_dir()?;
        let backup_path = backup_dir.join(file_name);
        let serialized =
            serde_json::to_string_pretty(backup).map_err(|error| error.to_string())?;
        fs::write(&backup_path, serialized).map_err(|error| error.to_string())?;
        Ok(backup_path)
    }

    pub fn load_user_backup(&self, file_name: &str) -> Result<AppBackupFile, String> {
        if !Self::is_supported_backup_file_name(file_name) {
            return Err("备份文件名不合法。".to_string());
        }

        let backup_path = self.user_backup_dir()?.join(file_name);
        let raw = fs::read_to_string(&backup_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn list_user_backups(&self) -> Result<Vec<(String, AppBackupFile)>, String> {
        let backup_dir = self.user_backup_dir()?;
        let mut backups = Vec::new();

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

        backups.sort_by(|left, right| right.0.cmp(&left.0));
        Ok(backups)
    }

    pub fn is_supported_backup_file_name(file_name: &str) -> bool {
        file_name.starts_with(USER_BACKUP_PREFIX)
            && file_name.ends_with(USER_BACKUP_SUFFIX)
            && !file_name.contains(['\\', '/', ':'])
    }

    fn load_backup_state(&self) -> Result<PersistedState, String> {
        if !self.state_backup_path.exists() {
            return Err("无法读取当前存档，且没有可用的状态快照备份。".to_string());
        }

        let raw =
            fs::read_to_string(&self.state_backup_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    fn load_backup_runtime(&self) -> Result<PersistedRuntimeState, String> {
        if !self.runtime_backup_path.exists() {
            return Err("无法读取当前运行态存档，且没有可用的运行态快照备份。".to_string());
        }

        let raw =
            fs::read_to_string(&self.runtime_backup_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }
}
