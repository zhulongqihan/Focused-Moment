mod headhunt_catalog;
mod storage;

use std::cmp::Reverse;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use chrono::{Local, TimeZone};
use headhunt_catalog::{
    all_banners as catalog_all_banners, banner_by_id as catalog_banner_by_id,
    operator_by_id as catalog_operator_by_id, operators_for_banner_rarity as catalog_ops_for_rarity,
    rate_up_ids_for_rarity as catalog_rate_up_ids_for_rarity,
    rate_up_share_for_rarity as catalog_rate_up_share_for_rarity,
    BannerDef as CatalogBannerDef, BannerKind as CatalogBannerKind, DEFAULT_BANNER_ID as CATALOG_DEFAULT_BANNER_ID,
};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use storage::{PersistedState, PersistenceStore};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Window, WindowEvent};

const POMODORO_FOCUS_MS: u64 = 25 * 60 * 1000;
const POMODORO_BREAK_MS: u64 = 5 * 60 * 1000;
const TRAY_SHOW_ID: &str = "tray_show_main";
const TRAY_QUIT_ID: &str = "tray_quit_app";
const HEADHUNT_SINGLE_COST: u64 = 600;
const HEADHUNT_TEN_COST: u64 = 6_000;
const CONTENT_PACK_SCHEMA_VERSION: u32 = 1;
const CONTENT_PACK_CHANNEL: &str = "cn-stable";
const CONTENT_PACK_SERVER: &str = "cn";
const CONTENT_PACK_SERVER_LABEL: &str = "国服";
const DEFAULT_CONTENT_PACK_VERSION: &str = "cn-baseline-2026.04.18.1";
const DEFAULT_CONTENT_PACK_UPDATED_AT: &str = "2026-04-18 12:00";
const DEFAULT_CONTENT_PACK_SOURCE_LABEL: &str = "Focused Moment 内置国服基线";
const CN_GACHA_TABLE_URLS: [&str; 2] = [
    "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/gacha_table.json",
    "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/gacha_table.json",
];
const CN_CHARACTER_TABLE_URLS: [&str; 2] = [
    "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/character_table.json",
    "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json",
];
const CN_GACHA_DETAIL_URLS: [&str; 1] = ["https://weedy.prts.wiki/gacha_table.json"];
const REMOTE_CONTENT_MANIFEST_URL: &str =
    "https://github.com/zhulongqihan/Focused-Moment/releases/download/content-cn-stable/focused-moment-content-cn-manifest.json";
const REMOTE_CONTENT_PACK_URL: &str =
    "https://github.com/zhulongqihan/Focused-Moment/releases/download/content-cn-stable/focused-moment-content-cn-pack.json";
