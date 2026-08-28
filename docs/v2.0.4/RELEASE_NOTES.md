# Focused Moment v2.0.4

## 待办完成与过期状态分组

- 完成待办后保留在页面中，并移动到“已完成”区，不再造成“被删除”的错觉。
- 根据截止日期自动区分“已过期”状态，过期待办单独展示。
- 过期待办仍支持编辑、专注、删除和标记完成。
- 完成或恢复待办时显示明确的状态反馈。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（5 项通过）
- `cargo fmt --check`
- `cargo test`（8 项通过）
