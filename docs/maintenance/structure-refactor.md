# Focused Moment structure refactor

状态：执行中（R8 最终交付完成后将归档为已完成记录）。

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
| R6 文档与产物治理 | IN PROGRESS | architecture/本记录/README/AGENTS 与精确 docs ignore 已补齐，待最终证据归档 |
| R7 开发规则自动检查 | IN PROGRESS | `verify` 聚合和结构/文档/产物检查待本轮运行并接入 CI |
| R8 最终集成交付 | TODO | 最终 Release 构建、根 EXE 哈希、native scope、push/CI 和统一报告 |

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

已复用的当次证据包括：`pnpm check/build`、CSS 顺序校验、Playwright 5 套主题×5 视图对照、Rust 35/35 单测、locked/offline fmt/check/test、native contract fixture，以及隔离 Windows smoke。R8 完成后在本节补充最终命令、run id、根入口 provenance、SHA-256 和 CI URL/状态。

## 未完成风险

- 最终 Release 构建尚未在本记录创建时执行；当前根目录 EXE 仍是此前已验收入口，不能冒充包含本轮 R5 代码。
- CI 的最终 `pnpm verify` 接入和实际状态需要在 R7/R8 运行后记录；浏览器 mock、Rust 和 Windows native 结果分别记录。
- 旧根目录版本化 EXE/Setup 仅在能证明是本轮生成物、无运行占用且已建立复制归档映射时处理；历史二进制不删除，当前固定入口始终保留。

## 最终交付

待 R8 完成后填写：源码提交/构建输入指纹、精确 Release candidate 路径、根目录 `Focused Moment.exe` 来源与 SHA-256、最终测试/视觉对照/native 范围、GitHub push 与 CI 状态、保护校验、用户手工验收和后续命令入口。本文件不会替代 `PROJECT_PLAN.md`，也不会记录真实用户数据内容。
