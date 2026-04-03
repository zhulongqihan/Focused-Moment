/**
 * 干员升级系统
 * 
 * 实现干员等级提升逻辑
 * 验证需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

use rusqlite::Connection;
use crate::gacha::models::{Operator, Resources, UpgradeResult};
use crate::gacha::database::save_operator;
use crate::resources::manager::spend_resources;

/**
 * 计算干员升级所需的龙门币
 * 
 * 根据干员当前等级和稀有度计算升级成本
 * 
 * # Arguments
 * * `level` - 当前等级
 * * `rarity` - 稀有度 (3-6)
 * 
 * # Returns
 * * `u32` - 所需龙门币数量
 */
fn calculate_level_up_lmd_cost(level: u8, rarity: u8) -> u32 {
    // 基础成本根据稀有度
    let base_cost = match rarity {
        3 => 50,
        4 => 100,
        5 => 200,
        6 => 300,
        _ => 100,
    };
    
    // 成本随等级增加
    base_cost * (level as u32 + 1)
}

/**
 * 计算干员升级所需的经验值
 * 
 * # Arguments
 * * `level` - 当前等级
 * * `rarity` - 稀有度 (3-6)
 * 
 * # Returns
 * * `u32` - 所需经验值数量
 */
fn calculate_level_up_exp_cost(level: u8, rarity: u8) -> u32 {
    // 基础经验根据稀有度
    let base_exp = match rarity {
        3 => 100,
        4 => 150,
        5 => 250,
        6 => 400,
        _ => 150,
    };
    
    // 经验需求随等级增加
    base_exp * (level as u32 + 1)
}

/**
 * 提升干员等级
 * 
 * 验证需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `operator_id` - 干员ID
 * 
 * # Returns
 * * `Result<UpgradeResult, String>` - 升级结果
 * 
 * # Errors
 * * 如果干员不存在，返回错误
 * * 如果等级已达到上限，返回错误（需求 6.3, 6.4, 6.5）
 * * 如果资源不足，返回错误（需求 6.2）
 */
pub fn upgrade_operator_level(
    conn: &Connection,
    operator_id: &str,
) -> Result<UpgradeResult, String> {
    // 加载干员数据
    let mut operator = load_operator_by_id(conn, operator_id)?;
    
    // 检查等级上限（需求 6.3, 6.4, 6.5）
    let max_level = operator.max_level();
    if operator.level >= max_level {
        let message = match operator.elite {
            0 => "已达到 Elite 0 等级上限 (50)，请先精英化到 Elite 1".to_string(),
            1 => "已达到 Elite 1 等级上限 (70)，请先精英化到 Elite 2".to_string(),
            2 => "已达到 Elite 2 最高等级 (90)".to_string(),
            _ => "已达到等级上限".to_string(),
        };
        
        return Ok(UpgradeResult {
            success: false,
            operator: Some(operator),
            cost_resources: None,
            message,
        });
    }
    
    // 计算升级所需资源（需求 6.7）
    let required_lmd = calculate_level_up_lmd_cost(operator.level, operator.rarity);
    let required_exp = calculate_level_up_exp_cost(operator.level, operator.rarity);
    
    let cost = Resources {
        lmd: required_lmd,
        exp: required_exp,
        chips: std::collections::HashMap::new(),
    };
    
    // 验证资源是否充足并扣除（需求 6.1, 6.2）
    match spend_resources(conn, &cost) {
        Ok(_) => {
            // 提升等级
            operator.level += 1;
            
            // 更新最后升级时间（需求 6.6）
            operator.last_upgraded_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            
            // 保存更新后的干员数据
            save_operator(conn, &operator)
                .map_err(|e| format!("Failed to save operator: {}", e))?;
            
            Ok(UpgradeResult {
                success: true,
                operator: Some(operator.clone()),
                cost_resources: Some(cost),
                message: format!("升级成功！{} 达到 Lv.{}", operator.name, operator.level),
            })
        }
        Err(e) => {
            // 资源不足（需求 6.2）
            Ok(UpgradeResult {
                success: false,
                operator: Some(operator),
                cost_resources: Some(cost),
                message: format!("资源不足：{}", e),
            })
        }
    }
}

/**
 * 从数据库加载指定ID的干员
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `operator_id` - 干员ID
 * 
 * # Returns
 * * `Result<Operator, String>` - 干员数据或错误信息
 */
