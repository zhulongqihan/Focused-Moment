# 明日方舟抽卡养成系统 - 数据模型和数据库架构

## 概述

本模块实现了明日方舟风格的抽卡养成系统的核心数据模型和数据库架构，包括：

- **TypeScript 类型定义**：前端使用的类型接口
- **Rust 数据模型**：后端数据结构和验证逻辑
- **SQLite 数据库架构**：持久化存储方案
- **数据库迁移脚本**：自动初始化和升级

## 文件结构

```
src/lib/types/
  └── gacha.ts              # TypeScript 类型定义

src-tauri/src/gacha/
  ├── mod.rs                # 模块导出
  ├── models.rs             # Rust 数据模型
  ├── database.rs           # 数据库操作
  ├── MIGRATION.md          # 数据库迁移文档
  └── README.md             # 本文档
```

## 核心数据模型

### 1. Operator（干员）

**TypeScript**:
```typescript
interface Operator {
  id: string;
  name: string;
  rarity: number;              // 3-6
  class: OperatorClass;
  level: number;               // 1-90
  elite: number;               // 0-2
  experience: number;
  potential: number;           // 1-6
  obtainedAt: number;
  lastUpgradedAt: number;
}
```

**Rust**:
```rust
pub struct Operator {
    pub id: String,
    pub name: String,
    pub rarity: u8,
    pub class: OperatorClass,
    pub level: u8,
    pub elite: u8,
    pub experience: u32,
    pub potential: u8,
    pub obtained_at: i64,
    pub last_upgraded_at: i64,
}
```

**验证规则**:
- rarity: 3-6
- level: 1-90（受 elite 限制）
- elite: 0-2
- potential: 1-6
- Elite 0: level ≤ 50
- Elite 1: level ≤ 70
- Elite 2: level ≤ 90

### 2. Currency（货币）

**TypeScript**:
```typescript
interface Currency {
  originite: number;           // 源石
  orundum: number;             // 合成玉
  lmd: number;                 // 龙门币
}
```

**Rust**:
```rust
pub struct Currency {
    pub originite: u32,
    pub orundum: u32,
    pub lmd: u32,
}
```

**操作方法**:
- `has_enough()`: 检查货币是否充足
- `subtract()`: 扣除货币
- `add()`: 增加货币

### 3. Resources（资源）

**TypeScript**:
```typescript
interface Resources {
  lmd: number;
  exp: number;
  chips: Record<string, number>;
}
```

**Rust**:
```rust
pub struct Resources {
    pub lmd: u32,
    pub exp: u32,
    pub chips: HashMap<String, u32>,
}
```

**操作方法**:
- `has_enough()`: 检查资源是否充足
- `subtract()`: 扣除资源
- `add()`: 增加资源

### 4. GachaResult（抽卡结果）

**TypeScript**:
```typescript
interface GachaResult {
  operators: Operator[];
  pityCounter: number;
  costCurrency: Currency;
}
```

**Rust**:
```rust
pub struct GachaResult {
    pub operators: Vec<Operator>,
    pub pity_counter: u32,
    pub cost_currency: Currency,
}
```

### 5. GachaHistory（抽卡历史）

**TypeScript**:
```typescript
interface GachaHistory {
  id: string;
  timestamp: number;
  gachaType: 'single' | 'ten';
  operators: Operator[];
  costCurrency: Currency;
  pityCounterBefore: number;
  pityCounterAfter: number;
}
```

**Rust**:
```rust
pub struct GachaHistory {
    pub id: String,
    pub timestamp: i64,
    pub gacha_type: GachaType,
    pub operators: Vec<Operator>,
    pub cost_currency: Currency,
    pub pity_counter_before: u32,
    pub pity_counter_after: u32,
}
```

## 数据库架构

### 表结构

1. **operators**: 存储干员数据
2. **gacha_history**: 存储抽卡历史
3. **currency**: 存储货币余额（单行表）
4. **resources**: 存储资源余额（单行表）
5. **gacha_state**: 存储抽卡状态（单行表）

详细表结构请参考 [MIGRATION.md](./MIGRATION.md)。

### 索引

- `idx_operators_rarity`: 按稀有度索引
- `idx_operators_class`: 按职业索引
- `idx_operators_level`: 按等级索引
- `idx_gacha_history_timestamp`: 按时间戳降序索引

## 数据库操作 API

### 初始化

