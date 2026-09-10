# REFINE-07 · Night Valley 今日页曲线、时钟与概览卡

日期：2026-09-10
主题：第一套主题 Night Valley / 夜谷
界面：今日 / 今日路径
版本：v2.10.3
状态：v2.10.3 已发布，远程发布闭环完成，等待用户验收

## 用户反馈与问题复述

本轮截图和反馈仍然只针对 Night Valley 的“今日”页：

- 底部总结区现在已经能够看见，本轮保持这一结果。
- 路径不应再由生硬的直线段和直角组成；用户希望保留弧线，并像背景河流一样有更多自然的弯弯绕。
- 日期后需要显示当前时、分、秒，并使用与日期不同的字体。
- 右侧卡片只跳转到“计时”页，信息价值不足；需要重构为今日页本身有用的数据。

## 根因判断

- 上一轮为了满足“至少四个大于 90° 的弯”将路径改成了 `M/L` switchback。该实现直接制造了直线段和硬转角，与本轮更新后的弧线反馈冲突。
- 日期区域只有业务日期和星期，没有独立的实时状态；因此页面无法表达用户当前时刻。
- 右卡承载了计时入口，和第二个“计时”页重复；它没有提供今日投入、完成量或待办进度等页面上下文。

## 实施范围

- `src/components/TodayDashboard.tsx`
  - 将路径导向点转换为连续 `C` 曲线，保留所有真实节点作为路径锚点。
  - 单节点和多节点场景都使用不含 `L` 直线命令的平滑绕行；多节点场景采用更宽的弧段，避免机械密集波纹。
  - 在日期后增加每秒刷新的 `HH:MM:SS` 时钟，并保留日期、时钟、星期的字体区分。
  - 将右卡重构为“今日概览”，展示今日投入、专注段数、连续节奏和待办完成进度；不再放置计时按钮或计时器。
- `src/App.css`
  - 只在 Night Valley Today 作用域内增加时钟和概览卡样式；保持底部总结安全区规则不变。
- `tests/today-visual.spec.mjs`、`tests/app.spec.mjs`
  - 更新 Today 断言，验证时钟格式、概览数据、计时器不进入今日页、计时导航仍由侧边第二个 tab 承载，以及平滑路径只使用曲线命令。
- 版本源和发布文档同步至 v2.10.3。

## 明确不修改

- 不修改底部总结句、安全区布局和“添加时段”入口的本轮可见性结果。
- 不修改计时页、计时状态机、真实记录/待办数据结构或 MainShell 业务流程。
- 不修改 Night Valley 的其他四个页面、其他四套主题、背景图和素材。
- 不恢复 Today 左下角的视觉快速命令入口；全局 `Ctrl+K` 命令面板能力保持不变。

## 视觉与交互证据

- 全屏单节点截图：`output/playwright/today-fullscreen-refined.png`。
- 多节点参考截图：`output/playwright/today-after.png`。
- 窄窗口截图：`output/playwright/today-1280.png`。
- 全屏夹具为 2560×1368；底部总结仍落在视口内，时钟显示在日期之后，右卡完整显示今日概览。

## 已完成验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm build` | PASS，2061 modules transformed |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests，0/0 doc tests |
| `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1` | PASS，29/29 |
| Today 定向应用交互 Playwright | PASS，4/4 |
| `pnpm test:frontend -- --workers=1` | PASS，60/60 |
| `pnpm package:release` | PASS，生成 v2.10.3 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.3.exe`，23,731,200 bytes，SHA-256 `A8FC2190C4D28C896A79C3BBE163EC6D430886BD65ECFF3055BA6CA5C0792B1C`。
- Setup/NSIS：`Focused Moment Setup v2.10.3.exe`，16,133,917 bytes，SHA-256 `EA88668E5210B80642BA2419B76229AA4492727548CE9926ED0FA6650FA42687`。
- MSI：`Focused Moment_2.10.3_x64_en-US.msi`，17,108,992 bytes，SHA-256 `FC058867A036B5F6643E7CBC8611C7E1DE30B9DBFC14E724BAFBD19AF93A8CF7`。

## 远程发布闭环

- 发布代码提交：`c4176ee33349a079df770b72f0d8fd11ac1f75e2`；`v2.10.3` tag 的 peeled commit 与该提交一致；tag object 为 `e0b6e9d684ed30e9773e551ce914283e20557991`。
- [Checks run 34429945507](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34429945507)：PASS，前端 60/60，Rust check/test 通过。
- [macOS Native Smoke run 34429945494](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34429945494)：PASS。
- [macOS Universal Release run 34429994761](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34429994761)：PASS，Universal DMG 上传成功。
- [GitHub Release v2.10.3](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.3)：正式 Release，4 项资产均为 `uploaded`。

远端资产与本地构建产物核对如下：

- `Focused.Moment.v2.10.3.exe`，23,731,200 bytes，远端 digest `sha256:a8fc2190c4d28c896a79c3bbe163ec6d430886bd65ecff3055ba6ca5c0792b1c`，与本地便携 EXE 一致。
- `Focused.Moment.Setup.v2.10.3.exe`，16,133,917 bytes，远端 digest `sha256:ea88668e5210b80642ba2419b76229aa4492727548ce9926ed0fa6650fa42687`，与本地 Setup 一致。
- `Focused.Moment_2.10.3_x64_en-US.msi`，17,108,992 bytes，远端 digest `sha256:fc058867a036b5f6643e7cbc8611c7e1de30b9dbfc14e724bafbd19af93a8cf7`，与本地 MSI 一致。
- `Focused.Moment_2.10.3_universal.dmg`，34,260,492 bytes，远端 digest `sha256:d7a34fd82b8fbe72179c397a5cb2458917efd36ec6f1f5ff19a9f9d2ae1b819f`。
