# Focused Moment 项目总览与持续执行计划

> **执行入口：所有模型（包括 Luna）先读本文件，再选择一个未完成任务。**
> 本文件覆盖整个产品；五套前端是当前阶段，不是项目全部。

## 0. 当前看板

| 字段 | 当前值 |
| --- | --- |
| as_of / updated_at | 2026-09-09 22:46 +08:00；Aurora Ocean 与 Botanical Library 已完成独立视觉重做，v2.10.0 已完成正式包、远程 CI、平台资产与 GitHub Release 收口 |
| 产品目标 | 本地优先的桌面专注工具：待办 → 专注 → 桌面提醒 → 保存记录 → 回看投入 → 可恢复地长期保留 |
| 当前阶段 | 五套主题均已接入；用户否定后三套“仅换色”的视觉验收，Graphite / Aurora / Botanical 已按概念图完成独立布局、材质、动效与交互语言重做，v2.10.0 已发布 |
| 代码基线 | v2.10.0 发布代码提交为 `ce15ff0`，tag `v2.10.0` 固定在同一提交；Aurora/Botanical 精修代码候选为 `7bade92`；旧 v2.9.2 发布 tag 固定在 `9978e45` |
| 当前工作分支 | `main`；旧 CORE-01/CORE-02/CORE-03/CORE-04/CORE-05/NV-01/NV-02/NV-03/NV-04/NV-05/NV-06/DESK-01/DESK-02/DESK-03/ARCH-01/QA-01/PERF-01/TH-02/TH-03/TH-04/TH-05/DATA-01/REL-01 已完成；REFINE-03/REFINE-04/REFINE-05 DONE；REL-02 DONE；REL-03 DONE |
| 发布基线 | GitHub `v2.10.0`，tag peeled commit 为 `ce15ff0`；Checks `34364439803`、macOS Native Smoke `34364439775`、macOS Universal Release `34364312849` 均 PASS；`v2.10.0` Release 四项资产均为 uploaded，digest 见 `docs/v2.10.0/RELEASE_NOTES.md`；旧 tag 未移动 |
| 远程 main | 已推送；当前工作树与 origin/main 一致，main 已包含 v2.10.0 发布代码 `ce15ff0` 及最终发布证据；`v2.10.0` tag 固定且未移动；远程 Checks、macOS Native Smoke、Universal Release 与四项资产 digest 已核对，证据见 `docs/v2.10.0/RELEASE_NOTES.md` |
| 本轮交付 | 旧阶段已由 DESK-02 / DATA-01 / v2.9.1 收口；REFINE-03/REL-02 已完成 Graphite 工业仪表主题及 v2.9.2 发布；REFINE-04 Aurora 与 REFINE-05 Botanical 已完成独立五页重做、结构断言和视觉证据；REL-03 已完成 v2.10.0 版本同步、Windows/macOS 包、远程 CI、GitHub Release 与四项资产核对 |
| 下一项 | 暂无新的未完成主题任务；后续按用户反馈进入新的精修或维护任务 |
| 当前执行人 / 在做任务 | Codex / REL-03 DONE；v2.10.0 已完成发布收口 |
| 首套验收结论 | **Windows 原生核心闭环、编辑态计时刷新、主题渲染边界、QA-01 回退回归、五套主题 25 页前端回归、Editorial 长历史性能专项、v2.6.10/v2.7.0/v2.8.0/v2.9.0/v2.9.1 Windows 与 macOS 资产发布、CORE-03 macOS 原生数据目录与迁移、DESK-02 macOS 第二实例/托盘/浮窗/隔离安装启动、DATA-01 备份范围/隔离跨目录搬移/素材清单已通过**；资源出处补录缺口已在清单中保留为后续治理事项 |
| source | 本轮用户说明；当前源码与测试；Git 提交/远程 refs；GitHub Release/Actions；本轮命令结果 |
| supersedes | 旧文档中的 v1.4.1/v1.5.x/v1.10.0/v2.0 当前进度，以及 2026-09-06 摘要中的“其他四页未实现、主题注册未建立” |
| pending | REFINE-04/05 与 REL-03 均已完成验收和发布；资源出处补录缺口仍按既有清单保留为后续治理事项，不影响本次主题精修发布；旧任务 DONE 仍只表示历史功能/发布闭环 |

### 最新用户纠正与主题精修阶段（2026-09-09）

用户明确指出：后三套主题基本是换色，偏离了概念图以及“各个主题风格迥异”的要求；后续工作改为一个主题一个主题地精修。旧 TH-03/04/05 不回写为失败，因为它们记录的是当时的五页接线、公共行为、测试与发布闭环；新增精修任务专门负责视觉概念是否真正成立。

精修阶段的独立设计契约：

- **REFINE-03 Graphite Console**：工业控制台 / 信号仪表 / 队列舱位；金属机箱、铆钉、硬边倒角、荧光信号、密集遥测与操作轨，不得继续使用泛化的深色卡片壳。
- **REFINE-04 Aurora Ocean**：深海极光 / 流体光场 / 轨道气泡；玻璃水滴、潮汐路径、透明有机容器与漂浮层次，不得沿用 Graphite 的金属控制台骨架。
- **REFINE-05 Botanical Library**：木质书房 / 植物生长档案 / 纸张与陶土；书架、纸卡、木桌、植物和暖灯，不得沿用控制台或玻璃气泡骨架。

三套主题继续共享 `MainShell` 的业务状态与动作，但可以且应当拥有独立的页面布局、组件语义、材质系统、导航形态和交互反馈。每套精修必须有概念图差异审计、五页验证、真实数据边界说明和独立视觉证据。

2026-09-09 20:45：用户确认“先把所有的主题都精修了”，因此在 Graphite 已完成的基础上继续执行 REFINE-04 Aurora Ocean，完成后按依赖执行 REFINE-05 Botanical Library；不得把两套剩余主题压缩成换色批处理。

2026-09-09 22:25：Aurora Ocean 五页已改为深海极光 / 流体光场 / 轨道气泡体系，Botanical Library 五页已改为木质书房 / 纸卡 / 植物生长档案体系；两套主题均保留 MainShell 真实业务动作，但不再共享 Graphite 控制台骨架。进入 REL-03 统一发布收口。

**进度读取规则：**最新明确用户要求 > 当前源码/运行结果/远程事实 > 本看板 > 历史文档。后续开始工作先刷新以上版本和提交，不能把今天的基线当永久事实。任务勾选必须有结果证据，不能按版本号、文件数或截图数量计算“完成百分比”。

## 1. 项目已经是什么

### 产品与边界

面向个人长期使用，核心承诺来自 `PRODUCT.md`：打开后约 5 秒内理解当前状态和下一步，从下一件待办进入专注不超过 3 个主要操作。这是产品验收目标，本轮没有开展真实用户计时研究，不能声称已测得达标。

目前提供 Windows x64 和 macOS Universal 发布资产；Windows 是本轮核查环境。无账号、本地核心功能、无强制联网，保留数据控制权。已废弃的方舟、抽卡、货币和养成方向继续归档；云同步、团队协作、插件平台也不在本轮范围。

### 架构与能力进度

| 领域 | 已有能力与实现位置 | 当前判断 / 尚缺证据 |
| --- | --- | --- |
| 前端 | SolidJS + TypeScript + Vite；`src/App.tsx` → `src/MainShell.tsx` → `ThemeSurface` → 五套主题各五页 | 五套主题共 25 页真实接线；完整浏览器回归 57/57；Botanical 证据见 `docs/qa/TH-05-acf3b2b.md`；原生窗口仍缺 macOS 专项证据 |
| 计时引擎 | `src-tauri/src/runtime.rs`；正向计时、倒计时、阶段提醒、暂停/继续、完成、上下文与恢复 | 核心逻辑存在且有单测；Night Valley 已按未开始/运行/暂停/到点待保存/保存成功/恢复表达状态；重启/休眠/时钟变化、失败重试需专项验收；后端保留 pomodoro 兼容模式，当前主界面只暴露正向/倒计时 |
| 待办闭环 | `src/lib/tasks.ts`、MainShell、Rust commands；截止日期、可选时间、重要度、编辑/完成/删除/撤销、带入专注 | 有流程回归；大量任务、跨窗口操作及写盘失败需补充 |
| 专注记录与统计 | Rust analytics + `NightValleyRecords`；记录编辑/删除、日汇总、跨午夜分摊、连续活跃日、档案轨迹 | 页面近七日现按自然日总量 ÷ 7，活跃日平均已标明分母，范围随当前七日档案变化；范围选择与记录导出仍禁用 |
| 桌面集成 | `src/lib/window-controls.ts`、runtime、main；托盘、隐藏恢复、窗口拖动、悬浮待办/计时、穿透锁与解锁 | mock 流程有覆盖；不能替代 WebView2 / macOS 原生窗口实测；非 Windows 单实例分支直接返回 true |
| 存储与恢复 | `storage.rs`；state/runtime 分文件、耐久临时写入、有效快照备份、缺失/损坏/不可读回退、用户备份、旧格式迁移 | CORE-01 已覆盖单文件保存/恢复与故障注入；CORE-02 已补齐启动保护与跨 state/runtime 事务回退；CORE-03 已用 macOS 原生 smoke 核对 Application Support 路径和旧目录迁移 |
| 设置与本地素材 | 提醒、音效、自定义音效、每日一句、主题预览、本地偏好 | 1000 条语料本地打包且记录来源字段；NV-01 已让外观强调/动效/密度实时驱动当前页面并显式保存；浏览器存储偏好与 Rust 备份并非同一范围 |
| 测试与构建 | Playwright 58 项、Rust 库 32 项、TS 检查、Vite 构建、GitHub Windows CI / macOS 打包与原生 smoke | v2.9.1 本地串行前端 58/58、Rust 32/32、2061 modules；Checks `34330682891`、macOS Native Smoke `34330682984`、Universal Release `34330712307` 均 PASS |
| 发布与交接 | Windows EXE/MSI、macOS DMG、版本说明、发布脚本 | v2.9.1 四项资产存在且 digest 已核对；main、tag、Release、README 与版本说明已同步；`docs/qa/DESK-02-342009c.md` 留存证据 |

### 历史主线（归纳，不是当前任务顺序）

1. v1.x：转向纯效率工具，补齐计时、待办、备份、提醒与基础桌面交互。
2. v2.0：专注闭环、今日入口、可解释复盘、迁移与流程测试。
3. v2.3.x：持续修复悬浮窗口、提醒等体验，并增加 macOS Universal 发布。
4. v2.4–v2.5：今日页转为山谷路径，支持随真实数据增长的任意段数。
5. v2.6.0–v2.6.9：五套概念归档，第一套五页实现，随后多次修正布局、品牌、导航和计时路径。

## 2. 五套前端的真实进度

“五套”指五个主题方向，每套均包含 **今日、计时、待办、记录、设置**；并非总共五个页面。

| 套系 | 概念图 | 可运行页面 | 注册/预览 | 整体验收 | 后续阶段 |
| --- | --- | --- | --- | --- | --- |
| 01 Night Valley / 夜谷 | 5/5 | 5/5 已接线 | 可用，`implemented: true` | 待收口 | 当前 |
| 02 Editorial Paper / 编辑纸页 | 5/5 | 5/5 已接线 | 已注册，可用，`implemented: true` | DONE（v2.6.10 已发布） | 已完成 |
| 03 Graphite Console / 石墨控制台 | 5/5 | 5/5 已接线 | 已注册，可用，`implemented: true` | DONE（v2.7.0 已发布） | 已完成 |
| 04 Aurora Ocean / 极光海面 | 5/5 | 5/5 | 已注册，可用，`implemented: true` | DONE（v2.8.0 已发布） | 已完成 |
| 05 Botanical Library / 植物书房 | 5/5 | 5/5 已接线 | 已注册，可用，`implemented: true` | DONE（v2.9.0 已发布） | 已完成 |

证据：`src/lib/themes.ts`，`src/MainShell.tsx`，`src/components/TodayDashboard.tsx`，`src/components/NightValleyViews.tsx`，`docs/design-references/concept-images/`，`public/theme-previews/`。

第一套不是从零重做。保留现有业务与已确认的山谷、金色路径、薄荷状态、共享品牌及导航。概念图决定视觉参考，真实业务决定内容与状态；不能为了靠近图片制造任务、固定历史日期、伪造进度或提供无效设置。

## 3. 现有计划是否合理

**方向合理，执行结构需要升级。**先完成一套再扩展其余四套、本地优先、小步发布、保留真实业务，都是正确约束。已有测量资料、主题注册和回归测试也值得保留。

问题在于旧计划仍围绕早期“每版再润色一个视觉点”，缺少整个产品的共同完成条件：

| 问题 / 证据 | 为什么现有设计允许它发生 | 本计划处理 |
| --- | --- | --- |
| 旧路线图/摘要仍写 v1.x 或 v2.0；README 原写 v2.5.0 | 没有唯一实时入口，归档与现状混在一起 | 根目录看板为当前执行源，历史资料只提供出处；每次任务结束更新证据 |
| v2.6.9 tag 曾指向功能分支提交；main 曾落后多个提交 | 发布脚本和分支集成没有统一验收；macOS 打包成功容易被当作全项目 CI 成功 | REL-01 已用 v2.6.10 验证 main、tag、Windows Checks、macOS workflow 和四项 Release 资产的对应关系；后续版本重复执行 |
| `storage.rs` 保存采用 tmp → copy backup → remove 原文件 → rename；缺主文件直接返回默认状态 | 文件替换中断和恢复读取策略没有作为完整故障流程设计 | CORE-01/02 先封住数据可靠性缺口，优先于继续美化 |
| 外观值只保存在 signal/localStorage，根节点未消费；保存文案固定成功 | 控件是否存在被误当作功能完成，缺乏“修改 → 实际效果 → 重启 → 失败反馈”的验收 | NV-01 以实际渲染和持久化结果验收 |
| 记录页固定范围、近七天平均使用历史活跃日平均；计时七点与四阶段映射不一致 | 概念图占位内容与业务状态映射未被分开管理 | NV-02/03 先修事实口径和状态语义 |
| App.css 6846 行、MainShell 3399 行，多轮覆盖和 `Show when={false}` 旧视图 | 迭代成本被推入全局级联和壳层，局部修复缺少结构收口 | 建基线后有限拆分；共享业务，允许主题拥有不同布局，不复制五份状态机 |
| 很多 visual 用例只截图/断言可见；缺少五页统一像素基线和证据元数据 | 截图产出与验收混淆，旧 diff 没有绑定最新提交 | 固定 fixture/日期/DPR，几何与业务分开回归；每轮证据绑定 SHA |

