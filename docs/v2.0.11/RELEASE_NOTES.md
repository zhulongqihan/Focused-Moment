# Focused Moment v2.0.11

## 倒计时专注悬浮窗

- 启动倒计时后自动进入专注悬浮窗，与正向计时保持一致。
- 悬浮窗继续支持暂停、继续、完成并记录和返回主窗口。
- 修正倒计时暂停后继续时重复设置时长导致无法继续的问题。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（9 项通过）
- `cargo fmt --check`
- `cargo test`（9 项通过）
