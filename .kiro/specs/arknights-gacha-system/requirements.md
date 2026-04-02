# 需求文档：明日方舟抽卡养成系统

## 简介

本需求文档描述了明日方舟风格抽卡养成系统的功能需求。该系统将替换现有的"量子仓鼠"宠物系统，提供完整的干员抽卡、养成和奖励闭环机制。系统核心包括：1:1 复刻明日方舟的抽卡概率和保底机制、干员养成系统、货币资源管理、以及与番茄钟的奖励闭环。

## 术语表

- **System**: 明日方舟抽卡养成系统
- **Timer_Module**: 番茄钟计时器模块
- **Gacha_System**: 抽卡系统模块
- **Operator_System**: 干员养成系统模块
- **Currency_Manager**: 货币和资源管理器
- **AI_Module**: AI 功能模块
- **Database**: SQLite 数据库
- **Operator**: 干员，游戏中的可收集角色
- **Rarity**: 稀有度，分为 3★、4★、5★、6★
- **Pity_Counter**: 保底计数器，记录自上次获得6★以来的抽卡次数
- **Elite**: 精英化等级，分为 Elite 0、Elite 1、Elite 2
- **Potential**: 潜能，范围 1-6
- **Originite**: 源石，付费货币
- **Orundum**: 合成玉，抽卡货币
- **LMD**: 龙门币，养成货币
- **Focus_Session**: 专注会话，即一次番茄钟会话

## 需求

### 需求 1: 番茄钟计时器管理

**用户故事**: 作为用户，我想要使用番茄钟进行专注计时，以便完成工作任务并获得奖励。

#### 验收标准

1. WHEN 用户启动番茄钟 THEN THE Timer_Module SHALL 根据设置的模式（工作/休息）和计时方式（倒计时/正向计时）开始计时
2. WHEN 用户暂停番茄钟 THEN THE Timer_Module SHALL 保存当前状态并停止计时
3. WHEN 用户重置番茄钟 THEN THE Timer_Module SHALL 将计时器恢复到初始状态
4. WHEN 番茄钟倒计时结束 THEN THE Timer_Module SHALL 标记会话为已完成并触发奖励计算
5. WHEN 用户手动完成番茄钟 THEN THE Timer_Module SHALL 记录会话完成状态
6. THE Timer_Module SHALL 持续更新计时显示，确保用户看到实时的时间变化

### 需求 2: 抽卡概率计算

**用户故事**: 作为用户，我想要体验符合明日方舟标准的抽卡概率，以便获得公平的抽卡体验。

#### 验收标准

1. WHEN 保底计数器小于 50 THEN THE Gacha_System SHALL 使用 2% 的基础 6★ 概率
2. WHEN 保底计数器在 50 到 98 之间 THEN THE Gacha_System SHALL 使用 2% + 2% × (保底计数器 - 50) 的 6★ 概率
3. WHEN 保底计数器等于 99 THEN THE Gacha_System SHALL 保证下次抽卡必定获得 6★ 干员
4. THE Gacha_System SHALL 使用 8% 的 5★ 概率
5. THE Gacha_System SHALL 使用 50% 的 4★ 概率
6. THE Gacha_System SHALL 使用 40% 的 3★ 概率
7. WHEN 获得 6★ 干员 THEN THE Gacha_System SHALL 将保底计数器重置为 0
8. WHEN 获得非 6★ 干员 THEN THE Gacha_System SHALL 将保底计数器加 1

### 需求 3: 单次抽卡执行

**用户故事**: 作为用户，我想要执行单次抽卡，以便使用少量货币尝试获得干员。

#### 验收标准

