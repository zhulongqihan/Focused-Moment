use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub qwen_api_key: Option<String>,
    pub sound_volume: f32,
    pub sound_enabled: bool,
    pub reduce_animations: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            qwen_api_key: None,
            sound_volume: 0.7,
            sound_enabled: true,
            reduce_animations: false,
        }
    }
}

impl AppConfig {
    /// Returns the path to the configuration file: ~/.config/focused-moment/config.json
    pub fn config_path() -> Result<PathBuf, String> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| "Failed to get config directory".to_string())?;
        
        let app_config_dir = config_dir.join("focused-moment");
        Ok(app_config_dir.join("config.json"))
    }

    /// Load configuration from disk, returns default config if file doesn't exist
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;
        
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        
        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config file: {}", e))?;
        
        Ok(config)
    }

    /// Save configuration to disk
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        
        Ok(())
    }
}