审查重点从“看起来更像”扩为“数据可信、状态真实、关键路径顺手、五页一致、桌面可用、可发布可维护”。不为了扩大计划而引入账号、云服务或大架构重写。

## 4. 本轮验证与限制

以下结果是 ARCH-01 之前的 NV-06 基线 `a52796f`、发布基线 `473cc67` 的历史验证，日期为 2026-09-08；ARCH-01 最终源码的最新 `check`、45/45 前端回归、构建与包证据见下方 ARCH-01 结果与 `docs/qa/ARCH-01-abf2bc4.md`。

| 验证 | 结果 | 能证明什么 / 不能证明什么 |
| --- | --- | --- |
| `pnpm check` | PASS | NV-06 后 TypeScript 检查通过 |
| `pnpm build` | PASS，有 >500 kB chunk 提示 | NV-06 后主 JS 639.35 kB、CSS 255.80 kB（构建输出，压缩前）；不等于长期运行性能达标 |
| `pnpm test:frontend` | PASS，44/44，约 1.2 分钟 | NV-06 后 Chromium + Tauri mock 下流程、五页几何/窗口/DPR 矩阵、状态映射、七日口径、空数据与交互回归通过；不等于原生窗口、真实磁盘、像素一比一全通过 |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS | 当前功能分支格式通过；旧 main 的 CI 失败不代表当前格式仍失败 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | 当前 Windows Rust 编译检查通过 |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS | CORE-03 后 32/32 library PASS；binary harness 启动并返回 0（0 tests）；doc-tests 0/0 |
| v2.6.10 main Checks | PASS，run `34241297806`，SHA `ff46106`，约 10m24s | TypeScript、Vite build、Playwright 50/50、Rust fmt/check/test 全部通过；Step Summary 已写入提交、ref、runner 和工具版本 |
| v2.6.9 macOS Release | PASS，run `34148483003`，SHA `473cc67` | Universal 构建/上传成功；不证明 macOS 数据目录、单实例和原生交互都已验收 |
| GitHub v2.6.10 资产 | 安装 EXE、便携 EXE、MSI、Universal DMG 共 4 项存在 | 本地 Windows 三项产物与 Release digest 一致；Universal DMG 由 macOS run `34242511754` 构建并上传 |
| 视觉复核 | NV-04 五页基准、NV-06 最终 SHA 的 15/15 视觉专项、几何 JSON、窗口/DPR 矩阵、五张截图与报告 | Today 起点首节点边界已修正；四页非 Today 已统一离线 v4 材质并完成第一套截图验收；原生字体/材质一比一与平台缩放仍不宣称 |

参考：[v2.6.10 Release](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.6.10)、[v2.6.10 Checks](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34241297806)、[v2.6.10 macOS 构建](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34242511754)、[历史 v2.6.9 Release](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.6.9)。

本轮只读审查源码与临时测试夹具，不读取或迁移个人待办/记录/备份。没有宣称发生过用户数据丢失；下述存储问题是代码可见的失败路径风险，需要隔离复现。没有进行真实 macOS 冒烟、长时间资源测量或完整安全审计。

## 5. 优先级与阶段门槛

- **P0**：可能导致数据不可恢复、错误空状态覆盖、关键功能不可用的缺口；先隔离复现并修复，再发布。
- **P1**：错误反馈/统计、关键交互、平台行为、主线与 CI、首套必要验收。
- **P2**：首套质量与可维护性提升、其余主题开发；依赖完成后推进。
- **P3**：可选增强；先验证用户价值，不自动扩充范围。

| 阶段 | 出口条件 | 未通过时 |
| --- | --- | --- |
| G0 基线与数据可靠性 | ENG-00/01、CORE-01/02/04 完成；相关存储失败可恢复；测试失败有明确解决结果；待发布提交有完整 CI | 暂缓新的公开版本和第二套；可继续隔离验证与本地前端修复 |
| G1 第一套收口 | NV-01～06、DESK-01/03 完成；五页主流程/状态/实际桌面尺寸通过；视觉差异逐项记录并关闭或明确接受 | 只修首套缺口，不把它标为最终完成 |
| G2 可复用主题边界 | ARCH-01、QA-01 完成；第一套回归无退化；第二套接入方案清楚 | 不复制壳层/存储/计时业务，不把五套都做成单纯换色 |
| G3 主题逐套交付 | TH-02 → TH-03 → TH-04 → TH-05，每套五页、公共行为、原生窗口、切换/持久化、发布各过一遍 | 未完成主题继续禁用，不宣称五套完成 |
| G4 长期维护 | PERF-01、DATA-01、REL-01 持续执行；反馈、回归、版本和本计划同步 | 优先处理真实故障，再考虑增强 |

CORE-03、DESK-02 为 macOS 下一次发布门槛，可与 Windows 首套验收分别记录。它们未通过时不能用“DMG 构建成功”代替平台完成，也不能暗自删除现有 macOS 支持承诺。

## 6. 可执行任务队列

状态仅使用：`TODO`、`DOING`、`BLOCKED`、`REVIEW`、`DONE`。一个模型同时领取一项；有独立子任务可委派审查，但避免多人写同一个核心文件。以下依赖表示必须先达到任务验收，不强制每项单独发版。

| ID | 优先级 | 状态 | 依赖 | 任务与交付 |
| --- | --- | --- | --- | --- |
| PLAN-00 | P1 | DONE | 无 | 本轮整项目审查、根目录计划和历史摘要 |
| ENG-00 | P1 | DONE | PLAN-00 | 定位 Rust binary test 的 os error 5，恢复完整验证能力 |
| CORE-01 | P0 | DONE | PLAN-00 | 磁盘保存中断恢复、有效副本保护 |
| CORE-02 | P0 | DONE | CORE-01 | 启动错误可见、恢复/完成事务失败一致性 |
| CORE-03 | P1 | DONE | CORE-01 | 跨平台数据目录、旧目录发现与迁移（macOS 原生 smoke 已核对） |
| CORE-04 | P1 | DONE | PLAN-00 | 合法短倒计时重启/导入后保持原时长 |
| CORE-05 | P2 | DONE | CORE-02/04 | 兼容番茄多轮恢复与系统时钟变化边界 |
| ENG-01 | P1 | DONE | CORE-01/02/04 | 当前代码完整验证、main 集成与 CI 对齐 |
| NV-01 | P1 | DONE | PLAN-00 | 外观控件实际生效与真实保存反馈 |
| NV-02 | P1 | DONE | PLAN-00 | 记录日期/统计口径/零值修正 |
| NV-03 | P1 | DONE | PLAN-00 | 计时状态与阶段路径语义一致 |
| NV-04 | P1 | DONE | NV-01/02/03 | 五页固定视觉/状态基线与差异清单 |
| NV-05 | P1 | DONE | NV-04 | 五页响应式、键盘、焦点、错误态收口 |
| NV-06 | P2 | DONE | NV-04/05 | 分页视觉精修并完成第一套视觉验收 |
| DESK-01 | P1 | DONE | CORE-02、NV-03 | Windows 真机计时/悬浮/托盘/恢复冒烟 |
| DESK-02 | P1 | DONE | CORE-03 | macOS 数据、窗口、单实例与安装冒烟；功能、原生证据、v2.9.1 版本与四项 Release 资产已完成 |
| DESK-03 | P1 | DONE | CORE-02、NV-03 | 计时刷新与列表编辑解耦，多窗口状态一致 |
| ARCH-01 | P2 | DONE | G1 | 有限拆分视图/CSS，建立最小主题渲染边界 |
| QA-01 | P1 | DONE | NV-04、ENG-01 | 公共业务回归、主题专用视觉回归、CI 证据留存 |
| TH-02 | P2 | DONE | G0/G1/G2/REL-01 | 第二套 Editorial Paper 五页；实现、验证、版本化 Release 已完成 |
| TH-03 | P2 | DONE | TH-02 | 第三套 Graphite Console 五页；源码、测试、证据与 v2.7.0 Release 已完成 |
| TH-04 | P2 | DONE | TH-03 | 第四套 Aurora Ocean 五页；源码、测试、证据与 v2.8.0 Release 已完成 |
| TH-05 | P2 | DONE | TH-04 | 第五套 Botanical Library 五页；源码、测试、证据与 v2.9.0 Release 已完成 |
| PERF-01 | P2 | DONE | G1；第二套启用前先建立基线 | 启动/常驻/大历史性能预算与优化 |
| DATA-01 | P2 | DONE | CORE-02/03 | 备份包含范围、跨设备搬移流程、素材清单；隔离 round-trip、用户文档、资源清单与 QA 证据已完成 |
| REL-01 | P1 | DONE | ENG-01；每个版本重复 | v2.9.0 Botanical Library 版本、包、说明、主线、CI、平台资产与 GitHub Release 已完成；v2.8.0/v2.7.0/v2.6.10 同样完成 |
| REFINE-03 | P1 | DONE | TH-03、ARCH-01 | Graphite Console 主题精修：从换色控制台改为概念图对应的工业仪表 / 队列舱位 / 信号监控体系；五页布局、材质、状态反馈、独立视觉回归与 v2.9.2 发布闭环完成 |
| REL-02 | P1 | DONE | REFINE-03 | v2.9.2 Graphite Console 精修发布：版本同步、Windows 包、远程 main、Checks、macOS Native Smoke、Universal DMG、GitHub Release 与四项资产证据已完成 |
| REFINE-04 | P1 | DONE | REL-02 | Aurora Ocean 主题精修：五页改为深海极光、流体光场、轨道气泡、玻璃容器与潮汐路径；真实业务数据边界、独立结构断言、1487px 截图与 1120/820/560/420px 压力宽度验证已完成 |
| REFINE-05 | P1 | DONE | REFINE-04 | Botanical Library 主题精修：五页改为木质书房、书架、纸卡、植物节点、暖灯与年轮档案；真实业务数据边界、独立结构断言、1487px 截图与 1120/820/560/420px 压力宽度验证已完成 |
| REL-03 | P1 | DONE | REFINE-04/05 | v2.10.0 Aurora Ocean + Botanical Library 精修发布：版本同步、完整构建、Windows/macOS 资产、远程 CI、GitHub Release 与最终计划证据已完成 |

### CORE-01 · 磁盘保存与恢复链（第一个执行任务）

