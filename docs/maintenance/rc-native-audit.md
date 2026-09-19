# RC Git 基线、原生验证与资源审阅

审阅日期：2026-09-19，Asia/Shanghai。当前结论：脚本已补写并做静态检查；**原生验收尚未完成**，最终构建及真实 Windows 执行 **NOT RUN，等待主agent最终clean build**。native执行已获授权，主agent通知构建完成后直接执行，无需再次请求用户授权。本记录不能作为 RC 原生验收通过证明。

## 范围与所有权

- 工作根目录为 `F:\Focused Moment`；应用命令从 `app/` 运行。
- 本工作单元只修改 `app/scripts/windows-native-smoke.ps1`，新增 `app/scripts/native-cdp/{playwright.config.mjs,interaction.spec.mjs,sound.spec.mjs,inspect-windows.ps1}`、`app/scripts/rc-source-audit.mjs` 和本文件。
- 不修改、不暂存、不提交 `PROJECT_PLAN.md`、runtime/timer_engine/commands/controller/app.spec/visual 等其他负责人文件。审阅中这些文件持续产生并行改动，不能归因于本工作单元。
- 无 commit、push、merge、tag、Release、安装器运行或应用启动；没有读取真实用户数据或备份。
- `PROJECT_PLAN.md` 开始与复核 SHA-256 均为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。按明确只读要求，不回填该文件。
- 根入口未重建、未替换（not rebuilt; entry unchanged）。交付指纹包含 scripts，因此本轮脚本新增也会使旧 manifest 指纹过期；不能用旧 EXE 验证当前源码。

## Git 基线及历史结论

| 项目 | 实测值 |
| --- | --- |
| HEAD | `4ab5c045206a3e5de5ba75c68bb58c7576d9425d` |
| branch | `codex/focused-moment-continuity` |
| local main / cached origin/main | `ec8ed2549380b074a9d12ebc9ae11d148dece977` |
| live origin main | `ec8ed2549380b074a9d12ebc9ae11d148dece977`，由 `git ls-remote origin refs/heads/main` 核实 |
| merge-base(HEAD, main/origin-main) | `ec8ed2549380b074a9d12ebc9ae11d148dece977` |
| remote | `git@github.com:zhulongqihan/Focused-Moment.git` |
| 分支新增提交 | `44da011`、`4ab5c04` |
| main...HEAD | 50 文件，8432 insertions / 4596 deletions |
| main...44da011 | 48 文件，3404 insertions / 4572 deletions |
| 暂存区 | 本轮核查时为空 |

初次远端只读查询受沙箱网络限制；随后授权环境中的只读查询成功。没有 fetch、移动引用或修改远端。

### 2.11.11 是否丢失产品代码

可证明的事实：

1. main 的版本源是 `2.11.10`，当前分支直接改为 `2.12.0`。`git log --all --grep=2.11.11` 和对迁移前后 package.json 的 `git log --all -S 2.11.11` 未找到独立产品版本提交；reflog 可见从 `ec8ed25` 创建当前分支，再产生上述两个提交，未发现本次 RC 的 reset/丢弃记录。
2. 分支内唯一以删除状态出现的 tracked 文件是 `app/src/assets/viral-quote-sample.mp3`。其余产品差异在下方完整清单中，包括大量修改而非只查看删除文件。
3. main 的 `app/tests/today-visual.spec.mjs` 与 **HEAD 中** `app/tests/today-visual-v2.11.11.legacy.mjs` 的 blob 均为 `7bad9f389976cb8b552bb71815496fbf2f56851b`。因此原文件在该提交中确实完整保留，但默认不发现 legacy 文件并不等于回归覆盖保留。审阅期间其他负责人正在修改工作树 legacy 文件，上述等同性只针对 Git HEAD。
4. `PROJECT_PLAN.md` 的 31 行既有工作树差异仍保留，没有混入 RC 提交。

