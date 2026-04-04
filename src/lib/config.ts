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

/**
 * Boss names for boss round display
 * Format: "中文名 EnglishName"
 */
export const BOSS_NAMES = [
  "爱国者 Patriot",
  "塔露拉 Talulah",
  "霜星 FrostNova",
  "浮士德 Faust",
  "梅菲斯特 Mephisto",
  "碎骨 Crownslayer",
  "W W",
  "泥岩 Mudrock",
  "九 Nine",
  "曼弗雷德 Manfred",
  "伊桑 Ethan",
  "赫拉格 Hellagur",
  "凯尔希 Kal'tsit",
  "阿米娅 Amiya",
] as const;
