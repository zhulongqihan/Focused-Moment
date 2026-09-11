# v2.10.6 · Night Valley 计时页全屏排版修复

发布日期：2026-09-11

## 重点更新

- 修复 Night Valley“计时”页在 Windows 高 DPI 全屏场景下，`01:00:00` 计时读数与“目标时长 / 今日已完成 / 状态说明”互相覆盖的问题。
- 让计时卡片各信息区保持自然高度，不再因卡片高度受限而压缩关键文字；在常见 125–150% 显示缩放下保持完整可读。
- 针对 60 分钟倒计时增加全屏和缩放视口回归测试，并确认卡片内容不产生内部截断或横向溢出。

## 代码范围

- `src/App.css`：修正 Night Valley 计时卡片的 flex 收缩和低高度桌面布局间距。
- `tests/today-visual.spec.mjs`：增加 60 分钟读数与 1707×912 CSS 视口的排版边界断言和截图证据。
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`。

## 明确不修改

- 不修改 Night Valley 今日页曲线、其他四个页面、其他主题或计时状态机。
- 不修改计时数据结构、开始 / 暂停 / 完成 / 重置行为。
- 不替换背景图、字体和主题素材。

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过，2062 modules transformed。
- `pnpm test:frontend -- --workers=1`：65/65 通过。
- 计时页定向交互与视觉回归：10/10 通过，覆盖 60 分钟标准视口、2560×1368 全屏和 1707×912 缩放全屏 CSS 视口。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。
- `git diff --check`：通过。

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.6.exe`，23,733,248 bytes，SHA-256 `12F018178060FE0A06E5D0A2A0718DCC92304BFD53C8C352B2F07E04F7C99847`。
- Setup/NSIS：`Focused Moment Setup v2.10.6.exe`，16,127,835 bytes，SHA-256 `1FF296F072993CD5EEBCAEC02707EF15942AB48907F7FFBED1144725426F7542`。
- MSI：`Focused Moment_2.10.6_x64_en-US.msi`，17,108,992 bytes，SHA-256 `8CF8C8F3BE892B1BB39A3B37F4DD7C24271FED7A4360F209FAB956CFE9AB3B18`。

## 发布状态

- 发布提交为 `0ec12d8`（`0ec12d810a88516e6db8bbe4b587d100af82627f`），`v2.10.6` tag 已创建并固定在该提交。
- [GitHub Checks](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34558337330)、[macOS Native Smoke](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34558337332) 与 [macOS Release](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34558410140) 均已通过。
- [GitHub Release v2.10.6](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.6) 已发布，四项资产均为 uploaded：

| 远端资产 | 大小 | 远端 SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.6.exe` | 23,733,248 bytes | `12f018178060fe0a06e5d0a2a0718dcc92304bfd53c8c352b2f07e04f7c99847` |
| `Focused.Moment.Setup.v2.10.6.exe` | 16,127,835 bytes | `1ff296f072993cd5eebcaec02707ef15942ab48907f7ffbed1144725426f7542` |
| `Focused.Moment_2.10.6_x64_en-US.msi` | 17,108,992 bytes | `8cf8c8f3be892b1bb39a3b37f4dd7c24271fed7a4360f209fab956cfe9ab3b18` |
| `Focused.Moment_2.10.6_universal.dmg` | 34,262,117 bytes | `722f41b6a6f0c79b52c9e7ba690a81b9b54b2be298f818439c9709b56720ad90` |

- Windows 三项远端 digest 与本地 v2.10.6 构建产物一致；当前版本等待用户验收。
