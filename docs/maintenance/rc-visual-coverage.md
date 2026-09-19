# 2.12 RC 前端回归覆盖审阅

主线程追加实跑（2026-09-19）：完整267项单worker/零retry运行中，本文件覆盖的184项全部通过；全套另有1项应用键盘排序断言失败，不能宣称项目全通过。完整日志见 `artifacts/qa/checks/rc-20260919-130331-541dcaec/frontend-full.log`；最终修复后的完整运行以 `rc-20260919-review.md` 及最终验收报告为准。以下保留此前专项执行历史。

## 范围和结论边界

首轮所有权为 `app/tests/today-visual*` 和本文件。2026-09-19 用户追加授权后，本轮还修改 `UnifiedTodaySurface.tsx`、`80-continuity-workflow.css` 与 CSS canonical guardrail 的哈希/长度常量；不扩功能、不提交。未修改 ContinuityBoard、controller 或 Curie 的 app.spec。
`PROJECT_PLAN.md` 只读，开始及复核 SHA-256 均为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。
已有计划/源码改动及其他并行工作不纳入本轮所有权。测试期间工作树持续有外部更新；本文只对实际运行快照负责。
当前已包含授权的 UI 源码修复，但未构建交付：not rebuilt; entry unchanged。根 EXE 不是本轮源码的验证证据。没有 Rust 或 Windows 原生 GUI 通过声明。

## 根因和收集方式

旧文件的 `.legacy.mjs` 后缀不被默认匹配，101个独立测试全部退出默认回归。8项新测试无法替代旧几何、交互、刷新、设置、长历史和DPR检查。
在 `today-visual.spec.mjs` 显式导入旧模块，将101项重新注册；保留8项现有测试，新增75个独立矩阵用例，共184项。没有删除test注册、skip/fixme/only、减少主题、放宽几何阈值或增加重试。
旧模块保留文件名便于追溯，但内容已逐项迁移；原版可在Git HEAD读取。每个旧项现在有稳定 `RC-L001…RC-L101` 身份。

## 迁移依据和夹具修复

依据 `docs/maintenance/focused-moment-2.12.0-continuity.md` 的已实施边界以及 `UnifiedTodaySurface.tsx`、`ContinuityBoard.tsx`、`ThemePicker.tsx` 和控制器实际调用链：Today三层、最多3精选、移除虚假槽位与开发文案、真实主题预览、v3原生偏好持久化、默认不弹mini、记录增加详细编辑。
这些明确变化才允许调整预期；时钟、完整标题可读性、水平安全区和手动打开Focus后的运行态仍须验证。最新用户明确要求默认保留当前页（Today启动留Today），因此旧的自动切Focus预期属于冲突，不得修改产品去迎合旧测试。

旧mock补齐 `get/update_app_preferences`、`get/update_focus_plan`、v3记录/待办字段；sessionStorage仅模拟原生持久化以验证reload，不把应用localStorage兼容入口当作v3真值。修正60分钟格式化为01:00:00。保留每项独立的夹具/注入和原有性能规模。

## 追加授权后的修复与当前状态

- 实时钟复用 `NightValleyClock`，保持每秒更新、卸载清理、唯一可访问时间标签；等宽数字与日期分开呈现。
- 精选标题取消强制省略，当前事项支持无空格长词换行；推进区使用 `minmax(0, 1fr)`、可收缩/换行的标题与操作区，窄屏纵排不继承桌面的 flex-basis。
- RC-L026/028/030/037/046/099：真实点击后必须仍处Today且导航active；捕获实际 `start_timer` 调用时的标题和linkedTodoId=101，要求调用增加恰好1次和timer运行；再手动打开计时页，保留原暂停、运行态、关联标题及边界断言。此前把不跳转建议为controller缺陷的结论已撤回，无需Curie为此修改controller。
- CSS canonical：9模块，规范化长度445703，SHA-256 `646F193069898745892C48B363CE03590104ECB8007E457995FF26E081D11140`。只更新真实内容对应的常量；模块顺序、资源检查和精确hash/长度比较逻辑未改。
- 已执行：TypeScript `tsc --noEmit`、两份测试 `node --check`、CSS guardrail、Playwright输出guardrail、限定路径 `git diff --check` 均通过；`--list` 仍为184项/2文件。
- **原14个失败项定向复验：14 passed / 0 failed / 0 skipped / 0 flaky，retries=0，runner exit=0。** 用户确认Curie释放后执行，未运行完整184项；完整回归交由主agent。
- 首轮定向为10通过/4失败：RC-L026/028/030误用通用“暂停”名称，实际主题按钮分别是“暂停本段/暂停此潮/暂停这一页”；改为各主题精确名称，保留exact、可见性及运行态断言。RC-L095发现新Today时钟字体与其余四页不同；CSS改用同一等宽字体栈，原跨页字体一致性断言未改。
- 修正后重跑同一14项，不加入无关测试。实际开始2026-09-19 12:47:48（Asia/Shanghai），约91.6秒，workers=2。报告：`rc-visual-recheck14-20260919-final-targeted-r2/report.json`；首轮失败报告保留在`rc-visual-recheck14-20260919-final-targeted/report.json`。
- 本轮仅关闭由本次runner输出确认的自有webServer进程，未退出Curie进程；收尾检查1420/1442均无监听，可以交接主agent全量运行。

