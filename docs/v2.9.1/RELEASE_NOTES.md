# v2.9.1 · macOS 桌面集成补全

发布日期：2026-09-09

## 重点更新

- macOS 接入单实例保护：第二次启动会唤回已有主窗口，不创建第二个应用实例。
- 完善 macOS 菜单栏托盘：提供显示主界面、退出应用菜单；主窗口隐藏后可由原生 NSStatusItem 菜单恢复。
- 增加命令面板打开悬浮工作台的入口，浮窗沿用现有待办与计时业务状态。
- macOS 原生 smoke 覆盖 Application Support 数据目录、旧目录迁移、重启读取、LaunchServices 启动、托盘菜单、浮窗和隔离 DMG 安装启动。

## 验证

- GitHub macOS Native Smoke run `34328199858`：通过，macOS 26.6.2 arm64。
- GitHub Checks run `34328199910`：通过，前端与 Rust 共 58 项通过。
- Rust：32/32；`cargo fmt --check`、`cargo check --locked`、`cargo test --locked` 通过。
- 本地 `pnpm check`、Vite build（2061 modules）、串行完整前端回归 58/58、`pnpm package:debug`、`pnpm package:release` 通过。
- 原生证据报告：`docs/qa/DESK-02-342009c.md`。

## 已知边界

- 本次 macOS 安装证据使用 CI 生成的 unsigned debug DMG，挂载、复制到隔离 Applications 目录并启动通过；未声称公证、签名或真实 `/Applications` 安装通过。
- macOS 26 runner 的 Accessibility/SystemUIServer 不稳定暴露第三方状态项，因此位置探测记为 unavailable；实际 NSStatusItem 原生点击、菜单首项和主窗口恢复均有独立通过证据。
- DATA-01 的跨设备数据搬移与备份范围清单仍待后续任务。
