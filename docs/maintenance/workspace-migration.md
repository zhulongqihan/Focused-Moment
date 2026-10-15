# Workspace/app 分离迁移记录

状态：完成（结构迁移、提交推送、根 EXE 重建、原生验证和复验均已通过）。

## 约束

- 仓库根仍为 `F:\Focused Moment`，不移动或重建 `.git`，不创建第二套仓库、镜像或 Junction。
- `PROJECT_PLAN.md`、`Focused Moment Backups/`、真实用户数据和未知私人资料保持原位；本记录不替代它们，也不修改其字节。
- 迁移前已存在且原来被 `.gitignore` 保护的本地设计分析和开发记录仍留在 `docs/` 原位；它们不进入本次提交，避免把未知本地资料上传到 GitHub。
- 应用命令从 `app/` 执行；固定交付入口仍是根目录 `Focused Moment.exe`。
- 本轮不运行安装器，不创建 tag/Release，不上传安装包。

## 实际迁移映射

| 原位置 | 目标位置 | 处理理由 |
| --- | --- | --- |
| 根 `index.html`、`package.json`、`pnpm-lock.yaml`、前端/资源/测试/脚本/配置 | `app/` 对应位置 | 完整应用工程唯一入口 |
| 根 `dist/`、`node_modules/`、`src-tauri/target/` | `app/` 对应构建/依赖位置 | 保留现有依赖和中间缓存，不升级版本 |
| 根 `.vscode/`、`.impeccable/` | `app/` 对应开发配置 | 应用开发配置不再散落外层 |
| `PRODUCT.md`、`THEME_REFINEMENT_PROMPT.md` | `docs/product.md`、`docs/prompts/` | 正式产品说明和提示词 |
| `docs/qa/`、根 `output/qa/`、根 `test-results/`、`.playwright-cli/` | `archive/reports/qa/`、`archive/qa/` | 已有历史测试生成物，保留但不混入正式文档 |
| 根 `output/*.mjs`、`output/playwright/*.mjs` | `app/scripts/visual-audit/` | 仍是开发工具，输出改为唯一运行目录 |
| `output/xiaohongshu/` | `local/marketing/xiaohongshu-20260916/` | 明确命名的本地营销草稿，不作为应用数据 |
| `.release/local/` | `artifacts/builds/local-history/` | 保留历史 provenance 原文 |
| `.release/archive/` | `archive/executables/local-history/` | 保留历史入口恢复副本 |
| `.release` 其余内容 | `archive/release-history/.release/` | 保留旧记录的原始层级和事实 |
| 根旧 Setup/portable EXE（不含当前固定入口） | `archive/executables/legacy-programs/` | 文件名与类型已核实，迁移前先保留校验 |
| `docs/context_summary_*`、过期维护清单、版本目录中的测试/计划材料 | `archive/context-summaries/`、`archive/reports/` | 历史记录归档，不篡改内容 |

完整文件级大小、SHA-256、原路径和目标路径见 `archive/MIGRATION_MANIFEST.json`。旧构建记录本身不改写；新增路径只在本记录和迁移清单中表达。

## 风险与控制

- 旧 QA fixture 中存在迁移前生成的 Junction，且目标已不再存在；迁移时以目录级操作保留它，没有创建新链接，也没有让当前工程依赖它。
- `node_modules` 是 pnpm 依赖目录，未手工搬动其内部链接、未升级依赖；移动后只从 `app/` 运行锁文件安装/检查。
- 应用路径变化会改变构建输入，因此最终根 EXE 必须由 `app` 的真实 Release 构建重新生成，并以新的 provenance 和 SHA-256 验收；旧根入口由交付脚本写入归档恢复副本。
- 运行测试只使用 Playwright mock、临时 fixture 和隔离 Windows native 目录，不访问 `%LOCALAPPDATA%\FocusedMoment` 真实数据，也不读取备份内容。

## 最终验收结论

- 外层已经完成物理分区：应用工程仅在 `app/`；正式文档在 `docs/`；当前构建/验证证据预留在 `artifacts/`；历史材料在 `archive/`；明确本地资料在 `local/`。
- `app` 已通过 `pnpm verify`、`pnpm build`、锁文件冻结安装后的依赖解析、以及 35 项 Rust 单元测试；全量 Playwright 为 143/146，3 项仅发生并发导航超时，按原断言单 worker 隔离重跑为 3/3 通过。
- `pnpm test:local-delivery` 的 7 个本地交付契约用例通过；根目录 EXE 和 Windows 原生冒烟已在提交后的干净应用源码快照上重建并验证。
- 根目录 EXE 已从提交 `e863e930c9f5ec85bca9b31511acb78f57c2b750` 的 `app/` 工程重建：build ID 为 `local-20260918-110633-6ee14f8490`，候选文件为 `app/src-tauri/target/release/focused-moment.exe`，根入口为 `Focused Moment.exe`，两者 SHA-256 均为 `7D78C060DE23472926F3F8C7D88BD627F635061E3754B7A713EBB370FF3CBEF2`。完整 provenance 在 `artifacts/builds/local/local-20260918-110633-6ee14f8490/manifest.json`。
- 重建前的根入口已恢复性归档至 `archive/executables/local/local-20260918-110633-6ee14f8490/Focused Moment.exe`，原 SHA-256 为 `CD502B2CEFCCBD9745FCFF59D8F4CF0BF4ABC96A1BF8F661FDA09B2954EDA1F0`；更早的初始根入口也保留在 `archive/executables/local/local-20260918-103807-46a19d6d2a/Focused Moment.exe`，没有覆盖式丢弃旧入口。
- `pnpm verify` 在重建后再次通过：TypeScript、CSS canonical hash、workspace/docs/artifacts 结构、Playwright 输出护栏、负向结构用例、44 个 Rust command/43 个前端调用/3 个事件契约、7 个本地交付契约、Rust fmt/check 与 35 个 Rust 单元测试均通过。仅保留既有 `runtime.rs` 未使用 import warning。
- Windows 原生冒烟 `windows-native-20260918-110836-e007b4a604` 通过，报告位于 `artifacts/qa/native/windows-native-20260918-110836-e007b4a604/report.md`；源 EXE 与隔离 QA 副本哈希一致，测试使用临时 `LOCALAPPDATA`/WebView2/工作目录。
- Playwright 全量运行 `workspace-migration-frontend-inv-mu6bx9ta-20340-ea34f6ce-c1e4-4182-b93b-b432f94d732a` 为 143/146；3 项是并发导航/交互超时而非断言失败。原断言在单 worker 运行 `workspace-migration-single-worker-inv-mu6cf55g-34516-810d53ee-fbc7-48db-84a2-beb3440ae7b0` 中 3/3 通过；没有修改断言、增加重试或减少回归覆盖。
- 重建和测试后再次检查实际文件系统（含 ignored 内容）：根层没有 `package.json`、锁文件、源码、依赖、测试目录、`output/`、`.release/` 或旧安装包；应用生成物在 `app/dist`/`app/src-tauri/target`，证据和 provenance 在 `artifacts/`，旧材料在 `archive/`。
- 保护项：`PROJECT_PLAN.md` 哈希仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；备份、真实数据、未知私人资料保持原位。
- GitHub Actions Checks `35300876683`（提交 `e863e93`）通过：Repository verification、前端构建、Playwright 和 Rust 检查全部成功；远程 Playwright 首次运行报告 142 passed、4 flaky，最终作业成功。

当前 Git 工作树只保留这一项受保护的既有修改：`PROJECT_PLAN.md`；应用构建输入提交为 `e863e93`，本记录后续文档提交不改变 `app/` 构建输入。归档内仍可见迁移前 fixture 自带的 4 个历史 Junction，它们没有被新建、没有被当前工程引用，原始目标事实记录在 `archive/MIGRATION_MANIFEST.json`。

## 2026-09-23 主题可见性与记录交互修复

