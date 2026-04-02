import { invoke } from '@tauri-apps/api/core';

/**
 * Application configuration structure
 */
export interface AppConfig {
  qwen_api_key: string | null;
  sound_volume: number;
  sound_enabled: boolean;
  reduce_animations: boolean;
}

/**
 * Load application configuration from disk
 */
export async function loadConfig(): Promise<AppConfig> {
  return await invoke<AppConfig>('load_config');
}

/**
 * Save application configuration to disk
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke('save_config', { config });
}

/**
 * Set Qwen API key
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await invoke('set_api_key', { apiKey });
}
