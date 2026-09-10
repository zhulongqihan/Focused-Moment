# REFINE-09 · Night Valley 计时页用户工作区重构

日期：2026-09-10
主题：第一套主题 Night Valley / 夜谷
界面：计时 / 专注计时
版本：v2.10.5
状态：v2.10.5 已发布，远程发布闭环完成，等待用户验收

## 用户反馈与问题复述

本轮只处理 Night Valley 的“计时”页：

- “专注流程 / 本轮 / 当前进度 / 当前阶段”对实际使用没有帮助，页面应该从用户角度重构并加入真正会用到的功能。
- 右侧卡片是高频操作区，但当前文字混乱、难以阅读。
- “重置”用途不清楚且不可用。
- 页面下方快捷键提示没有存在必要，且实际快捷键体验不可靠。

## 根因判断

- 旧页面把产品概念图当成了操作界面：流程线、中心进度仪表和底部摘要同时占用主要空间，却没有帮助用户完成“写目标 → 选时长 → 开始 → 保存”的实际任务。
- 卡片沿用固定高度和多层旧样式，状态、计时读数、说明、字段和控制挤在同一垂直空间，导致不同窗口比例下的文字层级和可读性失控。
- 重置按钮只在已有进度时启用，未开始时不能清除用户刚选的设置；按钮文案也没有说明它会清除什么。
- 快捷时长切换调用异步模式切换但没有等待完成，模式切换完成后的默认时长会覆盖用户刚选的时长。

## 实施范围

- `src/components/NightValleyViews.tsx`
  - 删除流程线、中心进度仪表、底部状态摘要和页内快捷键提示。
  - 新增实际可用的说明区域、今日已记录、当前模式、25/45/60 分钟快捷时长和记录入口。
  - 将右侧卡片重构为唯一主要操作区，明确显示事项、状态、计时、模式、目标时长、今日完成量、待办关联和操作按钮。
  - 让重置在未开始和已有进度两种状态都可用，并分别显示“清空设置”和“重置本次专注”。
- `src/MainShell.tsx`
  - 让计时页模式切换回调返回 Promise，使快捷时长设置等待模式切换结束后再写入用户选择。
- `src/App.css`
  - 为新的工作区建立桌面、窄桌面和移动窗口的内容流布局；加强卡片文字、字段、状态和操作按钮的可读层级；保证全屏下不出现横向溢出和内容裁切。
- `tests/app.spec.mjs`、`tests/today-visual.spec.mjs`
  - 更新 Timer 页面结构契约，增加重置、快捷时长、状态文案、无旧装饰结构和全屏安全区断言。

## 明确不修改

- 不修改第二套至第五套主题，不批量重做其他主题页面。
- 不修改 Night Valley Today、待办、记录、设置页的内容结构；本轮只保留已经存在的同主题时钟和命令按钮隐藏规则。
- 不修改计时状态机、真实专注记录数据结构、待办数据结构或完成/保存行为。
- 不删除全局 `Ctrl+K` 命令面板；本轮只移除计时页内的快捷键提示，不扩展全局快捷键范围。
- 不替换背景图、字体素材或主题资源。

## 视觉与交互证据

- 常规计时页：`output/playwright/night-valley-timer.png`。
- 2560×1368 全屏计时页：`output/playwright/night-valley-timer-fullscreen.png`。
- 已核对：流程和进度概念区已移除；右侧卡片文字不再覆盖；快捷时长可选；未开始时“清空设置”可用；全屏下日期时钟、说明区、操作卡片均在安全区内。

## 已完成本地验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm build` | PASS，2062 modules transformed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS，`focused-moment v2.10.5` |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests，0/0 binary/doc tests |
| `pnpm exec playwright test tests/app.spec.mjs --workers=1 --grep "timer workspace|stopwatch shows|completed countdown"` | PASS，6/6 |
| `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1 --grep "Timer workspace|high-DPI|fullscreen|secondary widths|pressure widths"` | PASS，10/10 |
| `pnpm test:frontend -- --workers=1` | PASS，63/63 |
| `pnpm package:release` | PASS，生成 v2.10.5 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.5.exe`，23,733,248 bytes，SHA-256 `D981C84322F4183BD47508AC26B5EE7F13B82B52A298A64FA47E151E1E3B3F1F`。
- Setup/NSIS：`Focused Moment Setup v2.10.5.exe`，16,125,808 bytes，SHA-256 `772674763AAE959E6879995504081885B3212E725CBA709A60B3FA4385098546`。
- MSI：`Focused Moment_2.10.5_x64_en-US.msi`，17,113,088 bytes，SHA-256 `7C32B021B053CDD4DE71F03D211F491CE422735F9B3906AFE949CDEB8DAB57BA`。

## 远程发布闭环

- 发布代码提交：`e7df3e683ce271303f3d7aafc7ceebcf389c614d`；`v2.10.5` annotated tag 已推送，peeled commit 与发布代码一致。
- [Checks run 34464414397](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464414397)：PASS，前端 63 passed，Rust format/check/test 通过。
- [macOS Native Smoke run 34464414373](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464414373)：PASS。
- [macOS Universal Release run 34464437886](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34464437886)：PASS，Universal DMG 上传成功。
- [GitHub Release v2.10.5](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.5)：正式 Release，四项资产均为 `uploaded`，非 draft、非 prerelease。

远端资产与本地构建产物核对如下：

- `Focused.Moment.v2.10.5.exe`，23,733,248 bytes，远端 digest `sha256:d981c84322f4183bd47508ac26b5ee7f13b82b52a298a64fa47e151e1e3b3f1f`，与本地便携 EXE 一致。
- `Focused.Moment.Setup.v2.10.5.exe`，16,125,808 bytes，远端 digest `sha256:772674763aae959e6879995504081885b3212e725cba709a60b3fa4385098546`，与本地 Setup 一致。
- `Focused.Moment_2.10.5_x64_en-US.msi`，17,113,088 bytes，远端 digest `sha256:7c32b021b053cdd4de71f03d211f491ce422735f9b3906afe949cdeb8dab57ba`，与本地 MSI 一致。
- `Focused.Moment_2.10.5_universal.dmg`，34,259,483 bytes，远端 digest `sha256:19f4e53255e250c2ede22cc0ee0e231f43c6d5f26d2cb1b18a4f72712f1b3190`。
