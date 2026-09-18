# Focused Moment architecture

这份文档是长期的目录职责入口。一次性的源码重构记录在 [`maintenance/structure-refactor.md`](./maintenance/structure-refactor.md)，本次外层工作区迁移记录在 [`maintenance/workspace-migration.md`](./maintenance/workspace-migration.md)，不把 `PROJECT_PLAN.md` 变成提交材料。

## Workspace boundaries

- 仓库根 `F:\Focused Moment` 只保留 Git/CI/许可证、README、AGENTS、正式文档入口、受保护计划和固定可测试入口 `Focused Moment.exe`。
- `app/` 是唯一应用工程根；所有前端、Rust/Tauri、资源、测试、脚本、配置、锁文件、依赖和中间缓存都从这里解析。
- `docs/` 只放正式产品、开发、架构、有效计划和提示词；`artifacts/` 放当前构建/测试证据；`archive/` 放确认身份的历史材料和恢复副本；`local/` 只放明确本机私有资料。
- 构建脚本区分 `workspaceRoot`、`appRoot`、`artifactsRoot`、`archiveRoot` 和固定根 EXE，不通过兼容副本或 Junction 维持旧的根工程假象。

## Product boundaries

- `app/src/App.tsx` 负责应用启动；`app/src/MainShell.tsx` 负责页面组合、导航和窗口分支。
- `app/src/features/shell/useMainShellController.ts` 负责跨页面状态、Tauri 生命周期、IPC 刷新和动作协调。
- `app/src/features/todos/`、`app/src/features/records/` 和 `app/src/features/shared/` 只放可复用的领域行为与派生计算；它们不能反向依赖应用壳或具体主题。
- `app/src/lib/` 放前端与原生之间的类型、调用和中性契约；`app/src/lib/theme-contracts.ts` 不包含主题名称或主题实现。
- `app/src/components/` 放主题适配和共享视觉组件。五套主题可以共享中性契约与待办列表，但不互相导入。
- `app/src/styles/index.css` 按原 `App.css` 的级联顺序引入分段样式；`app/src/App.css` 保留为兼容入口，不在这里重新设计主题。

## Native boundaries

- `app/src-tauri/src/runtime.rs` 是 Tauri library crate path 和运行入口。它保留 builder、setup、窗口生命周期和完整 `generate_handler!` 注册清单，不使用 `include!`。
- `app/src-tauri/src/domain.rs` 放计时偏好、提醒类型和限制常量；`timer_engine.rs` 放计时状态、运行态恢复、持久化协调和纯计时核心。
- `app/src-tauri/src/commands.rs` 放数据、备份和计时 Tauri 命令；`desktop.rs` 放主窗口、托盘、悬浮窗口和桌面命令；`storage.rs` 只处理本地状态/运行态/用户备份文件。
- 命令、serde 字段、默认值、中文错误、事件名称和 `Mutex` 锁语义属于兼容面。改变它们必须同时更新契约测试和隔离原生证据。

## Data and artifact boundaries

- Windows 真实数据默认位于 `%LOCALAPPDATA%\\FocusedMoment`；macOS 默认位于 `~/Library/Application Support/FocusedMoment`。验证脚本只使用临时隔离目录，不读取、迁移、清空或覆盖真实数据。
- 根目录 `Focused Moment.exe` 是唯一固定的直接测试入口。进入 `app` 后运行 `pnpm package:local`，真实 Release 候选来自 `app/src-tauri/target/release/focused-moment.exe`，输入指纹、源码锚点、哈希和回退副本分别写入 `artifacts/builds/local/<build-id>/` 与 `archive/executables/local/<build-id>/`。
- `artifacts/qa/<class>/<unique-run-id>/`、`app/src-tauri/target/` 和 `app/dist/` 是本地产物；它们不能被提交。旧历史二进制只保存在 `archive/`，并通过额外映射记录原始路径和校验值。
- `PROJECT_PLAN.md`、用户备份、真实数据、未知未跟踪文件和本地营销/私人资料不属于本轮源码交付。

## Verification entry points

```text
cd app && pnpm check               TypeScript
cd app && pnpm verify              静态/契约/fixture/Rust 聚合，不构建、不启动、不发布
cd app && pnpm test:frontend       Playwright 浏览器 mock 流程
cd app && pnpm test:native-contracts 前端 invoke / Tauri 注册 / 事件契约与负例
cd app && pnpm native:windows      隔离 Windows 原生窗口、存储、WebView2、托盘 smoke
cd app && pnpm package:local       真实 Release --no-bundle 根入口交付与 provenance
cd app && cargo fmt/check/test --locked Rust 编译和单测；离线时附加 --offline
```

Playwright 证据使用唯一 run id 并写入 `artifacts/qa/frontend/`；Rust、浏览器 mock 和 Windows native 是三种独立证据，不能互相替代。CI 在实际 checkout 的 `app` 工作目录运行检查、构建和 Playwright，但发布、tag、Release 和资产上传永远是独立授权动作。