const BUNDLED_CONTENT_PACK_JSON: &str =
    include_str!("../content/focused-moment-content-cn-pack.json");

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellPanel {
    id: &'static str,
    title: &'static str,
    phase: &'static str,
    status: &'static str,
    summary: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellSnapshot {
    product_name: &'static str,
    version: &'static str,
    milestone: &'static str,
    slogan: &'static str,
    surfaces: Vec<ShellPanel>,
    reserved_extensions: Vec<ShellPanel>,
}

struct AppLifecycleState {
    is_quitting: Mutex<bool>,
}

impl AppLifecycleState {
    fn new() -> Self {
        Self {
            is_quitting: Mutex::new(false),
        }
    }

    fn mark_quitting(&self) {
        if let Ok(mut flag) = self.is_quitting.lock() {
            *flag = true;
        }
    }

    fn is_quitting(&self) -> bool {
        self.is_quitting.lock().map(|flag| *flag).unwrap_or(false)
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerSnapshot {
    mode_key: &'static str,
    phase_key: &'static str,
    mode: &'static str,
    phase_label: &'static str,
    status: &'static str,
    is_running: bool,
    elapsed_ms: u64,
    elapsed_label: String,
    secondary_label: &'static str,
    can_complete_session: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FocusRecord {
    id: u64,
    title: String,
    duration_ms: u64,
    duration_label: String,
    mode_key: String,
    mode_label: String,
    phase_label: String,
    linked_todo_id: Option<u64>,
    linked_todo_title: Option<String>,
    #[serde(default)]
    completed_at: String,
    #[serde(default)]
    completed_date: String,
    #[serde(default)]
    completed_time: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletionPayload {
    timer_snapshot: TimerSnapshot,
    records: Vec<FocusRecord>,
    reward_snapshot: RewardSnapshot,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyInsight {
    date: String,
    total_duration_ms: u64,
    total_duration_label: String,
    session_count: usize,
    linked_session_count: usize,
    independent_session_count: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsSnapshot {
    total_focus_duration_ms: u64,
    total_focus_duration_label: String,
    session_count: usize,
    linked_session_count: usize,
    independent_session_count: usize,
    pending_todo_count: usize,
    completed_todo_count: usize,
    active_days: usize,
    average_daily_duration_label: String,
    today_focus_duration_label: String,
    today_session_count: usize,
    daily_breakdown: Vec<DailyInsight>,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RewardWallet {
    lmd: u64,
    orundum: u64,
    originium: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RewardLedgerEntry {
    id: u64,
    #[serde(default)]
    source_record_id: u64,
    source_title: String,
    source_mode_label: String,
    duration_ms: u64,
    duration_label: String,
    lmd: u64,
    orundum: u64,
    originium: u64,
    completed_at: String,
    completed_date: String,
    completed_time: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RewardSnapshot {
    wallet: RewardWallet,
    today_focus_duration_ms: u64,
    today_focus_duration_label: String,
    current_streak_days: usize,
    total_reward_count: usize,
    latest_rewards: Vec<RewardLedgerEntry>,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContentPackState {
    current_version: String,
    current_server: String,
    current_updated_at: String,
    operator_count: usize,
    banner_count: usize,
    last_checked_at: Option<String>,
    last_synced_at: Option<String>,
    source_label: String,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ContentBannerOverride {
    slot: String,
    source_pool_id: String,
    name: String,
    summary: String,
    starts_at: String,
    ends_at: String,
    rate_up_six_names: Vec<String>,
    rate_up_five_names: Vec<String>,
    rate_up_four_names: Vec<String>,
}

impl Default for ContentPackState {
    fn default() -> Self {
        Self {
            current_version: DEFAULT_CONTENT_PACK_VERSION.to_string(),
            current_server: "国服".to_string(),
            current_updated_at: DEFAULT_CONTENT_PACK_UPDATED_AT.to_string(),
            operator_count: 410,
            banner_count: 3,
            last_checked_at: None,
            last_synced_at: None,
            source_label: "应用内置国服基线".to_string(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ContentPackFile {
    schema_version: u32,
    pack_version: String,
    server: String,
    updated_at: String,
    operator_count: usize,
    banner_count: usize,
    source_label: String,
    banners: Vec<ContentBannerOverride>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContentPackManifest {
    schema_version: u32,
    channel: String,
    server: String,
    pack_version: String,
    published_at: String,
    operator_count: usize,
    banner_count: usize,
    asset_name: String,
    asset_sha256: String,
    source_label: String,
    notes: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentPackSnapshot {
    current_version: String,
    current_server: String,
    current_updated_at: String,
    operator_count: usize,
    banner_count: usize,
    last_checked_at: Option<String>,
    last_synced_at: Option<String>,
    source_label: String,
    status_label: String,
    status_note: String,
    update_available: bool,
    remote_version: Option<String>,
    remote_updated_at: Option<String>,
    remote_operator_count: Option<usize>,
    remote_banner_count: Option<usize>,
    is_syncing: bool,
    supports_manual_import: bool,
}

#[derive(Clone, Default)]
struct ContentPackSyncState {
    in_progress: bool,
    status_label: Option<String>,
    status_note: Option<String>,
    remote_state: Option<ContentPackRemoteState>,
}

#[derive(Clone, Default)]
struct ContentPackRemoteState {
    version: String,
    updated_at: String,
    operator_count: usize,
    banner_count: usize,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteBaseGachaTable {
    gacha_pool_client: Vec<RemoteBasePool>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteBasePool {
    gacha_pool_id: String,
    gacha_pool_name: String,
    gacha_pool_summary: Option<String>,
    gacha_rule_type: String,
    open_time: i64,
    end_time: i64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteDetailGachaTable {
    gacha_pool_client: Vec<RemoteDetailPool>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteDetailPool {
    gacha_pool_id: String,
    gacha_pool_detail: Option<RemotePoolDetail>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemotePoolDetail {
    detail_info: Option<RemotePoolDetailInfo>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemotePoolDetailInfo {
    up_char_info: Option<RemoteUpCharInfo>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteUpCharInfo {
    per_char_list: Vec<RemoteUpCharEntry>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteUpCharEntry {
    rarity_rank: u8,
    char_id_list: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeadhuntBannerSnapshot {
    id: String,
    name: String,
    summary: String,
    banner_type_label: String,
    starts_at: String,
    ends_at: String,
    rate_up_names: Vec<String>,
    rate_up_six_names: Vec<String>,
    rate_up_five_names: Vec<String>,
    rate_up_four_names: Vec<String>,
    pity_group_label: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeadhuntPullResult {
    id: u64,
    banner_id: String,
    banner_name: String,
    operator_id: String,
    operator_name: String,
    rarity: u8,
    profession: String,
    is_rate_up: bool,
    is_new: bool,
    cost_orundum: u64,
    pulled_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeadhuntOwnedOperator {
    operator_id: String,
    operator_name: String,
    rarity: u8,
    count: u32,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadhuntState {
    current_banner_id: String,
    history: Vec<HeadhuntPullResult>,
    owned_operators: Vec<HeadhuntOwnedOperator>,
    next_pull_id: u64,
    total_pulls: u64,
    pity_without_six_star: u32,
    #[serde(default)]
    kernel_pity_without_six_star: u32,
}

impl Default for HeadhuntState {
    fn default() -> Self {
        Self {
            current_banner_id: CATALOG_DEFAULT_BANNER_ID.to_string(),
            history: Vec::new(),
            owned_operators: Vec::new(),
            next_pull_id: 0,
            total_pulls: 0,
            pity_without_six_star: 0,
            kernel_pity_without_six_star: 0,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeadhuntSnapshot {
    current_banner: HeadhuntBannerSnapshot,
    available_banners: Vec<HeadhuntBannerSnapshot>,
    wallet_orundum: u64,
    total_pulls: u64,
    pity_without_six_star: u32,
    pulls_until_soft_pity: u32,
    unique_owned_count: usize,
    owned_operators: Vec<HeadhuntOwnedOperator>,
    recent_results: Vec<HeadhuntPullResult>,
    history: Vec<HeadhuntPullResult>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeadhuntPayload {
    snapshot: HeadhuntSnapshot,
    batch_results: Vec<HeadhuntPullResult>,
    spent_orundum: u64,
    is_preview: bool,
}

#[derive(Clone, Copy)]
struct HeadhuntOperatorDefinition {
    id: &'static str,
    name: &'static str,
    rarity: u8,
    profession: &'static str,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoItem {
    id: u64,
    title: String,
    is_completed: bool,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
}

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum TimerMode {
    #[default]
    Stopwatch,
    Pomodoro,
}

#[derive(Clone, Copy, Default, Eq, PartialEq)]
enum PomodoroPhase {
    #[default]
    Focus,
    Break,
}

#[derive(Clone, Copy)]
struct RunAnchor {
    monotonic: Instant,
    wall_clock: SystemTime,
}

struct TimerEngineState {
    timer: Mutex<TimerEngine>,
    focus_records: Mutex<Vec<FocusRecord>>,
    next_record_id: Mutex<u64>,
    todo_items: Mutex<Vec<TodoItem>>,
    next_todo_id: Mutex<u64>,
    reward_wallet: Mutex<RewardWallet>,
    reward_ledger: Mutex<Vec<RewardLedgerEntry>>,
    next_reward_id: Mutex<u64>,
    content_pack_state: Mutex<ContentPackState>,
    content_pack_banners: Mutex<Vec<ContentBannerOverride>>,
    content_pack_sync_state: Mutex<ContentPackSyncState>,
    headhunt_state: Mutex<HeadhuntState>,
    persistence: Option<PersistenceStore>,
}

#[derive(Default)]
struct TimerEngine {
    mode: TimerMode,
    running_anchor: Option<RunAnchor>,
    stopwatch_elapsed_ms: u64,
    pomodoro_elapsed_ms: u64,
    pomodoro_phase: PomodoroPhase,
    pending_pomodoro_record_ms: Option<u64>,
}

struct CompletedSession {
    duration_ms: u64,
    mode_key: &'static str,
    mode_label: &'static str,
    phase_label: &'static str,
}

fn default_content_pack_file() -> ContentPackFile {
    ContentPackFile {
        schema_version: CONTENT_PACK_SCHEMA_VERSION,
        pack_version: DEFAULT_CONTENT_PACK_VERSION.to_string(),
        server: CONTENT_PACK_SERVER.to_string(),
        updated_at: DEFAULT_CONTENT_PACK_UPDATED_AT.to_string(),
        operator_count: 410,
        banner_count: 3,
        source_label: DEFAULT_CONTENT_PACK_SOURCE_LABEL.to_string(),
        banners: vec![
            ContentBannerOverride {
                slot: "event".to_string(),
                source_pool_id: "cn-event-202604".to_string(),
                name: "活动寻访·怒潮凛冬".to_string(),
                summary: "内置基线卡池：6 星 UP 为怒潮凛冬，5 星 UP 为婉晴、谷芽。"
                    .to_string(),
                starts_at: "2026-04-11 16:00".to_string(),
                ends_at: "2026-04-25 03:59".to_string(),
                rate_up_six_names: vec!["怒潮凛冬".to_string()],
                rate_up_five_names: vec!["婉晴".to_string(), "谷芽".to_string()],
                rate_up_four_names: vec!["豆苗".to_string()],
            },
            ContentBannerOverride {
                slot: "standard".to_string(),
                source_pool_id: "cn-standard-202604".to_string(),
                name: "标准寻访·轮换常驻".to_string(),
                summary: "内置基线卡池：6 星 UP 为斥罪、玛恩纳。".to_string(),
                starts_at: "2026-04-14 04:00".to_string(),
                ends_at: "2026-04-28 03:59".to_string(),
                rate_up_six_names: vec!["斥罪".to_string(), "玛恩纳".to_string()],
                rate_up_five_names: vec![
                    "拉普兰德".to_string(),
                    "夏栎".to_string(),
                    "白面鸮".to_string(),
                ],
                rate_up_four_names: Vec::new(),
            },
            ContentBannerOverride {
                slot: "kernel".to_string(),
                source_pool_id: "cn-kernel-202604".to_string(),
                name: "中坚寻访·轮换精选".to_string(),
                summary: "内置基线卡池：6 星 UP 为塞雷娅、温蒂。".to_string(),
                starts_at: "2026-04-14 04:00".to_string(),
                ends_at: "2026-04-28 03:59".to_string(),
                rate_up_six_names: vec!["塞雷娅".to_string(), "温蒂".to_string()],
                rate_up_five_names: vec![
                    "诗怀雅".to_string(),
                    "格劳克斯".to_string(),
                    "凛冬".to_string(),
                ],
                rate_up_four_names: Vec::new(),
            },
        ],
    }
}

fn validate_banner_slot(slot: &str) -> bool {
    matches!(slot, "event" | "standard" | "kernel")
}

fn validate_content_pack_file(mut content_pack: ContentPackFile) -> Result<ContentPackFile, String> {
    if content_pack.schema_version != CONTENT_PACK_SCHEMA_VERSION {
        return Err("内容包校验失败：schemaVersion 不受当前版本支持。".to_string());
    }

    if content_pack.server.trim() != CONTENT_PACK_SERVER {
        return Err("内容包校验失败：当前只支持国服 cn 内容包。".to_string());
    }

    if content_pack.pack_version.trim().is_empty() {
        return Err("内容包校验失败：packVersion 不能为空。".to_string());
    }

    let mut seen_slots = HashSet::new();
    for banner in &content_pack.banners {
        if !validate_banner_slot(&banner.slot) {
            return Err(format!(
                "内容包校验失败：检测到不支持的卡池槽位 {}。",
                banner.slot
            ));
        }

        if !seen_slots.insert(banner.slot.clone()) {
            return Err(format!(
                "内容包校验失败：{} 槽位在同一内容包里重复出现。",
                banner.slot
            ));
        }
    }

    content_pack.banner_count = content_pack.banners.len();
    if content_pack.source_label.trim().is_empty() {
        content_pack.source_label = "Focused Moment 国服内容快照".to_string();
    }

    Ok(content_pack)
}

fn load_bundled_content_pack() -> Result<ContentPackFile, String> {
    let raw_pack: ContentPackFile =
        serde_json::from_str(BUNDLED_CONTENT_PACK_JSON).map_err(|error| {
            format!("failed to parse bundled content pack: {error}")
        })?;
    validate_content_pack_file(raw_pack)
}

fn build_content_pack_state(
    content_pack: &ContentPackFile,
    last_checked_at: Option<String>,
    last_synced_at: Option<String>,
) -> ContentPackState {
    ContentPackState {
        current_version: content_pack.pack_version.clone(),
        current_server: CONTENT_PACK_SERVER_LABEL.to_string(),
        current_updated_at: content_pack.updated_at.clone(),
        operator_count: content_pack.operator_count,
        banner_count: content_pack.banner_count,
        last_checked_at,
        last_synced_at,
        source_label: content_pack.source_label.clone(),
    }
}

fn build_remote_state(content_pack: &ContentPackFile) -> ContentPackRemoteState {
    ContentPackRemoteState {
        version: content_pack.pack_version.clone(),
        updated_at: content_pack.updated_at.clone(),
        operator_count: content_pack.operator_count,
        banner_count: content_pack.banner_count,
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut output = String::with_capacity(digest.len() * 2);
    for byte in digest {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

fn build_content_sync_client(bypass_proxy: bool) -> Result<Client, String> {
    let mut builder = Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(12))
        .use_rustls_tls();

    if bypass_proxy {
        builder = builder.no_proxy();
    }

    builder.build().map_err(|error| {
        if bypass_proxy {
            format!("创建直连内容同步客户端失败：{error}")
        } else {
            format!("创建代理内容同步客户端失败：{error}")
        }
    })
}

fn fetch_json_from_content_source<T: for<'de> Deserialize<'de>>(
    client: &Client,
    url: &str,
) -> Result<T, String> {
    client
        .get(url)
        .send()
        .map_err(|error| format!("无法访问 Focused Moment 内容源：{error}"))?
        .error_for_status()
        .map_err(|error| format!("Focused Moment 内容源返回异常状态：{error}"))?
        .json::<T>()
        .map_err(|error| format!("无法解析 Focused Moment 内容源返回的 JSON：{error}"))
}

fn fetch_bytes_from_content_source(client: &Client, url: &str) -> Result<Vec<u8>, String> {
    client
        .get(url)
        .send()
        .map_err(|error| format!("无法访问 Focused Moment 内容源：{error}"))?
        .error_for_status()
        .map_err(|error| format!("Focused Moment 内容源返回异常状态：{error}"))?
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("读取 Focused Moment 内容包失败：{error}"))
}

fn fetch_remote_content_manifest_and_pack() -> Result<(ContentPackManifest, ContentPackFile), String> {
    let clients = [
        build_content_sync_client(false)?,
        build_content_sync_client(true)?,
    ];
    let mut failures = Vec::new();

    for client in clients {
        let attempt = (|| {
            let manifest: ContentPackManifest =
                fetch_json_from_content_source(&client, REMOTE_CONTENT_MANIFEST_URL)?;

            if manifest.schema_version != CONTENT_PACK_SCHEMA_VERSION {
                return Err("内容包校验失败：manifest schemaVersion 不匹配。".to_string());
            }
            if manifest.channel.trim() != CONTENT_PACK_CHANNEL {
                return Err("内容包校验失败：manifest channel 不正确。".to_string());
            }
            if manifest.server.trim() != CONTENT_PACK_SERVER {
                return Err("内容包校验失败：manifest server 不正确。".to_string());
            }
            if manifest.asset_name.trim() != "focused-moment-content-cn-pack.json" {
                return Err("内容包校验失败：manifest assetName 不正确。".to_string());
            }

            let pack_bytes = fetch_bytes_from_content_source(&client, REMOTE_CONTENT_PACK_URL)?;
            let actual_sha = sha256_hex(&pack_bytes);
            if !manifest.asset_sha256.eq_ignore_ascii_case(&actual_sha) {
                return Err("内容包校验失败：下载后的 pack sha256 与 manifest 不一致。".to_string());
            }

            let pack_text = String::from_utf8(pack_bytes)
                .map_err(|error| format!("内容包校验失败：pack 文件不是合法 UTF-8：{error}"))?;
            let pack: ContentPackFile = serde_json::from_str(&pack_text)
                .map_err(|error| format!("内容包校验失败：pack JSON 无法解析：{error}"))?;
            let validated_pack = validate_content_pack_file(pack)?;

            if validated_pack.pack_version != manifest.pack_version {
                return Err("内容包校验失败：manifest 与 packVersion 不一致。".to_string());
            }

            Ok((manifest, validated_pack))
        })();

        match attempt {
            Ok(value) => return Ok(value),
            Err(error) => failures.push(error),
        }
    }

    Err(failures.join("；"))
}

impl TimerEngineState {
    fn new() -> Self {
        let persistence = PersistenceStore::new()
            .map_err(|error| {
                eprintln!("failed to prepare persistence store: {error}");
                error
            })
            .ok();

        let persisted = persistence
            .as_ref()
            .and_then(|store| {
                store
                    .load()
                    .map_err(|error| {
                        eprintln!("failed to load persisted state: {error}");
                        error
                    })
                    .ok()
            })
            .unwrap_or_default();

        let PersistedState {
            mut focus_records,
            next_record_id,
            mut todo_items,
            next_todo_id,
            reward_wallet,
            mut reward_ledger,
            next_reward_id,
            mut content_pack_state,
            mut headhunt_state,
        } = persisted;

        sort_focus_records(&mut focus_records);
        sort_todo_items(&mut todo_items);
        sort_reward_ledger(&mut reward_ledger);
        normalize_headhunt_state(&mut headhunt_state);

        let baseline_content_pack = load_bundled_content_pack()
            .unwrap_or_else(|_| default_content_pack_file());
        let active_content_pack = persistence
            .as_ref()
            .and_then(|store| match store.load_content_pack::<ContentPackFile>() {
                Ok(Some(content_pack)) => validate_content_pack_file(content_pack).ok(),
                Ok(None) => None,
                Err(error) => {
                    eprintln!("failed to load persisted content pack: {error}");
                    None
                }
            })
            .unwrap_or_else(|| baseline_content_pack.clone());
        let previous_content_pack_state = content_pack_state.clone();
        content_pack_state = build_content_pack_state(
            &active_content_pack,
            previous_content_pack_state.last_checked_at.clone(),
            previous_content_pack_state.last_synced_at.clone(),
        );
        let content_pack_state_changed = previous_content_pack_state != content_pack_state;

        let state = Self {
            timer: Mutex::new(TimerEngine::default()),
            next_record_id: Mutex::new(next_record_id.max(next_focus_record_id(&focus_records))),
            focus_records: Mutex::new(focus_records),
            next_todo_id: Mutex::new(next_todo_id.max(next_todo_id_value(&todo_items))),
            todo_items: Mutex::new(todo_items),
            reward_wallet: Mutex::new(reward_wallet),
            next_reward_id: Mutex::new(next_reward_id.max(next_reward_id_value(&reward_ledger))),
            reward_ledger: Mutex::new(reward_ledger),
            content_pack_state: Mutex::new(content_pack_state),
            content_pack_banners: Mutex::new(active_content_pack.banners.clone()),
            content_pack_sync_state: Mutex::new(ContentPackSyncState::default()),
            headhunt_state: Mutex::new(headhunt_state),
            persistence,
        };

        if content_pack_state_changed {
            let _ = state.persist();
        }

        state
    }

    fn persist(&self) -> Result<(), String> {
        let Some(store) = &self.persistence else {
            return Ok(());
        };

        let persisted = PersistedState {
            focus_records: self
                .focus_records
                .lock()
                .map_err(|_| {
                    "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                        .to_string()
                })?
                .clone(),
            next_record_id: *self.next_record_id.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?,
            todo_items: self
                .todo_items
                .lock()
                .map_err(|_| {
                    "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                        .to_string()
                })?
                .clone(),
            next_todo_id: *self.next_todo_id.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?,
            reward_wallet: self
                .reward_wallet
                .lock()
                .map_err(|_| "奖励钱包状态锁定失败".to_string())?
                .clone(),
            reward_ledger: self
                .reward_ledger
                .lock()
                .map_err(|_| "奖励流水状态锁定失败".to_string())?
                .clone(),
            next_reward_id: *self
                .next_reward_id
                .lock()
                .map_err(|_| "奖励编号状态锁定失败".to_string())?,
            content_pack_state: self
                .content_pack_state
                .lock()
                .map_err(|_| "内容包状态锁定失败".to_string())?
                .clone(),
            headhunt_state: self
                .headhunt_state
                .lock()
                .map_err(|_| "寻访状态锁定失败".to_string())?
                .clone(),
        };

        store.save(&persisted)
    }

    fn clear_all(&self) -> Result<(), String> {
        {
            let mut timer = self.timer.lock().map_err(|_| {
                "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            timer.reset();
            timer.mode = TimerMode::Stopwatch;
        }

        {
            let mut records = self.focus_records.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            records.clear();
        }

        {
            let mut next_record_id = self.next_record_id.lock().map_err(|_| {
                "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_record_id = 0;
        }

        {
            let mut items = self.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            items.clear();
        }

        {
            let mut next_todo_id = self.next_todo_id.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;
            *next_todo_id = 0;
        }

        {
            let mut wallet = self
                .reward_wallet
                .lock()
                .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
            *wallet = RewardWallet::default();
        }

        {
            let mut ledger = self
                .reward_ledger
                .lock()
                .map_err(|_| "奖励流水状态锁定失败".to_string())?;
            ledger.clear();
        }

        {
            let mut next_reward_id = self
                .next_reward_id
                .lock()
                .map_err(|_| "奖励编号状态锁定失败".to_string())?;
            *next_reward_id = 0;
        }

        {
            let mut headhunt_state = self
                .headhunt_state
                .lock()
                .map_err(|_| "寻访状态锁定失败".to_string())?;
            *headhunt_state = HeadhuntState::default();
        }

        let baseline_content_pack = load_bundled_content_pack()
            .unwrap_or_else(|_| default_content_pack_file());

        {
            let mut content_pack_state = self
                .content_pack_state
                .lock()
                .map_err(|_| "内容包状态锁定失败".to_string())?;
            *content_pack_state =
                build_content_pack_state(&baseline_content_pack, None, None);
        }

        {
            let mut content_pack_banners = self
                .content_pack_banners
                .lock()
                .map_err(|_| "内容包缓存锁定失败".to_string())?;
            *content_pack_banners = baseline_content_pack.banners.clone();
        }

        {
            let mut content_pack_sync_state = self
                .content_pack_sync_state
                .lock()
                .map_err(|_| "内容包同步状态锁定失败".to_string())?;
            *content_pack_sync_state = ContentPackSyncState::default();
        }

        if let Some(store) = &self.persistence {
            store.delete_content_pack()?;
        }

        self.persist()
    }
}

impl TimerEngine {
    fn start(&mut self) {
        if self.running_anchor.is_none() {
            self.running_anchor = Some(Self::new_anchor());
        }
    }

    fn pause(&mut self) {
        self.sync_running_time();
        self.running_anchor = None;
    }

    fn reset(&mut self) {
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    fn switch_mode(&mut self, mode: TimerMode) {
        if self.mode == mode {
            return;
        }

        self.mode = mode;
        self.running_anchor = None;
        self.pending_pomodoro_record_ms = None;

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_elapsed_ms = 0,
            TimerMode::Pomodoro => {
                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Focus;
                self.pending_pomodoro_record_ms = None;
            }
        }
    }

    fn complete_focus_session(&mut self) -> Result<CompletedSession, String> {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => {
                let elapsed_ms = self.stopwatch_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err("\u{5f53}\u{524d}\u{4e8b}\u{52a1}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}".to_string());
                }

                self.stopwatch_elapsed_ms = 0;
                self.running_anchor = None;

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "stopwatch",
                    mode_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                    phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
                })
            }
            TimerMode::Pomodoro => {
                if let Some(elapsed_ms) = self.pending_pomodoro_record_ms.take() {
                    return Ok(CompletedSession {
                        duration_ms: elapsed_ms,
                        mode_key: "pomodoro",
                        mode_label: "\u{756a}\u{8304}\u{949f}",
                        phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                    });
                }

                if self.pomodoro_phase != PomodoroPhase::Focus {
                    return Err(
                        "\u{5f53}\u{524d}\u{5904}\u{4e8e}\u{4f11}\u{606f}\u{9636}\u{6bb5}\u{ff0c}\u{6ca1}\u{6709}\u{53ef}\u{8bb0}\u{5f55}\u{7684}\u{4e13}\u{6ce8}\u{8f6e}\u{6b21}"
                            .to_string(),
                    );
                }

                let elapsed_ms = self.pomodoro_elapsed_ms;
                if elapsed_ms == 0 {
                    return Err(
                        "\u{5f53}\u{524d}\u{756a}\u{8304}\u{4e13}\u{6ce8}\u{8fd8}\u{6ca1}\u{6709}\u{7d2f}\u{8ba1}\u{65f6}\u{95f4}"
                            .to_string(),
                    );
                }

                self.pomodoro_elapsed_ms = 0;
                self.pomodoro_phase = PomodoroPhase::Break;
                self.running_anchor = None;

                Ok(CompletedSession {
                    duration_ms: elapsed_ms,
                    mode_key: "pomodoro",
                    mode_label: "\u{756a}\u{8304}\u{949f}",
                    phase_label: "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
                })
            }
        }
    }

    fn snapshot(&mut self) -> TimerSnapshot {
        self.sync_running_time();

        match self.mode {
            TimerMode::Stopwatch => self.stopwatch_snapshot(),
            TimerMode::Pomodoro => self.pomodoro_snapshot(),
        }
    }

    fn stopwatch_snapshot(&self) -> TimerSnapshot {
        let elapsed_ms = self.stopwatch_elapsed_ms;
        let status = if self.running_anchor.is_some() {
            "\u{8ba1}\u{65f6}\u{4e2d}"
        } else if elapsed_ms == 0 {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        TimerSnapshot {
            mode_key: "stopwatch",
            phase_key: "stopwatch",
            mode: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            phase_label: "\u{6b63}\u{5411}\u{8ba1}\u{65f6}",
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(elapsed_ms),
            secondary_label: "\u{5df2}\u{7d2f}\u{8ba1}\u{4e13}\u{6ce8}\u{65f6}\u{957f}",
            can_complete_session: true,
        }
    }

    fn pomodoro_snapshot(&self) -> TimerSnapshot {
        let duration_ms = self.current_pomodoro_duration_ms();
        let elapsed_ms = self.pomodoro_elapsed_ms.min(duration_ms);
        let remaining_ms = duration_ms.saturating_sub(elapsed_ms);
        let status = if self.running_anchor.is_some() {
            match self.pomodoro_phase {
                PomodoroPhase::Focus => "\u{4e13}\u{6ce8}\u{4e2d}",
                PomodoroPhase::Break => "\u{4f11}\u{606f}\u{4e2d}",
            }
        } else if elapsed_ms == 0 && self.pomodoro_phase == PomodoroPhase::Focus {
            "\u{672a}\u{5f00}\u{59cb}"
        } else {
            "\u{5df2}\u{6682}\u{505c}"
        };

        let phase_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{756a}\u{8304}\u{4e13}\u{6ce8}",
            PomodoroPhase::Break => "\u{77ed}\u{4f11}\u{606f}",
        };

        let secondary_label = match self.pomodoro_phase {
            PomodoroPhase::Focus => "\u{672c}\u{8f6e}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
            PomodoroPhase::Break => "\u{4f11}\u{606f}\u{5269}\u{4f59}\u{65f6}\u{95f4}",
        };

        TimerSnapshot {
            mode_key: "pomodoro",
            phase_key: match self.pomodoro_phase {
                PomodoroPhase::Focus => "focus",
                PomodoroPhase::Break => "break",
            },
            mode: "\u{756a}\u{8304}\u{949f}",
            phase_label,
            status,
            is_running: self.running_anchor.is_some(),
            elapsed_ms,
            elapsed_label: format_duration_ms(remaining_ms),
            secondary_label,
            can_complete_session: self.pending_pomodoro_record_ms.is_some()
                || self.pomodoro_phase == PomodoroPhase::Focus,
        }
    }

    fn current_pomodoro_duration_ms(&self) -> u64 {
        match self.pomodoro_phase {
            PomodoroPhase::Focus => POMODORO_FOCUS_MS,
            PomodoroPhase::Break => POMODORO_BREAK_MS,
        }
    }

    fn sync_running_time(&mut self) {
        let Some(anchor) = self.running_anchor else {
            return;
        };

        let delta_ms = elapsed_since_anchor_ms(anchor);
        if delta_ms == 0 {
            return;
        }

        match self.mode {
            TimerMode::Stopwatch => {
                self.stopwatch_elapsed_ms = self.stopwatch_elapsed_ms.saturating_add(delta_ms);
            }
            TimerMode::Pomodoro => {
                let mut total_elapsed = self.pomodoro_elapsed_ms.saturating_add(delta_ms);
                loop {
                    let phase_duration = self.current_pomodoro_duration_ms();
                    if total_elapsed < phase_duration {
                        break;
                    }

                    total_elapsed -= phase_duration;
                    if self.pomodoro_phase == PomodoroPhase::Focus
                        && self.pending_pomodoro_record_ms.is_none()
                    {
                        self.pending_pomodoro_record_ms = Some(phase_duration);
                    }
                    self.pomodoro_phase = match self.pomodoro_phase {
                        PomodoroPhase::Focus => PomodoroPhase::Break,
                        PomodoroPhase::Break => PomodoroPhase::Focus,
                    };
                }

                self.pomodoro_elapsed_ms = total_elapsed;
            }
        }

        self.running_anchor = Some(Self::new_anchor());
    }

    fn new_anchor() -> RunAnchor {
        RunAnchor {
            monotonic: Instant::now(),
            wall_clock: SystemTime::now(),
        }
    }
}

fn elapsed_since_anchor_ms(anchor: RunAnchor) -> u64 {
    let monotonic_ms = anchor.monotonic.elapsed().as_millis() as u64;
    let wall_ms = SystemTime::now()
        .duration_since(anchor.wall_clock)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64;

    monotonic_ms.max(wall_ms)
}

fn with_timer_engine<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut TimerEngine) -> Result<T, String>,
) -> Result<T, String> {
    let mut engine = state.timer.lock().map_err(|_| {
        "\u{8ba1}\u{65f6}\u{5f15}\u{64ce}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    f(&mut engine)
}

fn format_duration_ms(total_ms: u64) -> String {
    let total_seconds = total_ms / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

fn parse_mode(mode: &str) -> Result<TimerMode, String> {
    match mode {
        "stopwatch" => Ok(TimerMode::Stopwatch),
        "pomodoro" => Ok(TimerMode::Pomodoro),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{8ba1}\u{65f6}\u{6a21}\u{5f0f}".to_string()),
    }
}

fn normalize_todo_title(title: &str) -> Result<String, String> {
    let normalized = title.trim();
    if normalized.is_empty() {
        Err("\u{4efb}\u{52a1}\u{540d}\u{79f0}\u{4e0d}\u{80fd}\u{4e3a}\u{7a7a}".to_string())
    } else {
        Ok(normalized.to_string())
    }
}

fn normalize_scheduled_date(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    let is_valid = normalized.len() == 10
        && normalized
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                4 | 7 => ch == '-',
                _ => ch.is_ascii_digit(),
            });

    if is_valid {
        Ok(normalized.to_string())
    } else {
        Err("\u{8bf7}\u{9009}\u{62e9}\u{6709}\u{6548}\u{7684}\u{65e5}\u{671f}".to_string())
    }
}

fn normalize_scheduled_time(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    let is_valid = normalized.len() == 5
        && normalized
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                2 => ch == ':',
                _ => ch.is_ascii_digit(),
            });

    if is_valid {
        Ok(normalized.to_string())
    } else {
        Err(
            "\u{8bf7}\u{9009}\u{62e9}\u{6709}\u{6548}\u{7684}\u{5f00}\u{59cb}\u{65f6}\u{95f4}"
                .to_string(),
        )
    }
}

fn normalize_importance_key(value: &str) -> Result<String, String> {
    match value.trim() {
        "low" => Ok("low".to_string()),
        "medium" => Ok("medium".to_string()),
        "high" => Ok("high".to_string()),
        _ => Err("\u{4e0d}\u{652f}\u{6301}\u{7684}\u{91cd}\u{8981}\u{7a0b}\u{5ea6}".to_string()),
    }
}

fn importance_rank(value: &str) -> u8 {
    match value {
        "high" => 0,
        "medium" => 1,
        "low" => 2,
        _ => 3,
    }
}

fn next_focus_record_id(records: &[FocusRecord]) -> u64 {
    records
        .iter()
        .map(|record| record.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn next_todo_id_value(items: &[TodoItem]) -> u64 {
    items
        .iter()
        .map(|item| item.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn next_reward_id_value(entries: &[RewardLedgerEntry]) -> u64 {
    entries
        .iter()
        .map(|entry| entry.id)
        .max()
        .map_or(0, |id| id + 1)
}

fn sort_focus_records(records: &mut [FocusRecord]) {
    records.sort_by(|left, right| Reverse(left.id).cmp(&Reverse(right.id)));
}

fn sort_todo_items(items: &mut [TodoItem]) {
    items.sort_by(|left, right| {
        left.is_completed
            .cmp(&right.is_completed)
            .then_with(|| left.scheduled_date.cmp(&right.scheduled_date))
            .then_with(|| left.scheduled_time.cmp(&right.scheduled_time))
            .then_with(|| {
                importance_rank(&left.importance_key).cmp(&importance_rank(&right.importance_key))
            })
            .then_with(|| Reverse(left.id).cmp(&Reverse(right.id)))
    });
}

fn sort_reward_ledger(entries: &mut [RewardLedgerEntry]) {
    entries.sort_by(|left, right| Reverse(left.id).cmp(&Reverse(right.id)));
}

fn current_local_markers() -> (String, String, String) {
    let now = Local::now();
    (
        now.format("%Y-%m-%d %H:%M:%S").to_string(),
        now.format("%Y-%m-%d").to_string(),
        now.format("%H:%M").to_string(),
    )
}

fn current_streak_days(records: &[FocusRecord]) -> usize {
    let today = Local::now().date_naive();
    let mut unique_days = records
        .iter()
        .filter_map(|record| {
            chrono::NaiveDate::parse_from_str(&record.completed_date, "%Y-%m-%d").ok()
        })
        .collect::<Vec<_>>();

    unique_days.sort_unstable();
    unique_days.dedup();

    let mut cursor = today;
    let mut streak = 0usize;

    for day in unique_days.into_iter().rev() {
        if day == cursor {
            streak += 1;
            cursor = cursor.pred_opt().unwrap_or(cursor);
        } else if streak == 0 && day == today.pred_opt().unwrap_or(today) {
            cursor = day;
            streak += 1;
            cursor = cursor.pred_opt().unwrap_or(cursor);
        } else if day < cursor {
            break;
        }
    }

    streak
}

fn count_originium_pity_misses(reward_ledger: &[RewardLedgerEntry]) -> usize {
    reward_ledger
        .iter()
        .filter(|entry| {
            entry.duration_ms >= POMODORO_FOCUS_MS || entry.duration_ms >= 45 * 60 * 1000
        })
        .take_while(|entry| entry.originium == 0)
        .count()
}

fn build_reward_entry(
    id: u64,
    source_record_id: u64,
    title: &str,
    completed_session: &CompletedSession,
    completed_at: String,
    completed_date: String,
    completed_time: String,
    linked_todo_id: Option<u64>,
    reward_ledger: &[RewardLedgerEntry],
) -> RewardLedgerEntry {
    let duration_minutes = (completed_session.duration_ms / 60_000).max(1);
    let linked_lmd_bonus = if linked_todo_id.is_some() { 90 } else { 0 };
    let linked_orundum_bonus = if linked_todo_id.is_some() { 20 } else { 0 };
    let pomodoro_orundum_bonus = if completed_session.mode_key == "pomodoro" {
        40
    } else {
        0
    };

    let lmd = duration_minutes * 18 + linked_lmd_bonus;
    let orundum = duration_minutes * 6 + pomodoro_orundum_bonus + linked_orundum_bonus;

    let title_factor = title.chars().count() as u64;
    let date_factor = completed_date
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .filter_map(|ch| ch.to_digit(10))
        .map(u64::from)
        .sum::<u64>();
    let random_seed = id
        .saturating_mul(13)
        .saturating_add(duration_minutes)
        .saturating_add(title_factor)
        .saturating_add(date_factor);
    let is_originium_eligible = completed_session.duration_ms >= POMODORO_FOCUS_MS
        || completed_session.duration_ms >= 45 * 60 * 1000;
    let recent_miss_streak = count_originium_pity_misses(reward_ledger);
    let pity_triggered = is_originium_eligible && recent_miss_streak >= 5;
    let surprise_hit = if completed_session.mode_key == "pomodoro" {
        random_seed % 100 < 8
    } else {
        random_seed % 100 < 6
    };
    let originium = if is_originium_eligible && (pity_triggered || surprise_hit) {
        1
    } else {
        0
    };

    RewardLedgerEntry {
        id,
        source_record_id,
        source_title: title.to_string(),
        source_mode_label: completed_session.mode_label.to_string(),
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        lmd,
        orundum,
        originium,
        completed_at,
        completed_date,
        completed_time,
    }
}

fn reward_snapshot(
    records: &[FocusRecord],
    wallet: &RewardWallet,
    ledger: &[RewardLedgerEntry],
) -> RewardSnapshot {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let today_focus_duration_ms = records
        .iter()
        .filter(|record| record.completed_date == today)
        .map(|record| record.duration_ms)
        .sum::<u64>();

    RewardSnapshot {
        wallet: wallet.clone(),
        today_focus_duration_ms,
        today_focus_duration_label: format_duration_ms(today_focus_duration_ms),
        current_streak_days: current_streak_days(records),
        total_reward_count: ledger.len(),
        latest_rewards: ledger.iter().take(6).cloned().collect(),
    }
}

fn wallet_from_ledger(ledger: &[RewardLedgerEntry]) -> RewardWallet {
    ledger
        .iter()
        .fold(RewardWallet::default(), |mut wallet, entry| {
            wallet.lmd = wallet.lmd.saturating_add(entry.lmd);
            wallet.orundum = wallet.orundum.saturating_add(entry.orundum);
            wallet.originium = wallet.originium.saturating_add(entry.originium);
            wallet
        })
}

fn current_local_timestamp() -> String {
    Local::now().format("%Y-%m-%d %H:%M").to_string()
}

fn normalize_headhunt_state(state: &mut HeadhuntState) {
    if catalog_banner_by_id(&state.current_banner_id).is_none() {
        state.current_banner_id = CATALOG_DEFAULT_BANNER_ID.to_string();
    }
}

fn banner_type_label(kind: CatalogBannerKind) -> &'static str {
    match kind {
        CatalogBannerKind::Event => "活动寻访",
        CatalogBannerKind::Standard => "标准寻访",
        CatalogBannerKind::Kernel => "中坚寻访",
    }
}

fn pity_group_label(kind: CatalogBannerKind) -> &'static str {
    match kind {
        CatalogBannerKind::Kernel => "中坚独立保底",
        _ => "活动 / 标准共用保底",
    }
}

fn banner_snapshot_from_catalog(banner: CatalogBannerDef) -> HeadhuntBannerSnapshot {
    let rate_up_six_names = banner
        .rate_up_six_ids
        .iter()
        .filter_map(|id| catalog_operator_by_id(id).map(|operator| operator.name.to_string()))
        .collect::<Vec<_>>();
    let rate_up_five_names = banner
        .rate_up_five_ids
        .iter()
        .filter_map(|id| catalog_operator_by_id(id).map(|operator| operator.name.to_string()))
        .collect::<Vec<_>>();
    let rate_up_four_names = banner
        .rate_up_four_ids
        .iter()
        .filter_map(|id| catalog_operator_by_id(id).map(|operator| operator.name.to_string()))
        .collect::<Vec<_>>();

    let mut rate_up_names = Vec::new();
    rate_up_names.extend(rate_up_six_names.iter().cloned());
    rate_up_names.extend(rate_up_five_names.iter().cloned());
    rate_up_names.extend(rate_up_four_names.iter().cloned());

    HeadhuntBannerSnapshot {
        id: banner.id.to_string(),
        name: banner.name.to_string(),
        summary: banner.summary.to_string(),
        banner_type_label: banner_type_label(banner.kind).to_string(),
        starts_at: banner.starts_at.to_string(),
        ends_at: banner.ends_at.to_string(),
        rate_up_names,
        rate_up_six_names,
        rate_up_five_names,
        rate_up_four_names,
        pity_group_label: pity_group_label(banner.kind).to_string(),
    }
}

fn content_banner_slot_for_kind(kind: CatalogBannerKind) -> &'static str {
    match kind {
        CatalogBannerKind::Event => "event",
        CatalogBannerKind::Standard => "standard",
        CatalogBannerKind::Kernel => "kernel",
    }
}

fn apply_content_override(
    mut snapshot: HeadhuntBannerSnapshot,
    override_item: &ContentBannerOverride,
) -> HeadhuntBannerSnapshot {
    snapshot.name = override_item.name.clone();
    snapshot.summary = override_item.summary.clone();
    snapshot.starts_at = override_item.starts_at.clone();
    snapshot.ends_at = override_item.ends_at.clone();
    snapshot.rate_up_six_names = override_item.rate_up_six_names.clone();
    snapshot.rate_up_five_names = override_item.rate_up_five_names.clone();
    snapshot.rate_up_four_names = override_item.rate_up_four_names.clone();

    let mut merged_rate_up = Vec::new();
    merged_rate_up.extend(snapshot.rate_up_six_names.iter().cloned());
    merged_rate_up.extend(snapshot.rate_up_five_names.iter().cloned());
    merged_rate_up.extend(snapshot.rate_up_four_names.iter().cloned());
    snapshot.rate_up_names = merged_rate_up;
    snapshot
}

fn banner_snapshot_with_overrides(
    banner: CatalogBannerDef,
    content_pack_banners: &[ContentBannerOverride],
) -> HeadhuntBannerSnapshot {
    let base_snapshot = banner_snapshot_from_catalog(banner);
    let slot = content_banner_slot_for_kind(banner.kind);

    if let Some(item) = content_pack_banners
        .iter()
        .find(|override_item| override_item.slot == slot)
    {
        apply_content_override(base_snapshot, item)
    } else {
        base_snapshot
    }
}

fn current_catalog_banner(state: &HeadhuntState) -> CatalogBannerDef {
    catalog_banner_by_id(&state.current_banner_id)
        .or_else(|| catalog_banner_by_id(CATALOG_DEFAULT_BANNER_ID))
        .or_else(|| catalog_all_banners().first().copied())
        .expect("headhunt catalog must contain at least one banner")
}

fn pity_counter_for_banner(state: &HeadhuntState, banner: CatalogBannerDef) -> u32 {
    match banner.kind {
        CatalogBannerKind::Kernel => state.kernel_pity_without_six_star,
        _ => state.pity_without_six_star,
    }
}

fn fetch_json<T: for<'de> Deserialize<'de>>(client: &Client, url: &str) -> Result<T, String> {
    client
        .get(url)
        .send()
        .map_err(|error| format!("request failed for {url}: {error}"))?
        .error_for_status()
        .map_err(|error| format!("http error for {url}: {error}"))?
        .json::<T>()
        .map_err(|error| format!("invalid json from {url}: {error}"))
}

fn fetch_json_from_candidates<T: for<'de> Deserialize<'de>>(
    client: &Client,
    urls: &[&str],
) -> Result<T, String> {
    let mut failures = Vec::new();

    for url in urls {
        match fetch_json(client, url) {
            Ok(value) => return Ok(value),
            Err(error) => failures.push(error),
        }
    }

    Err(failures.join(" | "))
}

fn format_local_time_from_unix(timestamp: i64) -> String {
    Local
        .timestamp_opt(timestamp, 0)
        .single()
        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_else(current_local_timestamp)
}

fn select_pool_by_rules(
    pools: &[RemoteBasePool],
    rules: &[&str],
    now: i64,
) -> Option<RemoteBasePool> {
    let matches_rule = |pool: &&RemoteBasePool| rules.contains(&pool.gacha_rule_type.as_str());
    let as_active = |pool: &&RemoteBasePool| pool.open_time <= now && pool.end_time >= now;

    pools
        .iter()
        .filter(matches_rule)
        .filter(as_active)
        .max_by_key(|pool| pool.open_time)
        .cloned()
        .or_else(|| {
            pools
                .iter()
                .filter(matches_rule)
                .filter(|pool| pool.open_time > now)
                .min_by_key(|pool| pool.open_time)
                .cloned()
        })
        .or_else(|| {
            pools
                .iter()
                .filter(matches_rule)
                .max_by_key(|pool| pool.end_time)
                .cloned()
        })
}

fn parse_character_name_map(
    raw_character_table: &Value,
) -> Result<(HashMap<String, String>, usize), String> {
    let Some(characters) = raw_character_table.as_object() else {
        return Err("character table schema mismatch".to_string());
    };

    let mut name_map = HashMap::new();
    let mut obtainable_count = 0usize;

    for (char_id, payload) in characters {
        let Some(char_obj) = payload.as_object() else {
            continue;
        };

        let is_not_obtainable = char_obj
            .get("isNotObtainable")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        let name = char_obj
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();

        if name.is_empty() {
            continue;
        }

        name_map.insert(char_id.to_string(), name.to_string());
        if !is_not_obtainable {
            obtainable_count = obtainable_count.saturating_add(1);
        }
    }

    Ok((name_map, obtainable_count))
}

fn rate_up_names_from_detail(
    detail_pool: Option<&RemoteDetailPool>,
    name_map: &HashMap<String, String>,
    rarity_rank: u8,
) -> Vec<String> {
    let Some(detail_pool) = detail_pool else {
        return Vec::new();
    };

    let Some(detail) = &detail_pool.gacha_pool_detail else {
        return Vec::new();
    };

    let Some(detail_info) = &detail.detail_info else {
        return Vec::new();
    };

    let Some(up_char_info) = &detail_info.up_char_info else {
        return Vec::new();
    };

    up_char_info
        .per_char_list
        .iter()
        .filter(|entry| entry.rarity_rank == rarity_rank)
        .flat_map(|entry| entry.char_id_list.iter())
        .filter_map(|char_id| name_map.get(char_id).cloned())
        .collect::<Vec<_>>()
}

fn build_banner_override(
    slot: &str,
    base_pool: &RemoteBasePool,
    detail_by_id: &HashMap<String, RemoteDetailPool>,
    name_map: &HashMap<String, String>,
) -> ContentBannerOverride {
    let detail_pool = detail_by_id.get(&base_pool.gacha_pool_id);
    let rate_up_six_names = rate_up_names_from_detail(detail_pool, name_map, 5);
    let rate_up_five_names = rate_up_names_from_detail(detail_pool, name_map, 4);
    let rate_up_four_names = rate_up_names_from_detail(detail_pool, name_map, 3);

    let mut summary_parts = Vec::new();
    if !rate_up_six_names.is_empty() {
        summary_parts.push(format!("6星 UP：{}", rate_up_six_names.join(" / ")));
    }
    if !rate_up_five_names.is_empty() {
        summary_parts.push(format!("5星 UP：{}", rate_up_five_names.join(" / ")));
    }
    if summary_parts.is_empty() {
        summary_parts.push(
            base_pool
                .gacha_pool_summary
                .clone()
                .unwrap_or_else(|| "当前池子未返回可解析的 UP 名单".to_string()),
        );
    }

    ContentBannerOverride {
        slot: slot.to_string(),
        source_pool_id: base_pool.gacha_pool_id.clone(),
        name: base_pool.gacha_pool_name.clone(),
        summary: summary_parts.join(" · "),
        starts_at: format_local_time_from_unix(base_pool.open_time),
        ends_at: format_local_time_from_unix(base_pool.end_time),
        rate_up_six_names,
        rate_up_five_names,
        rate_up_four_names,
    }
}

fn build_sync_client(bypass_proxy: bool) -> Result<Client, String> {
    let mut builder = Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .use_rustls_tls();

    if bypass_proxy {
        builder = builder.no_proxy();
    }

    builder.build().map_err(|error| {
        if bypass_proxy {
            format!("failed to build direct sync client: {error}")
        } else {
            format!("failed to build proxy-aware sync client: {error}")
        }
    })
}

fn fetch_live_content_pack_manifest_with_client(client: &Client) -> Result<ContentPackState, String> {
    let base_table =
        fetch_json_from_candidates::<RemoteBaseGachaTable>(client, &CN_GACHA_TABLE_URLS)?;
    let detail_table =
        fetch_json_from_candidates::<RemoteDetailGachaTable>(client, &CN_GACHA_DETAIL_URLS)?;
    let raw_character_table =
        fetch_json_from_candidates::<Value>(client, &CN_CHARACTER_TABLE_URLS)?;
    let (name_map, operator_count) = parse_character_name_map(&raw_character_table)?;
    let now = Local::now().timestamp();

    let detail_by_id = detail_table
        .gacha_pool_client
        .into_iter()
        .map(|pool| (pool.gacha_pool_id.clone(), pool))
        .collect::<HashMap<_, _>>();

    let event_pool = select_pool_by_rules(&base_table.gacha_pool_client, &["SINGLE"], now);
    let standard_pool = select_pool_by_rules(&base_table.gacha_pool_client, &["DOUBLE"], now);
    let kernel_pool =
        select_pool_by_rules(&base_table.gacha_pool_client, &["CLASSIC_DOUBLE", "CLASSIC"], now);

    let mut overrides = Vec::new();
    if let Some(pool) = event_pool {
        overrides.push(build_banner_override("event", &pool, &detail_by_id, &name_map));
    }
    if let Some(pool) = standard_pool {
        overrides.push(build_banner_override("standard", &pool, &detail_by_id, &name_map));
    }
    if let Some(pool) = kernel_pool {
        overrides.push(build_banner_override("kernel", &pool, &detail_by_id, &name_map));
    }

    let version_suffix = overrides
        .iter()
        .map(|override_item| override_item.source_pool_id.as_str())
        .collect::<Vec<_>>()
        .join("+");
    let content_version = if version_suffix.is_empty() {
        format!("cn-live-empty-{}", Local::now().format("%Y%m%d%H%M"))
    } else {
        format!("cn-live-{version_suffix}")
    };

    Ok(ContentPackState {
        current_version: content_version,
        current_server: "国服".to_string(),
        current_updated_at: current_local_timestamp(),
        operator_count,
        banner_count: overrides.len(),
        last_checked_at: None,
        last_synced_at: None,
        source_label: "国服数据源：ArknightsGameData + PRTS Weedy".to_string(),
    })
}

fn fetch_live_content_pack_manifest() -> Result<ContentPackState, String> {
    let proxy_client = build_sync_client(false)?;
    match fetch_live_content_pack_manifest_with_client(&proxy_client) {
        Ok(state) => Ok(state),
        Err(proxy_error) => {
            let direct_client = build_sync_client(true)?;
            fetch_live_content_pack_manifest_with_client(&direct_client).map_err(|direct_error| {
                format!("代理链路失败：{proxy_error}；直连链路失败：{direct_error}")
            })
        }
    }
}

fn normalize_content_pack_state(state: &mut ContentPackState) -> bool {
    let mut changed = false;
    let looks_like_legacy_global_snapshot = state.current_server.eq_ignore_ascii_case("global")
        || state.current_version.starts_with("global-")
        || state.operator_count < 400;

    if looks_like_legacy_global_snapshot {
        state.current_version = "cn-baseline-2026.03.28".to_string();
        state.current_server = "国服".to_string();
        state.current_updated_at = "2026-03-28 10:00".to_string();
        state.operator_count = 410;
        state.banner_count = 3;
        state.source_label = "应用内置国服基线".to_string();
        changed = true;
    }

    if state.current_server.trim().is_empty() {
        state.current_server = "国服".to_string();
        changed = true;
    }

    if state.operator_count == 0 {
        state.operator_count = 410;
        changed = true;
    }

    if state.banner_count == 0 {
        state.banner_count = 3;
        changed = true;
    }

    changed
}

fn content_pack_snapshot_from_state(
    current: &ContentPackState,
    remote: &ContentPackState,
    status_label: &str,
    status_note: &str,
) -> ContentPackSnapshot {
    let update_available = current.current_version != remote.current_version;

    ContentPackSnapshot {
        current_version: current.current_version.clone(),
        current_server: current.current_server.clone(),
        current_updated_at: current.current_updated_at.clone(),
        operator_count: current.operator_count,
        banner_count: current.banner_count,
        last_checked_at: current.last_checked_at.clone(),
        last_synced_at: current.last_synced_at.clone(),
        source_label: current.source_label.clone(),
        status_label: status_label.to_string(),
        status_note: status_note.to_string(),
        update_available,
        remote_version: update_available.then(|| remote.current_version.clone()),
        remote_updated_at: update_available.then(|| remote.current_updated_at.clone()),
        remote_operator_count: update_available.then_some(remote.operator_count),
        remote_banner_count: update_available.then_some(remote.banner_count),
        is_syncing: false,
        supports_manual_import: true,
    }
}

fn content_pack_has_changes(current: &ContentPackState, remote: &ContentPackState) -> bool {
    current.current_version != remote.current_version
        || current.current_server != remote.current_server
        || current.current_updated_at != remote.current_updated_at
        || current.operator_count != remote.operator_count
        || current.banner_count != remote.banner_count
        || current.source_label != remote.source_label
}

fn build_content_pack_snapshot(
    current: &ContentPackState,
    sync_state: &ContentPackSyncState,
) -> ContentPackSnapshot {
    let (status_label, status_note) = if sync_state.in_progress {
        (
            "正在后台同步".to_string(),
            "正在检查 Focused Moment 固定内容源，完成后会自动刷新开发者页和寻访页。"
                .to_string(),
        )
    } else if let Some(label) = &sync_state.status_label {
        (
            label.clone(),
            sync_state
                .status_note
                .clone()
                .unwrap_or_else(|| "本次检查已完成。".to_string()),
        )
    } else {
        (
            "内容包待检查".to_string(),
            "点击下方按钮后，会检查 Focused Moment 固定内容源；如果在线失败，也可以导入本地内容包。"
                .to_string(),
        )
    };

    let remote = sync_state.remote_state.as_ref();
    let update_available = remote
        .map(|item| item.version != current.current_version)
        .unwrap_or(false);

    return ContentPackSnapshot {
        current_version: current.current_version.clone(),
        current_server: current.current_server.clone(),
        current_updated_at: current.current_updated_at.clone(),
        operator_count: current.operator_count,
        banner_count: current.banner_count,
        last_checked_at: current.last_checked_at.clone(),
        last_synced_at: current.last_synced_at.clone(),
        source_label: current.source_label.clone(),
        status_label,
        status_note,
        update_available,
        remote_version: update_available.then(|| remote.map(|item| item.version.clone())).flatten(),
        remote_updated_at: update_available
            .then(|| remote.map(|item| item.updated_at.clone()))
            .flatten(),
        remote_operator_count: update_available
            .then(|| remote.map(|item| item.operator_count))
            .flatten(),
        remote_banner_count: update_available
            .then(|| remote.map(|item| item.banner_count))
            .flatten(),
        is_syncing: sync_state.in_progress,
        supports_manual_import: true,
    };

    let (status_label, status_note) = if sync_state.in_progress {
        (
            "正在后台同步".to_string(),
            "已切到后台检查国服远端数据源，完成后会自动刷新开发者页与寻访页。".to_string(),
        )
    } else if let Some(label) = &sync_state.status_label {
        (
            label.clone(),
            sync_state
                .status_note
                .clone()
                .unwrap_or_else(|| "本次检查已完成。".to_string()),
        )
    } else {
        (
            "内容包待检查".to_string(),
            "点击下方按钮后，会在后台检查国服远端数据源并同步到本地。".to_string(),
        )
    };

    let remote = sync_state.remote_state.as_ref();
    let update_available = remote
        .map(|item| item.version != current.current_version)
        .unwrap_or(false);

    ContentPackSnapshot {
        current_version: current.current_version.clone(),
        current_server: current.current_server.clone(),
        current_updated_at: current.current_updated_at.clone(),
        operator_count: current.operator_count,
        banner_count: current.banner_count,
        last_checked_at: current.last_checked_at.clone(),
        last_synced_at: current.last_synced_at.clone(),
        source_label: current.source_label.clone(),
        status_label,
        status_note,
        update_available,
        remote_version: update_available.then(|| remote.map(|item| item.version.clone())).flatten(),
        remote_updated_at: update_available
            .then(|| remote.map(|item| item.updated_at.clone()))
            .flatten(),
        remote_operator_count: update_available.then(|| remote.map(|item| item.operator_count)).flatten(),
        remote_banner_count: update_available.then(|| remote.map(|item| item.banner_count)).flatten(),
        is_syncing: sync_state.in_progress,
        supports_manual_import: true,
    }
}

fn current_content_pack_snapshot_from_engine(
    state: &TimerEngineState,
) -> Result<ContentPackSnapshot, String> {
    let current = state
        .content_pack_state
        .lock()
        .map_err(|_| "内容包状态锁定失败".to_string())?
        .clone();
    let sync_state = state
        .content_pack_sync_state
        .lock()
        .map_err(|_| "内容包同步状态锁定失败".to_string())?
        .clone();

    Ok(build_content_pack_snapshot(&current, &sync_state))
}

fn finish_content_pack_sync(app: &AppHandle, result: Result<ContentPackFile, String>) {
    let state = app.state::<TimerEngineState>();
    let checked_at = current_local_timestamp();
    match result {
        Ok(remote_pack) => {
            let remote_state = Some(build_remote_state(&remote_pack));
            let current_version = state
                .content_pack_state
                .lock()
                .map(|current| current.current_version.clone())
                .unwrap_or_default();
            let has_changes = current_version != remote_pack.pack_version;

            let persist_result = if has_changes {
                if let Some(store) = &state.persistence {
                    store.save_content_pack(&remote_pack)
                } else {
                    Ok(())
                }
                .and_then(|_| {
                    let mut banners = state
                        .content_pack_banners
                        .lock()
                        .map_err(|_| "内容包缓存锁定失败".to_string())?;
                    *banners = remote_pack.banners.clone();
                    Ok(())
                })
                .and_then(|_| {
                    let mut current = state
                        .content_pack_state
                        .lock()
                        .map_err(|_| "内容包状态锁定失败".to_string())?;
                    *current = build_content_pack_state(
                        &remote_pack,
                        Some(checked_at.clone()),
                        Some(current_local_timestamp()),
                    );
                    Ok(())
                })
                .and_then(|_| state.persist())
            } else {
                if let Ok(mut current) = state.content_pack_state.lock() {
                    current.last_checked_at = Some(checked_at.clone());
                }
                state.persist()
            };

            if let Err(error) = persist_result {
                if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                    sync_state.in_progress = false;
                    sync_state.status_label = Some("内容包写入失败".to_string());
                    sync_state.status_note =
                        Some(format!("已经拿到新的内容包，但写入本地缓存失败：{error}"));
                    sync_state.remote_state = remote_state;
                }
                return;
            }

            if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                sync_state.in_progress = false;
                sync_state.status_label = Some(
                    if has_changes {
                        "内容包已更新"
                    } else {
                        "当前已是最新资料"
                    }
                    .to_string(),
                );
                sync_state.status_note = Some(
                    if has_changes {
                        "本地内容包已经切换到最新快照，寻访页会直接按这份数据刷新。"
                    } else {
                        "Focused Moment 内容源和当前本地内容包一致，这次不用重新下载。"
                    }
                    .to_string(),
                );
                sync_state.remote_state = remote_state;
            }

            return;
        }
        Err(error) => {
            if let Ok(mut current) = state.content_pack_state.lock() {
                current.last_checked_at = Some(checked_at.clone());
            }
            let _ = state.persist();

            if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                sync_state.in_progress = false;
                sync_state.status_label = Some(
                    if error.contains("内容包校验失败") {
                        "内容包校验失败"
                    } else {
                        "无法访问 Focused Moment 内容源"
                    }
                    .to_string(),
                );
                sync_state.status_note = Some(error);
                sync_state.remote_state = None;
            }

            return;
        }
    }

    match result {
        Ok(remote_pack) => {
            let remote_state = Some(build_remote_state(&remote_pack));
            let current_version = state
                .content_pack_state
                .lock()
                .map(|current| current.current_version.clone())
                .unwrap_or_default();
            let has_changes = current_version != remote_pack.pack_version;

            let persist_result = if has_changes {
                if let Some(store) = &state.persistence {
                    store.save_content_pack(&remote_pack)
                } else {
                    Ok(())
                }
                .and_then(|_| {
                    let mut banners = state
                        .content_pack_banners
                        .lock()
                        .map_err(|_| "内容包缓存锁定失败".to_string())?;
                    *banners = remote_pack.banners.clone();
                    Ok(())
                })
                .and_then(|_| {
                    let mut current = state
                        .content_pack_state
                        .lock()
                        .map_err(|_| "内容包状态锁定失败".to_string())?;
                    *current = build_content_pack_state(
                        &remote_pack,
                        Some(checked_at.clone()),
                        Some(current_local_timestamp()),
                    );
                    Ok(())
                })
                .and_then(|_| state.persist())
            } else {
                if let Ok(mut current) = state.content_pack_state.lock() {
                    current.last_checked_at = Some(checked_at.clone());
                }
                state.persist()
            };

            if let Err(error) = persist_result {
                if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                    sync_state.in_progress = false;
                    sync_state.status_label = Some("内容包写入失败".to_string());
                    sync_state.status_note =
                        Some(format!("已拿到新的内容包，但写入本地缓存失败：{error}"));
                    sync_state.remote_state = remote_state;
                }
                return;
            }

            if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                sync_state.in_progress = false;
                sync_state.status_label = Some(
                    if has_changes {
                        "内容包已更新"
                    } else {
                        "当前已是最新资料"
                    }
                    .to_string(),
                );
                sync_state.status_note = Some(
                    if has_changes {
                        "本地内容包已经切换到最新快照，寻访页会直接按这份数据刷新。"
                    } else {
                        "Focused Moment 内容源和当前本地内容包一致，这次不用重新下载。"
                    }
                    .to_string(),
                );
                sync_state.remote_state = remote_state;
            }

            return;
        }
        Err(error) => {
            if let Ok(mut current) = state.content_pack_state.lock() {
                current.last_checked_at = Some(checked_at.clone());
            }
            let _ = state.persist();

            if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
                sync_state.in_progress = false;
                sync_state.status_label = Some(
                    if error.contains("内容包校验失败") {
                        "内容包校验失败"
                    } else {
                        "无法访问 Focused Moment 内容源"
                    }
                    .to_string(),
                );
                sync_state.status_note = Some(error);
                sync_state.remote_state = None;
            }

            return;
        }
    }

    let mut final_remote_state: Option<ContentPackRemoteState> = None;
    let mut status_label = "同步失败".to_string();
    let mut status_note: String;
    let mut should_persist = false;

    match result {
        Ok(remote) => match state.content_pack_state.lock() {
            Ok(mut current) => {
                current.last_checked_at = Some(checked_at.clone());
                should_persist = true;
                final_remote_state = Some(build_remote_state(&remote));

                if current.current_version != remote.pack_version {
                    current.current_version = remote.pack_version.clone();
                    current.current_server = CONTENT_PACK_SERVER_LABEL.to_string();
                    current.current_updated_at = remote.updated_at.clone();
                    current.operator_count = remote.operator_count;
                    current.banner_count = remote.banner_count;
                    current.source_label = remote.source_label.clone();
                    if let Some(store) = &state.persistence {
                        let _ = store.save_content_pack(&remote);
                    }
                    if let Ok(mut banners) = state.content_pack_banners.lock() {
                        *banners = remote.banners.clone();
                    }
                    current.last_synced_at = Some(current_local_timestamp());
                    status_label = "内容包已更新".to_string();
                    status_note =
                        "本地内容包已经同步到最新国服快照，寻访页面会自动按这份数据刷新。"
                            .to_string();
                } else {
                    status_label = "当前已是最新资料".to_string();
                    status_note = "国服远端数据和本地内容包一致，这次不需要再同步。".to_string();
                }
            }
            Err(_) => {
                status_note = "写入本地内容包状态时失败，请重新尝试。".to_string();
                final_remote_state = Some(build_remote_state(&remote));
            }
        },
        Err(error) => {
            status_note = error;

            if let Ok(mut current) = state.content_pack_state.lock() {
                current.last_checked_at = Some(checked_at);
                should_persist = true;
            }
        }
    }

    if should_persist {
        if let Err(error) = state.persist() {
            status_label = "同步失败".to_string();
            status_note = format!("远端结果已获取，但写入本地失败：{error}");
        }
    }

    if let Ok(mut sync_state) = state.content_pack_sync_state.lock() {
        sync_state.in_progress = false;
        sync_state.status_label = Some(status_label);
        sync_state.status_note = Some(status_note);
        sync_state.remote_state = final_remote_state;
    };
}

fn headhunt_snapshot(
    wallet: &RewardWallet,
    headhunt_state: &HeadhuntState,
    content_pack_banners: &[ContentBannerOverride],
) -> HeadhuntSnapshot {
    let current_banner = current_catalog_banner(headhunt_state);
    let pity_without_six_star = pity_counter_for_banner(headhunt_state, current_banner);

    HeadhuntSnapshot {
        current_banner: banner_snapshot_with_overrides(current_banner, content_pack_banners),
        available_banners: catalog_all_banners()
            .iter()
            .copied()
            .map(|banner| banner_snapshot_with_overrides(banner, content_pack_banners))
            .collect(),
        wallet_orundum: wallet.orundum,
        total_pulls: headhunt_state.total_pulls,
        pity_without_six_star,
        pulls_until_soft_pity: 50u32.saturating_sub(pity_without_six_star),
        unique_owned_count: headhunt_state.owned_operators.len(),
        owned_operators: headhunt_state.owned_operators.clone(),
        recent_results: headhunt_state.history.iter().take(10).cloned().collect(),
        history: headhunt_state.history.iter().take(30).cloned().collect(),
    }
}

fn next_random_seed(state: &HeadhuntState, wallet: &RewardWallet, step: u64) -> u64 {
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0);

    nanos
        ^ state.total_pulls.rotate_left(7)
        ^ u64::from(state.pity_without_six_star).rotate_left(13)
        ^ wallet.orundum.rotate_left(17)
        ^ step.rotate_left(23)
}

fn draw_operator_by_roll(
    seed: u64,
    six_star_rate: u64,
    banner: CatalogBannerDef,
) -> (HeadhuntOperatorDefinition, bool) {
    let roll = seed % 100;
    let six_threshold = six_star_rate;
    let five_threshold = six_threshold + 8;
    let four_threshold = five_threshold + 50;
    let rarity = if roll < six_threshold {
        6
    } else if roll < five_threshold {
        5
    } else if roll < four_threshold {
        4
    } else {
        3
    };

    let pool = catalog_ops_for_rarity(banner, rarity);
    let operator_index = ((seed / 100) as usize) % pool.len();
    let base_operator = pool[operator_index];
    let rate_up_ids = catalog_rate_up_ids_for_rarity(banner, rarity);
    let rate_up_share = catalog_rate_up_share_for_rarity(banner, rarity);

    let use_rate_up = !rate_up_ids.is_empty() && ((seed >> 9) % 100) < rate_up_share;
    let selected = if use_rate_up {
        let rate_up_index = ((seed >> 17) as usize) % rate_up_ids.len();
        catalog_operator_by_id(rate_up_ids[rate_up_index]).unwrap_or(base_operator)
    } else {
        base_operator
    };

    (
        HeadhuntOperatorDefinition {
            id: selected.id,
            name: selected.name,
            rarity: selected.rarity,
            profession: selected.profession,
        },
        use_rate_up && rate_up_ids.contains(&selected.id),
    )
}

fn run_headhunt_batch(
    wallet: &mut RewardWallet,
    headhunt_state: &mut HeadhuntState,
    content_pack_banners: &[ContentBannerOverride],
    pull_count: usize,
    spend_orundum: bool,
    is_preview: bool,
) -> Result<HeadhuntPayload, String> {
    let total_cost = if pull_count == 10 {
        HEADHUNT_TEN_COST
    } else {
        HEADHUNT_SINGLE_COST
    };
    let cost_per_pull = total_cost / pull_count as u64;
    let banner = current_catalog_banner(headhunt_state);

    if spend_orundum && wallet.orundum < total_cost {
        return Err(format!(
            "合成玉不足，单抽需要 {}，十连需要 {}",
            HEADHUNT_SINGLE_COST, HEADHUNT_TEN_COST
        ));
    }

    if spend_orundum {
        wallet.orundum = wallet.orundum.saturating_sub(total_cost);
    }

    let mut batch_results = Vec::with_capacity(pull_count);
    for index in 0..pull_count {
        let pity_counter = match banner.kind {
            CatalogBannerKind::Kernel => headhunt_state.kernel_pity_without_six_star,
            _ => headhunt_state.pity_without_six_star,
        };
        let six_star_rate = if pity_counter < 50 {
            2
        } else {
            (2 + u64::from(pity_counter - 49) * 2).min(100)
        };

        let roll_seed = next_random_seed(headhunt_state, wallet, index as u64 + 1);
        let (operator, is_rate_up) = draw_operator_by_roll(roll_seed, six_star_rate, banner);
        let is_new = record_owned_operator(&mut headhunt_state.owned_operators, operator);
        let result = HeadhuntPullResult {
            id: headhunt_state.next_pull_id,
            banner_id: banner.id.to_string(),
            banner_name: banner.name.to_string(),
            operator_id: operator.id.to_string(),
            operator_name: operator.name.to_string(),
            rarity: operator.rarity,
            profession: operator.profession.to_string(),
            is_rate_up,
            is_new,
            cost_orundum: if spend_orundum { cost_per_pull } else { 0 },
            pulled_at: current_local_timestamp(),
        };

        headhunt_state.next_pull_id = headhunt_state.next_pull_id.saturating_add(1);
        headhunt_state.total_pulls = headhunt_state.total_pulls.saturating_add(1);
        match banner.kind {
            CatalogBannerKind::Kernel => {
                if operator.rarity == 6 {
                    headhunt_state.kernel_pity_without_six_star = 0;
                } else {
                    headhunt_state.kernel_pity_without_six_star =
                        headhunt_state.kernel_pity_without_six_star.saturating_add(1);
                }
            }
            _ => {
                if operator.rarity == 6 {
                    headhunt_state.pity_without_six_star = 0;
                } else {
                    headhunt_state.pity_without_six_star =
                        headhunt_state.pity_without_six_star.saturating_add(1);
                }
            }
        }

        batch_results.push(result);
    }

    for result in batch_results.iter().rev() {
        headhunt_state.history.insert(0, result.clone());
    }
    headhunt_state.history.truncate(120);

    let snapshot = headhunt_snapshot(wallet, headhunt_state, content_pack_banners);
    Ok(HeadhuntPayload {
        snapshot,
        batch_results,
        spent_orundum: if spend_orundum { total_cost } else { 0 },
        is_preview,
    })
}

fn record_owned_operator(
    owned_operators: &mut Vec<HeadhuntOwnedOperator>,
    operator: HeadhuntOperatorDefinition,
) -> bool {
    if let Some(entry) = owned_operators
        .iter_mut()
        .find(|entry| entry.operator_id == operator.id)
    {
        entry.count = entry.count.saturating_add(1);
        false
    } else {
        owned_operators.push(HeadhuntOwnedOperator {
            operator_id: operator.id.to_string(),
            operator_name: operator.name.to_string(),
            rarity: operator.rarity,
            count: 1,
        });
        owned_operators.sort_by(|left, right| {
            Reverse(left.rarity)
                .cmp(&Reverse(right.rarity))
                .then_with(|| left.operator_name.cmp(&right.operator_name))
        });
        true
    }
}

fn analytics_snapshot(records: &[FocusRecord], todo_items: &[TodoItem]) -> AnalyticsSnapshot {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let total_focus_duration_ms = records.iter().map(|record| record.duration_ms).sum::<u64>();
    let session_count = records.len();
    let linked_session_count = records
        .iter()
        .filter(|record| record.linked_todo_id.is_some())
        .count();
    let independent_session_count = session_count.saturating_sub(linked_session_count);
    let pending_todo_count = todo_items.iter().filter(|item| !item.is_completed).count();
    let completed_todo_count = todo_items.iter().filter(|item| item.is_completed).count();

    let mut grouped = BTreeMap::<String, Vec<&FocusRecord>>::new();
    for record in records {
        let date_key = if record.completed_date.trim().is_empty() {
            "未记录日期".to_string()
        } else {
            record.completed_date.clone()
        };

        grouped.entry(date_key).or_default().push(record);
    }

    let mut daily_breakdown = grouped
        .into_iter()
        .map(|(date, day_records)| {
            let total_duration_ms = day_records
                .iter()
                .map(|record| record.duration_ms)
                .sum::<u64>();
            let session_count = day_records.len();
            let linked_session_count = day_records
                .iter()
                .filter(|record| record.linked_todo_id.is_some())
                .count();
            let independent_session_count = session_count.saturating_sub(linked_session_count);

            DailyInsight {
                date,
                total_duration_ms,
                total_duration_label: format_duration_ms(total_duration_ms),
                session_count,
                linked_session_count,
                independent_session_count,
            }
        })
        .collect::<Vec<_>>();

    daily_breakdown.sort_by(|left, right| right.date.cmp(&left.date));

    let active_days = daily_breakdown.len();
    let average_daily_duration_ms = if active_days == 0 {
        0
    } else {
        total_focus_duration_ms / active_days as u64
    };

    let today_summary = daily_breakdown
        .iter()
        .find(|day| day.date == today)
        .cloned()
        .unwrap_or(DailyInsight {
            date: today,
            total_duration_ms: 0,
            total_duration_label: format_duration_ms(0),
            session_count: 0,
            linked_session_count: 0,
            independent_session_count: 0,
        });

    AnalyticsSnapshot {
        total_focus_duration_ms,
        total_focus_duration_label: format_duration_ms(total_focus_duration_ms),
        session_count,
        linked_session_count,
        independent_session_count,
        pending_todo_count,
        completed_todo_count,
        active_days,
        average_daily_duration_label: format_duration_ms(average_daily_duration_ms),
        today_focus_duration_label: today_summary.total_duration_label,
        today_session_count: today_summary.session_count,
        daily_breakdown,
    }
}

fn with_todo_items<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut Vec<TodoItem>) -> Result<T, String>,
) -> Result<T, String> {
    let mut items = state.todo_items.lock().map_err(|_| {
        "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    f(&mut items)
}

fn with_focus_records<T>(
    state: &tauri::State<'_, TimerEngineState>,
    f: impl FnOnce(&mut Vec<FocusRecord>) -> Result<T, String>,
) -> Result<T, String> {
    let mut records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;

    f(&mut records)
}

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn resolve_export_directory() -> Result<PathBuf, String> {
    let base_dir = env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Documents"))
        .filter(|path| path.exists())
        .unwrap_or(env::current_dir().map_err(|error| error.to_string())?);

    let export_dir = base_dir.join("Focused Moment Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    Ok(export_dir)
}

#[tauri::command]
fn bootstrap_shell() -> ShellSnapshot {
    ShellSnapshot {
        product_name: "Focused Moment",
        version: "1.5.6",
        milestone: "v1.5.6 稳定内容快照重构版",
        slogan: "\u{4e13}\u{6ce8}\u{79ef}\u{7d2f}\u{4e0b}\u{6765}\u{7684}\u{5408}\u{6210}\u{7389}\u{ff0c}\u{73b0}\u{5728}\u{7ec8}\u{4e8e}\u{53ef}\u{4ee5}\u{771f}\u{6b63}\u{653e}\u{8fdb}\u{5bfb}\u{8bbf}\u{7cfb}\u{7edf}\u{91cc}\u{4e86}\u{3002}",
        surfaces: vec![
            ShellPanel {
                id: "timer",
                title: "\u{65f6}\u{95f4}\u{5f15}\u{64ce}",
                phase: "v0.2-v0.3",
                status: "\u{5df2}\u{5b8c}\u{6210}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{6b63}\u{5411}\u{8ba1}\u{65f6}\u{3001}\u{756a}\u{8304}\u{949f}\u{4ee5}\u{53ca}\u{540e}\u{53f0}/\u{4f11}\u{7720}\u{6062}\u{590d}\u{540e}\u{7684}\u{771f}\u{5b9e}\u{65f6}\u{95f4}\u{6821}\u{6b63}\u{3002}",
            },
            ShellPanel {
                id: "tasks",
                title: "\u{4efb}\u{52a1}\u{9762}\u{677f}",
                phase: "v0.4.0-v1.2.0",
                status: "\u{5df2}\u{589e}\u{5f3a}",
                summary: "\u{4efb}\u{52a1}\u{533a}\u{73b0}\u{5728}\u{652f}\u{6301}\u{641c}\u{7d22}\u{3001}\u{7b5b}\u{9009}\u{4e0e}\u{6392}\u{5e8f}\u{ff0c}\u{66f4}\u{9002}\u{5408}\u{65e5}\u{5e38}\u{7ef4}\u{62a4}\u{548c}\u{5feb}\u{901f}\u{627e}\u{4efb}\u{52a1}\u{3002}",
            },
            ShellPanel {
                id: "analytics",
                title: "\u{6570}\u{636e}\u{590d}\u{76d8}",
                phase: "v0.7.0-v1.1.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5df2}\u{652f}\u{6301}\u{65f6}\u{95f4}\u{8303}\u{56f4}\u{7b5b}\u{9009}\u{3001}\u{5355}\u{6761}\u{5220}\u{9664}\u{3001}\u{8303}\u{56f4}\u{6e05}\u{7406}\u{4e0e} CSV \u{5bfc}\u{51fa}\u{ff0c}\u{590d}\u{76d8}\u{9875}\u{7684}\u{65e5}\u{5e38}\u{53ef}\u{7528}\u{6027}\u{66f4}\u{5b8c}\u{6574}\u{4e86}\u{3002}",
            },
            ShellPanel {
                id: "tray",
                title: "\u{540e}\u{53f0}\u{5e38}\u{9a7b}",
                phase: "v0.9.0-v1.0.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{5173}\u{95ed}\u{4e3b}\u{7a97}\u{53e3}\u{540e}\u{4f1a}\u{9690}\u{85cf}\u{5230}\u{7cfb}\u{7edf}\u{6258}\u{76d8}\u{ff0c}\u{53ef}\u{4ee5}\u{4ece}\u{6258}\u{76d8}\u{91cd}\u{65b0}\u{6253}\u{5f00}\u{6216}\u{9000}\u{51fa}\u{5e94}\u{7528}\u{3002}",
            },
            ShellPanel {
                id: "reward-engine",
                title: "\u{5956}\u{52b1}\u{5f15}\u{64ce}",
                phase: "v1.3.0-v1.4.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{73b0}\u{5728}\u{6bcf}\u{5b8c}\u{6210}\u{4e00}\u{8f6e}\u{4e13}\u{6ce8}\u{ff0c}\u{90fd}\u{4f1a}\u{7ed3}\u{7b97}\u{9f99}\u{95e8}\u{5e01}\u{3001}\u{5408}\u{6210}\u{7389}\u{548c}\u{6e90}\u{77f3}\u{ff0c}\u{5e76}\u{7559}\u{4e0b}\u{5956}\u{52b1}\u{6d41}\u{6c34}\u{3002}",
            },
            ShellPanel {
                id: "content-pack-sync",
                title: "\u{5185}\u{5bb9}\u{5305}\u{540c}\u{6b65}",
                phase: "v1.4.0-v1.4.1",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{73b0}\u{5728}\u{53ef}\u{4ee5}\u{624b}\u{52a8}\u{68c0}\u{67e5}\u{65b9}\u{821f}\u{8d44}\u{6599}\u{66f4}\u{65b0}\u{ff0c}\u{5e76}\u{4ee5}\u{66f4}\u{5408}\u{7406}\u{7684}\u{201c}\u{5168}\u{91cf}\u{76ee}\u{5f55} + \u{5f53}\u{524d}\u{5361}\u{6c60}\u{201d}\u{53e3}\u{5f84}\u{5c55}\u{793a}\u{5185}\u{5bb9}\u{5305}\u{3002}",
            },
            ShellPanel {
                id: "headhunt-engine",
                title: "\u{5bfb}\u{8bbf}\u{5f15}\u{64ce}",
                phase: "v1.5.0",
                status: "\u{5df2}\u{63a5}\u{5165}",
                summary: "\u{73b0}\u{5728}\u{5df2}\u{7ecf}\u{53ef}\u{4ee5}\u{4f7f}\u{7528}\u{5408}\u{6210}\u{7389}\u{8fdb}\u{884c}\u{5355}\u{62bd}\u{3001}\u{5341}\u{8fde}\u{3001}\u{8bb0}\u{5f55}\u{4fdd}\u{5e95}\u{8fdb}\u{5ea6}\u{548c}\u{672c}\u{5730}\u{5bfb}\u{8bbf}\u{5386}\u{53f2}\u{3002}",
            },
        ],
        reserved_extensions: vec![
            ShellPanel {
                id: "progression",
                title: "\u{517b}\u{6210}\u{5c42}",
                phase: "\u{9884}\u{7559}",
                status: "\u{672a}\u{6765}\u{6269}\u{5c55}",
                summary: "\u{4e3a}\u{672a}\u{6765}\u{7684}\u{89d2}\u{8272}\u{6210}\u{957f}\u{3001}\u{517b}\u{6210}\u{5faa}\u{73af}\u{6216}\u{6536}\u{96c6}\u{7cfb}\u{7edf}\u{4fdd}\u{7559}\u{7ed3}\u{6784}\u{4f4d}\u{7f6e}\u{3002}",
            },
            ShellPanel {
                id: "theme-profile",
                title: "\u{4e3b}\u{9898}\u{914d}\u{7f6e}",
                phase: "\u{9884}\u{7559}",
                status: "\u{672a}\u{6765}\u{6269}\u{5c55}",
                summary: "\u{8ba9}\u{5f53}\u{524d}\u{514b}\u{5236}\u{7684}\u{57fa}\u{7840}\u{98ce}\u{683c}\u{80fd}\u{5728}\u{540e}\u{9762}\u{5e73}\u{6ed1}\u{5207}\u{6362}\u{4e3a}\u{66f4}\u{591a}\u{4e3b}\u{9898}\u{5316}\u{89c6}\u{89c9}\u{3002}",
            },
        ],
    }
}

#[tauri::command]
fn get_timer_snapshot(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| Ok(engine.snapshot()))
}

#[tauri::command]
fn switch_timer_mode(
    state: tauri::State<'_, TimerEngineState>,
    mode: String,
) -> Result<TimerSnapshot, String> {
    let next_mode = parse_mode(&mode)?;
    with_timer_engine(&state, |engine| {
        engine.switch_mode(next_mode);
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn get_focus_records(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<Vec<FocusRecord>, String> {
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(records.clone())
}

#[tauri::command]
fn delete_focus_record(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<FocusRecord>, String> {
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| record.id != id);
        if records.len() == before_len {
            return Err("未找到要删除的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    {
        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.retain(|entry| entry.source_record_id != id);
        sort_reward_ledger(&mut ledger);

        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        *wallet = wallet_from_ledger(&ledger);
    }

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn delete_focus_records(
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<Vec<FocusRecord>, String> {
    if ids.is_empty() {
        return Err("当前范围内没有可清理的专注记录".to_string());
    }

    let id_set = ids.into_iter().collect::<HashSet<_>>();
    let records = with_focus_records(&state, |records| {
        let before_len = records.len();
        records.retain(|record| !id_set.contains(&record.id));
        if records.len() == before_len {
            return Err("没有找到可清理的专注记录".to_string());
        }

        sort_focus_records(records);
        Ok(records.clone())
    })?;

    {
        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.retain(|entry| !id_set.contains(&entry.source_record_id));
        sort_reward_ledger(&mut ledger);

        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        *wallet = wallet_from_ledger(&ledger);
    }

    state.persist()?;
    Ok(records)
}

#[tauri::command]
fn get_analytics_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<AnalyticsSnapshot, String> {
    let records = state.focus_records.lock().map_err(|_| {
        "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;
    let todo_items = state.todo_items.lock().map_err(|_| {
        "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
            .to_string()
    })?;

    Ok(analytics_snapshot(&records, &todo_items))
}

#[tauri::command]
fn get_reward_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<RewardSnapshot, String> {
    let records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;
    let wallet = state
        .reward_wallet
        .lock()
        .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
    let ledger = state
        .reward_ledger
        .lock()
        .map_err(|_| "奖励流水状态锁定失败".to_string())?;

    Ok(reward_snapshot(&records, &wallet, &ledger))
}

#[tauri::command]
fn get_content_pack_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<ContentPackSnapshot, String> {
    return current_content_pack_snapshot_from_engine(&state);

    let current = state
        .content_pack_state
        .lock()
        .map_err(|_| "内容包状态锁定失败".to_string())?
        .clone();
    Ok(content_pack_snapshot_from_state(
        &current,
        &current,
        "内容包待检查",
        "点击下方按钮后，会在后台检查国服远端数据源并同步到本地。",
    ))
}

#[tauri::command]
async fn sync_content_pack(app: AppHandle) -> Result<ContentPackSnapshot, String> {
    let state = app.state::<TimerEngineState>();

    {
        let mut sync_state = state
            .content_pack_sync_state
            .lock()
            .map_err(|_| "内容包同步状态锁定失败".to_string())?;

        if sync_state.in_progress {
            return current_content_pack_snapshot_from_engine(&state);
        }

        sync_state.in_progress = true;
        sync_state.status_label = Some("正在检查 Focused Moment 内容源".to_string());
        sync_state.status_note = Some(
            "当前只会访问 Focused Moment 固定内容快照源，检查完成后会自动刷新寻访页面。"
                .to_string(),
        );
        sync_state.remote_state = None;
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(fetch_remote_content_manifest_and_pack)
            .await
            .map_err(|error| format!("后台内容同步任务执行失败：{error}"))
            .and_then(|result| result.map(|(_, pack)| pack));
        finish_content_pack_sync(&app_handle, result);
    });

    return current_content_pack_snapshot_from_engine(&state);

    let (_, remote) = tauri::async_runtime::spawn_blocking(fetch_remote_content_manifest_and_pack)
        .await
        .map_err(|error| format!("后台同步任务执行失败：{error}"))?
        .map_err(|error| format!("同步失败，请检查网络后重试：{error}"))?;
    let checked_at = current_local_timestamp();
    let remote_state = build_content_pack_state(&remote, None, None);

    let snapshot = {
        let mut current = state
            .content_pack_state
            .lock()
            .map_err(|_| "内容包状态锁定失败".to_string())?;
        current.last_checked_at = Some(checked_at);

        if current.current_version != remote.pack_version {
            current.current_version = remote.pack_version.clone();
            current.current_server = CONTENT_PACK_SERVER_LABEL.to_string();
            current.current_updated_at = remote.updated_at.clone();
            current.operator_count = remote.operator_count;
            current.banner_count = remote.banner_count;
            current.source_label = remote.source_label.clone();
            current.last_synced_at = Some(current_local_timestamp());

            content_pack_snapshot_from_state(
                &current,
                &remote_state,
                "内容包已更新",
                "本地内容包已经同步到最新快照，后续寻访和干员目录会以这份快照为准。",
            )
        } else {
            content_pack_snapshot_from_state(
                &current,
                &remote_state,
                "已是最新资料",
                "当前本地内容包已经和远端快照一致，这次不需要再下载新的资料。",
            )
        }
    };

    state.persist()?;
    Ok(snapshot)
}

#[tauri::command]
fn get_live_content_pack_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<ContentPackSnapshot, String> {
    current_content_pack_snapshot_from_engine(&state)
}

#[tauri::command]
fn start_content_pack_sync(app: AppHandle) -> Result<ContentPackSnapshot, String> {
    let state = app.state::<TimerEngineState>();

    {
        let mut sync_state = state
            .content_pack_sync_state
            .lock()
            .map_err(|_| "内容包同步状态锁定失败".to_string())?;

        if !sync_state.in_progress {
            sync_state.in_progress = true;
            sync_state.status_label = Some("正在后台同步".to_string());
            sync_state.status_note = Some(
                "已切到后台检查国服远端数据源，完成后会自动刷新开发者页与寻访页。"
                    .to_string(),
            );
            sync_state.remote_state = None;

            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let result = tauri::async_runtime::spawn_blocking(fetch_remote_content_manifest_and_pack)
                    .await
                    .map_err(|error| format!("后台同步任务执行失败：{error}"))
                    .and_then(|result| result.map(|(_, pack)| pack)); /*
                        result.map_err(|error| format!("同步失败，请检查网络后重试：{error}"))
                */ finish_content_pack_sync(&app_handle, result);
            });
        }
    }

    current_content_pack_snapshot_from_engine(&state)
}

#[tauri::command]
fn import_content_pack_json(
    state: tauri::State<'_, TimerEngineState>,
    json_text: String,
) -> Result<ContentPackSnapshot, String> {
    let parsed_pack: ContentPackFile = serde_json::from_str(&json_text)
        .map_err(|error| format!("内容包校验失败：导入文件不是合法 JSON：{error}"))?;
    let content_pack = validate_content_pack_file(parsed_pack)?;
    let checked_at = current_local_timestamp();

    if let Some(store) = &state.persistence {
        store.save_content_pack(&content_pack)?;
    }

    {
        let mut banners = state
            .content_pack_banners
            .lock()
            .map_err(|_| "内容包缓存锁定失败".to_string())?;
        *banners = content_pack.banners.clone();
    }

    {
        let mut current = state
            .content_pack_state
            .lock()
            .map_err(|_| "内容包状态锁定失败".to_string())?;
        *current = build_content_pack_state(
            &content_pack,
            Some(checked_at),
            Some(current_local_timestamp()),
        );
    }

    {
        let mut sync_state = state
            .content_pack_sync_state
            .lock()
            .map_err(|_| "内容包同步状态锁定失败".to_string())?;
        sync_state.in_progress = false;
        sync_state.status_label = Some("内容包已导入".to_string());
        sync_state.status_note = Some("本地内容包导入成功，寻访页已经切换到这份快照。".to_string());
        sync_state.remote_state = Some(build_remote_state(&content_pack));
    }

    state.persist()?;
    current_content_pack_snapshot_from_engine(&state)
}

#[tauri::command]
fn get_headhunt_snapshot(
    state: tauri::State<'_, TimerEngineState>,
) -> Result<HeadhuntSnapshot, String> {
    let wallet = state
        .reward_wallet
        .lock()
        .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
    let headhunt_state = state
        .headhunt_state
        .lock()
        .map_err(|_| "寻访状态锁定失败".to_string())?;

    Ok(headhunt_snapshot(
        &wallet,
        &headhunt_state,
        &state
            .content_pack_banners
            .lock()
            .map_err(|_| "failed to lock content pack banners".to_string())?
            .clone(),
    ))
}

#[tauri::command]
fn set_current_headhunt_banner(
    state: tauri::State<'_, TimerEngineState>,
    banner_id: String,
) -> Result<HeadhuntSnapshot, String> {
    let wallet = state
        .reward_wallet
        .lock()
        .map_err(|_| "寻访资源锁定失败".to_string())?
        .clone();

    let content_pack_banners = state
        .content_pack_banners
        .lock()
        .map_err(|_| "failed to lock content pack banners".to_string())?
        .clone();

    let snapshot = {
        let mut headhunt_state = state
            .headhunt_state
            .lock()
            .map_err(|_| "寻访状态锁定失败".to_string())?;

        if catalog_banner_by_id(&banner_id).is_none() {
            return Err("未找到对应的寻访卡池".to_string());
        }

        headhunt_state.current_banner_id = banner_id;
        normalize_headhunt_state(&mut headhunt_state);
        headhunt_snapshot(&wallet, &headhunt_state, &content_pack_banners)
    };

    state.persist()?;
    Ok(snapshot)
}

#[tauri::command]
fn perform_preview_headhunt(
    state: tauri::State<'_, TimerEngineState>,
    pulls: u8,
) -> Result<HeadhuntPayload, String> {
    let pull_count = match pulls {
        1 | 10 => pulls as usize,
        _ => return Err("当前只支持单抽或十连".to_string()),
    };

    let wallet = state
        .reward_wallet
        .lock()
        .map_err(|_| "奖励钱包状态锁定失败".to_string())?
        .clone();
    let headhunt_state = state
        .headhunt_state
        .lock()
        .map_err(|_| "寻访状态锁定失败".to_string())?
        .clone();

    let content_pack_banners = state
        .content_pack_banners
        .lock()
        .map_err(|_| "failed to lock content pack banners".to_string())?
        .clone();

    let mut preview_wallet = wallet;
    let mut preview_state = headhunt_state;
    run_headhunt_batch(
        &mut preview_wallet,
        &mut preview_state,
        &content_pack_banners,
        pull_count,
        false,
        true,
    )
}

#[tauri::command]
fn perform_headhunt(
    state: tauri::State<'_, TimerEngineState>,
    pulls: u8,
) -> Result<HeadhuntPayload, String> {
    let pull_count = match pulls {
        1 | 10 => pulls as usize,
        _ => return Err("当前只支持单抽或十连".to_string()),
    };
    let content_pack_banners = state
        .content_pack_banners
        .lock()
        .map_err(|_| "failed to lock content pack banners".to_string())?
        .clone();

    let payload = {
        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        let mut headhunt_state = state
            .headhunt_state
            .lock()
            .map_err(|_| "寻访状态锁定失败".to_string())?;

        normalize_headhunt_state(&mut headhunt_state);
        run_headhunt_batch(
            &mut wallet,
            &mut headhunt_state,
            &content_pack_banners,
            pull_count,
            true,
            false,
        )?
    };

    state.persist()?;
    Ok(payload)
}

#[tauri::command]
fn clear_app_data(state: tauri::State<'_, TimerEngineState>) -> Result<(), String> {
    state.clear_all()
}

#[tauri::command]
fn export_focus_records_csv(
    state: tauri::State<'_, TimerEngineState>,
    ids: Vec<u64>,
) -> Result<String, String> {
    if ids.is_empty() {
        return Err("当前范围内没有可导出的专注记录".to_string());
    }

    let id_set = ids.into_iter().collect::<HashSet<_>>();
    let records = state
        .focus_records
        .lock()
        .map_err(|_| "记录列表状态锁定失败".to_string())?;

    let export_records = records
        .iter()
        .filter(|record| id_set.contains(&record.id))
        .cloned()
        .collect::<Vec<_>>();

    if export_records.is_empty() {
        return Err("当前范围内没有可导出的专注记录".to_string());
    }

    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let export_dir = resolve_export_directory()?;
    let export_path = export_dir.join(format!("focused-moment-records-{timestamp}.csv"));

    let mut csv_output =
        String::from("\u{feff}记录日期,记录时间,事务名称,模式,阶段,时长,关联任务\n");
    for record in export_records {
        let line = format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(&record.completed_date),
            csv_escape(&record.completed_time),
            csv_escape(&record.title),
            csv_escape(&record.mode_label),
            csv_escape(&record.phase_label),
            csv_escape(&record.duration_label),
            csv_escape(record.linked_todo_title.as_deref().unwrap_or("")),
        );
        csv_output.push_str(&line);
    }

    fs::write(&export_path, csv_output).map_err(|error| error.to_string())?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
fn get_todo_items(state: tauri::State<'_, TimerEngineState>) -> Result<Vec<TodoItem>, String> {
    with_todo_items(&state, |items| {
        let mut cloned_items = items.clone();
        sort_todo_items(&mut cloned_items);
        Ok(cloned_items)
    })
}

#[tauri::command]
fn create_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let next_id = {
        let mut id_guard = state.next_todo_id.lock().map_err(|_| {
            "\u{4efb}\u{52a1}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let items = with_todo_items(&state, |items| {
        items.insert(
            0,
            TodoItem {
                id: next_id,
                title: normalized_title,
                is_completed: false,
                scheduled_date: normalized_date,
                scheduled_time: normalized_time,
                importance_key: normalized_importance,
            },
        );
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn update_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
    title: String,
    scheduled_date: String,
    scheduled_time: String,
    importance_key: String,
) -> Result<Vec<TodoItem>, String> {
    let normalized_title = normalize_todo_title(&title)?;
    let normalized_date = normalize_scheduled_date(&scheduled_date)?;
    let normalized_time = normalize_scheduled_time(&scheduled_time)?;
    let normalized_importance = normalize_importance_key(&importance_key)?;

    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{7f16}\u{8f91}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.title = normalized_title;
        item.scheduled_date = normalized_date;
        item.scheduled_time = normalized_time;
        item.importance_key = normalized_importance;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn toggle_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let items = with_todo_items(&state, |items| {
        let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| {
            "\u{672a}\u{627e}\u{5230}\u{8981}\u{66f4}\u{65b0}\u{7684}\u{4efb}\u{52a1}".to_string()
        })?;

        item.is_completed = !item.is_completed;
        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn delete_todo_item(
    state: tauri::State<'_, TimerEngineState>,
    id: u64,
) -> Result<Vec<TodoItem>, String> {
    let items = with_todo_items(&state, |items| {
        let before_len = items.len();
        items.retain(|item| item.id != id);
        if items.len() == before_len {
            return Err(
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5220}\u{9664}\u{7684}\u{4efb}\u{52a1}"
                    .to_string(),
            );
        }

        sort_todo_items(items);
        Ok(items.clone())
    })?;

    state.persist()?;
    Ok(items)
}

#[tauri::command]
fn start_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.start();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn pause_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.pause();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn reset_timer(state: tauri::State<'_, TimerEngineState>) -> Result<TimerSnapshot, String> {
    with_timer_engine(&state, |engine| {
        engine.reset();
        Ok(engine.snapshot())
    })
}

#[tauri::command]
fn complete_focus_session(
    state: tauri::State<'_, TimerEngineState>,
    title: String,
    linked_todo_id: Option<u64>,
) -> Result<CompletionPayload, String> {
    let completed_session = with_timer_engine(&state, |engine| engine.complete_focus_session())?;
    let (completed_at, completed_date, completed_time) = current_local_markers();

    let linked_todo_title = match linked_todo_id {
        Some(id) => {
            let items = state.todo_items.lock().map_err(|_| {
                "\u{4efb}\u{52a1}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                    .to_string()
            })?;

            let item = items.iter().find(|item| item.id == id).ok_or_else(|| {
                "\u{672a}\u{627e}\u{5230}\u{8981}\u{5173}\u{8054}\u{7684}\u{4efb}\u{52a1}"
                    .to_string()
            })?;

            Some(item.title.clone())
        }
        None => None,
    };

    let next_id = {
        let mut id_guard = state.next_record_id.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{7f16}\u{53f7}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let normalized_title = title.trim();
    let record_title = if normalized_title.is_empty() {
        linked_todo_title
            .clone()
            .unwrap_or_else(|| "\u{672a}\u{547d}\u{540d}\u{4e8b}\u{52a1}".to_string())
    } else {
        normalized_title.to_string()
    };

    let record = FocusRecord {
        id: next_id,
        title: record_title.clone(),
        duration_ms: completed_session.duration_ms,
        duration_label: format_duration_ms(completed_session.duration_ms),
        mode_key: completed_session.mode_key.to_string(),
        mode_label: completed_session.mode_label.to_string(),
        phase_label: completed_session.phase_label.to_string(),
        linked_todo_id,
        linked_todo_title,
        completed_at,
        completed_date,
        completed_time,
    };

    let record_id = record.id;
    let reward_completed_at = record.completed_at.clone();
    let reward_completed_date = record.completed_date.clone();
    let reward_completed_time = record.completed_time.clone();

    let records = {
        let mut records = state.focus_records.lock().map_err(|_| {
            "\u{8bb0}\u{5f55}\u{5217}\u{8868}\u{72b6}\u{6001}\u{9501}\u{5b9a}\u{5931}\u{8d25}"
                .to_string()
        })?;

        records.insert(0, record);
        sort_focus_records(&mut records);
        records.clone()
    };

    let reward_id = {
        let mut id_guard = state
            .next_reward_id
            .lock()
            .map_err(|_| "奖励编号状态锁定失败".to_string())?;
        let next_id = *id_guard;
        *id_guard += 1;
        next_id
    };

    let reward_ledger_before = {
        let ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.clone()
    };

    let reward_entry = build_reward_entry(
        reward_id,
        record_id,
        &record_title,
        &completed_session,
        reward_completed_at,
        reward_completed_date,
        reward_completed_time,
        linked_todo_id,
        &reward_ledger_before,
    );

    let reward_snapshot = {
        let mut wallet = state
            .reward_wallet
            .lock()
            .map_err(|_| "奖励钱包状态锁定失败".to_string())?;
        wallet.lmd = wallet.lmd.saturating_add(reward_entry.lmd);
        wallet.orundum = wallet.orundum.saturating_add(reward_entry.orundum);
        wallet.originium = wallet.originium.saturating_add(reward_entry.originium);

        let mut ledger = state
            .reward_ledger
            .lock()
            .map_err(|_| "奖励流水状态锁定失败".to_string())?;
        ledger.insert(0, reward_entry);
        sort_reward_ledger(&mut ledger);

        reward_snapshot(&records, &wallet, &ledger)
    };

    state.persist()?;

    let timer_snapshot = with_timer_engine(&state, |engine| Ok(engine.snapshot()))?;

    Ok(CompletionPayload {
        timer_snapshot,
        records,
        reward_snapshot,
    })
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn hide_main_window(window: &Window) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

fn build_system_tray(app: &AppHandle) -> Result<(), String> {
    let show_item = MenuItemBuilder::with_id(TRAY_SHOW_ID, "显示主界面")
        .build(app)
        .map_err(|error| error.to_string())?;
    let quit_item = MenuItemBuilder::with_id(TRAY_QUIT_ID, "退出应用")
        .build(app)
        .map_err(|error| error.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|error| error.to_string())?;

    let mut tray_builder = TrayIconBuilder::with_id("focused-moment-tray")
        .menu(&menu)
        .tooltip("Focused Moment")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            TRAY_SHOW_ID => {
                let _ = show_main_window(app);
            }
            TRAY_QUIT_ID => {
                if let Some(state) = app.try_state::<AppLifecycleState>() {
                    state.mark_quitting();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<_>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let _ = tray_builder.build(app).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_main_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_maximize_main_window(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn close_main_window(window: tauri::Window) -> Result<(), String> {
    hide_main_window(&window)
}

#[tauri::command]
fn quit_application(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppLifecycleState>() {
        state.mark_quitting();
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn show_main_window_from_tray(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
fn start_dragging_main_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TimerEngineState::new())
        .manage(AppLifecycleState::new())
        .setup(|app| {
            build_system_tray(&app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.app_handle().try_state::<AppLifecycleState>() {
                    if !state.is_quitting() {
                        api.prevent_close();
                        let _ = hide_main_window(window);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap_shell,
            get_timer_snapshot,
            switch_timer_mode,
            get_focus_records,
            delete_focus_record,
            delete_focus_records,
            get_analytics_snapshot,
            get_reward_snapshot,
            get_content_pack_snapshot,
            sync_content_pack,
            import_content_pack_json,
            get_headhunt_snapshot,
            set_current_headhunt_banner,
            perform_preview_headhunt,
            perform_headhunt,
            clear_app_data,
            export_focus_records_csv,
            get_todo_items,
            create_todo_item,
            update_todo_item,
            toggle_todo_item,
            delete_todo_item,
            start_timer,
            pause_timer,
            reset_timer,
            complete_focus_session,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            quit_application,
            show_main_window_from_tray,
            start_dragging_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