- **先读**：`src-tauri/src/storage.rs` 的 `save/load/save_runtime/load_runtime`，runtime 的 `persist_all` 与初始化。事实：主文件不存在直接返回默认值；读取失败未必进入 backup 回退；替换前删除旧文件会留下缺文件窗口。
- **范围**：先给存储层注入临时目录/文件操作失败测试入口；仅使用临时夹具，禁止在真实应用数据目录做破坏性测试。
- **实现目标**：选择适合 Windows/macOS 的可靠替换策略，保留最后有效副本；主文件缺失、无效、不可读分别处理；恢复成功/失败可区分。不能只把 rename 换一行就宣称断电安全。
- **验收**：在写 temp、备份、替换各阶段注入失败/中断；重启后读取完整旧版或完整新版；不能以空数据覆盖有效副本。全新账户没有任何存档时正常初始化；检测到已有存档损坏或读写故障、又无有效恢复来源时返回明确错误。对 state/runtime 两条路径均覆盖，并记录跨文件一致性由 CORE-02 负责。
- **交付**：失败复现测试、修复、测试输出与恢复策略说明。`cargo fmt/check/test`，不要通过删除测试或关闭保护解决失败。
- **本轮结果（2026-09-08）**：`storage.rs` 改为写入并 `sync_all` 临时文件后再提交；更新前只从可解析的主文件生成快照，主文件移动/新文件提交失败时保留可恢复副本；主文件缺失、JSON 无效或不可读时按“有效主文件 → 有效快照 → 明确错误/全新默认”顺序处理。state/runtime 共覆盖 temp、backup、移动主文件、提交新文件四个注入阶段，以及缺失/损坏/不可读/无有效恢复源；`clear_runtime` 会同步清理快照，避免故意清空后被旧运行态复活。
- **验证证据**：`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS；library 18/18、binary 0、doc-tests 0；未执行前端测试（本轮仅改 Rust 存储层）。跨 state/runtime 的事务一致性仍留给 CORE-02。

### CORE-02 · 启动和业务写入不能伪成功

- **先读**：`TimerEngineState::new` 的启动加载分支、`persist_all`、`apply_backup_file`、`import_app_backup`、`complete_focus_session`，以及前端加载/错误反馈。
- **实现目标**：区分首次启动无数据与已有数据读取失败；已有数据出错时展示可理解的恢复状态，禁止无声降成空应用并自动覆盖。复核“内存已改、磁盘失败、响应报错”后的重试结果及恢复/回滚一致性。
- **修复前已确认细节**：初始化存储失败会留下 `persistence: None`，`persist/persist_runtime` 此时仍返回成功；备份应用与完成专注先改内存，再分别写 state/runtime；导入前虽有回退备份，但应用失败未自动恢复。CORE-02 将这些路径统一为明确的提交/回退结果，不能只增加 toast。
- **验收**：不可写目录、损坏主/备份、导入不支持的 schema、恢复第二阶段失败、完成保存失败分别有稳定结果；失败后任务、记录、运行态相互一致；重试不重复记录，不报虚假成功。旧备份迁移夹具仍过。
- **边界**：先补证据再选择回滚、事务协调或提交后应用状态的最小方案；不默认重写数据库，不改变用户计时规则。
- **本轮结果（2026-09-08）**：`TimerEngineState::new` 区分存储目录准备失败、state 读取失败、runtime 读取失败和迁移写入失败，进入恢复保护并通过既有前端 `loadState/loadError` 展示错误与重试入口；恢复保护状态不会把默认空数据暴露为可操作成功，也不会继续写盘。`persist`、`persist_runtime` 和跨文件 `persist_all` 均返回明确失败，跨 state/runtime 写入在第二阶段失败时回退磁盘与内存；备份导入、完成专注、清空数据、会清理计时关联的待办删除/完成路径统一使用事务写入，避免半提交。
- **验证证据**：新增/保留 `persistence_failure_is_not_reported_as_success`、`persist_all_rolls_back_memory_and_disk_when_runtime_commit_fails`、`backup_import_failure_restores_the_previous_bundle`，并复用 CORE-01 的 state/runtime 故障注入、损坏/缺失/不可读/无恢复源及旧备份迁移夹具；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 21/21、binary 0、doc-tests 0）；`pnpm check` PASS，`pnpm test:frontend` PASS（32/32）；`git diff --check` PASS。
- **剩余边界**：不可写目录使用隔离故障注入覆盖写入阶段，未在真实用户目录做破坏性权限测试；跨平台规范数据目录与旧目录迁移留给 CORE-03；版本、发布资产和远程 main/CI 尚未因本任务发布。

### CORE-04 / CORE-05 · 恢复后计时仍然是用户设置的那一轮

- **修复前确定缺陷**：runtime 的 `set_countdown_minutes` 支持 1–720 分钟，但 `from_persisted_runtime` 将时长取 `.max(DEFAULT_COUNTDOWN_MINUTES * 60000)`，因此合法 1–24 分钟会被恢复为 25 分钟；备份导入也经过此路径。
- **CORE-04 最小改动**：区分缺失/非法值与合法短时长，只给前者默认值；不改变公开的 1–720 分钟范围。
- **验收**：1、5、24、25、60、720 分钟分别做运行/暂停/到点状态序列化→恢复与备份导入，时长、已用时间、剩余、完成状态正确；0、超范围与旧格式有明确兼容处理；恢复后完成只保存一次。
- **CORE-04 本轮结果（2026-09-08）**：新增 `normalize_countdown_duration_ms`，只接受 1–720 分钟范围内的整分钟值；缺失、非整分钟和越界值回退 25 分钟，并将恢复时的已用时间限制在恢复后的总时长内。重启恢复与 `normalize_imported_runtime` 备份导入共用同一规则，未改变公开设置范围。
- **CORE-04 验证证据**：新增 4 项 Rust 测试，覆盖 1/5/24/25/60/720 分钟、0/90 秒/721 分钟非法值、暂停/运行/结束状态及 5 分钟备份导入后内存和磁盘值；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 25/25、binary 0、doc-tests 0）；`pnpm exec playwright test tests/app.spec.mjs --grep "countdown duration keeps"` PASS（1/1）。
- **CORE-04 剩余边界**：番茄多轮、睡眠和系统时钟前跳/回拨语义仍由 CORE-05 处理；没有为恢复修复引入新的计时模式或产品入口。
- **CORE-05 原有边界**：旧 pomodoro 自动跨轮使用单个 `pending_pomodoro_record_ms`，此前会让第 2/10 轮焦点计数和待记录时长不一致；本轮保留旧字段和“延后确认”规则，不新增记录队列或模式入口。
- **CORE-05 本轮结果（2026-09-08）**：多个未确认焦点轮次现在累加到同一个待记录时长，且每轮焦点/休息计数与阶段路径同步递增；立即确认仍只生成一条当前待记录，延后确认不会静默丢掉后续轮次。持久化与恢复保留阶段、计数、待记录时长和运行锚点，恢复后可继续完成这一条兼容记录。
- **时钟策略与结果**：继续采用单调时钟与墙钟增量取较大值，睡眠时间会计入，系统时间前跳也会计入，墙钟回拨不会产生负增量；抽出带显式 now 参数的纯计算路径，固定夹具覆盖单调领先、睡眠、前跳和回拨，并记录这套目标语义，不宣称已消除真实系统时钟跳变风险。
- **CORE-05 验证证据**：新增多轮延后确认恢复、睡眠恢复和时钟边界 3 项 Rust 测试；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 28/28、binary 0、doc-tests 0）；`pnpm check` PASS；未做真实休眠/手动改系统时钟测试，也未改版本或发布资产。

### CORE-03 / DESK-02 · macOS 支持从能打包推进到能可靠使用

- **历史事实**：CORE-03 开始前，`PersistenceStore::new` 优先 `LOCALAPPDATA/APPDATA`，否则 `current_dir`，没有明确 macOS Application Support 分支；`main.rs` 非 Windows 单实例直接返回 true。
- **实现目标**：应用数据目录与启动工作目录无关；明确 Windows/macOS 的规范位置；安全发现已有目录，迁移前备份、验证成功后切换，不盲目搬动或删除旧数据。
- **CORE-03 验收**：不同启动目录仍读取同一账户数据；升级后记录/偏好/运行态仍在；旧目录迁移前备份、验证和源目录保护成立；macOS native app 能启动、重启并使用规范 Application Support 目录。第二次打开、托盘、浮窗和正式安装交给依赖 CORE-03 的 DESK-02；无法取得 macOS 环境时才标 BLOCKED。
- **本轮实现（2026-09-08）**：`PersistenceStore::new` 现在按平台选择规范数据根目录：Windows 使用 `LOCALAPPDATA`（缺失时回退 `APPDATA`），macOS 使用 `~/Library/Application Support`，其他平台保留当前工作目录作为兼容回退；实际存储仍位于 `FocusedMoment/`，不再随启动工作目录漂移。启动时发现旧的工作目录 `FocusedMoment/` 且规范目录为空，会先创建带时间戳的迁移备份，再复制到暂存目录，同时验证 state/runtime，验证成功后切换目录；源目录不删除，目标非空不覆盖，失败时保留源和备份并返回明确迁移错误。符号链接和不支持的文件类型拒绝迁移，避免把数据目录边界扩大到目录外。
- **验证证据**：新增平台路径优先级、有效旧目录迁移、无效快照拒绝切换、目标非空不覆盖测试；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 32/32、binary 0、doc-tests 0）；`pnpm check` PASS；`pnpm test:frontend` PASS（32/32，约59.5秒）；代码已提交并推送 `348b2e9`。测试只在 Windows 隔离临时目录执行，未读取或迁移真实用户数据。
- **macOS 原生验证结果（2026-09-09）**：源码提交 `c71b3b8`；GitHub macOS Native Smoke run `34309093299` 在 macOS 26.6.2 arm64 通过 Rust 测试、unsigned debug `.app` 构建和隔离 native smoke。合成 HOME 下实际创建 `~/Library/Application Support/FocusedMoment`，从两个不同工作目录启动时新启动不写工作目录；有效旧 state/runtime 迁移后保留数据、源文件 SHA-256 不变并创建时间戳备份；停止后从第二个工作目录重启继续读取；`open -n` 的 LaunchServices/Finder 风格 bundle 启动成功。报告见 `docs/qa/CORE-03-8c38226.md`，artifact `10087780703`。
- **当前状态**：CORE-03 已完成并解除对 DESK-02 的依赖。透明窗口日志仍提示未启用 `macos-private-api`，但没有阻止本次启动/迁移/重启；第二实例、托盘菜单、浮窗和正式安装仍由 DESK-02 验收，不把本次 storage smoke 扩大解释为完整桌面交互通过。

### DESK-02 · macOS 数据、窗口、单实例与安装冒烟

- **实现结果（2026-09-09）**：macOS 接入 `tauri-plugin-single-instance`；第二次原生启动唤回已有主窗口而不创建第二实例；主窗口关闭请求默认隐藏；菜单栏托盘提供显示主界面/退出应用；命令面板提供悬浮工作台入口。托盘原生验证在主线程保存 `NSStatusItem`，用 AppKit `NSStatusItem.performClick` 打开菜单，再通过第一菜单项恢复主窗口，规避 macOS 26 ControlCenter 对第三方状态项坐标/Accessibility 暴露不稳定的问题。
- **远程验收**：发布提交 `9938c08`；macOS Native Smoke run `34330682984` 在 macOS 26.6.2 arm64 通过 Application Support 数据目录、旧目录迁移、不同工作目录重启、第二实例、窗口/菜单探测、原生托盘菜单、浮窗、LaunchServices/Finder 风格启动、隔离 DMG 挂载复制与安装后启动。托盘标记 `FOCUSED_MOMENT_TRAY_NATIVE_CLICK=ok`、`FOCUSED_MOMENT_TRAY_MENU_SHOW_MAIN=ok` 均存在。
- **本地/CI 验证**：`pnpm check`、`pnpm build`（2061 modules）、`pnpm test:frontend -- --workers=1`（58/58）、`cargo fmt --check`、`cargo check --locked`、`cargo test --locked`（32/32）、`pnpm package:debug`、`pnpm package:release` 均通过；Checks run `34330682891` 通过，报告见 `docs/qa/DESK-02-342009c.md`。
- **发布结果**：v2.9.1 tag/Release 已收口，Universal macOS Release run `34330712307` PASS；Windows EXE/NSIS/MSI 与 macOS Universal DMG 四项资产 digest 已核对。
- **边界**：Accessibility/SystemUIServer 状态栏位置探测记为 `UNAVAILABLE`，但不影响实际原生 NSStatusItem 点击和菜单回调通过；DMG 为 unsigned debug 安装证据，未声称公证、签名或真实 `/Applications` 安装。任务记为 `DONE`；DATA-01 负责跨设备数据搬移和备份范围。

### ENG-00 / ENG-01 · 代码、测试、main 与发布版本对齐

- **先读**：`.github/workflows/ci.yml`、`release-macos.yml`、`scripts/release-ship.ps1`、`scripts/publish-release.ps1`；先刷新远程 refs，保留已有改动。
- **ENG-00**：先定位本轮 cargo 二进制测试的 `os error 5`；确认执行文件、环境与权限现状，不关闭系统安全软件、不把仅 lib 通过冒充整命令成功。验收为完整测试可执行且通过，或在可复现的受支持环境取得同一 SHA 完整测试成功，并明确本机限制；不可仅凭推断关闭此任务。诊断尚未结束时可独立开展 CORE-01 的临时夹具复现，但必需验证未过的任务保持 REVIEW。
- **ENG-01**：CORE 修复与完整验证通过后检查当前分支与 main 的差异，以可审查 PR/正常合并对齐，禁止强推或重指已发布 tag。
- **验收**：待集成提交有完整 CI，main 确实包含要发布的改动，Release tag/构建提交/资产版本一一对应。旧 main format 失败已在当前分支通过，应验证新 SHA，不能继续针对旧失败反复改格式。
- **额外**：发布脚本语法是否仍有旧文档所述编码问题先实测解析；`release:ship` 当前要求 main+干净工作区，不在功能分支盲跑。关键设计资料在干净 checkout 可用，解决 `docs/` 忽略造成的交接缺文件，只显式加入所需文件。
- **ENG-01 本轮结果（2026-09-08）**：`git fetch --prune origin` 成功；当前功能分支 `f12786b` 相对 `origin/main=bcf23fa` 领先 10 个提交且无反向提交，先推送功能分支，再以普通 `--no-ff` merge 生成 main 集成提交 `abcc80a` 并成功推送 `origin/main`。未强推、未移动 v2.6.9 tag。
- **ENG-01 验证证据**：`release-ship.ps1`、`publish-release.ps1` 静态解析通过；本地 `pnpm build`、`pnpm test:frontend`（32/32，约59.1秒）、`cargo fmt --check`、`cargo check`、`cargo test`（library 28/28、binary 0、doc-tests 0）均通过。GitHub Checks run `34190010987` 在 `abcc80a` 上成功，job 7m48s，TypeScript、Vite build、Playwright、Rust fmt/check/test 全部通过。
- **ENG-01 发布边界**：当前源码仍是 v2.6.9，Release tag/既有四项资产仍对应 `473cc67`；按仓库协议不在本任务中把新功能伪装成旧版本或移动已发布 tag，版本、安装包、Release 说明和资产闭环留给 REL-01。

### NV-01 · 外观设置有真实结果

- **先读/允许修改**：MainShell 的 `readPercentage`、`saveVisualSettings`、根元素；NightValleySettings；对应 CSS；针对性测试。
- **问题**：缺失 localStorage 值被 `Number("")` 转为 0，72/44 默认值不生效；滑块/密度没有接入渲染；写入失败返回值被忽略，“预览实时更新 · 已保存”固定显示。
- **验收**：新用户取定义的默认值；视觉强调实际改变有限样式参数；密度实际改变间距；动效强度可关闭动画，并服从系统 reduced-motion；预览与实际页面一致；保存成功后重启保持；模拟存储拒绝/配额失败时明确提示未保存。
- **约束**：一次确定“即时保存”或“预览后保存”语义并贯彻，不保留两套相互矛盾的提示；先修有效性，不新增字体/背景上传等功能。
- **NV-01 本轮结果（2026-09-08）**：统一为“实时预览、显式保存”：主题、视觉强调、动效强度和页面密度先作用于当前 Night Valley 根节点，点击保存后一起写入 localStorage；缺失百分比值回到 72/44 默认值。视觉强调驱动背景可见度，页面密度收紧设置/核心面板间距，动效为 0 时关闭应用内动画与过渡，低于 50% 使用更慢的核心环境动画，并继续服从系统 `prefers-reduced-motion`。保存文案改为“点击保存后保留”，不再把预览误报为已持久化。
- **验证证据**：新增外观默认值、实时 CSS 属性/密度/动效状态、显式保存后重载保持，以及 localStorage 配额拒绝的 Playwright 回归；`pnpm check` PASS；`pnpm test:frontend` PASS（34/34，约1分钟）；`pnpm build` PASS（主 JS 636.06 kB、CSS 255.99 kB，保留既有 >500 kB chunk 警告）；设置页截图 `output/playwright/night-valley-settings.png` 已目视核对无新增溢出；源码与测试提交并推送 `66b5da5`。未改版本或 Release 资产。

### NV-02 · 复盘的每个数字可解释

- **本轮开始（2026-09-08 14:04 +08:00）**：起始 SHA 为 `58eb829`。先修当前 Night Valley 记录页的动态七日范围、自然日平均、活跃日平均标签和零投入柱高，再用固定日期及空数据夹具逐项验收；不新增导出或日期筛选能力。
- **事实**：NightValleyRecords 固定显示 `8月30日 — 9月5日`；`最近 7 天，平均每天` 使用 `averageDailyDurationLabel`，而 runtime 用全部历史时长 ÷ 历史活跃日计算；柱图有最低 10% 高度。
- **目标**：范围来自当前真实日期/筛选；近七天自然日平均 = 七天总量 ÷ 7，缺失日补 0。若展示活跃日平均，标签明确写活跃日并采用对应分母。可优先用现有 `recentWeekDurationMs` 派生，避免新增后端字段。
- **验收**：0 数据、仅今天、仅七天前、跨月、跨午夜、长历史夹具逐个对账；零投入不画成非零量；时区口径与 Rust 一致；禁用导出/范围入口不伪装成已支持，不因此擅自新增导出功能。
- **NV-02 本轮结果（2026-09-08）**：记录范围改为从前端补齐的当前本地七日档案首尾日期生成，稳定显示月/日中文文案；范围入口仍保持禁用，并明确提示筛选尚未接入。趋势文案改用 `recentWeekDurationMs ÷ 7`，缺失日按 0 计入；历史统计保留 runtime 的活跃日分母并明确标注“活跃日平均”。分布柱仅对非零日保留最小 10% 可见高度，零投入日为 `0%`，避免把空数据画成投入。
- **验证证据**：新增固定 `2026-09-05` 夹具，核对 `8月30日 — 9月5日`、七日总量 `05:15:00 ÷ 7 = 00:45:00` 与历史活跃日平均 `00:35:00`；新增空数据夹具，核对七日平均 `00:00:00` 与 7 根 `0%` 柱；长历史记录页回归仍通过。`pnpm check` PASS；定向用例各 1/1 PASS；`pnpm test:frontend` PASS（36/36，约 1.1 分钟）；`pnpm build` PASS（主 JS 636.56 kB、CSS 255.99 kB，保留既有 >500 kB chunk 警告）；`git diff --check` PASS；源码与测试提交并推送 `ab5ba9b`。
- **剩余边界**：范围选择和导出仍未接入，未伪装为可用；本轮 UI 证据运行于 Chromium + Tauri mock，Rust 的跨午夜拆分单测仍是后端事实依据，未宣称完成原生平台或真实用户数据验收；版本/Release 资产留给 REL-01。

### NV-03 · 状态决定路径含义

- **本轮开始（2026-09-08 14:21 +08:00）**：起始 SHA 为 `5a8099c`。先以现有 `TimerSnapshot` 推导未开始、运行、暂停、到点待保存、保存成功、恢复六类状态；保留七个视觉节点但移除编号和可访问的七阶段暗示，不新增番茄产品入口。
- **事实**：`NightValleyFocus.phaseIndex` 只返回 0/1/2；四个标签包含“完成”，路径却有七个编号点，完成标签不可激活且并非七个业务阶段。
- **目标**：记录状态映射表，区分未开始、运行、暂停、到点待保存、保存成功、恢复。优先用现有快照字段推导；图中七点如只是装饰，去除暗示七个真实阶段的编号/可访问语义；如代表记录，则必须由真实记录生成。
- **验收**：正向/倒计时各走一轮；运行/暂停文字与按钮一致；到点待保存不误报已记录；保存只增加一条记录并正确更新关联待办；保留兼容 pomodoro 恢复，但不新增产品模式入口；不为贴图虚构“休息中”。
- **NV-03 本轮结果（2026-09-08）**：新增基于 `TimerSnapshot` 的六态映射：未开始、运行中、已暂停、到点待保存、保存成功、已恢复；倒计时剩余为 0 且有时长时进入待保存，不再落回“专注”；保存成功由一次性前端确认信号表达，下一轮启动/重置/切换模式会清除。路径保留七个视觉节点，但只有四个真实状态锚点参与 active/done，移除节点数字、SVG 可访问阶段语义和“休息”标签；兼容 pomodoro 的恢复/待保存状态仍可被映射，不新增产品入口。
- **验证证据**：Tauri mock 新增完整保存返回，回归运行/暂停/完成只调用一次保存；覆盖暂停→运行→暂停→保存成功、倒计时到点待保存、恢复态，确认按钮/文案和状态一致；原有路径几何断言与计时截图目视通过。`pnpm check` PASS；NV-03 定向状态用例 3/3、路径几何 1/1 PASS；`pnpm test:frontend` PASS（39/39，约 1.2 分钟）；`pnpm build` PASS（主 JS 637.64 kB、CSS 255.77 kB，保留既有 >500 kB chunk 警告）；`git diff --check` PASS；源码与测试提交并推送 `ff6daf5`。
- **剩余边界**：本轮验证使用 Chromium + Tauri mock，未替代 Windows/macOS 原生计时与多窗口实测；真实 pomodoro 兼容恢复由 Rust 单测覆盖，主界面仍不暴露该模式；版本/Release 资产留给 REL-01。

### NV-04 / NV-05 / NV-06 · 第一套从能展示到可验收

- **NV-04 本轮开始（2026-09-08 14:41 +08:00）**：起始 SHA 为 `7ed8f7b`。先绑定五页固定视口、字体/DPR、固定日期与业务 fixture，重新生成当前 SHA 对应的五页截图和环境元数据；再按页面与状态建立可复核几何/状态断言及命名差异清单。本轮只建立基线和审计证据，不提前修复属于 NV-05/NV-06 的响应式、键盘或视觉精修问题。

1. 先记录五页参考与当前截图的视口、字体、DPR、日期、fixture、提交、截图时间；产物存 `output/qa/<任务ID>/<SHA>/`，摘要存可跟踪的 `docs/qa/`，不沿用无法对应当前 SHA 的 diff 数值。
2. 分开建立稳定业务 fixture 与匹配参考构图的视觉 fixture。现有测试固定日期是好基础；补截图比较或可复核几何断言，不用“截图成功”作为通过标准。
3. 基准 `1487×1058`；实际默认主窗口 `1440×1024`；当前配置最小 `1120×760`；验证最大化及系统 125%/150%/200% 缩放。`1024×900`、`820×600`、`420×720` 是浏览器布局压力测试，不是已经支持的原生最小窗口承诺。
4. 保留既有同环境几何目标：面板边界/节点中心 ≤2 px，路径中心线 ≤3 px，文字基线 ≤2 px、同文案宽度尽量 ≤3%。字体/DPR/原素材不明时标明限制；文本与真实数据差异不计为伪几何错误；不能降低阈值后声称一比一。
5. 修复顺序：结构/滚动/关键操作 → 文字与状态 → 色彩材质 → 光影动效。优先检查 Today 首末节点标签裁切、Timer 主操作位置与阶段表达、Todo 长列表、Records 真实数据密度、Settings 底部保存与备份可达。
6. 每页覆盖空/常规/长文本/大量数据、loading/error/busy、hover/focus/disabled；计时另加暂停/到点/恢复。用 Tab、Enter、Space、Esc 完成关键路径，焦点可见且不丢失；正文对比度 ≥4.5:1，大字 ≥3:1；状态不只靠颜色；系统减少动画时无强制运动/平滑滚动。
7. 每次视觉差异只解决一个可命名问题，保持参考风格与产品行为。没有功能的概念装饰不做假按钮；新素材随构建离线可用并记录来源。

- **NV-04 本轮结果（2026-09-08）**：在 `tests/today-visual.spec.mjs` 增加五页几何/环境元数据输出和默认窗口 `1440×1024`、配置最小窗口 `1120×760`、最大化代理 `1920×1080`、125/150/200% DPR 代理矩阵；固定日期 `2026-09-05`、7 条 45 分钟记录、1 条待办和空备份 fixture，并用 reduced-motion + 禁动画截图固定静态基线。五张基准图、`geometry.json`、`scale-matrix.json` 绑定 `94e0b2e`，摘要与 8 项命名差异见 `docs/qa/NV-04-94e0b2e.md`。
- **NV-04 验证证据**：`pnpm check` PASS；`pnpm test:frontend` PASS（41/41，约 1.6 分钟）；视觉专项在 Chromium + Tauri mock 下通过，截图均为 `1487×1058`；`git diff --check` PASS；最近一次应用构建仍 PASS（主 JS 637.64 kB、CSS 255.77 kB，保留既有 >500 kB 警告）。未改版本、应用源码或 Release 资产；`output/qa` 产物保留在工作区，`docs/qa` 报告已显式跟踪。
- **NV-04 剩余边界**：DPR 代理不替代原生 Windows 系统缩放切换；没有 macOS/WebView 原生视觉证据；源字体/原始材质不完整，未宣称像素一比一；Today 首节点边界、Settings 底部可达性、多页长/错误/键盘状态和材质差异转入 NV-05/NV-06。

- **NV-05 本轮开始（2026-09-08 15:46 +08:00）**：起始 SHA 为 `ccf2885`。先审查 `CommandPalette.tsx` 的 modal/listbox 焦点模型、Night Valley 五页在实际最小窗口下的滚动/边界、错误与忙碌反馈，再补 Tab/Enter/Space/Esc 及焦点可见回归；优先解决 NV-04 的 Today 首节点边界和 Settings 底部可达性，不提前处理 NV-06 的材质/光影。

NV-05 的具体键盘缺口：`CommandPalette.tsx` 声明 modal/listbox，但缺少完整 Tab 焦点约束与方向键选项导航。选择语义正确的简单按钮列表或完整 listbox 之一；打开后焦点进入，Tab 不落入背景，Esc 返回触发器，验证键盘选择与鼠标结果一致。

- **NV-05 本轮结果（2026-09-08）**：源码/测试提交为 `85308f1`。命令面板补齐活动选项、`aria-activedescendant`/`aria-selected`、方向键/Home/End、Enter、Esc、Space 和 Tab/Shift+Tab 焦点循环；选项不再进入 Tab 序列，鼠标与键盘共用执行路径。新增启动本地数据失败→可见错误→重试恢复回归；五页在 `1120×760`、`820×720`、`560×720` 下做 surface 边界检查，Today 路径起点首节点标签和 Settings 备份/清空入口均验证可见、可聚焦。
- **NV-05 验证证据**：`pnpm check` PASS；`pnpm test:frontend` PASS（44/44，约 1.2 分钟）；命令面板定向 2/2、NV-05 压力窗口 1/1 PASS；`pnpm build` PASS（主 JS 639.22 kB、CSS 255.81 kB，保留既有 >500 kB chunk 警告）；`git diff --check` PASS；报告见 `docs/qa/NV-05-85308f1.md`；源码与测试已推送，版本/Release 资产未变。
- **NV-05 剩余边界**：Chromium + Tauri mock 不能替代 Windows WebView2/macOS 原生窗口、系统缩放、托盘/浮窗和素材字体验收；Today 长路径自动定位当前节点的既有行为保留；材质/光影/逐页像素差异转入 NV-06，CORE-03/DESK-02 的 macOS 证据仍缺。

- **NV-06 本轮开始（2026-09-08 16:20 +08:00）**：起始 SHA 为 `85308f1`。按 NV-04 绑定的五页基线和 8 项命名差异，逐页处理结构/文字/状态之后的材质、字体、光影与构图精修；先核对报告中可复现的差异，再做一项一验，保留真实业务与状态，不扩展主题功能。

- **NV-06 本轮结果（2026-09-08）**：最终源码/测试提交为 `a52796f`。Today 记录 ready 时的节点数量，初次 ready 从真实路径起点渲染，只有 ready 后节点增长才自动跟随；压力测试移除手动 `scrollLeft=0` 旁路。非 Today 四页统一使用已随应用离线打包的 v4 山谷材质，并通过两个高特异性 CSS 入口修正实际生效路径，微调普通页与 Settings 的亮度/饱和度；不改变真实业务数据、布局功能或主题入口。
- **NV-06 验证证据**：`pnpm check` PASS；`pnpm test:frontend` PASS（44/44，约 1.2 分钟，最终提交后复跑）；`pnpm exec playwright test tests/today-visual.spec.mjs --workers=1` PASS（15/15，约 1.4 分钟）；`pnpm build` PASS（主 JS 639.35 kB、CSS 255.80 kB，保留既有 >500 kB chunk 警告）；`git diff --check` PASS；五页截图、几何/窗口矩阵和 SHA 见 `docs/qa/NV-06-a52796f.md`、`output/qa/NV-04/a52796f/`；源码/测试已推送，版本/Release 资产未变。
- **NV-06 剩余边界**：验收传输仍为 Chromium + Tauri mock，不能替代 Windows WebView2/系统缩放、托盘/浮窗和 macOS 原生窗口；参考原始字体/分层素材不完整，未宣称像素一比一；CORE-03/DESK-02 的 macOS 证据仍缺。下一步进入 DESK-01 Windows 原生闭环。

**页级看板（每行都需要截图、流程证据和剩余差异）**

| 页面 | 已有实现 | 当前主要验收焦点 | 状态 |
| --- | --- | --- | --- |
| 今日 | 路径、无限段、下一件事、真实统计 | 首末标签、长路径可达、5 秒辨认/≤3 操作启动、空数据 | PASS（首套 fixture；原生平台留给 DESK/QA） |
| 计时 | 圆盘、路线、模式、上下文、真实控制 | NV-03、主操作层级、运行/暂停/到点/完成 | PASS（首套 fixture；原生平台留给 DESK/QA） |
| 待办 | 三栏、创建/编辑/完成/撤销、逾期分组 | 长标题、到期口径、忙碌态、防重复操作、快捷进入专注 | PASS（首套 fixture；长数据留给 QA） |
| 记录 | 图表、日档案、详情、编辑删除 | NV-02、长历史、空/零数据、显示范围与明细一致 | PASS（首套 fixture；长历史留给 QA） |
| 设置 | 主题预览、提醒音效、备份、外观入口 | NV-01、真实保存失败、键盘导航、备份完整可达 | PASS（首套 fixture；原生平台留给 DESK/QA） |

### DESK-01 · Windows 原生闭环

- 用测试账户或隔离数据目录验证安装启动、二次启动聚焦同一实例、关闭隐藏到托盘、托盘恢复退出、窗口拖拽/最小化/最大化、主窗与浮窗操作一致、穿透后独立解锁入口可用。
- 验证计时跨窗口开始/暂停/完成、休眠唤醒、异常关闭再打开、倒计时到点提醒与确认、多窗同时到点不重复发声/保存；记录运行恢复的计时语义及误差。
- 存储或恢复失败时，不允许只见成功通知。使用合成数据，升级/备份恢复前后核对条目数、总时长、关联 ID 和运行态。
- 交付 OS/WebView/缩放/版本/提交/用例/结果；浏览器 mock 通过只能列为辅助证据。

- **DESK-01 本轮结果（2026-09-08）**：源码提交为 `7fd5766`。Windows 11 专业版 `10.0.26200`、WebView2 `152.0.4191.66`、DPI 144/150%、屏幕 `2560×1440`；隔离目录启动、二次启动单实例聚焦、主窗最大化/还原/最小化/关闭隐藏、计时开始/暂停/恢复/完成、待办浮窗和专注浮窗锁定/独立解锁均完成原生 UI Automation 冒烟。定位并修复 `show_focus_floating` 误操作 `todo-float` 的根因，使开始计时真正显示 `focus-float`。
- **DESK-01 验证证据**：`cargo fmt --check`、`cargo check --locked`、Rust `32/32`、`pnpm check`、`tests/app.spec.mjs` `29/29`、`pnpm tauri build --debug`、`git diff --check` 均 PASS；MSI/NSIS 和 exe 已生成并核对 SHA-256；报告与截图见 `docs/qa/DESK-01-7fd5766.md`、`output/qa/DESK-01/`。版本仍为 `2.6.9`，Release 资产交给 REL-01。
- **DESK-01 剩余边界**：未执行真实休眠/唤醒、倒计时自然到点/声音播放、正式安装器安装；系统通知区没有向 UI Automation 暴露图标，托盘菜单未直接点击，但托盘创建/恢复/退出回调已核对，关闭隐藏和二次启动恢复已实测；CORE-03/DESK-02 的 macOS 原生证据仍缺。下一步进入 DESK-03。

### DESK-03 · 编辑时计时仍更新

- **事实**：MainShell 每秒 `refresh` 并行读取计时/待办/记录/统计/设置五个接口；`busy`、编辑待办或记录时整个轮询跳过，计时展示也随之停更。
- **目标**：计时快照刷新与业务列表刷新分离；保留用户草稿时仍刷新时钟；业务数据通过提交结果/通知或必要刷新保持一致，保留断线恢复机制。继续使用请求版本防止旧响应覆盖新操作。
- **验收**：编辑记录持续 30 秒，计时按预期继续更新而草稿不被覆盖；主窗/浮窗修改后在约定同步周期内一致；慢请求、隐藏后恢复、保存失败重试不造成永久停更或重复提交。修改轮询后再测资源占用，不凭接口数量声称性能改善。

- **DESK-03 本轮结果（2026-09-08）**：源码/测试提交为 `0159a8c`。新增独立 `timerRefreshVersion` 与 `refreshTimerSnapshot`；编辑待办/记录时保留每秒计时读取而停止业务列表轮询，操作开始同时失效两类旧请求；初始读取错误保持到显式重试，后台成功同步只清理自身 `syncError`，不覆盖保存失败反馈。
- **DESK-03 验证证据**：记录编辑草稿实跑 30 秒，timer snapshot 持续增加、待办请求不增加，切回计时页显示 `00:00:31`；`pnpm check`、`cargo fmt --check`、完整前端 `45/45`、`pnpm tauri build --debug`、`git diff --check` PASS；报告和产物 SHA 见 `docs/qa/DESK-03-0159a8c.md`。版本仍为 `2.6.9`，Release 资产交给 REL-01。
- **DESK-03 剩余边界**：本轮 30 秒编辑在 Chromium + Tauri mock 下完成，Windows 原生计时/浮窗主流程由 DESK-01 覆盖；每秒轮询的长期资源预算和长历史数据交给 PERF-01/DATA-01。下一步进入 ARCH-01。

### ARCH-01 / QA-01 · 为五套建立最小复用边界

- 先按页面移出 `NightValleyViews.tsx`，在稳定基线后移除 MainShell 中不可达旧视图；每次处理一个区域，追踪 handler/样式依赖，不把行数减少当成功标准。
- 样式分为基础语义 token、共享控件、主题 token、主题页面布局；保留浮窗/命令面板可用性。改现有规则而非持续尾部追加 `!important`；先明确级联优先级，再迁移。
- 业务层仍统一持有 timer/todos/records/settings 与 Tauri 调用。主题决定渲染/布局/素材；`implemented` 仅是可用性标记，不能代替实际渲染分派。第二套使用与第一套不同布局时，复用数据和动作接口即可。
- 第二套接入时再抽象已被两套验证的共性；不提前建立通用插件引擎，不复制五个 MainShell/计时器/备份系统。未来主题素材按需加载，切换不重置计时。
- 公共业务用例按可用主题参数化，独特构图使用各自视觉基线；未知 mock command 应显式暴露，减少 `default: null` 掩盖新增调用缺口；CI 上传失败截图/trace与可追溯摘要。
- 验收：第一套五页与浮窗回归无退化，未知/未实现 theme ID 安全回退，localStorage 无效值不使页面空白，干净 checkout 可复现实验与测试。

- **ARCH-01 本轮结果（2026-09-08）**：源码提交为 `abf2bc4`。新增 `ThemeSurface.tsx` 作为最小主题渲染边界，MainShell 继续统一持有 timer/todos/records/settings signals、Tauri 调用、刷新和 handler，只组装五页 props；删除四组 `Show when={false}` 不可达旧页面及其专属 helper，音效文件 input 的引用收回 Settings 组件；新增边界回退样式。主题实现采用显式 `ThemeImplementation` 映射，未知/未实现 ID 回退到 Night Valley，不把 `implemented` 元数据当作隐式页面渲染器。
- **ARCH-01 验证证据**：最终源码 `pnpm check` PASS；完整 `pnpm test:frontend` PASS（45/45，约 1.3 分钟）；主题注册定向回归 PASS（1/1）；`pnpm tauri build --debug` PASS（Vite、Rust debug、MSI、NSIS）；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`git diff --check` PASS；debug 产物 SHA 与边界/剩余项见 `docs/qa/ARCH-01-abf2bc4.md`。版本仍为 `2.6.9`，Release 资产交给 REL-01。
- **ARCH-01 剩余边界**：第二套主题仍未实现；App.css 的完整 token/共享控件/主题页面分层已由 QA-01 结合回归确认当前边界，后续主题接入时再按真实复用需求继续迁移；本轮没有新增 macOS 原生证据，CORE-03/DESK-02 的平台阻塞保持不变。QA-01 已完成，下一步进入 TH-02。

- **QA-01 本轮结果（2026-09-08）**：源码/测试提交为 `86e0105`。新增无效主题值和未实现 `editorial-paper` 的启动回退回归；CI Rust check/test 改为 `--locked`，并写入提交、ref、运行链接、runner 与工具版本摘要；失败时保留 Playwright `test-results`、截图和 QA 输出 14 天。
- **QA-01 验证证据**：`pnpm check`、`pnpm build`、`cargo fmt --check`、`cargo check --locked`、`cargo test --locked`（library 32/32）、`git diff --check` PASS；最终 `pnpm test:frontend` PASS（47/47，约 1.4 分钟，包含新增 2 项回退用例）；报告见 `docs/qa/QA-01-86e0105.md`。版本/Release 资产未变，推送后的真实 GitHub Actions run 尚待远程产生，不能用本地结果替代。
- **QA-01 剩余边界**：CI 证据配置已落地但尚未以新提交的远程失败 run 演练；当前 runner 仍是 Windows，macOS 原生验收由 CORE-03/DESK-02 负责；下一步进入 TH-02，四套主题仍保持禁用。

### TH-02 · Editorial Paper 第二套五页主题

- **本轮开始**：2026-09-08，起始 SHA `86e0105`；先核对 `PRODUCT.md`、五张 Editorial Paper 概念图、`ThemeSurface` props 边界和现有 MainShell 动作，再实现纸页布局，不复制业务状态。
- **本轮结果**：功能提交 `b053cd6`，壳层级联修正提交 `f1060bb`。`EditorialPaperViews.tsx` 接入今日/计时/待办/记录/设置五页，`ThemeSurface` 做显式分派，`themes.ts` 开启 `editorial-paper`；主题切换、保存/重载、未知/未实现回退、共享动作和压力宽度均保留真实行为。
- **实现检查**：五页构图、token、纸页响应式、焦点/减少动画边界已完成；公共业务回归无退化；旧 Night Valley 的固定命令条、隐藏品牌、绝对定位导航和固定高度泄漏已收口到主题边界；`src-tauri/src/storage.rs` 的并行临时夹具碰撞也已修正。
- **验证证据**：`pnpm check` PASS；`pnpm test:frontend` 49/49 PASS；Editorial 定向视觉/压力 2/2 PASS；`pnpm build` 与 `pnpm tauri build --debug` PASS；cargo fmt/check/test locked PASS（32/32）；Windows debug exe、MSI、NSIS 启动和 SHA-256 见 `docs/qa/TH-02-f1060bb.md`；截图与几何见 `output/qa/TH-02/f1060bb/`。
- **任务判断**：实现、验证和版本化发布门槛均已满足，任务记为 `DONE`。v2.6.10 已同步版本源并发布 Windows EXE/MSI/NSIS 与 macOS Universal DMG；CORE-03/DESK-02 的 macOS 原生数据目录、单实例和窗口交互证据不由本轮 workflow 伪造替代。
- **下一项**：依赖已满足的 `TH-03`，开始 Graphite Console 五页实现；继续保留真实业务、主题回退和发布门槛约束。

### TH-03 · Graphite Console 第三套五页主题

- **本轮开始**：2026-09-08，基于已发布 v2.6.10 的 `5c47d24`；先核对 Graphite 五张概念图、`ThemeSurface` props 边界、旧壳层的固定高度/绝对定位规则和现有主题回退测试，再实现五页，不复制 MainShell 的业务状态机。
- **本轮结果**：功能提交 `fddd19d`。新增 `GraphiteConsoleViews.tsx` / `.css`，接入今日、计时、待办、记录、设置；主题注册启用 Graphite，Aurora/Botanical 仍禁用；Focus 的“查看更多记录”接入记录页导航；过期判断与待办日期码统一使用本地日期键。
- **实现检查**：真实待办/计时/记录/备份/提醒/外观动作通过现有 props 接入；主题切换、显式保存/重载、未知/未实现回退、Today → Focus → running、五页响应式和 1120/820/560/420 压力宽度均有覆盖；移除 Graphite 对旧 Night Valley 背景、固定侧栏、固定工作区高度的泄漏。
- **验证证据**：`pnpm check` PASS；Graphite 定向 3/3 PASS；完整前端 `53/53` PASS；`pnpm build` PASS（2057 modules，11.24s）；`git diff --check` PASS；报告见 `docs/qa/TH-03-fddd19d.md`，截图/几何见 `output/qa/TH-03/fddd19d/`。
- **发现并修复**：全量回归在本地午夜与 UTC 日期不同的窗口暴露 Night Valley 过期标签误判；根因是 `toISOString()` 被用于本地日期比较，已改为本地日期键并重跑 `53/53`。
- **任务判断**：记为 `DONE`。源码、测试、视觉证据、v2.7.0 版本化、Windows debug/release 包、隔离启动冒烟、远程 Checks、macOS Universal workflow 与 GitHub Release 资产均已由 `REL-01` 收口；macOS 原生交互边界仍归 CORE-03/DESK-02。
- **下一项**：`TH-04`，实现 Aurora Ocean 五页；DATA-01 继续等待 CORE-03 的 macOS 跨平台数据目录事实，不用本地 Windows 证据替代。

### TH-04 · Aurora Ocean 第四套五页主题

- **本轮开始**：2026-09-09，基于已发布 v2.7.0 的 `3d79545`；先核对 Aurora Ocean 五张概念图、`ThemeSurface` props 边界、主题注册和 Graphite 已验证的窄桌面壳层隔离，再实现潮汐/极光布局，不复制 MainShell 的业务状态机。
- **本轮结果**：功能提交 `43d53dd`。新增 `AuroraOceanViews.tsx` / `.css`，接入今日、计时、待办、记录、设置五页；启用 `aurora-ocean`，保留 Botanical 禁用；复用共享计时、待办、记录、设置动作，保留主题持久化、无效值/未实现主题回退和真实业务数据。
- **实现检查**：完成深海青与极光紫光场、潮汐信号、圆润半透明面板、气泡装饰、设置矩阵和五页页面边界；隔离旧 Night Valley 的固定高度/绝对侧栏规则；环境音、自由笔记、导出等没有现有业务支撑的概念没有伪造实现。
- **验证证据**：`pnpm check` PASS；完整前端 `55/55` PASS；`pnpm build` PASS（2059 modules）；`cargo fmt --check`、`cargo check --locked`、`cargo test --locked` PASS（32/32）；Windows debug/release EXE、NSIS、MSI 与 v2.8.0 EXE 启动冒烟 PASS；报告见 `docs/qa/TH-04-43d53dd.md`，截图/几何见 `output/qa/TH-04/761181d/`。
- **任务判断**：记为 `DONE`。源码、视觉、本地验证、v2.8.0 main/tag、Windows/macOS 资产、CI 和 GitHub Release 均已由 REL-01 收口；CORE-03/DESK-02 的 macOS 原生证据不由 workflow 伪造替代。
- **下一项**：依赖已满足的 `TH-05`，实现 Botanical Library 五页；DATA-01 继续等待 CORE-03 的 macOS 跨平台数据目录事实。

### REL-01 · v2.6.10 版本与发布闭环

- **本轮开始**：2026-09-08，基于 `23ca8f0`；先核对现有 v2.6.9 tag/Release、版本源、发布脚本和 Actions 工作流，确认旧 tag 不可移动。
- **版本同步**：`ff46106` 将 `package.json`、`Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时 `APP_VERSION`/里程碑、README 稳定版本和 `docs/v2.6.10/RELEASE_NOTES.md` 统一到 `2.6.10`；旧 `v2.6.9` 保持不变。
- **本地验证**：`pnpm check`、完整前端 `50/50`、`cargo fmt --check`、`cargo check --locked`、Rust `32/32`、`pnpm package:release` 与隔离 release EXE 启动冒烟均 PASS；Windows release 三项本地产物 SHA 与 Release digest 一致。
- **远程验证**：main Checks `34241297806` PASS；tag `v2.6.10` 指向 `ff46106`；macOS Universal workflow `34242511754` PASS；GitHub Release 四项资产和说明见 `docs/qa/REL-01-ff46106.md`。
- **任务判断**：记为 `DONE`。没有移动旧 tag；版本、主线、CI、Windows EXE/MSI/NSIS、macOS DMG、Release notes 和 README 已闭环。平台原生能力的剩余边界归 CORE-03/DESK-02。

