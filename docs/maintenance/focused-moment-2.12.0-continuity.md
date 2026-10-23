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

截至 2026-09-18 最终收口，已通过：

- `pnpm check`
- `pnpm verify:css`
- `pnpm verify:structure`
- `pnpm verify:playwright-output`
- `pnpm test:structure`
- `pnpm verify:native-contracts`
- `pnpm test:native-contracts`
- `pnpm test:local-delivery`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：38 passed, 0 failed
- `pnpm exec playwright test tests/app.spec.mjs --workers=4`：54 passed, 0 failed
- `pnpm exec playwright test tests/today-visual.spec.mjs --workers=4`：8 passed, 0 failed，覆盖 1487px、1024px、560px、五套主题、收件箱/精选/Records/Settings/Focus。
- 浏览器证据写入 `artifacts/qa/frontend/` 的唯一 run 目录；最终通过 run 的 `.last-run.json` 状态为 `passed`。

## Windows 交付证据

- `pnpm package:local` 已用最新源码生成 2.12.0 Release 根入口。
- build ID：`local-20260918-210054-fefe1be612`。
- 根入口：`F:\Focused Moment\Focused Moment.exe`。
- 根入口 SHA-256：`2381F9802D66ADB0B5ACA96F3F275CC22EE7DF604DC300A500E2C861F350D809`。
- provenance：`artifacts/builds/local/local-20260918-210054-fefe1be612/manifest.json`；旧根入口已保留在对应 `archive/executables/local/` 恢复副本。
- `pnpm native:windows`：`windows-native-20260918-210227-591fa23e7b`，通过真实 Release 入口复制、隔离 LOCALAPPDATA/APPDATA/TEMP/USERPROFILE、WebView2 数据目录、无旧工作目录存储、v2 legacy migration 和受控清理。

Windows native smoke 的自动范围是启动、路径隔离、构建 provenance 和迁移；计时按钮、tray、迷你工作台、备份 UI、自定义音效和通知的完整手工窗口验收仍属于需要真实交互的独立证据，不能用 browser mock 或 smoke 结果替代。未创建 tag、GitHub Release、安装器或强制推送。
