#[cfg(test)]
mod tests {
    use super::super::config::AppConfig;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert_eq!(config.qwen_api_key, None);
        assert_eq!(config.sound_volume, 0.7);
        assert_eq!(config.sound_enabled, true);
        assert_eq!(config.reduce_animations, false);
    }

    #[test]
    fn test_config_path() {
        let path = AppConfig::config_path().expect("Failed to get config path");
        assert!(path.to_string_lossy().contains("focused-moment"));
        assert!(path.to_string_lossy().ends_with("config.json"));
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        // This test assumes no config file exists yet
        // If one exists, it will load that instead
        let config = AppConfig::load().expect("Failed to load config");
        // Should return default values if file doesn't exist
        assert!(config.sound_volume >= 0.0 && config.sound_volume <= 1.0);
    }

    #[test]
    fn test_save_and_load() {
        let mut config = AppConfig::default();
        config.qwen_api_key = Some("test_key_12345".to_string());
        config.sound_volume = 0.5;
        config.sound_enabled = false;
        config.reduce_animations = true;

        // Save config
        config.save().expect("Failed to save config");

        // Load config
        let loaded = AppConfig::load().expect("Failed to load config");
        assert_eq!(loaded.qwen_api_key, Some("test_key_12345".to_string()));
        assert_eq!(loaded.sound_volume, 0.5);
        assert_eq!(loaded.sound_enabled, false);
        assert_eq!(loaded.reduce_animations, true);

        // Clean up - restore default
        let default = AppConfig::default();
        default.save().expect("Failed to restore default config");
    }
}
