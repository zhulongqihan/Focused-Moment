# REFINE-06 · Night Valley 今日页截图驱动精修证据

日期：2026-09-10  
主题：第一套主题 Night Valley  
界面：今日 / 今日路径  
状态：REVIEW，v2.10.1 本地发布候选已完成，等待远程闭环与用户验收

## 用户反馈与问题复述

- 部分节点信息会展示不出来，需要调整排版，避免信息丢失。
- 今日页左下角的快速命令没有必要，应移除。
- 时间节点之间留白过大，路径没有概念图中的蜿蜒灵动感。
- 今日页右侧卡片中的计时职责不清；计时应进入第二个“计时”页完成。

## 根因判断

- 节点元信息使用绝对定位，原先通过 `IntersectionObserver` 在元信息部分离开地图视口时直接隐藏整块标签；长标题也使用单行省略，因此存在真实信息不可见的组合风险。
- Today 的路径节点纵向坐标沿用较松的参考分布，卡片和路径在同一舞台中争夺视觉重心，导致节点节奏被拉开。
- 右卡同时承载“下一站”说明与计时器、开始/暂停/完成动作，重复了 Focus 页的职责。
- 全局命令入口由 MainShell 统一渲染；Today 仅隐藏其视觉入口，命令面板仍保留 Ctrl+K 键盘入口和其他页面入口。

## 实施范围

- `src/components/TodayDashboard.tsx`：收紧 Night Valley Today 路径坐标；节点标签改为边缘内锚定、可换行；右卡改为下一节点/当前状态信息和“查看计时”跳转。
- `src/App.css`：仅在 `.minimal-app--trail` 范围内隐藏 Today 快速命令、保障节点标签可见、收紧右卡布局并移除计时视觉依赖。
- `src/MainShell.tsx`：当 Today 的命令按钮隐藏时，命令面板关闭后将焦点回收到当前导航按钮。
- `tests/app.spec.mjs`、`tests/today-visual.spec.mjs`：补充节点信息可见、右卡无计时环、快捷入口隐藏和跳转计时页断言。
- 版本同步至 `2.10.1`，并更新运行时里程碑、README、Release notes。

## 明确不修改

- 不修改计时页的计时交互、真实计时状态机、待办/记录数据和 MainShell 的业务动作来源。
- 不修改 Night Valley 的其他四个页面、其他四套主题、背景图和素材。
- 不伪造或删除真实节点数据；不把 Ctrl+K 命令能力从应用全局移除。

## 视觉与交互证据

- 固定视口截图：`output/playwright/today-after.png`。
- 压力视口截图：`output/playwright/today-1280.png`、`output/playwright/today-1024.png`。
- 截图复核结论：8 个节点的标题和时间均可见；路径形成更紧凑的连续波形；Today 右卡无 `.trail-timer`，底部快速命令入口隐藏；“查看计时”进入 Focus 页。

## 已完成验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1` | PASS，28/28 |
| `pnpm exec playwright test tests/app.spec.mjs --workers=1` | PASS，31/31 |
| `pnpm test:frontend -- --workers=1` | PASS，59/59 |
| `pnpm build` | PASS，2061 modules transformed |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests |
| `pnpm package:release` | PASS，生成 v2.10.1 EXE / NSIS / MSI |
| `git diff --check` | PASS |

本地 Windows 资产 SHA-256：便携 EXE `3DA2322844D8DC7DDF6032B9271BC0671D270461A94F16819CB19F8C170A83C9`；Setup/NSIS `5A7009CD7A24BB9D1D19F819F1BB86EB2D68A44769088CFAF86A349B920260CF`；MSI `F8281C639C07AE2C3FA30EBA6F385219D5F04200B53FD620F678870E7CC80238`。

远程 CI、GitHub Release 资产和远端 digest 将在 v2.10.1 发布收口后补录。
