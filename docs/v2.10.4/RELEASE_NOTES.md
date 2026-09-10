# v2.10.4 · Night Valley 计时页专注层级与全屏布局精修

发布日期：2026-09-10

## 重点更新

- 计时页移除抢夺注意力的中央大圆盘，将计时读数和主要操作收拢到“本次专注”卡片；卡片现在展示当前事项、运行状态、模式、目标时长、今日已完成段数，以及开始/暂停/完成/重置控制。
- 将原本意义不明确的背景线改为四个真实阶段（准备、专注、暂停、完成）的连续 Bézier 弧线路径，保留 Night Valley 的蜿蜒感，同时让路径和计时生命周期对应。
- Night Valley 五个 tab 的日期后统一增加实时 `HH:MM:SS`，日期与时钟采用不同字体；隐藏所有 tab 左下角的视觉命令按钮，保留 `Ctrl+K` 命令面板。
- 计时页改为响应式内容流布局，修正最大化/全屏下右侧卡片、底部摘要和日期信息可能出界或丢失的问题。

## 代码范围

- 共享日期时钟：`src/components/NightValleyDateStamp.tsx`、`src/components/TodayDashboard.tsx`、`src/components/NightValleyViews.tsx`。
- Night Valley Timer 结构与样式：`src/components/NightValleyViews.tsx`、`src/App.css`。
- 计时页回归与全屏证据：`tests/app.spec.mjs`、`tests/today-visual.spec.mjs`。
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`。
- QA 证据：`docs/qa/REFINE-08-night-valley-focus-v2.10.4.md`。

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过，2062 modules transformed。
- Night Valley Timer 定向应用交互：8/8 通过。
- Night Valley 视觉定向：13/13 通过；全屏计时断言 1/1 通过。
- `pnpm test:frontend -- --workers=1`：62/62 通过。
- `cargo fmt --check`、`cargo check --locked`：通过。
- `cargo test --locked`：33/33 library tests、0/0 binary/doc tests 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。

## 发布资产

- 便携 EXE：`Focused Moment v2.10.4.exe`，23,733,248 bytes，SHA-256 `DF204A6820A064C5EE5E33E3A21B4D9A28F2F01FCF69C552D5F0FE0708203D26`。
- Setup/NSIS：`Focused Moment Setup v2.10.4.exe`，16,131,599 bytes，SHA-256 `699BB019EDFCAAC3B54F3A72AAA70DE5607B8D4147192D68E146A75A2CD7A6E2`。
- MSI：`Focused Moment_2.10.4_x64_en-US.msi`，17,108,992 bytes，SHA-256 `F7D40631EFE18AB556219092070255C452574C5EAC3CF1259D8D0A2FC6F89B13`。
- macOS Universal DMG：待 GitHub Release workflow 上传后补录。

## 发布状态

- 本地候选已完成；远程 main、tag、CI、macOS Universal 与 GitHub Release 将在本版本提交后完成并回填到 QA 证据。
