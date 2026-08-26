# Focused Moment v2.0.2

## 待办编辑布局修复

- 修复编辑态日期输入框与时间输入框发生重叠的问题。
- 日期输入框右侧的日历按钮现在可以正常点击，不会再被时间控件覆盖。
- 增加控件边界与点击命中回归校验，防止编辑表单再次发生列溢出。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（3 项通过）
- `cargo test --manifest-path src-tauri/Cargo.toml`（8 项通过）
