# 十连抽实现文档

## 概述

本文档描述了明日方舟抽卡系统的十连抽功能实现，包括核心逻辑、保底机制和测试验证。

## 实现文件

- **核心实现**: `src-tauri/src/gacha/ten_pull.rs`
- **集成测试**: `src-tauri/tests/ten_gacha_integration_test.rs`
- **Tauri 命令**: `src-tauri/src/lib.rs` 中的 `perform_ten_gacha_pull`

## 核心功能

### 1. 十连抽逻辑 (`perform_ten_gacha`)

**功能描述**:
- 验证合成玉余额（需要 6000 合成玉）
- 执行 10 次抽卡计算
- 实现十连保底：至少一个 5★ 或 6★
- 批量更新保底计数器
- 扣除 6000 合成玉
- 保存所有干员到数据库
- 记录抽卡历史

**验证需求**:
- 4.1: 验证合成玉余额（>= 6000）
- 4.2: 合成玉不足时返回错误
- 4.3: 执行 10 次抽卡计算
- 4.4: 实现十连保底：至少一个 5★ 或 6★
- 4.5: 返回包含 10 个干员的结果列表
- 4.6: 批量更新保底计数器

### 2. 十连保底机制

**实现细节**:
```rust
// 执行 10 次抽卡
for _ in 0..10 {
    let rarity = calculate_gacha_rarity(pity_counter);
    let operator = select_random_operator(rarity);
    
    if rarity >= 5 {
        has_five_star_or_above = true;
    }
    
    // 更新保底计数器
    if rarity == 6 {
        pity_counter = 0;
    } else {
        pity_counter += 1;
    }
    
    operators.push(operator);
}

// 十连保底：如果没有 5★ 或 6★，将最后一个替换为 5★
if !has_five_star_or_above {
    let last_index = operators.len() - 1;
    operators[last_index] = select_random_operator(5);
}
```

**保底规则**:
- 每次十连抽必定包含至少一个 5★ 或 6★ 干员
- 如果前 10 次抽卡都没有获得 5★ 或 6★，则将最后一个干员替换为随机 5★ 干员
- 保底计数器在每次抽卡后更新，获得 6★ 时重置为 0

### 3. 干员池

**干员池配置**:
- **6★ 干员**: 银灰、艾雅法拉、能天使、闪灵、塞雷娅、推进之王、陈、伊芙利特、麦哲伦、莫斯提马
- **5★ 干员**: 德克萨斯、幽灵鲨、蓝毒、白面鸮、赫默、临光、雷蛇、天火、初雪、红
- **4★ 干员**: 夜刀、杰西卡、调香师、末药、古米、白雪、远山、梅、砾、安塞尔
- **3★ 干员**: 芬、香草、翎羽、玫兰莎、卡缇、米格鲁、克洛丝、安德切尔、史都华德、阿消

## 测试覆盖

### 单元测试 (`src-tauri/src/gacha/ten_pull.rs`)

1. **test_ten_gacha_insufficient_currency**
   - 验证合成玉不足时返回错误
   - 验证错误信息包含"合成玉不足"

2. **test_ten_gacha_success**
   - 验证十连抽返回 10 个干员
   - 验证所有干员稀有度在 3-6 范围内
   - 验证货币正确扣除（10000 - 6000 = 4000）

3. **test_ten_gacha_guarantee**
   - 执行 10 次十连抽
   - 验证每次都至少包含一个 5★ 或 6★ 干员

4. **test_pity_counter_update_in_ten_pull**
   - 设置保底计数器为 50
   - 验证保底计数器在十连抽后正确更新
   - 如果获得 6★，验证保底计数器被重置

5. **test_operators_saved_to_database**
   - 验证所有 10 个干员都被保存到数据库
   - 验证干员 ID 集合匹配

6. **test_gacha_history_saved**
   - 验证抽卡历史被正确保存
   - 验证历史记录类型为 `GachaType::Ten`
   - 验证历史记录包含 10 个干员

