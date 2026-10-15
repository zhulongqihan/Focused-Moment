# Focused Moment 分阶段优化执行

更新时间：2026-10-15（Asia/Shanghai）

## 当前交付状态

- A 批 2.13.9 已完成源码提交推送、Release EXE 交付和最终候选的隔离 Windows 验收。当前分支 HEAD 与 origin 同步于 `ef6fc5fc19f0f5cb11c29169ab4d32cff9060b01`。
- 根目录 `Focused Moment.exe`：版本资源 FileVersion/ProductVersion 均为 2.13.9；SHA-256 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3`；build ID `local-20261015-132218-f95a936d5c`。
- 正在进入 B 批；首要证据是 Windows 原生隔离夹具复现旧双文件混合状态再次保存后记录数从 1 增至 2。此为合成状态注入，不是运行中强退复现，B 批仍须完成真实崩溃边界验收。
- 未做 GitHub Release、tag、安装器或资产上传。`PROJECT_PLAN.md` 仍受只读保护，当前 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。

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
| B 保证保存与重置安全 | 2.13.10 | 进行中 | 从持久化写入边界和锁顺序开始审查；已记录旧混合状态二次保存会新增重复记录。需设计统一事务/恢复日志/重置会话保护，并通过真实强退、并发、失败回滚和重置专项。 |
| C 统一日常操作 | 2.14.0 | 未开始 | 恢复归档的首页动作改动；七主题行为及完成节点、浮窗完成/书签交接通过验收。 |
| D 降低持续运行开销 | 2.14.1 | 未开始 | B 完成后重新审查已归档的 DataRevisions 草稿；实现增量同步、单请求在途、轻量计时与音源分离。 |
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