- 本轮继续以 `F:\Focused Moment` 为唯一工作区，未修改、暂存或提交受保护的 `PROJECT_PLAN.md`；该文件的既有用户修改保留原位。
- 应用输入更新为 `2.12.1`，修复夜谷记录日期展开、编辑纸页设置说明、极光海面/植物书房长页面裁切、七日潮汐坐标错位，以及两个主题已废弃的手动保存按钮。
- 浏览器证据继续写入 `artifacts/qa/frontend/<unique-run-id>/`；本轮不把测试生成物或用户数据加入版本控制。
- `pnpm verify`、单 worker Playwright `100/100`、`pnpm build` 均通过；Playwright 用例完成后本地 webServer 子进程未自行退出，按既有流程停止 runner，不影响已完成用例结果。
- 根目录可运行入口已通过 `app/scripts/package-local.ps1` 从最终 `app/` Release 构建重新生成：build ID 为 `local-20260923-031515-b74828e1e6`，版本为 `2.12.1`，根入口与候选 EXE SHA-256 均为 `1F564F21476D3E9D26659FEB016C14D51F3D4195CD0C6AF4F334B71C1CC39EBB`；完整 provenance 在 `artifacts/builds/local/local-20260923-031515-b74828e1e6/manifest.json`，旧入口在对应 `archive/executables/local/` 恢复副本中。
- Windows 原生冒烟 `windows-native-20260923-031639-ab660521df` 通过，验证新根 EXE 启动、隔离存储、WebView2 数据目录和旧状态迁移；不创建安装器、tag 或 GitHub Release。

## 2026-09-23 石墨主题记录页修复

- 用户目标：修复石墨主题“更长的路”趋势展示不完整、节奏日志文案与记录字段不一致，以及底部摘要缺少实际意义的问题。
- 应用修复：为石墨记录页增加真实 30 天日期桶和可选历史日期选择；趋势节点、日期标签、悬停说明、投入天数与总时长均来自实际记录；节奏日志改为状态、完成时间、专注内容、时长、来源、操作六列，时长强度条和来源文案读取真实记录字段，并把底部操作改为“回到最近”。
- 响应式验收：桌面端完整显示 30 个趋势节点；1024px 与 560px 视口均无横向溢出，日志列与趋势节点仍存在。
- 验证：Graphite 专项 Playwright 1/1 通过；单 worker 前端全量 101/101 通过；`pnpm verify` 通过，Rust 单元测试 38/38 通过；`pnpm build` 通过。Rust 仍只有既有 unused/dead-code 警告。
- 本地交付：源码提交 `c2db71e` 已通过 `app/scripts/package-local.ps1` 重新生成根入口，build ID 为 `local-20260923-112146-c83d1ef813`，版本为 `2.12.1`；候选 EXE 与根 `Focused Moment.exe` SHA-256 均为 `BA71167AA310F890BAF382211208711F5A9F39ACC53CD1869F8590A34C90D952`，provenance 位于 `artifacts/builds/local/local-20260923-112146-c83d1ef813/manifest.json`，旧入口恢复副本位于对应 `archive/executables/local/`。
- Windows 原生冒烟：`windows-native-20260923-112312-e6053388dd` 通过，源 EXE 与隔离 QA 副本哈希一致，启动可见、隔离存储、WebView2 目录、旧状态迁移和进程清理均通过。
- 版本与发布边界：本轮不发布新版本，不创建安装器、tag 或 GitHub Release；应用提交 `72ddeeb` 已推送至 `origin/codex/focused-moment-continuity`，本条交接更新随文档提交一并推送。
- 保护项：`PROJECT_PLAN.md` 未修改、未暂存、未提交；并行主题设计改动已原样恢复到工作树，未被本轮打包、修改或提交。

## 2026-09-24 v2.13.0 新主题逐页执行进度

