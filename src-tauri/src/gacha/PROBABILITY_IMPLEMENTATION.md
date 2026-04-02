# 概率计算函数实现说明

## 任务完成情况

✅ **任务 2.1: 实现概率计算函数** - 已完成

## 实现内容

### 文件创建
- 创建了 `src-tauri/src/gacha/probability.rs` 模块
- 更新了 `src-tauri/src/gacha/mod.rs` 以导出新模块
- 添加了 `rand = "0.8"` 依赖到 `Cargo.toml`

### 核心函数: `calculate_gacha_rarity`

```rust
pub fn calculate_gacha_rarity(pity_counter: u32) -> u8
```

#### 功能说明
根据保底计数器和明日方舟的概率机制计算本次抽卡的稀有度。

#### 实现的需求

1. **基础概率** (需求 2.1, 2.4, 2.5, 2.6)
   - 6★: 2% (基础概率)
   - 5★: 8%
   - 4★: 50%
   - 3★: 40%

2. **保底机制** (需求 2.2)
   - 当 `pityCounter >= 50` 时，6★ 概率开始增加
   - 增加公式: `6★ 概率 = 2% + 2% × (pityCounter - 50)`
   - 例如:
     - pityCounter = 50: 2% + 2% × 0 = 2%
     - pityCounter = 60: 2% + 2% × 10 = 22%
     - pityCounter = 70: 2% + 2% × 20 = 42%
     - pityCounter = 98: 2% + 2% × 48 = 98%

3. **硬保底** (需求 2.3)
   - 当 `pityCounter = 99` 时，必定返回 6★
   - 实现为 `if pity_counter >= 99 { return 6; }`

#### 算法流程

```
1. 检查硬保底: if pityCounter >= 99 → 返回 6★
2. 计算 6★ 概率:
   - if pityCounter >= 50: rate = 0.02 + 0.02 × (pityCounter - 50)
   - else: rate = 0.02
3. 生成随机数 random ∈ [0.0, 1.0)
4. 根据概率区间判断稀有度:
   - if random < 6★概率 → 返回 6
   - else if random < 6★概率 + 0.08 → 返回 5
   - else if random < 6★概率 + 0.58 → 返回 4
   - else → 返回 3
```

## 测试覆盖

实现了全面的单元测试，包括:

### 1. 硬保底测试
- `test_hard_pity_at_99`: 验证 pityCounter = 99 时必定返回 6★
- `test_hard_pity_at_100_plus`: 验证超过 99 的情况也返回 6★

### 2. 基础验证测试
- `test_rarity_range`: 验证返回值始终在 3-6 范围内

### 3. 概率分布测试
- `test_base_probability_distribution`: 验证基础概率分布 (pityCounter = 0)
  - 使用 100,000 次迭代
  - 允许 ±1% 的误差范围
  - 验证 6★ (2%), 5★ (8%), 4★ (50%), 3★ (40%)

### 4. 保底机制测试
- `test_pity_increase_at_50`: 验证保底在 50 抽时开始生效
- `test_pity_increase_progression`: 验证保底概率递增
  - 测试 pityCounter = 60 时 6★ 概率约 22%
  - 测试 pityCounter = 70 时 6★ 概率约 42%
  - 验证概率随 pityCounter 增加而增加

### 5. 边界测试
- `test_near_hard_pity`: 验证接近硬保底时的概率
  - 测试 pityCounter = 98 时 6★ 概率约 98%

## 正确性验证

### 满足的设计属性

✅ **属性 1: 抽卡概率正确性**
- 当 pityCounter < 50 时 P(6★) = 2%
- 当 50 ≤ pityCounter < 99 时 P(6★) = 2% + 2% × (pityCounter - 50)
- 当 pityCounter = 99 时 P(6★) = 100%

### 满足的需求

- ✅ 需求 2.1: 基础 6★ 概率 2%
- ✅ 需求 2.2: 保底机制 (pityCounter >= 50 时增加概率)
- ✅ 需求 2.3: 硬保底 (pityCounter = 99 时必出 6★)
- ✅ 需求 2.4: 5★ 概率 8%
- ✅ 需求 2.5: 4★ 概率 50%
- ✅ 需求 2.6: 3★ 概率 40%

## 使用示例

```rust
use focused_moment_lib::gacha::calculate_gacha_rarity;

// 基础抽卡 (无保底)
let rarity = calculate_gacha_rarity(0);
// 返回 3-6，概率分别为 40%, 50%, 8%, 2%

// 保底开始生效
let rarity = calculate_gacha_rarity(60);
// 6★ 概率提升到 22%

// 硬保底
let rarity = calculate_gacha_rarity(99);
// 必定返回 6
```

## 后续任务

此函数将在后续任务中被使用:
- 任务 2.2: 实现单次抽卡逻辑
- 任务 2.3: 实现十连抽逻辑
- 任务 2.4: 实现保底计数器更新

## 注意事项

1. **随机数生成**: 使用 `rand::thread_rng()` 生成线程安全的随机数
2. **浮点精度**: 概率计算使用 `f64` 以保证精度
3. **边界条件**: 正确处理 pityCounter = 99 的硬保底情况
4. **类型安全**: 使用 `u32` 作为 pityCounter 类型，`u8` 作为稀有度返回类型

## 性能考虑

- 函数执行时间: O(1) 常数时间
- 内存使用: 最小化，仅使用栈内存
- 线程安全: 使用 `thread_rng()` 确保多线程环境下的安全性