### REL-01 · v2.7.0 Graphite Console 发布闭环

- **当前状态**：`DONE`；发布提交 `23b5dcd`，tag `v2.7.0` 指向该提交，旧 `v2.6.10` tag `ff46106` 未移动；GitHub Release 已创建并补齐四项资产。
- **版本同步**：统一 `package.json`、`src-tauri/Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时 `APP_VERSION`/里程碑、README 与 `docs/v2.7.0/RELEASE_NOTES.md` 到 `2.7.0`。
- **本地验证**：`pnpm check`、`pnpm test:frontend`（53/53）、`pnpm build`（2057 modules）、`cargo fmt --check`、`cargo check --locked`、Rust `32/32`、`pnpm package:debug`、`pnpm package:release`、release EXE 隔离启动冒烟和 `git diff --check` PASS；debug/release 产物清单与 SHA 见 `docs/qa/REL-01-23b5dcd.md`。
- **远程验证**：main Checks `34252232261` PASS（前端 53 passed，Rust 检查通过）；macOS Universal workflow `34252244006` PASS（DMG 上传成功）；Release 四项资产 digest 已核对，见 `docs/qa/REL-01-23b5dcd.md`。
- **边界**：没有 macOS 主机时，只记录 workflow/资产结果，不能把 macOS 原生目录、第二实例、Finder/托盘/浮窗交互写成已验收；这些仍由 CORE-03/DESK-02 负责。

### REL-01 · v2.8.0 Aurora Ocean 发布闭环

- **当前状态**：`DONE`；发布收口提交 `95490d1`，版本同步提交 `761181d`，Aurora 功能提交 `43d53dd`；v2.8.0 tag 指向 `95490d1`，旧 `v2.7.0` tag `23b5dcd` 不移动。
- **版本同步**：已统一 `package.json`、`src-tauri/Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时 `APP_VERSION`/里程碑、README 与 `docs/v2.8.0/RELEASE_NOTES.md` 到 `2.8.0`。
- **本地验证**：`pnpm check`、完整前端 `55/55`、Vite build（2059 modules）、cargo fmt/check/test locked（32/32）、`pnpm package:debug`、`pnpm package:release`、v2.8.0 EXE 隔离启动冒烟和 `git diff --check` PASS；Windows release 三项产物与 Release digest 一致。
- **远程验证**：main Checks `34258546519` PASS（前端 55 passed，Rust check/test 通过）；macOS Universal workflow `34258554857` PASS（DMG 上传成功）；Release 四项资产 digest 已核对，见 `docs/qa/REL-01-95490d1.md`。
- **边界**：没有 macOS 主机时，只记录 workflow/资产结果，不能把 macOS 原生目录、第二实例、Finder/托盘/浮窗交互写成已验收；这些仍由 CORE-03/DESK-02 负责。下一项进入 TH-05。

