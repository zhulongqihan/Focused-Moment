# v2.10.18 · Night Valley 设置工作台重构

## 主要变化

- 重排 Night Valley“设置”页：左侧分组、主设置面板和右侧主题观测站改为流式布局，长文案和窄窗口会按内容自然展开。
- 移除视觉强调、动效强度、紧凑/舒展和快捷键卡片，减少没有实际决策价值的设置。
- 主题切换修改后立即生效并自动保留；提醒开关和音效选择继续自动保存，不再需要点击“保存设置”。
- 内置提示声扩充为柔和铃音、明亮三连、沉稳脉冲、木鱼单击、玻璃回响、晨光和弦和老牧师原声，并支持逐项选择、试听和导入自定义音效。
- 用不依赖静态背景图的“主题观测站”替代右侧 Night Valley 预览，展示当前氛围、实时应用状态和自动保存状态。
- 保留 v2.10.17 待办工作台与 v2.10.16 右上角三个原生窗口控件修复。
- 本版本仅发布 Windows 资产；macOS 更新继续冻结。

## 验证

- `pnpm check`
- `pnpm test:frontend -- tests/app.spec.mjs --workers=1`
- `pnpm test:frontend -- tests/today-visual.spec.mjs --workers=1`
- 前端串行回归：40/40 + 35/35 PASS
- `pnpm build`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`（35/35）
- `pnpm package:release`
- Windows release bundle 三项产物版本元数据核对
- Windows 远程 Checks [`34774739411`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34774739411) PASS；三项 Release 资产均为 `uploaded`，远端 digest 与本地 SHA-256 一致。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.18.exe` | 23,796,224 | `e7be384ea007c43cdd946b7f7a6b6f24c0168679d154e74fd102552cf1a01b06` |
| `Focused.Moment.Setup.v2.10.18.exe` | 16,183,888 | `0c48444a844568f3902bd35c5a95095b3ee96894e113e9a849104832b5117d89` |
| `Focused.Moment_2.10.18_x64_en-US.msi` | 17,162,240 | `daf7f6b365f92db81199c8e7884a30f6588c860d212cfdc3a7570c852c543f75` |

GitHub Release：[v2.10.18](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.18)。发布代码提交为 `6e8a076e9864a19a8e390e432ff8384aef0e5462`，tag `v2.10.18` 已推送；仅 Windows 资产，macOS 继续冻结。