## 修复前执行记录

- 默认旧版恢复后的诊断运行：109项均输出结果，但webServer清理挂起，人工中断；不作完整通过证据。
- 首轮迁移：`rc-visual-migration-20260919-1210/report.json`，184项，145 passed / 39 failed / 0 skipped。包含已定位的测试自身缺陷，不能当最终结论。
- 完整复验：`rc-visual-review-20260919-1235/report.json`，**184项：170 passed / 14 failed / 0 skipped / 0 flaky**，retries=0。分组：恢复旧项87/101通过；原有当前项8/8通过；新增矩阵75/75通过。
- 最后仅修改RC-L043/047/095的统一日期选择器，并在RC-L063补足自动mini显式开启及reload持久化场景。定向串行复验 `rc-visual-targeted-20260919-1248/report.json`：4项，**1 passed / 3 failed / 0 skipped / 0 flaky**；失败全部到达真实时钟断言，日期存在性已通过。修复前最后已执行的唯一测试集合为170通过/14失败；这不是最后修改后再跑一次184项的声明。
- 完整复验时间：2026-09-19 12:19:11（Asia/Shanghai）开始，约7.2分钟；最后定向运行12:26:39开始，约1.1分钟。run ID是唯一标签，标签中的数字不替代report.json实际时间。
- 静态验证：两文件 `node --check`、`verify-playwright-output-guardrails.mjs`、限定所有权路径的 `git diff --check` 均通过。
- 本轮Vite子进程全部关闭，实测127.0.0.1:1420 TCP不可连接；可交接Curie继续浏览器测试。没有并行启动第二个Playwright服务器。

命令在真实 `F:\\Focused Moment\\app` 执行；`pnpm exec` 在本会话无法找到已安装的playwright shim，等价调用 `node node_modules/@playwright/test/cli.js test today-visual.spec.mjs --workers=4 --retries=0 --reporter=list,json`。
证据均在 `artifacts/qa/frontend/<唯一run-id>/`；截图使用 `testOutputPath → test.info().outputPath`，矩阵几何通过test附件保存。Windows sandbox中webServer退出清理挂起时，只终止本次工具输出确认的两个webServer node PID，随后runner正常生成报告；不终止用户应用/其他服务。

## 101项逐条映射

原始位置均在 `app/tests/today-visual-v2.11.11.legacy.mjs` 的本轮开始版本；新位置仍为同文件（由spec导入）。每行一对一，编号可用于 `--grep RC-Lxxx` 精确定位。未专门改写的项只做统一标题/ThemePicker选择器及公共v3夹具适配，保留原断言。