### TH-05 · Botanical Library 第五套五页主题

- **本轮开始**：2026-09-09，基于 `c485ce8`；保留 Night Valley 的真实业务 props/动作和 MainShell 状态，不复制业务状态机。
- **实现结果**：`acf3b2b` 新增 `BotanicalLibraryViews.tsx`/`.css`，接入 `ThemeSurface`、`MainShell`、`themes.ts`；今日、计时、待办、记录、设置五页均真实接线，主题持久化和无效主题回退仍由公共壳层负责。
- **视觉与边界**：植物年轮、木质书架、纸张和安静生长语言已形成独立 token/布局；环境音、导出等现有业务未接入能力仍明确禁用，没有制造概念图之外的假功能。420px 下记录页趋势线两端日期标签已向内对齐。
- **验证结果**：`pnpm check` PASS；Botanical 专项 `3/3`；主题注册 `1/1`；完整 `pnpm test:frontend` `57/57` PASS；`pnpm build` PASS（2061 modules）；`git diff --check` PASS。五页截图与 `geometry.json` 见 `output/qa/TH-05/acf3b2b/`，报告见 `docs/qa/TH-05-acf3b2b.md`。
- **任务判断**：记为 `DONE`。实现、浏览器/Windows 工作区证据、v2.9.0 版本源、Windows 包、远程 Checks、macOS Universal DMG 和四项 Release 资产已由 REL-01 收口；macOS 原生目录、第二实例、Finder/托盘/浮窗交互仍归 CORE-03/DESK-02。

