# Task 15.3 Integration Test Plan

## 测试目标
验证番茄钟完成后能够正确调用奖励系统并显示奖励信息

## 测试步骤

### 1. 普通番茄钟测试
1. 启动应用
2. 开始一个普通工作番茄钟（非Boss）
3. 等待番茄钟完成或手动完成
4. **预期结果**：
   - 界面显示奖励信息："番茄钟完成！获得：100合成玉、300龙门币、50经验值！"
   - 后台数据库中合成玉增加100
   - 后台数据库中龙门币增加300
   - 后台数据库中经验值增加50

### 2. Boss番茄钟测试
1. 完成足够的番茄钟使下一个成为Boss番茄钟
2. 开始Boss番茄钟
3. 完成番茄钟
4. **预期结果**：
   - 界面显示奖励信息："Boss番茄钟完成！获得：200合成玉、500龙门币、100经验值！"
   - 后台数据库中合成玉增加200
   - 后台数据库中龙门币增加500
   - 后台数据库中经验值增加100

### 3. 挑战完成测试
1. 开始一个普通番茄钟并接受挑战
2. 完成番茄钟且不违反挑战规则
3. **预期结果**：
   - 界面显示奖励信息包含挑战奖励："...，挑战完成额外奖励：+50合成玉、+200龙门币！"
   - 合成玉额外增加50
   - 龙门币额外增加200

### 4. 休息会话测试
1. 完成一个工作番茄钟后进入休息模式
2. 完成休息番茄钟
3. **预期结果**：
   - 不显示奖励信息（或显示"未完成工作会话，无奖励"）
   - 数据库中货币和资源不变

### 5. 未完成会话测试
1. 开始一个工作番茄钟
2. 中途跳过或重置
3. **预期结果**：
   - 不显示奖励信息
   - 数据库中货币和资源不变

## 验证方法

### 前端验证
- 观察界面上的 `currentTip` 提示信息
- 检查提示信息是否包含正确的奖励数量

### 后端验证
使用 Tauri 命令查询货币和资源：
```javascript
// 在浏览器控制台执行
await invoke('get_currency')
await invoke('get_resources_balance')
```

### 数据库验证
直接查询 SQLite 数据库：
```sql
SELECT * FROM currency;
SELECT * FROM resources;
```

## 实现细节

### 代码修改
- 文件：`src/routes/+page.svelte`
- 函数：`finishSession`
- 修改内容：
  1. 将函数改为 `async`
  2. 在完成工作会话时调用 `complete_focus_session` 命令
  3. 使用返回的 `message` 更新 `currentTip`
  4. 保留旧的宠物系统以保持向后兼容

### 后端命令
- 命令名：`complete_focus_session`
- 参数：
  - `mode`: "work" | "break"
  - `isBoss`: boolean
  - `challengeCompleted`: boolean
- 返回：
  ```typescript
  {
    earned_currency: { orundum: number },
    earned_resources: { lmd: number, exp: number },
    message: string
  }
  ```

## 测试结果

### 单元测试
✅ 所有后端单元测试通过（8个测试）
- test_normal_work_session_rewards
- test_boss_work_session_rewards
- test_challenge_completed_bonus
- test_break_session_no_rewards
- test_incomplete_session_no_rewards
- test_apply_rewards_to_database
- test_multiple_sessions_accumulate
- test_boss_and_challenge_combined

### 类型检查
✅ TypeScript 类型检查通过
- 无编译错误
- 仅有未使用CSS选择器的警告（不影响功能）

### 集成测试
⏳ 待手动测试
- 需要启动完整应用进行端到端测试
- 验证前端和后端的完整交互

## 需求验证

本任务验证以下需求：

### 需求 1.4
✅ "WHEN 番茄钟倒计时结束 THEN THE Timer_Module SHALL 标记会话为已完成并触发奖励计算"
- 实现：在 `finishSession` 中调用 `complete_focus_session`

### 需求 1.5
✅ "WHEN 用户手动完成番茄钟 THEN THE Timer_Module SHALL 记录会话完成状态"
- 实现：`finishSession` 函数处理手动完成和自动完成

### 需求 8.7
✅ "WHEN 奖励计算完成 THEN THE Currency_Manager SHALL 更新用户的货币和资源余额"
- 实现：`apply_session_rewards` 函数更新数据库

## 注意事项

1. **向后兼容**：保留了旧的宠物XP系统，确保现有用户数据不受影响
2. **错误处理**：如果奖励系统调用失败，会回退到显示传统提示信息
3. **异步处理**：`finishSession` 改为异步函数以支持 Tauri 命令调用
4. **消息显示**：使用后端返回的 `message` 字段直接显示给用户

## 下一步

1. 启动开发服务器进行手动测试
2. 验证所有测试场景
3. 如有问题，根据测试结果进行调整
4. 完成后标记任务为已完成