- 用户已批准先交付两套主题各 5 张概念图，再按 MP-01→MP-05、CC-01→CC-05 顺序逐页实施；10 张 PNG 已存在于 `docs/design-references/concept-images/06-metro-pulse/` 和 `07-clutch-court/`，作为逐页唯一视觉参考保留。
- MP-01「今日班次：首页」通过固定画布与响应式检查：概念对照 run `v2130-MP01-visual-pass-28`、响应式 run `v2130-MP01-responsive-final`（1487/1024/560，3 项通过）。浏览器 mock 截图不是 Windows 原生验证。
- MP-02「今日班次：计时」通过固定画布概念截图、人工叠图复核、尺寸断言和响应式门槛：视觉 run `v2130-MP02-visual-pass-8`；响应式 run `v2130-MP02-responsive-final`（3 项通过）；运行/暂停/继续/倒计时结束待保存状态 run `v2130-MP02-state-pass-1`（1 项通过）。对照文件、透明叠图、差异图均在 `artifacts/qa/frontend/v2130-MP02-visual-pass-8-inv-muecwgna-25004-7810ab04-3e94-4ac9-be16-8e8e87d36f69/today-visual-MP-02-concept-comparison-capture-·-班次计时-chromium/concept-comparison/`；计时板和设置卡实测高度分别为 601px、600px。
- MP-02 对照中保留计划明确要求的命令入口与窗口控制，因此顶部外壳与省略系统控件的概念图有受约束差异；未让控件遮挡标题、计时牌、设置项或底部导航。实际倒计时、完成按钮启用条件及用户待办数据仍由现有业务逻辑决定，不用概念图固定数据替代。
- MP-03「今日班次：待办」通过视觉、交互和响应式门槛：run `v2130-MP03-final-pass-inv-mueemru2-31760-fa5963be-ca3b-4fe1-8893-25f339e54e7e`，3/3 通过（概念对照、1487/1024/560 表单与溢出、编辑/完成/新增/开始专注）；概念图尺寸与三列位置/高度、分隔线和首行坐标均有自动几何断言。透明叠图和差异图位于 `artifacts/qa/frontend/v2130-MP03-final-pass-inv-mueemru2-31760-fa5963be-ca3b-4fe1-8893-25f339e54e7e/today-visual-MP-03-concept-comparison-capture-·-班次待办-chromium/concept-comparison/`，ImageMagick MAE 为 `0.0229605`；最终截图经人工对照，正文版面与概念图对齐。
- MP-03 概念图中的待办结束时间在现有 `TodoItem` 数据契约中不存在；页面只呈现实际安排的开始时间，并在已到站列表透传真实关联专注记录来显示最近记录时间/时长，未伪造计划时长。完成数和比例按所选日期真实待办计算。系统命令入口与窗口控制继续由 shell 提供。
- MP-04「今日班次：记录」已通过固定概念画布几何与交互门槛：`v2130-MP04-final-pass` 5/5；覆盖七点/日期轴/柱线共坐标，日期与前后周切换、零记录日、补录/改名/详细编辑/删除、日历史展开、65 条记录加载更多，以及 1024/560 响应式无横向溢出。概念画布的周图和摘要卡坐标均以 ±2px 断言；当日三条演示时间已修正为与设计稿相符。
- MP-04 概念画布截图位于 `artifacts/qa/frontend/v2130-MP04-final-pass-inv-muefo62g-22436-727624e4-01b6-463c-a960-935d8b766b74/today-visual-MP-04-concept-comparison-capture-·-七日班次记录-chromium/concept-comparison/MP-04-metro-pulse-records.png`。最初的概念图仍是 `docs/design-references/concept-images/06-metro-pulse/records.png`。
- MP-05「今日班次：设置」通过概念图和响应式验收：`v2130-MP05-slider-polish-20260924-0313-inv-muehzsp1-41464-0ee9b74b-d36c-4dbc-9499-6160f7cebe6e` 3/3。覆盖固定画布、三个真实分钟设置值加迷你工作台开关、应用内/桌面/音效三种提醒、实时预览明度/动效/密度变化、自动保存、移除手动“保存书房布置”按钮，以及 1024/560 窄屏可达性；新增三项设置行为与溢出断言。修订概念图保持 1487×1058，仅更新主题/时钟/提醒卡内容；原始概念图副本和编辑前后稿保存在 `artifacts/qa/frontend/v2130-MP05-concept-revision-20260924-0240/`。
- MP-05 逐页截图位于 `artifacts/qa/frontend/v2130-MP05-slider-polish-20260924-0313-inv-muehzsp1-41464-0ee9b74b-d36c-4dbc-9499-6160f7cebe6e/today-visual-MP-05-concept-comparison-capture-·-站台控制-chromium/concept-comparison/MP-05-metro-pulse-settings.png`；透明叠图/差异图与概念图正文 MAE 0.0478572 位于同一 run 的 `concept-comparison/`。四卡边界、预览区、密度选择区、滑轨进度和计时设置行已进行目视叠图复核。计划要求 shell 仍显示的命令和窗口入口与不含这些系统控件的概念图存在受约束差异，但未覆盖设置卡或底部导航。
- MP-04「今日班次：记录」在 MP-05 样式完成后重新回归，`v2130-MP04-regression-20260924-0314-inv-muei23q2-32700-e51cdc5f-9139-4c15-a139-6fd3dda4b412` 5/5；透明叠图和差异图位于该 run `concept-comparison/`，正文 MAE 0.0293334。七日日期/点线/柱对齐、选日联动、编辑/删除/补录、零和密集记录及响应式再次通过。
- CC-01「今日赛场：首页」通过页面内容、交互与响应式门槛：`run-inv-mueleqyf-10228-d00586fd-8850-40f0-aa35-cd3b9d198f5b` 4/4；包含固定 1487×1058 概念截图、1024/560 宽度无溢出、空场首回合入口、计时开始/暂停状态。图像和覆盖层、差异图位于 `artifacts/qa/frontend/run-inv-mueleqyf-10228-d00586fd-8850-40f0-aa35-cd3b9d198f5b/today-visual-CC-01-concept-comparison-capture-·-今日赛场-chromium/concept-comparison/`；全窗口 MAE 0.228047。对照中保留了共享 app-bar/命令/窗口控件，因此完整截图顶部与无 app-bar 的概念画布有受约束差异；球场主体、中圈、五个可见回合、球星卡、底导航已人工叠图检查，几何断言包括 380×380 中圈计时、回合标记坐标、篮筐和 130px 导航。
- CC-01 演示概念图已按真实数据契约修正：固定 `第4回合 / 45:00 / 创作专注 / 准备开球`，任务只显示真实开始时间、不伪造结束时间；更新后 SHA-256 为 `B856646A0A9569F75560EECABB4F45A495CCC7D5955559461D50FE8557A446BA`，1487×1058。修改前概念图 SHA-256 `57A57C08C7CCA4AFA519E4B9B945AF8A691A4E6897279E36EA7B03F78FCDEDFA` 已保存在 `artifacts/qa/frontend/v2130-CC01-concept-alignment-20260924-050501-642fd647/concept-revision/today-before-correction.png`；候选图、概念叠图和差异图也在同目录。
- 用户针对 MP-05 明确选择保留现有单一休息时长数据字段，不新增短休息/长休息字段；设置概念图按此约束展示单个 5 分钟休息选项。
- CC-02「今日赛场：计时」已通过：最终 run `run-inv-muemocci-12968-9b163d78-4fd3-48ad-8d7a-1aa07d6aa76a` 3/3（概念截图与几何断言、空闲/运行/暂停/倒计时结束待保存/完成记录、1024/560 响应式可达）。按钮归属断言确认“完成并记录/重置”在右侧战术板；中圈不再重复状态行，增加概念稿中的四个回合点标；页眉徽标显示真实当前回合和状态。
- CC-02 概念稿发现原记分牌“第 2 节”与实际数据模型不符，已更正为“第 4 回合 / 45:00”，并将空闲态“完成并记录”视觉置灰。最终概念图 `docs/design-references/concept-images/07-clutch-court/timer.png` 尺寸 1487×1058，SHA-256 `F8EA9521A65ECDC5D716CDABADF2398EF60F150CEE11EF18D584302A9EDA97DD`；原图 SHA-256 `A4CCA3A795FB7D9218989712EF36065DD7FDA4BDAC826FB81E222D7E1F5E1A66` 保存在 `artifacts/qa/frontend/run-inv-muem46dg-34548-a7fece32-1748-4ce5-bdb5-dba9859ec650/concept-revision/timer-before-factual-correction.png`。修正版按 ImageGen 输出做了 1px 画布尺寸归一化，未改视觉构图。
- CC-02 最终截图、50% 叠图和差异图在 `artifacts/qa/frontend/run-inv-muemocci-12968-9b163d78-4fd3-48ad-8d7a-1aa07d6aa76a/today-visual-CC-02-concept-comparison-capture-·-赛场计时-chromium/concept-comparison/`；全画布 MAE 0.123271。剩余主要差异来自概念稿未画出的共享 app-bar/命令/窗口控件和由此产生的约 8px 正文纵向位移；这部分按共享 shell 约束保留，计时页主体及按钮位置已人工叠图复核。
- CC-01 至 CC-05 已完成；下一步进行跨主题回归、版本同步、构建/原生验证与交付。`PROJECT_PLAN.md` 是本轮只读保护文件，故未改动；此处为本轮进度记录。

## CC-03「今日赛场：待办」验收 — 2026-09-24

- 根因是看板把所有今日未完成项都放入“本场战术”，造成当前项与待开始事项混组；现已只把计时关联/选中的当前事项列入本场战术，其余未完成项进热身准备，完成事项留在已命中。
- 默认固定 fixture 的三组分别为 1/2/3；完成“创作专注”后“整理收尾”成为当前回合；恢复、编辑、删除和新增操作仍通过。另验收收件箱、未来、过期、空看板场景，未生成虚假命中项或比分。
- 视觉实现对齐概念：红/蓝/绿全高分区、对应列宽、球队球衣编号兼作完成/恢复按钮、状态标签尺寸、Butler 小卡和不换行的新增按钮。控件保留可访问名称、禁用态和键盘焦点。
- 最终 run `run-inv-muep0ijs-27940-d34a415f-a347-45f6-af83-e108cd156935`：CC-03 5/5；包含概念截图、三个列/球星卡/按钮几何、固定数据与新增/编辑/删除/完成/恢复、空态、过期/未来/收件箱，以及 1024×900、560×900 可达性。
- 最终浏览器图、响应式图和透明叠图/差异图位于 `artifacts/qa/frontend/run-inv-muep0ijs-27940-d34a415f-a347-45f6-af83-e108cd156935/`。概念对照全画布 MAE `0.0803826`，正文区 MAE `0.0622691`；目视叠图确认内容与三列边界/位置对齐，剩余明显差异是按计划保留的共享 app-bar/命令/窗口控制与底部导航，不由页面覆盖。
- 概念 `docs/design-references/concept-images/07-clutch-court/todos.png` 已纠正六项真实任务名和“今天截止”文案，尺寸 1487×1058，SHA-256 `F86674C781D457D05D54823564A6D063B1C6244A08AF53DC6BD118DD9AE108C8`；编辑前版本完整备份 `artifacts/qa/frontend/run-inv-muemuppi-21232-bdf9967d-1ada-45c8-ae93-4e451090147c/concept-revision/todos-before-title-and-metadata-correction.png`（SHA-256 `CD2C49B322466C953D8F425BBE7485736C9FFB58A6BF909E6C5B675D3FFDEBFC`）。因图像生成反复未能逐字修正中文，最终只用实际浏览器文字层替换错误标题；其他构图不动，调整 provenance 在两个 run 的 `concept-revision/`。
- MP-05 继续保留单一休息时长字段；未扩展计时设置数据结构。此处不是正式版本发布；`PROJECT_PLAN.md` 继续只读，版本同步/提交/推送待全套主题验收后执行。

