# Focused Moment architecture

这份文档是长期的目录职责入口。一次性的重构过程、提交和最终证据记录在 [`maintenance/structure-refactor.md`](./maintenance/structure-refactor.md)，不把 `PROJECT_PLAN.md` 变成提交材料。

## Product boundaries

- `src/App.tsx` 负责应用启动；`src/MainShell.tsx` 负责页面组合、导航和窗口分支。
- `src/features/shell/useMainShellController.ts` 负责跨页面状态、Tauri 生命周期、IPC 刷新和动作协调。
- `src/features/todos/`、`src/features/records/` 和 `src/features/shared/` 只放可复用的领域行为与派生计算；它们不能反向依赖应用壳或具体主题。
- `src/lib/` 放前端与原生之间的类型、调用和中性契约；`src/lib/theme-contracts.ts` 不包含主题名称或主题实现。
- `src/components/` 放主题适配和共享视觉组件。五套主题可以共享中性契约与待办列表，但不互相导入。
- `src/styles/index.css` 按原 `App.css` 的级联顺序引入分段样式；`src/App.css` 保留为兼容入口，不在这里重新设计主题。

## Native boundaries

- `src-tauri/src/runtime.rs` 是 Tauri library crate path 和运行入口。它保留 builder、setup、窗口生命周期和完整 `generate_handler!` 注册清单，不使用 `include!`。
- `src-tauri/src/domain.rs` 放计时偏好、提醒类型和限制常量；`timer_engine.rs` 放计时状态、运行态恢复、持久化协调和纯计时核心。
- `src-tauri/src/commands.rs` 放数据、备份和计时 Tauri 命令；`desktop.rs` 放主窗口、托盘、悬浮窗口和桌面命令；`storage.rs` 只处理本地状态/运行态/用户备份文件。
- 命令、serde 字段、默认值、中文错误、事件名称和 `Mutex` 锁语义属于兼容面。改变它们必须同时更新契约测试和隔离原生证据。

## Data and artifact boundaries

- Windows 真实数据默认位于 `%LOCALAPPDATA%\\FocusedMoment`；macOS 默认位于 `~/Library/Application Support/FocusedMoment`。验证脚本只使用临时隔离目录，不读取、迁移、清空或覆盖真实数据。
- 根目录 `Focused Moment.exe` 是唯一固定的直接测试入口。真实 Release 构建由 `pnpm package:local` 产生，候选路径、输入指纹、源码锚点、哈希和回退副本写入 `.release/local/<build-id>/`。
- `output/qa/<class>/<unique-run-id>/`、`.release/` 和 `target/` 是本地产物；它们不能被提交。旧历史二进制保留原处，只有明确核实的本轮旧入口才可以复制归档并建立恢复映射。
- `PROJECT_PLAN.md`、用户备份、真实数据、未知未跟踪文件和本地营销/私人资料不属于本轮源码交付。

## Verification entry points

```text
pnpm check                         TypeScript
pnpm verify                        静态/契约/fixture/Rust 聚合，不构建、不启动、不发布
pnpm test:frontend                 Playwright 浏览器 mock 流程
pnpm test:native-contracts         前端 invoke / Tauri 注册 / 事件契约与负例
pnpm native:windows                隔离 Windows 原生窗口、存储、WebView2、托盘 smoke
pnpm package:local                 真实 Release --no-bundle 根入口交付与 provenance
cargo fmt/check/test --locked      Rust 编译和单测；离线时附加 --offline
```

Playwright 证据使用唯一 run id 并写入 `output/qa/frontend/`；Rust、浏览器 mock 和 Windows native 是三种独立证据，不能互相替代。CI 可以运行 `pnpm verify`、构建和 Playwright，但发布、tag、Release 和资产上传永远是独立授权动作。