1. WHEN 用户执行单次抽卡且合成玉大于等于 600 THEN THE Gacha_System SHALL 扣除 600 合成玉并执行一次抽卡
2. WHEN 用户执行单次抽卡且合成玉小于 600 THEN THE Gacha_System SHALL 拒绝抽卡并返回错误信息
3. WHEN 单次抽卡完成 THEN THE Gacha_System SHALL 根据概率和保底机制确定干员稀有度
4. WHEN 单次抽卡完成 THEN THE Gacha_System SHALL 从对应稀有度的干员池中随机选择一个干员
5. WHEN 单次抽卡完成 THEN THE Gacha_System SHALL 将获得的干员添加到用户收藏
6. WHEN 单次抽卡完成 THEN THE Gacha_System SHALL 更新保底计数器
7. WHEN 单次抽卡完成 THEN THE Gacha_System SHALL 保存抽卡历史记录

### 需求 4: 十连抽执行

**用户故事**: 作为用户，我想要执行十连抽，以便一次性获得多个干员并享受十连保底。

#### 验收标准

1. WHEN 用户执行十连抽且合成玉大于等于 6000 THEN THE Gacha_System SHALL 扣除 6000 合成玉并执行十次抽卡
2. WHEN 用户执行十连抽且合成玉小于 6000 THEN THE Gacha_System SHALL 拒绝抽卡并返回错误信息
3. WHEN 十连抽执行 THEN THE Gacha_System SHALL 连续执行 10 次抽卡计算
4. WHEN 十连抽完成且结果中没有 5★ 或 6★ 干员 THEN THE Gacha_System SHALL 将最后一个干员替换为随机 5★ 干员
5. WHEN 十连抽完成 THEN THE Gacha_System SHALL 返回包含 10 个干员的结果列表
6. WHEN 十连抽完成 THEN THE Gacha_System SHALL 更新保底计数器
7. WHEN 十连抽完成 THEN THE Gacha_System SHALL 保存抽卡历史记录

### 需求 5: 干员收藏管理

**用户故事**: 作为用户，我想要查看和管理我的干员收藏，以便了解我拥有的所有干员。

#### 验收标准

1. WHEN 用户查看干员收藏 THEN THE Operator_System SHALL 显示所有已获得的干员列表
2. WHEN 用户筛选干员 THEN THE Operator_System SHALL 支持按稀有度、职业、等级筛选
3. WHEN 用户排序干员 THEN THE Operator_System SHALL 支持按稀有度、等级、获得时间排序
4. WHEN 用户获得重复干员 THEN THE Operator_System SHALL 将该干员的潜能加 1
5. WHEN 干员潜能达到 6 THEN THE Operator_System SHALL 不再增加潜能并转换为其他奖励
6. THE Operator_System SHALL 显示每个干员的名称、稀有度、职业、等级、精英化阶段和潜能

### 需求 6: 干员等级提升

**用户故事**: 作为用户，我想要提升干员等级，以便增强干员能力。

#### 验收标准

1. WHEN 用户升级干员且资源充足 THEN THE Operator_System SHALL 扣除所需龙门币和经验值并将干员等级加 1
2. WHEN 用户升级干员且资源不足 THEN THE Operator_System SHALL 拒绝升级并返回错误信息
3. WHEN 干员处于 Elite 0 且等级达到 50 THEN THE Operator_System SHALL 阻止继续升级并提示需要精英化
4. WHEN 干员处于 Elite 1 且等级达到 70 THEN THE Operator_System SHALL 阻止继续升级并提示需要精英化
5. WHEN 干员处于 Elite 2 且等级达到 90 THEN THE Operator_System SHALL 阻止继续升级并提示已达到最高等级
6. WHEN 干员升级成功 THEN THE Operator_System SHALL 更新干员的最后升级时间
7. THE Operator_System SHALL 根据干员当前等级和稀有度计算升级所需资源

### 需求 7: 干员精英化

**用户故事**: 作为用户，我想要精英化干员，以便突破等级上限并提升干员能力。

#### 验收标准

