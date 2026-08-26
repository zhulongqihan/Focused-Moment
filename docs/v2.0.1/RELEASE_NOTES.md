# Focused Moment v2.0.1

## 待办日期编辑修复

- 修复已创建待办在编辑时无法保存截止日期变更的问题。
- 日期控件改为监听原生提交事件，兼容 Windows 桌面 WebView 的日历选择器。
- 新增日期编辑回归测试，覆盖从原生日历选择日期后保存的流程。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（3 项通过）
- `cargo test --manifest-path src-tauri/Cargo.toml`（8 项通过）
