// Standalone test for probability calculation
// Run with: rustc test_probability.rs && ./test_probability

use rand::Rng;

fn calculate_gacha_rarity(pity_counter: u32) -> u8 {
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

fn main() {
    println!("Testing Arknights Gacha Probability Calculation");
    println!("==============================================\n");
    
    // Test 1: Hard pity at 99
    println!("Test 1: Hard pity at 99");
    let mut all_six = true;
    for _ in 0..100 {
        if calculate_gacha_rarity(99) != 6 {
            all_six = false;
            break;
        }
    }
    println!("  Result: {}", if all_six { "PASS - All pulls returned 6★" } else { "FAIL" });
    
    // Test 2: Rarity range
    println!("\nTest 2: Rarity range (0-98 pity)");
    let mut valid_range = true;
    for pity in 0..99 {
        let rarity = calculate_gacha_rarity(pity);
        if !(3..=6).contains(&rarity) {
            valid_range = false;
            println!("  Invalid rarity {} at pity {}", rarity, pity);
            break;
        }
    }
    println!("  Result: {}", if valid_range { "PASS - All rarities in valid range [3-6]" } else { "FAIL" });
    
    // Test 3: Base probability distribution (pity 0)
    println!("\nTest 3: Base probability distribution (pity 0)");
    let iterations = 100000;
    let mut counts = [0; 7]; // index 3-6 for rarities
    
    for _ in 0..iterations {
        let rarity = calculate_gacha_rarity(0);
        counts[rarity as usize] += 1;
    }
    
    let rate_6 = counts[6] as f64 / iterations as f64;
    let rate_5 = counts[5] as f64 / iterations as f64;
    let rate_4 = counts[4] as f64 / iterations as f64;
    let rate_3 = counts[3] as f64 / iterations as f64;
    
    println!("  6★: {:.2}% (expected ~2%)", rate_6 * 100.0);
    println!("  5★: {:.2}% (expected ~8%)", rate_5 * 100.0);
    println!("  4★: {:.2}% (expected ~50%)", rate_4 * 100.0);
    println!("  3★: {:.2}% (expected ~40%)", rate_3 * 100.0);
    
    let pass_6 = (rate_6 - 0.02).abs() < 0.01;
    let pass_5 = (rate_5 - 0.08).abs() < 0.01;
    let pass_4 = (rate_4 - 0.50).abs() < 0.01;
    let pass_3 = (rate_3 - 0.40).abs() < 0.01;
    
    println!("  Result: {}", if pass_6 && pass_5 && pass_4 && pass_3 { 
        "PASS - All rates within ±1% tolerance" 
    } else { 
        "FAIL - Some rates outside tolerance" 
    });
    
    // Test 4: Pity increase at 60 and 70
    println!("\nTest 4: Pity increase progression");
    let mut counts_60 = [0; 7];
    let mut counts_70 = [0; 7];
    let iterations = 50000;
    
    for _ in 0..iterations {
        counts_60[calculate_gacha_rarity(60) as usize] += 1;
        counts_70[calculate_gacha_rarity(70) as usize] += 1;
    }
    
    let rate_6_at_60 = counts_60[6] as f64 / iterations as f64;
    let rate_6_at_70 = counts_70[6] as f64 / iterations as f64;
    
    println!("  6★ at pity 60: {:.2}% (expected ~22%)", rate_6_at_60 * 100.0);
    println!("  6★ at pity 70: {:.2}% (expected ~42%)", rate_6_at_70 * 100.0);
    
    let pass_60 = (rate_6_at_60 - 0.22).abs() < 0.02;
    let pass_70 = (rate_6_at_70 - 0.42).abs() < 0.02;
    let increasing = rate_6_at_70 > rate_6_at_60;
    
    println!("  Result: {}", if pass_60 && pass_70 && increasing { 
        "PASS - Pity rates increase correctly" 
    } else { 
        "FAIL - Pity rates incorrect" 
    });
    
    println!("\n==============================================");
    println!("All tests completed!");
}
