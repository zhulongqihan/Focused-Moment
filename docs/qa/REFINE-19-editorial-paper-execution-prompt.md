# 新窗口执行提示词：REFINE-19 编辑纸页逐问题核查

请在 F:\Focused Moment 继续执行 REFINE-19。你必须把项目内的编辑纸页五页按照执行计划逐条核查并修复，不能把问题合并成笼统的“整体优化”。

开始前严格按以下顺序读取：

1. C:\Users\yang\.codex\attachments\889ea1d2-6eda-46fa-8a91-7f2b05030a7c\goal-objective.md
2. F:\Focused Moment\AGENTS.md
3. F:\Focused Moment\PROJECT_PLAN.md
4. F:\Focused Moment\docs\context_summary_20260913_2131.md
5. F:\Focused Moment\THEME_REFINEMENT_PROMPT.md
6. F:\Focused Moment\docs\qa\REFINE-19-editorial-paper-issue-audit-plan.md

目标资料、历史 QA 和截图只是背景资料；当前源码、Git 状态、远程 Release/Checks 和本消息优先。不要重复构建、测试或发布 v2.10.18。

## 最高优先级边界

- 主题是 Editorial Paper / 编辑纸页。
- 编辑纸页风格必须保留：纸张质感、字体、配色、插图、排版语言和空间构图都不能被重做或替换。
- 只检查第一主题历史问题在编辑纸页中是否出现同类现象。
- 复现才修复；没有复现就记录 PASS 或不适用，不要为了对应 Night Valley 而新增功能。
- 不复制 Night Valley 的山谷路径、主题观测站或其他专属设计。
- 不伪造任务、记录、统计、系统指标或截图数据。
- 不停止用户进程。任何 Windows 原生验证前重新检查 PID、路径和单实例状态。
- macOS 更新已冻结：不构建、不上传、不运行任何 macOS workflow。

## 必须逐条执行

执行计划中的每一个编号都要单独填写：

- 原始问题原文；
- 编辑纸页对应区域；
- 复现数据或状态；
- 是否复现；
- 根因；
- 实际修改；
- 未修改范围；
- 定向测试；
- 截图证据；
- 最终状态。

不能用“布局问题”“交互问题”“整体已优化”替代编号结果。

## 页面顺序

严格按以下顺序推进：

1. 今日：TODAY-01 至 TODAY-11
2. 计时：TIMER-01 至 TIMER-21
3. 待办：TODO-01 至 TODO-03
4. 记录：RECORDS-01 至 RECORDS-07
5. 设置：SETTINGS-01 至 SETTINGS-06

每页开始前先检查调用链、真实数据、现有样式和测试；先找根因，再在编辑纸页组件或主题 CSS 内做最小修改。若确定是共享壳层问题，只在有证据时修改共享代码，并跑跨主题回归。

## 验证要求

每页至少验证 1487×1058、1120×760、820×720、560×720、420×720；计时和记录还要覆盖 2560×1368 物理全屏代理、Windows 高 DPI CSS 视口、长数据和真实操作状态。

每页完成后先跑定向 Playwright 和截图检查。五页全部完成后再跑一次完整前端回归、pnpm check、Vite build、Rust fmt/check/test、一次 Windows 打包和远程 Windows Checks。

同一页的问题集中处理，不按单个小 bug 单独提交、推送或发布。用户可见改动要 bump patch 版本并同步全部版本源、QA 文档、Release notes 和 PROJECT_PLAN.md。文档跟随提交使用 [skip ci]。

## 现在开始

先只做阶段 0 的状态核对和 Editorial Paper 当前源码/测试入口确认，然后从 TODAY-01 开始逐条复现。不要先修改代码，也不要先给泛泛的设计建议。每完成一个页面，汇报该页每个编号的结果和定向测试，再进入下一页。
