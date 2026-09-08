# v2.6.10 · Editorial Paper 与长历史性能优化

## 本次更新

- 新增 Editorial Paper 主题五页：今日、计时、待办、记录、设置；沿用现有待办、计时、记录、设置和桌面浮窗行为。
- 增加主题持久化与安全回退，未知或未实现主题不会阻塞应用启动。
- 记录页长历史改为按需渲染：初始只挂载有限记录，完整历史按日期展开，降低大历史切页时的 DOM 和交互开销。
- 收口主题壳层边界，避免旧主题的固定导航、命令条和窗口高度泄漏到 Editorial Paper。

## 验证

- `pnpm check`
- `pnpm test:frontend`（50/50）
- Editorial Paper 与 PERF-01 定向回归（3/3）
- `pnpm build`
- `pnpm tauri build --debug`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`

## 边界

- 本版本的 macOS 原生数据目录、窗口和单实例验收仍待可用的 macOS 环境；Windows 原生证据与构建产物单独记录在项目 QA 报告中。
- 长历史性能数据包含 Windows debug 包与 Chromium/Tauri mock 两类指标；它们用于同设备回归比较，不等同于所有设备的绝对 SLA。
