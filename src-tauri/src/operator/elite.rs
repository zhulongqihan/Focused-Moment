/**
 * 干员精英化系统
 * 
 * 实现干员精英化逻辑
 * 验证需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

use rusqlite::Connection;
use crate::gacha::models::{Operator, Resources, UpgradeResult};
use crate::gacha::database::save_operator;
use crate::resources::manager::spend_resources;
use std::collections::HashMap;

/**
 * 计算精英化所需资源
 * 
 * 根据干员稀有度和目标精英化等级计算所需资源
 * 
 * # Arguments
 * * `rarity` - 稀有度 (3-6)
 * * `target_elite` - 目标精英化等级 (1 或 2)
 * 
 * # Returns
 * * `Resources` - 所需资源
 */
fn calculate_elite_cost(rarity: u8, target_elite: u8) -> Resources {
    let (lmd, exp, chip_count) = match (rarity, target_elite) {
        // Elite 0 -> Elite 1
        (3, 1) => (10000, 5000, 2),
        (4, 1) => (15000, 8000, 3),
        (5, 1) => (30000, 15000, 4),
        (6, 1) => (50000, 25000, 5),
        
        // Elite 1 -> Elite 2
        (3, 2) => (20000, 10000, 3),
        (4, 2) => (30000, 15000, 4),
        (5, 2) => (60000, 30000, 6),
        (6, 2) => (100000, 50000, 8),
        
        _ => (10000, 5000, 2),
    };
    
    // 根据稀有度确定芯片类型
    let chip_type = format!("elite_chip_{}", rarity);
    let mut chips = HashMap::new();
    chips.insert(chip_type, chip_count);
    
    Resources {
        lmd,
        exp,
        chips,
    }
}

/**
 * 精英化干员
 * 
 * 验证需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `operator_id` - 干员ID
 * 
 * # Returns
 * * `Result<UpgradeResult, String>` - 精英化结果
 * 
 * # Errors
 * * 如果干员不存在，返回错误
 * * 如果等级未达到上限，返回错误（需求 7.2）
 * * 如果资源不足，返回错误（需求 7.3）
 * * 如果已达到 Elite 2，返回错误（需求 7.6）
 */
