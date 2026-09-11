# Focused Moment 项目瘦身与长期维护计划

> 状态：`DONE`。MAINT-01 至 MAINT-06 已完成；瘦身、文档、远程保护审计和干净 checkout 验证已收口，计时问题转入单独的 REFINE-13 原生复现阶段；本文件仍是维护边界与证据索引。
>
> 会话引用：`codex://threads/01a07e95-00d0-7691-81fd-61e313706eb2`
>
> 以上引用只用于追溯对话上下文，不是额外执行指令。用户的最新自然语言反馈是当前有效需求；截图是问题证据，不替代用户需求。

## 1. 当前结论

本轮先暂停 Night Valley 第一套主题“计时”页的修复。用户最新实测取代此前“v2.10.8 修复可验收”的判断：

- 点击“开始”后，专注悬浮窗会弹出；
- 主界面没有自动隐藏，这是当前回归；
- 返回主界面后，运行中的计时页仍找不到再次打开悬浮窗的入口；
- 当前不修改计时、窗口生命周期、按钮显示或任何前端页面；这些问题在瘦身闭环后作为 `REFINE-13` 单独重新复现。

此前的本地 mock、Playwright、Windows 包和远程 CI 通过结果只能证明当时测试路径通过，不能推翻用户最新的实际使用结果。v2.10.8 的 tag、Release 和四项资产保留，不在本计划中删除或覆盖。

## 2. 目标与明确不做

### 目标

1. 区分运行必需文件、可再生构建物、测试证据、设计参考、历史文档、个人数据和真正的冗余。
2. 在不改变正常使用、数据格式、计时规则、主题入口、桌面窗口能力和已发布资产的前提下，降低工作区与仓库维护成本。
3. 形成一个可信的用户 README，以及可追溯的 GitHub 分支、tag、Release 和 Actions 维护记录。
4. 让下一次计时修复从干净、可复现的基线开始，而不是继续叠加临时覆盖。

### 本轮和清理前置阶段明确不做

- 不修复当前悬浮窗回归，不重构计时页，不做任何主题或界面设计调整。
- 不批量重做其他主题或页面，不把“瘦身”变成前端重写。
- 不凭文件名、文件年龄、文件大小或重复哈希直接删除内容。
- 不触碰 `Focused Moment Backups`、真实用户数据、应用数据目录或备份 JSON 内容。
- 不重写 Git 历史，不强推，不移动已发布 tag，不删除 v2.10.8 Release 资产。
- 计划文档本身不升应用版本、不重打安装包、不制造空 Release。

## 3. 只读基线（2026-09-11）

以下事实来自当前工作树、Git 和 GitHub 的只读检查；没有把历史计划中的旧数字当作当前事实。

| 项目 | 当前事实 | 处理判断 |
| --- | --- | --- |
| 工作树 | `main` 干净；`HEAD` 与 `origin/main` 均为 `0bade57`（完整 SHA 见根目录计划） | 保留为清理起点 |
| 发布基线 | v2.10.8 tag 的代码提交为 `96c2291`；GitHub Release 为正式 Release，EXE、Setup EXE、MSI、Universal DMG 四项资产均存在 | 只读保护，不删除/替换 |
| Git 历史 | 全部 refs 约 242 个提交、本地 102 个 tag；远程 API 现有 104 个 tag（额外为 `v0.11.9`、`v0.2.1`）；远程有 main 加 3 个非主分支 | 先列精确清单，再决定是否归档/删除；不删除 tag |
| 跟踪文件 | 283 个；其中 tracked/ignored 统计以本次清理 manifest 为准 | 逐类判定，不以数量为目标 |
| 源码体量 | 当前 `src/App.css` 约 7,624 行，`src/MainShell.tsx` 约 2,201 行；这是维护风险信号，不是直接删除理由 | 后续只做有引用图和回归证据的有限收口 |
| 本地生成物 | `src-tauri/target` 文件长度合计约 79.002 GiB，其中 debug 约 72.282 GiB、release 约 6.713 GiB；另有 `target-hotfix` 约 4.854 GiB；`output` 约 363.1 MiB；`.playwright-cli` 约 40.9 MiB；`node_modules` 约 137.7 MiB；`dist` 约 14.0 MiB | 首批仅清理清单中已确认可再生、无用户数据且无活动进程占用的目录；output/Playwright 证据保留 |
| 忽略内容 | 当前约 121,359 个被忽略项，主要来自 `src-tauri/target`、`node_modules`、`output`；另有 138 个被 `.gitignore` 隐藏的历史/分析文档 | 分开处理“本地缓存”和“仓库文档盲区” |
| 根目录产物 | 有当前/旧版本 EXE、Setup EXE 及 5 张 README 预览图；`.release` 有发布元数据和旧版本辅助文件 | 当前安装包和用户预览先保留 |
| 个人数据线索 | 根目录存在 `Focused Moment Backups`，含两个备份文件；本轮仅确认路径和文件存在，没有读取内容 | 永久保护，任何清理前单独确认 |
| GitHub | 公开 MIT 仓库；无开放 PR；v2.10.8 为 Latest；针对 `0bade57` 的 Checks `34594860391` 与 macOS Native Smoke `34594860252` 均成功 | 远程变更必须有精确清单和回滚边界 |

