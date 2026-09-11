# REFINE-10 · Night Valley 计时页全屏排版修复

日期：2026-09-11  
主题：第一套主题 Night Valley / 夜谷  
界面：计时 / 专注计时  
版本：v2.10.6  
状态：本地验证完成，待远程发布闭环

## 用户反馈与问题复述

用户反馈：计时页放到全屏后，右侧卡片仍然出现文字排版问题。

截图中的具体问题：

- `01:00:00` 大计时读数压住下面的“目标时长 / 今日已完成”。
- 状态说明和“倒计时 · 设定 60 分钟”也被挤在相邻区域，卡片信息互相覆盖。
- 该问题出现在物理 2560×1368 全屏截图中；Windows 显示缩放后，实际 CSS 视口约为 1707×912。

## 根因判断

- 计时卡片是纵向 flex 容器，关键子区默认允许收缩。
- 计时读数容器被压到约 62px 高，但 `01:00:00` 本身已经占据约 62px，子内容遂溢出到统计区。
- 之前的回归只覆盖了 100% 缩放下的 2560×1368 CSS 视口，且默认 45 分钟会显示为较短的 `45:00`，没有覆盖 60 分钟的 8 位读数和真实 DPI 缩放组合。

## 实施范围

- `src/App.css`
  - 禁止计时卡片的关键直接子区被 flex 压缩。
  - 为计时读数保留自然高度。
  - 在低高度桌面视口中收紧非关键间距、保持读数和统计分层。
  - 让全屏常见 DPI 下卡片内容完整落在卡片内部。
- `tests/today-visual.spec.mjs`
  - 增加 60 分钟 `01:00:00` 与统计区的边界断言。
  - 增加 1707×912 CSS 视口（对应 2560 物理像素、150% 缩放）的全屏回归。
  - 断言卡片 `scrollHeight` 不超过 `clientHeight`，防止底部操作被截断。
- 同步版本至 v2.10.6，符合已发布版本的后续修复升 patch 版本要求。

## 明确不修改

- 不修改 Night Valley 今日页曲线和今日页布局。
- 不修改待办、记录、设置页，不修改第二至第五套主题。
- 不修改计时状态机、保存记录、待办关联和按钮行为。
- 不替换背景图、字体、图标或主题资源。

## 视觉证据

- 60 分钟标准全屏：`output/playwright/night-valley-timer-one-hour.png`。
- 1707×912 CSS 缩放全屏：`output/playwright/night-valley-timer-scaled-fullscreen.png`。
- 复核结论：`01:00:00`、目标时长、今日完成、状态说明、模式、表单、开始和清空设置按顺序展示；卡片无重叠、无水平溢出、无内部内容截断。

## 本地验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm build` | PASS，2062 modules transformed |
| `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1 --grep "timer workspace|stopwatch shows|completed countdown|one-hour readout|scaled fullscreen CSS|Night Valley timer fullscreen"` | PASS，10/10 |
| `pnpm test:frontend -- --workers=1` | PASS，65/65 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS，`focused-moment v2.10.6` |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests |
| `pnpm package:release` | PASS，生成 v2.10.6 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.6.exe`，23,733,248 bytes，SHA-256 `12F018178060FE0A06E5D0A2A0718DCC92304BFD53C8C352B2F07E04F7C99847`。
- Setup/NSIS：`Focused Moment Setup v2.10.6.exe`，16,127,835 bytes，SHA-256 `1FF296F072993CD5EEBCAEC02707EF15942AB48907F7FFBED1144725426F7542`。
- MSI：`Focused Moment_2.10.6_x64_en-US.msi`，17,108,992 bytes，SHA-256 `8CF8C8F3BE892B1BB39A3B37F4DD7C24271FED7A4360F209FAB956CFE9AB3B18`。

## 远程发布闭环

待提交并推送后补录：发布提交、v2.10.6 tag、GitHub Checks、macOS Native Smoke、Universal Release、GitHub Release 四项资产及远端 digest。