## CC-04「今日赛场：记录」验收 — 2026-09-24

- 最终 run `run-inv-mueprqt5-40780-916a7da3-bdfb-4931-9117-76ad1a3c81ef`：5/5。覆盖七日任意日选中联动、补录/改名/详细编辑/删除/展开历史、零记录、65 条密集历史加载更多，以及 1024×900、560×900 响应式访问。
- 新增固定演示数据的事实与几何断言：7 个散点、日期标签和曲线端点均一一对齐，点位横向占 7%–93%；选中 9/23 时摘要为 2h45m、3 段、平均 55m、6/7 活跃；分时柱按真实完成时段为上午 2h、午后 45m、傍晚/夜间 0m。少于 50 条记录时不显示“加载更多”。
- 逐页对比中发现原概念图把每条记录误当成一个时段、摘要写成“已完成待办”，且 3 条记录仍画有“加载更多”。已修订概念图纠正统计、摘要和按钮状态，保留原图备份。当前 `records.png` 为 1487×1058，SHA-256 `409564EE09896E2D4BD9D939D721DBA9BE567F00DEED9A5F5E095BECD6FE73E0`；旧图 SHA-256 `966F4FFA98A9AE5FE7B20326D06A734865477126C56717B1789B4E1EAC302EBB`，备份与生成候选位于 `artifacts/qa/frontend/run-inv-muepcjnc-23592-275416eb-79da-421a-82f8-acb2e68914e1/concept-revision/`。
- 为与修订概念一致，图表标题/坐标说明改为分列展示；最终截图、50% 叠图和差异图在 `artifacts/qa/frontend/run-inv-mueprqt5-40780-916a7da3-bdfb-4931-9117-76ad1a3c81ef/today-visual-CC-04-concept-comparison-capture-·-七日-box-score-chromium/concept-comparison/`。全画布 MAE `0.0768566`，去除顶部共享外壳和底部导航后的正文 MAE `0.0622994`；人工复核确认暖木色主题、主要卡片边界、图表和列表构图对齐，剩余差异主要为 AI 概念图与 Chromium 字形/反锯齿细节及共享 app-bar/命令/窗口控件。该外壳差异属于现有 shell 约束，不用页面覆盖系统入口。
- 当前 CC-04 页面验收通过；下一卡为 CC-05。版本、完整回归、构建、本地入口、Windows 原生冒烟、提交与推送仍待完成；`PROJECT_PLAN.md` 继续只读。

## CC-05「今日赛场：设置」验收 — 2026-09-24

- 最终 run `run-inv-mueqqccr-41296-429ddf63-1616-4d37-a7d5-3d7375cd1485`：3/3。覆盖 1487×1058 固定概念画布、1024/560 宽度无横向溢出和球星预览可达，以及灯光/动效/密度实时预览、计时设置、提醒开关与音效选择即时保存。
- 固定画布增加四个设置卡几何门槛（每项坐标/尺寸误差不超过 2px）和 384×620 球星预览尺寸门槛。精确断言单一休息字段 5 分钟（无短休/长休）、正向/番茄专注各 45 分钟、迷你工作台开关、三类提醒、默认音效、备份列表/四项数据操作/可折叠 JSON 备份；不存在“保存书房布置”或其他手动视觉保存按钮。
- 概念修订是必要的事实校正：旧图含虚构的今日得分/第 2 节 45:00、短休/长休值和遗漏应用内提醒；尝试的整图生成会重排卡片，因此最终保留原始构图/尺寸，用浏览器实际控件局部校准外壳、计时、提醒、备份、密度和主题数量。旧图 SHA-256 `E8DB0D69A8F2D4F7B615D90BE78FBDD5E017A635121891C79A30A6EBFCDBB131` 保存在 `artifacts/qa/frontend/run-inv-muepuy64-34000-12afb3c5-670f-43a0-bf0e-7e1092626146/concept-revision/settings-before-factual-correction.png`；当前 `settings.png` 为 1487×1058，SHA-256 `ED9AE5134E997E43C58E4BE5AE3231870AFEE40A77D8CB08EE78C1E55BCFA69E`。候选、图像生成迭代、控件裁片和合成底稿均留在同目录供追溯。
- 最终截图和 50% 叠图/差异图在 `artifacts/qa/frontend/run-inv-mueqqccr-41296-429ddf63-1616-4d37-a7d5-3d7375cd1485/today-visual-CC-05-concept-comparison-capture-·-球馆更衣室-chromium/concept-comparison/`。全画布 MAE `0.055471`，避开 app-bar/导航后的正文 MAE `0.0484357`；四卡与预览几何对齐，剩余差异主要是左侧主题缩略/球衣概念处理、Chromium 字形抗锯齿和共享壳层文案，不遮挡控件。
- 五页顺序现已完成。下一步跨主题回归（夜谷日记录展开、编辑纸页动效/密度、旧主题 ID 迁移、其他主题布局和保存按钮），之后再做版本同步、全量测试、构建、本地 EXE/原生验证、提交和推送；`PROJECT_PLAN.md` 不修改。

## 2026-09-24 v2.13.0 跨主题回归与概念数据校正

- 跨主题最终 Playwright run `v2130-cross-theme-final-20260924-inv-muerun0z-40852-3735c6c8-024c-4c4e-bc5c-a0d4e5b752bc`：`today-visual.spec.mjs` 100/100 通过；覆盖五主题独立首页、十页概念截图、桌面/平板/手机可达性、记录图日期坐标和展开联动、设置实时预览/自动保存、计时状态以及待办操作。
- 回归新增旧 ID 偏好启动检查：`aurora-ocean` 映射到「今日班次」，`botanical-library` 映射到「今日赛场」。Rust 专项测试 `legacy_theme_ids_migrate_by_position_in_preferences_and_restored_backups` 1/1 通过；测试确实经 `apply_backup_file_with_options(..., true)` 恢复两种旧 ID 的备份并核验持久化偏好，不再只测归一化函数。
- 首轮视觉回归揭示三处断言/概念数据陈旧：分时摘要真实单位是 `52m`；紧凑预览真实文案是“同屏显示更多。”；MP-03「深度工作/专注时段」实际完成时间为 `10:50 / 14:51`，并显示“记录于”，与 MP-04 共用的当天专注记录一致。更新测试期望和 MP-03 概念图，没有改动用户数据模型或虚构专注记录。
- ImageGen 的局部文字替换稿改动了轨道版式，已明确拒收；原概念图完整备份 `artifacts/qa/frontend/v2130-mp03-corrected-capture-20260924-inv-muerjahs-40696-260aa380-8a28-4b32-a334-9000731655c9/concept-revision/todos-before-record-time-correction.png`，SHA-256 `E7E07C1C6567DCC17186404BA3295D4D1501B8EE11E06EB3D9EDA2E0461D0056`。最终保留原构图，仅以实际页面文字局部校正；`docs/design-references/concept-images/06-metro-pulse/todos.png` 尺寸仍为 1487×1058，SHA-256 `D57EA9CCE7765E44C33B04590D22F3EEE8052F13DA73C39174A5B63105FB4B92`。
- MP-03 最终对照截图与 50% 叠图/差异图在 `artifacts/qa/frontend/v2130-mp03-corrected-capture-20260924-inv-muerjahs-40696-260aa380-8a28-4b32-a334-9000731655c9/today-visual-MP-03-concept-comparison-capture-·-班次待办-chromium/concept-comparison/`；全画布 MAE `0.0226769`，剔除共享顶栏与底导航后的正文 MAE `0.0149849`。放大复核确认任务行标题、卡片和分栏未受局部修订影响。
- `PROJECT_PLAN.md` 仍只读；SHA-256 保持 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。下一步同步全部 v2.13.0 版本源与正式发布说明，再运行 `pnpm verify`、全量 Playwright、build、Windows native smoke 和本地根 EXE 打包；之后只提交本轮授权文件并推送当前分支，不创建 tag/Release。

