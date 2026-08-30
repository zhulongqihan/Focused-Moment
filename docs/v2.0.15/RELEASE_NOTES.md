# Focused Moment v2.0.15

## 专注记录名称编辑

- 记录页新增“编辑”入口，可直接修改已保存专注记录的名称。
- 支持保存、取消、Enter 保存和 Esc 取消，保留原记录的日期、模式与专注时长。
- 编辑期间暂停后台刷新，避免输入中的名称被覆盖。
- 名称不能为空，且沿用 200 字长度上限，前后端都会校验。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（12 项通过）
- `cargo fmt --all -- --check`
- `cargo test`（12 项通过）