**结论边界**：当前可达提交和 reflog 中未发现独立的 2.11.11 产品修复被排除；但 Git 不保存从未提交的工作树内容。缺少 2.11.11 开始时的完整 patch/源码快照，无法证明所有历史未提交产品差异都逐字保留。旧 `focused-moment-2.12.0-rc.md` 中“没有静默覆盖或丢弃产品修复”的绝对断言证据不足，不能直接继承。要关闭这项不确定性，需要负责人已有的基线 patch 或明确差异清单，而不是读取私人备份。

### 完整 committed diff 范围（main...HEAD）

```text
M app/package.json
M app/pnpm-lock.yaml
M app/scripts/verify-css-order.mjs
M app/src-tauri/Cargo.lock
M app/src-tauri/Cargo.toml
M app/src-tauri/capabilities/default.json
M app/src-tauri/src/commands.rs
M app/src-tauri/src/desktop.rs
M app/src-tauri/src/domain.rs
M app/src-tauri/src/runtime.rs
M app/src-tauri/src/storage.rs
M app/src-tauri/src/timer_engine.rs
M app/src-tauri/tauri.conf.json
M app/src/MainShell.tsx
D app/src/assets/viral-quote-sample.mp3
M app/src/components/AuroraOceanViews.tsx
M app/src/components/BotanicalLibraryViews.tsx
A app/src/components/ContinuationNotePrompt.tsx
A app/src/components/ContinuityBoard.tsx
M app/src/components/EditorialPaperViews.tsx
A app/src/components/FocusPlanControls.tsx
A app/src/components/FocusRecordEditDialog.tsx
M app/src/components/GraphiteConsoleViews.tsx
A app/src/components/ManualFocusRecordDialog.tsx
M app/src/components/NightValleyViews.tsx
A app/src/components/PortableBackupPanel.tsx
A app/src/components/QuickCaptureDialog.tsx
A app/src/components/ThemePicker.tsx
M app/src/components/ThemeSurface.tsx
M app/src/components/TodayDashboard.tsx
A app/src/components/UnifiedTodaySurface.tsx
A app/src/features/records/focus-history.ts
M app/src/features/shell/useMainShellController.ts
M app/src/features/todos/TodoDateGroupList.tsx
M app/src/features/todos/derived.ts
M app/src/features/todos/todo-groups.ts
M app/src/lib/contracts.ts
M app/src/lib/tasks.ts
M app/src/lib/theme-contracts.ts
M app/src/lib/timer.ts
M app/src/styles/10-trail-reference.css
M app/src/styles/30-measured-surfaces.css
A app/src/styles/80-continuity-workflow.css
M app/src/styles/index.css
M app/tests/app.spec.mjs
A app/tests/today-visual-v2.11.11.legacy.mjs
M app/tests/today-visual.spec.mjs
A docs/maintenance/focused-moment-2.12.0-continuity.md
A docs/maintenance/focused-moment-2.12.0-rc.md
A docs/v2.12.0/RELEASE_NOTES.md
```

工作树必须另外核对 `git diff HEAD`、`git diff --cached` 和 `git status --short -uall`，不能只用三点 diff。12:13 左右观察到并行修改：`PROJECT_PLAN.md`、commands/runtime/storage/timer_engine、controller、app.spec、legacy/当前 visual；另有既有未跟踪 `docs/context_summary_20260919_rc_audit.md`，再加本轮五个文件。该清单随并行工作变化，交接后运行 `node scripts/rc-source-audit.mjs` 获取即时清单。

## 原生脚本审阅与自动化可行性

现有脚本真正证明的是：EXE 副本哈希一致、窗口句柄出现、隔离 canonical/WebView2 目录建立、fresh launch 不建立旧工作目录数据、合成 v2 state/runtime 迁移的两个哨兵字段和旧文件哈希/迁移备份目录。不证明页面加载成功、用户能操作按钮、备份内容完整或正常退出。

