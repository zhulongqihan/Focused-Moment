use std::env;
use std::fs;
use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::{
    ContentPackState, FocusRecord, HeadhuntState, RewardLedgerEntry, RewardWallet, TodoItem,
};

const STORAGE_DIR_NAME: &str = "FocusedMoment";
const STORAGE_FILE_NAME: &str = "focused-moment-state.json";
const CONTENT_PACK_FILE_NAME: &str = "focused-moment-content-pack.json";

#[derive(Clone)]
pub struct PersistenceStore {
    state_path: PathBuf,
    content_pack_path: PathBuf,
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
            state_path: storage_dir.join(STORAGE_FILE_NAME),
            content_pack_path: storage_dir.join(CONTENT_PACK_FILE_NAME),
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
        self.write_atomically(&self.state_path, &serialized)
    }

    pub fn load_content_pack<T>(&self) -> Result<Option<T>, String>
    where
        T: DeserializeOwned,
    {
        if !self.content_pack_path.exists() {
            return Ok(None);
        }

        let raw =
            fs::read_to_string(&self.content_pack_path).map_err(|error| error.to_string())?;
        let parsed = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        Ok(Some(parsed))
    }

    pub fn save_content_pack<T>(&self, content_pack: &T) -> Result<(), String>
    where
        T: Serialize,
    {
        let serialized =
            serde_json::to_string_pretty(content_pack).map_err(|error| error.to_string())?;
        self.write_atomically(&self.content_pack_path, &serialized)
    }

    pub fn delete_content_pack(&self) -> Result<(), String> {
        if !self.content_pack_path.exists() {
            return Ok(());
        }

        fs::remove_file(&self.content_pack_path).map_err(|error| error.to_string())
    }

    fn write_atomically(&self, destination: &PathBuf, serialized: &str) -> Result<(), String> {
        let temp_path = destination.with_extension("tmp");

        fs::write(&temp_path, serialized).map_err(|error| error.to_string())?;

        if destination.exists() {
            fs::remove_file(destination).map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, destination).map_err(|error| error.to_string())
    }
}