pub fn elite_operator(
    conn: &Connection,
    operator_id: &str,
) -> Result<UpgradeResult, String> {
    // 加载干员数据
    let mut operator = load_operator_by_id(conn, operator_id)?;
    
    // 检查是否已达到 Elite 2（需求 7.6）
    if operator.elite >= 2 {
        return Ok(UpgradeResult {
            success: false,
            operator: Some(operator),
            cost_resources: None,
            message: "干员已达到 Elite 2，无法继续精英化".to_string(),
        });
    }
    
    // 检查等级是否达到上限（需求 7.2）
    let max_level = operator.max_level();
    if operator.level < max_level {
        let current_level = operator.level;
        return Ok(UpgradeResult {
            success: false,
            operator: Some(operator),
            cost_resources: None,
            message: format!(
                "等级未达到上限。当前等级: {}, 需要达到: {}",
                current_level, max_level
            ),
        });
    }
    
    // 计算目标精英化等级
    let target_elite = operator.elite + 1;
    
    // 计算精英化所需资源（需求 7.7）
    let cost = calculate_elite_cost(operator.rarity, target_elite);
    
    // 验证资源是否充足并扣除（需求 7.1, 7.3）
    match spend_resources(conn, &cost) {
        Ok(_) => {
            // 提升精英化等级
            operator.elite = target_elite;
            
            // 重置等级为 1（需求 7.4, 7.5）
            operator.level = 1;
            
            // 更新最后升级时间
            operator.last_upgraded_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            
            // 保存更新后的干员数据
            save_operator(conn, &operator)
                .map_err(|e| format!("Failed to save operator: {}", e))?;
            
            let new_max_level = operator.max_level();
            Ok(UpgradeResult {
                success: true,
                operator: Some(operator.clone()),
                cost_resources: Some(cost),
                message: format!(
                    "精英化成功！{} 达到 Elite {}，等级重置为 1，新等级上限: {}",
                    operator.name, operator.elite, new_max_level
                ),
            })
        }
        Err(e) => {
            // 资源不足（需求 7.3）
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
    fn test_elite_operator_success_elite0_to_elite1() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 0 上限的干员
        create_test_operator(&conn, "test_001", 50, 0, 6);
        
        // 添加足够的资源
        let mut chips = HashMap::new();
        chips.insert("elite_chip_6".to_string(), 10);
        
        let resources = Resources {
            lmd: 100000,
            exp: 50000,
            chips,
        };
        add_resources(&conn, &resources).unwrap();
        
        // 精英化干员
        let result = elite_operator(&conn, "test_001").unwrap();
        
        assert!(result.success);
        let operator = result.operator.unwrap();
        assert_eq!(operator.elite, 1);
        assert_eq!(operator.level, 1);  // 等级重置为 1
        assert!(result.message.contains("精英化成功"));
        assert!(result.message.contains("Elite 1"));
    }

    #[test]
    fn test_elite_operator_success_elite1_to_elite2() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 1 上限的干员
        create_test_operator(&conn, "test_002", 70, 1, 6);
        
        // 添加足够的资源
        let mut chips = HashMap::new();
        chips.insert("elite_chip_6".to_string(), 10);
        
        let resources = Resources {
            lmd: 150000,
            exp: 80000,
            chips,
        };
        add_resources(&conn, &resources).unwrap();
        
        // 精英化干员
        let result = elite_operator(&conn, "test_002").unwrap();
        
        assert!(result.success);
        let operator = result.operator.unwrap();
        assert_eq!(operator.elite, 2);
        assert_eq!(operator.level, 1);  // 等级重置为 1
        assert!(result.message.contains("Elite 2"));
    }

    #[test]
    fn test_elite_operator_level_not_max() {
        let conn = create_test_db();
        
        // 创建等级未达到上限的干员
        create_test_operator(&conn, "test_003", 30, 0, 6);
        
        // 添加资源
        let mut chips = HashMap::new();
        chips.insert("elite_chip_6".to_string(), 10);
        
        let resources = Resources {
            lmd: 100000,
            exp: 50000,
            chips,
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试精英化
        let result = elite_operator(&conn, "test_003").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("等级未达到上限"));
        assert!(result.message.contains("30"));
        assert!(result.message.contains("50"));
    }

    #[test]
    fn test_elite_operator_insufficient_resources() {
        let conn = create_test_db();
        
        // 创建已达到上限的干员
        create_test_operator(&conn, "test_004", 50, 0, 6);
        
        // 不添加足够的资源
        let resources = Resources {
            lmd: 1000,
            exp: 500,
            chips: HashMap::new(),
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试精英化
        let result = elite_operator(&conn, "test_004").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("资源不足"));
    }

    #[test]
    fn test_elite_operator_already_elite2() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 2 的干员
        create_test_operator(&conn, "test_005", 90, 2, 6);
        
        // 添加资源
        let mut chips = HashMap::new();
        chips.insert("elite_chip_6".to_string(), 10);
        
        let resources = Resources {
            lmd: 100000,
            exp: 50000,
            chips,
        };
        add_resources(&conn, &resources).unwrap();
        
        // 尝试精英化
        let result = elite_operator(&conn, "test_005").unwrap();
        
        assert!(!result.success);
        assert!(result.message.contains("已达到 Elite 2"));
    }

    #[test]
    fn test_calculate_elite_cost() {
        // 测试 Elite 0 -> Elite 1 的成本
        let cost_6star_e1 = calculate_elite_cost(6, 1);
        assert_eq!(cost_6star_e1.lmd, 50000);
        assert_eq!(cost_6star_e1.exp, 25000);
        assert_eq!(cost_6star_e1.chips.get("elite_chip_6"), Some(&5));
        
        // 测试 Elite 1 -> Elite 2 的成本
        let cost_6star_e2 = calculate_elite_cost(6, 2);
        assert_eq!(cost_6star_e2.lmd, 100000);
        assert_eq!(cost_6star_e2.exp, 50000);
        assert_eq!(cost_6star_e2.chips.get("elite_chip_6"), Some(&8));
        
        // 测试不同稀有度
        let cost_3star_e1 = calculate_elite_cost(3, 1);
        assert_eq!(cost_3star_e1.lmd, 10000);
        assert_eq!(cost_3star_e1.exp, 5000);
    }

    #[test]
    fn test_elite_resets_level() {
        let conn = create_test_db();
        
        // 创建已达到 Elite 0 上限的干员
        create_test_operator(&conn, "test_006", 50, 0, 6);
        
        // 添加资源
        let mut chips = HashMap::new();
        chips.insert("elite_chip_6".to_string(), 10);
        
        let resources = Resources {
            lmd: 100000,
            exp: 50000,
            chips,
        };
        add_resources(&conn, &resources).unwrap();
        
        // 精英化干员
        let result = elite_operator(&conn, "test_006").unwrap();
        
        assert!(result.success);
        let operator = result.operator.unwrap();
        
        // 验证等级重置为 1（需求 7.4, 7.5）
        assert_eq!(operator.level, 1);
        assert_eq!(operator.elite, 1);
        
        // 验证新的等级上限
        assert_eq!(operator.max_level(), 70);
    }
}
