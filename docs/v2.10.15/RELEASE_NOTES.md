# v2.10.15 · Night Valley 记录页可读性修复

## 本次内容

- 修复“本周专注总览”的坐标错位：折线 SVG 现在与日期节点共用记录地图的完整坐标系，路径也会真实经过首个和末个节点。
- 重做“分布”区：按每段专注的完成时间统计凌晨、上午、下午和晚间四个时段，同时显示投入时长、段数和时间范围，避免重复表达七日趋势。
- 修复“全部记录”的首屏不可用状态：所有日期分组默认展开，历史仍保留在有边界的内部滚动列表中，可随时收起或重新展开。
- 本版本只发布 Windows；macOS 版本、Universal DMG、macOS Release 和 macOS Native Smoke 继续冻结。

## 根因

七日图原来把 SVG 放在地图内部的缩小区域，而节点按钮使用地图本身的百分比定位；两套坐标系不同，导致线和点看起来没有对齐。路径的多点实现还从首个节点旁边开始，首点没有成为路径上的实际经过点。

分布区原来再次使用按日期的总投入时长，和上方七日趋势回答同一个问题，且缺少明确的统计维度。现在以已保存记录的完成时刻按一天中的时段聚合，回答“通常在什么时候进入状态”。

历史分组仍受到旧样式层中可见性、尺寸和默认折叠状态的共同影响，真实记录会退化成空的占位条。现在明确恢复日期摘要的可见布局，默认打开全部分组，并保留列表内滚动以控制长历史的高度。

## 本地验证

- `pnpm check`：通过。
- `pnpm test:frontend -- --workers=1`：通过，72/72。
- `pnpm build`：通过，Vite 2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：通过，34/34。
- `pnpm package:release`：通过，生成 Windows portable、NSIS Setup 和 MSI。
- `git diff --check`：通过。

## Windows 资产

| 资产 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.15.exe`（portable） | 23,795,712 | `8EB0B667B49CE3B734C3863A903FDA7B865534FD94C051AC0EE36BAFB62FF151` |
| `Focused Moment Setup v2.10.15.exe`（NSIS） | 16,178,693 | `3515510FE2A1269C6E83F1F2B17799909681E97855890F28FFED1C10AB1DF5C5` |
| `Focused Moment_2.10.15_x64_en-US.msi`（MSI） | 17,158,144 | `BBF56187A7B5FF85369C267D773AC91B1E109E72CA5204CDE1D9C845B66B2372` |

远程 Release 与 Windows Checks 将在本轮代码提交、推送和 tag 完成后补录；不构建、不上传、不运行 macOS 版本链路。
