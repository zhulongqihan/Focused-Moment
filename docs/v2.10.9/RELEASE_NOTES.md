# v2.10.9 · Night Valley 计时悬浮窗入口修复

发布日期：2026-09-11

## 重点更新

- 修复 Night Valley 计时页从专注悬浮窗返回主界面后，重新进入悬浮窗入口可能落在卡片首屏之外、用户难以发现的问题。
- 将已有进度时的“进入悬浮窗”入口放到“本次专注”卡片标题栏右侧；开始、返回、再次进入、暂停、继续和完成继续复用同一计时状态。
- 保留无边框普通窗口、最大化和全屏尺寸下的计时卡片可读性与按钮可达性。

## 代码范围

- `src/components/NightValleyViews.tsx`：只调整现有悬浮窗入口的布局位置和展示条件。
- `src/App.css`：补充 Night Valley 计时卡片 header actions 的布局、尺寸和焦点样式。
- `tests/app.spec.mjs`：增加入口必须位于视口内的返回回归断言。
- `README.md`：同步当前版本和悬浮工作台使用说明。
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`。

## 明确不修改

- 不修改 Rust 计时引擎、计时数据格式、Tauri 悬浮窗创建逻辑或锁定/解锁逻辑。
- 不修改 Night Valley 今日、待办、记录、设置页面，不修改其他四套主题。
- Night Valley 当前没有独立的 F11/全屏产品命令；本版本验证的是无边框全屏几何和 CSS 全屏布局，不虚构 F11 功能。

## 本地验证

- `pnpm check`：PASS。
- `pnpm test:frontend -- --workers=1`：PASS，67/67。
- Night Valley 计时全屏定向用例：PASS，3/3。
- 悬浮窗返回入口定向用例：PASS，1/1。
- `pnpm build`：PASS，2062 modules transformed。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，33/33 library tests。
- Windows native 隔离验收：普通窗口、最大化、无边框全屏几何、未开始、运行中、暂停/继续、完成、悬浮窗往返、Tab 切换、重启读记录均通过；证据见 `docs/qa/REFINE-13-night-valley-focus-floating-v2.10.9.md`。

## Windows 发布候选资产

Windows release bundle 已生成并复制到隔离发布暂存目录；macOS Universal DMG 由 tag 对应的 GitHub Actions workflow 构建并上传。

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.9.exe` | 23,731,200 bytes | `6e8890fcd7fe33aa09bd72da6ea38a88caaddc7d8c728f305c4970a347f43baa` |
| `Focused.Moment.Setup.v2.10.9.exe` | 16,127,518 bytes | `f8c74c7635bfe0246cb3c28eb123b193c36430ccdb715fa5377842fe3b82e5a4` |
| `Focused.Moment_2.10.9_x64_en-US.msi` | 17,108,992 bytes | `3499ac6e745177629e7a5d0d9a49534af22c77075548aa93f0d1acf336f1b5a8` |

## 发布状态

本地版本源已统一到 `2.10.9`，Windows 正式包已生成并完成本地 SHA-256 核对。提交、tag、正常推送、远程 CI、macOS Universal DMG 和 GitHub Release 资产 digest 尚待本轮发布闭环完成。v2.10.8 tag、Release 和四项既有资产保持不变。
