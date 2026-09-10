# REFINE-06 follow-up · Night Valley 今日页全屏与路径回折

日期：2026-09-10
主题：第一套主题 Night Valley  / 夜谷
界面：今日 / 今日路径
版本：v2.10.2 发布版本
状态：v2.10.2 已发布，远程发布闭环完成，等待用户验收

## 用户反馈与问题复述

本轮截图是最大窗口下的 Night Valley 今日页。用户明确指出：

- 页面底部原有的总结句在全屏时仍然看不到，需要重新调整布局。
- 当前路径仍然过于平滑，硬性要求至少出现四个大于 90° 的弯折。

对应区域分别是地图底部的完成总结区，以及地图中央贯穿节点的金色路径。右侧卡片已经按上一轮要求改为下一节点信息并跳转第二个“计时”页，本轮不再改动。

## 根因判断

- 底部总结区经过多轮 CSS 叠加后同时继承了绝对定位、固定顶部偏移、高网格间距和底部定位；地图高度又随 `100dvh` 变化，导致文字被推到全屏视口的底部安全区之外。它不是数据没有返回，而是布局没有为内容保留稳定的可见区域。
- 路径生成函数在单节点分支和多节点分支都使用连续 `C` Bézier 段；单节点只有一段曲线，因此真实节点数量少时不可能出现用户要求的急转折。

## 实施范围

- `src/components/TodayDashboard.tsx`：保留真实节点坐标和节点语义；将路径改为折线生成器。单节点路径在抵达真实节点前固定经过四个以上、转向角大于 90° 的回折；多节点路径在每一段加入可测量的 switchback，并继续经过所有真实节点。
- `src/App.css`：仅在 Night Valley Today 选择器范围内，把底部总结改为固定在底部安全带内的内容流布局，恢复总结句和辅助说明的可见性，避免与添加按钮重叠。
- `tests/today-visual.spec.mjs`：增加无待办、单真实节点的 2560×1368 全屏夹具；断言总结句在视口内，并解析 SVG 路径断言至少四个 >90° 转折。
- `src-tauri/src/runtime.rs`：仅修正 Rust 测试辅助函数的合成时间锚点，改用墙上时钟模拟回退，避免测试依赖主机开机时长；生产计时引擎未改动。

## 明确不修改

- 不修改计时页、右侧下一节点卡片、待办/记录数据、MainShell 业务状态机或真实计时逻辑。
- 不修改 Night Valley 的其他四个页面、其他四套主题、背景图和素材。
- 不伪造任务或历史记录；不删除全局 `Ctrl+K` 命令面板能力；只保留 Today 左下角视觉入口的既有移除结果。

## 视觉与交互证据

- 全屏单节点截图：`output/playwright/today-fullscreen-refined.png`。
- 多节点参考截图：`output/playwright/today-after.png`。
- 全屏回归使用 2560×1368 视口；底部总结句的 bounding box 完整落在视口内，单节点路径解析出至少 4 个 >90° 转折。
- 现有 Today 右卡仍无 `.trail-timer`，查看计时入口仍进入第二个“计时”页；既有快速命令视觉入口仍隐藏。

## 已完成验证

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm exec playwright test tests/today-visual.spec.mjs --grep "Today (reference|fullscreen|keeps node|route keeps)"` | PASS，4/4 |
| `pnpm test:frontend -- --workers=1` | PASS，60/60 |
| `pnpm build` | PASS，2061 modules transformed |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests，0/0 doc tests |
| `pnpm package:release` | PASS，生成 v2.10.2 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |

首次 Rust 测试曾因测试辅助函数对 `Instant` 的开机时长假设得到 32/33；辅助函数改为墙上时钟后复跑为 33/33。该修正未触及生产计时逻辑。

## 本地发布资产

- 便携 EXE：`Focused Moment v2.10.2.exe`，SHA-256 `5217596FAF62FFCAFE04F3BBF041C6BC2A67B629F50C9A7090E83F0F9AEF50A2`。
- Setup/NSIS：`Focused Moment Setup v2.10.2.exe`，SHA-256 `C0BB9D6CC6D337844274EC9A5962DC803F6C2EAE68841A9B231F73D877C0926C`。
- MSI：`Focused Moment_2.10.2_x64_en-US.msi`，SHA-256 `016FED763CA9192B09DB966280F1FB56C76ABBDC11D526F2CB2FDC58AF017057`。

## 远程发布闭环

- 发布代码提交：`fef30c734cd689d5d81840bf79b6de4ba8fe6e1b`；`v2.10.2` tag 的 peeled commit 与该提交一致；`origin/main` 另包含最终证据文档跟随提交 `eee866b604f73ffc459ab0f6bca1a13729d8af80`。
- [Checks run 34422166056](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422166056)：PASS，前端 60/60，Rust check/test 通过。
- [macOS Native Smoke run 34422166055](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422166055)：PASS。
- [macOS Universal Release run 34422184750](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422184750)：PASS，Universal DMG 上传成功。
- [GitHub Release v2.10.2](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.2)：正式 Release，4 项资产均为 `uploaded`。

远端资产与本地构建产物核对如下：

- `Focused.Moment.v2.10.2.exe`，23,730,176 bytes，远端 digest `sha256:5217596faf62ffcafe04f3bbf041c6bc2a67b629f50c9a7090e83f0f9aef50a2`，与本地便携 EXE 一致。
- `Focused.Moment.Setup.v2.10.2.exe`，16,128,333 bytes，远端 digest `sha256:c0bb9d6cc6d337844274ec9a5962dc803f6c2eae68841a9b231f73d877c0926c`，与本地 Setup 一致。
- `Focused.Moment_2.10.2_x64_en-US.msi`，17,108,992 bytes，远端 digest `sha256:016fed763ca9192b09db966280f1fb56c76abbdc11d526f2cb2fdc58af017057`，与本地 MSI 一致。
- `Focused.Moment_2.10.2_universal.dmg`，34,258,189 bytes，远端 digest `sha256:1ed9e8fdd3abf6acc6ed0834e5a2dddf7e6467b5453b7681a152657cfcb70055`。
