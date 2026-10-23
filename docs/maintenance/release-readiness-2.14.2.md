# Focused Moment 2.14.2 发布收口

as_of: 2026-10-23 17:38（Asia/Shanghai）

> **当前状态**：确认缺陷已修复并重建，最终候选为 9299…CCFA，前端完整 229/229、静态/Rust 和最终原生备份流程通过。托盘、浮窗、公开旧版升级、隐藏声音也已通过；最小化任务栏提醒未捕获预期事件，继续诊断，尚未发布。下方 B65 原生与资产检查保留为旧候选事实，不代表最终发布通过。

## 授权与基线

- 用户要求执行上一轮全部后续建议，包含恢复竞态排查、最终候选原生验收、PR 整理/合并与 Windows 发布。
- 最新纠正：多人试用先跳过，由用户本人日常使用；不等待外部参与者或一周观察。
- 源码分支 `codex/focused-moment-continuity`，起点 `47131be585654aaf95596b512889161affec7e4c`；公开版本 v2.11.10，当前本地候选 2.14.2。
- `PROJECT_PLAN.md` 保持只读，起始 SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；不提交既有未跟踪文件。macOS 发布继续冻结。

## 执行状态

| 单元 | 状态 | 验收 |
| --- | --- | --- |
| 初始错误恢复 | 已提交推送 | `a236df5`；完整 mock 225/225、静态/Rust 通过、审查后定向 2/2；远程 Checks 39925626053 成功 |
| 数据确认与预览绑定 | 代码与原生验收通过 | 官方异步确认接口，待决/取消/失败不写入，预览路径绑定；新候选 9299…CCFA 的完整备份流程 10 项断言通过 |
| 最终 Windows 原生验收 | 进行中 | 同一候选下托盘、隐藏提醒/音效、浮窗与书签、备份恢复及公开旧版升级；隔离数据与进程，记录实际覆盖 |
| PR、合并、Windows 发布 | 待验收 | 最终范围/版本/源提交/资产来源一致，远程检查通过，资产 digest 核对 |
| 多人真实试用 | 按用户要求跳过 | 由用户本人使用，不虚构反馈或观察结果 |

## 原生验收发现的数据确认缺陷

- tauri-plugin-dialog 2.7.3 的 `src/init-iife.js` 将 `window.confirm` 替换为异步 Promise，并调用已未注册的 `plugin:dialog|confirm`；Rust 只注册 open/save/message。控制器中的本地恢复、外部导入、清空数据还用 `if (!window.confirm(...))` 判断，Promise 为真导致未等待选择就写入。
- 原生证据：`artifacts/qa/native/release-acceptance-backup-20261023T084704339Z-2cfb8a2d/`；导出的 1 条记录在未确认前替换了当前 2 条记录，回滚文件已生成。全部为隔离合成数据，未触碰个人数据。
- 三项新增浏览器回归已在未修代码上真实失败：确认仍待决时分别观测到 import_app_backup、import_app_backup_path、clear_app_data 已调用。输出 `artifacts/qa/frontend/async-confirm-red-20261023-inv-mvkqgq0f-42592-d94bb1a8-cca4-4e59-891c-f300438b87d0/`。
- 修复范围：改用正式 `confirm()` → `plugin:dialog|message` 接口，在 `run` 的 busy/错误保护内等待，取消或弹窗失败不写入；捕获确认对应的文件和偏好选项；外部导入必须匹配已经预览的文件。之后全量回归、重新构建 2.14.2、同最终 EXE 原生复验与重新打包。
- 13 项相关回归通过：`artifacts/qa/frontend/native-dialog-green-20261023-inv-mvkqowkg-28620-0da388da-28ce-4b8b-85d5-ab19dc7a3062/`；`pnpm verify` 通过，Rust 57 passed / 1 ignored，日志 `artifacts/qa/verification/native-confirm-fix-20261023-d56d0db3/verify.log`。独立审查后加强了确认期间输入变化的断言，最终 229 项完整套件已通过。
- 2.14.2 尚未正式发布，版本保持 2.14.2；旧 `v2.14.2-20261023-1644-ae5a17c7` 资产只保留证据，不上传。

## 当前判断

历史失败是首读失败后自动恢复与旧手动重试测试的时间窗口竞争；用受控时间和持久故障输入分别验证两类行为，不增加重试、不放宽断言。自动 smoke 的窗口检查仍需验证 HWND 所有者和可见性。原生准备与发布范围审查由独立子任务并行完成，主任务负责整合和最终判断。

## 初始读取恢复验证

