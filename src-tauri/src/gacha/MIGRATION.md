# 抽卡系统数据库迁移说明

## 概述

本文档描述了明日方舟抽卡养成系统的数据库架构和迁移策略。

## 数据库表结构

### 1. operators（干员表）

存储用户拥有的所有干员数据。

```sql
CREATE TABLE operators (
    id TEXT PRIMARY KEY,                    -- 干员唯一标识
    name TEXT NOT NULL,                     -- 干员名称
    rarity INTEGER NOT NULL                 -- 稀有度 3-6
        CHECK(rarity >= 3 AND rarity <= 6),
    class TEXT NOT NULL,                    -- 职业（JSON格式）
    level INTEGER NOT NULL                  -- 当前等级 1-90
        CHECK(level >= 1 AND level <= 90),
    elite INTEGER NOT NULL                  -- 精英化阶段 0-2
        CHECK(elite >= 0 AND elite <= 2),
    experience INTEGER NOT NULL DEFAULT 0,  -- 当前经验值
    potential INTEGER NOT NULL              -- 潜能 1-6
        CHECK(potential >= 1 AND potential <= 6),
    obtained_at INTEGER NOT NULL,           -- 获得时间（Unix时间戳）
    last_upgraded_at INTEGER NOT NULL       -- 最后养成时间（Unix时间戳）
);

-- 索引
CREATE INDEX idx_operators_rarity ON operators(rarity);
CREATE INDEX idx_operators_class ON operators(class);
CREATE INDEX idx_operators_level ON operators(level);
```

**字段说明**：
- `id`: 干员唯一标识，格式如 "op_001"
- `name`: 干员名称，如 "阿米娅"
- `rarity`: 稀有度，3-6星
- `class`: 职业，存储为JSON字符串，如 "\"GUARD\""
- `level`: 当前等级，受精英化阶段限制
- `elite`: 精英化阶段，0/1/2
- `experience`: 累计经验值
- `potential`: 潜能，1-6
- `obtained_at`: 获得时间戳
- `last_upgraded_at`: 最后养成时间戳

**约束**：
- Elite 0: level ≤ 50
- Elite 1: level ≤ 70
- Elite 2: level ≤ 90

### 2. gacha_history（抽卡历史表）

记录所有抽卡历史。

```sql
CREATE TABLE gacha_history (
    id TEXT PRIMARY KEY,                    -- 历史记录唯一标识
    timestamp INTEGER NOT NULL,             -- 抽卡时间（Unix时间戳）
    gacha_type TEXT NOT NULL                -- 抽卡类型 'single' 或 'ten'
        CHECK(gacha_type IN ('single', 'ten')),
    operators TEXT NOT NULL,                -- 获得的干员列表（JSON数组）
    cost_currency TEXT NOT NULL,            -- 消耗的货币（JSON对象）
    pity_counter_before INTEGER NOT NULL,   -- 抽卡前保底计数器
    pity_counter_after INTEGER NOT NULL     -- 抽卡后保底计数器
);

-- 索引
CREATE INDEX idx_gacha_history_timestamp ON gacha_history(timestamp DESC);
```

**字段说明**：
- `id`: 历史记录唯一标识
- `timestamp`: 抽卡时间戳
- `gacha_type`: 'single'（单抽）或 'ten'（十连）
- `operators`: JSON数组，包含获得的所有干员
- `cost_currency`: JSON对象，记录消耗的货币
- `pity_counter_before/after`: 抽卡前后的保底计数器值

### 3. currency（货币表）

存储用户的货币余额。

```sql
CREATE TABLE currency (
    id INTEGER PRIMARY KEY CHECK(id = 1),   -- 固定为1，单行表
    originite INTEGER NOT NULL DEFAULT 0,   -- 源石
    orundum INTEGER NOT NULL DEFAULT 0,     -- 合成玉
    lmd INTEGER NOT NULL DEFAULT 0,         -- 龙门币
    updated_at INTEGER NOT NULL             -- 更新时间（Unix时间戳）
);
```

**字段说明**：
- `id`: 固定为1，确保只有一行数据
- `originite`: 源石（付费货币）
- `orundum`: 合成玉（抽卡货币）
- `lmd`: 龙门币（养成货币）
- `updated_at`: 最后更新时间

