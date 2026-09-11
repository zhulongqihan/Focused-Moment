# UX-AUDIT-01：五套主题逐页真实体验精修

状态：`COMPLETE`（2026-09-12）
体验基线：`b7cc70fbd5207a97f3b4a0cba232f5a722be1314` / v2.10.9
交付候选：v2.10.10
范围：Night Valley、Editorial Paper、Graphite Console、Aurora Ocean、Botanical Library；每套主题的今日、计时、待办、记录、设置。

## 验收方式

每个主题的每个 Tab 都完成三轮真实浏览器操作，共 25 页 × 3 轮 = 75 轮。浏览器通过本地 Vite 应用运行；Tauri 原生调用以本轮仅用于验收的本地 mock 提供真实数据状态，页面 DOM、Solid 状态、响应式 CSS 和点击/键盘行为仍由实际应用执行。

| 轮次 | 用户视角检查 | 全量结果 |
| --- | --- | --- |
| R1 | 首次进入、视觉主题、第一重点、信息含义、已有数据与首个入口 | 25/25 PASS |
| R2 | 该页主要动作与相邻流程，确认反馈、保存/暂停/编辑/切换状态 | 25/25 PASS；25 个主操作全部成功 |
| R3 | 560×860 窄窗口、强制滚动后切 Tab、键盘焦点与返回当前页 | 25/25 PASS；25/25 滚动复位，导航无越界 |

截图证据位于 `output/playwright/ux-audit/`，命名为 `<theme>-<tab>-r<round>.jpg`，例如 `aurora-ocean-records-r3.jpg`。

## 进度矩阵

| 主题 / Tab | R1 | R2 | R3 | 实际动作与结论 |
| --- | --- | --- | --- | --- |
| Night Valley / 今日 | PASS | PASS | PASS | 今日 → 记录入口 → 今日；首屏层级、入口连续性、窄屏导航均正常 |
| Night Valley / 计时 | PASS | PASS | PASS | 填写事项 → 开始 → 暂停 → 重置；计时卡片动作和返回可达 |
| Night Valley / 待办 | PASS | PASS | PASS | 打开新增 → 填写待办 → 保存；表单反馈和页面回顶正常 |
| Night Valley / 记录 | PASS | PASS | PASS | 编辑记录标题 → 保存；七日趋势、平均值和编辑反馈正常 |
| Night Valley / 设置 | PASS | PASS | PASS | 调整视觉强度 → 保存外观；分组锚点、保存反馈和窄屏可达 |
| Editorial Paper / 今日 | PASS | PASS | PASS | 今日 → 记录入口 → 今日；纸页层级和返回路径正常 |
| Editorial Paper / 计时 | PASS | PASS | PASS | 填写事项 → 开始 → 暂停 → 重置；动作状态和密度切换正常 |
| Editorial Paper / 待办 | PASS | PASS | PASS | 打开新增 → 填写待办 → 保存；编辑表单和第五个 Tab 在窄屏均可用 |
| Editorial Paper / 记录 | PASS | PASS | PASS | 编辑记录标题 → 保存；记录编辑和宽/窄布局正常 |
| Editorial Paper / 设置 | PASS | PASS | PASS | 调整视觉强度 → 保存外观；移动导航不换行，设置首屏可理解 |
| Graphite Console / 今日 | PASS | PASS | PASS | 今日 → 记录入口 → 今日；控制台状态层级和入口连续性正常 |
| Graphite Console / 计时 | PASS | PASS | PASS | 填写事项 → 开始 → 暂停 → 重置；工业仪表主动作清楚 |
| Graphite Console / 待办 | PASS | PASS | PASS | 打开新增 → 填写待办 → 保存；队列表单状态正常 |
| Graphite Console / 记录 | PASS | PASS | PASS | 选择信号日期 → 刷新事件日志；日期信号与日志反馈正常 |
| Graphite Console / 设置 | PASS | PASS | PASS | 调整视觉强度 → 保存外观；仅保留真实音频控件和快捷键 |
| Aurora Ocean / 今日 | PASS | PASS | PASS | 今日 → 记录入口 → 今日；光场层级和跨 Tab 返回正常 |
| Aurora Ocean / 计时 | PASS | PASS | PASS | 填写事项 → 开始 → 暂停 → 重置；潮汐计时动作正常 |
| Aurora Ocean / 待办 | PASS | PASS | PASS | 打开新增 → 填写待办 → 保存；卡片编辑和移动布局正常 |
| Aurora Ocean / 记录 | PASS | PASS | PASS | 编辑记录标题 → 保存；七日光点为可点击 HTML 控件 |
| Aurora Ocean / 设置 | PASS | PASS | PASS | 调整视觉强度 → 保存外观；设置锚点可到达 |
| Botanical Library / 今日 | PASS | PASS | PASS | 今日 → 记录入口 → 今日；阅读室首页重点和入口正常 |
| Botanical Library / 计时 | PASS | PASS | PASS | 填写事项 → 开始 → 暂停 → 重置；专注状态和密度正常 |
| Botanical Library / 待办 | PASS | PASS | PASS | 打开新增 → 填写待办 → 保存；书签式待办动作正常 |
| Botanical Library / 记录 | PASS | PASS | PASS | 编辑记录标题 → 保存；七日生长点为可点击 HTML 控件 |
| Botanical Library / 设置 | PASS | PASS | PASS | 调整视觉强度 → 保存外观；分组锚点和保存动作正常 |