### 集成测试 (`src-tauri/tests/ten_gacha_integration_test.rs`)

1. **test_ten_gacha_complete_flow**
   - 测试完整的十连抽流程
   - 执行两次十连抽
   - 验证货币扣除、干员保存、历史记录

2. **test_ten_gacha_pity_counter_progression**
   - 从保底计数器 90 开始
   - 验证在接近硬保底时必定获得 6★
   - 验证保底计数器正确更新

3. **test_ten_gacha_insufficient_currency**
   - 验证合成玉不足时的错误处理
   - 验证货币未被扣除
   - 验证没有干员被添加

4. **test_ten_gacha_guarantee_mechanism**
   - 执行 10 次十连抽（共 100 个干员）
   - 验证每次十连抽都有至少一个 5★ 或 6★
   - 验证所有干员和历史记录都被正确保存

## Tauri 命令

### `perform_ten_gacha_pull`

**函数签名**:
```rust
#[tauri::command]
fn perform_ten_gacha_pull(app: AppHandle) -> Result<GachaResult, String>
```

**功能**:
- 打开数据库连接
- 调用 `perform_ten_gacha` 执行十连抽
- 返回抽卡结果或错误信息

**前端调用示例**:
```typescript
import { invoke } from '@tauri-apps/api/core';

try {
  const result = await invoke('perform_ten_gacha_pull');
  console.log('十连抽结果:', result);
  // result.operators: 获得的 10 个干员
  // result.pity_counter: 更新后的保底计数器
  // result.cost_currency: 消耗的货币
} catch (error) {
  console.error('十连抽失败:', error);
  // 可能的错误：合成玉不足
}
```

## 数据流程

```
用户发起十连抽请求
    ↓
验证合成玉余额 (>= 6000)
    ↓
加载保底计数器
    ↓
执行 10 次抽卡循环:
  - 调用概率计算函数
  - 选择随机干员
  - 更新保底计数器
  - 检查是否获得 5★ 或 6★
    ↓
检查十连保底:
  - 如果没有 5★ 或 6★
  - 将最后一个干员替换为 5★
    ↓
扣除 6000 合成玉
    ↓
保存所有干员到数据库
    ↓
更新货币余额
    ↓
更新保底计数器
    ↓
保存抽卡历史记录
    ↓
返回抽卡结果
```

## 错误处理

### 合成玉不足

**错误信息**:
```
合成玉不足，需要 6000 合成玉，当前仅有 {current} 合成玉
```

**处理方式**:
- 返回错误，不执行任何操作
- 货币余额不变
- 不添加任何干员
- 不记录抽卡历史

### 数据库错误

**可能的错误**:
- 加载货币余额失败
- 加载保底计数器失败
- 保存干员失败
- 更新货币余额失败
- 更新保底计数器失败
- 保存抽卡历史失败

**处理方式**:
- 返回详细的错误信息
- 包含错误来源和原因

## 性能考虑

### 批量操作

- 所有 10 个干员在一个事务中保存
- 减少数据库往返次数
- 提高性能和数据一致性

### 内存使用

- 干员池使用静态数据，不需要每次查询数据库
- 抽卡结果在内存中构建，最后一次性保存

## 未来改进

1. **可配置干员池**
   - 从配置文件或数据库加载干员池
   - 支持限定卡池和活动卡池

2. **抽卡动画**
   - 前端实现抽卡动画效果
   - 根据稀有度显示不同特效

3. **重复干员处理**
   - 检测重复干员
   - 自动提升潜能

4. **抽卡统计**
   - 统计各稀有度干员的获得概率
   - 显示抽卡运气分析

## 总结

十连抽功能已完整实现，包括：
- ✅ 货币验证和扣除
- ✅ 十连保底机制
- ✅ 保底计数器更新
- ✅ 数据持久化
- ✅ 完整的单元测试和集成测试
- ✅ Tauri 命令暴露给前端

所有测试通过，功能符合需求文档和设计文档的要求。