| ID | 旧行号及完整测试名 | 新测试名 | 迁移与覆盖目的 | 实跑结果（标明轮次） |
| --- | --- | --- | --- | --- |
| RC-L001 | L220 Today reference composition stays aligned at the concept viewport | Today reference composition shows three real continuity layers | 三卡片、真实待办/精选/7段投入替代8个轨道节点、streak及完成百分比；保留首屏与无计时条约束。 | PASS |
| RC-L002 | L237 Every theme carries one stable daily focus line on Today | Every theme carries one stable daily focus line on Today | 仅统一 Today 标题；保留五主题同日 copy-id 和品牌几何完全一致。 | PASS |
| RC-L003 | L286 Today fullscreen keeps the summary visible and uses a smooth winding route | Today fullscreen keeps real investment visible without a decorative route | 全屏单记录45分钟与投入卡片可见；按2.12移除曲线路径/节点，改为断言不存在。 | PASS |
| RC-L004 | L310 Today keeps node information visible and keeps timing in the focus tab | Today keeps current task information visible and timing reachable | 节点标题迁至当前事项；保留文字可见及计时页可达。 | PASS |
| RC-L005 | L322 Today route keeps the panel and path usable as the window narrows | Today continuity cards stay usable as the window narrows | 1280/1024 卡片边界、品牌与投入首屏取代路径/侧栏旧几何。 | PASS |
| RC-L006 | L352 Night Valley pages expose the measured reference surfaces | Night Valley pages expose the measured reference surfaces | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L007 | L370 Every theme keeps record day expansion stable during snapshot refresh | Every theme keeps record day expansion stable during snapshot refresh | 保留五主题日期组刷新后的展开状态，freshRecordSnapshots 夹具仍启用。 | PASS |
| RC-L008 | L417 Every theme uses the enclosed brand mark with its point in the orbit gap | Every theme uses the enclosed brand mark with its point in the orbit gap | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L009 | L462 REFINE-19 Editorial Paper keeps the sidebar mark and labels aligned across all five pages | REFINE-19 Editorial Paper keeps the sidebar mark and labels aligned across all five pages | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L010 | L511 Night Valley tabs share the live clock and hide the command trigger | Night Valley tabs share the live clock and hide the command trigger | 保留所有页面唯一时钟和命令入口隐藏；Today 缺钟不视为合法迁移。 | 修复前FAIL → 本轮定向PASS |
| RC-L011 | L523 Night Valley baseline records five-page geometry and environment metadata | Night Valley baseline records five-page geometry and environment metadata | Today root/surface改到统一页/continuity board；五页几何与环境证据保留。 | PASS |
| RC-L012 | L594 Night Valley baseline checks native-size and desktop-scale proxies | Night Valley baseline checks native-size and desktop-scale proxies | Today选择器迁移；原六种窗口/DPR × 五页面全部保留。 | PASS |
| RC-L013 | L652 Night Valley records explain the natural seven-day range and averages | Night Valley records explain the natural seven-day range and averages | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L014 | L676 Night Valley keeps one shared circular brand mark across every page | Night Valley keeps one shared circular brand mark across every page | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L015 | L729 Night Valley uses one shared sidebar tab module across every page | Night Valley uses one shared sidebar tab module across every page | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L016 | L775 Timer workspace keeps orientation useful and removes decorative state chrome | Timer workspace keeps orientation useful and removes decorative state chrome | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L017 | L791 Theme registry exposes five implemented surfaces and no disabled preview | Theme registry exposes five implemented surfaces and no disabled preview | 统一 ThemePicker；保存检验转到v3 mock存储并reload验证；仍为五主题。 | PASS |
| RC-L018 | L818 Graphite Console can be selected from settings and persists after reload | Graphite Console can be selected from settings and persists after reload | v3真实亮度/动效/密度控件替代旧缺席断言；验证主题原生偏好保存与reload。 | PASS |
| RC-L019 | L835 Graphite Console restores native window controls and a drag surface | Graphite Console restores native window controls and a drag surface | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L020 | L872 feedback toasts keep their position and dismissal behavior across themes | feedback toasts keep their position and dismissal behavior across themes | 主题自动保存改为静默；使用无进度完成快捷键触发真实toast，五主题位置/点击消失不变。 | PASS |
| RC-L021 | L906 Aurora Ocean keeps full labels and removes the stray archive ellipse | Aurora Ocean keeps full labels and removes the stray archive ellipse | Today完整标题迁至当前事项；保留记录页无椭圆及完整标题换行。 | PASS |
| RC-L022 | L939 an invalid persisted theme keeps the Night Valley surface available | an invalid persisted theme keeps the Night Valley surface available | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L023 | L952 Botanical Library persists as an implemented theme before rendering a page | Botanical Library persists as an implemented theme before rendering a page | 统一 Today标题/根选择器；保留预置主题与无降级页。 | PASS |
| RC-L024 | L965 Graphite Console renders all five pages inside the control surface | Graphite Console renders all five pages inside the control surface | 统一Today和设置控件；七段真实投入、一项精选、零虚假空槽；其余页面几何及操作不变。 | PASS |
| RC-L025 | L1016 Every theme keeps pending todos in date groups with only a done column | Every theme keeps pending todos in date groups with only a done column | 五主题日期分组/已完成列/今日完成率原断言保留。 | PASS |
| RC-L026 | L1053 Graphite Console keeps shared actions and page bounds usable at pressure widths | Graphite Console keeps shared actions and page bounds usable at pressure widths | 按最新明确要求启动后留Today，精确验证start调用和关联任务；手动打开Focus保留暂停/运行态断言；原四宽度×五页不变。 | 修复前FAIL → 本轮定向PASS |
| RC-L027 | L1092 Aurora Ocean renders all five pages inside the light field | Aurora Ocean renders all five pages inside the light field | Today改continuity board，设置改真实ThemePicker；五页宽度阈值/截图保留。 | PASS |
| RC-L028 | L1128 Aurora Ocean keeps shared actions and page bounds usable at pressure widths | Aurora Ocean keeps shared actions and page bounds usable at pressure widths | 同RC-L026；极光海面四宽度×五页保留。 | 修复前FAIL → 本轮定向PASS |
| RC-L029 | L1167 Botanical Library renders all five pages inside the reading room | Botanical Library renders all five pages inside the reading room | Today改continuity board，设置改真实ThemePicker；五页宽度阈值/截图保留。 | PASS |
| RC-L030 | L1203 Botanical Library keeps shared actions and page bounds usable at pressure widths | Botanical Library keeps shared actions and page bounds usable at pressure widths | 同RC-L026；植物书房四宽度×五页保留。 | 修复前FAIL → 本轮定向PASS |
| RC-L031 | L1242 Editorial Paper renders all five pages inside the desktop surface | Editorial Paper renders all five pages inside the desktop surface | 统一Today有独立标题层级；另外四个纸页的标题字号一致性仍要求完全一致。 | PASS |
| RC-L032 | L1280 Editorial Paper keeps the focus tab shell at the same desktop width | Editorial Paper keeps the focus tab shell at the same desktop width | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L033 | L1309 Editorial Paper keeps Today navigation colors, logo geometry, and plan date meaningful | Editorial Paper keeps Today navigation colors, logo geometry, and plan date meaningful | 保留导航颜色与品牌几何；旧DAILY PLAN日期改精确真实日期2026-09-05。 | PASS |
| RC-L034 | L1377 REFINE-19 TODAY-01 keeps Editorial Paper long node text readable | REFINE-19 TODAY-01 keeps long selected-task titles fully readable | 三条长精选标题替代旧长节点；增加桌面/窄屏非空数量断言，完整阅读约束不变。 | 修复前FAIL → 本轮定向PASS |
| RC-L035 | L1417 REFINE-19 TODAY-02 hides the visual command trigger but keeps Ctrl+K | REFINE-19 TODAY-02 hides the visual command trigger but keeps Ctrl+K | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L036 | L1431 REFINE-19 TODAY-03 keeps Editorial Paper Today whitespace bounded | REFINE-19 TODAY-03 keeps unified Today whitespace bounded | 统一header/board/card测量，保留间距≤32、首项首屏及无水平溢出阈值。 | PASS |
| RC-L037 | L1470 REFINE-19 TODAY-04 keeps timer work in the Editorial Paper focus page | REFINE-19 TODAY-04 starts the current task and exposes the Focus workspace | 按最新明确要求一次CTA实际开始并留Today；精确验证start时上下文，再手动打开Focus保留暂停、关联ID及无Today计时条断言。 | 修复前FAIL → 本轮定向PASS |
| RC-L038 | L1486 REFINE-19 TODAY-05 keeps Editorial Paper Today summary within the viewport | REFINE-19 TODAY-05 keeps all continuity summaries in the desktop viewport | 三个桌面尺寸逐卡底边不得越过视口；替代旧footer/facts/next-card安全区。 | PASS |
| RC-L039 | L1532 REFINE-19 TODAY-05 keeps the summary in document flow with long todo data | REFINE-19 TODAY-05 keeps bounded picks and all long-list data reachable | 21待办+5完成夹具不减；Today最多3精选和真实完成数，管理精选后待办完整21+5。 | PASS |
| RC-L040 | L1564 REFINE-19 TODAY-06 marks the Editorial Paper winding route as not applicable | REFINE-19 TODAY-06 exposes selected tasks without a winding route | 统一精选列表可见；路线元素仍严格为0。 | PASS |
| RC-L041 | L1576 REFINE-19 TODAY-07 keeps the Editorial Paper bottom summary visible | REFINE-19 TODAY-07 keeps the investment summary visible | 1707×912投入摘要替代旧facts摘要；上下边界断言不变。 | PASS |
| RC-L042 | L1593 REFINE-19 TODAY-08 marks the Editorial Paper hard route geometry as not applicable | REFINE-19 TODAY-08 exposes real selected-task rows without route geometry | 真实精选首行可见；路线元素仍严格为0。 | PASS |
| RC-L043 | L1605 REFINE-19 TODAY-09 Editorial Paper Today exposes a live clock after the date | REFINE-19 TODAY-09 Editorial Paper Today exposes a live clock after the date | 日期选择器迁统一Today；保留唯一实时钟+不同字体目的，日期通过、时钟失败。 | 修复前FAIL → 本轮定向PASS |
| RC-L044 | L1624 REFINE-19 TODAY-10 keeps real next-step value in the Editorial Paper side card | REFINE-19 TODAY-10 starts the actual current task with its linked ID | 精确当前任务标题、0轮0累计、单一CTA与真实start后关联101；移除虚拟45分钟/截止日侧卡。 | PASS |
| RC-L045 | L1638 REFINE-19 TODAY-11 records the undefined audit-plan item without inventing a UI issue | REFINE-19 TODAY-11 checks the documented unified heading without inventing an issue | 无定义审阅项仍只验证实际页面；统一标题的精确匹配保留。 | PASS |
| RC-L046 | L1649 Editorial Paper keeps shared actions and page bounds usable at pressure widths | Editorial Paper keeps shared actions and page bounds usable at pressure widths | 四个旧压力宽度×五页不減；真实CTA后留Today并验证start/关联任务，再手动打开Focus。 | 修复前FAIL → 本轮定向PASS |
| RC-L047 | L1686 REFINE-19 TIMER-01 gives every Editorial Paper tab the same live date and clock | REFINE-19 TIMER-01 gives every Editorial Paper tab the same live date and clock | 日期选择器兼容统一Today与其余四页；唯一时钟、窄屏导航边界与字体区别保持。 | 修复前FAIL → 本轮定向PASS |
| RC-L048 | L1732 REFINE-19 TIMER-02 keeps Editorial Paper timer hierarchy readable | REFINE-19 TIMER-02 keeps Editorial Paper timer hierarchy readable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L049 | L1776 REFINE-19 TIMER-03 keeps Editorial Paper lines semantic | REFINE-19 TIMER-03 keeps Editorial Paper lines semantic | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L050 | L1793 REFINE-19 TIMER-04 keeps Editorial Paper focus content in the full-screen safe area | REFINE-19 TIMER-04 keeps Editorial Paper focus content in the full-screen safe area | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L051 | L1850 REFINE-19 TIMER-05 keeps Editorial Paper timer fields explicit | REFINE-19 TIMER-05 keeps Editorial Paper timer fields explicit | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L052 | L1878 REFINE-19 TIMER-06 hides the command trigger on every Editorial Paper tab | REFINE-19 TIMER-06 hides the command trigger on every Editorial Paper tab | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L053 | L1901 REFINE-19 TIMER-07 makes Editorial Paper focus fields drive the real timer flow | REFINE-19 TIMER-07 makes Editorial Paper focus fields drive the real timer flow | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L054 | L1963 REFINE-19 TIMER-08 keeps long Editorial Paper focus-note text readable | REFINE-19 TIMER-08 keeps long Editorial Paper focus-note text readable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L055 | L1996 REFINE-19 TIMER-09 makes Editorial Paper reset explicit and usable | REFINE-19 TIMER-09 makes Editorial Paper reset explicit and usable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L056 | L2039 REFINE-19 TIMER-10 keeps keyboard actions global without a shortcut panel | REFINE-19 TIMER-10 keeps keyboard actions global without a shortcut panel | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L057 | L2067 REFINE-19 TIMER-11 keeps the Editorial Paper right note readable fullscreen | REFINE-19 TIMER-11 keeps the Editorial Paper right note readable fullscreen | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L058 | L2115 REFINE-19 TIMER-12 keeps a 01:00:00 Editorial Paper readout away from stats | REFINE-19 TIMER-12 keeps a 01:00:00 Editorial Paper readout away from stats | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L059 | L2167 REFINE-19 TIMER-13 keeps Editorial Paper status and mode copy separated | REFINE-19 TIMER-13 keeps Editorial Paper status and mode copy separated | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L060 | L2220 REFINE-19 TIMER-14 keeps Editorial Paper focus safe at Windows high DPI | REFINE-19 TIMER-14 keeps Editorial Paper focus safe at Windows high DPI | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L061 | L2275 REFINE-19 TIMER-15 uses the same daily session count on Today and Focus | REFINE-19 TIMER-15 uses the same daily session count on Today and Focus | 今日投入的1段完成与Focus原统计精确一致。 | PASS |
| RC-L062 | L2290 REFINE-19 TIMER-16 restores the Editorial Paper floating entry after returning | REFINE-19 TIMER-16 restores the Editorial Paper floating entry after returning | 入口更名打开迷你工作台，IPC改show_floating_todos；保留再次打开计数。 | PASS |
| RC-L063 | L2319 REFINE-19 TIMER-17 still opens the floating timer after Editorial Paper starts | REFINE-19 TIMER-17 keeps default manual mini and persisted automatic opt-in | 默认开始不自动打开；手动入口恰好打开1次；开启自动选项后reload仍选中，再开始恰好自动打开1次。 | PASS，末轮定向复核 |
| RC-L064 | L2342 REFINE-19 TIMER-18 delegates main-window hiding to the focus floating command | REFINE-19 TIMER-18 delegates explicit mini opening without directly hiding main | 显式mini打开恰好一次show_floating_todos且无hide_main_window；不再要求默认自动隐藏。 | PASS |
| RC-L065 | L2368 REFINE-19 TIMER-19 keeps the floating entry visible and clickable in Editorial Paper focus states | REFINE-19 TIMER-19 keeps the floating entry visible and clickable in Editorial Paper focus states | 新mini入口在运行/暂停时可见可点击，原首屏和计数约束保留。 | PASS |
| RC-L066 | L2408 REFINE-19 TIMER-20 keeps Editorial Paper timer and interface state synchronized | REFINE-19 TIMER-20 keeps Editorial Paper timer and interface state synchronized | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L067 | L2495 REFINE-19 TIMER-21 records when the Editorial Paper focus page has no matching records button | REFINE-19 TIMER-21 records when the Editorial Paper focus page has no matching records button | 回看记录入口改查看记录；Focus无旧记录按钮断言保留。 | PASS |
| RC-L068 | L2512 REFINE-19 TODO-01 checks Editorial Paper todo columns for overlap, bounded whitespace, and clear states | REFINE-19 TODO-01 checks Editorial Paper todo columns for overlap, bounded whitespace, and clear states | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L069 | L2571 REFINE-19 TODO-02 keeps a long completed todo list visible and actionable | REFINE-19 TODO-02 keeps a long completed todo list visible and actionable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | 修复前FAIL → 本轮定向PASS |
| RC-L070 | L2674 REFINE-19 TODO-03 keeps all three Editorial Paper window controls available | REFINE-19 TODO-03 keeps all three Editorial Paper window controls available | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L071 | L2733 REFINE-19 RECORDS-01 checks the Editorial Paper records first screen | REFINE-19 RECORDS-01 checks the Editorial Paper records first screen | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L072 | L2801 REFINE-19 RECORDS-02 keeps the Editorial Paper records hierarchy inside its theme boundary | REFINE-19 RECORDS-02 keeps the Editorial Paper records hierarchy inside its theme boundary | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L073 | L2848 REFINE-19 RECORDS-03 keeps 28-day Editorial Paper history navigable | REFINE-19 RECORDS-03 keeps 28-day Editorial Paper history navigable | 记录编辑按钮改名；原28天、展开、改名、删除、长标题/滚动检查保留。 | PASS |
| RC-L074 | L2950 REFINE-19 RECORDS-04 verifies Editorial Paper uses aligned natural-day bars | REFINE-19 RECORDS-04 verifies Editorial Paper uses aligned natural-day bars | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L075 | L3008 REFINE-19 RECORDS-05 keeps Editorial Paper history statistics non-duplicative | REFINE-19 RECORDS-05 keeps Editorial Paper history statistics non-duplicative | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L076 | L3051 REFINE-19 RECORDS-06 keeps all Editorial Paper records usable at scale | REFINE-19 RECORDS-06 keeps all Editorial Paper records usable at scale | 记录编辑按钮改名；原205条加载/204条删除后历史、有界滚动和窄屏检查保留。 | PASS |
| RC-L077 | L3164 REFINE-19 RECORDS-07 keeps all Editorial Paper window controls usable | REFINE-19 RECORDS-07 keeps all Editorial Paper window controls usable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L078 | L3224 REFINE-19 SETTINGS-01 keeps Editorial Paper settings copy and controls separated | REFINE-19 SETTINGS-01 keeps Editorial Paper settings copy and controls separated | ThemePicker替代swatches，workspace控件替代已移除footer；新增非空计数防止every([])通过。 | PASS |
| RC-L079 | L3276 REFINE-19 SETTINGS-02 exposes Editorial Paper appearance controls with visible effect | REFINE-19 SETTINGS-02 exposes Editorial Paper appearance controls with visible effect | 真实ThemePicker替代删除的模拟预览；原两滑条、密度和可见效果检查保留。 | PASS |
| RC-L080 | L3313 REFINE-19 SETTINGS-03 keeps Editorial Paper sound choices and custom sound flow usable | REFINE-19 SETTINGS-03 keeps Editorial Paper sound choices and custom sound flow usable | 明确移除内置趣味音效：6内置+1自定义；精确枚举全部保留选项、试听/导入/移除与3次保存。 | PASS |
| RC-L081 | L3386 REFINE-19 SETTINGS-04 replaces rhythm settings with useful workspace controls | REFINE-19 SETTINGS-04 replaces rhythm settings with useful workspace controls | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L082 | L3427 REFINE-19 SETTINGS-05 keeps Editorial Paper theme preview purposeful | REFINE-19 SETTINGS-05 exposes five real loaded theme previews | 虚构CSS预览改五张真实已解码图片、alt与选中主题；桌面/420边界保留。 | PASS |
| RC-L083 | L3465 REFINE-19 SETTINGS-06 makes Editorial Paper settings immediate and persistent | REFINE-19 SETTINGS-06 makes Editorial Paper settings immediate and persistent | v3主题保存替代localStorage和已删除状态文案；提醒失败回滚/再保存/reload/窄屏仍检查。 | PASS |
| RC-L084 | L3556 PERF-01 measures synthetic Editorial Paper history rendering | PERF-01 measures synthetic Editorial Paper history rendering | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L085 | L3612 Night Valley settings use a clear layout and auto-save useful choices | Night Valley settings use a clear layout and auto-save useful choices | 删除主题观测站改五张真实预览；6种合法音效与切换保存/reload不变。 | PASS |
| RC-L086 | L3647 Night Valley appearance settings explain when local saving fails | Night Valley appearance settings explain native preference save failures | 错误注入改原生update_app_preferences拒绝；断言alert错误和重试保存可达。 | PASS |
| RC-L087 | L3662 Night Valley secondary widths keep each page inside the viewport | Night Valley secondary widths keep each page inside the viewport | 设置根改ThemePicker；1280/1024其余边界不变。 | PASS |
| RC-L088 | L3690 Night Valley pressure widths preserve the first trail label and settings safety reachability | Night Valley pressure widths preserve current task and settings safety reachability | 路径首标题迁至当前事项；三压力尺寸五页和备份/清空键盘可达性保留。 | PASS |
| RC-L089 | L3760 Night Valley remains operable on a high-DPI desktop context | Night Valley remains operable on a high-DPI desktop context | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L090 | L3783 Night Valley timer fullscreen keeps the working workspace readable | Night Valley timer fullscreen keeps the working workspace readable | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L091 | L3810 Night Valley timer centers the records link label across viewport sizes | Night Valley timer centers the records link label across viewport sizes | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L092 | L3849 Night Valley timer keeps a one-hour readout separate from session facts | Night Valley timer keeps a one-hour readout separate from session facts | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L093 | L3881 Night Valley timer survives a scaled fullscreen CSS viewport | Night Valley timer survives a scaled fullscreen CSS viewport | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L094 | L3922 REFINE-19 SHELL-01 keeps shared window controls usable on every Editorial Paper tab | REFINE-19 SHELL-01 keeps shared window controls usable on every Editorial Paper tab | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L095 | L3972 REFINE-19 SHELL-02 keeps a live date and clock synchronized across Editorial Paper tabs | REFINE-19 SHELL-02 keeps a live date and clock synchronized across Editorial Paper tabs | 日期选择器迁统一Today；保留真实流逝时钟/五页一致，不以冻结时钟假装实时刷新。 | 修复前FAIL → 本轮定向PASS |
| RC-L096 | L4025 REFINE-19 SHELL-03 hides the visual command entry without removing Ctrl+K | REFINE-19 SHELL-03 hides the visual command entry without removing Ctrl+K | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L097 | L4048 REFINE-19 SHELL-04 keeps the Editorial Paper daily focus line visible and wrap-safe | REFINE-19 SHELL-04 keeps the Editorial Paper daily focus line visible and wrap-safe | 恢复原独立回归目的与全部断言；仅公共夹具/统一入口适配。 | PASS |
| RC-L098 | L4088 REFINE-19 adversarial current-data matrix keeps completed nodes, boundary widths, and history copy visible | REFINE-19 adversarial current-data matrix keeps completed tasks and history readable | 151待办+5完成数量不减；完成详情迁待办列，Today真实完成数；原821/420和历史长标题约束保留。 | 修复前FAIL → 本轮定向PASS |
| RC-L099 | L4163 REFINE-19 adversarial boundary matrix keeps every Editorial Paper surface inside the viewport | REFINE-19 adversarial boundary matrix keeps every Editorial Paper surface inside the viewport | 按最新要求start后留Today并精确验证调用/关联任务，再手动打开Focus检查暂停；所有旧页面边界/关联标题要求保留。 | 修复前FAIL → 本轮定向PASS |
| RC-L100 | L4223 REFINE-19 adversarial next-page card keeps an unbroken user title visible | REFINE-19 adversarial current card keeps an unbroken user title readable | 长无空格标题从旧next-card迁至current card，文本/overflow-wrap/边界阈值不变。 | 修复前FAIL → 本轮定向PASS |
| RC-L101 | L4256 REFINE-19 TODAY-01 adversarial narrow view keeps todo importance visible | REFINE-19 TODAY-01 keeps task importance reachable in narrow Todos | 优先级移至待办页真实due/importance行，通过管理精选到达；保留可见几何和中优先级语义。 | PASS |

