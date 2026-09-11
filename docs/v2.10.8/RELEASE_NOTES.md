# v2.10.8 · Night Valley 计时页悬浮窗往返入口修复

发布日期：2026-09-11

## 重点更新

- 修复计时开始后自动进入专注悬浮窗，点击“返回”回到主窗口后无法再次进入悬浮窗的问题。
- 在 Night Valley“计时”页的“本次专注”卡片中增加“进入悬浮窗”入口；只有当前专注已有进度时显示，待开始状态不增加无效操作。
- 复用已有专注悬浮窗动作，不改变计时状态和原生窗口实现。

## 代码范围

- `src/components/NightValleyViews.tsx`：增加已有进度状态下的“进入悬浮窗”操作，并接收悬浮窗回调。
- `src/MainShell.tsx`：将既有 `showFocusFloating` 动作传入 Night Valley 计时页。
- `src/App.css`：为新入口补充 Night Valley 计时卡片内的响应式样式。
- `tests/app.spec.mjs`：增加返回主窗口后重新进入专注悬浮窗的回归，并确认待开始状态不显示该入口。
- 版本同步：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`。

## 明确不修改

- 不修改专注悬浮窗的 Tauri 原生窗口逻辑、自动进入行为、锁定/解锁行为。
- 不修改计时的开始、暂停、继续、完成、重置和保存数据语义。
- 不修改 Night Valley 今日页、其他三个页面、其他主题或存储结构。

## 本地验证

- `pnpm check`：PASS。
- 定向 Playwright：PASS，1/1。
- 完整前端回归：PASS，67/67。
- Night Valley 计时页浏览器截图复核：PASS；已有进度时入口清晰，待开始状态不显示，未挤压暂停/完成/重置操作。
- `pnpm build`：PASS，2062 modules transformed。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS，`focused-moment v2.10.8`。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，33/33 library tests。
- `pnpm package:release`：PASS，生成 Windows EXE、NSIS Setup 与 MSI。
- `git diff --check`：PASS。

## 本地 Windows 发布候选资产

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.8.exe` | 23,733,248 bytes | `dab65cefb611785d4238ef6e322f7469fcb615be09f6b1dc17c568e55c22b782` |
| `Focused Moment Setup v2.10.8.exe` | 16,129,531 bytes | `d7fca7086b31c97b1546f4fde39e90c62442a4a6964c425675b1ac5c841bba23` |
| `Focused Moment_2.10.8_x64_en-US.msi` | 17,104,896 bytes | `e1f5a4ea58c08b4dd7dd84d795f01e5019efd0b6459b4fab848368d2e645d9e1` |

## 发布状态

发布代码提交为 `96c22914e393924b7f5d312b5ce37ab675c25111`，`v2.10.8` 为不可移动 annotated tag，peeled commit 与发布代码一致。主 Checks、macOS Native Smoke、macOS Release 均已通过；GitHub Release 已正式发布并包含四项资产。

## 远程验证与发布资产

- [GitHub Release v2.10.8](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.8)
- [Checks · 34589143406](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34589143406)：PASS，前端流程 67/67，Rust format/check/test 全部通过。
- [macOS Native Smoke · 34589143413](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34589143413)：PASS。
- [macOS Release · 34589231576](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34589231576)：PASS，Universal DMG 构建并上传成功。

| GitHub Release 资产 | 大小 | 远端 SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.8.exe` | 23,733,248 bytes | `dab65cefb611785d4238ef6e322f7469fcb615be09f6b1dc17c568e55c22b782` |
| `Focused.Moment.Setup.v2.10.8.exe` | 16,129,531 bytes | `d7fca7086b31c97b1546f4fde39e90c62442a4a6964c425675b1ac5c841bba23` |
| `Focused.Moment_2.10.8_x64_en-US.msi` | 17,104,896 bytes | `e1f5a4ea58c08b4dd7dd84d795f01e5019efd0b6459b4fab848368d2e645d9e1` |
| `Focused.Moment_2.10.8_universal.dmg` | 34,262,466 bytes | `d4eb4b6e8d9678ec18346ef5449a52f24b52e6158cfee12cd87e691b7cb32692` |
