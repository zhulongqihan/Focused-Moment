# REFINE-14 · Night Valley“记录”页验收

## 验收范围

- 版本候选：v2.10.14（Windows-only）。
- 页面：Night Valley 主题的“记录”页。
- 用户问题：首屏严重折叠、页面层级与主题不匹配、历史天数增加后内容过长且难以回看。
- 平台边界：不构建、不上传、不运行 macOS 版本链路；v2.10.11 仍为最后一个包含 macOS 资产的版本。

## 根因与修复

旧 measured layout 规则将 `.records-archive__summary` 压缩为 1×1、透明且不可交互，并让时间轴、统计、下方详情和趋势依赖固定高度/绝对定位。这套规则在较短窗口中会把真实内容折叠或裁切。修复在 `src/App.css` 中将 Night Valley 记录页恢复为自然文档流，并以响应式宽度、主题化面板和桌面/窄窗口布局覆盖旧坐标层。

历史区原本把所有日期分组直接放在页面主流中。现在保留全部 `.record-day`，但将 `.record-list` 设为带最大高度的内部滚动容器，使用 `scrollbar-gutter`、细滚动条和 `overscroll-behavior: contain`，日期仍可展开，滚动不会把整个页面拉成不可管理的长页。

## 自动化证据

- `pnpm check`：PASS。
- `pnpm build`：PASS，Vite 2066 modules。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，34/34。
- `pnpm test:frontend -- tests/app.spec.mjs -g "records page" --workers=1`：PASS，3/3。
- `pnpm test:frontend -- tests/today-visual.spec.mjs -g "Night Valley records explain" --workers=1`：PASS，1/1；新增归档摘要、时间轴、统计和详情区非零尺寸/可见性断言。
- `pnpm test:frontend -- tests/today-visual.spec.mjs -g "Night Valley (baseline records|pages expose|secondary widths|pressure widths|records explain)" --workers=1`：PASS，5/5。
- `pnpm test:frontend -- --workers=1`：PASS，71/71。
- `pnpm package:release`：PASS，生成 v2.10.14 Windows portable、NSIS Setup、MSI。
- `git diff --check`：PASS。

## 关键回归

1. 记录页归档摘要不再是 1×1/透明/不可交互，时间轴、统计条、详情和分布均有非零布局区域。
2. 记录页在 1280、1024、1120、820、560 像素宽度下保持页面和归档面板不横向溢出。
3. 模拟今天与昨天加 28 个历史日期时，页面出现 30 个日期分组；`.record-list` 的 `scrollHeight` 大于 `clientHeight`，`clientHeight <= 520`，横向滚动宽度不超过容器；滚动到列表末端后最旧日期可以展开并显示记录。
4. 既有计时、待办、托盘、五套主题、高 DPI 和压力宽度全套前端回归保持通过。

## 发布状态

- 本地代码基线：`eaa1fc4`；发布代码提交：`fb1e03eb248e8415e2e29bc688cd756458b427b5`，`v2.10.14` tag peeled commit 一致。
- Windows 资产 SHA-256 已记录在 `docs/v2.10.14/RELEASE_NOTES.md`。
- Windows Checks：[`34756725964`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34756725964) PASS；远程前端 `71/71`，Rust fmt/check/test 全部通过。
- GitHub Release：[`v2.10.14`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.14) 已正式发布；portable、NSIS Setup、MSI 三项资产均为 `uploaded`，远端 digest 与本地 SHA-256 一致。
- 本轮不构建、不上传、不运行 macOS 版本链路；v2.10.11 仍是最后一个包含 macOS 资产的版本。
