# v1.6.3 测试记录

## 发布链路

- `pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm release:ship`

## 验证重点

- GitHub Release 标题是否显示为 `Focused Moment v1.6.3`
- GitHub Release 内容是否来自 `docs/v1.6.3/RELEASE_NOTES.md`
- Release 正文开头是否不再出现隐藏字符
- Release 资产是否对应 `v1.6.3`
- 应用内版本是否统一显示为 `1.6.3`
