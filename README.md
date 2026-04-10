# Focused Moment

Focused Moment 是一款面向 Windows 的轻量级桌面效率助手，围绕“精准计时、事务跟踪、数据复盘”三个核心能力展开。项目采用严格的版本式增量开发，每一版都要求可运行、可测试、可回滚。

## 项目目标

- 提供正向计时与番茄钟两种专注模式
- 支持围绕事务进行专注与记录
- 提供可剥离的任务悬浮窗
- 在本地沉淀每日专注数据与简洁统计
- 保持低内存占用、低干扰、可扩展

## 当前进度

当前版本：`v0.3`

已完成：

- `Tauri 2 + Rust + SolidJS` 桌面基础架构
- 自定义无边框主窗口
- 全中文基础界面
- Rust 驱动的正向计时
- 番茄钟模式
- 后台运行与系统休眠恢复后的双时钟时间校正
- 本地 `docs/` 文档与用户反馈记录流程

下一步：

- `v0.4` 任务清单基础版

## 技术栈

- Tauri 2
- Rust
- SolidJS
- TypeScript
- Vite

## 本地运行

安装依赖：

```bash
pnpm install
```

启动桌面开发环境：

```bash
pnpm tauri dev
```

前端类型检查：

```bash
pnpm check
```

Rust 检查：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

前端构建：

```bash
pnpm build
```

## 开发约定

- 只在 `main` 分支上开发
- 每次只推进一个版本目标
- 当前版本验收通过后，才进入下一版本
- 每个版本通过后都执行本地提交和 SSH 推送
- 提交时使用版本号命名，并补充一段中文说明，帮助快速理解本次改动

## 文档说明

`docs/` 目录仅保留在本地，不上传到 GitHub。

- `docs/vX.X/plan.md`
- `docs/vX.X/test.md`
- `docs/vX.X/notes.md`
- `docs/user-feedback.md`
