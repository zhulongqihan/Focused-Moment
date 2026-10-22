# Focused Moment 分阶段优化执行

更新时间：2026-10-22（Asia/Shanghai）

## 当前交付状态

- A 批 2.13.9 已完成源码提交推送、Release EXE 交付和最终候选的隔离 Windows 验收；其交付源码提交为 `ef6fc5fc19f0f5cb11c29169ab4d32cff9060b01`。
- A 批首次交付的根入口为 2.13.9（SHA-256 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3`）；之后由 B、C 批依次替换。当前根目录 `Focused Moment.exe` 为 C 批 2.14.0，SHA-256 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`，build ID `local-20261015-194816-ff963e39a1`。
- B 批 2.13.10 本地验收已完成：四个应用/验收提交先快进推送至 `d1976da7669e55e979c24bdd319054a529f3d918`，后续文档提交 `589beec2a89cc967cccfe21e1dc52b1cc67203a6` 与发布说明指针校正 `0084a05` 也已推送。B 批相关实现、Release 候选和 Windows 原生验收证据见下方对应工作单元。
- C 批 2.14.0 已完成源码提交推送、匹配 Release EXE 交付、代码级验证及 Windows 原生交互闭环。真实隔离 UI 验收了浮窗完成、主窗书签提示、跳过/保存和待办保持未完成；证据分层及未实测分支见下方 2026-10-22 工作单元。当前根入口 SHA-256 为 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`，build ID `local-20261015-194816-ff963e39a1`。
- D 批 2.14.1 已进入只读调用链审计与设计阶段；尚未修改应用源码或构建输入。初步审计发现主窗空闲时每秒执行七域全量读取并广播完整状态，且会重复读取自定义音频；准确 D 方案与验收项见下方最新工作单元。
- 未另外核验远程 CI；未做 GitHub Release、tag、安装器或资产上传。`PROJECT_PLAN.md` 仍受只读保护，当前 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。

## 本轮原始基线（2026-10-11）

- 权威执行目标：本轮《Focused Moment 优化重启计划》，按批次 0 → A → B → C → D → E 顺序推进；一批交付完成后才开始下一批应用改动。
- 仓库：F:\Focused Moment；分支 codex/focused-moment-continuity；HEAD 与 origin 同步于 5f86cd3025b2ff2b09302ec248e7161b16bfb9eb。
- 应用源码版本：2.13.8；已提交 U1 音源修复和 U2 提交结果处理。
- 根目录 Focused Moment.exe：2.13.6，SHA-256 0D0C4B31ED83C980624C8AD5B9713CC5D7451D865DF84A256CB2CB6FEC257C34。批次 0 仅处理文档与工作区基线，不重建入口。
- PROJECT_PLAN.md 是只读保护文件，保留用户差异；本轮起始和当前 SHA-256 均为 E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604。其 2026-09-17 快照早于本轮 2026-10-11 目标，按最新用户目标与真实源码/分支状态处理冲突，不改写历史文件。

## 批次状态

| 批次 | 版本 | 状态 | 退出条件与当前缺口 |
| --- | --- | --- | --- |
| 0 恢复可验证基线 | 不升版本 | 已完成 | 旧审阅报告已按原字节归档并记录 SHA-256；未完成的 C/D 改动已生成恢复补丁和新文件副本并暂时移出 A 批输入；用户差异保留；pnpm verify 通过。 |
| A 交付已有可靠性修复 | 2.13.9 | 已完成 | 来源匹配的 Release EXE 已交付；pnpm verify、生产构建、完整浏览器 178/178、官方 Windows 冒烟、原生交互及进程级声音峰值观测通过。 |
| B 保证保存与重置安全 | 2.13.10 | 本地验收完成并已推送 | 源码、Rust/浏览器回归、匹配 Release EXE、官方 Windows 隔离冒烟、原生重置 UIAutomation 和活跃写入强退后的启动回滚均通过。四个提交已推送至确认分支；未检查远程 CI，未创建正式 Release。 |
| C 统一日常操作 | 2.14.0 | 已完成 | 源码提交推送、Release EXE 交付、Rust/浏览器回归及真实 Windows 浮窗与书签交互验收完成；主窗恢复失败未在原生运行中注入，另有 mock 用例覆盖。 |
| D 降低持续运行开销 | 2.14.1 | 进行中：调用链审计 | C 已完成；正在以业务域修订号、原子选择性快照、每窗单次在途、轻量计时样本和独立音频读取替代每秒全量同步。完成条件仍为本计划中的定量验收及匹配 Windows Release 交付。 |
| E 降低启动负担并完成总验收 | 2.14.2 | 未开始 | 主题按需加载、预览衍生图、性能比较、Windows 原生专项和最终交接完成。 |

## 批次 0 证据

- 旧报告原路径：.impeccable/critique/2026-10-04T12-02-05Z__app-src-components-clutchcourtviews-tsx.md。
- 原字节 SHA-256：9C0D95739DF0B092A10ACD0277742F0EAB21EC0822EFFDFC2D1418142F5EE80D；恢复路径：archive/workspace-migrations/20261011-pre-batch-a/impeccable/critique/2026-10-04T12-02-05Z__app-src-components-clutchcourtviews-tsx.md。旧目录已确认清空后移除，未放宽结构检查。
- 工作区恢复包：archive/workspace-migrations/20261011-pre-batch-a/manifest.json。包含 16 个已修改应用文件的完整补丁、C 批首页补丁、D 批原生版本草稿补丁，以及 10 个未跟踪应用文件副本；各副本哈希见 manifest。
- 首页动作暂存待 C 批恢复；DataRevisions 原生版本草稿暂存待 B 批后重新设计。A 批弹层变更和 useDialogFocus 测试仍留在应用工作区。
- PROJECT_PLAN.md 未被写入、暂存或提交。批次 0 的默认沙箱不允许 git restore 创建 index.lock；已对照归档哈希，从 HEAD 对象原样恢复明确列出的 C/D 文件。commands.rs 与 timer_engine.rs 的规范化 blob hash 与 HEAD 相同，内容 diff 为空；status 仍显示 M 是只读索引元数据未刷新，不含源码差异。
- 验证：2026-10-11 在 app/ 执行 pnpm verify，退出码 0。TypeScript、CSS 顺序、结构边界（44 个源码文件）、Playwright 输出 guardrail、本地结构用例、原生契约检查（54 个命令、2 个契约用例）、交付脚本用例（7 个）通过；Rust fmt/check 通过，Rust 单测 39/39。Rust 现有未使用导入/死代码警告保留。此结果不代表 Windows Release 原生验收通过。
- 验证期间 pnpm 默认沙箱的异步 realpath(node_modules) 返回 EPERM；经权限审查运行同一条规定命令后通过。未创建 junction、镜像或替代检出。

## 后续批次验收

- 浏览器 mock、Rust 检查、Windows Release 原生检查分别记录，不互相替代。
- 每批应用变更前确认前一批交付已完成；每个独立修复先做相关验证，再提交推送至确认分支。
- 每批构建输入冻结后运行 pnpm verify、生产构建和完整浏览器回归；使用 pnpm package:local 制作匹配 Release EXE，核对候选/根入口哈希、版本、源码/输入指纹和旧入口恢复副本，并对同一候选执行 Windows 原生验收。
- 每个单元留下提交、工作区差异、最后验证、证据目录、失败原因和唯一下一步。
- 计划外：不做 main 分支整合、安装器、tag、GitHub Release、资产上传或 macOS 发布。

## 性能硬指标（E 批）

- 稳态 60 秒无业务变化：周期性业务全量读取 0 次、完整业务广播 0 次、音频重读 0 次。
- 慢请求期间每窗口业务刷新至多一个在途且持续更新；漏事件在下一次 30 秒校准加实际请求耗时内恢复；无变化同步流量不随 1,000/10,000 条记录或大音频增长。
- 默认首页可操作前加载的全部 JavaScript 原始字节至少减少 30%。
- 七张预览 WebP 总量不超过 1 MB，并通过实际显示质量检查。
- 原生性能基线采用 C 批完成、尚未优化的 Release；同机同设置，空数据/1,000 条/10,000 条/10,000 条加 5 MB 音频，空闲/运行/隐藏分别测量，预热 15 秒、采样 60 秒、前后各三轮，记录 CPU、私有内存和启动时间中位数及范围。
## A 批当前证据

- 弹层键盘专项 7/7：命令面板交接、四类弹层焦点循环、反向 Tab、窄窗、IME、背景快捷键隔离、写入中关闭/重复提交保护。运行目录：artifacts/qa/frontend/20261011-dialog-a-inv-mv38wfw5-10932-14cd00ee-df7e-4c48-b69f-afba08af2a03。
- 提交结果专项 9/9：手动补录和快速记事的真实写入失败保留草稿；导入/清空读取失败后只重试刷新；自动迷你工作台失败和焦点浮窗返回主窗失败只重试后续窗口动作。运行目录：artifacts/qa/frontend/20261011-a-actions-rerun-inv-mv395hwe-6692-0156dcd3-623d-4f71-b20c-8fdf788ddf54。首次 fixture 的焦点浮窗 label 使用错误，按 Tauri 实际 label 修正为 focus-float 后重跑通过。
- 完整浏览器 mock：178/178 通过，用时 11 分 18 秒；五套主题、旧主题、窄屏、提醒音源、书签、弹层及恢复路径均在本次套件内。证据目录：artifacts/qa/frontend/20261011-a-full-inv-mv3979od-14016-529baf7e-c3db-44b6-93fe-09c581120c79。
- 静态/Rust：完整 pnpm verify 退出码 0；Rust fmt/check 通过，Rust 单测 39/39。浏览器 mock 和 Rust 证据均不等同 Windows Release 原生验收。
- 提交结果补充回归仅包含测试与 mock，已作为 5f86cd3 推送到 origin/codex/focused-moment-continuity；无远程 CI 结果。
- 尚未升版；源码目前为 2.13.8，根 EXE 仍为 2.13.6，未制作 2.13.9 Release candidate，Windows-native 未运行。

下一步：选择性提交 A 批应用与版本文件；运行 package:local，核对 2.13.9 EXE、输入指纹和旧入口恢复副本，再对同一 Release 候选执行隔离 Windows 原生验收。

## A 批 2.13.9 冻结验证（2026-10-11 阶段记录）

- 版本同步：`app/package.json`、`app/src-tauri/Cargo.toml`、`app/src-tauri/Cargo.lock`、`app/src-tauri/tauri.conf.json`、`app/src-tauri/src/runtime.rs` 均为 2.13.9；里程碑文本更新为键盘安全弹层流程。发布说明位于 `docs/v2.13.9/RELEASE_NOTES.md`。
- `pnpm verify`：2026-10-11 退出码 0；TypeScript、CSS、结构、Playwright 输出约束、本地结构用例、54 个原生命令契约、交付脚本 7 个场景通过；Rust 单测 39/39。Rust 既有 unused/dead-code 警告仍在。
- `pnpm build`：Vite 6.4.2 成功，2092 个模块；仍提示主 JS/CSS chunk 超过默认 500 kB 阈值。
- 首轮完整浏览器在默认 8 workers 下为 177/178；一项既有提醒音浮窗用例在 `page.goto` 等待 load 时达到 30 秒超时，页面快照已显示完整界面。该项单独 1 worker 通过（1/1）。未改断言、未启用重试；以 4 workers 重跑原完整套件后 178/178 通过。失败轮目录：`artifacts/qa/frontend/run-inv-mv39w7ya-43200-3c7a16e5-7eaa-4865-b45f-c197ef35ad50`；定向诊断：`artifacts/qa/frontend/run-inv-mv3a2t2v-39780-05e71eb7-0b54-46d0-8e96-5bf15811e559`；完整通过：`artifacts/qa/frontend/run-inv-mv3a3muf-38996-fd09c0fe-d5bb-4605-88c9-39899756eb24`。
- `app/scripts/local-delivery.psm1` 会把 `app/scripts/` 下所有文件纳入 provenance 输入指纹，其中有未跟踪的原生交互和性能辅助脚本。它们会作为路径/哈希出现在构建记录，但不进入 Vite/Tauri 编译输入或 EXE；提交时仍按 A 批白名单选择路径。候选清单须保留此工作树状态，不把它描述为干净源码树。
- 当时尚未执行原生验收、根入口仍为 2.13.6；后续完成情况见下方 2026-10-15 最终交付记录。

## A 批 2.13.9 最终交付（2026-10-15）

- **提交/推送**：应用和版本同步 `8d98254`；原生 UIAutomation 无名称守卫 `102eb05`；EXE 版本资源校验及交付脚本测试 `ef6fc5f`；均快进推送到 `origin/codex/focused-moment-continuity`。更早的提交结果回归 `5f86cd3` 也已在该分支。
- **静态/Rust/构建**：最终输入的 `pnpm verify` 退出码 0；交付脚本 8/8，Rust 39/39；`pnpm build` 成功（Vite 6.4.2，2092 模块）。保留既有 Rust unused/dead-code 与 Vite 大 chunk 警告。
- **浏览器 mock**：最终输入完整 178/178，通过 4 workers、无重试。证据目录：`artifacts/qa/frontend/run-inv-mv936un8-3176-dd58550e-2819-4c5d-82f7-fd421527f0ff`。早先默认并发有一次 `page.goto` 等待 load 超时；单项在 1 worker 通过，随后原完整套件在 4 workers 全通过，未改断言/超时/重试。
- **版本门禁**：`local-delivery.psm1` 在任何交付目录和旧入口备份创建前检查候选 PE 的 FileVersion、ProductVersion，拒绝缺失或与 package 版本不符的资源；允许 Windows 版本号末尾 `.0`。manifest 同时记录两个真实资源值。错误产品版本的 fixture 保持原入口且不产生交付目录。
- **最终 Release 来源**：build ID `local-20261015-132218-f95a936d5c`，HEAD `ef6fc5fc19f0f5cb11c29169ab4d32cff9060b01`，分支 `codex/focused-moment-continuity`。候选与根入口 SHA-256 均为 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3`；FileVersion/ProductVersion 均为 2.13.9。191 个指纹输入在构建前后摘要相同：`DB40CBE04E6C3F898DADF0EDBC1BB2064E4E0B123C22A5E1276B4D3CE27E81D7`。此 manifest 仍诚实标记 `relevantBuildInputDirty=true`，因为打包策略会把 `app/scripts/` 中的本机辅助脚本计入指纹；它们未被编译进 EXE。首次 package 发现 Cargo.toml 行尾在构建时 CRLF→LF，未替换根入口；稳定后重建成功。旧 2.13.9 根入口备份在 `archive/executables/local/local-20261015-132218-f95a936d5c/Focused Moment.exe`（SHA `BE76F13C750982BB17F2E2F9749AF87A784E131769868DF067436B92C69BED7`）；更早 2.13.6 恢复副本仍在 `archive/executables/local/local-20261011-115259-4e93da2a1e/Focused Moment.exe`。
- **Windows 原生**：官方隔离冒烟 `windows-native-20261015-132425-5b9ac9b87d` 通过，QA 副本与根入口哈希一致，启动、专用存储目录、WebView2 目录和旧数据迁移均通过。UIAutomation 交互 `windows-interactions-20261015T052510928Z-41a4b4ec` 对同一最终 SHA 的 6 项启动/暂停/浮窗/完成/重启断言通过；专用进程树 CoreAudio 计量 `windows-interactions-20261015T052715706Z-ea5c1c34` 的试听和提醒峰值分别为 0.0337293 与 0.0337603427，证明进程产生输出，不证明人耳可听或音源身份。该 WebView2 不开放 CDP，因此没有 IPC 调用计数；托盘/隐藏窗口提醒尚未覆盖，留待后续总验收。
- **工具诊断**：首个 UIA run 遇到 `AutomationElement.Name = null` 时测试辅助脚本抛 TypeError；已用不放松标题匹配的类型守卫修复并推送。另一次首屏无可访问子元素的启动诊断未作为通过证据；随后同一最终候选的无音量计与音量计运行均完整通过。
- **B 批根因线索**：同一隔离 UIA 运行用合成“新状态/旧运行态”混合对，界面允许继续，重复保存后记录数变成 2。未做定时进程强退；该结果证明需在 B 批修复事务一致性，不能用作强退恢复通过证据。