- 自动恢复与持续失败后的手动重试分开覆盖，保留原错误提示、实际点击、概览和待办恢复断言；新增失败重试仍可操作、成功后停止重试的验证。
- `pnpm verify` 通过，Rust 57 passed / 0 failed / 1 ignored；日志 `artifacts/qa/verification/release-readiness-verify-20261023-031254-ad88cea4/verify.log`。
- 完整浏览器 mock 225/225，4 workers、0 retries、4.7 分钟；目录 `artifacts/qa/frontend/release-readiness-full-20261023-inv-mvjx4xom-47780-fc5e9887-776e-4d92-801f-4c5835868be3/`，命令日志 `artifacts/qa/verification/release-readiness-full-20261023-031254-e8d8f215/playwright.log`。
- 独立审查发现时钟 install/pause 的同一时间点可能在慢 CI 中倒退，已改为先安装早一分钟的时间，再在应用启动前暂停；并强化失败点击确实发起读取的计数断言。最终定向 2/2 通过，目录 `artifacts/qa/frontend/recovery-reviewed-final-20261023-inv-mvjxgjh7-45516-7ad36fbb-44c0-45dd-b9fa-cc0ca0a24ed0/`，续作时已核对 `.last-run.json` 为 passed / failedTests=[]。
- 本单元只有测试/fixture 变化，生产源码无差异；not rebuilt; entry unchanged。

## 本轮工具异常与恢复

文档审查中的 `rg` 实际解析为本机 npm `rg.cmd` 包装器，包含嵌入引号和 `>` 的检索模式经过 cmd 二次解析，意外将 `app/src-tauri/src/runtime.rs` 截断。该文件在本轮开始时无用户差异；已从 HEAD blob 按原始字节恢复并匹配原 Release manifest：96,500 bytes、SHA-256 `599FE33074C8005C80F1C7C6F994FFB5E99154B8E8B8B844EB90951A1BF78A98`。恢复后源码 diff 为空；所有代理改用真实 `rg.exe`，不将截断计入产品修改或提交。

## 中断后恢复

- 16:30 用户要求继续；原三个子任务已停止，落盘测试、文档与脚本保留。重新安排原生验收和只读发布审查，不重做已完成的性能矩阵。
- 最新 `47131be` 远程 Checks 已成功，PR #1 仍 OPEN / CLEAN。未合并、未创建 v2.14.2 Release。
- 旧原生运行中部分步骤通过，但最新 tray、floating、backup、upgrade 场景报告均失败，仍需完成；不将局部断言或旧版本验证计作最终候选通过。
- 再次核对根 EXE、runtime.rs 和受保护 PROJECT_PLAN 的哈希均符合上述基线；没有运行中的 Focused Moment 实例。

## 旧候选原生验收（B65，已被替代）

以下均使用 B65F646ACAF733C40EA3BB9F48574197A88113CEC6994C7338DF7469604C4997 的隔离副本；检查候选自己的可见 HWND 与可操作 UIAutomation 控件。测试数据由夹具或真实旧版在隔离目录产生，不使用个人数据。

| 场景 | 实际结果 | `artifacts/qa/native/` 下的证据目录 |
| --- | --- | --- |
| 浮窗完成与书签 | 通过；跳过/保存后两轮恰好两条唯一记录，书签准确，待办未完成 | `release-acceptance-floating-20261023T083545879Z-5c8f436b` |
| 托盘暂停/继续 | 通过；点击候选自己的菜单，计时状态正确且记录仍为零 | `release-acceptance-tray-20261023T084102980Z-45f58b7c` |
| 公开旧版升级 | 通过；官方 v2.11.10 哈希匹配，旧版 UI 写入数据后升级到 v3，再次重启仍保留记录和待办 | `release-acceptance-upgrade-20261023T084233112Z-b2168c56` |
| 备份与恢复 | 继续验收；必须导出后制造数据差异，再证明恢复、偏好选择和回滚生效 | 待最终报告 |
| 隐藏主窗声音与提醒 | 继续验收；声音峰值、隐藏状态、恢复后的应用提示分别断言 | 待最终报告 |

## 旧 Windows 资产来源与包内容（B65，不发布）

- 原构建 `local-20261023-014338-12e750d843` 的 206 项输入文件仍全部存在，长度和哈希与原 manifest 相同。仅新增三个 `scripts/windows-release-*` 独立 QA 脚本，不进入 Vite/Rust 构建；编译相关的 174 项文件完全一致。原 manifest 保留其真实 dirty 信息，没有伪造新的干净构建。
- 使用 Tauri CLI 2.10.1 的 `pnpm tauri bundle --bundles "nsis,msi" --ci` 从该候选生成两种安装包；bundle 结束后根 portable 与 target Release EXE 全字节相同，未重建根入口。
- 两种安装包已解压检查，未运行安装器。包内程序只在 Tauri 的固定 bundle marker 三个字节上不同：`UNK` 分别变为 `NSS`、`MSI`，其余字节完全一致；MSI ProductVersion、NSIS 内核 FileVersion 和 portable FileVersion 均为 2.14.2。
- 精确输入、构建日志、包内容与版本证据：`artifacts/qa/release/release-2.14.2-20261023-1638/` 下的 `candidate-source-audit.json`、`bundle-quoted-args.log`、`installer-payload-audit.json`、`installer-version-audit.json`。
- 独立资产目录：`artifacts/builds/releases/v2.14.2-20261023-1644-ae5a17c7/`，manifest 为 `assets-manifest.json`。公开上传仍待原生与远程检查收口。

