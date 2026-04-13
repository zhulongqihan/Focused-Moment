use std::env;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{
    ContentPackState, FocusRecord, HeadhuntState, RewardLedgerEntry, RewardWallet, TodoItem,
};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";

#[derive(Clone)]
pub struct PersistenceStore {
    path: PathBuf,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub focus_records: Vec<FocusRecord>,
    pub next_record_id: u64,
    pub todo_items: Vec<TodoItem>,
    pub next_todo_id: u64,
    pub reward_wallet: RewardWallet,
    pub reward_ledger: Vec<RewardLedgerEntry>,
    pub next_reward_id: u64,
    pub content_pack_state: ContentPackState,
    pub headhunt_state: HeadhuntState,
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
            path: storage_dir.join(STORAGE_FILE_NAME),
        })
    }

    pub fn load(&self) -> Result<PersistedState, String> {
        if !self.path.exists() {
            return Ok(PersistedState::default());
        }

        let raw = fs::read_to_string(&self.path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn save(&self, state: &PersistedState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
        let temp_path = self.path.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &self.path).map_err(|error| error.to_string())
    }
}