## 2026-09-24 v2.13.0 最终打包前复核

- 继续任务时核对了 branch/upstream 为 `codex/focused-moment-continuity`，HEAD 基线 `f2e3507d9334ab7b403da18014d43b6ffa6caa53`，当时与 upstream 对齐；当前根 `Focused Moment.exe` 仍是旧入口，SHA-256 `BA71167AA310F890BAF382211208711F5A9F39ACC53CD1869F8590A34C90D952`。原生验证开始前进程检查为 0，不关闭任何用户进程。
- 再次执行 `pnpm verify` 成功：TypeScript、CSS 顺序、结构、Playwright 输出 guardrail、结构/原生契约及本地交付脚本测试通过；Rust fmt/check/test 共 39/39。Rust 当前有未使用导入/死代码警告，不影响通过。
- 完整 Playwright 套件为 154/154，run `artifacts/qa/frontend/v2130-full-playwright-20260924-inv-mues5r0r-30492-ddf94a9e-4dcb-461b-8c42-fbcac4f4e74f/`；专门跨主题视觉套件 100/100，旧 ID 备份恢复迁移专项通过。生产构建 `pnpm build` 已通过（2086 modules，Vite 有大 chunk 提示）。
- 状态审计脚本确认受保护的 `PROJECT_PLAN.md` 快照早于本轮已确认进展；本文件是较新交接记录。按用户保护要求，不改写计划中的既有 31 行用户 diff；本轮有效范围以用户批准的 v2.13.0 任务与本文件最新记录为准。
- 剩余：先提交经路径审计的应用源码/概念图/发布说明；再运行 `pnpm package:local`，核验根 EXE、provenance 与旧入口恢复副本；原生进程仍为 0 时运行 `pnpm native:windows`；补齐最终交付记录后仅推送当前分支。禁止创建 tag、GitHub Release、安装器或上传资产。

## 2026-09-24 v2.13.0 本地交付与 Windows 原生验收

- 应用/概念/测试与初版说明已提交为 `39dd66965b49f5e7a74ee2a3341f3ed142acd5d0`（`feat: ship metro pulse and clutch court themes v2.13.0`）。
- `pnpm package:local` 成功，Release build ID `local-20260924-083251-392d39dfb0`。根目录 `Focused Moment.exe` 与候选 SHA-256 均为 `D936D5D419319993818D7E9C5B8973B892D0038AED9D732CA13FA63C5EE7E5B9`，34,896,896 bytes；provenance 为 `artifacts/builds/local/local-20260924-083251-392d39dfb0/manifest.json`，记录源提交、178 项输入指纹和 `relevantBuildInputDirty=false`。
- 旧入口 SHA-256 `BA71167AA310F890BAF382211208711F5A9F39ACC53CD1869F8590A34C90D952` 已在 `archive/executables/local/local-20260924-083251-392d39dfb0/Focused Moment.exe` 核验保存；交付 journal 标记 `delivered` 且 `rollbackSupported=true`。
- `pnpm native:windows` 通过，run `windows-native-20260924-083426-1fc83e8741`，验证新入口原生窗口启动、隔离 LOCALAPPDATA/WebView2、合成旧数据迁移及旧源备份；只关闭脚本创建的隔离子进程。此检查不等于计时、托盘、浮窗、音效和通知等人工界面操作的 Windows 原生验收。
- 无 tag、GitHub Release、安装器或资产上传。接下来执行路径核验后的文档补充提交，并快进推送两个本轮提交至已确认分支；`PROJECT_PLAN.md` 保持哈希 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。

## 2026-09-24 v2.13.0 Git 同步闭环

- 应用提交 `39dd66965b49f5e7a74ee2a3341f3ed142acd5d0` 与交付说明提交 `804e9f6` 已通过普通 fast-forward 推送至 `origin/codex/focused-moment-continuity`。
- 两套新主题、十张概念参考、兼容迁移、记录/设置修复、154/154 Playwright、`pnpm verify`（Rust 39/39）、Windows Release 根入口 provenance 与隔离原生冒烟均已完成；具体证据见本节之前条目及 `docs/v2.13.0/RELEASE_NOTES.md`。
- 无 tag、GitHub Release、安装器或资产上传。根 EXE 由 build ID `local-20260924-083251-392d39dfb0` 交付；文档提交不改变应用构建输入。
- `PROJECT_PLAN.md` 仍保持保护基线 SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`，未改写既有用户 diff。`div` 与四份 `docs/context_summary_*.md` 继续留在本地且未暂存、提交或推送。

## 2026-09-24 v2.13.1 旧主题设置入口 — 本地交付与原生验收完成

- 新的用户决定：把旧「极光海面」「植物书房」留作设置页小角落里的可选项，以便以后切回；这覆盖 v2.13.0“只存档、不提供选择”的旧决定，但不改常用五主题排列。
- 当前实现方案：全主题设置页尾部提供默认收起的旧版主题折叠区；切到旧主题时自动展开。两套旧主题重新接入五个页面路由；独立偏好 ID 为 `legacy-aurora-ocean` / `legacy-botanical-library`，原存量 ID 映射到新第四/第五主题的规则继续保留。
- 版本按已交付的 v2.13.0 之后的用户可见功能更新到 2.13.1；`PROJECT_PLAN.md` 继续只读，既有 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。
- 已完成：`pnpm check`、`pnpm verify`（Rust 39/39）、全量 Playwright 浏览器 mock 156/156、追加断言后的旧主题专项 2/2、`pnpm build`（2089 modules）；截图 `artifacts/qa/frontend/run-inv-muex68ba-19912-c4488d85-96a9-4485-92ee-f803680130be/today-visual-archived-them-a4fbb-itchable-in-both-directions-chromium/legacy-theme-shelf-expanded.png`。
- Playwright CLI 的纯 Vite 页面能检查折叠区视觉与键盘/导航结构，三个页面快照位于 `artifacts/qa/frontend/run-cli-legacy-settings-20260924-1035-e89c/`；因无 Tauri IPC，数据持久化以 mock 浏览器测试和 Rust 测试为证据；此结果不替代 Windows 原生验收。
- 应用实现提交 `cce109596d4b5091b57754e56ba7a69a270cb521` 已快进推送到当前分支。其 Release 候选 `app/src-tauri/target/release/focused-moment.exe` 已构建并核验：`2.13.1`、34,907,648 bytes、SHA-256 `C42EC636B5E07D78C3C72A1313A3257074D8DE14A5E0F4D9FC9C4038CFA1C360`。
- 用户确认已退出应用，随后进程核验为 0。使用已有候选执行 `package-local.ps1 -SkipBuild` 成功；build ID `local-20260924-110129-5edbedd7b5`，根入口与候选均为 `2.13.1`、34,907,648 bytes、SHA-256 `C42EC636B5E07D78C3C72A1313A3257074D8DE14A5E0F4D9FC9C4038CFA1C360`。候选由应用提交 `cce109596d4b5091b57754e56ba7a69a270cb521` 构建；交付 manifest / journal 位于 `artifacts/builds/local/local-20260924-110129-5edbedd7b5/`，manifest 记录打包时仓库 HEAD `4e448ea9b191db5521d7262ec4f45cdbbd0691fc`、179 项输入指纹及 `relevantBuildInputDirty=false`。前版根入口备份位于 `archive/executables/local/local-20260924-110129-5edbedd7b5/Focused Moment.exe`，SHA-256 `D936D5D419319993818D7E9C5B8973B892D0038AED9D732CA13FA63C5EE7E5B9`。
- `pnpm native:windows` 通过，run `windows-native-20260924-110208-18c79bb7d3`，报告 `artifacts/qa/native/windows-native-20260924-110208-18c79bb7d3/report.md`。根入口与隔离 QA 副本哈希一致；可见原生窗口启动、隔离 LOCALAPPDATA / WebView2 路径、合成旧数据迁移、旧源保持字节稳定及仅清理测试自身进程均通过。该自动冒烟不等于计时、托盘、浮窗、备份 UI、音效和通知的人工原生交互验收。
- 该版本本地交付与原生冒烟已经完成；尚待本次文档闭环提交并快进推送当前分支。无 tag、GitHub Release、安装器或资产上传。`PROJECT_PLAN.md` 继续按保护要求保持原字节与哈希 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；`div` 和四份上下文摘要不暂存、不提交。

## 2026-09-26 v2.13.4 Jimmy Butler 勇士 10 号肖像与本地交付

- 用户选择只更新计时页和待办页两张新肖像为金州勇士 10 号；保留首页旧海报及设置页预览素材。新图分别为计时页正面持球肖像（1024×1536，SHA-256 `E5A3E92A61C41BDADB15AF0CB5E6329B473574D4BA197B5102026541A56001E4`）和待办页侧场近景肖像（1254×1254，SHA-256 `0A1EDF876664B9C19702E3B336049AE638F1D826BE329497E68C7A3B454456E8`）；均为 PNG 真透明底，原球场背景不变。
- 发现计时/待办肖像旁原有 `#22` 标注与新球衣冲突，已改为两页卡片 `#10`、共用顶栏的中性球队名；首页海报与其 `22` 标记不改。浏览器自动断言确认资源尺寸及透明采样点。
- 版本源统一为 `2.13.4`：`app/package.json`、Tauri `Cargo.toml` / `Cargo.lock` / `tauri.conf.json`、`runtime.rs`。
- 完整浏览器回归 `156/156` 通过，run `artifacts/qa/frontend/butler-warriors-10-20260926-inv-muhxc3kq-6912-33a0c40f-0189-4295-a59f-eb5967aa37ab/`；配套标签与透明断言更新后，CC-02/CC-03 最终截图定向回归 `2/2` 通过，run `artifacts/qa/frontend/butler-warriors-10-final-inv-muhxs7j6-16340-ef38b4f8-8a8a-41b7-9f96-90f4856854cc/`。两张页面截图已目视核对，构图、控件和背景无裁切/遮挡。
- `pnpm verify` 通过，Rust 单测 39/39；`pnpm build` 通过（2089 modules）。仅有既有 unused/dead-code 编译警告。
- 根目录 Release EXE：build ID `local-20260926-131839-aeab5611c6`，2.13.4，39,206,400 bytes，SHA-256 `5B7E9B565C3357699020A4BD44B41BDEEAA539EDAB5AD3851B30887A58D65641`。provenance/journal 在 `artifacts/builds/local/local-20260926-131839-aeab5611c6/`，记录 181 项输入指纹；打包时相关源码尚未提交，故 `relevantBuildInputDirty=true`；提交后已逐项核对，181 项输入均与已提交源码一致。旧根 EXE SHA-256 `AE8E65FC7BFE156C022B9D9A5D9170048BFC99CBB5848C6BAEFD4B5837F61F91` 可从 `archive/executables/local/local-20260926-131839-aeab5611c6/Focused Moment.exe` 恢复。
- `pnpm native:windows` 通过：`windows-native-20260926-132018-03ec821d5c`，验证可见原生窗口、隔离用户数据/WebView2 目录、模拟旧状态迁移和受控清理。此冒烟不覆盖人工计时/托盘/浮窗/音效等交互。
- 应用与当前交付说明提交 `3618120f288769389c8d2e53cb599376ade1d97d` 已快进推送到 `origin/codex/focused-moment-continuity`；本地验证、构建、根入口 provenance 和隔离 Windows 冒烟均收口。
- 当前不创建安装包、tag、GitHub Release 或上传资产。`PROJECT_PLAN.md` 按保护要求保持未改动，SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；既有 `div` 与四份 `docs/context_summary_20260924_*.md` 未混入本工作单元。

