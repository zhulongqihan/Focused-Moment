---
inclusion: auto
---

# Focused Moment 开发工作流程

## 🔴 关键规则（必须遵守）

### 1. 所有修改必须记录到用户反馈文档
- 文件路径：`docs/用户反馈.md`
- 每次修改代码后，必须立即更新此文档
- 记录内容包括：
  * 问题描述
  * 修复方案
  * 测试结果
  * 版本号
  * 状态（成功/失败）

### 2. 所有修改必须同步到GitHub
- 每次更新反馈文档后，必须执行：
  ```bash
  git add -f docs/用户反馈.md
  git commit -m "docs: [描述修改内容]"
  git push origin main
  ```

### 3. 版本号管理
- Bug修复：递增修订号（0.11.X）
- 新功能：递增次版本号（0.X.0）
- 必须同时更新：
  * `package.json`
  * `src-tauri/tauri.conf.json`
  * `src/routes/+page.svelte`（设置页面中的版本显示）

### 4. 构建和发布流程（必须严格遵守）
1. 修改代码
2. 更新版本号（3个文件）
3. 在开发模式测试：`npm run tauri dev`
4. 确认功能正常后，构建release版本：
   ```bash
   cd src-tauri
   cargo build --release
   cd ..
   ```
5. **重要：复制exe到根目录**（不要忘记这一步！）
   ```bash
   Copy-Item "src-tauri\target\release\focused-moment.exe" "Focused-Moment-vX.X.X.exe" -Force
   ```
6. 验证exe文件在根目录：
   ```bash
   Get-ChildItem -Path . -Filter "Focused-Moment-v*.exe"
   ```
7. 更新用户反馈文档
8. 提交到git并推送到GitHub

### 5. 测试规则
- 重大修改必须先在开发模式测试：`npm run tauri dev`
- 确认功能正常后再构建生产版本
- 如果生产版本有问题，立即回滚并记录失败原因

## 📋 当前已知问题

### 正向计时完成按钮奖励不发放（高优先级）
- **问题**：点击"完成"按钮后时间停住，但奖励没有到账
- **影响版本**：v0.11.4及之前
- **尝试的修复**：v0.11.5重构失败，导致应用无法打开
- **状态**：未解决，需要重新设计解决方案
- **可能的解决方向**：
  1. 仔细检查finishSession函数的调用链
  2. 确保timerStartedAt在正向计时模式下正确设置
  3. 验证后端complete_focus_session命令是否被正确调用
  4. 添加详细的日志输出来追踪问题

## 🔧 开发环境命令

### 启动开发服务器
```bash
npm run dev
```

### 启动Tauri开发模式
```bash
npm run tauri dev
```

### 构建生产版本
```bash
cd src-tauri
cargo build --release
cd ..
Copy-Item "src-tauri\target\release\focused-moment.exe" "Focused-Moment-vX.X.X.exe"
```

### Git操作
```bash
# 查看状态
git status

# 添加文件
git add -f docs/用户反馈.md

# 提交
git commit -m "描述"

# 推送
git push origin main

# 回滚文件
git checkout HEAD -- <file>
```

## 📝 代码修改注意事项

### 前端（Svelte）
- 状态管理使用 `$state` rune
- async函数调用要正确处理
- 计时器相关函数要特别小心，涉及多个状态变量

### 后端（Rust）
- 所有命令必须在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中注册
- 数据库操作要处理错误
- 奖励计算逻辑在 `src-tauri/src/timer/rewards.rs`

## 🎯 下一步计划

1. 修复正向计时完成按钮bug（高优先级）
2. 实现真实的委托检测逻辑（中优先级）
3. 优化UI和用户体验（低优先级）
