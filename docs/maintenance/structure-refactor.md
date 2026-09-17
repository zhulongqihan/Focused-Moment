# Focused Moment structure refactor

状态：已完成（源码/规则最终提交 `e491a75ec24ac1993ec88a7b551c438aa7f4bd77`；根目录 Release 入口已交付）。

## 起始基线

- 真实仓库：`F:\Focused Moment`，分支 `main`，远程 `git@github.com:zhulongqihan/Focused-Moment.git`。
- 本轮开始时 HEAD 为 `024b154465c7886369f2ed2ebdfd9beb960c03ba`；`PROJECT_PLAN.md` 有用户已有未提交修改，开始时 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`，不得覆盖。
- 已完成的 M01、M01-A 和此前实际存在的 M02 交付直接复用；根目录旧 `Focused Moment.exe` 的历史哈希 `9A1985D232CA91508A68A063BF62430C57C999E6CC2CB690C1F6EAF3A171EA9A` 只作历史记录，不作为本轮新包期望值。

## 范围与不变项

- 范围：根目录便携 EXE 交付与 provenance、安全/契约验证支撑、前端 shell/feature/theme contract、CSS 等价拆分、Rust 模块化、文档和产物治理、开发规则自动检查、最终验证与 GitHub 同步。
- 不变：Tauri + Rust + SolidJS 技术栈、五套主题的视觉方向和 DOM/类名契约、数据格式与默认值、Tauri 命令/serde/error/event/lock 语义、真实用户数据和用户备份。
- 明确不做：自动 tag、创建/编辑 GitHub Release、上传资产、运行安装器、全盘清理、`git clean/reset --hard`、修改/暂存/提交/移动 `PROJECT_PLAN.md`。

## 任务状态表

| 单元 | 状态 | 结果 |
| --- | --- | --- |
| R0 基线与保护 | DONE | 保护 `PROJECT_PLAN.md`、用户数据、备份、根入口和未知忽略文档 |
| R1 根目录 EXE 交付 | DONE | `package:local`、输入指纹、候选校验、阶段日志、备份/回退和 7 个 fixture |
| R2 安全验证支撑 | DONE | 44 命令、43 前端 invoke、3 事件契约；隔离 Windows native smoke |
| R3 前端职责与中性契约 | DONE | controller、共享派生逻辑、待办分组/列表和主题中性 props |
| R4 CSS 等价整理 | DONE | 9 段有序 CSS 入口；5×5 主题/视图截图对照，23/25 byte-exact，其余仅极小渲染差异 |
| R5 Rust 模块化 | DONE | `domain.rs`、`timer_engine.rs`、`commands.rs`、`desktop.rs`，保留 runtime crate path |
| R6 文档与产物治理 | DONE | `architecture.md`、本记录、README/AGENTS、精确 docs ignore 和 `.release`/`output/qa` 边界已落地 |
| R7 开发规则自动检查 | DONE | `pnpm verify`、结构负例、原生契约、交付 fixture、Rust 检查已接入 CI |
| R8 最终集成交付 | DONE | Release 根 EXE、最终验证、隔离 native smoke、提交推送和 CI 追踪已完成 |

## 目录/职责迁移表

| 原职责 | 当前入口 | 约束 |
| --- | --- | --- |
| MainShell 状态/IPC/生命周期 | `src/features/shell/useMainShellController.ts` | MainShell 保留组合、导航和窗口分支 |
| 跨主题待办分组和列表 | `src/features/todos/todo-groups.ts` / `TodoDateGroupList.tsx` | 复用 DOM/class，不引入新视觉功能 |
| 日期/记录/todo 派生逻辑 | `src/features/shared/`、`features/records/`、`features/todos/` | 不反向依赖 app 或具体主题 |
| 原始 App.css 级联 | `src/styles/*.css` + `src/styles/index.css` | 保留原顺序、specificity、资源和动画；`src/App.css` 兼容入口 |
| Rust 计时/命令/桌面 | `src-tauri/src/{domain,timer_engine,commands,desktop}.rs` | `runtime.rs` 仍是 crate path、builder/setup/注册/生命周期 |

## 提交与验证摘要

已完成并推送到 `origin/main` 的本轮独立提交：

1. `80b4f10` `build: make local executable delivery verifiable`
2. `384fe39` `test: add native contract and isolation checks`
3. `b40b6a5` `refactor: isolate neutral theme contracts`
4. `77d0c16` `refactor: extract shell derived state`
5. `b8b84d0` `refactor: separate shell controller from composition`
6. `de21a41` `refactor: split ordered application styles`
7. `b1f54ef` `refactor: extract timer domain contracts`
8. `a4c17a8` `refactor: isolate timer engine runtime`
9. `8abc7a9` `refactor: move runtime commands into module`
10. `3fd5141` `refactor: isolate desktop window runtime`
11. `463aac2` `chore: add repository governance and verify entry`
12. `e491a75` `fix: preserve git status paths in delivery provenance`

## 最终验证证据

- `pnpm verify`：通过；包括 TypeScript、CSS canonical 顺序、结构层边界及负例、44 条命令/43 个前端 invoke/3 个事件契约、7 个本地交付 fixture，以及 Rust fmt/check/35 个单测。
- `pnpm build`：通过；Vite 转换 2073 modules。仅保留既有 chunk size 提示和 Rust 未使用 re-export warning，未改变行为或放宽断言。
- Playwright：`146 passed`，唯一 run 目录为 `output/qa/frontend/r8-final-20260918-inv-mu5wa0rw-27144-3875e8ba-a75c-4c90-820c-b1273fe407b0`；覆盖五套主题、主要五页面、响应式/高 DPI、计时、待办、记录、设置、悬浮工作台和 adversarial 矩阵。
- CSS 对照：基线 `output/qa/frontend/baseline-r0-20260918-inv-mu5sk79i-31584-2c098bf6-d3d1-4bf7-906b-cd3b23584824`，重构后 `output/qa/frontend/css-after-r4-20260918-inv-mu5unrf4-32788-e2862909-36d4-4ae5-b829-41c4efa5aeff`；25 个截图中 23 个 byte-exact，2 个 Editorial Paper focus/todos 截图仅有极小渲染差异，未出现缺失、布局或断言失败。
- Rust 独立证据：`cargo fmt --check`、`cargo check --locked --offline`、`cargo test --locked --offline` 均通过，35/35 单测；browser mock、Rust 和 Windows native 结果分别统计，不互相替代。
- Windows native smoke 报告：`output/qa/native/windows-native-20260918-031758-6b07aef8bd/report.md`；仅验证隔离副本启动可见窗口、精确副本哈希、隔离存储/WebView2、旧路径防回写、合成旧数据迁移和清理。托盘、悬浮/解锁窗口、备份 UI、音频、通知和用户主动退出仍属于未自动化的原生手工范围。

## 根目录交付 provenance

- 命令：`pnpm package:local`，未运行安装器、`package:release`、`release:github`、`release:ship`，未创建 tag/Release 或上传资产。
- build id：`local-20260918-031632-7e767f2690`；版本 `2.11.10`；构建 profile `release`；真实候选 `src-tauri/target/release/focused-moment.exe`。
- 根入口：`F:\Focused Moment\Focused Moment.exe`；候选和根入口长度均为 `23,864,320` bytes，SHA-256 均为 `FD757D77D44187C8F47219E25DC8AFEA821940313E19BC19BF95CC0ECFE338D1`。
- manifest：`.release/local/local-20260918-031632-7e767f2690/manifest.json`；输入文件 147 个，输入指纹 `9E744326DAFF66A3F4B108C2A8E1345ADE975B9EB09097D54DD9CF7EEB1DE3A0`。
- 源码来源：HEAD `e491a75ec24ac1993ec88a7b551c438aa7f4bd77`、分支 `main`；构建时唯一 dirty path 是受保护的 `PROJECT_PLAN.md`，`relevantBuildInputDirty=false`。因此根 EXE 对应该 HEAD 的应用构建输入，且未把用户计划内容编入交付输入。
- 上一个入口 SHA-256 `D46821260D595BE41F7287ABA15488422E7B21413DA53E8519049F6E2E9E24A1` 已保存在 `.release/archive/local-20260918-031632-7e767f2690/Focused Moment.exe`，可回退；固定根入口保留。

## 已知边界与残留提示

- Rust 模块化后仍有未使用 `pub(crate) use` warning；它不影响 fmt/check/test，清理会扩大本轮行为无关的重构范围，留作后续独立清理。
- CI 对应的最终 GitHub Actions run 以推送后的 Checks 页面为准；本地证据不替代远程 CI 结果。
- 旧根目录版本化 EXE/Setup 没有被证明为本轮生成物，因此保留不删除；当前固定入口和历史回退副本均保留。

## 最终交付

## 保护与后续入口

- `PROJECT_PLAN.md` SHA-256 仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`，工作树仅保留其原有 ` M PROJECT_PLAN.md`，未修改、暂存、提交或移动；真实用户数据目录和两份用户备份未读取内容、未迁移、未覆盖。
- 后续快速检查：`pnpm verify`；前端视觉：`pnpm test:frontend`；Windows 隔离原生：`pnpm native:windows -- -ExecutablePath 'F:\Focused Moment\Focused Moment.exe'`；根入口交付：`pnpm package:local`。
- 规则入口：`AGENTS.md`、`README.md`、`docs/architecture.md`、本文件；`pnpm verify` 不启动真实应用、不构建、不制作安装包、不发布，native smoke 单独执行。

本文件不会替代 `PROJECT_PLAN.md`，也不会记录真实用户数据内容。
