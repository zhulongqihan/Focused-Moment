/**
 * 明日方舟抽卡系统 - 单抽逻辑
 */

use rusqlite::Connection;
use uuid::Uuid;

use super::models::*;
use super::probability::calculate_gacha_rarity;
use super::database::*;

/**
 * 执行单次抽卡
 * 
 * # 参数
 * - `conn`: 数据库连接
 * 
 * # 返回值
 * - `Ok(GachaResult)`: 抽卡成功，返回结果
 * - `Err(String)`: 抽卡失败，返回错误信息
 * 
 * # 验证需求
 * - 3.1: 验证合成玉余额（>= 600）
 * - 3.2: 合成玉不足时返回错误
 * - 3.3: 调用概率计算函数确定稀有度
 * - 3.4: 从干员池中随机选择干员
 * - 3.5: 将干员添加到用户收藏
 * - 3.6: 更新保底计数器
 * - 3.7: 保存抽卡历史记录
 */
pub fn perform_single_gacha(conn: &Connection) -> Result<GachaResult, String> {
    // 加载当前货币余额
    let mut currency = load_currency(conn)
        .map_err(|e| format!("加载货币余额失败: {}", e))?;
    
    // 验证合成玉余额（需求 3.1, 3.2）
    const SINGLE_PULL_COST: u32 = 600;
    if currency.orundum < SINGLE_PULL_COST {
        return Err(format!(
            "合成玉不足，需要 {} 合成玉，当前仅有 {} 合成玉",
            SINGLE_PULL_COST,
            currency.orundum
        ));
    }
    
    // 加载保底计数器
    let pity_counter = load_pity_counter(conn)
        .map_err(|e| format!("加载保底计数器失败: {}", e))?;
    
    let pity_counter_before = pity_counter;
    
    // 调用概率计算函数确定稀有度（需求 3.3）
    let rarity = calculate_gacha_rarity(pity_counter);
    
    // 从干员池中随机选择干员（需求 3.4）
    let operator = select_random_operator(rarity)?;
    
    // 更新保底计数器（需求 3.6）
    let pity_counter_after = if rarity == 6 {
        0  // 获得 6★ 时重置保底计数器
    } else {
        pity_counter + 1  // 未获得 6★ 时保底计数器加 1
    };
    
    // 扣除合成玉
    currency.orundum -= SINGLE_PULL_COST;
    
    // 保存干员到收藏（需求 3.5）
    save_operator(conn, &operator)
        .map_err(|e| format!("保存干员失败: {}", e))?;
    
    // 更新货币余额
    update_currency(conn, &currency)
        .map_err(|e| format!("更新货币余额失败: {}", e))?;
    
    // 更新保底计数器
    update_pity_counter(conn, pity_counter_after)
        .map_err(|e| format!("更新保底计数器失败: {}", e))?;
    
    // 保存抽卡历史记录（需求 3.7）
    let history = GachaHistory {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        gacha_type: GachaType::Single,
        operators: vec![operator.clone()],
        cost_currency: Currency::new(0, SINGLE_PULL_COST, 0),
        pity_counter_before,
        pity_counter_after,
    };
    
    save_gacha_history(conn, &history)
        .map_err(|e| format!("保存抽卡历史失败: {}", e))?;
    
    // 返回抽卡结果
    Ok(GachaResult {
        operators: vec![operator],
        pity_counter: pity_counter_after,
        cost_currency: Currency::new(0, SINGLE_PULL_COST, 0),
    })
}

/**
 * 从干员池中随机选择干员
 * 
 * # 参数
 * - `rarity`: 稀有度 (3-6)
 * 
 * # 返回值
 * - 随机选择的干员
 * 
 * # 注意
 * 当前实现使用简化的干员池，未来可以从配置文件或数据库加载
 */
fn select_random_operator(rarity: u8) -> Result<Operator, String> {
    use rand::seq::SliceRandom;
    use rand::thread_rng;
    
    let now = chrono::Utc::now().timestamp();
    
    // 简化的干员池（未来可以从配置文件或数据库加载）
    let operator_pool = get_operator_pool(rarity)?;
    
    let mut rng = thread_rng();
    let selected = operator_pool.choose(&mut rng)
        .ok_or_else(|| format!("干员池为空，无法选择稀有度 {} 的干员", rarity))?;
    
    // 创建新的干员实例
    Ok(Operator {
        id: Uuid::new_v4().to_string(),
        name: selected.0.to_string(),
        rarity,
        class: selected.1.clone(),
        level: 1,
        elite: 0,
        experience: 0,
        potential: 1,
        obtained_at: now,
        last_upgraded_at: now,
    })
}

