# v2.11.2 · Night Valley 待办滚动持久化修复

## 版本语义

- 本版本是 `v2.11.1` 发布后的 patch 更新，专门修复 Night Valley 待办日期分组在后台刷新时滚动位置丢失的问题。
- 本次仅发布 Windows x64 资产；macOS 更新继续冻结。
- `v2.11.1` 的 tag、Release 和 Windows 资产保留为历史记录，不移动、不覆盖。

## 修复内容

- 修复某个日期待办组内滚动条向下拖动后立即回到顶部的问题。
- 根因是主窗口每秒刷新待办数据时会拿到新的数组/对象；Solid 的 `<For>` 将新的日期组对象视为新节点并重建局部列表，导致浏览器把该滚动容器的 `scrollTop` 重置为 0。
- 现在会在日期、标题和待办内容没有实际变化时复用原日期组及待办对象，仅在内容真正变化时更新对应节点，因此后台刷新不会打断用户正在查看的组内位置。
- 增加真实“每次刷新返回新对象快照”的回归场景，覆盖局部滚动位置在后台刷新后的持久性。

## 本地验证

- `pnpm exec playwright test tests/app.spec.mjs --grep "todo date group keeps its scroll position" --workers=1`：PASS。
- `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`：`135/135 PASS`。
- `pnpm check`：PASS；`pnpm build`：PASS，2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：`35/35 PASS`。
- `git diff --check`：PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 版本元数据均为 `2.11.2`。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.2.exe` | 23,848,960 | `a274ba4df659a51575a278d61860f4ca9ed41a67ba56ece935ae8dc03f45e319` |
| `Focused Moment Setup v2.11.2.exe` | 16,197,366 | `4c3da75baf4c496ae6123c80be0a81faad17ecedcf310b0232adcc036e724d1a` |
| `Focused Moment_2.11.2_x64_en-US.msi` | 17,182,720 | `17b649b18dda5d83628573344e4b80974eeef2fc09b69b1080280634a0d8a00d` |

本地导出路径：`Focused Moment v2.11.2.exe`、`Focused Moment Setup v2.11.2.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.11.2_x64_en-US.msi`。

## 发布边界

- 发布目标：Windows x64 portable、Setup/NSIS、MSI。
- 不运行任何 macOS workflow。
- 不停止用户正在运行的应用进程。
