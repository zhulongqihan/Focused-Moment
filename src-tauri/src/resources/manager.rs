/**
 * 资源管理器
 * 
 * 实现资源的查询、增加和消耗功能
 * 验证需求: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

use rusqlite::Connection;
use crate::gacha::models::Resources;
use crate::gacha::database::{load_resources, update_resources};

/**
 * 查询资源余额
 * 
 * 验证需求: 9.7
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * 
 * # Returns
 * * `Result<Resources, String>` - 当前资源余额或错误信息
 */
pub fn get_resources(conn: &Connection) -> Result<Resources, String> {
    load_resources(conn)
        .map_err(|e| format!("Failed to load resources: {}", e))
}

/**
 * 增加资源
 * 
 * 验证需求: 9.3, 9.4
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `amount` - 要增加的资源数量
 * 
 * # Returns
 * * `Result<Resources, String>` - 更新后的资源余额或错误信息
 */
pub fn add_resources(conn: &Connection, amount: &Resources) -> Result<Resources, String> {
    // 加载当前资源
    let mut current = load_resources(conn)
        .map_err(|e| format!("Failed to load current resources: {}", e))?;
    
    // 增加资源
    current.add(amount);
    
    // 保存更新后的资源
    update_resources(conn, &current)
        .map_err(|e| format!("Failed to update resources: {}", e))?;
    
    Ok(current)
}

/**
 * 扣除资源并验证余额
 * 
 * 验证需求: 9.4, 9.5, 9.6
 * 
 * # Arguments
 * * `conn` - 数据库连接
 * * `cost` - 要扣除的资源数量
 * 
 * # Returns
 * * `Result<Resources, String>` - 更新后的资源余额或错误信息
 * 
 * # Errors
 * * 如果资源不足，返回错误信息
 * * 确保资源数量始终 >= 0
 */