## 五主题五页面宽度矩阵

五主题：night-valley、editorial-paper、graphite-console、aurora-ocean、botanical-library。
五页面：today、focus、todos、records、settings。宽度：1487、1024、560；高度分别1058、900、900。
每个组合独立test（75项），精确验证主题/激活导航、页面存在与左右边界、文档不横溢、5个导航和3个窗口按钮可见可用；再验证页面真实业务信息或五张主题图像解码，保存全页截图与几何附件，并要求无pageerror。
这些是Chromium+Tauri mock布局与交互证据；不是像素基准比对，也不证明Windows原生窗口/文件/音频功能。

## 修复前问题证据与定向修复结果

修复前14个失败项保持启用；源码修复和冲突迁移已实施，现已定向14/14通过。不存在已剔除测试；没有把所有源码差异都解释为需求冲突。

| 问题 | 测试ID | 实际证据、根因与交接建议 |
| --- | --- | --- |
| Today实时钟消失 | RC-L010、043、047、095 | 统一Today真实日期存在，但 `time[aria-label^="当前时间"]` 为0而非1。新 `UnifiedTodaySurface.tsx:14` 只渲染日期/日标签，未接入原页面时钟。2.12文档未明确要求删时钟，不能自动豁免。追加授权后已复用共享时钟，并统一字体栈；对应4项定向通过。 |
| 旧自动切Focus预期与最新用户要求冲突 | RC-L026、028、030、037、046；RC-L099含同类后续断言 | 历史证据证明start真实运行但留在Today。最新用户明确要求留在当前页，因此撤回自动切Focus的源码修复建议；6项现验证留Today、真实start调用及关联ID/标题，再手动进入Focus。未改controller，6项迁移定向通过。 |
| 精选长标题截断 | RC-L034 | 1487px时标题scrollWidth=848、clientWidth=191；420px时clientWidth=88。CSS `80-continuity-workflow.css:50` 明确nowrap+hidden+ellipsis。旧完整阅读目的仍有效；现已改自然换行；桌面/420px完整标题原断言通过。 |
| 长数据待办横向越界 | RC-L069、098、099 | 420px得到文档宽484（要求≤421）；821px得到831（≤822）及878（原容差≤824）。RC-L099截图明确显示新增FocusPlanControls操作区跑到卡片/视口右侧。其flex行、按钮区与断点未在可用宽度不足时正确收缩/换行；建议修复该共享模块响应式布局，继续保留全部长数据和旧阈值。共享CSS修复后3项定向全部通过，原数据规模与阈值均保留。 |
| 当前事项无空格长标题CSS契约差异 | RC-L100 | 完整文本和scrollWidth≤clientWidth已通过，但原 `overflow-wrap:anywhere` 得到normal。这证明旧换行CSS契约未保留，不能据此单独声称已发生视觉截断；现已恢复anywhere规则，原完整文本/换行/边界断言定向通过。 |