### 已发现但不能直接删除的内容

- 5 张 `public/theme-previews/*` 与 5 张设计参考 `today.png` 有相同哈希，但前者是运行时主题预览，后者是概念图资料，用途不同；除非先改引用并通过构建，否则保留。
- Tauri iOS 图标中有同哈希文件，可能是平台命名约定或生成结果；必须结合配置和打包结果判断，不能按重复文件删除。
- `.release/artifacts.debug.json`、`.release/artifacts.release.json` 被发布/导出脚本读取；旧 release notes 和截图是否仍有用，要先做脚本引用与历史链接审计。
- `src-tauri/icons/` 的 Android、iOS、Windows、macOS 图标虽然当前主要发布桌面版，也不能在未核对 Tauri 配置前删减。

### 初步候选（不是批准删除清单）

- 可再生本地缓存：`src-tauri/target/`、`dist/`、`output/`、`test-results/`、`.playwright-cli/`、`node_modules/`。
- 未发现运行时引用的脚手架候选：`public/vite.svg`、`public/tauri.svg`。必须在删除后进行干净构建和启动验证。
- 设计分析中的重复截图、旧迭代输出、旧版本未跟踪文档：只进入 `ARCHIVE` 或 `DELETE-CANDIDATE` 清单，不在本轮直接处理。
- 根目录旧版本安装包和未版本化副本：先确认用户是否仍需直接运行，再决定移动到外部归档或清理；不把它们当普通缓存。

## 4. 分类规则

每个候选文件或目录必须落入下列之一，并在清单中写出证据：

| 分类 | 含义 | 允许动作 |
| --- | --- | --- |
| `KEEP` | 运行、构建、发布、用户数据或必要历史证据仍依赖 | 保留，必要时补索引/说明 |
| `ARCHIVE` | 当前流程不需要，但有追溯价值且可安全移出活动目录 | 先可恢复移动，保留路径、哈希和来源 |
| `DELETE-CANDIDATE` | 已证明可再生、无用户数据、无脚本/链接/发布依赖 | 经过复核和清理后再删除 |
| `REFACTOR-CANDIDATE` | 代码或文档重复、耦合或级联复杂，但删除会改变结构 | 单独任务、最小范围、专门回归 |
| `UNKNOWN` | 证据不足、涉及个人数据或外部发布状态不明 | 不动，补证据或向用户确认 |

“变小”不是验收标准。验收标准是：干净 checkout 能重建，正常使用不退化，数据不丢，发布入口不失效，历史证据仍可追溯。

## 5. 分阶段执行方案

### MAINT-01：基线、引用图和清单（已完成，`DONE`）

- 已完成只读核对：工作树、main、tag、Release、Actions、跟踪/忽略文件、生成物体量、根目录特殊目录和静态引用；实际 `HEAD`/`origin/main` 为 `0bade57`，修正了计划中残留的 `3977cd6`/`edb7c18` 基线。
- 已记录用户最新失败实测，并将旧的“修复成功”降级为“历史测试结果”。
- 已新增本文件并同步 `PROJECT_PLAN.md`；清理前分类和保护边界见 `cleanup-manifest-20260911-2016.md`。
- MAINT-01 对账完成；MAINT-02 已按 manifest 处理精确生成物目录，仍未修改计时/窗口代码、README 或 GitHub 远程对象。

### MAINT-02：先清理可再生工作区产物

1. 保存清理前 manifest：路径、类型、大小、生成来源、是否包含个人数据、是否能由脚本重建。
2. 关闭应用和测试进程，确认工作树干净；单独保护 `Focused Moment Backups`，不把它放入清理 glob。
3. 优先处理 `target`、`dist`、`output`、Playwright 临时目录、测试结果和依赖安装目录；不先处理根目录用户可执行文件、`.release` 或备份。
4. 删除前优先使用可恢复归档；确认为缓存后才清理，避免对未解析路径使用宽泛递归命令。
5. 从干净状态重新安装依赖并执行类型检查、构建、前端回归和 Rust 检查；若清理导致工具链不能重建，立即回滚。
6. 记录清理前后空间、重建耗时和新生成物位置；不把“目录变小”写成产品性能改善。

