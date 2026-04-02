use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

mod config;
pub use config::AppConfig;

mod ai;
pub use ai::QwenClient;

#[cfg(test)]
mod config_test;

/// Application state for managing configuration
pub struct AppState {
    config: Mutex<AppConfig>,
    qwen_client: Mutex<Option<QwenClient>>,
}

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

#[tauri::command]
fn export_app_state(app: AppHandle) -> Result<String, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_kv WHERE key = ?1")
        .map_err(|e| format!("failed to prepare export query: {e}"))?;

    let value: Option<String> = stmt
        .query_row(params![STATE_KEY], |row| row.get(0))
        .ok();

    let payload = value.unwrap_or_else(|| "{}".to_string());
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    let backup_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("failed to create backup dir: {e}"))?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("failed to get timestamp: {e}"))?
        .as_secs();
    let file_path = backup_dir.join(format!("focused_moment_backup_{ts}.json"));
    fs::write(&file_path, payload).map_err(|e| format!("failed to write backup file: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn import_app_state(app: AppHandle, payload: String) -> Result<(), String> {
    save_app_state(app, payload)
}

/// Load application configuration
#[tauri::command]
fn load_config(state: State<AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock()
        .map_err(|e| format!("Failed to lock config state: {}", e))?;
    Ok(config.clone())
}

/// Save application configuration
#[tauri::command]
fn save_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    // Save to disk
    config.save()?;
    
    // Update in-memory state
    let mut state_config = state.config.lock()
        .map_err(|e| format!("Failed to lock config state: {}", e))?;
    *state_config = config;
    
    Ok(())
}

/// Set Qwen API key
#[tauri::command]
fn set_api_key(state: State<AppState>, api_key: String) -> Result<(), String> {
    let mut config = state.config.lock()
        .map_err(|e| format!("Failed to lock config state: {}", e))?;
    
    config.qwen_api_key = Some(api_key.clone());
    config.save()?;
    
    // Update QwenClient in state
    let mut client = state.qwen_client.lock()
        .map_err(|e| format!("Failed to lock qwen client state: {}", e))?;
    
    if !api_key.trim().is_empty() {
        *client = Some(QwenClient::new(api_key)?);
    } else {
        *client = None;
    }
    
    Ok(())
}

/// Check if AI is available (API key configured)
#[tauri::command]
fn check_ai_available(state: State<AppState>) -> Result<bool, String> {
    let client = state.qwen_client.lock()
        .map_err(|e| format!("Failed to lock qwen client state: {}", e))?;
    
    Ok(client.is_some())
}

/// Generate AI summary for daily focus sessions
#[tauri::command]
async fn generate_ai_summary(state: State<'_, AppState>, focus_data: String) -> Result<String, String> {
    // Clone the client to avoid holding the lock across await
    let qwen_client = {
        let client = state.qwen_client.lock()
            .map_err(|e| format!("Failed to lock qwen client state: {}", e))?;
        
        client.as_ref()
            .ok_or_else(|| "AI 功能未配置。请先在设置中配置通义千问 API Key。".to_string())?
            .clone()
    };
    
    // Create prompt for daily summary
    let prompt = format!(
        "请根据以下专注数据生成一份简洁的每日总结（200字以内）：\n\n{}\n\n请包含：\n1. 今日专注时长和完成情况\n2. 主要成就\n3. 改进建议",
        focus_data
    );
    
    qwen_client.generate_text(prompt).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load configuration on startup
    let config = AppConfig::load().unwrap_or_else(|e| {
        eprintln!("Failed to load config, using defaults: {}", e);
        AppConfig::default()
    });
    
    // Initialize QwenClient if API key is configured
    let qwen_client = if let Some(ref api_key) = config.qwen_api_key {
        if !api_key.trim().is_empty() {
            match QwenClient::new(api_key.clone()) {
                Ok(client) => Some(client),
                Err(e) => {
                    eprintln!("Failed to initialize QwenClient: {}", e);
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    let app_state = AppState {
        config: Mutex::new(config),
        qwen_client: Mutex::new(qwen_client),
    };
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            export_app_state,
            import_app_state,
            load_config,
            save_config,
            set_api_key,
            check_ai_available,
            generate_ai_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
