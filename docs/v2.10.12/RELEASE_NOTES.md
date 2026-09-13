# v2.10.12 · Night Valley 计时页按钮对齐

## 本次内容

- 修复 Night Valley 计时页“查看专注记录”按钮的文字视觉中心偏移问题。
- 文字现在以按钮几何中心为锚点，右上箭头固定在按钮右侧，不改变按钮整体点击区域或打开记录页的行为。
- 新增桌面与窄屏的几何回归断言，避免按钮内容因图标参与普通排版再次偏移。
- 本版本是 Windows-only 发布；v2.10.11 仍是当前最后一个包含 macOS 资产的版本。

## 验证

- `pnpm check`：通过。
- Night Valley 按钮居中几何回归：通过（桌面、1024 窄桌面、540 移动宽度）。
- Night Valley 计时全屏布局回归：通过。
- Night Valley timer 定向回归：4/4 通过。
- `pnpm build`：通过（Vite 2066 modules）。
- Rust `fmt/check/test --locked`：通过（33/33）。
- Windows 构建与打包：通过，三个发布资产均为 v2.10.12。
- Windows portable `Focused Moment v2.10.12.exe`：23,774,720 bytes；SHA-256 `7a6617bdf51f6faeedfb9daeeab2b2ee80d3cd64b9ab7f3a5e1238332041a2bb`。
- Windows Setup `Focused Moment Setup v2.10.12.exe`：16,173,363 bytes；SHA-256 `beed2b3e23a745dff1b0e51124deef30c03888c2ddb14d2b6c0ac0cac751e06b`。
- Windows MSI `Focused Moment_2.10.12_x64_en-US.msi`：17,149,952 bytes；SHA-256 `3617446c71fe65b874a0c505e8ac89c5f079ebc51f0002f75edac78c02a8d798`。
- macOS Universal DMG、macOS Release 和 macOS Native Smoke：按用户决策冻结，本版本不执行。

## 远程发布

- 发布代码提交：`77b5b66dbde53b976a1f4b2ef3e3582d4f3fd7d5`；`v2.10.12` tag 指向同一提交。
- Windows Checks：[`34747904315`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34747904315)，成功；远程前端 `69/69`，Rust fmt/check/test 全部通过。
- GitHub Release：<https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.12>；三项 Windows 资产状态均为 `uploaded`，远端 digest 与本地 SHA-256 一致。
- 本版本没有 macOS Release、macOS Native Smoke 或 macOS 资产；v2.10.11 仍是最后一个包含 macOS 资产的版本。

## 发布策略

除非用户明确要求恢复，后续普通变更默认只做 Windows 版本同步、构建、验证和发布；macOS 版本保持 v2.10.11，不构建或上传新的 macOS 发布资产。macOS workflow 已改为仅保留手动触发入口。