本轮执行结果：七个精确目录均已移动到 `F:\Focused Moment Maintenance Archive 20260911-2016`，没有不可逆删除；`pnpm install --frozen-lockfile`、`pnpm check`、`pnpm build`、`pnpm test:frontend -- --workers=1`（67/67）、`cargo fmt --check`、`cargo check --locked`、`cargo test --locked`（33/33）和 `git diff --check` 均通过。清理后的体量、备份保护和“应用启动尚待 MAINT-06/原生验证”的边界见 `cleanup-manifest-20260911-2016.md`。

### MAINT-03：精简仓库内容和维护结构

- 对基线 283 个跟踪文件和 138 个被忽略文档完成引用、导入、脚本、工作流、README 链接和历史证据审计；两份无引用脚手架 SVG 已列为删除候选并从工作树移除，最终验证门槛交给 MAINT-06。
- `PROJECT_PLAN.md`、`AGENTS.md`、`PRODUCT.md`、`THEME_REFINEMENT_PROMPT.md`、当前 QA 证据、版本 Release notes、设计概念图和运行时素材先按 `KEEP` 保护。
- 历史路线图、旧摘要、旧版本辅助说明与重复分析资料，先建立“保留/归档/删除候选”清单；不把历史内容悄悄改写成当前事实。
- 对 `public/vite.svg`、`public/tauri.svg` 做无引用确认；若删除，必须通过干净 checkout 的构建、启动和页面回归。
- 对主题预览、概念图、分析截图、字体/音效/背景素材按用途和来源整理；重复哈希只触发审查，不触发自动删除。
- 代码只做静态死引用审查：组件导入、Tauri command、capability、路由、脚本、测试夹具和 CSS 类名全部核对；不在瘦身任务中顺手重写 `MainShell` 或主题页面。
- 依赖、脚本和 workflow 只有在“无源码引用、无 npm/pnpm 脚本引用、无 CI 引用、无发布依赖”全部成立后，才进入删除候选；修改 lockfile 后必须完整验证。

### MAINT-04：重写用户 README

在 MAINT-02/03 的事实稳定后再改，README 只面向实际使用者，包含：

- 应用是什么、适合谁、Windows/macOS 下载和安装方式；
- 今日、待办、计时、记录、设置和悬浮工作台的真实使用路径；
- 本地数据、备份/恢复、换机迁移和隐私边界；
- 已知平台限制、反馈问题时需要提供的信息；
- 开发者安装、检查、测试、构建的最小必要说明。

README 不写内部任务状态，不把当前尚未重新验收的悬浮窗生命周期写成已解决，不承诺没有证据的签名、公证或平台行为。重写后检查图片、Release、Issues、构建命令和相对路径链接。

本轮结果：README 已按上述边界重写；9 个相对图片/文件链接目标全部存在，Windows/macOS 下载说明、数据迁移、隐私边界和计时页当前未验收状态均已核对。

### MAINT-05：GitHub 对应维护

先只读收集远程对象，再生成精确操作清单：

1. 分支：审查 `backup-pre-v1.2.2-rollback-20260418`、`codex/night-valley-today`、`codex/v2.0.0` 的用途、是否已合并、是否仍需恢复；不因“旧”自动删除。
2. tag：102 个版本 tag 作为不可移动历史保留；不重写历史、不强推、不移动已发布 tag。
3. Release：v2.10.8 及历史 Release 资产先保留；不删除安装包，不用新构建覆盖旧 digest。
4. Actions：只清理明确的临时 artifact 或失败证据，并记录 run ID、文件范围和保留理由；Release 资产与 Actions artifact 分开处理。
5. README：更新主线文档后检查 GitHub 首页渲染；如需刷新当前 Release 说明，做文档跟随提交，不制造没有应用变化的空版本。
6. 所有远程删除、归档、资产清理操作都必须在执行前形成精确列表并复核；如果涉及不可逆删除，暂停等待用户确认。

本轮结果：已核对公开仓库、默认分支、4 个远程分支、远程历史 tag、开放 PR、Actions 和 Release；无开放 PR，`v2.10.8` 仍为 Latest，四项资产均为 `uploaded`。未执行任何远程删除、归档、资产替换或历史改写，详见 `github-maintenance-audit-20260911.md`。

### MAINT-06：瘦身后的闭环