1. WHEN 用户精英化干员且满足条件 THEN THE Operator_System SHALL 扣除所需资源并提升精英化等级
2. WHEN 用户精英化干员但等级未达到上限 THEN THE Operator_System SHALL 拒绝精英化并返回错误信息
3. WHEN 用户精英化干员但资源不足 THEN THE Operator_System SHALL 拒绝精英化并返回错误信息
4. WHEN 干员从 Elite 0 精英化到 Elite 1 THEN THE Operator_System SHALL 将干员等级重置为 1 并提升等级上限到 70
5. WHEN 干员从 Elite 1 精英化到 Elite 2 THEN THE Operator_System SHALL 将干员等级重置为 1 并提升等级上限到 90
6. WHEN 干员已处于 Elite 2 THEN THE Operator_System SHALL 阻止继续精英化
7. THE Operator_System SHALL 根据干员稀有度和目标精英化等级计算所需资源

### 需求 8: 会话奖励计算

**用户故事**: 作为用户，我想要在完成番茄钟后获得奖励，以便积累抽卡和养成资源。

#### 验收标准

1. WHEN 用户完成工作会话 THEN THE Currency_Manager SHALL 奖励合成玉、龙门币和经验值
2. WHEN 用户完成休息会话 THEN THE Currency_Manager SHALL 不奖励任何货币或资源
3. WHEN 用户完成 Boss 番茄钟 THEN THE Currency_Manager SHALL 奖励 200 合成玉、500 龙门币和 100 经验值
4. WHEN 用户完成普通番茄钟 THEN THE Currency_Manager SHALL 奖励 100 合成玉、300 龙门币和 50 经验值
5. WHEN 用户完成挑战 THEN THE Currency_Manager SHALL 额外奖励 50 合成玉和 200 龙门币
6. WHEN 用户未完成会话 THEN THE Currency_Manager SHALL 不奖励任何货币或资源
7. WHEN 奖励计算完成 THEN THE Currency_Manager SHALL 更新用户的货币和资源余额

### 需求 9: 货币和资源管理

**用户故事**: 作为用户，我想要管理我的货币和资源，以便进行抽卡和干员养成。

#### 验收标准

1. THE Currency_Manager SHALL 维护用户的源石、合成玉和龙门币余额
2. THE Currency_Manager SHALL 维护用户的经验值道具和芯片数量
3. WHEN 用户消费货币或资源 THEN THE Currency_Manager SHALL 验证余额是否充足
4. WHEN 余额不足 THEN THE Currency_Manager SHALL 拒绝操作并返回错误信息
5. WHEN 货币或资源变动 THEN THE Currency_Manager SHALL 更新数据库中的余额
6. THE Currency_Manager SHALL 确保所有货币和资源数量始终大于等于 0
7. WHEN 用户查询余额 THEN THE Currency_Manager SHALL 返回当前所有货币和资源的数量

### 需求 10: 抽卡历史记录

**用户故事**: 作为用户，我想要查看我的抽卡历史，以便了解我的抽卡记录和运气。

#### 验收标准

1. WHEN 用户执行抽卡 THEN THE Gacha_System SHALL 保存抽卡记录到数据库
2. WHEN 用户查看抽卡历史 THEN THE Gacha_System SHALL 显示所有历史抽卡记录
3. THE Gacha_System SHALL 记录每次抽卡的时间戳、类型（单抽/十连）、获得的干员、消耗的货币
4. THE Gacha_System SHALL 记录每次抽卡前后的保底计数器值
5. WHEN 用户筛选抽卡历史 THEN THE Gacha_System SHALL 支持按时间范围、稀有度筛选
6. THE Gacha_System SHALL 显示抽卡统计信息，包括总抽卡次数和各稀有度干员数量

### 需求 11: AI 干员分析

**用户故事**: 作为用户，我想要获得 AI 对我的干员配置的分析，以便优化队伍搭配。

#### 验收标准

