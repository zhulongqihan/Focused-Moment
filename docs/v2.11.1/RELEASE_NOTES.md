# v2.11.1 · Night Valley 可用性与运行效率修复

## 版本语义

- 本版本是 `v2.11.0` 发布后的 patch 更新，集中收口本轮已完成的用户可见修复。
- 本次仅发布 Windows x64 资产；macOS 更新继续冻结。
- `v2.11.0` 的 tag、Release 和 Windows 资产保留为历史记录，不移动、不覆盖。

## 主要变化

- 修复待办侧栏两位数及更大数量与“待办”标签挤压重叠的问题。
- 待办按截止日期分组，一次展开一个日期组，组内使用局部滚动，避免整页待办列表无限变长。
- 移除 Night Valley 待办页没有实际用途的“进行中”列及对应统计，保留待办/已完成两列。
- 为记录页“本周专注总览”的 `i` 添加可悬停、可聚焦的说明，解释最近 7 个自然日汇总和日期节点回看动作。
- 修复编辑纸页对抗复核中确认的日期口径、长标题、完成节点、重要度、窄屏溢出和计时圆盘层级问题，并补齐壳层证据。
- 按需创建悬浮/解锁 WebView，关闭后释放窗口；主窗口统一刷新并向已打开的悬浮窗同步状态，降低空闲资源占用。

## 本地验证

- `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`：`134/134 PASS`。
- `pnpm check`：PASS；`pnpm build`：PASS，2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：`35/35 PASS`。
- `git diff --check`：PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 版本元数据均为 `2.11.1`。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.1.exe` | 23,847,936 | `7a2ac3353c817a6640da7db6d19d682cbdc689bf8c0f6492a30f18dd5f584035` |
| `Focused Moment Setup v2.11.1.exe` | 16,194,153 | `304b31da2d5831c36436a272fb4e965a32062779fc6a84e5b21a3997f6aa0921` |
| `Focused Moment_2.11.1_x64_en-US.msi` | 17,174,528 | `6f520ade9a5f03f1023363b773ce9b44c59b18c2459e367b666b8eeefc6bbf37` |

本地导出路径：`Focused Moment v2.11.1.exe`、`Focused Moment Setup v2.11.1.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.11.1_x64_en-US.msi`。

## 发布边界

- 发布目标：Windows x64 portable、Setup/NSIS、MSI。
- 不运行任何 macOS workflow。
- 不停止用户正在运行的应用进程。
