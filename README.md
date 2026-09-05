# Focused Moment

> 一个本地优先的 Windows / macOS 专注工具：从下一件待办开始，专注一段时间，最后看见自己留下的节奏。

[![Latest Release](https://img.shields.io/github/v/release/zhulongqihan/Focused-Moment?display_name=tag&style=flat-square)](https://github.com/zhulongqihan/Focused-Moment/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/zhulongqihan/Focused-Moment/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zhulongqihan/Focused-Moment/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20Universal-173f2e?style=flat-square)](https://github.com/zhulongqihan/Focused-Moment/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-cb6d4b?style=flat-square)](https://github.com/zhulongqihan/Focused-Moment)

Focused Moment 适合需要长期保留待办和专注记录、但不想使用复杂项目管理系统的人。它保持界面克制，把真正重要的路径连在一起：写下要做的事 → 开始专注 → 桌面上保持状态 → 完成后留下记录 → 回看自己的投入。

## 预览

| 今日驾驶舱 | 专注计时 |
| --- | --- |
| ![今日驾驶舱](./安静开始.png) | ![专注计时](./专注计时.png) |

| 待办管理 | 时间档案 |
| --- | --- |
| ![待办管理](./管理待办.png) | ![时间档案](./状态复盘.png) |

## 核心能力

- **今日驾驶舱**：打开应用就能看到当前状态、下一件事和今天已经留下的进展。
- **待办闭环**：待办必须有截止日期，支持时间、重要程度、编辑、完成和撤销；可以直接带入专注。
- **两种计时方式**：正向计时记录实际投入；倒计时支持 1–720 分钟，并在结束时提醒。
- **悬浮工作台**：待办和当前计时在同一个置顶窗口中切换。有活动计时时自动显示“当前计时” Tab，没有计时时只显示待办。
- **多通道提醒**：应用内弹窗、Windows 任务栏闪烁和声音提醒；支持导入本地自定义音效。
- **时间档案**：连续投入、累计时长、活跃天数、最佳单日和最近 7 日节奏，全部基于真实记录生成。
- **每日一句**：内置 1000 条带来源与许可信息的中文古典、英文公版语料，按日期稳定选取；英文条目同时展示中文译文。
- **本地保护**：数据保存在本机，支持备份、恢复、导出备份目录和清空当前数据；旧版备份可以自动迁移。
- **体验保护**：加载失败会明确提示；删除待办或记录后可以在短时间内撤销；支持键盘命令面板。

## 下载与安装

前往 [最新 Release](https://github.com/zhulongqihan/Focused-Moment/releases/latest)，按需要选择：

| 文件 | 适合谁 | 说明 |
| --- | --- | --- |
| `Focused.Moment.Setup.*.exe` | 大多数用户 | 推荐。标准 Windows 安装程序，安装后可从开始菜单启动。 |
| `Focused.Moment_*.msi` | 企业部署或习惯 MSI 的用户 | Windows Installer 包。 |
| `Focused.Moment.*.exe` | 便携使用 | 单文件版本，可直接运行，不需要安装。 |
| `Focused.Moment_*_universal.dmg` | macOS 用户 | Universal 磁盘映像，同时支持 Apple 芯片和 Intel Mac。 |

运行版已经包含应用所需的前端资源和 Rust 核心，普通用户不需要安装 Node.js、Rust、pnpm 或下载源码。当前 Release 同时提供 Windows x64 和 macOS Universal 版本。

> 如果 Windows SmartScreen 对未签名程序显示提示，请确认文件来自本仓库的 [Release 页面](https://github.com/zhulongqihan/Focused-Moment/releases)，再按系统提示选择继续运行。

> macOS 发布包目前未使用 Apple Developer 证书签名。首次打开时，如果系统阻止应用运行，请在 Finder 中按住 Control 点击应用，选择“打开”，再确认一次即可。

## 新电脑能否获得同样体验？

可以获得同样的功能和界面体验。安装包内已经包含：

- 完整的今日、待办、计时、记录和设置页面；
- 悬浮工作台、任务栏闪烁、声音提醒等应用能力；
- 1000 条每日句子语料；
- 应用启动所需的前端与后端运行内容。

但新电脑不会自动拥有当前电脑的个人数据：待办、专注记录、当前未完成计时、自定义音效和历史备份都保存在本机。迁移方式：

1. 在旧电脑的“设置”中导出本地备份。
2. 将备份文件复制到新电脑。
3. 在新电脑安装应用后，在“设置”中导入备份。

应用数据由系统按平台保存在本机应用数据目录中，用户备份位于其中的 `Focused Moment Backups` 文件夹。迁移个人数据时，优先使用应用内备份/恢复，不建议手动修改 JSON 文件。

## 快速开始

1. 在“待办”写下事项、截止日期和重要程度。
2. 点击“专注”，选择正向计时或倒计时。
3. 写下这一轮要完成的事，点击“开始”。
4. 正向计时开始后，应用会自动打开悬浮工作台；你可以在“待办”和“当前计时”之间切换。
5. 暂停、继续或完成后保存记录，在“记录”页面回看自己的节奏。

### 悬浮工作台

- 顶部 Tab：**待办** / **当前计时**。
- 有活动计时时，打开工作台会自动切到当前计时。
- 点击锁图标后开启鼠标穿透；点击独立的小锁可以恢复操作。
- 拖动标题区域可以移动悬浮窗口。
- 点击“返回”可以回到主窗口；计时状态不会丢失。

## 数据与隐私

- 核心功能本地运行，不要求注册账号。
- 待办、记录、计时状态和设置保存在当前 Windows 用户的本地应用目录。
- 每日句子语料随应用发布，不依赖运行时网络请求。
- 应用不会自动上传待办、专注记录或备份文件。
- 自定义音效只保存在本机浏览器存储中，不会随安装包上传。

## 从源码构建

### 环境要求

- Windows x64 或 macOS
- Node.js 22+
- pnpm 10+
- Rust stable toolchain
- Windows WebView2 Runtime

### 开发

```bash
pnpm install
pnpm dev
```

### 检查与测试

```bash
pnpm check
pnpm build
pnpm test:frontend
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

### 构建 Windows 安装包

```bash
pnpm tauri build
pnpm export:release
```

构建结果位于 `src-tauri/target/release/bundle/`，导出的发布文件位于项目根目录。发布流程会同步版本号、生成安装包、创建 GitHub Tag 并上传 Release 资产。

### 构建 macOS Universal 安装包

需要在 macOS 上执行：

```bash
pnpm install
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

macOS 发布包会由 GitHub Actions 在推送版本 tag 后自动构建，并上传到对应 Release。

## 项目结构

```text
src/                    SolidJS 前端与页面交互
src/data/copy-library.json
                        每日一句本地语料库
src-tauri/src/          Tauri 与 Rust 核心、计时引擎、本地存储
tests/                  Playwright 前端流程测试
scripts/                构建、导出与发布脚本
```

## 版本发布

当前稳定版本：[v2.5.0](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.5.0)

完整变更记录见 [`docs/`](./docs/) 下的版本发布说明。

## 许可

本项目使用 MIT License，详见 [`LICENSE`](./LICENSE)。每日一句语料条目单独记录来源、许可和来源链接，详见 [`src/data/copy-library.json`](./src/data/copy-library.json)。

## 反馈

如果遇到安装、数据迁移或计时问题，欢迎在 [Issues](https://github.com/zhulongqihan/Focused-Moment/issues) 中提供：

- Windows 版本；
- Focused Moment 版本；
- 可复现步骤；
- 是否使用安装版或便携版；
- 必要时附上不含个人隐私的截图或日志。
