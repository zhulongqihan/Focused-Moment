# Focused Moment v2.0.5

## 修复倒计时专注时长无法超过 25 分钟

- 修复输入倒计时专注时长后，被后台计时快照重新覆盖为默认 25 分钟的问题。
- 倒计时专注时长继续支持 1 到 720 分钟。
- 增加回归测试，确保输入 60 分钟并等待后台刷新后数值仍保持不变。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（6 项通过）
- `cargo fmt --check`
- `cargo test`（8 项通过）
