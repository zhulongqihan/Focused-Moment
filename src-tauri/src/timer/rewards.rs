/**
 * 番茄钟会话奖励计算
 * 
 * 实现会话奖励计算逻辑
 * 验证需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

use rusqlite::Connection;
use crate::gacha::models::{Currency, Resources};
use crate::gacha::database::{load_currency, update_currency, load_resources, update_resources};

/**
 * 会话类型
 */
#[derive(Debug, Clone, PartialEq)]
pub enum SessionMode {
    Work,
    Break,
}

/**
 * 会话奖励结果
 */
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionRewardResult {
    pub earned_currency: Currency,
    pub earned_resources: Resources,
    pub message: String,
}

/**
 * 计算会话奖励
 * 
 * 验证需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * 
 * # Arguments
 * * `mode` - 会话模式（工作/休息）
 * * `completed` - 是否完成
 * * `duration_minutes` - 实际专注时长（分钟）
 * * `challenge_completed` - 是否完成挑战
 * 
 * # Returns
 * * `SessionRewardResult` - 奖励结果
 * 
 * # 奖励规则（重构后更平衡）
 * - 只有完成的工作会话才有奖励
 * - 基础奖励按时长计算：每分钟 4 合成玉、10 龙门币、2 经验值
 * - 挑战完成额外奖励：+30 合成玉、+100 龙门币
 * - 移除Boss战机制，所有番茄钟奖励一致
 */
pub fn calculate_session_rewards(
    mode: SessionMode,
    completed: bool,
    duration_minutes: u32,
    challenge_completed: bool,
) -> SessionRewardResult {
    let mut earned_currency = Currency::default();
    let mut earned_resources = Resources::default();
    let mut message = String::new();
    
    // 只有完成的工作会话才有奖励
    if mode != SessionMode::Work || !completed {
        return SessionRewardResult {
            earned_currency,
            earned_resources,
            message: "未完成工作会话，无奖励".to_string(),
        };
    }
    
    // 基础奖励：按时长计算（每分钟 4 合成玉、10 龙门币、2 经验值）
    let base_orundum = duration_minutes * 4;
    let base_lmd = duration_minutes * 10;
    let base_exp = duration_minutes * 2;
    
    earned_currency.orundum = base_orundum;
    earned_resources.lmd = base_lmd;
    earned_resources.exp = base_exp;
    
    message.push_str(&format!(
        "专注{}分钟完成！获得：{}合成玉、{}龙门币、{}经验值",
        duration_minutes, base_orundum, base_lmd, base_exp
    ));
    
    // 挑战完成额外奖励
    if challenge_completed {
        earned_currency.orundum += 30;
        earned_resources.lmd += 100;
        message.push_str("，作战委托完成额外奖励：+30合成玉、+100龙门币");
    }
    
    // 添加少量芯片作为奖励（用于精英化）
    let chip_amount = if duration_minutes >= 25 { 2 } else { 1 };
    earned_resources.chips.insert("elite_chip_5".to_string(), chip_amount);
    
    SessionRewardResult {
        earned_currency,
        earned_resources,
        message: format!("{}！", message),
    }
}

/**
 * 应用会话奖励到数据库
 * 
 * 验证需求: 8.7
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `mode` - 会话模式
 * * `completed` - 是否完成
 * * `duration_minutes` - 实际专注时长（分钟）
 * * `challenge_completed` - 是否完成挑战
 * 
 * # Returns
 * * `Result<SessionRewardResult, String>` - 奖励结果或错误信息
 */
