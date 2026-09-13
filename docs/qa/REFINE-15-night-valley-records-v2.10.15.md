# REFINE-15 · Night Valley“记录”页验收

## 验收范围

- 版本候选：v2.10.15（Windows-only）。
- 页面：Night Valley 主题的“记录”页。
- 用户问题：七日总览的点线错位、分布区含义重复且模糊、全部记录无法正常查看。
- 平台边界：不构建、不上传、不运行 macOS 版本链路；v2.10.11 仍为最后一个包含 macOS 资产的版本。

## 根因与修复

`records-archive__map` 内的 SVG 原来只占地图的中间区域，日期节点却按地图完整宽高定位，造成两个坐标系统错位；路径首段从首点旁边起步，也没有经过首点。现在 SVG 填满地图，首段通过三次贝塞尔曲线进入首个节点，后续曲线继续经过每个日期点。

分布区原来重复使用 `archiveDays()` 的按日总时长。现在从每条已保存记录的 `completedTime`（缺失时回退 `completedAt`）提取小时，聚合为凌晨、上午、下午和晚间，并同时显示时长与记录段数。

历史记录的日期分组现在默认展开；`.record-list` 仍有最大高度、纵向滚动、键盘友好焦点和 overscroll 隔离，长历史可以在列表内完整回看，日期分组仍可通过原生摘要收起/展开。

## 自动化证据

- `pnpm test:frontend -- --workers=1 -g "records page|Night Valley records"`：5/5。
- `pnpm test:frontend -- --workers=1 -g "Night Valley (secondary|pressure widths)"`：2/2。
- `pnpm check`：PASS。
- `pnpm test:frontend -- --workers=1`：PASS，72/72。
- `pnpm build`：PASS，Vite 2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，34/34。
- `pnpm package:release`：PASS，Windows portable、NSIS Setup、MSI 均生成。
- `git diff --check`：PASS。

## 关键回归

1. 路径 SVG 与地图完全重合，测试采样每个日期节点到路径的距离小于 1.5 个 viewBox 单位，首末节点横坐标分别约为 7% 和 93%。
2. 分布区显示四个明确时段；模拟记录的上午和晚间各显示 45 分钟，空数据时四个柱形均为 0%。
3. 有记录时所有日期分组首屏可见；每个分组可通过摘要收起并重新展开，28 天历史仍在有界列表内滚动，最旧日期可见且可展开。
4. 五套主题、计时、待办、托盘、窄窗口和高 DPI 前端回归保持通过。

## 本地 Windows 资产

| 资产 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.15.exe` | 23,795,712 | `8EB0B667B49CE3B734C3863A903FDA7B865534FD94C051AC0EE36BAFB62FF151` |
| `Focused Moment Setup v2.10.15.exe` | 16,178,693 | `3515510FE2A1269C6E83F1F2B17799909681E97855890F28FFED1C10AB1DF5C5` |
| `Focused Moment_2.10.15_x64_en-US.msi` | 17,158,144 | `BBF56187A7B5FF85369C267D773AC91B1E109E72CA5204CDE1D9C845B66B2372` |

远程 main Checks、tag 和 GitHub Release 在推送后补录；macOS 资产和 workflow 未触碰。
