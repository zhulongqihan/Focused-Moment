/**
 * 明日方舟抽卡养成系统 - 数据库架构和迁移
 */

use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json;
use std::collections::HashMap;

use super::models::*;

/**
 * 初始化抽卡系统数据库表
 */
pub fn initialize_gacha_database(conn: &Connection) -> SqliteResult<()> {
    // 创建干员表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS operators (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rarity INTEGER NOT NULL CHECK(rarity >= 3 AND rarity <= 6),
            class TEXT NOT NULL,
            level INTEGER NOT NULL CHECK(level >= 1 AND level <= 90),
            elite INTEGER NOT NULL CHECK(elite >= 0 AND elite <= 2),
            experience INTEGER NOT NULL DEFAULT 0,
            potential INTEGER NOT NULL CHECK(potential >= 1 AND potential <= 6),
            obtained_at INTEGER NOT NULL,
            last_upgraded_at INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建抽卡历史表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS gacha_history (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            gacha_type TEXT NOT NULL CHECK(gacha_type IN ('single', 'ten')),
            operators TEXT NOT NULL,
            cost_currency TEXT NOT NULL,
            pity_counter_before INTEGER NOT NULL,
            pity_counter_after INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建货币表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS currency (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            originite INTEGER NOT NULL DEFAULT 0,
            orundum INTEGER NOT NULL DEFAULT 0,
            lmd INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建资源表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            lmd INTEGER NOT NULL DEFAULT 0,
            exp INTEGER NOT NULL DEFAULT 0,
            chips TEXT NOT NULL DEFAULT '{}',
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建抽卡系统状态表（保底计数器等）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS gacha_state (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            pity_counter INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建索引以提高查询性能
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_operators_rarity ON operators(rarity)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_operators_class ON operators(class)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_operators_level ON operators(level)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_gacha_history_timestamp ON gacha_history(timestamp DESC)",
        [],
    )?;

    // 初始化默认数据
    initialize_default_data(conn)?;

    Ok(())
}

/**
 * 初始化默认数据
 */
fn initialize_default_data(conn: &Connection) -> SqliteResult<()> {
    // 检查货币表是否已有数据
    let currency_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM currency WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    if !currency_exists {
        conn.execute(
            "INSERT INTO currency (id, originite, orundum, lmd, updated_at)
             VALUES (1, 0, 0, 0, unixepoch())",
            [],
        )?;
    }

    // 检查资源表是否已有数据
    let resources_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM resources WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    if !resources_exists {
        conn.execute(
            "INSERT INTO resources (id, lmd, exp, chips, updated_at)
             VALUES (1, 0, 0, '{}', unixepoch())",
            [],
        )?;
    }

    // 检查抽卡状态表是否已有数据
    let gacha_state_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM gacha_state WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    if !gacha_state_exists {
        conn.execute(
            "INSERT INTO gacha_state (id, pity_counter, updated_at)
             VALUES (1, 0, unixepoch())",
            [],
        )?;
    }

    Ok(())
}

/**
 * 保存干员到数据库
 */
pub fn save_operator(conn: &Connection, operator: &Operator) -> SqliteResult<()> {
    operator.validate().map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            e,
        )))
    })?;

    let class_json = serde_json::to_string(&operator.class)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute(
        "INSERT INTO operators (id, name, rarity, class, level, elite, experience, potential, obtained_at, last_upgraded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           rarity = excluded.rarity,
           class = excluded.class,
           level = excluded.level,
           elite = excluded.elite,
           experience = excluded.experience,
           potential = excluded.potential,
           last_upgraded_at = excluded.last_upgraded_at",
        params![
            operator.id,
            operator.name,
            operator.rarity,
            class_json,
            operator.level,
            operator.elite,
            operator.experience,
            operator.potential,
            operator.obtained_at,
            operator.last_upgraded_at,
        ],
    )?;

    Ok(())
}

/**
 * 从数据库加载所有干员
 */
pub fn load_operators(conn: &Connection) -> SqliteResult<Vec<Operator>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, rarity, class, level, elite, experience, potential, obtained_at, last_upgraded_at
         FROM operators
         ORDER BY rarity DESC, level DESC",
    )?;

    let operators = stmt.query_map([], |row| {
        let class_str: String = row.get(3)?;
        let class: OperatorClass = serde_json::from_str(&class_str)
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
    })?;

    operators.collect()
}

/**
 * 保存抽卡历史
 */
pub fn save_gacha_history(conn: &Connection, history: &GachaHistory) -> SqliteResult<()> {
    let operators_json = serde_json::to_string(&history.operators)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    
    let cost_currency_json = serde_json::to_string(&history.cost_currency)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    
    let gacha_type_str = match history.gacha_type {
        GachaType::Single => "single",
        GachaType::Ten => "ten",
    };

    conn.execute(
        "INSERT INTO gacha_history (id, timestamp, gacha_type, operators, cost_currency, pity_counter_before, pity_counter_after)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            history.id,
            history.timestamp,
            gacha_type_str,
            operators_json,
            cost_currency_json,
            history.pity_counter_before,
            history.pity_counter_after,
        ],
    )?;

    Ok(())
}

/**
 * 加载抽卡历史
 */
