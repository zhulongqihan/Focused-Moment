/**
 * 明日方舟抽卡概率计算模块
 * 
 * 实现明日方舟的抽卡概率机制，包括：
 * - 基础概率：6★ (2%), 5★ (8%), 4★ (50%), 3★ (40%)
 * - 保底机制：pityCounter >= 50 时增加 6★ 概率
 * - 硬保底：pityCounter = 99 时必定返回 6★
 */

use rand::Rng;

/**
 * 计算抽卡稀有度
 * 
 * 根据保底计数器和明日方舟的概率机制计算本次抽卡的稀有度
 * 
 * # 参数
 * - `pity_counter`: 保底计数器，表示自上次获得6★以来的抽卡次数
 * 
 * # 返回值
 * - 稀有度 (3-6)
 * 
 * # 概率机制
 * - 6★: 2% (基础) + 2% × max(0, pityCounter - 50)
 * - 5★: 8%
 * - 4★: 50%
 * - 3★: 40%
 * 
 * # 保底机制
 * - 当 pityCounter >= 50 时，6★ 概率开始增加
 * - 当 pityCounter = 99 时，必定获得 6★（硬保底）
 */
pub fn calculate_gacha_rarity(pity_counter: u32) -> u8 {
    // 硬保底：99 抽必出 6★
    if pity_counter >= 99 {
        return 6;
    }
    
    // 计算 6★ 概率
    let six_star_rate = if pity_counter >= 50 {
        0.02 + 0.02 * (pity_counter - 50) as f64
    } else {
        0.02
    };
    
    // 生成随机数 [0.0, 1.0)
    let mut rng = rand::thread_rng();
    let random: f64 = rng.gen();
    
    // 根据概率区间判断稀有度
    if random < six_star_rate {
        6
    } else if random < six_star_rate + 0.08 {
        5
    } else if random < six_star_rate + 0.08 + 0.50 {
        4
    } else {
        3
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // ============================================================================
    // 属性测试 (Property-Based Tests)
    // ============================================================================
    // **Validates: Requirements 2.1, 2.2, 2.3**
    // 
    // 属性 1: 抽卡概率正确性
    // 对于任意保底计数器值 pityCounter ∈ [0, 99]，抽卡获得6★干员的概率 P(6★) 应满足：
    // - 当 pityCounter < 50 时 P(6★) = 2%
    // - 当 50 ≤ pityCounter < 99 时 P(6★) = 2% + 2% × (pityCounter - 50)
    // - 当 pityCounter = 99 时 P(6★) = 100%

    use proptest::prelude::*;

    proptest! {
        /// 属性测试 1.1: 硬保底机制
        /// **Validates: Requirements 2.3**
        /// 
        /// 验证当 pityCounter >= 99 时，必定返回 6★
        #[test]
        fn prop_hard_pity_always_returns_six_star(pity_counter in 99u32..200u32) {
            let rarity = calculate_gacha_rarity(pity_counter);
            prop_assert_eq!(rarity, 6, "Hard pity at {} should always return 6★", pity_counter);
        }

        /// 属性测试 1.2: 稀有度范围约束
        /// **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6**
        /// 
        /// 验证对于任意 pityCounter，返回的稀有度必定在 [3, 6] 范围内
        #[test]
        fn prop_rarity_always_in_valid_range(pity_counter in 0u32..100u32) {
            let rarity = calculate_gacha_rarity(pity_counter);
            prop_assert!(
                (3..=6).contains(&rarity),
                "Rarity must be between 3 and 6, got {} at pity {}",
                rarity,
                pity_counter
            );
        }

        /// 属性测试 1.3: 基础概率分布验证
        /// **Validates: Requirements 2.1, 2.4, 2.5, 2.6**
        /// 
        /// 验证当 pityCounter < 50 时，概率分布接近理论值
        /// 使用大样本统计验证（每个 pity 值测试 20000 次）
        #[test]
        fn prop_base_probability_distribution(pity_counter in 0u32..50u32) {
            let iterations = 20000;
            let mut counts = HashMap::new();
            
            for _ in 0..iterations {
                let rarity = calculate_gacha_rarity(pity_counter);
                *counts.entry(rarity).or_insert(0) += 1;
            }
            
            let rate_6 = *counts.get(&6).unwrap_or(&0) as f64 / iterations as f64;
            let rate_5 = *counts.get(&5).unwrap_or(&0) as f64 / iterations as f64;
            let rate_4 = *counts.get(&4).unwrap_or(&0) as f64 / iterations as f64;
            let rate_3 = *counts.get(&3).unwrap_or(&0) as f64 / iterations as f64;
            
            // 允许 ±2% 的误差范围（考虑到随机性和统计波动）
            prop_assert!(
                (rate_6 - 0.02).abs() < 0.02,
                "6★ rate at pity {} should be ~2%, got {:.2}%",
                pity_counter,
                rate_6 * 100.0
            );
            prop_assert!(
                (rate_5 - 0.08).abs() < 0.02,
                "5★ rate at pity {} should be ~8%, got {:.2}%",
                pity_counter,
                rate_5 * 100.0
            );
            prop_assert!(
                (rate_4 - 0.50).abs() < 0.02,
                "4★ rate at pity {} should be ~50%, got {:.2}%",
                pity_counter,
                rate_4 * 100.0
            );
            prop_assert!(
                (rate_3 - 0.40).abs() < 0.02,
                "3★ rate at pity {} should be ~40%, got {:.2}%",
                pity_counter,
                rate_3 * 100.0
            );
        }

        /// 属性测试 1.4: 保底概率递增验证
        /// **Validates: Requirements 2.2**
        /// 
        /// 验证当 50 ≤ pityCounter < 99 时，6★ 概率随 pityCounter 递增
        #[test]
        fn prop_pity_probability_increases(pity_counter in 50u32..98u32) {
            let iterations = 10000;
            let mut counts_current = HashMap::new();
            let mut counts_next = HashMap::new();
            
            for _ in 0..iterations {
                let rarity_current = calculate_gacha_rarity(pity_counter);
                *counts_current.entry(rarity_current).or_insert(0) += 1;
                
                let rarity_next = calculate_gacha_rarity(pity_counter + 1);
                *counts_next.entry(rarity_next).or_insert(0) += 1;
            }
            
            let rate_6_current = *counts_current.get(&6).unwrap_or(&0) as f64 / iterations as f64;
            let rate_6_next = *counts_next.get(&6).unwrap_or(&0) as f64 / iterations as f64;
            
            // 验证概率递增（允许小的统计误差）
            prop_assert!(
                rate_6_next >= rate_6_current - 0.01,
                "6★ rate should increase from pity {} to {}, but got {:.2}% -> {:.2}%",
                pity_counter,
                pity_counter + 1,
                rate_6_current * 100.0,
                rate_6_next * 100.0
            );
        }

        /// 属性测试 1.5: 保底概率公式验证
        /// **Validates: Requirements 2.2**
        /// 
        /// 验证当 50 ≤ pityCounter < 99 时，6★ 概率符合公式：
        /// P(6★) = 2% + 2% × (pityCounter - 50)
        #[test]
        fn prop_pity_formula_correctness(pity_counter in 50u32..99u32) {
            let iterations = 20000;
            let mut count_6_star = 0;
            
            for _ in 0..iterations {
                if calculate_gacha_rarity(pity_counter) == 6 {
                    count_6_star += 1;
                }
            }
            
            let actual_rate = count_6_star as f64 / iterations as f64;
            let expected_rate = 0.02 + 0.02 * (pity_counter - 50) as f64;
            
            // 允许 ±2% 的误差范围（考虑到随机性和样本大小）
            prop_assert!(
                (actual_rate - expected_rate).abs() < 0.02,
                "6★ rate at pity {} should be {:.2}%, got {:.2}%",
                pity_counter,
                expected_rate * 100.0,
                actual_rate * 100.0
            );
        }

        /// 属性测试 1.6: 概率总和为 100%
        /// **Validates: Requirements 2.1, 2.4, 2.5, 2.6**
        /// 
        /// 验证所有稀有度的概率总和为 100%
        #[test]
        fn prop_probability_sum_is_one(pity_counter in 0u32..99u32) {
            let iterations = 50000;
            let mut counts = HashMap::new();
            
            for _ in 0..iterations {
                let rarity = calculate_gacha_rarity(pity_counter);
                *counts.entry(rarity).or_insert(0) += 1;
            }
            
            let total: i32 = counts.values().sum();
            let sum_of_rates: f64 = counts.values()
                .map(|&count| count as f64 / iterations as f64)
                .sum();
            
            prop_assert_eq!(total, iterations, "Total count should equal iterations");
            prop_assert!(
                (sum_of_rates - 1.0).abs() < 0.001,
                "Sum of all probabilities should be ~100%, got {:.2}%",
                sum_of_rates * 100.0
            );
        }
    }

    // ============================================================================
    // 单元测试 (Unit Tests)
    // ============================================================================

    #[test]
    fn test_hard_pity_at_99() {
        // 硬保底测试：99 抽必出 6★
        for _ in 0..100 {
            let rarity = calculate_gacha_rarity(99);
            assert_eq!(rarity, 6, "Hard pity at 99 should always return 6★");
        }
    }

    #[test]
    fn test_hard_pity_at_100_plus() {
        // 测试超过 99 的情况（理论上不应该发生，但要确保安全）
        for pity in 100..110 {
            let rarity = calculate_gacha_rarity(pity);
            assert_eq!(rarity, 6, "Pity counter {} should guarantee 6★", pity);
        }
    }

    #[test]
    fn test_rarity_range() {
        // 测试返回值在有效范围内
        for pity in 0..100 {
            let rarity = calculate_gacha_rarity(pity);
            assert!(
                (3..=6).contains(&rarity),
                "Rarity must be between 3 and 6, got {}",
                rarity
            );
        }
    }

    #[test]
    fn test_base_probability_distribution() {
        // 测试基础概率分布（pityCounter < 50）
        let mut counts = HashMap::new();
        let iterations = 100000;
        
        for _ in 0..iterations {
            let rarity = calculate_gacha_rarity(0);
            *counts.entry(rarity).or_insert(0) += 1;
        }
        
        // 计算实际概率
        let rate_6 = *counts.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        let rate_5 = *counts.get(&5).unwrap_or(&0) as f64 / iterations as f64;
        let rate_4 = *counts.get(&4).unwrap_or(&0) as f64 / iterations as f64;
        let rate_3 = *counts.get(&3).unwrap_or(&0) as f64 / iterations as f64;
        
        // 允许 ±1% 的误差范围
        assert!(
            (rate_6 - 0.02).abs() < 0.01,
            "6★ rate should be ~2%, got {:.2}%",
            rate_6 * 100.0
        );
        assert!(
            (rate_5 - 0.08).abs() < 0.01,
            "5★ rate should be ~8%, got {:.2}%",
            rate_5 * 100.0
        );
        assert!(
            (rate_4 - 0.50).abs() < 0.01,
            "4★ rate should be ~50%, got {:.2}%",
            rate_4 * 100.0
        );
        assert!(
            (rate_3 - 0.40).abs() < 0.01,
            "3★ rate should be ~40%, got {:.2}%",
            rate_3 * 100.0
        );
    }

    #[test]
    fn test_pity_increase_at_50() {
        // 测试保底机制在 50 抽时开始生效
        let mut counts_49 = HashMap::new();
        let mut counts_50 = HashMap::new();
        let iterations = 50000;
        
        for _ in 0..iterations {
            let rarity_49 = calculate_gacha_rarity(49);
            *counts_49.entry(rarity_49).or_insert(0) += 1;
            
            let rarity_50 = calculate_gacha_rarity(50);
            *counts_50.entry(rarity_50).or_insert(0) += 1;
        }
        
        let rate_6_at_49 = *counts_49.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        let rate_6_at_50 = *counts_50.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        
        // 在 50 抽时，6★ 概率应该是 2% + 2% × (50 - 50) = 2%
        // 但在 49 抽时应该是 2%
        // 实际上在 50 抽时概率应该开始增加
        assert!(
            (rate_6_at_49 - 0.02).abs() < 0.01,
            "6★ rate at pity 49 should be ~2%, got {:.2}%",
            rate_6_at_49 * 100.0
        );
        
        // 在 50 抽时概率应该是 2%（刚好到达阈值）
        assert!(
            (rate_6_at_50 - 0.02).abs() < 0.01,
            "6★ rate at pity 50 should be ~2%, got {:.2}%",
            rate_6_at_50 * 100.0
        );
    }

    #[test]
    fn test_pity_increase_progression() {
        // 测试保底概率递增
        let mut counts_60 = HashMap::new();
        let mut counts_70 = HashMap::new();
        let iterations = 50000;
        
        for _ in 0..iterations {
            let rarity_60 = calculate_gacha_rarity(60);
            *counts_60.entry(rarity_60).or_insert(0) += 1;
            
            let rarity_70 = calculate_gacha_rarity(70);
            *counts_70.entry(rarity_70).or_insert(0) += 1;
        }
        
        let rate_6_at_60 = *counts_60.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        let rate_6_at_70 = *counts_70.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        
        // 在 60 抽时：2% + 2% × (60 - 50) = 2% + 20% = 22%
        // 在 70 抽时：2% + 2% × (70 - 50) = 2% + 40% = 42%
        assert!(
            (rate_6_at_60 - 0.22).abs() < 0.02,
            "6★ rate at pity 60 should be ~22%, got {:.2}%",
            rate_6_at_60 * 100.0
        );
        assert!(
            (rate_6_at_70 - 0.42).abs() < 0.02,
            "6★ rate at pity 70 should be ~42%, got {:.2}%",
            rate_6_at_70 * 100.0
        );
        
        // 确保概率递增
        assert!(
            rate_6_at_70 > rate_6_at_60,
            "6★ rate should increase with pity counter"
        );
    }

    #[test]
    fn test_near_hard_pity() {
        // 测试接近硬保底时的概率
        let mut counts_98 = HashMap::new();
        let iterations = 10000;
        
        for _ in 0..iterations {
            let rarity = calculate_gacha_rarity(98);
            *counts_98.entry(rarity).or_insert(0) += 1;
        }
        
        let rate_6_at_98 = *counts_98.get(&6).unwrap_or(&0) as f64 / iterations as f64;
        
        // 在 98 抽时：2% + 2% × (98 - 50) = 2% + 96% = 98%
        assert!(
            (rate_6_at_98 - 0.98).abs() < 0.02,
            "6★ rate at pity 98 should be ~98%, got {:.2}%",
            rate_6_at_98 * 100.0
        );
    }
}