下一步：读取受保护的 `PROJECT_PLAN.md` 作为旧基线参考，审查 B 批命令读写调用链、磁盘文件与锁顺序，再冻结事务/恢复日志设计及专项验收矩阵；此前不直接沿用归档的 DataRevisions 锁设计。

### 2026-10-15 B 批实现与代码级验证

- **实现范围**：统一命令、托盘、导入、清空及退出保存事务；pending/committed sidecar 恢复日志；事务范围快照和操作锁；运行态单文件事务；重置会话 ID 与迟到确认保护；恢复材料导出入口。版本输入同步为 2.13.10。
- **Rust/静态**：最终 `pnpm verify` 退出码 0，证据 `artifacts/qa/rust/batch-b-verify-final-20261015-160500-a1c7d942/pnpm-verify.log`。Rust 49 passed、0 failed、1 ignored；包含子进程在写入/提交边界退出、恢复中再次退出、并发写入、失败回滚、冲突保护和 stale reset 测试。
- **生产前端**：`pnpm build` 退出码 0，Vite 6.4.2；日志 `artifacts/qa/build/batch-b-build-20261015-152010-27f72bf1/pnpm-build.log`。保留既有大 chunk 警告。
- **浏览器 mock**：完整 Playwright `183/183`，4 workers、无重试；证据 `artifacts/qa/frontend/batch-b-full-final-20261015-151021-488af42d-batch-b-full-final-20261015-151021-488af42d/`。覆盖重置确认、取消、失败重试、重复确认和跨窗口旧会话确认；视觉截图 `.../app-reset-confirmation-sho-f28c3-led-without-losing-progress-chromium/screenshots/reset-session-confirmation.png` 已检查。
- **Release 候选**：源码提交 `297573fe08da83fc76ef63f50738315f8724a2f6`；build ID `local-20261015-153109-5c67dc3626`。候选与根目录 `Focused Moment.exe` 的 FileVersion/ProductVersion 均为 2.13.10、SHA-256 均为 `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40`，长度 46,347,776 bytes。manifest 为 `artifacts/builds/local/local-20261015-153109-5c67dc3626/manifest.json`；打包日志为 `artifacts/qa/build/batch-b-package-20261015-161500-5edb71a4/pnpm-package-local.log`；192 项输入的前后 fingerprint 均为 `B8B7B42E6ACF072F09503D2C770D96F15361A13CBA23388195B930FAB4D126CF`。前一 2.13.9 根入口 SHA-256 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3` 的恢复副本为 `archive/executables/local/local-20261015-153109-5c67dc3626/Focused Moment.exe`。
- **Windows 原生冒烟**：`pnpm native:windows` 通过，run `windows-native-20261015-153341-0cd5821feb`。该自动检查只覆盖同哈希候选的可见启动、隔离数据/WebView2 路径、旧路径防护与合成旧数据迁移，不覆盖重置交互、托盘或活跃写入强退；报告另记有合成临时目录清理警告，不影响上述断言结果。
- **Windows Release 启动恢复**：pending 日志回滚单场景通过，run `windows-release-transaction-recovery-20261015T080915587Z-f16b06b2`；committed 日志保留并清理单场景通过，run `windows-release-committed-recovery-20261015T081416228Z-16e0b35e`。两者均使用 2.13.10 Release EXE 启动隔离合成存储并核对文件哈希，只证明启动恢复。pending 场景断言通过，但 runner 因临时 WebView2 profile 被占用、清理报 `EBUSY` 而以退出码 1 结束；committed 场景修正 fixture 中 SHA-256 文本大小写后通过，之前的大写 fixture 失败不是产品证据。
- **重置 UIAutomation**：最终 Release run `windows-reset-native-20261015T084539307Z-e809fa5d` 的 8 项原生断言通过，覆盖重置确认入口、对话框控件、任务/时长上下文、默认焦点“保留本轮”、取消保留 30 秒运行态、确认清除运行态且不创建专注记录。较早一次输出乱码来自 PowerShell 探针未设 UTF-8；修正探针编码后通过，不是产品缺陷。此前空树/CDP 失败 run 不作为产品结论。
- **Windows Release 活跃写入强退**：run `windows-release-active-write-kill-20261015T091502930Z-d50d1b75` 使用匹配候选 SHA `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40` 和 4 MB 合成音频负载。观察到 state 目标已替换、pending journal 同时覆盖 state/runtime、runtime 仍为旧字节后，隔离 Release 进程 PID 11392 退出。随后同一 Release 以共享合成存储启动；state 精确恢复为事务备份 SHA `8FB26543B762282E685FC972677C1778F57C220CE7949080EA1BCC7978E83A7E`，runtime 保持旧 SHA `E1D118B0A5F297194C037269EB02602473FD23ACE76C9B101ACAAE255E553D77`，pending journal 被移除。
- **原生窗口证据与探针限制**：恢复窗口截图位于 `artifacts/qa/native/windows-release-active-write-kill-20261015T091502930Z-d50d1b75/recovery-current.png`。原 runner 的恢复探针未写 `report.json`：它选中了可见但无名称、没有 UIA 子元素的 HWND 3279234；通过 EnumWindows 确认同一隔离进程的真实主窗口 HWND 1050966 后，显式句柄 UIA Inspect 得到 84 个控件并找到“计时”按钮。独立核验记录为 `artifacts/qa/native/windows-release-active-write-kill-20261015T091502930Z-d50d1b75/supplemental-verification.json`，说明 runner 的句柄发现限制及逐项文件哈希。该补充核验和混合状态快照共同支持功能验收，不声称原 runner 本身退出码通过。
- **B 批结论**：Windows Release 强退后恢复与原生重置验收缺口已关闭；Rust 子进程故障注入、Windows Release 启动恢复、原生 UIAutomation 和浏览器 mock 仍按各自证据类别分别记录。B 本地验收完成，可以开始 C 批本地应用工作。
- **工作区保护**：manifest `source.dirty=true`、`relevantBuildInputDirty=true`；`app/scripts/` 的三份未跟踪 QA/性能辅助脚本进入 provenance 指纹，但不进入 Vite/Tauri 编译。`PROJECT_PLAN.md` 保持原始用户差异且未写入/暂存/提交，SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；`div`、五份历史摘要和本机脚本均未纳入提交。
- **提交/下一步**：B 的四个应用/验收提交已快进推送，后续文档校正提交 `589beec2a89cc967cccfe21e1dc52b1cc67203a6` 也已推送；上一轮 `git ls-remote` 核实远端最终指针为该提交。未核验远程 CI，未创建正式 Release。B 交付完成，C 批 2.14.0 已开始，具体工作区状态见下节。

### 2026-10-15 C 批启动

- 已从 `archive/workspace-migrations/20261011-pre-batch-a/` 校验并恢复共享首页动作组件、动作判断模块、样式和浏览器用例，并应用七主题首页补丁。当前有七个首页视图文件修改、四个新增应用文件；受保护的 `PROJECT_PLAN.md`、`div`、五份历史摘要和三份本机辅助脚本均保持原样。
- 起点阶段的下一步为核对空首页动作、七主题调用参数和浮窗书签交接；该起点状态已由下方实现与验收记录更新。

### 2026-10-15 C 批实现与代码级验收

- **首页操作**：新增共享 `HomeFocusActions` 与 action resolver，接入七种主题首页。可继续事项显示开始/暂停/继续/完成；空首页显示“快速记事”，打开收集对话框且不启动计时。Night Valley 已完成节点继续按语义打开待办或记录，不会开启新计时。
- **浮窗书签**：专注浮窗完成后提交一次记录并排队提示；主窗口在启动、收到完成通知、重新显示及前台恢复时查询队列。保存位置与确认提示走同一事务；跳过只确认该记录；已完成/删除的待办不会显示陈旧提示；主窗恢复失败只重试窗口动作。
- **浏览器 mock**：完整套件 `212/212` 通过，4 workers、无重试。证据目录：`artifacts/qa/frontend/run-inv-mv9fc2t8-41204-27a8f1ae-0e5d-4a2a-9741-ffe16a2fc86b/`。包含七主题桌面/窄屏截图矩阵和书签交接用例。四个旧断言已按实际新交互更新；前一轮 `208/212` 为断言仍期待旧提示计数/旧空态标签及对两个按钮使用严格单元素定位，修复后全量重跑通过。
- **Playwright 启动方式**：默认 `webServer` 启动方式在用例结束后挂起，虽然单用例已显示通过仍不产出汇总。诊断确认由外部启动同一 `app/` Vite、临时配置仅设置 `reuseExistingServer=true` 后，Playwright 能以退出码 0 完成；所有 212 个原测试均从真实仓库 `app/` 执行，运行目录仍由正式配置生成的唯一 run ID 管理。临时配置和 Vite 服务均已清理，正式 `playwright.config.mjs` 未修改。此 runner 生命周期问题保留为测试基础设施缺口。
- **Rust/静态**：当前源码在 2.14.0 版本同步前执行 `pnpm verify`，退出码 0；Rust 51 passed、0 failed、1 ignored。证据目录：`artifacts/qa/rust/batch-c-verify-20261015-190131-94332ea4/`。版本同步后需再执行最终 `pnpm verify`。
- **版本/下一步**：`package.json`、Tauri `Cargo.toml` / `Cargo.lock` / `tauri.conf.json` 和 `runtime.rs` 已同步至 2.14.0，新增 `docs/v2.14.0/RELEASE_NOTES.md`。尚未生产构建、提交/推送或更新根 EXE。下一步复跑版本同步后的 `pnpm verify`，执行 `pnpm build`，只暂存 C 批白名单路径并推送已确认分支，再制作 2.14.0 Release 候选、核对 provenance 并完成同一候选的 Windows 原生/交互验收。

### 2026-10-15 C 批书签生命周期根因修正与最终代码级验收

- **约束与根因**：目标要求待处理书签提示只在本次应用进程内保留，故未把提示队列加入 JSON 状态或便携备份。发现清空/导入会留下旧内存提示，待办 ID 复用时可能错误绑定；状态事务快照未覆盖该内存队列，失败替换也无法回滚提示；书签保存只按记录 ID 移除提示，没有核对待办 ID。
- **修复**：将进程内提示队列加入 State/All 操作事务快照及回滚；清空和导入成功路径清空旧提示；书签保存核验当前待办仍未完成且记录 ID/待办 ID 与待处理提示一致；跳过确认在统一操作锁内处理。失败导入继续恢复原提示。
- **Rust/静态验证**：版本同步后的 `pnpm verify` 退出码 0；Rust 53 passed、0 failed、1 ignored。日志：`artifacts/qa/rust/batch-c-verify-20261015-46715e8d/pnpm-verify.log`。书签队列、清空/导入、错误确认关系和失败导入回滚专项均通过。
- **生产前端构建**：`pnpm build` 退出码 0，Vite 6.4.2 转换 2,096 个模块。日志：`artifacts/qa/build/batch-c-build-20261015-294fe5f5/pnpm-build.log`。仍有入口 JS/CSS 大于 Vite 默认 500 kB 提示，保留给 E 批启动性能工作。
- **浏览器 mock**：完整 Playwright 212/212 通过，4 workers、0 重试，用时 5.8 分钟。目录：`artifacts/qa/frontend/batch-c-full-20261015-f4b69297-inv-c-full-20261015-f4b69297/`；`playwright.log` 记录最终汇总，`.last-run.json` 状态为 passed。使用外部启动的仓库 Vite 与临时 `reuseExistingServer` 配置；配置将 `testDir` 指向仓库 `app/tests` 绝对路径，正式 `playwright.config.mjs` 未修改；Vite 与临时配置已关闭/清除。
- **工作区保护**：`PROJECT_PLAN.md` 哈希仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；未写入、暂存或提交。`div`、五份历史 context summary、三份未跟踪 app QA/性能脚本未混入本批路径白名单。
- **提交/推送**：C 批源码、测试、2.14.0 发布说明和维护记录为提交 `e3923313bf2be17e3cca4dfbe443aedda7448979`，已快进推送至 `origin/codex/focused-moment-continuity`；`git ls-remote` 返回相同指针。B 批说明校正 `0084a05` 也已单独推送。
- **下一步**：先在具有可交互 WebView2 页面和有效 UIA 控件的 Windows 会话中，使用根入口 2.14.0 完成浮窗记录提交、主窗保存/跳过书签、主窗恢复重试不重复写入。完成前不开始 D 批应用改动。

### 2026-10-15 C 批 Release 候选与 Windows 验收断点

- **候选来源**：默认 `pnpm package:local` 成功，build ID `local-20261015-194816-ff963e39a1`，源 HEAD `3f33b574f6245a121f56ca1bc3a9e3476f68fb7f`，分支 `codex/focused-moment-continuity`。候选与根 `Focused Moment.exe` SHA-256 均为 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`；PE FileVersion/ProductVersion 均为 2.14.0。manifest：`artifacts/builds/local/local-20261015-194816-ff963e39a1/manifest.json`。
- **输入与恢复**：195 个输入文件的构建前后摘要均为 `7AF0A62D2256606512301E9C1A22377D39437A6E46796E053CA0C11C040DE3BF`。manifest 如实记录 `app/scripts/measure-release-performance.mjs`、`app/scripts/windows-native-interactions.audio.ps1`、`app/scripts/windows-native-interactions.ps1` 为相关未提交辅助脚本；它们未进入 Vite/Tauri 编译。旧 B 版 2.13.10 根入口 SHA-256 `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40` 保存在 `archive/executables/local/local-20261015-194816-ff963e39a1/Focused Moment.exe`。
- **Windows 隔离 smoke**：`pnpm native:windows` run `windows-native-20261015-195043-03386d1148` 退出码 0；报告记录 QA 副本哈希匹配、隔离存储创建、旧路径防护和合成旧数据迁移通过。该脚本未覆盖计时/浮窗/书签交互；其 `Process.MainWindowHandle` 窗口可见断言没有核验 HWND 拥有者与有效性，因此不作为 C 界面可交互的证明。报告初始记录 TEMP 清理拒绝访问；之后用仓库清理脚本对本轮九个唯一隔离目录完成校验清理，均已不存在。
- **交互验收限制**：C 候选 WebView2 CDP target 的 title/URL 为空，`Page.enable` 超时；UIA helper 默认读取到 40×40 输入法覆盖窗，显式主窗句柄只见到单一 Pane。用同一 profile 参数对 B 版 2.13.10 复测，CDP target 与 `Page.enable` 超时相同，另一次 `Runtime.evaluate` 也超时。当前 Windows 会话 `GetForegroundWindow` 返回空句柄；本轮未执行 C 业务按钮交互，不记录为通过。C/B 诊断分别位于 `artifacts/qa/native/windows-native-cdp-fast-20261015121729-77777032-1/`、`artifacts/qa/native/windows-native-control-cdp-fast-20261015121843-e34492f6-9/` 和 `artifacts/qa/native/windows-native-control-runtime-cdp-20261015122038-bf3ae320-d/`。
- **交互会话复核**：在 `c-interaction-20261015-203553-02c2f272` 中，以 root 候选同哈希副本和独立 `LOCALAPPDATA`/`APPDATA`/`TEMP`/`USERPROFILE`/WebView2 目录启动。进程在 session 1 保持响应，隔离存储和 WebView2 目录已创建，但 `MainWindowHandle=0`、候选 PID 的 `EnumWindows` 顶层窗口数为 0、`GetForegroundWindow=0`；未执行 UIA 或业务交互。进程、候选副本和隔离数据已清理，报告保留于 `artifacts/qa/native/c-interaction-20261015-203553-02c2f272/report.md`。这是当前自动化会话缺少可操作桌面的新证据，不作为产品回归或交互通过。
- **状态/唯一下一步**：本地 2.14.0 Release 候选已交付且来源可追溯；C 批交互退出条件仍待验。请从实际登录的 Windows 桌面 PowerShell 按 `artifacts/qa/native/c-interaction-desktop-20261015-204411-8a33c5cf/README.md` 运行隔离启动器；它复核候选哈希并只在找到候选自有的可见 HWND 时保留进程。窗口可见后用 UIA 完成上述三项原生交互，再进入 D。当前自动化会话无窗口，不启动 D 应用改动。

