# REFINE-03 · Graphite Console 主题精修证据

日期：2026-09-09

## 目标

用户指出 Graphite、Aurora、Botanical 的旧实现主要是换色，偏离概念图与“风格迥异”的要求。本证据只覆盖第一套精修主题 Graphite Console，不代表 Aurora Ocean 或 Botanical Library 已完成。

## 设计核对

- 工业控制台语言：硬边金属面板、铆钉/螺钉、倒角、荧光绿/橙信号、序列槽位与本地状态栏。
- 今日页：7 个序列槽位；真实待办显示真实内容，缺少任务时显示 `OPEN SLOT / 待排定`，不制造业务数据。
- 计时页：中心实体仪表盘、运行日志、会话配置与实体操作按钮轨。
- 待办页：`QUEUED / ACTIVE / DONE` 三座任务舱，右侧 `NEXT FOCUS` 操作模块。
- 记录页：7 日信号图、事件日志、基于真实记录时间与时长计算的时段分析、长期趋势。
- 设置页：系统模块导航、外观矩阵、行为/音频/快捷键/本地数据面板。
- 业务状态仍由 `MainShell` 提供；本轮只改变 Graphite 的视图、样式和视觉回归，不复制计时、存储或待办状态机。

## 代码范围

- `src/components/GraphiteConsoleViews.tsx`
- `src/components/GraphiteConsoleViews.css`
- `tests/today-visual.spec.mjs`
- 版本源：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`
- 说明：`README.md`、`docs/data-portability.md`、`docs/v2.9.2/RELEASE_NOTES.md`

## 验证结果

- `pnpm check`：PASS。
- Graphite 定向回归：3/3 PASS；覆盖主题持久化、五页截图/几何、1120/820/560/420px 压力宽度与共享开始计时动作。
- 新增结构断言：7 个序列槽位、6 个空闲槽位、3 座任务舱、Graphite 激活导航硬边、ADD TASK 按钮不被标题网格拉伸。
- 完整前端回归：并行首轮 57/58；唯一 Editorial 压力用例因加载阶段超时单独串行重跑 1/1 PASS，合计 58/58。
- `pnpm build`：PASS，2061 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，33/33 library tests。
- `pnpm package:release`：PASS，生成 v2.9.2 Windows EXE、NSIS 和 MSI；旧 v2.9.1 产物清理有文件占用警告，但不影响新产物。

## 视觉证据

- Graphite 五页截图与几何：`output/qa/TH-03/1c8fc9c/`。
- 截图复核重点：今日页七槽位与序列机箱、计时页中心仪表、待办页三舱阵列、记录页信号监控、设置页系统模块布局。

## 未覆盖

- Aurora Ocean、Botanical Library 尚未精修。
- GitHub Checks `34350535611`、macOS Native Smoke `34350535428`、macOS Universal Release `34350728878` 均 PASS；GitHub Release `v2.9.2` 已发布并核对 Windows EXE/Setup/MSI 与 macOS Universal DMG 四项资产，digest 与资产链接见 `docs/v2.9.2/RELEASE_NOTES.md`。