### REL-01 · v2.9.0 Botanical Library 发布闭环

- **当前状态**：`DONE`；发布提交 `b375f85`，由 TH-05 源码提交 `acf3b2b`、版本同步 `4018e53` 和发布计划提交组成；`v2.9.0` tag 已指向该提交，旧 v2.8.0/v2.7.0 tag 不移动。
- **版本同步**：已统一 `package.json`、`src-tauri/Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时 `APP_VERSION`/植物书房里程碑、README 与 `docs/v2.9.0/RELEASE_NOTES.md` 到 `2.9.0`。
- **本地验证**：`pnpm check`、完整前端 `57/57`、Vite build（2061 modules）、cargo fmt/check/test locked（32/32）、`pnpm package:debug`、`pnpm package:release` 和隔离 v2.9.0 EXE 启动冒烟 PASS；Windows release EXE/NSIS/MSI 的 SHA-256 与 Release digest 已核对。
- **远程验证**：main Checks `34306331275` PASS（前端 57 passed，Rust check/test 通过）；macOS Universal workflow `34306369988` PASS（DMG 上传成功）；Release 四项资产 digest 已核对，见 `docs/qa/REL-01-b375f85.md`。
- **边界**：没有 macOS 主机时，只记录 workflow/资产结果，不能把 macOS 原生目录、第二实例、Finder/托盘/浮窗交互写成已验收；这些仍由 CORE-03/DESK-02 负责。

### REL-01 · v2.9.1 macOS 桌面集成发布闭环

- **当前状态**：`DONE`；发布提交 `9938c08`，`v2.9.1` tag 已指向该提交，旧 `v2.9.0` tag 未移动。
- **版本同步**：`package.json`、`src-tauri/Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时 `APP_VERSION`/里程碑、README 与 `docs/v2.9.1/RELEASE_NOTES.md` 已统一到 `2.9.1`。
- **远程验证**：Checks `34330682891` PASS（前端与 Rust 共 58 项）；macOS Native Smoke `34330682984` PASS；Universal macOS Release `34330712307` PASS；Release 四项资产已核对 digest，证据见 `docs/qa/DESK-02-342009c.md`。
- **资产与边界**：Windows EXE/NSIS/MSI 与 macOS Universal DMG 均已上传；macOS 原生安装证据仍明确为 unsigned debug DMG 的隔离挂载/复制/启动，不声称签名、公证或真实 `/Applications` 安装。

### TH-02～TH-05 · 每套都按同样的完整性流程执行

固定顺序：02 编辑纸页 → 03 石墨控制台 → 04 极光海面 → 05 植物书房。每套领取任务时复制以下子清单到执行记录，未全完成前保持禁用。

- [ ] 对照本套五张原图拆出排版、布局、配色、素材及状态差异；记录未知信息，不重新随意设计。
- [ ] 完成 token 与共享壳层适配，验证主题切换、持久化及回退。
- [ ] 按今日 → 计时 → 待办 → 记录 → 设置逐页实现，复用真实动作。
- [ ] 每页完成标准尺寸/实际最小尺寸/长数据/错误态/键盘验收。
- [ ] 跑公共业务回归与本套视觉对比，验证浮窗/设置不串主题、不重置运行态。
- [ ] 通过构建、原生冒烟、版本与发布验证后，才将主题任务设为 `DONE` 并更新总表；实现已通过但尚未发布时记为 `REVIEW`，并明确候选版本。

主题不是新功能许可：概念图中的环境音、自由笔记、导出等若没有现有业务，应明确不提供或另排需求，不在换主题时暗中扩成新系统。

### PERF-01 / DATA-01 · 长期可用性

- **DATA-01 本轮开始（2026-09-09 17:25 +08:00）**：起始 SHA `c60eeb1`。先核对 Rust 备份字段、WebView `localStorage` 偏好、跨平台存储目录和现有素材出处；允许修改范围为用户文档、素材清单、隔离迁移验证与本计划证据，不读取真实用户数据，不把 MIT 仓库许可或源码字段当作单项素材的完整法律核验。
- **DATA-01 本轮完成（2026-09-09 17:42 +08:00）**：`c60eeb1`→`89d9404`；新增跨目录 JSON 复制—导入—重启全量 state/runtime 对比单测，新增 `docs/data-portability.md` 和 `docs/content/asset-inventory.md`；Rust 33/33、前端 58/58（单 worker）、`pnpm check`、`pnpm build`（2061 modules）、cargo fmt/check、`git diff --check` 均 PASS；证据见 `docs/qa/DATA-01-89d9404.md`。未改变运行时格式或用户可见行为，v2.9.1 与现有 Release 资产保持不变。
- **DATA-01 任务判断**：记为 `DONE`。备份范围、跨设备搬移流程和资源清单均有可读文档；隔离测试不触碰真实用户目录，并明确主题/外观/自定义音频不在 Rust 备份中的边界。logo、背景、主题预览和 MP3 条款的进一步出处治理保留为后续维护事项，不冒充已完成法律核验。

- **PERF-01 本轮开始（2026-09-08 21:34 +08:00）**：起始 SHA `c2670b3`。先建立同一 Windows 环境下的可复测基线，不先改代码、不读取真实用户数据；覆盖 3 次冷启动、10 分钟空闲、30 分钟运行中计时，以及 1000/10000 条合成记录的 CPU、内存、帧/交互延迟。若测量工具或 WebView 指标无法可靠取得，记录可测范围和替代指标，不把估算写成性能达标。
- **PERF-01 本轮完成（2026-09-08 22:46 +08:00）**：基线确认后定位到 Editorial Paper 记录页一次性挂载长历史；`218e754` 改为选中日期初始最多 200 条、按批次展开，并让完整历史按日期展开。优化前 10,000 条切换约 2,318.1 ms / 110,158 DOM 节点，优化后约 126.7 ms / 2,158 DOM 节点；1,000 条为 179.1 ms / 2,158 节点。完整前端 `50/50`、`pnpm check`、`pnpm build`、`pnpm tauri build --debug`、`git diff --check` PASS；详见 `docs/qa/PERF-01-218e754.md`。
- **PERF-01 任务判断**：记为 `DONE`，因为基线、可复测夹具、相对回归线和实际优化均已完成；绝对 SLA 不由 debug 包或 Chromium mock 推断，后续若 Release 构建、WebView2 或资源发生变化须按同一脚本复测。源码已推送，CI run `34240414664` 最终 PASS；REL-01 已完成版本化发布。
- **性能先测后改**：记录测试设备/OS、3 次冷启动、10 分钟空闲、30 分钟运行中计时、1000/10000 条合成记录的 CPU/内存/帧与操作延迟。首轮建立可复测基线，再设绝对预算；临时回归线为同设备同场景相对中位基线恶化 >20% 必须解释，不能写成已达性能指标。
- **候选优化**：主包延迟加载非当前主题/大型内容；按实际访问加载历史数据；检查轮询是否每次重取/重算全部记录；隐藏页面降低无用视觉工作；统计/柱图避免重复扫描。已有 >500 kB 提示是调查入口，不是盲目切 chunk 的命令。
- **数据搬移**：明确 Rust 备份覆盖哪些字段、主题/外观偏好/自定义音效哪些存在 WebView 存储；目前不承诺一份备份恢复所有内容。用干净测试账户演练“导出 → 搬移 → 导入 → 重启”并完善用户文档。
- **资源清单**：保留语料与音效的来源文件、生成素材出处及用途说明；缺出处先记录，不能把源码中的许可字段当完整法律核验。保持运行时离线，不为主题额外引入网络依赖。

## 7. Luna 执行协议

### 每次开始

1. 读根目录 `AGENTS.md`、本文件 0/4/5/6 节和目标任务卡，再读 `PRODUCT.md`。
2. 运行 `git status --short --branch`、`git log -5 --oneline`；核对版本与相应 Release，仅按本次任务需要读取相关代码。发生历史冲突先更新看板，不能按旧摘要覆盖新代码。
3. 选择最前面的依赖已满足 TODO，改为 DOING，记录执行人、起始 SHA、目标、允许修改范围和准备运行的验证。用户指定某任务时按其要求调整队列；数据可靠性缺口仍阻断发布。
4. 用一小段话说明现有调用链、根因假设和最小改动点，再改代码。新问题先记录在任务下，不无限扩大本轮。

### 每次结束

1. 对照任务卡逐项核实：功能实现、失败路径、测试与证据，不以“build 过了”替代全部验收。
2. 未过项标 BLOCKED（写具体原因/下一检查）；代码完成但尚待该任务必需的原生/视觉/测试验证标 REVIEW；满足任务卡全部验收才标 DONE。普通实现任务可 DONE 且合批待发布，发布状态由 REL-01 单独追踪，避免依赖倒置；TH-02～05 明确包含发布验收，仍须发布完成才 DONE。
3. 更新看板时间、当前 SHA/版本、页级进度与执行日志。记录测试命令、退出结果、截图路径、未解决项、下一个任务 ID。
4. 产品变更按 REL-01 收尾；仅文档/计划更新可以提交并推送文档，不为空计划更改程序版本、重打安装包或替换已发布资产。
5. 需要上下文总结时另存 `docs/context_summary_YYYYMMDD_HHMM.md`，摘要引用本文件，不另建相互竞争的实时计划。