## 2026-09-26 v2.13.5 Jimmy Butler 肖像区分与本地交付

- 用户复核指出肖像仍像重复。对源码映射和实际截图检查后确认：计时与待办虽引用不同 PNG，但同为正面头带棚拍肖像；首页旧背身海报与设置预览也复用了同款素材。现将待办页换为勇士 10 号侧身指挥动作，设置预览换为勇士 10 号无头带抱臂形象；首页与计时素材不改。页面背景、球场、控件布局均保持原样。
- 新图 `jimmy-butler-playbook-calling.png`（1024×1536，SHA-256 `70C78746CF2560BCB3EEA0867F38B54187A2845A4EF43D5FEF687BDBDE514152`）与 `jimmy-butler-settings-composed.png`（1024×1536，SHA-256 `BC94EDC5B1A82A00615DCA885F06ED6F2ACF708F63BE0C5F8A30227179795D83`）均为 RGBA 真透明素材；角点和边缘抽样 alpha 为 0。自动回归验证首页、计时、待办、设置四个位置使用四个不同路径。
- 版本源统一为 `2.13.5`：`app/package.json`、Tauri `Cargo.toml` / `Cargo.lock` / `tauri.conf.json`、`runtime.rs`。新增正式说明 `docs/v2.13.5/RELEASE_NOTES.md`。
- 定向 CC-03/CC-05 回归 8/8；四页肖像唯一性回归 1/1；`pnpm verify` 通过（Rust 39/39）；`pnpm build` 通过（2089 modules）。完整 156 项浏览器回归结果为 154 通过、2 项外观偏好保存/切换时序用例失败；独立重跑结果不稳定。本轮不涉及偏好保存逻辑且未放宽断言，图像映射相关用例均通过，详见 Release Notes。
- 应用提交 `8fb5e67e8883b3ed7e0e8aa64453d9deb3819682` 已推送到 `origin/codex/focused-moment-continuity`。根 EXE 为 Release 2.13.5，43,741,696 bytes，SHA-256 `A84C09BDE80A900B41D40B43443549C9A2E1CD62DA2218B840A86089131B8F14`；build ID `local-20260926-141653-0a52e15a68`，183 项输入指纹且 `relevantBuildInputDirty=false`。旧入口 SHA-256 `5B7E9B565C3357699020A4BD44B41BDEEAA539EDAB5AD3851B30887A58D65641` 保存在同 build ID 的 `archive/executables/local/` 恢复副本中。
- Windows 原生隔离冒烟 `windows-native-20260926-141850-67b81e35a3` 通过；仅验证启动可见性、隔离数据/WebView2 路径和合成旧数据迁移，不代表人工计时/托盘/浮窗等交互覆盖。未创建安装包、tag、GitHub Release 或上传资产。
- `PROJECT_PLAN.md` 未改动，哈希保持 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；原有 `div` 和四份 `docs/context_summary_20260924_*.md` 均未暂存、提交或推送。

## 2026-10-04 v2.13.6 Clutch Court 篮球主题流程审阅与修复