fn load_operator_by_id(conn: &Connection, operator_id: &str) -> Result<Operator, String> {
    conn.query_row(
        "SELECT id, name, rarity, class, level, elite, experience, potential, obtained_at, last_upgraded_at
         FROM operators
         WHERE id = ?1",
        [operator_id],
        |row| {
            let class_str: String = row.get(3)?;
            let class = serde_json::from_str(&class_str)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    3,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                ))?;

            Ok(Operator {
                id: row.get(0)?,
                name: row.get(1)?,
                rarity: row.get(2)?,
                class,
                level: row.get(4)?,
                elite: row.get(5)?,
                experience: row.get(6)?,
                potential: row.get(7)?,
                obtained_at: row.get(8)?,
                last_upgraded_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Failed to load operator: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gacha::database::initialize_gacha_database;
    use crate::gacha::models::OperatorClass;
    use crate::resources::manager::add_resources;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_gacha_database(&conn).unwrap();
        conn
    }

    fn create_test_operator(conn: &Connection, id: &str, level: u8, elite: u8, rarity: u8) -> Operator {
        let operator = Operator {
            id: id.to_string(),
            name: "测试干员".to_string(),
            rarity,
            class: OperatorClass::Guard,
            level,
            elite,
            experience: 0,
            potential: 1,
            obtained_at: 0,
            last_upgraded_at: 0,
        };
        
        save_operator(conn, &operator).unwrap();
        operator
    }

    #[test]
    fn test_upgrade_operator_success() {
        let conn = create_test_db();
        
        // 创建测试干员
        let _operator = create_test_operator(&conn, "test_001", 1, 0, 6);
        
        // 添加足够的资源
        let resources = Resources {
            lmd: 10000,
            exp: 5000,
            chips: std::collections::HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 升级干员
        let result = upgrade_operator_level(&conn, "test_001").unwrap();
        
        assert!(result.success);
        assert_eq!(result.operator.as_ref().unwrap().level, 2);
        assert!(result.message.contains("升级成功"));
    }

    #[test]
    fn test_upgrade_operator_insufficient_resources() {
        let conn = create_test_db();
        
        // 创建测试干员
        create_test_operator(&conn, "test_002", 1, 0, 6);
        
        // 不添加资源，直接尝试升级
        let result = upgrade_operator_level(&conn, "test_002").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("资源不足"));
    }

    #[test]
    fn test_upgrade_operator_at_max_level_elite0() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 0 上限的干员
        let _operator = create_test_operator(&conn, "test_003", 50, 0, 6);
        
        // 添加资源
        let resources = Resources {
            lmd: 10000,
            exp: 5000,
            chips: std::collections::HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试升级
        let result = upgrade_operator_level(&conn, "test_003").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("Elite 0 等级上限"));
        assert!(result.message.contains("精英化"));
    }

    #[test]
    fn test_upgrade_operator_at_max_level_elite1() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 1 上限的干员
        create_test_operator(&conn, "test_004", 70, 1, 6);
        
        // 添加资源
        let resources = Resources {
            lmd: 10000,
            exp: 5000,
            chips: std::collections::HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试升级
        let result = upgrade_operator_level(&conn, "test_004").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("Elite 1 等级上限"));
    }

    #[test]
    fn test_upgrade_operator_at_max_level_elite2() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 2 最高等级的干员
        create_test_operator(&conn, "test_005", 90, 2, 6);
        
        // 添加资源
        let resources = Resources {
            lmd: 10000,
            exp: 5000,
            chips: std::collections::HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试升级
        let result = upgrade_operator_level(&conn, "test_005").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("Elite 2 最高等级"));
    }

    #[test]
    fn test_calculate_costs() {
        // 测试成本计算
        let lmd_cost = calculate_level_up_lmd_cost(1, 6);
        let exp_cost = calculate_level_up_exp_cost(1, 6);
        
        assert_eq!(lmd_cost, 600);  // 300 * (1 + 1)
        assert_eq!(exp_cost, 800);  // 400 * (1 + 1)
        
        // 测试更高等级的成本
        let lmd_cost_high = calculate_level_up_lmd_cost(49, 6);
        let exp_cost_high = calculate_level_up_exp_cost(49, 6);
        
        assert_eq!(lmd_cost_high, 15000);  // 300 * (49 + 1)
        assert_eq!(exp_cost_high, 20000);  // 400 * (49 + 1)
    }

    #[test]
    fn test_upgrade_updates_timestamp() {
        let conn = create_test_db();
        
        // 创建测试干员
        create_test_operator(&conn, "test_006", 1, 0, 6);
        
        // 添加资源
        let resources = Resources {
            lmd: 10000,
            exp: 5000,
            chips: std::collections::HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 记录升级前的时间戳
        let before_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        
        // 升级干员
        let result = upgrade_operator_level(&conn, "test_006").unwrap();
        
        assert!(result.success);
        let upgraded_operator = result.operator.unwrap();
        
        // 验证时间戳已更新（需求 6.6）
        assert!(upgraded_operator.last_upgraded_at >= before_timestamp);
    }
}