pub fn apply_session_rewards(
    conn: &Connection,
    mode: SessionMode,
    completed: bool,
    duration_minutes: u32,
    challenge_completed: bool,
) -> Result<SessionRewardResult, String> {
    // 计算奖励
    let reward = calculate_session_rewards(mode, completed, duration_minutes, challenge_completed);
    
    // 如果没有奖励，直接返回
    if reward.earned_currency.orundum == 0 && reward.earned_resources.lmd == 0 {
        return Ok(reward);
    }
    
    // 加载当前货币和资源
    let mut current_currency = load_currency(conn)
        .map_err(|e| format!("Failed to load currency: {}", e))?;
    let mut current_resources = load_resources(conn)
        .map_err(|e| format!("Failed to load resources: {}", e))?;
    
    // 添加奖励（需求 8.7）
    current_currency.add(&reward.earned_currency);
    current_resources.add(&reward.earned_resources);
    
    // 更新数据库
    update_currency(conn, &current_currency)
        .map_err(|e| format!("Failed to update currency: {}", e))?;
    update_resources(conn, &current_resources)
        .map_err(|e| format!("Failed to update resources: {}", e))?;
    
    Ok(reward)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gacha::database::initialize_gacha_database;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_gacha_database(&conn).unwrap();
        conn
    }

    #[test]
    fn test_normal_work_session_rewards() {
        // 25分钟番茄钟
        let reward = calculate_session_rewards(SessionMode::Work, true, 25, false);
        
        assert_eq!(reward.earned_currency.orundum, 100); // 25 * 4
        assert_eq!(reward.earned_resources.lmd, 250);    // 25 * 10
        assert_eq!(reward.earned_resources.exp, 50);     // 25 * 2
        assert!(reward.message.contains("25分钟"));
    }

    #[test]
    fn test_short_session_rewards() {
        // 15分钟短番茄钟
        let reward = calculate_session_rewards(SessionMode::Work, true, 15, false);
        
        assert_eq!(reward.earned_currency.orundum, 60);  // 15 * 4
        assert_eq!(reward.earned_resources.lmd, 150);    // 15 * 10
        assert_eq!(reward.earned_resources.exp, 30);     // 15 * 2
    }

    #[test]
    fn test_challenge_completed_bonus() {
        let reward = calculate_session_rewards(SessionMode::Work, true, 25, true);
        
        // 基础奖励 + 挑战奖励
        assert_eq!(reward.earned_currency.orundum, 130); // 100 + 30
        assert_eq!(reward.earned_resources.lmd, 350);    // 250 + 100
        assert!(reward.message.contains("作战委托"));
    }

    #[test]
    fn test_break_session_no_rewards() {
        let reward = calculate_session_rewards(SessionMode::Break, true, 25, false);
        
        assert_eq!(reward.earned_currency.orundum, 0);
        assert_eq!(reward.earned_resources.lmd, 0);
        assert_eq!(reward.earned_resources.exp, 0);
    }

    #[test]
    fn test_incomplete_session_no_rewards() {
        let reward = calculate_session_rewards(SessionMode::Work, false, 25, false);
        
        assert_eq!(reward.earned_currency.orundum, 0);
        assert_eq!(reward.earned_resources.lmd, 0);
        assert_eq!(reward.earned_resources.exp, 0);
    }

    #[test]
    fn test_apply_rewards_to_database() {
        let conn = create_test_db();
        
        // 应用奖励（25分钟）
        let result = apply_session_rewards(&conn, SessionMode::Work, true, 25, false).unwrap();
        
        assert_eq!(result.earned_currency.orundum, 100);
        
        // 验证数据库已更新
        let currency = load_currency(&conn).unwrap();
        assert_eq!(currency.orundum, 100);
        
        let resources = load_resources(&conn).unwrap();
        assert_eq!(resources.lmd, 250);
        assert_eq!(resources.exp, 50);
    }

    #[test]
    fn test_multiple_sessions_accumulate() {
        let conn = create_test_db();
        
        // 完成多个会话
        apply_session_rewards(&conn, SessionMode::Work, true, 25, false).unwrap();
        apply_session_rewards(&conn, SessionMode::Work, true, 25, false).unwrap();
        apply_session_rewards(&conn, SessionMode::Work, true, 30, false).unwrap();
        
        // 验证累积奖励
        let currency = load_currency(&conn).unwrap();
        assert_eq!(currency.orundum, 320); // 100 + 100 + 120
        
        let resources = load_resources(&conn).unwrap();
        assert_eq!(resources.lmd, 800); // 250 + 250 + 300
        assert_eq!(resources.exp, 160);  // 50 + 50 + 60
    }

    #[test]
    fn test_long_session_rewards() {
        // 50分钟长番茄钟
        let reward = calculate_session_rewards(SessionMode::Work, true, 50, true);
        
        // 基础奖励 + 挑战奖励
        assert_eq!(reward.earned_currency.orundum, 230); // 200 + 30
        assert_eq!(reward.earned_resources.lmd, 600);    // 500 + 100
        assert_eq!(reward.earned_resources.exp, 100);
    }
}