- 按用户要求整体审阅「今日赛场」首页、计时、待办、记录、设置五页。篮球表达现作为视觉/导航隐喻，不冒充真实比赛模型：24 SEC 仅为首页静态主题铭牌；45 分钟仍显示真实专注倒计时/状态；统计只取实际待办、专注记录与连续天数；不伪造节次、比分或命中率。
- 审阅中修复五类问题：设置/移动操作字样偏小；后台轮询旧偏好可覆盖待保存/失败的即时设置；相同记录刷新会重建完整历史 DOM 并打断展开/交互；七日图缺少时长范围提示；倒计时演示 fixture 与实际设置字段曾不一致。已补足对应回归断言，保持原有记录/计时数据格式。
- 全量 Playwright 浏览器 mock 测试 `159/159` 通过，run `clutch-v2136-audit-final-20261004-04-inv-mutrcykl-40224-67a85147-9b77-4026-af9f-7c502a1aa7ac`；五页固定画布、响应式和流程状态截图已逐页目视检查。不得将此 mock 结果表述为原生交互证据。
- `pnpm verify` 通过，Rust 单测 `39/39`；`pnpm build` 通过（2089 modules）。`pnpm native:windows` 单独通过，run `windows-native-20261004-195802-662010ca61`，范围限原生可见启动、数据/WebView2 隔离与合成旧数据迁移。
- Release EXE：根目录 `Focused Moment.exe`，2.13.6，46,015,488 bytes，SHA-256 `0D0C4B31ED83C980624C8AD5B9713CC5D7451D865DF84A256CB2CB6FEC257C34`；build ID `local-20261004-195659-9ffda0e844`；provenance 位于 `artifacts/builds/local/local-20261004-195659-9ffda0e844/`，184 项输入、`relevantBuildInputDirty=false`。前一入口恢复副本位于 `archive/executables/local/local-20261004-195659-9ffda0e844/Focused Moment.exe`，前版哈希 `A84C09BDE80A900B41D40B43443549C9A2E1CD62DA2218B840A86089131B8F14`。
- 应用修复提交 `0069314a50656eecf77a1dbe7eee90f18020beda` 与交付文档提交 `33ff8f8` 已快进推送到 `origin/codex/focused-moment-continuity`；正式说明为 `docs/v2.13.6/RELEASE_NOTES.md`。不创建 tag、GitHub Release、安装包或上传资产。
- `PROJECT_PLAN.md` 按保护要求保持字节/哈希不变：`E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。`div` 与四份 `docs/context_summary_20260924_*.md` 保持未暂存/未提交；构建 manifest 也将这些非构建输入显示为未提交来源状态。

## 2026-10-05 优化 U1：自定义提醒音源

- 按已批准优化计划实施，详细队列见 optimization-plan.md。
- 自动提醒与试听改用保存的音源；由主窗口独占声音/任务栏提醒，浮窗展示状态。
- 浏览器 mock 音效专项 3/3、TypeScript 检查通过；当前未声称 Windows 可听播放已通过，阶段原生验收和根入口交付待执行。
- 独立版本输入 2.13.7；PROJECT_PLAN.md 原字节受保护，既有用户文件不纳入提交。

## 2026-10-05 优化 U2：已提交结果与后续步骤分离

- 补录/完成/修改记录立即应用提交结果，统计失败提供独立重试，不重复写入；窗口切换与导入/清空后的读取使用独立后续任务。
- 故障注入浏览器 mock 4/4、TypeScript 通过。初轮发现重试提示被顶栏遮挡，已使用独立定位样式修复并实际点击验收。
- 版本2.13.8；根入口尚未重建，原生阶段验收待后续。PROJECT_PLAN.md哈希未变。

### 2026-10-11 优化重启计划批次 0：恢复可验证基线

- **最新依据**：按本轮用户提供的优化重启目标执行。真实源码为 2.13.8，分支 codex/focused-moment-continuity，HEAD 与 origin 同步；PROJECT_PLAN.md 中较旧的项目快照和本轮用户 diff 保持原样。
- **旧报告归档**：.impeccable/critique/2026-10-04T12-02-05Z__app-src-components-clutchcourtviews-tsx.md 按原字节保存至 archive/workspace-migrations/20261011-pre-batch-a/impeccable/critique/；源文件 SHA-256 为 9C0D95739DF0B092A10ACD0277742F0EAB21EC0822EFFDFC2D1418142F5EE80D。确认目录仅含该报告并移除空目录，结构规则未放宽。
- **差异保护**：完整应用补丁和未跟踪应用文件副本保存在 archive/workspace-migrations/20261011-pre-batch-a/；manifest 记录 16 个 tracked 改动文件、10 个新文件副本及 SHA-256。首页动作文件已暂存待 C 批恢复；DataRevisions 草稿补丁保留待 B 批完成后重新审查；弹层焦点改动留在 A 批工作区。
- **PROJECT_PLAN.md**：本轮未写入或暂存；SHA-256 保持 E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604。
- **入口**：根 EXE 仍为 2.13.6，SHA-256 0D0C4B31ED83C980624C8AD5B9713CC5D7451D865DF84A256CB2CB6FEC257C34。批次 0 不改应用构建输入，未重建；入口保持不变。
- **验证**：2026-10-11 的 pnpm verify 退出码 0，Rust 39/39；TypeScript、结构、契约、交付脚本均通过。该结果不是 Windows Release 原生验收。
- **下一步**：完成 A 批弹层与提交结果故障回归，之后冻结 2.13.9 构建输入并制作/验收 Release EXE。
### 2026-10-11 A 批回归补全：提交结果后的重试不重放写入

- **覆盖缺口**：新增便携备份导入、清空数据、开始计时后自动打开迷你工作台、焦点浮窗返回主窗四个后续步骤失败场景；验证重试仅重读或重试窗口动作，业务写入各只发生一次。另补快速记事真实写入失败时保留草稿并可重试。
- **测试夹具**：Tauri mock 补齐 clear_app_data 状态变化、主窗恢复行为和计数。完整 Playwright 套件 178/178 通过；A 批专项 9/9，通过后再完成完整套件。
- **证据**：完整浏览器目录 artifacts/qa/frontend/20261011-a-full-inv-mv3979od-14016-529baf7e-c3db-44b6-93fe-09c581120c79；弹层目录 artifacts/qa/frontend/20261011-dialog-a-inv-mv38wfw5-10932-14cd00ee-df7e-4c48-b69f-afba08af2a03；提交结果目录 artifacts/qa/frontend/20261011-a-actions-rerun-inv-mv395hwe-6692-0156dcd3-623d-4f71-b20c-8fdf788ddf54。
- **静态/Rust**：pnpm verify 退出码 0，Rust 单测 39/39。Windows Release 原生验收尚未执行。
- **提交/推送**：测试与夹具单独提交 5f86cd3，已快进推送 origin/codex/focused-moment-continuity；未将任何其他工作区改动混入。
- **当前状态**：U1/U2 源码已提交，缺失的后续步骤回归已补齐；弹层源码仍待独立提交，2.13.9 版本同步、Release EXE 和 Windows 原生验收未完成。PROJECT_PLAN.md 维持只读。
- **下一步**：完成弹层差异审阅，升版 2.13.9 并同步 release notes，随后冻结输入完成 Release 构建及原生验收。

### 2026-10-11 A 批 2.13.9 版本同步与冻结回归

- **版本输入**：package.json、Cargo.toml、Cargo.lock、tauri.conf.json、runtime.rs 同步至 2.13.9；更新面向用户的里程碑文案；新增 `docs/v2.13.9/RELEASE_NOTES.md`。弹层键盘焦点、IME、焦点恢复和写入期间关闭/重复提交保护作为本批应用更改纳入。
- **静态/Rust**：在 app/ 执行 `pnpm verify` 退出码 0；Rust 单测 39/39。既有 unused/dead-code 警告仍存在。
- **生产前端**：`pnpm build` 成功，2092 个模块；保留 Vite 大 chunk 提示。
- **浏览器 mock**：首轮默认并发 177/178，一项提醒音浮窗用例在 `page.goto` 等待 load 时超时；页面快照显示已渲染，单项 1 worker 诊断为 1/1。未修改用例/断言、未启用重试；降低完整回归并发到 4 workers 后原套件 178/178。首轮目录 `artifacts/qa/frontend/run-inv-mv39w7ya-43200-3c7a16e5-7eaa-4865-b45f-c197ef35ad50`；诊断目录 `artifacts/qa/frontend/run-inv-mv3a2t2v-39780-05e71eb7-0b54-46d0-8e96-5bf15811e559`；完整通过目录 `artifacts/qa/frontend/run-inv-mv3a3muf-38996-fd09c0fe-d5bb-4605-88c9-39899756eb24`。
- **候选边界**：打包指纹模块会列出 `app/scripts/` 全部脚本，故未跟踪的本机 QA/性能工具会记入指纹；它们不是前端/Rust 编译输入，不会编入 EXE。仍未暂存/提交未来批次脚本、`div`、历史摘要或 PROJECT_PLAN.md。
- **下一步**：选择性提交 A 批应用、版本与正式说明文件；再 package:local，校验 Release 候选、输入指纹、根入口与旧入口恢复副本，并对同一候选运行隔离 Windows 原生验收。

### 2026-10-15 A 批最终交付与 B 批转接

- **源码/提交**：弹层、2.13.9 版本同步与发布说明为 `8d98254`；Windows UIAutomation 空名称防护为 `102eb05`；本地交付实际 EXE FileVersion/ProductVersion 校验及 8 个 fixture 场景为 `ef6fc5f`；全部推送到 `origin/codex/focused-moment-continuity`。`PROJECT_PLAN.md` 未写入/暂存/提交，SHA-256 仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。
- **最终构建**：`local-20261015-132218-f95a936d5c`。候选和根 EXE SHA-256 为 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3`；PE FileVersion/ProductVersion 和应用来源版本均为 2.13.9。构建输入前后均为 191 个文件、摘要 `DB40CBE04E6C3F898DADF0EDBC1BB2064E4E0B123C22A5E1276B4D3CE27E81D7`；HEAD 为 `ef6fc5fc19f0f5cb11c29169ab4d32cff9060b01`。版本资源不匹配会在入口备份/替换前拒绝。
- **恢复副本**：旧 2.13.9 根入口哈希 `BE76F13C750982BB17F2E2F9749AF87A784E131769868DF067436B92C69BED7B` 存于 `archive/executables/local/local-20261015-132218-f95a936d5c/Focused Moment.exe`；原 2.13.6 哈希 `0D0C4B31ED83C980624C8AD5B9713CC5D7451D865DF84A256CB2CB6FEC257C34` 仍有备份 `archive/executables/local/local-20261011-115259-4e93da2a1e/Focused Moment.exe`。
- **最终验证**：`pnpm verify` 通过，Rust 39/39、交付脚本 8/8；生产构建成功；完整 Playwright 178/178，4 workers、无重试，目录 `artifacts/qa/frontend/run-inv-mv936un8-3176-dd58550e-2819-4c5d-82f7-fd421527f0ff`。官方 Windows 隔离冒烟 `artifacts/qa/native/windows-native-20261015-132425-5b9ac9b87d` 通过。
- **真实 Windows 交互/音频**：UIAutomation 运行 `artifacts/qa/native/windows-interactions-20261015T052510928Z-41a4b4ec/report.json` 6 项通过，覆盖启动、暂停、浮窗显示/返回、完成保存及重启读取；CDP 未开放，故无 IPC 调用计数。`artifacts/qa/native/windows-interactions-20261015T052715706Z-ea5c1c34/report.json` 的隔离进程音量计确认试听和提醒有输出（峰值分别 0.0337293、0.0337603427）；不证明人耳可听或音源身份。系统托盘与隐藏窗口提醒仍在总验收范围。
- **已知 B 批风险**：合成注入一个新业务文件配旧 runtime 文件，重启后可继续；再次完成保存后记录数由 1 变 2。此为磁盘状态注入，不是运行中强退测试。B 批需要修复统一事务/双文件恢复，不复用此结果声称恢复通过。
- **输入边界**：打包 provenance 因 `app/scripts/` 全量指纹将未跟踪辅助脚本标为 dirty，故 manifest `relevantBuildInputDirty=true`；它们不进入 Vite/Tauri 可执行输入。`PROJECT_PLAN.md`、`div`、历史摘要和剩余本机脚本均未暂存/提交。构建前首次发现 Cargo.toml 行尾被 Tauri/Cargo 从 CRLF 改为 LF，交付守卫阻止替换；稳定行尾后按最终摘要成功重建。
- **B 批下一步**：只读复核 `PROJECT_PLAN.md`；沿 `commands.rs`/`timer_engine.rs`/`storage.rs` 梳理全部写入、托盘、导入、清空、退出路径与锁顺序；以此确定统一事务日志格式及崩溃注入边界。保存其他未提交用户差异，不启动 C/D 应用改动。

