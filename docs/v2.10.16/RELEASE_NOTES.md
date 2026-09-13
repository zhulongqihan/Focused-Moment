# v2.10.16 · Night Valley 窗口控件交互修复

## 主要变化

- 修复无边框窗口右上角最小化、最大化/还原和关闭控件在记录页点击时可能被顶栏拖拽事件吞掉的问题。
- 保留 v2.10.15 的七日总览点线对齐、按专注时段统计分布和全部记录回看能力。
- 本版本仅发布 Windows 资产；macOS 更新继续冻结。

## 验证

- `pnpm check`
- `pnpm exec playwright test tests/app.spec.mjs --grep "window controls|top bar" --workers=1`
- `pnpm test:frontend -- --workers=1`
- `pnpm build`
- `cargo fmt --check`
- `cargo check --locked`
- `cargo test --locked`
- `pnpm package:release`
- Windows 远程 Checks 与三项 Release 资产 SHA-256 核对

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.16.exe` | 23,796,224 | `40b232097db751ee821696ce842030cc8559eb17c9eeeb142b9e56f4ea2c4023` |
| `Focused.Moment.Setup.v2.10.16.exe` | 16,178,772 | `554f82bdc90c607c3c832ac12ca459a0a91215a0b7fabf010a0c1d5586f43270` |
| `Focused.Moment_2.10.16_x64_en-US.msi` | 17,162,240 | `4316b25bef2a4f53b6b2f6eb9c0a3d7fcac64e84148d65a5d16124d5baf9cb03` |