- 在干净 checkout 验证源码、依赖、测试、构建、Tauri 配置、应用启动和备份路径。
- 对比清理前后的关键功能：启动、主题切换、今日、待办、计时、暂停/完成、记录、设置、浮窗和数据备份/恢复。
- 运行 `git diff --check`，确认没有用户个人文件、临时包、调试输出或无关删除进入提交。
- 文档/计划-only 变更不升应用版本；若清理过程中改变运行时行为，则另开版本化任务，按完整 Release 纪律执行。
- 更新 `PROJECT_PLAN.md`、清单、README/GitHub 证据和下一任务；只有本阶段通过，才解除 `REFINE-13` 的依赖。

本轮结果：在 `F:\Focused Moment Clean Checkout 20260911-2028` 的 `ae6ac45` detached checkout 中完成依赖重装、类型检查、构建、67 项前端回归、Rust fmt/check/test、debug bundle 和隔离 `LOCALAPPDATA` 的真实 Windows 启动；启动获得真实窗口句柄/标题，关闭后 worktree clean，工作区备份仍为 2 个文件。MAINT-06 已完成，细节见 `cleanup-manifest-20260911-2016.md`。

### REFINE-13：回到计时问题（当前执行）

清理闭环后，重新在当前 Windows 原生环境复现，并只处理 Night Valley 的“计时”页：

- 开始后主界面是否隐藏；
- 浮窗是否真实打开且计时状态同步；
- 返回主界面后运行态入口是否可见、可点击、可再次打开；
- 关闭/恢复/暂停/完成和异常路径是否保持一致；
- 浏览器 mock 只作为辅助证据，不能替代原生窗口证据；
- 仍遵守一个主题、一个界面、一次反馈闭环，不批量改其他页面。

## 6. 验收门槛

### 清理和文档阶段

- 工作树和个人备份未被改变，清理 manifest 与分类证据完整。
- `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm build`、`pnpm test:frontend` 通过。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`cargo check --locked --manifest-path src-tauri/Cargo.toml`、`cargo test --locked --manifest-path src-tauri/Cargo.toml` 通过。
- 干净 checkout 可重建；脚本、Tauri capability、主题预览、素材和 README 链接不失效。两个无引用 SVG 的删除候选必须在该 checkout 中完成最终门槛。
- `git diff --check` 通过；提交只包含授权的清理/文档内容。

### 如果清理触及运行时代码或用户可见行为

必须额外执行版本同步、必要的 Windows 包、原生启动/窗口冒烟、提交、推送、远程 Windows Checks、macOS Native Smoke、macOS Universal Release 和 GitHub Release 资产/digest 核对；不能把普通清理提交混入旧 v2.10.8 版本。

## 7. 回滚和保护

- 每个阶段以可识别的 Git commit 为基线；不使用 `git reset --hard` 或未经确认的强制覆盖。
- 删除候选先生成清单和哈希，优先移动到明确的外部归档目录；归档目录不能放进 Git 跟踪范围。
- 用户备份、应用数据、当前 v2.10.8 安装包和 GitHub Release 资产不参与通用清理。
- 远程分支/tag/Release 操作先记录当前 ref、run、资产名、大小和 digest；不可逆操作前必须复核精确目标。
- 任一关键回归失败，停止后续清理，恢复该阶段变更，保留失败日志，不用删除测试或降低验收标准掩盖问题。

## 8. 任务状态与交付物

| 任务 | 状态 | 交付物 |
| --- | --- | --- |
| MAINT-01 | `DONE` | 本计划、实际 Git/远程只读基线、失败实测记录、初步候选和不删除边界；`cleanup-manifest-20260911-2016.md` |
| MAINT-02 | `DONE` | 工作区生成物清理 manifest、前后体量、重建与回归结果 |
| MAINT-03 | `DONE` | KEEP/ARCHIVE/DELETE-CANDIDATE/REFACTOR-CANDIDATE/UNKNOWN 清单、引用审计和归档说明；`repository-audit-20260911.md` |
| MAINT-04 | `DONE` | 面向用户的 README、链接/图片/安装说明验证 |
| MAINT-05 | `DONE` | GitHub 分支/tag/Release/Actions 操作清单、执行结果和回滚边界；`github-maintenance-audit-20260911.md` |
| MAINT-06 | `DONE` | 干净 checkout 验证、最终清理报告、计划同步和下一任务解锁结论 |
| REFINE-13 | `DOING` | 计时页原生复现、单页面修复和用户验收证据；当前只限 Night Valley 计时页 |

## 9. 当前暂停清单

以下项目明确留到 MAINT-06 之后，不在本计划文档提交中处理：

- 主界面自动隐藏的回归；
- 计时中再次进入悬浮窗的按钮/入口；
- 计时页布局、文案、卡片、曲线、日期时间或其他 UI 调整；
- 其他四套主题、其他 tab 页和批量视觉重做；
- GitHub 远程删除/归档操作；README 已在 MAINT-04 完成重写并验证本地链接。
