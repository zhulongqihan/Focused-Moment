# v2.10.19 · Editorial Paper 逐问题核查

## 主要变化

- 按 TODAY-01～11、TIMER-01～21、TODO-01～03、RECORDS-01～07、SETTINGS-01～06 逐条核查编辑纸页，只修复真实复现的同类问题。
- 保留编辑纸页原有纸张质感、字体、配色、插图、排版语言和空间构图；未复现或不适用的问题均记录为 PASS/不适用。
- 修复长节点标题可读性、今日页重复计时入口、跨页日期/时钟、低高度摘要边界、计时状态与重置语义、今日记录数口径、悬浮计时回入口、待办列表空白和记录标题回看入口。
- 移除编辑纸页没有实际消费者的外观滑块与密度控件；保留主题色板、文字预览、快捷键、音效和备份能力。
- 设置页改为即时保存语义；保存失败时提醒开关和音效选择回到最后成功值。
- 本版本仅发布 Windows x64 资产；macOS 更新继续冻结。

## 验证

- `pnpm exec playwright test tests/today-visual.spec.mjs --grep "REFINE-19" --workers=1`：48/48 PASS。
- `pnpm check`：PASS。
- `pnpm build`：PASS，2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：35/35 PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 版本元数据均为 2.10.19。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.19.exe` | 23,796,224 | `5bd4b8446959ea344a8cda6a9e67a7546408f3ea7fcdccd526235e1921b3d425` |
| `Focused.Moment.Setup.v2.10.19.exe` | 16,182,733 | `4946c57cdd805db75754207ec838e16a4084de442cd3483a8389ad5bfb19f6f0` |
| `Focused.Moment_2.10.19_x64_en-US.msi` | 17,162,240 | `f7f3c4a7da411bd3cc442cd2859aca920c95bdb1b1cad2dfee0b911c4dd5ea27` |

本地导出路径：`Focused Moment v2.10.19.exe`、`Focused Moment Setup v2.10.19.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.10.19_x64_en-US.msi`。

## 发布闭环

- 产品提交：`8ef76813f65f86750fab46d2dba5f158b2aee0f7`；`v2.10.19` tag 固定指向该产品提交，未移动。
- 后续测试提交：`2afbc04d46f5c46cf81992e0bf186b30d43a9ba2`；仅对齐回归测试契约，不改变产品包内容。
- GitHub Release：[`v2.10.19`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.19) 已发布，三项 Windows x64 资产状态均为 `uploaded`。
- Windows Checks：[`34835489340`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34835489340) PASS，前端与 Rust 检查报告 `123 passed`。Node.js 20 弃用提示为 GitHub Actions 注记，不影响本次验证。
- 远端资产 digest 已与上表本地 SHA-256 完全一致。
- 本版本不执行任何 macOS workflow；PID `23304` 用户进程保持运行，旧 v2.10.18 文件因占用警告保留。
