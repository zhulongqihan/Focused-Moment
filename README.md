# Focused Moment

> 一个本地优先的 Windows / macOS 专注工具：从下一件待办开始，专注一段时间，最后看见自己留下的节奏。

[![Latest Release](https://img.shields.io/github/v/release/zhulongqihan/Focused-Moment?display_name=tag&style=flat-square)](https://github.com/zhulongqihan/Focused-Moment/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/zhulongqihan/Focused-Moment/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zhulongqihan/Focused-Moment/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20Universal-173f2e?style=flat-square)](https://github.com/zhulongqihan/Focused-Moment/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-cb6d4b?style=flat-square)](https://github.com/zhulongqihan/Focused-Moment)

Focused Moment 适合需要长期保留待办和专注记录、但不想使用复杂项目管理系统的人。它把路径压缩成几步：写下要做的事，开始专注，在桌面上保持状态，完成后留下记录，再回看自己的投入。

## 预览

| 今日驾驶舱 | 专注计时 |
| --- | --- |
| ![今日驾驶舱](./安静开始.png) | ![专注计时](./专注计时.png) |

| 待办管理 | 时间档案 |
| --- | --- |
| ![待办管理](./管理待办.png) | ![时间档案](./状态复盘.png) |

## 主要功能

- **今日**：查看当前状态、下一件待办和当天已经留下的进展。
- **待办**：创建带截止日期的事项，设置时间和重要程度，编辑、完成、撤销或直接带入专注。
- **计时**：支持正向计时和 1–720 分钟倒计时；可以开始、暂停、继续、重置，并在完成后保存记录。
- **悬浮工作台**：把待办和当前计时放到桌面上的置顶窗口中，支持待办/当前计时 Tab、拖动和锁定操作。
- **记录**：查看连续投入、累计时长、活跃天数、最佳单日和最近 7 日节奏。
- **设置**：配置提醒方式、自定义声音、外观主题、本地备份与恢复。
- **每日一句**：内置本地语料库，按日期稳定选择；英文条目附带中文译文与来源信息。
- **本地优先**：待办、记录、运行态和设置留在本机，不要求注册账号。

## 当前版本说明

当前稳定版本是 [v2.10.10](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.10)。本版本完成五套主题、五个 Tab 的逐页用户式体验复核：切换页面会回到新页面顶部，记录页不再展示未接入的导出/日期筛选占位，移动导航和七日图表日期点在窄窗口下仍可用；同时保留 Night Valley 计时页已验证的悬浮工作台、暂停/继续、完成保存、窗口尺寸和重启读取能力。全屏说明限定为无边框窗口的全屏几何与布局适配，当前没有独立的 F11 切换命令。

## 下载与安装

前往 [最新 Release](https://github.com/zhulongqihan/Focused-Moment/releases/latest)，按平台选择：

| 文件 | 适合谁 | 说明 |
| --- | --- | --- |
| `Focused.Moment.Setup.*.exe` | 大多数 Windows 用户 | 推荐的标准安装程序，安装后可从开始菜单启动。 |
| `Focused.Moment_*.msi` | 企业部署或习惯 MSI 的用户 | Windows Installer 包。 |
| `Focused.Moment.*.exe` | 便携使用 | 单文件版本，可直接运行，不需要安装。 |
| `Focused.Moment_*_universal.dmg` | macOS 用户 | Universal 磁盘映像，同时支持 Apple 芯片和 Intel Mac。 |

运行版已经包含前端资源和 Rust 核心，普通用户不需要安装 Node.js、Rust、pnpm 或下载源码。

如果 Windows SmartScreen 提示未签名，请先确认文件来自本仓库的 [Release 页面](https://github.com/zhulongqihan/Focused-Moment/releases)，再按系统提示继续。macOS 发布包目前未使用 Apple Developer 证书签名；首次打开被系统拦截时，在 Finder 中按住 Control 点击应用，选择“打开”并确认一次即可。

## 快速开始

1. 在“待办”写下事项、截止日期和重要程度。
2. 打开“计时”，选择正向计时或倒计时，填写本轮事项。
3. 点击“开始”，按需要暂停、继续或完成。
4. 完成后保存记录，在“记录”页面回看投入。
5. 需要桌面陪伴时打开悬浮工作台，在“待办”和“当前计时”之间切换。

### 悬浮工作台

- 有活动计时时，工作台可以显示“当前计时”；没有活动计时时显示待办。
- 顶部 Tab 用于切换待办和当前计时。
- 拖动标题区域可以移动窗口。
- 点击锁图标可开启鼠标穿透，再通过独立的小锁恢复操作。
- 计时状态由应用运行态保存；运行中可从悬浮计时返回主界面，并从计时卡片标题栏再次进入悬浮窗。关闭应用前请等待保存反馈，并保留本地备份以便迁移或恢复。

## 数据、备份与隐私

Windows 使用 `%LOCALAPPDATA%\FocusedMoment`，macOS 使用 `~/Library/Application Support/FocusedMoment`。应用数据包括：

- 待办、专注记录和运行中的计时状态；
- `focused-moment-state.json`、`focused-moment-runtime.json` 及其快照备份；
- “Focused Moment Backups” 文件夹中的应用内导出备份；
- 自定义声音等本地设置。

迁移到新电脑时，推荐使用应用内流程：

1. 在旧电脑的“设置”中导出本地备份。
2. 将备份 JSON 文件复制到新电脑。
3. 安装应用后，在“设置”中导入备份。

应用会在导入前保留回滚备份，并支持从旧格式迁移。不要手动修改 JSON；如果导入失败，保留原文件并先复制一份再重试。应用核心功能不要求网络，也不会自动上传待办、记录或备份；自定义声音只保存在本机。

## 从源码构建

继续开发前请先阅读根目录的 [AGENTS.md](./AGENTS.md) 和 [项目总览与持续执行计划](./PROJECT_PLAN.md)。

### 环境要求

- Windows x64 或 macOS
- Node.js 22+
- pnpm 10+
- Rust stable toolchain
- Windows WebView2 Runtime

### 开发

```bash
pnpm install --frozen-lockfile
pnpm dev
```

### 检查与测试

```bash
pnpm check
pnpm build
pnpm test:frontend
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

前端流程测试会启动本地 Vite 服务并运行 Playwright；完整回归覆盖今日、待办、计时、记录、设置、悬浮工作台和五套主题。

### Windows 构建

```bash
pnpm tauri build
pnpm export:release
```

构建结果位于 `src-tauri/target/release/bundle/`，导出的版本化文件位于项目根目录。发布前还需要检查版本源、Release notes、Windows 资产和远程 CI，不要把本地构建直接当成已发布版本。

### macOS Universal 构建

需要在 macOS 上执行：

```bash
pnpm install --frozen-lockfile
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

正式 macOS 资产会由 GitHub Actions 在版本 tag 推送后构建并上传到对应 Release。

## 项目结构

```text
src/                    SolidJS 前端与五套主题页面
src/data/copy-library.json
                        每日一句本地语料库
src-tauri/src/          Tauri 与 Rust 核心、计时引擎、本地存储
tests/                  Playwright 前端流程测试
scripts/                构建、导出、性能与发布脚本
docs/                   QA、设计参考、版本记录与维护文档
```

## 许可与反馈

本项目使用 MIT License，详见 [`LICENSE`](./LICENSE)。每日一句语料条目的来源与许可信息见 [`src/data/copy-library.json`](./src/data/copy-library.json) 和 [`docs/content/copy-library-sources.md`](./docs/content/copy-library-sources.md)。

如果遇到安装、数据迁移或计时问题，欢迎在 [Issues](https://github.com/zhulongqihan/Focused-Moment/issues) 中提供：

- Windows/macOS 版本；
- Focused Moment 版本；
- 可复现步骤和出现在哪个页面/窗口；
- 安装版还是便携版；
- 必要时附上不含个人隐私的截图或日志。