### 可直接交给 Luna 的启动指令

```text
继续 Focused Moment 项目。先读根目录 AGENTS.md 和 PROJECT_PLAN.md，核对当前工作区、提交、版本和最新执行日志。
按依赖选择一个未完成任务；默认从 ENG-00 的测试环境诊断开始，随后 CORE-01；已完成则选下一个就绪任务。
先读相关调用链，说明根因与最小改动点，再实现、验证、更新任务状态和证据。
保持本地优先与真实数据，不复制五套业务状态，不把禁用预览当可用主题。
保护用户已有改动和个人数据。只在临时夹具验证损坏/恢复场景。
完成可发布产品变更后按仓库发布纪律同步版本、构建、验证包、提交、推送和 Release；仅计划更新不发空版本。
普通可逆工作与已授权后续操作自主完成；遇真实凭据缺失、不可逆数据选择或用户需求冲突才提出具体问题。
不要把局部测试通过写成全项目完成。结束时更新 PROJECT_PLAN.md 的看板、任务、证据和下一项。
```

## 8. REL-01：每次发布的完整关闭条件

1. 确定一版一个明确主题，可合并同一根因的数个任务。修复/文案/视觉微调使用 patch；完整新增主题或明显功能组使用 minor。下一个版本按届时最新 tag 决定，本文不预占号。
2. 同步 `package.json`、锁文件相关版本、`src-tauri/Cargo.toml`、Cargo.lock 包版本、`tauri.conf.json`、runtime 版本/里程碑、实际存在的前端版本文案、README 与 `docs/vX.Y.Z/RELEASE_NOTES.md`。当前 MainShell 未查到重复硬编码版本，不为凑清单新增一份。
3. 执行本版必要测试；发布基线要求 TS/build/完整前端/Rust fmt/check/test；确认新 SHA 的 CI。涉及存储/原生能力的变更有相应专项验收，平台不能本地验证就追踪平台结果而非宣称完成。
4. 用仓库脚本构建/导出 Windows 包，验证带版本安装包与便携版、MSI，执行隔离账户安装/升级/启动冒烟；不得拿旧根目录 EXE 充当新包。
5. 查看 diff，仅提交授权且必要的文件。新文档若被 `docs/` 忽略，显式跟踪指定文件；不强制加入整目录和个人备份。提交与 main 集成完成后按脚本要求创建新 tag/推送，不强推或移动已发布 tag。
6. 上传/刷新匹配版本 Release 资产和说明；等待 macOS tag workflow 结果；核对四项资产、版本、大小/哈希/构建提交，保存结果链接。缺平台资产就标发布部分完成。
7. 更新本计划与根目录当前构建产物指向，记录哪个任务在哪个版本交付。公开页面只留最终用户内容，内部计划不塞进产品界面。

## 9. 可选增强池（不占当前首套收口预算）

| 候选 | 值得验证的原因 | 进入条件 |
| --- | --- | --- |
| 可行动空状态与首次启动小引导 | 直接支持 5 秒辨认、≤3 操作开始 | 先观察新用户在首套哪里卡住，能用现有界面说明解决就不新增教程 |
| 记录 CSV 导出/真实日期筛选 | 当前有禁用入口，可能帮助回看与数据掌控 | 先确认使用目的/格式，再定义统计口径与导出验收；不作为主题复刻必需 |
| 备份纳入外观/自定义音效或提供搬移向导 | 改善换机的一致体验 | CORE 系列完成，明确大小限制与失败恢复后再定义新格式 |
| 桌面签名与更顺畅升级 | 现有未签名分发存在首次使用摩擦 | 需要证书/账户/发布资源时再明确成本与授权，不擅自购买 |
| 更好的本地诊断信息 | 降低白屏、恢复失败、窗口异常排查成本 | 仅记录最少必要错误状态，不默认收集任务标题或上传数据 |

## 10. 执行日志与资料索引

| 日期 | 任务 | 结果 / 证据 | 下一步 |
| --- | --- | --- | --- |
| 2026-09-08 | PLAN-00 | 核对 473cc67/v2.6.9 与远程 main；前端32项、Rust库12项通过；完整cargo test受os error 5阻断；全项目风险与五主题路线入档 | ENG-00 → CORE-01 |
| 2026-09-08 | ENG-00 | `afb865a`→`afb865a`；仅更新 `PROJECT_PLAN.md`；`cargo test --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 与全新临时 `CARGO_TARGET_DIR` 的完整测试均退出 0（library 12/12、binary 0、doc 0）；Windows 11 26200、Rust/Cargo 1.94.1 MSVC；未改版本、源码或发布资产；前次 `os error 5` 不可复现；`git fetch --prune origin` 因 SSH 22 端口超时未完成 | CORE-01 |
| 2026-09-08 | CORE-01 | `afb865a`→`afb865a`（源码与计划仍未提交）；修改 `src-tauri/src/storage.rs`、`PROJECT_PLAN.md`；新增 state/runtime 耐久临时写入、有效快照保护、缺失/无效/不可读回退、故障注入夹具与 6 组存储测试；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 18/18、binary 0、doc 0）；未执行前端测试；版本/发布资产未变；跨文件一致性与启动错误交给 CORE-02 | CORE-02 |
| 2026-09-08 | CORE-02 | `afb865a`→`afb865a`（源码与计划仍未提交）；修改 `src-tauri/src/runtime.rs`、`PROJECT_PLAN.md`；启动失败进入恢复保护且所有数据命令拒绝伪成功，`persist_all`/备份导入/完成专注共享跨文件回退，待办关联修改避免半提交；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 21/21、binary 0、doc 0）；`pnpm check` PASS、`pnpm test:frontend` PASS（32/32，约56.6秒）、`git diff --check` PASS；版本/发布资产未变；隔离故障注入覆盖写入失败，真实目录权限和跨平台目录迁移留给后续任务 | CORE-04 |
| 2026-09-08 | CORE-04 | `afb865a`→`afb865a`（源码与计划仍未提交）；修改 `src-tauri/src/runtime.rs`、`PROJECT_PLAN.md`；修正合法 1–24 分钟恢复为 25 分钟的归一化错误，补充合法/非法时长、运行状态和短倒计时备份导入测试；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 25/25、binary 0、doc 0）；倒计时前端定向回归 PASS（1/1）；未改版本/发布资产；番茄多轮与时钟边界留给 CORE-05 | CORE-05 |
| 2026-09-08 | CORE-05 | `afb865a`→`afb865a`（源码与计划仍未提交）；修改 `src-tauri/src/runtime.rs`、`PROJECT_PLAN.md`；多轮番茄延后确认聚合未记录焦点时长、恢复保留阶段与计数，时钟计算固定化并覆盖睡眠/前跳/回拨语义；`cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 均 PASS（library 28/28、binary 0、doc 0）；`pnpm check` PASS；未做真实休眠/系统时钟改动测试，未改版本/发布资产 | ENG-01 |
| 2026-09-08 | ENG-01 | `afb865a`→`abcc80a`；修改 `PROJECT_PLAN.md`、`src-tauri/src/runtime.rs`、`src-tauri/src/storage.rs` 并提交为 `f12786b`，普通 merge 到 main 为 `abcc80a`；脚本静态解析 PASS，本地 `pnpm build`、`pnpm test:frontend`（32/32）、cargo fmt/check/test（library 28/28）PASS；GitHub Checks `34190010987` 在 `abcc80a` 上 PASS（7m48s），已推送 `origin/main`；v2.6.9 tag/资产未变，REL-01 负责新版本闭环 | CORE-03 |
| 2026-09-08 | CORE-03 | `a482fe8`→`348b2e9`；修改 `src-tauri/src/storage.rs` 并推送 main；规范 Windows/macOS 数据目录、旧工作目录备份/验证/切换、源目录保留与目标非空保护已实现；平台路径与迁移隔离测试通过，Rust library 32/32、`pnpm check`、前端32/32（约59.5秒）通过；未读取真实用户数据，未取得 macOS 主机，Finder/第二实例/托盘/浮窗原生验收因此 BLOCKED；版本和 Release 资产未变 | NV-01（CORE-03 解除需 macOS 原生证据） |
| 2026-09-08 | NV-01 | `6afe0e2`→`66b5da5`；修改 `src/MainShell.tsx`、`src/components/NightValleyViews.tsx`、`src/App.css`、`tests/today-visual.spec.mjs`；外观设置实时生效、显式保存/重载保持、存储失败反馈与动效/密度边界已接线；`pnpm check`、`pnpm test:frontend`（34/34）、`pnpm build`均 PASS，设置截图 `output/playwright/night-valley-settings.png` 已目视核对；源码和测试已推送，版本/Release 资产未变 | NV-02（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | NV-02 | `58eb829`→`ab5ba9b`；修改 `src/MainShell.tsx`、`src/components/NightValleyViews.tsx`、`tests/app.spec.mjs`、`tests/today-visual.spec.mjs`；记录范围动态取当前七日档案，趋势改为自然日平均，活跃日平均明确标注，零投入柱高为 0；`pnpm check`、定向用例（各1/1）、`pnpm test:frontend`（36/36）、`pnpm build`均 PASS；源码和测试已推送，版本/Release 资产未变 | NV-03（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | NV-03 | `5a8099c`→`ff6daf5`；修改 `src/MainShell.tsx`、`src/components/NightValleyViews.tsx`、`src/App.css`、`tests/app.spec.mjs`；计时路径改为六态真实状态映射，七节点去编号并降为四个状态锚点，补充运行/暂停/到点/恢复/保存回归；`pnpm check`、定向状态3/3、路径几何1/1、`pnpm test:frontend`（39/39）、`pnpm build`均 PASS，计时截图已目视核对；源码和测试已推送，版本/Release 资产未变 | NV-04（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | NV-04 | `7ed8f7b`→`94e0b2e`；修改 `tests/today-visual.spec.mjs` 与显式跟踪的 `docs/qa/NV-04-94e0b2e.md`；新增五页静态截图、几何/环境元数据、默认/最小/最大化代理和 125/150/200% DPR 代理矩阵，固定 reduced-motion 截图并登记 8 项差异；`pnpm check` PASS，`pnpm test:frontend` 41/41 PASS（约1.6分钟），视觉专项通过，`git diff --check` PASS；最近一次应用构建 PASS，版本/Release 资产未变；原生系统缩放、字体/材质一比一和全交互状态留给后续验收 | NV-05（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | NV-05 | `ccf2885`→`85308f1`；修改 `src/components/CommandPalette.tsx`、`src/App.css`、`tests/app.spec.mjs`、`tests/today-visual.spec.mjs`；命令面板补齐 listbox 活动项、方向键/Enter/Esc/Space、Tab 焦点循环与 aria 关系，新增启动读取失败可见并重试恢复，五页压力窗口/Today 首节点起点/Settings 底部可达性回归；`pnpm check` PASS、命令面板定向 2/2、压力窗口 1/1、`pnpm test:frontend` 44/44 PASS、`pnpm build` PASS、`git diff --check` PASS；报告 `docs/qa/NV-05-85308f1.md`；源码/测试已推送，版本/Release 资产未变；原生平台与 NV-06 材质差异保留 | NV-06（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | NV-06 | `85308f1`→`a52796f`；修改 `src/App.css`、`src/components/TodayDashboard.tsx`、`tests/today-visual.spec.mjs`，新增 `docs/qa/NV-06-a52796f.md`；Today 首屏起点与 ready 后新增节点自动跟随边界修正，非 Today 四页统一离线 v4 山谷材质并调光；`pnpm check` PASS、`pnpm test:frontend` 44/44 PASS（最终提交后复跑）、视觉专项 15/15 PASS、`pnpm build` PASS、`git diff --check` PASS；五页截图/几何矩阵与 SHA 见报告和 `output/qa/NV-04/a52796f/`；源码/测试已推送，版本/Release 资产未变；原生平台、字体/素材一比一与 QA 长数据仍留后续 | DESK-01（CORE-03 仍待 macOS 原生证据） |

