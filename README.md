# Focused Moment

Focused Moment 是一款面向 Windows 桌面的轻量效率助手，围绕“精准计时、任务追踪、数据复盘”三条主线逐步构建。项目采用严格的增量开发方式，每个版本都要求可运行、可测试、可回滚。

## 当前进度

当前版本：`v0.8.2`

已完成：
- 无边框主窗口与全中文基础界面
- Rust 驱动的正向计时与番茄钟
- 后台运行与系统休眠恢复后的时间校正
- 任务清单基础 CRUD
- 任务属性：日期、开始时间、重要程度
- 独立专注事件与任务关联
- 任务与专注记录的本地持久化
- 主界面多分区结构：计时、待办、数据复盘、扩展预留
- 数据中心基础版：本地聚合汇总、按日复盘、最近专注趋势
- 轻量趋势视图：按日折线趋势、聚焦卡片、柱状对比与最近节奏可视化
- 窗口交互修订：增强无边框窗口拖动稳定性，修正版本化导出流程
- 根目录导出调试版 `.exe` 的固定流程

当前 `v0.6.0` 已明确采用“单窗口分区”方案，不再继续推进独立悬浮任务窗，优先保证稳定性和可维护性。

下一步：
- `v0.9.0` 后台常驻与托盘体验

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

## 构建与导出

生成调试版桌面程序并导出到根目录：

```bash
pnpm package:debug
```

执行完成后，根目录会出现：
- `Focused Moment.exe`
- `Focused Moment vX.Y.Z.exe`
- `Focused Moment Setup.exe`（如果本次构建生成了安装包）
- `Focused Moment Setup vX.Y.Z.exe`

如果旧文件正在运行中，导出脚本还会自动额外生成带时间戳的版本文件，避免覆盖失败。

## 开发约定

- 只在 `main` 分支上开发
- 版本号统一采用 `v0.X.Y`
- 每次只推进一个版本目标
- 当前版本验收通过后，才进入下一版
- 每个版本通过后都执行本地提交与 SSH 推送
- 提交信息使用版本号命名，并补充中文说明帮助理解改动内容

## 文档说明

`docs/` 目录只保留在本地，不上传到 GitHub。

推荐结构：
- `docs/vX.X.Y/plan.md`
- `docs/vX.X.Y/test.md`
- `docs/vX.X.Y/notes.md`
- `docs/user-feedback.md`
