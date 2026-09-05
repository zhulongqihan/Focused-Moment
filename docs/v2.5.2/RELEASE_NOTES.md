# v2.5.2 · 路径边缘适配修复

## 主要变化

- 修复窄窗口与窗口缩放时路线节点文字被视口边缘截断的问题。
- 横向路径继续支持任意数量的专注段；边缘节点保留路线与球体提示，完整标签在滚动到可见区域后恢复。
- 保留概念图的山谷背景、雾层、路线纵深、节点辉光和上下布局响应式表现。

## 验证

- `pnpm check`
- `pnpm test:frontend`（23 项通过）
- `pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
