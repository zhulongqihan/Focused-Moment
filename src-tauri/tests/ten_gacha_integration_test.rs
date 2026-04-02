/**
 * 十连抽集成测试
 * 
 * 验证十连抽的完整流程，包括：
 * - 货币验证
 * - 十连保底机制
 * - 保底计数器更新
 * - 数据持久化
 */

use rusqlite::Connection;
use focused_moment_lib::gacha::*;

fn create_test_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    initialize_gacha_database(&conn).unwrap();
    conn
}

#[test]
fn test_ten_gacha_complete_flow() {
    let conn = create_test_db();
    
    // 初始化：给用户足够的合成玉
    let initial_currency = Currency::new(0, 12000, 0);
    update_currency(&conn, &initial_currency).unwrap();
    
    // 第一次十连抽
    let result1 = perform_ten_gacha(&conn).unwrap();
    
    // 验证结果
    assert_eq!(result1.operators.len(), 10, "十连抽应该返回10个干员");
    
    // 验证十连保底：至少一个5★或6★
    let has_five_star_or_above = result1.operators.iter().any(|op| op.rarity >= 5);
    assert!(has_five_star_or_above, "十连抽必须至少包含一个5★或6★干员");
    
    // 验证货币扣除
    let currency_after_first = load_currency(&conn).unwrap();
    assert_eq!(currency_after_first.orundum, 6000, "第一次十连后应剩余6000合成玉");
    
    // 第二次十连抽
    let result2 = perform_ten_gacha(&conn).unwrap();
    
    // 验证结果
    assert_eq!(result2.operators.len(), 10, "第二次十连抽应该返回10个干员");
    
    // 验证十连保底
    let has_five_star_or_above_2 = result2.operators.iter().any(|op| op.rarity >= 5);
    assert!(has_five_star_or_above_2, "第二次十连抽必须至少包含一个5★或6★干员");
    
    // 验证货币扣除
    let currency_after_second = load_currency(&conn).unwrap();
    assert_eq!(currency_after_second.orundum, 0, "第二次十连后应剩余0合成玉");
    
    // 验证所有干员已保存
    let all_operators = load_operators(&conn).unwrap();
    assert_eq!(all_operators.len(), 20, "应该有20个干员被保存");
    
    // 验证抽卡历史
    let history = load_gacha_history(&conn, 10).unwrap();
    assert_eq!(history.len(), 2, "应该有2条抽卡历史记录");
    assert_eq!(history[0].gacha_type, GachaType::Ten);
    assert_eq!(history[1].gacha_type, GachaType::Ten);
}

#[test]
fn test_ten_gacha_pity_counter_progression() {
    let conn = create_test_db();
    
    // 设置初始保底计数器为90（接近硬保底）
    update_pity_counter(&conn, 90).unwrap();
    
    // 给足够的合成玉
    let currency = Currency::new(0, 6000, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 执行十连抽
    let result = perform_ten_gacha(&conn).unwrap();
    
    // 在保底计数器90的情况下，前10抽中必定会触发硬保底（99抽）
    // 验证至少有一个6★
    let has_six_star = result.operators.iter().any(|op| op.rarity == 6);
    assert!(has_six_star, "从保底计数器90开始的十连抽应该获得6★");
    
    // 验证保底计数器已被重置或更新
    let final_pity = load_pity_counter(&conn).unwrap();
    assert!(final_pity < 100, "保底计数器应该小于100");
}

#[test]
fn test_ten_gacha_insufficient_currency() {
    let conn = create_test_db();
    
    // 设置不足的合成玉
    let currency = Currency::new(0, 5999, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 尝试十连抽
    let result = perform_ten_gacha(&conn);
    
    // 应该返回错误
    assert!(result.is_err());
    let error_msg = result.unwrap_err();
    assert!(error_msg.contains("合成玉不足"));
    
    // 验证货币未被扣除
    let currency_after = load_currency(&conn).unwrap();
    assert_eq!(currency_after.orundum, 5999);
    
    // 验证没有干员被添加
    let operators = load_operators(&conn).unwrap();
    assert_eq!(operators.len(), 0);
}

#[test]
fn test_ten_gacha_guarantee_mechanism() {
    let conn = create_test_db();
    
    // 执行多次十连抽，验证保底机制的一致性
    let currency = Currency::new(0, 60000, 0);
    update_currency(&conn, &currency).unwrap();
    
    for i in 0..10 {
        let result = perform_ten_gacha(&conn).unwrap();
        
        // 每次十连抽都必须有至少一个5★或6★
        let has_five_star_or_above = result.operators.iter().any(|op| op.rarity >= 5);
        assert!(
            has_five_star_or_above,
            "第{}次十连抽必须至少包含一个5★或6★干员",
            i + 1
        );
        
        // 验证返回的干员数量
        assert_eq!(result.operators.len(), 10, "第{}次十连抽应该返回10个干员", i + 1);
    }
    
    // 验证所有干员已保存
    let all_operators = load_operators(&conn).unwrap();
    assert_eq!(all_operators.len(), 100, "应该有100个干员被保存");
    
    // 验证抽卡历史
    let history = load_gacha_history(&conn, 20).unwrap();
    assert_eq!(history.len(), 10, "应该有10条抽卡历史记录");
}
