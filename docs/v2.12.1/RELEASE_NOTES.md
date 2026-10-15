# Focused Moment 2.12.1

## 五套主题可见性与记录交互修复

本补丁版本修复了五套主题在记录展开、长页面滚动、七日潮汐图和设置理解上的回归，并统一了可见内容的自动保存体验。

### 修复内容

- 夜谷记录页改用明确的受控展开/收起按钮，按日期查看具体专注记录恢复正常。
- 编辑纸页设置页补充动效、密度的用途说明、状态标签和实时预览，调整后能直接看到影响。
- 极光海面与植物书房的 Today、Records 页面改为完整页面流，底部信息不再被固定视口裁切。
- 两个主题的七日潮汐图统一使用与日期点一致的坐标系，曲线横向铺满并与七个日期对齐。
- 极光海面与植物书房设置页移除“保存光场设置”和“保存书房布置”，改为调整后立即应用并自动保存。
- 版本同步至 `2.12.1`。

### 验证

- `pnpm check`
- `pnpm verify`：CSS、结构、原生契约、本地交付契约、Rust fmt/check 与 38 个 Rust 单元测试通过
- `pnpm test:frontend -- --workers=1`：100/100 项 Playwright 交互与视觉回归通过
- `pnpm build` 与 `pnpm package:local`：Release 根入口 SHA-256 为 `1F564F21476D3E9D26659FEB016C14D51F3D4195CD0C6AF4F334B71C1CC39EBB`
- Windows 原生冒烟 `windows-native-20260923-031639-ab660521df` 通过；构建 provenance 为 `artifacts/builds/local/local-20260923-031515-b74828e1e6/manifest.json`