源码定位按本轮读取：`app/src/components/UnifiedTodaySurface.tsx`、`ContinuityBoard.tsx`、`FocusPlanControls.tsx`、`app/src/styles/80-continuity-workflow.css` 与 `app/src/features/shell/useMainShellController.ts`。控制器为Curie并行所有权，本轮未修改。

报告中的旧项PASS代表该测试实际执行通过；某项FAIL会停止该项后续断言，因此不能声称失败用例的后续分支也已执行。75格矩阵使用短业务标题，全部通过不能覆盖或抵消旧长数据压力测试失败；非像素快照基线，不承诺所有细节视觉一致。

## 明确冲突的旧断言清单

这里替换的是断言对象/行为，不删除测试注册：

- 自动切换Focus：RC-L026/028/030/037/046/099，依据2026-09-19最新用户明确要求“默认留当前页，Today启动留Today”。用真实start调用、调用时关联上下文、运行快照、Today可见和active导航替代自动跳转；原Focus可达性、运行态与关联标题通过手动导航继续覆盖。

- 轨道节点数量、曲线控制点、旧主题Today结构、旧摘要/侧卡：RC-L001/003/004/005/021/024/027/029/033/034/036/038/039/040/041/042/044/045/061/088/098/100/101。按统一三层Today验证真实数据、上限3精选、无虚假槽位；原长列表/完成项/重要度移到真实待办入口继续验证。
- 五主题Today各自标题：所有相关启动与reload断言改精确统一标题；每日一句稳定性、品牌几何和其他四页面依旧验证。
- 主题选择旧CSS组件、模拟样式预览、主题观测站/保存状态文案：RC-L017/018/024/027/029/078/079/082/083/085/087。改为统一ThemePicker及真实图像、schema v3保存和新真实工作台控件；没有降低五主题数量。
- 旧主题切换成功toast：RC-L020。自动保存静默后用真实完成快捷键错误反馈触发toast，保留五主题几何、定位、点击消失断言。
- 默认自动悬浮及旧专注浮窗IPC/名称：RC-L062/063/064/065。默认不打开、显式打开、开启选项并reload后自动打开都执行；仍要求精确调用次数且不直接hide_main_window。
- 已移除趣味音效：RC-L080/085。旧7内置变为6内置，精确枚举合法选项并继续验证自定义音效全流程，不以放宽数量比较处理。
- 记录“编辑”变“改名”、Today“回看记录”变“查看记录”：RC-L073/076/067仅改精确入口名，旧编辑/删除/长历史/可达性验证保留。
- 本地外观保存由localStorage迁到原生v3：RC-L017/018/083/085/086改验证真实新IPC及失败重试UI；不是忽略保存失败。

