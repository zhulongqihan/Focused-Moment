# v2.7.0 · Graphite Console 石墨控制台

## 本次更新

- 新增 Graphite Console 主题五页：今日、计时、待办、记录、设置。
- 用真实待办、计时、记录、备份、提醒和外观动作驱动控制台，不复制业务状态机。
- 增加 Graphite 主题切换、显式保存、重载保持和未知/未实现主题安全回退。
- 补齐 Today → Focus → running、Focus → 记录、待办编辑/完成/删除、记录回看和设置数据安全入口。
- 收口窄桌面主题壳层，覆盖旧主题的固定高度、绝对定位侧栏、背景伪元素和 821–1160px 工作区规则。
- 修复本地午夜与 UTC 日期不一致时的过期待办误判，统一使用本地日期键。

## 验证

- `pnpm check`
- `pnpm test:frontend`（53/53）
- Graphite 定向回归（3/3）
- `pnpm build`
- `pnpm package:debug`
- `pnpm package:release`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`

## 边界

- macOS 原生数据目录、窗口、单实例和安装交互仍以可用 macOS 环境下的 CORE-03/DESK-02 证据为准；macOS workflow/DMG 构建成功不替代 Finder、托盘和第二实例实测。
- Graphite 截图和 Chromium/Tauri mock 证据用于页面与交互回归，不代表所有设备的绝对性能或平台验收。
