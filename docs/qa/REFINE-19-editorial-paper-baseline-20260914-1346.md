# REFINE-19 Editorial Paper 阶段 0 基线

检查时间：2026-09-14 13:46:31 +08:00
检查范围：阶段 0 状态核对与 Editorial Paper 当前入口确认
本记录不重复构建、测试或发布 v2.10.18，不运行 macOS workflow，不停止用户进程。

## Git 与版本

- 分支：`main`
- HEAD：`9ecaf5984b72f4d2731b2133927ad7019c192634`
- `origin/main`：`9ecaf5984b72f4d2731b2133927ad7019c192634`
- 工作树：干净（`git status --short --branch` 仅显示 `## main...origin/main`）
- 最近提交：`9ecaf59 docs: add editorial paper audit plan [skip ci]`、`1189cd7 docs: close v2.10.18 release evidence [skip ci]`、`6e8a076 refine: rebuild night valley settings workspace`
- GitHub remote：`git@github.com:zhulongqihan/Focused-Moment.git`
- 应用版本：`2.10.18`
- 版本源：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs` 均为 `2.10.18`
- tag：`v2.10.18` annotated tag peeled commit 为 `6e8a076e9864a19a8e390e432ff8384aef0e5462`，未修改
- Release：`v2.10.18` 为正式 Windows-only Release，三项资产状态均为 `uploaded`
- Windows Checks：run `34774739411`，head SHA `6e8a076e9864a19a8e390e432ff8384aef0e5462`，结论 `success`

## 文件与生成物统计

- tracked：307
- untracked：0
- ignored：56,272
- 主要目录体量（当前本地值）：`src` 5,149,182 B；`src-tauri` 13,837,599,087 B（含本地 target）；`public` 10,313,766 B；`docs` 105,432,742 B；`tests` 120,262 B；`output` 585,039,081 B；`dist` 15,229,306 B；`.release` 3,469 B；`.playwright-cli` 44,046,608 B；`test-results` 45 B；`node_modules` 144,357,978 B。
- 可用命令来自当前 `package.json`：`pnpm check`、`pnpm test:frontend`、`pnpm build`、`pnpm package:release`、`pnpm tauri build`。
- `scripts/audit_project_state.py` 当前不存在；未伪造其结果，改用上述只读状态与手工来源优先级核对。

## 用户进程保护

- 发现用户进程：PID `23304`，路径 `F:\Focused Moment\Focused Moment v2.10.18.exe`。
- 该进程及其 WebView2 子进程保持运行；本轮不停止、不重启、不接管。
- 当前未发现项目 Vite、Playwright、pnpm 或 cargo 服务进程。

## Editorial Paper 当前入口

- `src/components/ThemeSurface.tsx`：以 `editorial-paper` 显式分派五个 Editorial Paper 页面。
- `src/components/EditorialPaperViews.tsx`：导出 `EditorialPaperToday`、`EditorialPaperFocus`、`EditorialPaperTodos`、`EditorialPaperRecords`、`EditorialPaperSettings`。
- `src/components/EditorialPaperViews.css`：Editorial Paper 主题边界、纸张材质、文档流导航、五页布局及 1120/820/540 断点。
- `src/MainShell.tsx`：统一提供 timer/todos/records/settings、实时刷新、窗口控件、导航、浮窗与备份动作；本轮先不改业务状态机。
- 现有测试入口：`tests/today-visual.spec.mjs` 的 Editorial Paper 五页构图/压力宽度/PERF 用例，`tests/app.spec.mjs` 的共享窗口、计时、待办、记录和设置行为用例。

## 阶段 0 结论

- 状态对账：通过；当前 HEAD 与远程一致，工作树干净。
- v2.10.18：只读保护；不重复构建/测试/发布。
- macOS：继续冻结；不构建、不上传、不运行任何 macOS workflow。
- 进程：用户进程保持运行；后续如需 Windows 原生验证，先重新核对 PID、路径和单实例状态。
- 下一步：严格按“今日 → 计时 → 待办 → 记录 → 设置”，从 `TODAY-01` 逐条复现；每条填写原话、区域、复现结果、根因、修改、未修改范围、测试、截图证据和最终状态。