/**
 * 获取指定稀有度的干员池
 * 
 * # 参数
 * - `rarity`: 稀有度 (3-6)
 * 
 * # 返回值
 * - 干员池：(名称, 职业) 的数组
 */
fn get_operator_pool(rarity: u8) -> Result<Vec<(&'static str, OperatorClass)>, String> {
    let pool = match rarity {
        6 => vec![
            ("银灰", OperatorClass::Guard),
            ("艾雅法拉", OperatorClass::Caster),
            ("能天使", OperatorClass::Sniper),
            ("闪灵", OperatorClass::Medic),
            ("塞雷娅", OperatorClass::Defender),
            ("推进之王", OperatorClass::Vanguard),
            ("陈", OperatorClass::Guard),
            ("伊芙利特", OperatorClass::Caster),
            ("麦哲伦", OperatorClass::Supporter),
            ("莫斯提马", OperatorClass::Supporter),
        ],
        5 => vec![
            ("德克萨斯", OperatorClass::Vanguard),
            ("幽灵鲨", OperatorClass::Guard),
            ("蓝毒", OperatorClass::Sniper),
            ("白面鸮", OperatorClass::Medic),
            ("赫默", OperatorClass::Medic),
            ("临光", OperatorClass::Defender),
            ("雷蛇", OperatorClass::Guard),
            ("天火", OperatorClass::Caster),
            ("初雪", OperatorClass::Sniper),
            ("红", OperatorClass::Specialist),
        ],
        4 => vec![
            ("夜刀", OperatorClass::Guard),
            ("杰西卡", OperatorClass::Sniper),
            ("调香师", OperatorClass::Supporter),
            ("末药", OperatorClass::Medic),
            ("古米", OperatorClass::Guard),
            ("白雪", OperatorClass::Sniper),
            ("远山", OperatorClass::Sniper),
            ("梅", OperatorClass::Specialist),
            ("砾", OperatorClass::Specialist),
            ("安塞尔", OperatorClass::Medic),
        ],
        3 => vec![
            ("芬", OperatorClass::Vanguard),
            ("香草", OperatorClass::Vanguard),
            ("翎羽", OperatorClass::Vanguard),
            ("玫兰莎", OperatorClass::Guard),
            ("卡缇", OperatorClass::Guard),
            ("米格鲁", OperatorClass::Sniper),
            ("克洛丝", OperatorClass::Sniper),
            ("安德切尔", OperatorClass::Sniper),
            ("史都华德", OperatorClass::Medic),
            ("阿消", OperatorClass::Medic),
        ],
        _ => return Err(format!("无效的稀有度: {}", rarity)),
    };

    if pool.is_empty() {
        return Err(format!("稀有度 {} 的干员池为空", rarity));
    }

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_gacha_database(&conn).unwrap();
        conn
    }

    #[test]
    fn test_single_gacha_insufficient_currency() {
        let conn = create_test_db();
        
        // 设置合成玉不足
        let currency = Currency::new(0, 500, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 尝试抽卡
        let result = perform_single_gacha(&conn);
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("合成玉不足"));
    }

    #[test]
    fn test_single_gacha_success() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 1000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行抽卡
        let result = perform_single_gacha(&conn);
        
        assert!(result.is_ok());
        let gacha_result = result.unwrap();
        
        // 验证返回结果
        assert_eq!(gacha_result.operators.len(), 1);
        assert!(gacha_result.operators[0].rarity >= 3);
        assert!(gacha_result.operators[0].rarity <= 6);
        
        // 验证货币扣除
        let updated_currency = load_currency(&conn).unwrap();
        assert_eq!(updated_currency.orundum, 400);  // 1000 - 600 = 400
    }

    #[test]
    fn test_pity_counter_update() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 10000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 设置保底计数器
        update_pity_counter(&conn, 50).unwrap();
        
        // 执行抽卡
        let result = perform_single_gacha(&conn).unwrap();
        
        // 验证保底计数器更新
        if result.operators[0].rarity == 6 {
            assert_eq!(result.pity_counter, 0);
        } else {
            assert_eq!(result.pity_counter, 51);
        }
    }

    #[test]
    fn test_operator_saved_to_database() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 1000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行抽卡
        let result = perform_single_gacha(&conn).unwrap();
        
        // 验证干员已保存到数据库
        let operators = load_operators(&conn).unwrap();
        assert_eq!(operators.len(), 1);
        assert_eq!(operators[0].id, result.operators[0].id);
    }

    #[test]
    fn test_gacha_history_saved() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 1000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行抽卡
        perform_single_gacha(&conn).unwrap();
        
        // 验证抽卡历史已保存
        let history = load_gacha_history(&conn, 10).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].gacha_type, GachaType::Single);
        assert_eq!(history[0].operators.len(), 1);
    }
}
