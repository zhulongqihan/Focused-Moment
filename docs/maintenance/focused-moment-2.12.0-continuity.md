# Focused Moment 2.12.0 continuity implementation

## 保护边界

- 本轮在真实仓库 `F:\Focused Moment`、应用目录 `app/` 内实施。
- `PROJECT_PLAN.md` 只读保护：开始时 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`，实施过程中未写入。
- 当前已有的 2.11.11 用户差异未重置；2.12.0 版本输入单独同步到前端、Rust、Tauri 配置和发布说明。
- 未创建 tag、GitHub Release、安装器或强制推送；Windows 根入口只有在完成新的本地 Release 构建后才能作为本轮交付物。

## 已实施边界

- Rust storage schema v3：应用偏好、焦点计划、收件箱日期、停笔书签、记录来源/完成日归属、旧配置和旧备份迁移。
- 前端 contracts、IPC wrapper、app-state-sync、mock 和 200ms trailing 自动保存/失败重试。
- Today 统一为当前事项、今日精选、今日投入；Todos 提供当前事项和精选控制；开始 CTA 调用 `update_timer_context → start_timer`。
- 迷你工作台默认不自动打开，自动打开成为持久化选项；保留锁定、解锁、透明度、tray 和窗口同步兼容路径。
- Quick Capture、停笔书签、多轮记录、手动补录、记录详细修正、任务/记录命令搜索所需 contracts 和界面入口。
- v3 内部/外部备份预览、导出、导入、选择性恢复外观、自定义音效和导入前 rollback；外部路径通过 Tauri dialog plugin 选择。
- 主题用户页面移除开发状态文案、虚假槽位、虚假百分比和内置趣味音效；新增样式迁移到有序 CSS 模块。
- 已删除 `app/src/assets/viral-quote-sample.mp3` 旧内置资源；`viral_quote` 仅保留为旧配置/旧备份的兼容迁移输入。

## 当前验证证据

截至 2026-09-19 的 RC 收口，已通过：

- `pnpm check`
- `pnpm verify:css`：9 个 CSS 模块、445323 个规范化字节，SHA-256 `406717E88316DFCF18C0C2745CD2430A4401CC3941D06559C61E990C9A8A1590`
- `pnpm verify:structure`
- `pnpm verify:playwright-output`
- `pnpm test:structure`
- `pnpm verify:native-contracts`
- `pnpm test:native-contracts`
- `pnpm test:local-delivery`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：42 passed, 0 failed；新增非法 ID、重复恢复、选择性恢复 custom audio fallback 等隔离测试。
- `pnpm test:frontend -- --list`：64 tests in 2 files。
- `pnpm test:frontend -- --workers=1 --retries=0`：64 passed, 0 failed, 0 skipped；覆盖完整当前 RC workflow、五套主题和 1487px/1024px/560px 响应式路径。
- 重构前 `origin/main` 的 101 项旧视觉回归已保留为 `app/tests/today-visual-v2.11.11.legacy.mjs`，并完成一次不改断言的对照运行：155 项（当前 RC 54+8 与旧基线 45+101 的并集）中 63 passed、92 failed、0 skipped；失败均为旧 2.11.11 选择器/虚假 Today 信息架构与 2.12.0 明确要求冲突，未把旧断言删掉或用跳过制造通过。当前默认套件用 64 项重新覆盖对应流程。
- 浏览器证据写入 `artifacts/qa/frontend/` 的唯一 run 目录；最终通过 run 的 `.last-run.json` 状态为 `passed`。

## Windows 交付证据

- 之前的 `local-20260918-210054-fefe1be612` / `2381F980...` 是本轮修复前的工作树构建，不作为最终 RC provenance；最终 clean build、manifest 和根入口 hash 以 RC 报告中的最终提交为准。
- 本轮不会使用 `SkipBuild`；最终提交确认后重新执行 `pnpm package:local`，并保留旧根入口到对应 `archive/executables/local/` 恢复副本。
- `pnpm native:windows` 的自动范围是启动、路径隔离、构建 provenance 和旧存储迁移；计时按钮、tray、迷你工作台、备份 UI、自定义音效、通知和完整书签交互必须单独标为 MANUAL/UNVERIFIED，不能用 browser mock 或 native startup smoke 替代。

Windows native smoke 的自动范围是启动、路径隔离、构建 provenance 和迁移；计时按钮、tray、迷你工作台、备份 UI、自定义音效和通知的完整手工窗口验收仍属于需要真实交互的独立证据，不能用 browser mock 或 smoke 结果替代。未创建 tag、GitHub Release、安装器或强制推送。