| 资产 | SHA-256 |
| --- | --- |
| `Focused.Moment.v2.14.2.exe` | `B65F646ACAF733C40EA3BB9F48574197A88113CEC6994C7338DF7469604C4997` |
| `Focused.Moment.Setup.v2.14.2.exe` | `10AA96B4F05E5ED2817B0EBD20213A7509CC92B5494B0BC566DCB4C3E0CEE5AD` |
| `Focused.Moment_2.14.2_x64_en-US.msi` | `AC2644847B383832B815D1439B365B3D2874C221DDEEF68205D3782E717AC14A` |

## 修复后最终候选与回归

- `pnpm package:local` 实际重建成功，build `local-20261023-170710-9bdc15b316`；根与 target SHA-256 均为 `9299A959D72C8CF81B5B751D1A61149A681E8C022E761F889574AA1B0A9BCCFA`，FileVersion/ProductVersion 2.14.2。manifest 记录真实的 a236df5 基点与工作区修复；旧根恢复副本由交付脚本保存。
- 全量首次运行 228/229，唯一失败为 CC-01 图片未解码即采样。受控挂起图片响应确定性复现后，只补 `image.decode()` 等待，所有原断言保留；受控延迟验证和最终 CC-01 定向 4/4 通过。
- 最终完整浏览器 mock **229/229**，4 workers、0 retries、5.9 分钟。目录 `artifacts/qa/frontend/release-final-full-20261023-171414-a82523e5-inv-mvkr6utl-29420-f6251456-05b1-42dc-bcf0-90b0c8ca1a5a/`，`.last-run.json` 为 passed / failedTests=[]；命令日志 `artifacts/qa/verification/release-final-full-20261023-171414-a82523e5/playwright.log`。
- 新 Setup/MSI 已从该 Release candidate 生成。只解压检查，包内 EXE 除 Tauri 固定 UNK → NSS/MSI 三字节标记外，与 portable 完全一致；MSI ProductVersion 和两种 EXE 版本均为 2.14.2。证据 `artifacts/qa/release/release-final-2.14.2-20261023-171233-f4ce110d/`，未运行安装器。
- 最终三资产目录 `artifacts/builds/releases/v2.14.2-20261023-171448-097d3e7f/`。其 manifest 暂标记不可发布，待最终原生验收与源提交 CI 完成。

| 最终资产 | SHA-256 |
| --- | --- |
| `Focused.Moment.v2.14.2.exe` | `9299A959D72C8CF81B5B751D1A61149A681E8C022E761F889574AA1B0A9BCCFA` |
| `Focused.Moment.Setup.v2.14.2.exe` | `FBD04796FDA643C9BA1300AB339F4A8F46EB5C7FEF33DE72BB56E02666D3EA92` |
| `Focused.Moment_2.14.2_x64_en-US.msi` | `90AEA19BD9D087EC1028FFBE77F646BC8BC7BC85A216F9724A618CA027DBEC8F` |

## 最终候选原生检查点（9299）

| 场景 | 结果与证据（`artifacts/qa/native/`） |
| --- | --- |
| 完整备份恢复 | 通过，10 项断言；`release-acceptance-backup-20261023T092825527Z-18c3b3fb`。取消不写入、不产生回滚；确认前保持两条，确认后恢复一条；回滚保留替换前数据，偏好选择和重启均验证，本地恢复与清空取消也保持数据 |
| 托盘暂停/继续 | 通过，`release-acceptance-tray-20261023T093011648Z-7fffcc87`；自有托盘菜单暂停/继续计时，记录数保持零 |
| 浮窗与书签 | 通过，`release-acceptance-floating-20261023T093047902Z-a5b326ed`；跳过和保存两轮后为两条唯一记录，书签正确，待办未完成 |
| 公开旧版升级 | 通过，`release-acceptance-upgrade-20261023T093136575Z-21140caf`；真实 v2.11.10 资产核验哈希，旧版 UI 产生数据，再升级并重启，记录和待办保留 |
| 隐藏窗口声音 | 通过声音/保持隐藏/恢复后提示；该次未观察到 HSHELL_FLASH，不将旧 B65 的事件作为替代证据 |
| 最小化任务栏提醒 | 未通过，`release-acceptance-minimized-attention-20261023T093324818Z-ac660ddc`；目标 HWND 事件为空，正在校准观察器并追踪触发条件，原断言未削弱 |

- 最新冻结脚本的语法与完整 `pnpm verify` 再次通过，Rust 57 passed / 1 ignored；日志 `artifacts/qa/verification/release-final-verify-20261023-173158-c4e21e55/verify.log`。
- 旧 091410 备份失败中确认框消失的原因未定；该次保留失败，不归因为外界输入。新完整动作轨迹显示触发只执行一次 UIA Invoke，约四秒后才单独执行原生取消/确定；追加持续待决探针验证更长的未操作窗口。
