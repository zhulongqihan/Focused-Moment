# v1.6.2 测试记录

## 发布链路

- `pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm release:github`

## 验证重点

- GitHub Release 标题是否显示为 `Focused Moment v1.6.2`
- Release 说明中的中文是否正常显示
- Release 资产是否对应 `v1.6.2`
- 应用内版本是否统一显示为 `1.6.2`
