# v2.10.5 · Night Valley 计时页用户工作区重构

发布日期：2026-09-10

## 重点更新

- 将 Night Valley“计时”页从概念化的“本轮流程 / 当前进度 / 当前阶段”展示，重构为面向实际使用的专注工作区：左侧提供开始说明、今日记录、常用时长和记录入口，右侧卡片集中完成一轮专注的全部操作。
- 右侧“本次专注”卡片重新组织为当前事项、状态、计时读数、模式、目标时长、今日完成量、关联待办和开始/暂停/完成控制，修复文字层级混乱和信息互相覆盖。
- 增加 25 / 45 / 60 分钟快捷时长；修复快捷时长切换模式时用户选择被默认值覆盖的问题。
- 将重置改为明确的可用操作：未开始时显示“清空设置”，已有进度时显示“重置本次专注”，并提供对应用途说明。
- 移除计时页内的 Ctrl+Enter 快捷键提示、底部状态摘要和无实际用途的流程线；保留现有计时状态机、记录、待办关联和全局命令面板能力。
- 继续保持 Night Valley 日期后的实时钟、全屏安全区和所有 tab 的视觉命令按钮隐藏规则。

## 代码范围

- Timer 页面结构与交互：`src/components/NightValleyViews.tsx`、`src/MainShell.tsx`。
- Night Valley Timer 响应式布局和可读性：`src/App.css`。
- Timer 交互、全屏和高 DPI 回归：`tests/app.spec.mjs`、`tests/today-visual.spec.mjs`。
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`。
- QA 证据：`docs/qa/REFINE-09-night-valley-focus-v2.10.5.md`。

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过，2062 modules transformed。
- `pnpm test:frontend -- --workers=1`：63/63 通过。
- Night Valley Timer 定向交互和全屏视觉回归：通过；全屏尺寸 2560×1368。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests，0/0 binary/doc tests 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。

## 发布资产

- 便携 EXE：`Focused Moment v2.10.5.exe`，23,733,248 bytes，SHA-256 `D981C84322F4183BD47508AC26B5EE7F13B82B52A298A64FA47E151E1E3B3F1F`。
- Setup/NSIS：`Focused Moment Setup v2.10.5.exe`，16,125,808 bytes，SHA-256 `772674763AAE959E6879995504081885B3212E725CBA709A60B3FA4385098546`。
- MSI：`Focused Moment_2.10.5_x64_en-US.msi`，17,113,088 bytes，SHA-256 `7C32B021B053CDD4DE71F03D211F491CE422735F9B3906AFE949CDEB8DAB57BA`。
- macOS Universal DMG：`Focused.Moment_2.10.5_universal.dmg`，34,259,483 bytes，远端 digest `sha256:19f4e53255e250c2ede22cc0ee0e231f43c6d5f26d2cb1b18a4f72712f1b3190`。

## 发布状态

- 发布代码提交：`e7df3e683ce271303f3d7aafc7ceebcf389c614d`；`v2.10.5` tag 的 peeled commit 与该提交一致。
- [Checks run 34464414397](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464414397)、[macOS Native Smoke run 34464414373](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464414373)、[macOS Universal Release run 34464437886](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464437886)：均 PASS；Checks 前端 63 passed，macOS Universal DMG 上传成功。
- [GitHub Release v2.10.5](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.5)：正式 Release，四项资产均为 `uploaded`，非 draft、非 prerelease；完整大小与 digest 见 QA 证据。
