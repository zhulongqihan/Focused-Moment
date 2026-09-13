# v2.10.14 · Night Valley 记录页可见性修复

## 本次内容

- 修复 Night Valley“记录”页的首屏折叠：归档摘要不再被旧的 1×1 隐藏规则压缩，七日时间轴、统计条、详情和分布区恢复自然流布局。
- 重新组织记录页的夜谷视觉层级：摘要、时间轴、统计、详情、趋势和历史各有清晰的材质与边界，保留深色雾面、金色路径和薄边界语言。
- 选中日期详情在桌面端采用信息与仪表双列，窄窗口自动堆叠；原有记录查看动作保持不变。
- 全部历史记录按日期收纳在有边界的滚动列表内，保留旧日期、键盘焦点和展开回看能力，不再随天数无限撑长页面。
- 本版本只发布 Windows；macOS 版本、Universal DMG、macOS Release 和 macOS Native Smoke 按用户决定继续冻结。

## 根因

旧的 measured layout 层把归档摘要设为不可见的 1×1 元素，并将其余统计区固定在一张坐标画布上；窗口高度变化时，真实内容会被折叠或截断。历史记录则全部在页面主流中展开，天数增加后会把后续内容推到很远的位置。

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过（Vite 2066 modules）。
- Rust `cargo fmt --check`、`cargo check --locked`、`cargo test --locked`：通过（34/34）。
- `pnpm test:frontend -- --workers=1`：通过（71/71）。覆盖记录页首屏区块可见性、七日统计、长历史内部滚动、末日展开、五套主题页面边界、窄窗口和高 DPI 场景。
- `pnpm package:release`：通过；生成 v2.10.14 Windows portable、NSIS Setup 和 MSI。

## 发布边界

- 本版本为 Windows-only 发布。
- v2.10.11 仍是最后一个包含 macOS 资产的版本；macOS 更新需要用户明确授权。
- 本次记录页的多个小问题按用户要求在同一界面内集中修复后一次性提交、推送和发布。

## 资产核对

| 资产 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.14.exe`（portable） | 23,794,688 | `8E28A7982DB19EAD9E516725F25BE4870C43E96AD0686FFFCE55EB386360BDA7` |
| `Focused Moment Setup v2.10.14.exe`（NSIS） | 16,177,459 | `A253D8FD657F6B2E193966CDA54F7DC9B2655AC40AC7C3CE687EF252CBC93701` |
| `Focused Moment_2.10.14_x64_en-US.msi`（MSI） | 17,162,240 | `C50F07ADE5F3D02714F8000FB57FC556F2D9502E49EB1C633D2775525CC9ADFE` |

本地与 GitHub Release 资产核对将在 Windows 远程发布完成后补录远端状态与 digest。
