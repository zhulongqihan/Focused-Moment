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
 * * `is_boss` - 是否为Boss番茄钟
 * * `challenge_completed` - 是否完成挑战
 * 
 * # Returns
 * * `SessionRewardResult` - 奖励结果
 * 
 * # 奖励规则
 * - 只有完成的工作会话才有奖励（需求 8.1, 8.2, 8.6）
 * - 普通番茄钟：100 合成玉、300 龙门币、50 经验值（需求 8.4）
 * - Boss 番茄钟：200 合成玉、500 龙门币、100 经验值（需求 8.3）
 * - 挑战完成额外奖励：+50 合成玉、+200 龙门币（需求 8.5）
 */
pub fn calculate_session_rewards(
    mode: SessionMode,
    completed: bool,
    is_boss: bool,
    challenge_completed: bool,
) -> SessionRewardResult {
    let mut earned_currency = Currency::default();
    let mut earned_resources = Resources::default();
    let mut message = String::new();
    
    // 只有完成的工作会话才有奖励（需求 8.1, 8.2, 8.6）
    if mode != SessionMode::Work || !completed {
        return SessionRewardResult {
            earned_currency,
            earned_resources,
            message: "未完成工作会话，无奖励".to_string(),
        };
    }
    
    // 基础奖励
    if is_boss {
        // Boss 番茄钟奖励（需求 8.3）
        earned_currency.orundum = 200;
        earned_resources.lmd = 500;
        earned_resources.exp = 100;
        message.push_str("Boss番茄钟完成！获得：200合成玉、500龙门币、100经验值");
    } else {
        // 普通番茄钟奖励（需求 8.4）
        earned_currency.orundum = 100;
        earned_resources.lmd = 300;
        earned_resources.exp = 50;
        message.push_str("番茄钟完成！获得：100合成玉、300龙门币、50经验值");
    }
    
    // 挑战完成额外奖励（需求 8.5）
    if challenge_completed {
        earned_currency.orundum += 50;
        earned_resources.lmd += 200;
        message.push_str("，挑战完成额外奖励：+50合成玉、+200龙门币");
    }
    
    // 添加少量芯片作为奖励（用于精英化）
    let chip_type = if is_boss {
        "elite_chip_6"
    } else {
        "elite_chip_5"
    };
    earned_resources.chips.insert(chip_type.to_string(), 1);
    
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
 * * `is_boss` - 是否为Boss番茄钟
 * * `challenge_completed` - 是否完成挑战
 * 
 * # Returns
 * * `Result<SessionRewardResult, String>` - 奖励结果或错误信息
 */
pub fn apply_session_rewards(
    conn: &Connection,
    mode: SessionMode,
    completed: bool,
    is_boss: bool,
    challenge_completed: bool,
) -> Result<SessionRewardResult, String> {
    // 计算奖励
    let reward = calculate_session_rewards(mode, completed, is_boss, challenge_completed);
    
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
        let reward = calculate_session_rewards(SessionMode::Work, true, false, false);
        
        assert_eq!(reward.earned_currency.orundum, 100);
        assert_eq!(reward.earned_resources.lmd, 300);
        assert_eq!(reward.earned_resources.exp, 50);
        assert!(reward.message.contains("100合成玉"));
        assert!(reward.message.contains("300龙门币"));
    }

    #[test]
    fn test_boss_work_session_rewards() {
        let reward = calculate_session_rewards(SessionMode::Work, true, true, false);
        
        assert_eq!(reward.earned_currency.orundum, 200);
        assert_eq!(reward.earned_resources.lmd, 500);
        assert_eq!(reward.earned_resources.exp, 100);
        assert!(reward.message.contains("Boss"));
        assert!(reward.message.contains("200合成玉"));
    }

    #[test]
    fn test_challenge_completed_bonus() {
        let reward = calculate_session_rewards(SessionMode::Work, true, false, true);
        
        // 基础奖励 + 挑战奖励
        assert_eq!(reward.earned_currency.orundum, 150); // 100 + 50
        assert_eq!(reward.earned_resources.lmd, 500);    // 300 + 200
        assert!(reward.message.contains("挑战完成"));
    }

    #[test]
    fn test_break_session_no_rewards() {
        let reward = calculate_session_rewards(SessionMode::Break, true, false, false);
        
        assert_eq!(reward.earned_currency.orundum, 0);
        assert_eq!(reward.earned_resources.lmd, 0);
        assert_eq!(reward.earned_resources.exp, 0);
    }

    #[test]
    fn test_incomplete_session_no_rewards() {
        let reward = calculate_session_rewards(SessionMode::Work, false, false, false);
        
        assert_eq!(reward.earned_currency.orundum, 0);
        assert_eq!(reward.earned_resources.lmd, 0);
        assert_eq!(reward.earned_resources.exp, 0);
    }

    #[test]
    fn test_apply_rewards_to_database() {
        let conn = create_test_db();
        
        // 应用奖励
        let result = apply_session_rewards(&conn, SessionMode::Work, true, false, false).unwrap();
        
        assert_eq!(result.earned_currency.orundum, 100);
        
        // 验证数据库已更新
        let currency = load_currency(&conn).unwrap();
        assert_eq!(currency.orundum, 100);
        
        let resources = load_resources(&conn).unwrap();
        assert_eq!(resources.lmd, 300);
        assert_eq!(resources.exp, 50);
    }

    #[test]
    fn test_multiple_sessions_accumulate() {
        let conn = create_test_db();
        
        // 完成多个会话
        apply_session_rewards(&conn, SessionMode::Work, true, false, false).unwrap();
        apply_session_rewards(&conn, SessionMode::Work, true, false, false).unwrap();
        apply_session_rewards(&conn, SessionMode::Work, true, true, false).unwrap();
        
        // 验证累积奖励
        let currency = load_currency(&conn).unwrap();
        assert_eq!(currency.orundum, 400); // 100 + 100 + 200
        
        let resources = load_resources(&conn).unwrap();
        assert_eq!(resources.lmd, 1100); // 300 + 300 + 500
        assert_eq!(resources.exp, 200);  // 50 + 50 + 100
    }

    #[test]
    fn test_boss_and_challenge_combined() {
        let reward = calculate_session_rewards(SessionMode::Work, true, true, true);
        
        // Boss奖励 + 挑战奖励
        assert_eq!(reward.earned_currency.orundum, 250); // 200 + 50
        assert_eq!(reward.earned_resources.lmd, 700);    // 500 + 200
        assert_eq!(reward.earned_resources.exp, 100);
    }
}