pub fn load_gacha_history(conn: &Connection, limit: usize) -> SqliteResult<Vec<GachaHistory>> {
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, gacha_type, operators, cost_currency, pity_counter_before, pity_counter_after
         FROM gacha_history
         ORDER BY timestamp DESC
         LIMIT ?1",
    )?;

    let histories = stmt.query_map(params![limit], |row| {
        let gacha_type_str: String = row.get(2)?;
        let gacha_type = match gacha_type_str.as_str() {
            "single" => GachaType::Single,
            "ten" => GachaType::Ten,
            _ => GachaType::Single,
        };

        let operators_json: String = row.get(3)?;
        let operators: Vec<Operator> = serde_json::from_str(&operators_json)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                3,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;

        let cost_currency_json: String = row.get(4)?;
        let cost_currency: Currency = serde_json::from_str(&cost_currency_json)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                4,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;

        Ok(GachaHistory {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            gacha_type,
            operators,
            cost_currency,
            pity_counter_before: row.get(5)?,
            pity_counter_after: row.get(6)?,
        })
    })?;

    histories.collect()
}

/**
 * 更新货币
 */
pub fn update_currency(conn: &Connection, currency: &Currency) -> SqliteResult<()> {
    conn.execute(
        "UPDATE currency SET originite = ?1, orundum = ?2, lmd = ?3, updated_at = unixepoch()
         WHERE id = 1",
        params![currency.originite, currency.orundum, currency.lmd],
    )?;

    Ok(())
}

/**
 * 加载货币
 */
pub fn load_currency(conn: &Connection) -> SqliteResult<Currency> {
    conn.query_row(
        "SELECT originite, orundum, lmd FROM currency WHERE id = 1",
        [],
        |row| {
            Ok(Currency {
                originite: row.get(0)?,
                orundum: row.get(1)?,
                lmd: row.get(2)?,
            })
        },
    )
}

/**
 * 更新资源
 */
pub fn update_resources(conn: &Connection, resources: &Resources) -> SqliteResult<()> {
    let chips_json = serde_json::to_string(&resources.chips)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute(
        "UPDATE resources SET lmd = ?1, exp = ?2, chips = ?3, updated_at = unixepoch()
         WHERE id = 1",
        params![resources.lmd, resources.exp, chips_json],
    )?;

    Ok(())
}

/**
 * 加载资源
 */
pub fn load_resources(conn: &Connection) -> SqliteResult<Resources> {
    conn.query_row(
        "SELECT lmd, exp, chips FROM resources WHERE id = 1",
        [],
        |row| {
            let chips_json: String = row.get(2)?;
            let chips: HashMap<String, u32> = serde_json::from_str(&chips_json)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    2,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                ))?;

            Ok(Resources {
                lmd: row.get(0)?,
                exp: row.get(1)?,
                chips,
            })
        },
    )
}

/**
 * 更新保底计数器
 */
pub fn update_pity_counter(conn: &Connection, pity_counter: u32) -> SqliteResult<()> {
    conn.execute(
        "UPDATE gacha_state SET pity_counter = ?1, updated_at = unixepoch()
         WHERE id = 1",
        params![pity_counter],
    )?;

    Ok(())
}

/**
 * 加载保底计数器
 */
pub fn load_pity_counter(conn: &Connection) -> SqliteResult<u32> {
    conn.query_row(
        "SELECT pity_counter FROM gacha_state WHERE id = 1",
        [],
        |row| row.get(0),
    )
}

/**
 * 加载完整的抽卡系统状态
 */
pub fn load_gacha_system_state(conn: &Connection) -> SqliteResult<GachaSystemState> {
    let pity_counter = load_pity_counter(conn)?;
    let currency = load_currency(conn)?;
    let resources = load_resources(conn)?;
    let operators = load_operators(conn)?;
    let gacha_history = load_gacha_history(conn, 100)?;

    Ok(GachaSystemState {
        pity_counter,
        currency,
        resources,
        operators,
        gacha_history,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_gacha_database(&conn).unwrap();
        conn
    }

    #[test]
    fn test_database_initialization() {
        let conn = create_test_db();
        
        // 验证表是否创建
        let table_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('operators', 'gacha_history', 'currency', 'resources', 'gacha_state')",
            [],
            |row| row.get(0),
        ).unwrap();
        
        assert_eq!(table_count, 5);
    }

    #[test]
    fn test_save_and_load_operator() {
        let conn = create_test_db();
        
        let operator = Operator {
            id: "test_001".to_string(),
            name: "测试干员".to_string(),
            rarity: 6,
            class: OperatorClass::Guard,
            level: 1,
            elite: 0,
            experience: 0,
            potential: 1,
            obtained_at: 1234567890,
            last_upgraded_at: 1234567890,
        };
        
        save_operator(&conn, &operator).unwrap();
        let operators = load_operators(&conn).unwrap();
        
        assert_eq!(operators.len(), 1);
        assert_eq!(operators[0].id, "test_001");
        assert_eq!(operators[0].name, "测试干员");
    }

    #[test]
    fn test_currency_operations() {
        let conn = create_test_db();
        
        let currency = Currency::new(100, 1000, 5000);
        update_currency(&conn, &currency).unwrap();
        
        let loaded = load_currency(&conn).unwrap();
        assert_eq!(loaded.originite, 100);
        assert_eq!(loaded.orundum, 1000);
        assert_eq!(loaded.lmd, 5000);
    }

    #[test]
    fn test_pity_counter() {
        let conn = create_test_db();
        
        update_pity_counter(&conn, 50).unwrap();
        let counter = load_pity_counter(&conn).unwrap();
        assert_eq!(counter, 50);
    }
}