### 2026-10-15 B 批实现与验收交接

- B 批源码提交 `297573fe08da83fc76ef63f50738315f8724a2f6` 已实现统一事务、pending/committed 恢复日志、并发读写门控、失败回滚、运行态单文件快照和跨窗口重置会话保护。`pnpm verify` 通过，Rust 49 passed、0 failed、1 ignored；生产构建通过；完整 Playwright mock 183/183，4 workers、无重试。证据路径仍以本节上方的验证记录为准。
- Release build ID `local-20261015-153109-5c67dc3626`，候选和根 `Focused Moment.exe` 版本资源均为 2.13.10、SHA-256 均为 `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40`（46,347,776 bytes）。provenance：`artifacts/builds/local/local-20261015-153109-5c67dc3626/manifest.json`；打包日志：`artifacts/qa/build/batch-b-package-20261015-161500-5edb71a4/pnpm-package-local.log`；192 项输入摘要前后均为 `B8B7B42E6ACF072F09503D2C770D96F15361A13CBA23388195B930FAB4D126CF`。旧 2.13.9 入口 SHA-256 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3` 已备份到 `archive/executables/local/local-20261015-153109-5c67dc3626/Focused Moment.exe`。
- `pnpm native:windows` 隔离冒烟通过，run `windows-native-20261015-153341-0cd5821feb`；覆盖候选可见启动、隔离数据/WebView2、旧路径防护和合成旧数据迁移，不覆盖重置界面或活跃写入强退；报告另有合成临时目录清理警告。以同一 Release EXE 测试的 pending 启动回滚 `windows-release-transaction-recovery-20261015T080915587Z-f16b06b2` 与 committed 启动保留/清理 `windows-release-committed-recovery-20261015T081416228Z-16e0b35e` 单场景均通过；它们不是应用活跃写入期间强退证据。pending runner 在场景断言通过后因临时 WebView2 profile 清理 `EBUSY` 退出码 1；committed fixture 修正 SHA-256 文本小写后通过，先前大写 fixture 失败属于 harness 输入格式错误。
- 原生重置 UIAutomation 尚未执行到 UI 断言：B 候选 `windows-reset-native-20261015T073453621Z-9b44abb2` 和 `windows-interactions-20261015T074157130Z-4a72eec9` 均得到可见窗口但空 UIA 元素树，CDP 不可用；同一环境下已通过交互验收的 A 批 2.13.9 控制副本 `windows-a-known-good-control-20261015T075937729Z-a84719eb` 也出现相同的空树/CDP 问题。根因未确认，故不能判为产品回归或声称重置原生验收通过。
- 活跃写入时的 Windows Release 进程强退仍是 B 批退出条件缺口；Rust 子进程写盘边界崩溃恢复和 Windows Release 合成日志启动恢复均已单独通过，证据类型不可互相替代。当前状态保持“原生验收未完成”，不进入 C 批。
- `PROJECT_PLAN.md` 保持受保护的用户差异，未写入、暂存或提交；SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。`div`、五份历史 context summary 与三份未跟踪 app QA/性能脚本均保持原样并未提交；脚本被 provenance 指纹纳入，导致 `source.dirty=true` / `relevantBuildInputDirty=true`，但不进入 Vite/Tauri 编译。分支 `codex/focused-moment-continuity` 上 B 源码与 A 交接文档仍待推送；此前 push 被 auto-review 拒绝，不重试，需待具体 payload 可审查后请求用户批准。
- **下一步**：在原生 UIAutomation/CDP 能实际枚举界面后完成重置确认专项，并验证同一 2.13.10 Release 在活跃写入期间强退后的恢复；随后更新证据并按用户批准推送。`PROJECT_PLAN.md` 继续只读。