## 证据入口与交接

- [本轮原14项全部通过JSON报告](../../artifacts/qa/frontend/rc-visual-recheck14-20260919-final-targeted-r2/report.json)
- [本轮首轮10通过4失败JSON报告](../../artifacts/qa/frontend/rc-visual-recheck14-20260919-final-targeted/report.json)

- [完整184项JSON报告](../../artifacts/qa/frontend/rc-visual-review-20260919-1235/report.json)
- [末轮4项定向JSON报告](../../artifacts/qa/frontend/rc-visual-targeted-20260919-1248/report.json)
- [首轮迁移JSON报告](../../artifacts/qa/frontend/rc-visual-migration-20260919-1210/report.json)
- [821px待办越界截图](../../artifacts/qa/frontend/rc-visual-review-20260919-1235/today-visual--RC-L099-REFI-926db-surface-inside-the-viewport-chromium/qa/REFINE-19/adversarial-boundary-待办-821.png)

证据目录被Git忽略，交接机器上可直接打开；提交本报告不意味着截图已发布。表中的定位采用稳定测试ID而非测试行号，避免迁移后漂移。

修复前报告对应的测试文件SHA-256（历史，不是本轮文件）：
- `today-visual-v2.11.11.legacy.mjs`：`4421072DD77EDC7F9C3FA7F3E995D26E0E4CCF223458B99173A61353ACB02DB2`
- `today-visual.spec.mjs`：`DD937B13F394971B86065922D4679FCF4835E3EBAD4493BAF5433E27CDC85705`

`PROJECT_PLAN.md`按用户只读保护保持原哈希/原diff，未暂存、未提交。未改app.spec、controller、ContinuityBoard、打包入口或其他维护文档；未commit/push。本轮UI修复和6项冲突迁移已完成静态检查及原14失败项定向复验（14/14通过）；**不是最终源码全套184项通过的声明**。按用户要求不重复全套，由主agent执行最终全量；Rust与Windows原生GUI应独立报告。

本轮 legacy 测试 SHA-256：`049B9684AB4CDB34977339C0DC05B165040FC9E95757E42EA244AC52DC328B9A`。
