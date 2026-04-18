use std::env;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{FocusRecord, TodoItem};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";
const RUNTIME_FILE_NAME: &str = "focused-moment-runtime.json";

#[derive(Clone)]
pub struct PersistenceStore {
    state_path: PathBuf,
    runtime_path: PathBuf,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub focus_records: Vec<FocusRecord>,
    pub next_record_id: u64,
    pub todo_items: Vec<TodoItem>,
    pub next_todo_id: u64,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedRuntimeState {
    pub mode_key: String,
    pub stopwatch_elapsed_ms: u64,
    pub pomodoro_elapsed_ms: u64,
    pub pomodoro_phase_key: String,
    pub pending_pomodoro_record_ms: Option<u64>,
    pub is_running: bool,
    pub anchor_wall_clock_ms: Option<u64>,
    pub current_task_title: String,
    pub linked_todo_id: Option<u64>,
    pub completed_focus_count: u64,
    pub completed_break_count: u64,
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
        })
    }

    pub fn load(&self) -> Result<PersistedState, String> {
        if !self.state_path.exists() {
            return Ok(PersistedState::default());
        }

        let raw = fs::read_to_string(&self.state_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn save(&self, state: &PersistedState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
        let temp_path = self.state_path.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if self.state_path.exists() {
            fs::remove_file(&self.state_path).map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &self.state_path).map_err(|error| error.to_string())
    }

    pub fn load_runtime(&self) -> Result<PersistedRuntimeState, String> {
        if !self.runtime_path.exists() {
            return Ok(PersistedRuntimeState::default());
        }

        let raw = fs::read_to_string(&self.runtime_path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn save_runtime(&self, state: &PersistedRuntimeState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
        let temp_path = self.runtime_path.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if self.runtime_path.exists() {
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
}
