# v2.10.2 · Night Valley 今日页全屏与路径回折修正

发布日期：2026-09-10

## 重点更新

- 修正 Night Valley 今日页在最大窗口中底部总结句落出可视安全区的问题；总结句、辅助说明和路径进度轨迹现在位于稳定的底部内容带内。
- 今日路径从连续 Bézier 波形改为保留真实节点锚点的折线 switchback；单节点也会经过至少四个大于 90° 的明显回折，避免少量数据时只显示一段平滑浅弧。
- 保留上一轮的节点信息可见、Today 快速命令视觉入口移除和右卡“下一段专注 / 查看计时”职责；计时仍由第二个“计时”页承载。
- 修正一个只存在于 Rust 测试辅助函数中的主机开机时长假设，避免本地测试因 `Instant` 回退溢出而产生假失败；生产计时状态机未改变。

## 代码范围

- Today 路径生成与全屏布局：`src/components/TodayDashboard.tsx`、`src/App.css`。
- Rust 测试辅助稳定性：`src-tauri/src/runtime.rs`。
- 全屏文案/路径几何断言与 mock：`tests/today-visual.spec.mjs`。
- QA 证据：`docs/qa/REFINE-06-night-valley-today-v2.10.2.md`。

## 验证

- `pnpm check`：通过。
- Today 定向 Playwright：4/4 通过，含 2560×1368 全屏单节点文案可见和至少四个 >90° 路径转折断言。
- `pnpm test:frontend -- --workers=1`：60/60 通过。
- `pnpm build`：通过，2061 modules transformed。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests、0/0 doc tests 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。
- `git diff --check`：通过。

## 发布资产

- 便携 EXE：`Focused Moment v2.10.2.exe`，SHA-256 `5217596FAF62FFCAFE04F3BBF041C6BC2A67B629F50C9A7090E83F0F9AEF50A2`。
- Setup/NSIS：`Focused Moment Setup v2.10.2.exe`，SHA-256 `C0BB9D6CC6D337844274EC9A5962DC803F6C2EAE68841A9B231F73D877C0926C`。
- MSI：`Focused Moment_2.10.2_x64_en-US.msi`，SHA-256 `016FED763CA9192B09DB966280F1FB56C76ABBDC11D526F2CB2FDC58AF017057`。

## 远程发布闭环

- 发布代码提交：`fef30c734cd689d5d81840bf79b6de4ba8fe6e1b`；`v2.10.2` tag 的 peeled commit 与该提交一致；`origin/main` 另包含最终证据文档跟随提交 `eee866b604f73ffc459ab0f6bca1a13729d8af80`。
- [Checks run 34422166056](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422166056)：PASS，前端 60/60，Rust check/test 通过。
- [macOS Native Smoke run 34422166055](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422166055)：PASS。
- [macOS Universal Release run 34422184750](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34422184750)：PASS，Universal DMG 上传成功。
- [GitHub Release v2.10.2](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.2)：正式 Release，4 项资产均为 `uploaded`。

远端资产摘要：

- `Focused.Moment.v2.10.2.exe`：23,730,176 bytes，`sha256:5217596faf62ffcafe04f3bbf041c6bc2a67b629f50c9a7090e83f0f9aef50a2`。
- `Focused.Moment.Setup.v2.10.2.exe`：16,128,333 bytes，`sha256:c0bb9d6cc6d337844274ec9a5962dc803f6c2eae68841a9b231f73d877c0926c`。
- `Focused.Moment_2.10.2_universal.dmg`：34,258,189 bytes，`sha256:1ed9e8fdd3abf6acc6ed0834e5a2dddf7e6467b5453b7681a152657cfcb70055`。
- `Focused.Moment_2.10.2_x64_en-US.msi`：17,108,992 bytes，`sha256:016fed763ca9192b09db966280f1fb56c76abbdc11d526f2cb2fdc58af017057`。
