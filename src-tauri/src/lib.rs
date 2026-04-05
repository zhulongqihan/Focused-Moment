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

mod windows;
pub use windows::{create_timer_widget, create_todo_widget, toggle_timer_widget, toggle_todo_widget};

pub mod gacha;
pub use gacha::*;

pub mod resources;
pub use resources::*;

pub mod operator;
pub use operator::*;

pub mod timer;
pub use timer::*;

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

    // 初始化抽卡系统数据库表
    gacha::database::initialize_gacha_database(&conn)
        .map_err(|e| format!("failed to initialize gacha database: {e}"))?;

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

#[tauri::command]
async fn export_data_json(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    
    // Get the app state data
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_kv WHERE key = ?1")
        .map_err(|e| format!("failed to prepare export query: {e}"))?;

    let value: Option<String> = stmt
        .query_row(params![STATE_KEY], |row| row.get(0))
        .ok();

    let payload = value.unwrap_or_else(|| "{}".to_string());
    
    // Parse and pretty-print the JSON
    let json_value: serde_json::Value = serde_json::from_str(&payload)
        .map_err(|e| format!("failed to parse state data: {e}"))?;
    let pretty_json = serde_json::to_string_pretty(&json_value)
        .map_err(|e| format!("failed to format JSON: {e}"))?;
    
    // Show file save dialog
    let file_path = app.dialog()
        .file()
        .set_title("导出数据")
        .set_file_name("focused_moment_export.json")
        .add_filter("JSON 文件", &["json"])
        .blocking_save_file();
    
    match file_path {
        Some(FilePath::Path(path)) => {
            // Write the pretty-printed JSON to the selected file
            fs::write(&path, pretty_json)
                .map_err(|e| format!("failed to write export file: {e}"))?;
            
            Ok(path.to_string_lossy().to_string())
        }
        Some(FilePath::Url(_)) => {
            Err("URL paths are not supported".to_string())
        }
        None => {
            Err("用户取消了导出操作".to_string())
        }
    }
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

/// Check if AI is available (API key configured and working)
#[tauri::command]
async fn check_ai_available(state: State<'_, AppState>) -> Result<bool, String> {
    // Clone the client to avoid holding the lock across await
    let qwen_client = {
        let client = state.qwen_client.lock()
            .map_err(|e| format!("Failed to lock qwen client state: {}", e))?;
        
        match client.as_ref() {
            Some(c) => c.clone(),
            None => return Ok(false),
        }
    };
    
    // Test the connection with a simple prompt
    match qwen_client.generate_text("测试".to_string()).await {
        Ok(_) => Ok(true),
        Err(e) => {
            eprintln!("AI connection test failed: {}", e);
            Err(format!("AI 连接测试失败: {}", e))
        }
    }
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

/// Perform single gacha pull
#[tauri::command]
fn perform_single_gacha_pull(app: AppHandle) -> Result<GachaResult, String> {
    let conn = open_db(&app)?;
    gacha::single_pull::perform_single_gacha(&conn)
}

/// Perform ten gacha pulls
#[tauri::command]
fn perform_ten_gacha_pull(app: AppHandle) -> Result<GachaResult, String> {
    let conn = open_db(&app)?;
    gacha::ten_pull::perform_ten_gacha(&conn)
}

/// Get current gacha system state
#[tauri::command]
fn get_gacha_state(app: AppHandle) -> Result<GachaSystemState, String> {
    let conn = open_db(&app)?;
    gacha::database::load_gacha_system_state(&conn)
        .map_err(|e| format!("Failed to load gacha state: {}", e))
}

/// Get current currency
#[tauri::command]
fn get_currency(app: AppHandle) -> Result<Currency, String> {
    let conn = open_db(&app)?;
    gacha::database::load_currency(&conn)
        .map_err(|e| format!("Failed to load currency: {}", e))
}

/// Get current resources
#[tauri::command]
fn get_resources(app: AppHandle) -> Result<Resources, String> {
    let conn = open_db(&app)?;
    gacha::database::load_resources(&conn)
        .map_err(|e| format!("Failed to load resources: {}", e))
}

/// Update currency (for testing/admin purposes)
#[tauri::command]
fn update_currency_balance(app: AppHandle, currency: Currency) -> Result<(), String> {
    let conn = open_db(&app)?;
    gacha::database::update_currency(&conn, &currency)
        .map_err(|e| format!("Failed to update currency: {}", e))
}

/// Get current resources
#[tauri::command]
fn get_resources_balance(app: AppHandle) -> Result<Resources, String> {
    let conn = open_db(&app)?;
    resources::get_resources(&conn)
}

/// Add resources
#[tauri::command]
fn add_resources_amount(app: AppHandle, amount: Resources) -> Result<Resources, String> {
    let conn = open_db(&app)?;
    resources::add_resources(&conn, &amount)
}

/// Spend resources
#[tauri::command]
fn spend_resources_amount(app: AppHandle, cost: Resources) -> Result<Resources, String> {
    let conn = open_db(&app)?;
    resources::spend_resources(&conn, &cost)
}

/// Upgrade operator level
#[tauri::command]
fn upgrade_operator(app: AppHandle, operator_id: String) -> Result<UpgradeResult, String> {
    let conn = open_db(&app)?;
    operator::upgrade_operator_level(&conn, &operator_id)
}

/// Elite operator (promote to next elite level)
#[tauri::command]
fn elite_operator_promotion(app: AppHandle, operator_id: String) -> Result<UpgradeResult, String> {
    let conn = open_db(&app)?;
    operator::elite_operator(&conn, &operator_id)
}

/// Complete a focus session and grant rewards
#[tauri::command]
fn complete_focus_session(
    app: AppHandle,
    mode: String,
    duration_minutes: u32,
    challenge_completed: bool,
    timer_kind: String,
) -> Result<timer::SessionRewardResult, String> {
    let conn = open_db(&app)?;
    
    let session_mode = if mode == "work" {
        timer::SessionMode::Work
    } else {
        timer::SessionMode::Break
    };

    let timer_kind = if timer_kind == "countup" {
        timer::TimerKind::Countup
    } else {
        timer::TimerKind::Pomodoro
    };
    
    timer::apply_session_rewards(&conn, session_mode, timer_kind, true, duration_minutes, challenge_completed)
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
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            export_app_state,
            import_app_state,
            export_data_json,
            load_config,
            save_config,
            set_api_key,
            check_ai_available,
            generate_ai_summary,
            toggle_timer_widget,
            toggle_todo_widget,
            perform_single_gacha_pull,
            perform_ten_gacha_pull,
            get_gacha_state,
            get_currency,
            get_resources,
            update_currency_balance,
            get_resources_balance,
            add_resources_amount,
            spend_resources_amount,
            upgrade_operator,
            elite_operator_promotion,
            complete_focus_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