新增 CDP 方案采用 [Playwright 官方 WebView2 方法](https://playwright.dev/docs/webview2)：通过 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 指定调试端口，使用 `chromium.connectOverCDP()` 连接已有 WebView2。没有启动 Chromium mock、Vite 服务或替换 Tauri IPC。

补齐控制：

- `-CdpInteraction` 是显式开关，必须传入 `-ProvenancePath`。启动前核对 release、manifest 的 clean build-input 标志、HEAD/branch、当前输入指纹、candidate/root/source hash。
- 每次分配本机端口；连接前确认 listener 仅 loopback、拥有隔离 WebView2 profile，且属于本次应用子进程链。端口竞争、无法确认归属均失败退出，不连接其他浏览器。
- 只在 GUID 临时目录写合成数据，覆盖子进程 LOCALAPPDATA/APPDATA/TEMP/TMP/USERPROFILE/HOME/WebView2 目录；测试先检查 realpath 在临时根下，且初始 todo/record 均为空。
- Playwright 使用独立 config，单 worker、零 retry；证据进入 `artifacts/qa/frontend/<同一native-run-id>/<phase>/`，截图/JSON 均通过 `test.info().outputPath()`。每阶段独立子目录，避免下一次Playwright调用清空前一阶段证据。PowerShell 报告仍在 `artifacts/qa/native/<同一run-id>/report.md`。
- 更新环境变量写法为兼容 Windows PowerShell 5.1 的 `EnvironmentVariables`；阻止名称为 `focused-moment` 或 `Focused Moment` 的已有进程；启动阶段异常也回收已创建的子进程；错误写入 FAIL 报告；删除合成 canonical 目录前验证其绝对路径归属。
- 脚本不负责构建，不更新根 EXE，不运行安装器。日常计时/记录/mini通过真实 WebView UI 操作并读取 Rust 断言；备份和音效配置单独标注真实 native IPC，不能当作对应 UI/OS picker 通过。

### 追加适配：native dialog、IPC rollback 与多进程阶段

主负责人将 PortableBackup 路径改为只读并删除浏览器fallback，测试已移除路径fill和模拟点击导入确认的旧方案；不改变只读属性、不注入对话框返回值、不模拟OS picker。页面只断言路径只读；备份路径由隔离测试直接传给真实native invoke。

追加核对：`exportPortableBackup` 已增加写入/覆盖目标文件的 `window.confirm`。当前IPC导出不经过controller，因此**不验证覆盖确认，也不验证native dialog选路径或同一个readonly输入的回填**。这两类证据均为MANUAL/NOT RUN；后续UI导出用例须先真实选路径，再显式accept确认，取消路径另测，不能把IPC成功当作UI成功。

旧备份源版本修复已在源码核实：`read_external_backup`迁移clone做校验，但返回original，交给apply保留迁移来源。新增IPC回归分别构造v1/v2合成文件，检查preview的原format/schema、migrationNeeded与只读性，再检查真实import的`migratedFromFormatVersion`分别为1/2、落盘schema为3且源文件字节不变；v3导入该字段必须为null。该新增回归尚未在native执行。

备份验证使用本次合成UI数据导出的真实v3备份A，复制成差异化合成备份B（事项标题、记录时长、提示音均不同）；真实导入B后核对Rust与落盘，读取命令返回的rollback文件并验证它包含A的state/runtime，再真实导入该rollback恢复A。另测仅恢复记录不改变todos/preferences/focusPlan/runtime，以及非法JSON导入拒绝后Rust/磁盘不变。这是**IPC导入及可用rollback文件闭环**，不是OS picker、确认UI、磁盘写失败自动回滚或custom-audio验证。

mini默认行为先读`autoMiniOnStart=false`，用`EnumWindows/GetWindowThreadProcessId/IsWindowVisible`对本次EXE进程采样三次，要求主HWND可见且两类mini HWND不可见。之后点击主窗口“迷你工作台”，要求对应HWND可见、连接`todo-float`真实WebView，点击“当前计时”，交替从mini/主窗口暂停和继续，并读Rust/另一窗口UI。此检查验证HWND可见标记，不声称验证遮挡、鼠标穿透、实际物理鼠标命中、拖动或置顶。

启动顺序为`interaction → sound-seed → sound-restart → sound-legacy → 原有v2 migration`。每次先停本次进程并等待属于隔离profile的WebView2退出，离线seed仅写GUID临时canonical数据；启动后重新验证CDP listener归属。sound-seed写`bright_bell`并断言加载，再用真实IPC更新`wooden_tick`；sound-restart不再seed，检查下一进程确实加载已持久化的`wooden_tick`；sound-legacy离线写`viral_quote`，重启检查Rust返回`soft_chime`，再经正常保存确认落盘。三个阶段同时要求soundReminderEnabled=true及原合成todo/records仍在。该legacy断言不证明启动时主动重写文件；只证明读取兼容及正常保存后归一化。

以上全部仍为**NOT RUN**。主负责人仍在开发apply相关逻辑；如最终实际字段/行为改变，应在新构建上按实测修正脚本，不据静态发现宣称闭环已验证。

测试冻结前最后限定补充：静态确认托盘`TRAY_FOCUS_FLOATING_ID`已调用`show_floating_todos`，旧`show_focus_floating`是转到该入口的兼容alias。native用例在正常mini交互后用“返回”关闭它，再调用旧IPC，要求只有一个可见新mini HWND和`todo-float` CDP页面；旧`focus-float`页面及“Focused Moment 专注”HWND均不存在（包括隐藏旧窗）。再通过新mini的“返回”恢复主窗口，避免影响后续用例。正常mini入口会隐藏main，因此既有跨窗用例先以`show_main_window_from_tray` IPC显示main再进行真实按钮交互；此setup不算实际托盘点击验证。

托盘退出静态观察到`emit_to("main", "app-exit-request", ())`，最终由`quit_application`退出；前端flush/ack由Curie继续处理。本脚本不新增退出用例、不触发退出事件，graceful quit及flush失败处理仍为MANUAL/UNVERIFIED。到此冻结本工作单元脚本范围，等最终编译通知后才执行native；新增兼容alias用例同样为NOT RUN。

最后无计时mini用例：静态确认托盘“打开迷你工作台”构建处已移除计时进度enabled限制。interaction结束前通过真实reset IPC建立idle前置条件，重载main后点击mini，要求HWND可见、仅一个已选中的待办tab、合成待办存在、无当前计时tab及暂停/继续/完成按钮，然后返回main；单独保存idle-mini截图。此用例仍NOT RUN，实际托盘点击/菜单可用性仍为MANUAL，不能以主窗口按钮成功替代。

### 原生验收矩阵

“已编写”仅指可执行自动化存在，**本轮所有 native 项均未执行**；不能报告 PASS by contract。

| 用户验收项 | 当前自动化能力 | 仍需补充 / MANUAL |
| --- | --- | --- |
| Release provenance、启动、隔离、v2 legacy migration | 原脚本 + 新来源校验；NOT RUN | 迁移备份完整内容未逐字校验，仅存在性与源文件哈希 |
| 收件箱捕捉 | CDP 点击并验证 Rust todo、空日期和合成落盘；NOT RUN | 安排日期/过期排序仍需 native 补测 |
| 当前事项、精选 | CDP 设置当前、加入一个精选并读 Rust；NOT RUN | 替换、三项上限、删除后的清理仍需补测 |
| 开始、暂停、继续、完成 | CDP 真按钮 + Rust running/link/record；HWND默认mini不出现；NOT RUN | 长时间边界仍待专项 |
| 同一 todo 多轮、不自动完成 | 两个真实短时计时轮次；NOT RUN | 长时间、跨日、休眠边界 MANUAL |
| 停笔书签保存/跳过/继续 | CDP 两轮覆盖；NOT RUN | — |
| 手动记录与修正 | CDP 补录35分钟、改为40分钟，Rust核对；NOT RUN | 日期/title/todo全组合与统计重算未自动覆盖 |
| analytics 今日/累计/streak/best/recent | 本脚本未覆盖 | MANUAL/待 native 专项，不继承 Rust 或 mock PASS |
| mini/锁定/解锁/同步 | 主窗口真按钮打开mini，HWND可见，跨WebView暂停/继续并读Rust/另一窗口；NOT RUN | 锁定/解锁/穿透、拖动、焦点、置顶仍MANUAL |
| 主题 autosave、失败/重试/迟到响应 | 本脚本未注入持久化故障 | MANUAL/受控 native 故障专项；mock不等于native |
| backup export/preview | 真实IPC导出/预览，state文件字节不变；NOT RUN | OS picker open/save、readonly路径回填、UI覆盖确认accept/cancel仍MANUAL |
| import cancel | readonly适配后不模拟路径回填，未覆盖确认UI | JavaScript确认取消及OS文件选择/保存取消均MANUAL |
| 选择恢复/rollback/custom audio | 真实IPC差异导入、rollback文件内容及重新导入恢复、records-only隔离、坏JSON拒绝；NOT RUN | custom audio、磁盘IO失败自动回滚、UI反馈仍MANUAL |
| 页面重载及进程重启 | reload后Rust数据；三个重启阶段验证音效和合成todo/records；NOT RUN | 未验正在运行timer的崩溃/休眠恢复及graceful quit |
| 正常音效配置/viral_quote fallback | bright_bell seed → IPC wooden_tick保存 → restart读取；viral seed → restart soft_chime及正常保存；NOT RUN | 实际听感、音频设备、通知可见性 MANUAL |
| 托盘导航/暂停/继续/退出、第二实例 | 当前 CDP用例未覆盖系统托盘 | MANUAL（UI Automation可后续扩展）；强杀清理不是 graceful quit |

## 版本源与资源只读核对

`node scripts/rc-source-audit.mjs` 检查结果：package.json、Cargo.toml、Cargo.lock 中 focused-moment 包、tauri.conf.json、runtime APP_VERSION、APP_MILESTONE 共六项均为 `2.12.0`。前端 ShellSnapshot 的 version/milestone 来自后端 `bootstrap_shell`，没有额外生产硬编码版本；CDP 用例将把 bootstrap 返回版本和 package.json 再对比。`app.spec` 的 backup mock appVersion 是 `2.12.0`；旧注释/历史文档中的旧版本不应盲目替换。

README 的 `v2.11.10` 表示公开稳定版，当前 RC 未发布，保留是正确的。存在 `docs/v2.12.0/RELEASE_NOTES.md`，本轮未改动。

静态扫描了 123 处相对导入、CSS url、静态资源字符串和 Tauri bundle icons：missing=[]；生产 src 中旧 `viral-quote-sample.mp3` 文件名引用为零。`domain.rs` 的旧 `ViralQuote` 输入归一化到 SoftChime，controller 对未知合成音 key 回退 soft_chime；保留兼容枚举/类型不等于死资源引用。该结论不包含动态拼接 URL、实际音频播放和所有运行时网络加载；不据此删除未引用资产。

旧 manifest `artifacts/builds/local/local-20260919-021638-86e4f18a9b/manifest.json` 记录源码 HEAD `4ab5c04`，clean build inputs，当时 candidate/root hash 为 `5B19FAA331ADDDA763985AFD7D05FBA3956E26EDC1BB9B3C6583CA2EDD5A7E53`。这只是读取历史构建元数据，不是本轮重新验证该 binary，更不是当前动态工作树的证据。

## 已执行验证与交接

### 脚本冻结检查（2026-09-19）

冻结时HEAD为`75351d101d30e24535c02ab37dd320baf2098d86`，branch仍为`codex/focused-moment-continuity`。desktop托盘退出等产品及其他工作树改动尚未提交，本段更新的是执行基线观察，不将上方最初`4ab5c04`审计快照改写成新事实。当前脚本已冻结，不再扩展功能；等待主线程最终commit + clean build和指定manifest。尚未运行应用，native仍NOT RUN。

本次重新执行且通过：四个JS文件`node --check`；Windows PowerShell 5.1解析两个PS脚本；仅编译HWND helper内嵌C#（未调用EnumWindows）；四个phase独立`--list`路由；单worker/零retry及四个不同phase输出路径断言；四类非法run ID加非法phase共五类拒绝；既有Playwright输出护栏；脚本diff whitespace检查。没有运行native测试体、构建或读取真实用户数据。

冻结SHA-256（路径相对`app/`，以当前工作树原始字节计）：

| 文件 | SHA-256 |
| --- | --- |
| scripts/windows-native-smoke.ps1 | `1F5BF2282F1ACACB3A8E4A53BD77DFFDDA2C95BA113A34063BA2DCFD76262946` |
| scripts/native-cdp/playwright.config.mjs | `B7BCCF4A3DAF6C1A357F68DA120037CF5829D42C4906B0499225CC9FC4E92ACD` |
| scripts/native-cdp/interaction.spec.mjs | `52F85A05536C3AB445FF66DCEB9C4F255981BD8A61D267516470825F0F16EA4A` |
| scripts/native-cdp/sound.spec.mjs | `5901C7CE2147DE7F4E8F8D9AB93B4BCD9C13B49AC6B8C7317E14C155879A4ABF` |
| scripts/native-cdp/inspect-windows.ps1 | `8C5EAA02E20AEDF525FB23211B9B8B0E3EC081887663BA8B5F33B14DFB60C960` |
| scripts/rc-source-audit.mjs | `856BAFDCF71A9CCC4A3F28543509BA46045753FDB5A09C44172D01C3750C05E3` |

`PROJECT_PLAN.md`保护哈希仍为`E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。提交时Git可能按仓库规则归一化换行，最终执行以最终manifest指纹匹配为准；不能悄悄修改脚本后继续使用旧manifest。

- Node syntax check：CDP config/interaction/sound通过。
- PowerShell AST parse：windows-native-smoke.ps1及inspect-windows.ps1通过。
- HWND helper 的内嵌C#已通过编译检查，未调用EnumWindows。当前工具环境的PATH不含powershell.exe，因此helper调用改为SystemRoot下Windows PowerShell绝对路径，避免依赖PATH。
- 独立 Playwright `--list`：interaction、sound-seed、sound-restart、sound-legacy四种phase路由均发现对应的单一用例，未启动浏览器/应用；非法phase被拒绝。
- `verify-playwright-output-guardrails.mjs`：唯一输出目录、重复标签隔离、跨worker共享run ID等既有护栏通过。
- 独立config负向检查：路径穿越、绝对路径、空run ID、固定非唯一ID共四类均被拒绝；默认输出根、单worker、零retry断言通过。
- `rc-source-audit.mjs`：六个版本源一致、123处引用无缺失、旧音频文件名无生产引用。
- 指定脚本 `git diff --check` 通过。
- 使用状态核对技能，将当前 Git/源码和用户最新限制优先于旧报告。技能的 Python mtime审计未运行成功（系统 Python 为不可用 WindowsApps alias），已直接核对 Git/源码/文档和保护哈希；未为运行脚本安装软件，未回写只读计划。
- Rust、browser mock 全套、Windows原生、打包均非本轮执行证据。没有以旧报告中的 PASS 替代。

等待主agent最终clean build：由主agent冻结并核对最终源码，按现有交付流程生成匹配的release provenance并通知完成后，直接执行已授权native验证，无需再次请求用户授权；本工作单元不提前执行构建。后续从 `app/` 运行：

```powershell
Set-Location -LiteralPath 'F:\Focused Moment\app'
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File '.\scripts\windows-native-smoke.ps1' -ExecutablePath 'F:\Focused Moment\Focused Moment.exe' -CdpInteraction -ProvenancePath 'F:\Focused Moment\artifacts\builds\local\<final-build-id>\manifest.json'
```

唯一尚待提供的参数是主线程最终manifest路径；不按文件日期自动挑选，不使用旧manifest。命令不会构建；运行前脚本会核对HEAD/branch、clean来源标志、源码指纹及candidate/root/source哈希。依次执行interaction、三个sound/restart阶段和原有合成v2迁移；证据见同一run ID的`artifacts/qa/native`报告与`artifacts/qa/frontend/<run-id>/<phase>`。

CDP第一次实跑可能暴露 WebView2调试策略、选择器或跨窗口行为差异；失败必须保留报告并修正，不能提高重试、改用mock、跳过断言或借旧EXE报告通过。手动矩阵未完成前，不得宣称完整 Windows 原生验收通过。
