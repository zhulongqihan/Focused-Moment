# v2.11.3 · Night Valley 今日侧边栏对齐修复

## 版本语义

- 本版本是 `v2.11.2` 发布后的 patch 更新，修复 Night Valley 点击“今日”后侧边栏文字间距异常和覆盖的问题。
- 本次仅发布 Windows x64 资产；macOS 更新继续冻结。
- `v2.11.2` 的 tag、Release 和 Windows 资产保留为历史记录，不移动、不覆盖。

## 修复内容

- 修复点击“今日”后，侧边栏图标与文字被拉开、文字靠近右侧并产生覆盖的问题。
- 根因是 Today 专属旧规则把导航内所有 `span` 都设置为 `margin-left: auto`，同时 Today 激活态没有沿用共享导航的左对齐规则；该规则误把导航标签当成待办数量计数元素处理。
- 现在导航标签明确重置外边距，桌面端五个 Tab 统一左对齐，图标与文字间距保持一致；待办数量仍保留自己的计数布局。
- 增加几何回归断言，覆盖“今日 → 计时 → 待办 → 记录 → 设置”切换后的对齐方式和图标/文字间距。

## 本地验证

- `pnpm exec playwright test tests/today-visual.spec.mjs --grep "Night Valley uses one shared sidebar tab module" --workers=1`：PASS。
- `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`：`135/135 PASS`。
- `pnpm check`：PASS；`pnpm build`：PASS，2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：`35/35 PASS`。
- `git diff --check`：PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 版本元数据均为 `2.11.3`。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.3.exe` | 23,848,448 | `96295be273c7cd2f18be96686c5ee843494c98d29290d609702358e4d090454c` |
| `Focused Moment Setup v2.11.3.exe` | 16,194,206 | `ea50c903a019a1f474fd4efc45362fe267f9391a37cb832352fe031d789f4951` |
| `Focused Moment_2.11.3_x64_en-US.msi` | 17,178,624 | `3a162a7741cfb354bd1e7c3a038cf121eb4e2c9e24cedd4e61bc352f90569d25` |

本地导出路径：`Focused Moment v2.11.3.exe`、`Focused Moment Setup v2.11.3.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.11.3_x64_en-US.msi`。

## 发布边界

- 发布目标：Windows x64 portable、Setup/NSIS、MSI。
- 不运行任何 macOS workflow。
- 不停止用户正在运行的应用进程。
