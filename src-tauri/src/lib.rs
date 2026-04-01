use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const STATE_KEY: &str = "state_v1";

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("failed to create app data dir: {e}"))?;

    Ok(app_data_dir.join("focused_moment.db"))
}

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|e| format!("failed to open sqlite db: {e}"))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("failed to initialize sqlite schema: {e}"))?;

    Ok(conn)
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<Option<String>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_kv WHERE key = ?1")
        .map_err(|e| format!("failed to prepare query: {e}"))?;

    let mut rows = stmt
        .query(params![STATE_KEY])
        .map_err(|e| format!("failed to query state: {e}"))?;

    if let Some(row) = rows
        .next()
        .map_err(|e| format!("failed to iterate rows: {e}"))?
    {
        let value: String = row
            .get(0)
            .map_err(|e| format!("failed to read state row: {e}"))?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn save_app_state(app: AppHandle, payload: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&payload)
        .map_err(|e| format!("invalid state payload: {e}"))?;

    let conn = open_db(&app)?;
    conn.execute(
        "INSERT INTO app_kv (key, value, updated_at)
         VALUES (?1, ?2, unixepoch())
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at",
        params![STATE_KEY, payload],
    )
    .map_err(|e| format!("failed to write state: {e}"))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_app_state, save_app_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