| 2026-09-08 | DESK-01 | `a52796f`→`7fd5766`；修改 `src-tauri/src/runtime.rs`，新增 `docs/qa/DESK-01-7fd5766.md`；修复开始计时误开待办浮窗而不显示专注浮窗，Windows 11/WebView2 152/DPI 144 原生验证隔离启动、单实例、主窗恢复、计时跨窗、两类浮窗锁定/独立解锁、主窗尺寸控制；`cargo fmt --check`、`cargo check --locked`、Rust 32/32、`pnpm check`、前端 29/29、`pnpm tauri build --debug`、`git diff --check` PASS；MSI/NSIS/exe SHA 见报告；版本/Release 资产未变；真实休眠/托盘菜单点击/正式安装器未执行，明确记录边界；源码与报告待推送 | DESK-03（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | DESK-03 | `07c814d`→`0159a8c`；修改 `src/MainShell.tsx`、`tests/app.spec.mjs`，新增 `docs/qa/DESK-03-0159a8c.md`；计时快照与业务刷新解耦，编辑记录 30 秒草稿不被覆盖，业务请求不重复，初始错误态保持到显式重试，保存失败提示不被成功轮询清除；`pnpm check`、`cargo fmt --check`、完整前端 45/45（含 30 秒用例）、`pnpm tauri build --debug`、`git diff --check` PASS；debug exe/MSI/NSIS SHA 见报告；版本/Release 资产未变；原生长时间编辑与性能预算留 PERF-01 | ARCH-01（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | ARCH-01 | `0159a8c`→`abf2bc4`；修改 `src/MainShell.tsx`、`src/components/NightValleyViews.tsx`，新增 `src/components/ThemeSurface.tsx`、`src/components/ThemeSurface.css`、`docs/qa/ARCH-01-abf2bc4.md`；建立显式主题渲染边界，保留 MainShell 业务状态/动作统一，删除四组不可达旧视图和无用 helper，未实现/未知主题安全回退到 Night Valley；最终 `pnpm check`、完整前端 45/45、主题定向 1/1、`pnpm tauri build --debug`、`cargo fmt --check`、`git diff --check` PASS；debug exe/MSI/NSIS SHA 见报告；版本/Release 资产未变；第二套主题、App.css 全量分层和 macOS 原生证据留后续 | QA-01（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | QA-01 | `abf2bc4`→`86e0105`；修改 `.github/workflows/ci.yml`、`tests/today-visual.spec.mjs`，新增 `docs/qa/QA-01-86e0105.md`；新增无效/未实现主题回退回归，CI 使用 Cargo locked 验证、Step Summary 和失败时 Playwright/QA 证据保留；`pnpm check`、完整前端 47/47、`pnpm build`、cargo fmt/check/test locked（32/32）、`git diff --check` PASS；版本/Release 资产未变；真实远程 Actions run 待推送后产生、macOS 原生证据仍缺 | TH-02（CORE-03 仍待 macOS 原生证据） |
| 2026-09-08 | TH-02 | `86e0105`→`b053cd6`→`f1060bb`；新增 `src/components/EditorialPaperViews.tsx`、`src/components/EditorialPaperViews.css`，修改 `src/components/ThemeSurface.tsx`、`src/lib/themes.ts`、`src/MainShell.tsx`、`tests/today-visual.spec.mjs`、`src-tauri/src/storage.rs`；Editorial Paper 五页、真实动作、主题持久化/回退、响应式压力和旧壳层级联隔离完成；`pnpm check`、完整前端 49/49、Editorial 定向 2/2、`pnpm build`、cargo fmt/check/test locked（32/32）、`pnpm tauri build --debug`、`git diff --check` PASS；报告 `docs/qa/TH-02-f1060bb.md`，截图/几何 `output/qa/TH-02/f1060bb/`；版本 `2.6.9` 与 Release 未变，任务 REVIEW，待 REL-01 版本化发布与远程 CI/平台边界核对 | PERF-01（CORE-03/DESK-02 继续阻塞） |
| 2026-09-08 | PERF-01 | `c2670b3`→`218e754`；新增 `scripts/measure-perf-baseline.ps1`、优化 `src/components/EditorialPaperViews.tsx`/`.css` 与 `tests/today-visual.spec.mjs`；完成 3 次冷启动、10 分钟空闲、30 分钟运行计时、1000/10000 条合成历史，首屏长历史改为 200 条窗口和按日期展开；`pnpm check`、Editorial/PERF 定向 3/3、完整前端 50/50、`pnpm build`、`pnpm tauri build --debug`、`git diff --check` PASS；报告 `docs/qa/PERF-01-218e754.md`，前后端原始数据在 `output/qa/PERF-01/f1060bb/` 与 `output/qa/PERF-01/218e754/`；版本 `2.6.9` 与 Release 未变，远程 Checks run `34240414664` 当前 queued；macOS 与数据搬移边界不由本轮伪造 | REL-01（CORE-03/DESK-02 继续阻塞） |
| 2026-09-08 | REL-01 | `23ca8f0`→`ff46106`；同步 `package.json`、`src-tauri/Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、运行时版本/里程碑、README 与 `docs/v2.6.10/RELEASE_NOTES.md`；本地 `pnpm check`、前端 50/50、Rust 32/32、`pnpm package:release`、release EXE 隔离启动冒烟 PASS；推送 main、创建 `v2.6.10` tag 与 Release，补传 MSI，macOS workflow `34242511754` 上传 Universal DMG；四项资产 digest/边界见 `docs/qa/REL-01-ff46106.md`；旧 `v2.6.9` tag 未移动 | TH-03（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | TH-03 | `5c47d24`→`fddd19d`；新增 `src/components/GraphiteConsoleViews.tsx`/`.css`，修改 `src/components/ThemeSurface.tsx`、`src/lib/themes.ts`、`src/MainShell.tsx`、`src/components/NightValleyViews.tsx`、`tests/today-visual.spec.mjs`；Graphite 五页、真实动作、主题持久化/回退、窄桌面壳层隔离、本地日期键完成；`pnpm check`、Graphite 3/3、完整前端 53/53、`pnpm build`、`git diff --check` PASS；报告 `docs/qa/TH-03-fddd19d.md`，截图/几何 `output/qa/TH-03/fddd19d/`；v2.6.10 tag/Release 未变，v2.7.0 包与远程 CI 待 REL-01 | REL-01（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | REL-01 | `fddd19d`→`23b5dcd`；同步 `package.json`、Cargo/tauri/runtime、`tauri.conf.json`、README 与 `docs/v2.7.0/RELEASE_NOTES.md`；本地 `pnpm check`、前端 53/53、Vite build、cargo fmt/check/test（32/32）、debug/release 包、release EXE 隔离启动冒烟 PASS；推送 main、创建 `v2.7.0` tag 与 Release，补传 MSI；Checks `34252232261` PASS，macOS workflow `34252244006` PASS 并上传 Universal DMG；四项资产 digest/边界见 `docs/qa/REL-01-23b5dcd.md`；旧 `v2.6.10` tag 未移动 | TH-04（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | TH-04 | `3d79545`→`43d53dd`（版本同步 `761181d`、发布收口 `95490d1`）；新增 `src/components/AuroraOceanViews.tsx`/`.css`，修改 `ThemeSurface.tsx`、`themes.ts`、`MainShell.tsx`、`tests/today-visual.spec.mjs`；Aurora 五页、真实共享动作、主题持久化/回退、响应式压力宽度完成；`pnpm check`、完整前端 55/55、`pnpm build`（2059 modules）、cargo fmt/check/test（32/32）、debug/release 包、v2.8.0 EXE 启动冒烟、`git diff --check` PASS；报告 `docs/qa/TH-04-43d53dd.md`，截图/几何 `output/qa/TH-04/761181d/`；v2.8.0 Release 已由 REL-01 收口 | TH-05（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | REL-01 | `43d53dd`→`95490d1`；同步 v2.8.0 版本源、README 与 `docs/v2.8.0/RELEASE_NOTES.md`；本地前端/Rust/构建/Windows 包全部 PASS；推送 main、创建 `v2.8.0` tag 与 Release，补传 MSI；Checks `34258546519` PASS，macOS workflow `34258554857` PASS 并上传 Universal DMG；四项资产 digest/边界见 `docs/qa/REL-01-95490d1.md`；旧 `v2.7.0` tag 未移动 | TH-05（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | TH-05 | `c485ce8`→`acf3b2b`；新增 `BotanicalLibraryViews.tsx`/`.css`，修改 `ThemeSurface.tsx`、`themes.ts`、`MainShell.tsx`、`tests/today-visual.spec.mjs`；五页真实接线、共享动作、主题持久化/回退与 1120/820/560/420px 响应式边界完成；`pnpm check`、Botanical 3/3、主题注册 1/1、完整前端 57/57、`pnpm build`（2061 modules）、`git diff --check` PASS；报告 `docs/qa/TH-05-acf3b2b.md`，截图/几何 `output/qa/TH-05/acf3b2b/`；源码候选未版本化发布，任务 REVIEW | REL-01 v2.9.0（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | REL-01 | `acf3b2b`→`4018e53`；同步 v2.9.0 版本源、README 与 `docs/v2.9.0/RELEASE_NOTES.md`；本地前端 57/57、Vite 2061 modules、Rust 32/32、debug/release 包与隔离 v2.9.0 EXE 启动冒烟 PASS；release EXE `E810A9FAFF892AA6CA7D6ED05A766D9FF9FDBCB533CD2B739F72ACD7A04C0F34`、Setup/NSIS `BA46223432EE33305507550956C053E05FC970DE3082A6975D6E5B5E63451D67`、MSI `1DCF96FB4F4B8669BD2259024F786F8FECD64DB2B880D748EFB725904A8D76BD`；远程 main/CI/tag/Release 尚未执行 | 继续 REL-01 v2.9.0（CORE-03/DESK-02 继续阻塞） |
| 2026-09-09 | REL-01 | `4018e53`→`b375f85`；推送 main、创建 `v2.9.0` tag 与 Release，补传 MSI；Checks `34306331275` PASS（前端 57 passed，Rust check/test 通过），macOS workflow `34306369988` PASS 并上传 Universal DMG；Release 四项资产 digest 已核对，证据见 `docs/qa/REL-01-b375f85.md`；旧 `v2.8.0` tag 未移动 | CORE-03（macOS 原生环境仍缺，DESK-02/DATA-01 依赖其解除） |
| 2026-09-09 | DESK-02 | `b375f85`→`9938c08`；修改 `src-tauri/Cargo.toml`/`Cargo.lock`、`src-tauri/src/runtime.rs`、`scripts/macos-native-smoke.sh`、`.github/workflows/macos-native.yml`、`src/MainShell.tsx`、`tests/app.spec.mjs`，同步 v2.9.1 版本源并新增 `docs/qa/DESK-02-342009c.md`；macOS 单实例、主窗隐藏/恢复、原生托盘菜单、命令面板浮窗、隔离 DMG 安装启动已由 Native Smoke `34330682984` PASS，Checks `34330682891` PASS，Universal Release `34330712307` PASS；本地前端串行 58/58、Rust 32/32、debug/release 包 PASS，Windows EXE/NSIS/MSI 与 macOS Universal DMG 四项资产 digest 见报告；v2.9.1 tag/Release 已收口 | DONE；下一项 DATA-01 |
| 2026-09-09 | DATA-01 | `c60eeb1`→`89d9404`；新增 `src-tauri/src/runtime.rs` 隔离 portable backup round-trip 单测、`docs/data-portability.md`、`docs/content/asset-inventory.md`；明确 state/runtime 备份字段与 WebView `localStorage` 排除项，登记跨平台目录、语料/音效/位图来源、SHA-256 和未核验缺口；定向迁移 1/1、Rust 33/33、`pnpm check`、`pnpm build`（2061 modules）、前端单 worker 58/58、cargo fmt/check、`git diff --check` PASS；证据 `docs/qa/DATA-01-89d9404.md`；仅文档/测试，不升版本、不重打 v2.9.1 Release | DONE；无下一项 |
| 2026-09-09 | REFINE-03 | `1c8fc9c`→`44fa75b`；重做 `GraphiteConsoleViews.tsx` / `.css`，将五页从同构换色控制台改为工业仪表、序列槽位、任务舱、信号记录与系统模块；移除状态栏伪造 CPU/MEM/SYNC 数据，补充真实记录时段计算与空槽位；新增 Graphite 结构断言与证据 `docs/qa/REFINE-03-graphite.md`；`pnpm check`、Graphite 3/3、完整前端串行等效 58/58、Vite build、cargo fmt/check/test 33/33、Windows v2.9.2 EXE/NSIS/MSI 打包 PASS | REVIEW；REL-02 发布闭环 |
| 2026-09-09 | REL-02 | `44fa75b`→`25090f1`；发布代码 tag 固定在 `9978e45`；补齐发布计划与 v2.9.2 说明，推送 main、创建 `v2.9.2` tag/Release、上传 Windows MSI 并刷新 GitHub Release notes；Checks `34350535611` PASS，macOS Native Smoke `34350535428` PASS，Universal Release `34350728878` PASS；Release 四项资产均为 uploaded，digest 见 `docs/v2.9.2/RELEASE_NOTES.md`；旧 tag 未移动 | DONE；下一项 REFINE-04 |
| 2026-09-09 | REL-03 | `7bade92`→工作树；同步 `package.json`、Cargo/lock、`tauri.conf.json`、运行时版本/里程碑、README 与 `docs/v2.10.0/RELEASE_NOTES.md`；本地 `pnpm check`、`pnpm build`（2061 modules）、前端串行 58/58、cargo fmt/check/test locked（33/33）均 PASS；正式 Windows 包、远程 main/tag/CI、macOS 资产与 GitHub Release 尚未执行 | DOING；继续正式打包 |
| 2026-09-09 | REL-03 | `7bade92`→`ce15ff0`；同步版本源、README、`docs/v2.10.0/RELEASE_NOTES.md` 与 Aurora/Botanical QA 证据；本地 `pnpm check`、`pnpm build`（2061 modules）、前端串行 58/58、cargo fmt/check/test locked（33/33）、Windows release MSI/NSIS/EXE 包通过；Checks `34364439803`、macOS Native Smoke `34364439775`、Universal Release `34364312849` 均 PASS；GitHub Release 四项资产均 uploaded，digest 见 v2.10.0 说明；旧 tag 未移动 | DONE；暂无下一项 |

每条后续记录使用：`日期｜任务ID｜开始SHA→结束SHA｜修改文件｜验证命令与结果｜证据路径/链接｜版本/发布状态｜剩余问题｜下一ID`。没有执行的测试必须写“未执行”，不可复制上一版结果。

### 输入资料的地位

- `AGENTS.md`：当前协作与发布约束；`PRODUCT.md`：稳定产品目标。
- `PROJECT_PLAN.md`：当前总览、优先级、任务状态与模型交接的唯一持续入口。
- 当前源码、测试、远程 Git/Release/CI：事实源；根目录计划不能覆盖实际结果。
- `docs/design-references/concept-images/01...05/`：25 张视觉参考；`analysis/01-night-valley/`：测量与历史差异资料，使用前核对当前 SHA。ENG-01 已以 main 集成提交和 GitHub Checks 验证干净 checkout 可复现的源码/测试路径；视觉资料完整性仍随 QA-01 复核。
- `docs/v*/RELEASE_NOTES.md`：各次版本历史，不是全部待办的验收证明。
- `docs/frontend-priority-roadmap.md`、`development-workflow.md`、`project-complete-summary.md`、`user-feedback.md`、旧 context summaries：**历史资料，不再用于判断当前版本/任务顺序**。其中重复确认每版的旧流程不覆盖本轮与根目录协议已有授权。
- 外置记忆：本轮检索本机 memories 未取得项目命中；以上仓库历史和当前事实构成本次结论依据。

### 本文件维护约定

每次只更新变化的看板字段、任务状态和日志，保留历史证据；不要整篇重写导致丢失未完成项。若用户调整目标，先记录新要求及取代项，再重排依赖。没有变化不产生重复状态报告；本文件是人工/模型维护的持续文档，不代表已设置自动监控。
