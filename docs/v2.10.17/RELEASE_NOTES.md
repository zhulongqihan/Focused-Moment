# v2.10.17 · Night Valley 待办工作台重构

## 主要变化

- 将 Night Valley“待办”页改为今日路径工作台：待开始、进行中、已完成三列共用一套清晰的状态层级。
- 在看板顶部补充当天完成进度和行动提示，把右侧空白区域改为“下一步”工作台，直接承接当前待办。
- 完成列表改为面板内滚动，恢复/删除操作与标题保持同一行；窄屏自动按顺序堆叠，避免文字重叠和页面横向溢出。
- 保留 v2.10.16 的无边框窗口右上角最小化、最大化/还原和关闭控件修复。
- 本版本仅发布 Windows 资产；macOS 更新继续冻结。

## 验证

- `pnpm check`
- `pnpm test:frontend -- tests/app.spec.mjs -g "todo|overdue|window controls" --workers=1`
- `pnpm test:frontend -- tests/today-visual.spec.mjs -g "Night Valley secondary widths|Night Valley pressure widths|Night Valley baseline records five-page geometry" --workers=1`
- `pnpm test:frontend -- --workers=1`
- `pnpm build`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`
- `pnpm package:release`
- Windows 远程 Checks 与三项 Release 资产 SHA-256 核对

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.17.exe` | 23,798,272 | `36b8d181a73920d6d796214866ca105b83c94c9e782f4358187cc8c7d8de6a62` |
| `Focused.Moment.Setup.v2.10.17.exe` | 16,180,664 | `e35f92efdd70988154fa1e2a5cc79933dc56bdffd7a0963f248d19722d9a0e90` |
| `Focused.Moment_2.10.17_x64_en-US.msi` | 17,158,144 | `3466cba5fbf774f7e9aa62fd5a5140fb37cf21c9721a78921cae0d86500dfdb2` |