### 2026-10-22 C 批 Windows Release 交互验收关闭

- **真实候选**：隔离启动器核对根 `Focused Moment.exe` 并运行同哈希 QA 副本；build ID `local-20261015-194816-ff963e39a1`，SHA-256 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`。存储、WebView2、临时目录和用户配置均限定在 `artifacts/qa/native/c-interaction-desktop-20261015-204411-8a33c5cf/`。
- **Windows UI**：真实主页创建合成待办，带入专注并启动计时；候选所有的浮窗显示相同任务，浮窗完成后写入一条关联记录、保留待办未完成，主窗恢复并读出书签提示。主窗明确跳过一次、保存一次；提示均按预期移除，书签保存到隔离状态。
- **结果核对**：最终两条记录 ID 为 `0`、`1`，时长分别为 91,893 ms 和 1,873 ms；待办仍未完成，停笔书签为“从第三段的例子开始”。详细报告及截图见 `artifacts/qa/native/c-interaction-desktop-20261015-204411-8a33c5cf/report.md`。
- **证据分层**：这是 Windows Release 原生 UI 证据。未在此运行强制制造主窗恢复失败；浏览器 mock 的 `floating completion queues one notice and retrying main restoration never saves again` 用例和此前完整 212/212 记录覆盖该分支。此前 53 passed/0 failed/1 ignored 的 Rust 验证与 212/212 浏览器验证保持各自证据类别，不由本次 UI 结果替代。未验收托盘、音频或隐藏窗口提醒。
- **状态与下一步**：C 批退出条件完成；根入口仍是来源可追溯的 2.14.0 Release，未重建。现在可以进入 D 批 2.14.1 增量同步工作。`PROJECT_PLAN.md` 继续只读保护，SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。

### 2026-10-22 D 批 2.14.1 状态校正与只读调用链审计

- **状态来源**：追加于 2026-10-22 的 C 批 Release 原生验收记录证明 C 已退出；据此修正本文件顶部和批次表中仍显示“C 待验收 / D 未开始”的派生状态。旧工作单中当时的限制描述保留为历史记录，不覆盖当时事实。
- **用户续作指令**：用户确认可保持实际 Windows 桌面可用并启动根目录 2.14.0 EXE；后续实际隔离 UI 验收已关闭 C。当前根 EXE PID 43308 仍可见，本次只读取进程信息，不触碰真实用户数据。
- **源码基线**：主窗和浮窗都从 `loadFromStorage()` 进入 `refresh(true)`；全量 `refresh()` 以 `Promise.all` 读取计时、待办、记录、分析、计时偏好、应用偏好（含音频 base64）及焦点计划。主窗空闲轮询每秒调用全量刷新，并发布完整 `app-state-sync`。`refreshVersion` 只拒绝旧响应，未限制并发；大于一秒的请求可能持续被更新请求废弃。计时快照读取还会刷新托盘菜单。偏好写入按完整对象替换，可能让旧窗口覆盖其他偏好或音源。
- **已核对草稿风险**：归档的旧 `DataPublication` 草稿在每次写盘时序列化比较整份持久化状态来推导版本，可能对 10,000 条记录造成额外全量遍历，并引入通知/锁顺序风险；不直接应用。修订号应随各类写事务成功提交按域增加；失败事务不得对外发布新版本。分析版本从待办/记录域派生。
- **实现边界**：D 目标是每窗口一个在途业务快照请求、按域合并变化、响应应用后再追赶待处理域；主窗与浮窗使用独立的轻量计时同步；音频仅主窗初始化或音源版本变化时读取。读取失败保留当前 UI 与待处理域，按 1/2/5/10/30 秒退避，不重放写命令；30 秒版本校准、可见/焦点与午夜检查补偿漏事件。
- **量化验收**：稳定无变化 60 秒周期业务全量读/广播/音频重读均为 0；1.5–3 秒注入延迟时每窗最多一个业务请求且不饥饿；漏事件由 30 秒校准后的实际请求收敛；无变化流量与记录量/音频大小无关。浏览器 mock、Rust、Windows Release 三类证据分别记录；当前尚未执行 D 实现和验证。
- **当前唯一下一步**：继续逐项映射 `commands.rs` / `runtime.rs` 的成功写事务到五个业务域及音源版本，确定不在读路径引入大数据遍历的快照锁边界，然后实现版本 API 与同步协调器。`PROJECT_PLAN.md` SHA-256 保持 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。
