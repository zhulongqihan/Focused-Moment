# v2.11.0 · Editorial Paper 界面切换

## 版本语义

- 本版本对应本轮界面切换，按用户最新纠正使用 minor 版本 `2.11.0`。
- `v2.10.19` 已发布的 tag、Release 和 Windows 资产保留为历史记录，不移动、不覆盖。
- 本次版本纠正不新增未核验的产品行为；产品内容以已完成的 Editorial Paper 逐问题修复批次为准。
- 本版本仅发布 Windows x64 资产；macOS 更新继续冻结。

## 主要变化

- 按 TODAY-01～11、TIMER-01～21、TODO-01～03、RECORDS-01～07、SETTINGS-01～06 逐条核查编辑纸页，只修复真实复现的同类问题。
- 保留编辑纸页原有纸张质感、字体、配色、插图、排版语言和空间构图；未复现或不适用的问题均记录为 PASS/不适用。
- 修复长节点标题可读性、今日页重复计时入口、跨页日期/时钟、低高度摘要边界、计时状态与重置语义、今日记录数口径、悬浮计时回入口、待办列表空白和记录标题回看入口。
- 移除编辑纸页没有实际消费者的外观滑块与密度控件；保留主题色板、文字预览、快捷键、音效和备份能力。
- 设置页改为即时保存语义；保存失败时提醒开关和音效选择回到最后成功值。

## 本地验证

- `pnpm exec playwright test tests/today-visual.spec.mjs --grep "REFINE-19" --workers=1`：48/48 PASS。
- `pnpm check`：PASS。
- `pnpm build`：PASS，2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：35/35 PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 版本元数据均为 2.11.0。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.11.0.exe` | 23,796,224 | `fd319f13eaf0e4c9a6a737c7dafac3ab19df4fd969dc9ea8a90c1aa929df412d` |
| `Focused.Moment.Setup.v2.11.0.exe` | 16,180,594 | `1b4e66c09327446196159f9389727d52900b36247ef7924bdbe0878324a7c1b6` |
| `Focused.Moment_2.11.0_x64_en-US.msi` | 17,162,240 | `f7f7ccf27d313674ab6936697a6bca038f2988413e6fa0b57e0f82f0f3c99577` |

本地导出路径：`Focused Moment v2.11.0.exe`、`Focused Moment Setup v2.11.0.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.11.0_x64_en-US.msi`。

## 发布闭环

- 产品提交：`600501a5b98a7e502bfbe629735888b56496f0cb`；`v2.11.0` tag 固定指向该产品提交，未移动。
- Windows Checks：[`34838375564`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34838375564) PASS，前端与 Rust 检查报告 `123 passed`。Node.js 20 弃用提示为 GitHub Actions 注记，不影响本次验证。
- GitHub Release：[`v2.11.0`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.11.0) 已正式发布，portable、Setup/NSIS、MSI 三项 Windows x64 资产状态均为 `uploaded`。
- 远端资产 digest 与上表本地 SHA-256 完全一致。
- `v2.10.19` 历史 tag、Release 和资产未移动或覆盖；本版本不执行任何 macOS workflow；当前用户进程 PID `12200` 保持运行。

## 保护边界

- 不运行任何 macOS workflow。
- 不停止用户进程；PID `23304` 的旧版进程按要求保持运行。