1. WHEN 用户请求干员分析 THEN THE AI_Module SHALL 读取用户的所有干员数据
2. WHEN 用户请求干员分析 THEN THE AI_Module SHALL 调用通义千问 API 生成分析报告
3. WHEN AI 分析完成 THEN THE AI_Module SHALL 返回包含队伍搭配建议的文本
4. WHEN AI API 调用失败 THEN THE AI_Module SHALL 返回错误信息并提示用户稍后重试
5. THE AI_Module SHALL 在分析中考虑干员的稀有度、职业、等级和精英化阶段
6. THE AI_Module SHALL 提供具体的队伍搭配建议和理由

### 需求 12: AI 养成优先级推荐

**用户故事**: 作为用户，我想要获得 AI 对干员养成优先级的推荐，以便合理分配资源。

#### 验收标准

1. WHEN 用户请求养成推荐 THEN THE AI_Module SHALL 读取用户的干员数据和资源余额
2. WHEN 用户请求养成推荐 THEN THE AI_Module SHALL 调用通义千问 API 生成推荐列表
3. WHEN AI 推荐完成 THEN THE AI_Module SHALL 返回按优先级排序的干员养成建议
4. THE AI_Module SHALL 在推荐中考虑干员的稀有度、当前等级、精英化阶段和用户资源
5. THE AI_Module SHALL 为每个推荐提供理由说明
6. WHEN 用户资源不足以养成任何干员 THEN THE AI_Module SHALL 建议用户继续完成番茄钟获取资源

### 需求 13: 数据持久化

**用户故事**: 作为用户，我想要我的数据被安全保存，以便下次打开应用时能恢复状态。

#### 验收标准

1. THE Database SHALL 持久化存储所有干员数据
2. THE Database SHALL 持久化存储货币和资源余额
3. THE Database SHALL 持久化存储抽卡历史记录
4. THE Database SHALL 持久化存储保底计数器
5. THE Database SHALL 持久化存储番茄钟会话记录
6. WHEN 应用启动 THEN THE System SHALL 从数据库加载所有用户数据
7. WHEN 数据变更 THEN THE System SHALL 立即同步到数据库
8. WHEN 数据库操作失败 THEN THE System SHALL 记录错误日志并尝试重试

### 需求 14: 数据导入导出

**用户故事**: 作为用户，我想要导出和导入我的数据，以便备份或迁移到其他设备。

#### 验收标准

1. WHEN 用户导出数据 THEN THE System SHALL 将所有用户数据导出为 JSON 文件
2. WHEN 用户导入数据 THEN THE System SHALL 验证文件格式和数据完整性
3. WHEN 导入数据格式正确 THEN THE System SHALL 覆盖当前数据并重新加载
4. WHEN 导入数据格式错误 THEN THE System SHALL 拒绝导入并返回错误信息
5. THE System SHALL 在导出文件中包含校验和以验证数据完整性
6. WHEN 导入数据 THEN THE System SHALL 验证校验和是否匹配
7. THE System SHALL 在导入前提示用户当前数据将被覆盖

### 需求 15: 错误处理和恢复

**用户故事**: 作为用户，我想要系统能够优雅地处理错误，以便在出现问题时不会丢失数据。

#### 验收标准

1. WHEN 货币不足 THEN THE System SHALL 显示清晰的错误信息并指导用户如何获取货币
2. WHEN 资源不足 THEN THE System SHALL 显示所需资源数量和获取途径
3. WHEN 等级达到上限 THEN THE System SHALL 提示用户进行精英化
4. WHEN AI API 调用失败 THEN THE System SHALL 显示错误信息并提供重试选项
5. WHEN 数据库操作失败 THEN THE System SHALL 记录详细错误日志
6. WHEN 数据损坏 THEN THE System SHALL 尝试修复或提示用户导入备份
7. THE System SHALL 确保所有错误都不会导致应用崩溃
8. THE System SHALL 在关键操作前验证前置条件以避免错误状态
