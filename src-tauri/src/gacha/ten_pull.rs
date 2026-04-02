/**
 * 明日方舟抽卡系统 - 十连抽逻辑
 */

use rusqlite::Connection;
use uuid::Uuid;

use super::models::*;
use super::probability::calculate_gacha_rarity;
use super::database::*;

/**
 * 执行十连抽
 * 
 * # 参数
 * - `conn`: 数据库连接
 * 
 * # 返回值
 * - `Ok(GachaResult)`: 抽卡成功，返回结果
 * - `Err(String)`: 抽卡失败，返回错误信息
 * 
 * # 验证需求
 * - 4.1: 验证合成玉余额（>= 6000）
 * - 4.2: 合成玉不足时返回错误
 * - 4.3: 执行 10 次抽卡计算
 * - 4.4: 实现十连保底：至少一个 5★ 或 6★
 * - 4.5: 返回包含 10 个干员的结果列表
 * - 4.6: 批量更新保底计数器
 */
pub fn perform_ten_gacha(conn: &Connection) -> Result<GachaResult, String> {
    // 加载当前货币余额
    let mut currency = load_currency(conn)
        .map_err(|e| format!("加载货币余额失败: {}", e))?;
    
    // 验证合成玉余额（需求 4.1, 4.2）
    const TEN_PULL_COST: u32 = 6000;
    if currency.orundum < TEN_PULL_COST {
        return Err(format!(
            "合成玉不足，需要 {} 合成玉，当前仅有 {} 合成玉",
            TEN_PULL_COST,
            currency.orundum
        ));
    }
    
    // 加载保底计数器
    let mut pity_counter = load_pity_counter(conn)
        .map_err(|e| format!("加载保底计数器失败: {}", e))?;
    
    let pity_counter_before = pity_counter;
    let mut operators = Vec::new();
    let mut has_five_star_or_above = false;
    
    // 执行 10 次抽卡计算（需求 4.3）
    for _ in 0..10 {
        // 调用概率计算函数确定稀有度
        let rarity = calculate_gacha_rarity(pity_counter);
        
        // 从干员池中随机选择干员
        let operator = select_random_operator(rarity);
        
        // 检查是否获得 5★ 或 6★
        if rarity >= 5 {
            has_five_star_or_above = true;
        }
        
        // 更新保底计数器
        if rarity == 6 {
            pity_counter = 0;  // 获得 6★ 时重置保底计数器
        } else {
            pity_counter += 1;  // 未获得 6★ 时保底计数器加 1
        }
        
        operators.push(operator);
    }
    
    // 实现十连保底：至少一个 5★ 或 6★（需求 4.4）
    if !has_five_star_or_above {
        // 将最后一个干员替换为随机 5★ 干员
        let last_index = operators.len() - 1;
        let five_star_operator = select_random_operator(5);
        operators[last_index] = five_star_operator;
    }
    
    // 扣除合成玉
    currency.orundum -= TEN_PULL_COST;
    
    // 保存所有干员到收藏
    for operator in &operators {
        save_operator(conn, operator)
            .map_err(|e| format!("保存干员失败: {}", e))?;
    }
    
    // 更新货币余额
    update_currency(conn, &currency)
        .map_err(|e| format!("更新货币余额失败: {}", e))?;
    
    // 更新保底计数器（需求 4.6）
    update_pity_counter(conn, pity_counter)
        .map_err(|e| format!("更新保底计数器失败: {}", e))?;
    
    // 保存抽卡历史记录
    let history = GachaHistory {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        gacha_type: GachaType::Ten,
        operators: operators.clone(),
        cost_currency: Currency::new(0, TEN_PULL_COST, 0),
        pity_counter_before,
        pity_counter_after: pity_counter,
    };
    
    save_gacha_history(conn, &history)
        .map_err(|e| format!("保存抽卡历史失败: {}", e))?;
    
    // 返回抽卡结果（需求 4.5）
    Ok(GachaResult {
        operators,
        pity_counter,
        cost_currency: Currency::new(0, TEN_PULL_COST, 0),
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
fn select_random_operator(rarity: u8) -> Operator {
    use rand::seq::SliceRandom;
    use rand::thread_rng;
    
    let now = chrono::Utc::now().timestamp();
    
    // 简化的干员池（未来可以从配置文件或数据库加载）
    let operator_pool = get_operator_pool(rarity);
    
    let mut rng = thread_rng();
    let selected = operator_pool.choose(&mut rng)
        .expect("干员池不应为空");
    
    // 创建新的干员实例
    Operator {
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
    }
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
fn get_operator_pool(rarity: u8) -> Vec<(&'static str, OperatorClass)> {
    match rarity {
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
        _ => panic!("无效的稀有度: {}", rarity),
    }
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
    fn test_ten_gacha_insufficient_currency() {
        let conn = create_test_db();
        
        // 设置合成玉不足
        let currency = Currency::new(0, 5000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 尝试十连抽
        let result = perform_ten_gacha(&conn);
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("合成玉不足"));
    }

    #[test]
    fn test_ten_gacha_success() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 10000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行十连抽
        let result = perform_ten_gacha(&conn);
        
        assert!(result.is_ok());
        let gacha_result = result.unwrap();
        
        // 验证返回结果
        assert_eq!(gacha_result.operators.len(), 10);
        
        // 验证所有干员稀有度在有效范围内
        for operator in &gacha_result.operators {
            assert!(operator.rarity >= 3);
            assert!(operator.rarity <= 6);
        }
        
        // 验证货币扣除
        let updated_currency = load_currency(&conn).unwrap();
        assert_eq!(updated_currency.orundum, 4000);  // 10000 - 6000 = 4000
    }

    #[test]
    fn test_ten_gacha_guarantee() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 60000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行多次十连抽，验证保底机制
        for _ in 0..10 {
            let result = perform_ten_gacha(&conn).unwrap();
            
            // 验证至少有一个 5★ 或 6★
            let has_five_star_or_above = result.operators.iter()
                .any(|op| op.rarity >= 5);
            
            assert!(
                has_five_star_or_above,
                "十连抽必须至少包含一个 5★ 或 6★ 干员"
            );
        }
    }

    #[test]
    fn test_pity_counter_update_in_ten_pull() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 10000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 设置保底计数器
        update_pity_counter(&conn, 50).unwrap();
        
        // 执行十连抽
        let result = perform_ten_gacha(&conn).unwrap();
        
        // 如果获得了 6★，保底计数器应该被重置
        let has_six_star = result.operators.iter().any(|op| op.rarity == 6);
        if has_six_star {
            // 保底计数器应该小于 60（50 + 10）
            assert!(result.pity_counter < 60);
        }
    }

    #[test]
    fn test_operators_saved_to_database() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 10000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行十连抽
        let result = perform_ten_gacha(&conn).unwrap();
        
        // 验证干员已保存到数据库
        let operators = load_operators(&conn).unwrap();
        assert_eq!(operators.len(), 10);
        
        // 验证所有干员ID都在数据库中
        let result_ids: std::collections::HashSet<_> = result.operators.iter().map(|op| &op.id).collect();
        let db_ids: std::collections::HashSet<_> = operators.iter().map(|op| &op.id).collect();
        assert_eq!(result_ids, db_ids);
    }

    #[test]
    fn test_gacha_history_saved() {
        let conn = create_test_db();
        
        // 设置足够的合成玉
        let currency = Currency::new(0, 10000, 0);
        update_currency(&conn, &currency).unwrap();
        
        // 执行十连抽
        perform_ten_gacha(&conn).unwrap();
        
        // 验证抽卡历史已保存
        let history = load_gacha_history(&conn, 10).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].gacha_type, GachaType::Ten);
        assert_eq!(history[0].operators.len(), 10);
    }
}
