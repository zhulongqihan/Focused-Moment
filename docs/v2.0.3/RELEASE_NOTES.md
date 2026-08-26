# Focused Moment v2.0.3

## 待办日期与时间选择器修复

- 修复编辑待办时日期、时间原生选择器被后台轮询快速关闭的问题。
- 编辑态期间暂停待办数据刷新，保存或取消后恢复刷新。
- 增加等待刷新周期后的回归测试，确保选择器有足够时间完成选择。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（3 项通过）
- `cargo test --manifest-path src-tauri/Cargo.toml`（8 项通过）
