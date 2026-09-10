# v2.10.3 · Night Valley 今日页曲线、时钟与概览卡

发布日期：2026-09-10

## 重点更新

- Night Valley 今日路径改为经过真实节点锚点的连续弧线：单节点和多节点都不再使用生硬直线段与直角，多节点路线采用更宽、更自然的绕行节奏。
- 日期后增加实时 `HH:MM:SS`，使用独立的无衬线数字字体，与日期和星期形成清晰层级。
- 右侧卡片由重复的计时跳转改为“今日概览”，显示今日专注投入、专注段数、连续节奏和待办完成进度；计时仍由第二个“计时”页负责。
- 保持上一轮已确认的底部总结安全区、Today 快速命令视觉入口移除、节点信息可见和其他页面/主题不变。

## 代码范围

- Today 路径、实时钟、概览卡：`src/components/TodayDashboard.tsx`、`src/App.css`
- Today 视觉与交互回归：`tests/today-visual.spec.mjs`、`tests/app.spec.mjs`
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`
- QA 证据：`docs/qa/REFINE-07-night-valley-today-v2.10.3.md`

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过，2061 modules transformed。
- Today 视觉 Playwright：29/29 通过。
- Today 应用交互定向 Playwright：4/4 通过。
- `cargo check --locked`：通过。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests、0/0 doc tests 通过。
- `pnpm test:frontend -- --workers=1`：60/60 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。

## 发布资产

- 便携 EXE：`Focused Moment v2.10.3.exe`，23,731,200 bytes，SHA-256 `A8FC2190C4D28C896A79C3BBE163EC6D430886BD65ECFF3055BA6CA5C0792B1C`。
- Setup/NSIS：`Focused Moment Setup v2.10.3.exe`，16,133,917 bytes，SHA-256 `EA88668E5210B80642BA2419B76229AA4492727548CE9926ED0FA6650FA42687`。
- MSI：`Focused Moment_2.10.3_x64_en-US.msi`，17,108,992 bytes，SHA-256 `FC058867A036B5F6643E7CBC8611C7E1DE30B9DBFC14E724BAFBD19AF93A8CF7`。
- macOS Universal DMG：待 GitHub Release workflow 上传后补录。

## 远程发布闭环

待发布后补录 v2.10.3 代码提交、tag、远程 Checks、macOS Native Smoke、Universal Release 和 GitHub Release 链接。