**初始值**：所有货币初始为0

### 4. resources（资源表）

存储用户的养成资源。

```sql
CREATE TABLE resources (
    id INTEGER PRIMARY KEY CHECK(id = 1),   -- 固定为1，单行表
    lmd INTEGER NOT NULL DEFAULT 0,         -- 龙门币
    exp INTEGER NOT NULL DEFAULT 0,         -- 经验值道具
    chips TEXT NOT NULL DEFAULT '{}',       -- 芯片（JSON对象）
    updated_at INTEGER NOT NULL             -- 更新时间（Unix时间戳）
);
```

**字段说明**：
- `id`: 固定为1，确保只有一行数据
- `lmd`: 龙门币数量
- `exp`: 经验值道具数量
- `chips`: JSON对象，存储各类芯片数量，如 `{"guard": 10, "caster": 5}`
- `updated_at`: 最后更新时间

**初始值**：所有资源初始为0，chips为空对象 `{}`

### 5. gacha_state（抽卡状态表）

存储抽卡系统的全局状态。

```sql
CREATE TABLE gacha_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),   -- 固定为1，单行表
    pity_counter INTEGER NOT NULL DEFAULT 0, -- 保底计数器
    updated_at INTEGER NOT NULL             -- 更新时间（Unix时间戳）
);
```

**字段说明**：
- `id`: 固定为1，确保只有一行数据
- `pity_counter`: 当前保底计数器值（自上次获得6星以来的抽卡次数）
- `updated_at`: 最后更新时间

**初始值**：pity_counter 初始为0

## 数据迁移策略

### 自动初始化

数据库表在应用首次启动时自动创建。初始化流程：

1. 检查表是否存在，不存在则创建
2. 创建必要的索引
3. 初始化默认数据（货币、资源、抽卡状态）

### 数据完整性

所有关键操作都包含事务支持，确保数据一致性：

- 抽卡操作：扣除货币 → 生成干员 → 更新保底计数器 → 保存历史
- 养成操作：扣除资源 → 更新干员数据
- 奖励发放：更新货币 → 更新资源

### 备份和恢复

数据库文件位置：`{APP_DATA_DIR}/focused_moment.db`

备份策略：
1. 应用提供数据导出功能（JSON格式）
2. 用户可手动备份数据库文件
3. 导入时验证数据完整性

## 性能优化

### 索引策略

- `operators` 表：按 rarity、class、level 建立索引，优化筛选和排序
- `gacha_history` 表：按 timestamp 降序索引，优化历史查询

### 查询优化

- 干员列表：使用分页加载，避免一次加载所有数据
- 抽卡历史：限制查询数量（默认最近100条）
- 使用预编译语句（prepared statements）提高查询效率

## 数据验证

### 应用层验证

Rust 模型层实现了完整的数据验证：

```rust
impl Operator {
    pub fn validate(&self) -> Result<(), String> {
        // 验证稀有度、等级、精英化阶段、潜能
        // 验证等级上限约束
    }
}
```

### 数据库层约束

使用 SQL CHECK 约束确保数据有效性：

- 稀有度：3-6
- 等级：1-90
- 精英化：0-2
- 潜能：1-6
- 抽卡类型：'single' 或 'ten'

## 测试

数据库模块包含完整的单元测试：

```bash
cargo test --package focused-moment --lib gacha::database::tests
```

测试覆盖：
- 数据库初始化
- 干员保存和加载
- 货币操作
- 资源操作
- 保底计数器
- 抽卡历史

## 未来扩展

预留扩展空间：

1. **干员技能表**：存储干员技能数据
2. **基建系统表**：存储基建设施和产出
3. **关卡系统表**：存储关卡进度和奖励
4. **好友系统表**：存储好友关系和互动

## 注意事项

1. **单行表设计**：currency、resources、gacha_state 使用单行表设计（id固定为1），简化查询和更新
2. **JSON存储**：chips、operators（在history中）使用JSON格式存储，提供灵活性
3. **时间戳**：所有时间使用Unix时间戳（秒），便于跨平台兼容
4. **事务安全**：关键操作使用事务确保原子性
5. **索引维护**：定期检查索引效率，必要时重建索引

## 版本历史

- **v1.0** (2024-04-02): 初始版本，包含基础抽卡系统表结构
