/**
 * 单抽功能集成测试
 * 
 * 测试完整的单抽流程，包括：
 * - 货币验证
 * - 概率计算
 * - 干员选择
 * - 保底计数器更新
 * - 数据持久化
 */

use focused_moment_lib::*;
use rusqlite::Connection;

fn create_test_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    initialize_gacha_database(&conn).unwrap();
    conn
}

#[test]
fn test_complete_single_gacha_flow() {
    let conn = create_test_db();
    
    // 初始化：设置足够的合成玉
    let initial_currency = Currency::new(0, 10000, 0);
    update_currency(&conn, &initial_currency).unwrap();
    
    // 执行多次抽卡以测试保底机制
    let mut six_star_count = 0;
    let mut five_star_count = 0;
    let mut four_star_count = 0;
    let mut three_star_count = 0;
    
    for i in 0..10 {
        let result = perform_single_gacha(&conn).unwrap();
        
        // 验证返回结果
        assert_eq!(result.operators.len(), 1, "第 {} 次抽卡应返回 1 个干员", i + 1);
        assert_eq!(result.cost_currency.orundum, 600, "每次抽卡应消耗 600 合成玉");
        
        let operator = &result.operators[0];
        
        // 统计稀有度
        match operator.rarity {
            6 => six_star_count += 1,
            5 => five_star_count += 1,
            4 => four_star_count += 1,
            3 => three_star_count += 1,
            _ => panic!("无效的稀有度: {}", operator.rarity),
        }
        
        // 验证干员属性
        assert!(operator.level == 1, "新干员等级应为 1");
        assert!(operator.elite == 0, "新干员精英化应为 0");
        assert!(operator.potential == 1, "新干员潜能应为 1");
        
        println!("第 {} 次抽卡: {} ({}★ {})", 
            i + 1, 
            operator.name, 
            operator.rarity,
            format!("{:?}", operator.class)
        );
    }
    
    // 验证货币扣除
    let final_currency = load_currency(&conn).unwrap();
    assert_eq!(
        final_currency.orundum, 
        10000 - 600 * 10,
        "应扣除 6000 合成玉"
    );
    
    // 验证干员已保存
    let operators = load_operators(&conn).unwrap();
    assert_eq!(operators.len(), 10, "应保存 10 个干员");
    
    // 验证抽卡历史
    let history = load_gacha_history(&conn, 100).unwrap();
    assert_eq!(history.len(), 10, "应有 10 条抽卡历史");
    
    // 验证保底计数器
    let pity_counter = load_pity_counter(&conn).unwrap();
    if six_star_count > 0 {
        // 如果抽到了 6★，保底计数器应该被重置过
        println!("抽到了 {} 个 6★ 干员，保底计数器: {}", six_star_count, pity_counter);
    } else {
        // 如果没抽到 6★，保底计数器应该是 10
        assert_eq!(pity_counter, 10, "未抽到 6★ 时，保底计数器应为 10");
    }
    
    println!("\n统计结果:");
    println!("6★: {} 个", six_star_count);
    println!("5★: {} 个", five_star_count);
    println!("4★: {} 个", four_star_count);
    println!("3★: {} 个", three_star_count);
}

#[test]
fn test_pity_counter_reset_on_six_star() {
    let conn = create_test_db();
    
    // 设置足够的合成玉
    let currency = Currency::new(0, 100000, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 设置保底计数器接近硬保底
    update_pity_counter(&conn, 98).unwrap();
    
    // 执行抽卡（应该必出 6★）
    let result = perform_single_gacha(&conn).unwrap();
    
    // 验证获得 6★
    assert_eq!(result.operators[0].rarity, 6, "保底计数器 98 时下一抽应必出 6★");
    
    // 验证保底计数器重置
    assert_eq!(result.pity_counter, 0, "获得 6★ 后保底计数器应重置为 0");
    
    let pity_counter = load_pity_counter(&conn).unwrap();
    assert_eq!(pity_counter, 0, "数据库中的保底计数器应为 0");
}

#[test]
fn test_hard_pity_at_99() {
    let conn = create_test_db();
    
    // 设置足够的合成玉
    let currency = Currency::new(0, 100000, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 设置保底计数器为 99（硬保底）
    update_pity_counter(&conn, 99).unwrap();
    
    // 执行多次抽卡，验证每次都是 6★
    for i in 0..5 {
        // 重置保底计数器为 99
        update_pity_counter(&conn, 99).unwrap();
        
        let result = perform_single_gacha(&conn).unwrap();
        
        assert_eq!(
            result.operators[0].rarity, 
            6, 
            "第 {} 次测试：保底计数器 99 时必出 6★", 
            i + 1
        );
        assert_eq!(
            result.pity_counter, 
            0, 
            "第 {} 次测试：获得 6★ 后保底计数器应重置", 
            i + 1
        );
    }
}

#[test]
fn test_insufficient_currency_error() {
    let conn = create_test_db();
    
    // 设置合成玉不足
    let currency = Currency::new(0, 500, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 尝试抽卡
    let result = perform_single_gacha(&conn);
    
    assert!(result.is_err(), "合成玉不足时应返回错误");
    
    let error_msg = result.unwrap_err();
    assert!(error_msg.contains("合成玉不足"), "错误信息应包含'合成玉不足'");
    assert!(error_msg.contains("600"), "错误信息应包含所需数量");
    assert!(error_msg.contains("500"), "错误信息应包含当前数量");
}

#[test]
fn test_gacha_history_accuracy() {
    let conn = create_test_db();
    
    // 设置足够的合成玉
    let currency = Currency::new(0, 10000, 0);
    update_currency(&conn, &currency).unwrap();
    
    // 设置初始保底计数器
    update_pity_counter(&conn, 25).unwrap();
    
    // 执行抽卡
    let result = perform_single_gacha(&conn).unwrap();
    
    // 加载抽卡历史
    let history = load_gacha_history(&conn, 1).unwrap();
    assert_eq!(history.len(), 1, "应有 1 条历史记录");
    
    let record = &history[0];
    
    // 验证历史记录的准确性
    assert_eq!(record.gacha_type, GachaType::Single, "抽卡类型应为单抽");
    assert_eq!(record.operators.len(), 1, "应记录 1 个干员");
    assert_eq!(record.operators[0].id, result.operators[0].id, "干员 ID 应匹配");
    assert_eq!(record.cost_currency.orundum, 600, "应记录消耗 600 合成玉");
    assert_eq!(record.pity_counter_before, 25, "应记录抽卡前保底计数器");
    
    if result.operators[0].rarity == 6 {
        assert_eq!(record.pity_counter_after, 0, "获得 6★ 后保底计数器应为 0");
    } else {
        assert_eq!(record.pity_counter_after, 26, "未获得 6★ 时保底计数器应加 1");
    }
}