```rust
use gacha::database::initialize_gacha_database;

let conn = Connection::open("database.db")?;
initialize_gacha_database(&conn)?;
```

### 干员操作

```rust
// 保存干员
save_operator(&conn, &operator)?;

// 加载所有干员
let operators = load_operators(&conn)?;
```

### 货币操作

```rust
// 更新货币
update_currency(&conn, &currency)?;

// 加载货币
let currency = load_currency(&conn)?;
```

### 资源操作

```rust
// 更新资源
update_resources(&conn, &resources)?;

// 加载资源
let resources = load_resources(&conn)?;
```

### 保底计数器操作

```rust
// 更新保底计数器
update_pity_counter(&conn, 50)?;

// 加载保底计数器
let counter = load_pity_counter(&conn)?;
```

### 抽卡历史操作

```rust
// 保存抽卡历史
save_gacha_history(&conn, &history)?;

// 加载最近的抽卡历史（限制数量）
let histories = load_gacha_history(&conn, 100)?;
```

### 加载完整状态

```rust
// 一次性加载所有抽卡系统状态
let state = load_gacha_system_state(&conn)?;
```

## 数据验证

### Rust 层验证

所有数据模型都实现了验证逻辑：

```rust
let operator = Operator { /* ... */ };
operator.validate()?;  // 验证数据有效性
```

验证内容：
- 稀有度范围（3-6）
- 等级范围（1-90）
- 精英化阶段（0-2）
- 潜能范围（1-6）
- 等级上限约束

### 数据库层约束

使用 SQL CHECK 约束确保数据完整性：

```sql
CHECK(rarity >= 3 AND rarity <= 6)
CHECK(level >= 1 AND level <= 90)
CHECK(elite >= 0 AND elite <= 2)
CHECK(potential >= 1 AND potential <= 6)
```

## 测试

### 运行测试

```bash
# 运行所有 gacha 模块测试
cargo test --lib gacha

# 运行特定测试
cargo test --lib gacha::models::tests
cargo test --lib gacha::database::tests
```

### 测试覆盖

**models.rs**:
- ✅ 干员数据验证
- ✅ 货币操作（检查、扣除、增加）
- ✅ 资源操作（检查、扣除、增加）

**database.rs**:
- ✅ 数据库初始化
- ✅ 干员保存和加载
- ✅ 货币更新和加载
- ✅ 保底计数器操作

## 性能考虑

### 查询优化

1. **索引策略**: 为常用查询字段建立索引
2. **分页加载**: 干员列表使用分页，避免一次加载所有数据
3. **限制历史**: 抽卡历史默认只加载最近100条
4. **预编译语句**: 使用 prepared statements 提高查询效率

### 内存优化

1. **按需加载**: 只在需要时加载完整数据
2. **JSON 存储**: chips 和 operators（在 history 中）使用 JSON 格式，节省表结构
3. **单行表**: currency、resources、gacha_state 使用单行表设计，简化查询

## 集成到应用

### 在 lib.rs 中集成

```rust
mod gacha;
pub use gacha::*;

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(path)?;
    
    // 初始化抽卡系统数据库
    gacha::database::initialize_gacha_database(&conn)?;
    
    Ok(conn)
}
```

### 前端使用

```typescript
import type { Operator, Currency, GachaResult } from '$lib/types/gacha';
import { OperatorClass } from '$lib/types/gacha';

// 使用类型
const operator: Operator = {
  id: 'op_001',
  name: '阿米娅',
  rarity: 5,
  class: OperatorClass.CASTER,
  // ...
};
```

## 需求映射

本实现满足以下需求：

- **需求 5.6**: 干员收藏管理 - 干员数据模型和存储
- **需求 13.1**: 数据持久化 - 干员数据持久化
- **需求 13.2**: 数据持久化 - 货币和资源持久化
- **需求 13.4**: 数据持久化 - 保底计数器持久化

## 下一步

完成数据模型和数据库架构后，下一步可以实现：

1. **抽卡系统逻辑** (Task 2): 概率计算、保底机制
2. **干员养成系统** (Task 3): 升级、精英化逻辑
3. **货币奖励系统** (Task 4): 番茄钟奖励计算
4. **前端界面** (Task 5): 抽卡界面、干员列表

## 参考资料

- [设计文档](../../../.kiro/specs/arknights-gacha-system/design.md)
- [需求文档](../../../.kiro/specs/arknights-gacha-system/requirements.md)
- [数据库迁移文档](./MIGRATION.md)