## 发现的问题与根因级修复

| ID | 发现 | 根因 | 修复 |
| --- | --- | --- | --- |
| UX-01 | 从长记录/设置页切到其他 Tab 后，新页标题可能被旧滚动位置遮住 | 主壳层只更新 `activeView`，没有把滚动容器视为新页面目的地 | `MainShell.changeView` 在切换 Tab 后将 `document.scrollingElement` 滚回顶部 |
| UX-02 | 四套主题记录页展示未接入的导出按钮或日期筛选按钮 | 视觉占位被当作可见控件渲染，用户能看到但不能使用 | 移除无效按钮；可解释的最近 7 天范围改为静态文本 |
| UX-03 | Night Valley 快捷键列表仍有“导出记录 尚未接入”，Graphite 有静态伪造响应延迟 | 设置说明没有跟随功能真实边界维护 | 删除无行为快捷键和虚构指标 |
| UX-04 | Editorial Paper 560px 下第五个 Tab 会换到第二行 | 后置桌面 shell reset 用 `display:grid !important` 重新让品牌栏占据移动导航网格单元 | 在移动断点明确隐藏品牌栏，保留五个 Tab 同行 |
| UX-05 | Aurora Ocean / Botanical Library 图表日期点可见但点击区域为 0×0 | HTML `<button>` 被嵌入 `<svg>`，未形成可用的 HTML 布局盒 | 将日期按钮移到 SVG 外的绝对定位 HTML overlay，并恢复 pointer events |
| UX-06 | Graphite 环境音选择、多个主题的 F11 行没有对应产品行为 | 设置页把历史概念说明误当成已接入能力 | 删除无效选择器和不支持的快捷键说明，保留真实提醒音效与可执行动作 |

测试契约同步：Night Valley 记录测试从已删除的禁用 `.nv-records-range` 改为验证“最近 7 天”真实标签、无导出占位，并继续验证趋势和平均值。

## 终验结果

- 默认密度主审计：25 页 × 3 轮 = 75 轮；`actions=[]`、`navigation=[]`、`failures=[]`、`placeholders=0`、`overflow=[]`。
- 紧凑密度专项：5 套主题 × 5 个 Tab × 2 个视口 = 50 个组合；`count=50`、`failures=[]`。
- 设置页内部锚点：Night Valley、Graphite Console、Aurora Ocean、Botanical Library 共 20 个锚点全部存在且可到达；Editorial Paper 没有内部锚点。
- 图表日期点专项：Aurora Ocean 与 Botanical Library 首个日期点均取得非零 bounding box，点击后选中日期从 9/12 切换到 9/6。
- 人工视觉复核：五套主题关键设置/记录移动截图，未发现裁切、横向溢出、无效控件或导航换行。
- `pnpm check`：PASS；`pnpm build`：PASS，2062 modules。
- `pnpm test:frontend -- --workers=1`：67/67 PASS。
- `cargo fmt --all -- --check`、`cargo check --locked`、`cargo test --locked`：PASS；Rust 单测 33/33。
- `git diff --check`：PASS。

## 边界

- 本轮不触碰 `Focused Moment Backups`、Git 历史、v2.10.8/v2.10.9 已发布对象，也不重复删除已清理的本地生成物。
- Tauri 原生调用的本地 mock 只服务于浏览器验收数据接线；Windows/macOS 原生能力仍以已有发布验证为边界。
