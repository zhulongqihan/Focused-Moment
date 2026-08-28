# Focused Moment v2.0.6

## 修复专注浮窗暂停后无法继续

- 暂停专注后，浮窗会显示“继续”按钮，不必返回主窗口。
- 点击“继续”会恢复原来的专注计时和事项上下文。
- 增加浮窗暂停/继续回归测试。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（7 项通过）
- `cargo fmt --check`
- `cargo test`（8 项通过）