pub fn spend_resources(conn: &Connection, cost: &Resources) -> Result<Resources, String> {
    // 加载当前资源
    let mut current = load_resources(conn)
        .map_err(|e| format!("Failed to load current resources: {}", e))?;
    
    // 验证资源是否充足（需求 9.5）
    if !current.has_enough(cost) {
        return Err(format!(
            "Insufficient resources. Required: LMD={}, EXP={}, Chips={:?}. Available: LMD={}, EXP={}, Chips={:?}",
            cost.lmd, cost.exp, cost.chips,
            current.lmd, current.exp, current.chips
        ));
    }
    
    // 扣除资源（需求 9.6 - 确保资源数量始终 >= 0）
    current.subtract(cost)
        .map_err(|e| format!("Failed to subtract resources: {}", e))?;
    
    // 保存更新后的资源
    update_resources(conn, &current)
        .map_err(|e| format!("Failed to update resources: {}", e))?;
    
    Ok(current)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gacha::database::initialize_gacha_database;
    use std::collections::HashMap;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_gacha_database(&conn).unwrap();
        conn
    }

    #[test]
    fn test_get_resources() {
        let conn = create_test_db();
        
        // 初始资源应该为 0
        let resources = get_resources(&conn).unwrap();
        assert_eq!(resources.lmd, 0);
        assert_eq!(resources.exp, 0);
        assert!(resources.chips.is_empty());
    }

    #[test]
    fn test_add_resources() {
        let conn = create_test_db();
        
        // 添加资源
        let amount = Resources {
            lmd: 1000,
            exp: 500,
            chips: HashMap::new(),
        };
        
        let updated = add_resources(&conn, &amount).unwrap();
        assert_eq!(updated.lmd, 1000);
        assert_eq!(updated.exp, 500);
        
        // 再次添加
        let updated = add_resources(&conn, &amount).unwrap();
        assert_eq!(updated.lmd, 2000);
        assert_eq!(updated.exp, 1000);
    }

    #[test]
    fn test_spend_resources_success() {
        let conn = create_test_db();
        
        // 先添加资源
        let amount = Resources {
            lmd: 1000,
            exp: 500,
            chips: HashMap::new(),
        };
        add_resources(&conn, &amount).unwrap();
        
        // 扣除部分资源
        let cost = Resources {
            lmd: 300,
            exp: 100,
            chips: HashMap::new(),
        };
        
        let updated = spend_resources(&conn, &cost).unwrap();
        assert_eq!(updated.lmd, 700);
        assert_eq!(updated.exp, 400);
    }

    #[test]
    fn test_spend_resources_insufficient() {
        let conn = create_test_db();
        
        // 尝试扣除资源但余额不足
        let cost = Resources {
            lmd: 1000,
            exp: 500,
            chips: HashMap::new(),
        };
        
        let result = spend_resources(&conn, &cost);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient resources"));
    }

    #[test]
    fn test_resources_non_negative() {
        let conn = create_test_db();
        
        // 添加资源
        let amount = Resources {
            lmd: 500,
            exp: 200,
            chips: HashMap::new(),
        };
        add_resources(&conn, &amount).unwrap();
        
        // 尝试扣除超过余额的资源
        let cost = Resources {
            lmd: 600,
            exp: 100,
            chips: HashMap::new(),
        };
        
        let result = spend_resources(&conn, &cost);
        assert!(result.is_err());
        
        // 验证资源没有变成负数
        let current = get_resources(&conn).unwrap();
        assert_eq!(current.lmd, 500);
        assert_eq!(current.exp, 200);
    }

    #[test]
    fn test_add_resources_with_chips() {
        let conn = create_test_db();
        
        // 添加包含芯片的资源
        let mut chips = HashMap::new();
        chips.insert("guard_chip".to_string(), 5);
        chips.insert("sniper_chip".to_string(), 3);
        
        let amount = Resources {
            lmd: 1000,
            exp: 500,
            chips: chips.clone(),
        };
        
        let updated = add_resources(&conn, &amount).unwrap();
        assert_eq!(updated.lmd, 1000);
        assert_eq!(updated.exp, 500);
        assert_eq!(updated.chips.get("guard_chip"), Some(&5));
        assert_eq!(updated.chips.get("sniper_chip"), Some(&3));
        
        // 再次添加相同类型的芯片
        let updated = add_resources(&conn, &amount).unwrap();
        assert_eq!(updated.chips.get("guard_chip"), Some(&10));
        assert_eq!(updated.chips.get("sniper_chip"), Some(&6));
    }

    #[test]
    fn test_spend_resources_with_chips() {
        let conn = create_test_db();
        
        // 先添加资源
        let mut chips = HashMap::new();
        chips.insert("guard_chip".to_string(), 10);
        
        let amount = Resources {
            lmd: 1000,
            exp: 500,
            chips: chips.clone(),
        };
        add_resources(&conn, &amount).unwrap();
        
        // 扣除部分芯片
        let mut cost_chips = HashMap::new();
        cost_chips.insert("guard_chip".to_string(), 3);
        
        let cost = Resources {
            lmd: 200,
            exp: 100,
            chips: cost_chips,
        };
        
        let updated = spend_resources(&conn, &cost).unwrap();
        assert_eq!(updated.lmd, 800);
        assert_eq!(updated.exp, 400);
        assert_eq!(updated.chips.get("guard_chip"), Some(&7));
    }

    #[test]
    fn test_spend_resources_insufficient_chips() {
        let conn = create_test_db();
        
        // 添加资源但芯片数量不足
        let mut chips = HashMap::new();
        chips.insert("guard_chip".to_string(), 2);
        
        let amount = Resources {
            lmd: 1000,
            exp: 500,
            chips,
        };
        add_resources(&conn, &amount).unwrap();
        
        // 尝试扣除更多芯片
        let mut cost_chips = HashMap::new();
        cost_chips.insert("guard_chip".to_string(), 5);
        
        let cost = Resources {
            lmd: 100,
            exp: 50,
            chips: cost_chips,
        };
        
        let result = spend_resources(&conn, &cost);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient resources"));
    }
}
