# REFINE-08 · Night Valley 计时页计时器、流程线与全屏布局

日期：2026-09-10
主题：第一套主题 Night Valley / 夜谷
界面：计时 / 专注计时
版本：v2.10.4
状态：v2.10.4 已发布，远程发布闭环完成，等待用户验收

## 用户反馈与问题复述

本轮只处理 Night Valley 的“计时”页，同时处理用户明确要求的 Night Valley tab 级一致性：

- 日期后需要显示当前时、分、秒，并同步到每个 tab 页，日期与时钟使用不同字体。
- 中央大圆和巨大时间读数过度吸引注意，需要重新规划计时页的信息层级。
- 背景线条缺少明确意义；用户希望保留背景图式的弧线和蜿蜒感，不接受生硬直角线段。
- 全屏时仍有内容展示不完整的问题，底部数据必须留在可视安全区内。
- 右侧计时卡是高频使用区域，但现有文案和字段意义不清；需要让它直接承担本轮计时和统计信息。
- 左下角命令按钮不应在其他 tab 页出现；本主题所有 tab 都隐藏该视觉入口，但保留全局 `Ctrl+K` 能力。

## 根因判断

- 计时页由固定尺寸的多层 chronograph、超大读数和绝对定位布局组成，中心视觉权重远高于实际操作区；在窗口比例变化时，固定坐标也会把卡片或底部数据推到视口之外。
- 原背景线是装饰性七点路径，节点与计时生命周期没有一一对应；为满足回折要求时容易退化成硬直角，无法同时表达流程和自然弧线。
- 各 Night Valley 页面日期分别渲染静态文本，缺少共享的实时钟组件，因此计时页及其他 tab 不能保持同一时间口径。
- 命令按钮的隐藏规则只覆盖 Today 页面，其他 Night Valley 页面仍沿用默认浮动入口。

## 实施范围

- `src/components/NightValleyDateStamp.tsx`
  - 新增共享的本地实时 `HH:MM:SS` 时钟和日期戳，使用语义化 `<time>`，每秒更新。
- `src/components/NightValleyViews.tsx`
  - 计时页将中央大圆盘替换为低强调的当前阶段/百分比/阶段进度仪表。
  - 将实际计时读数、模式、目标时长、今日完成段数和开始/暂停/完成/重置控制集中到“本次专注”卡片。
  - 用“准备、专注、暂停、完成”四个真实生命周期状态生成带语义标签的连续 Bézier 弧线路径；不使用 `L` 直线段或装饰节点。
  - 五个 Night Valley tab 使用同一日期戳；计时状态机、真实待办关联和原有操作回调保持不变。
- `src/components/TodayDashboard.tsx`、`src/App.css`
  - Today 复用同一实时钟；Night Valley 作用域统一隐藏左下角视觉命令按钮。
  - 计时页改用响应式 grid/flex 布局，桌面、窄桌面和移动窗口均采用自然内容流，保证底部摘要、右卡和日期时钟不因固定坐标丢失。
- `tests/app.spec.mjs`、`tests/today-visual.spec.mjs`
  - 增加五个 Night Valley tab 的实时钟/命令按钮一致性断言、计时页四状态路径与卡片结构断言，以及 2560×1368 全屏可见性断言。

## 明确不修改

- 不修改第二套至第五套主题，不批量重做其他主题页面。
- 不重做 Night Valley Today 的内容、路径、右侧今日概览和底部安全区；Today 仅复用实时钟组件，并加入同主题全页命令按钮隐藏规则。
- 不修改计时状态机、真实记录/待办数据结构、MainShell 业务动作或开始/暂停/继续/完成/重置/模式切换/关联待办功能。
- 不替换背景图、字体素材或概念图资源；只重构计时页前景路径与布局层级。
- 不删除全局 `Ctrl+K` 命令面板，只移除所有 Night Valley tab 左下角的视觉触发按钮。

## 视觉与交互证据

- 常规计时页：`output/playwright/night-valley-timer.png`。
- 2560×1368 全屏计时页：`output/playwright/night-valley-timer-fullscreen.png`。
- 截图中已核对：日期后实时钟、中心无巨大圆盘、四个有语义的弧线阶段、右侧本轮计时卡、底部摘要和隐藏命令按钮均可见。

## 已完成本地验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm build` | PASS，2062 modules transformed |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS，`focused-moment v2.10.4` |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests，0/0 binary/doc tests |
| `pnpm exec playwright test tests/app.spec.mjs --workers=1 --grep timer` | PASS，8/8 |
| `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1 --grep "Night Valley"` | PASS，13/13 |
| `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1 --grep "timer fullscreen"` | PASS，1/1 |
| `pnpm test:frontend -- --workers=1` | PASS，62/62 |
| `pnpm package:release` | PASS，生成 v2.10.4 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.4.exe`，23,733,248 bytes，SHA-256 `DF204A6820A064C5EE5E33E3A21B4D9A28F2F01FCF69C552D5F0FE0708203D26`。
- Setup/NSIS：`Focused Moment Setup v2.10.4.exe`，16,131,599 bytes，SHA-256 `699BB019EDFCAAC3B54F3A72AAA70DE5607B8D4147192D68E146A75A2CD7A6E2`。
- MSI：`Focused Moment_2.10.4_x64_en-US.msi`，17,108,992 bytes，SHA-256 `F7D40631EFE18AB556219092070255C452574C5EAC3CF1259D8D0A2FC6F89B13`。

## 远程发布闭环

- 发布代码提交：`76629118ab014427c9d48db16f4b2b29342d290e`；`v2.10.4` tag 的 peeled commit 与该提交一致；annotated tag object 为 `ed02607a57e70a6470ea7b6ff8d4c28b3937bfe4`。
- [Checks run 34439301338](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34439301338)：PASS，前端 62/62，Rust format/check/test 通过。
- [macOS Native Smoke run 34439301192](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34439301192)：PASS。
- [macOS Universal Release run 34439341125](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34439341125)：PASS，Universal DMG 上传成功。
- [GitHub Release v2.10.4](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.4)：正式 Release，四项资产均为 `uploaded`，非 draft、非 prerelease。

远端资产与本地构建产物核对如下：

- `Focused.Moment.v2.10.4.exe`，23,733,248 bytes，远端 digest `sha256:df204a6820a064c5ee5e33e3a21b4d9a28f2f01fcf69c552d5f0fe0708203d26`，与本地便携 EXE 一致。
- `Focused.Moment.Setup.v2.10.4.exe`，16,131,599 bytes，远端 digest `sha256:699bb019edfcaac3b54f3a72aaa70de5607b8d4147192d68e146a75a2cd7a6e2`，与本地 Setup 一致。
- `Focused.Moment_2.10.4_x64_en-US.msi`，17,108,992 bytes，远端 digest `sha256:f7d40631efe18ab556219092070255c452574c5eac3cf1259d8d0a2fc6f89b13`，与本地 MSI 一致。
- `Focused.Moment_2.10.4_universal.dmg`，34,262,638 bytes，远端 digest `sha256:b90c6eaee808616e7e8ad24965500e92334da9b43a8c8c2086d01980d51d9857`。
