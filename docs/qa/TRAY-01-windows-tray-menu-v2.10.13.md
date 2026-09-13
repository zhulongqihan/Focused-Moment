# TRAY-01 · Windows 通知区域托盘快速操作验收

## 验收对象

- 版本候选：v2.10.13（Windows-only）。
- 范围：Windows 右下角通知区域的 Focused Moment 托盘图标右键菜单。
- 边界：Windows 任务栏上的应用按钮右键菜单由系统外壳管理，不属于 Tauri 应用可自定义的通知区域菜单；本轮验证的是当前已有的原生托盘入口。
- 发布策略：macOS 更新、Universal DMG、macOS Release 和 macOS Native Smoke 继续冻结，直到用户明确授权恢复。

## 交互契约

菜单从同一份 `TimerSnapshot` 读取状态，不在托盘层复制计时器。菜单顺序为：

1. 只读的当前状态和当前事项；
2. “暂停计时”/“继续计时”以及有未提交进度时的“打开专注悬浮窗”；
3. “打开计时页”“打开今日”“打开待办”“打开记录”；
4. “显示主界面”；
5. “退出应用”。

没有可继续进度时，不提供“直接开始”或“完成/重置”等容易误触或涉及业务写入的托盘操作。已结束的倒计时保留打开计时页和悬浮窗入口，但“继续计时”保持禁用。

## 修改与根因

原实现只创建“显示主界面”和“退出应用”两个菜单项，无法在主窗口隐藏后快速确认当前专注状态，也无法恢复计时工作区。实现集中在 `src-tauri/src/runtime.rs` 的 Windows 菜单构建/状态刷新和 `src/MainShell.tsx` 的页面跳转事件桥接；不修改计时数据格式，不创建新的悬浮窗实例，不改变 macOS 菜单。

## 自动化证据

- Rust `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- Rust `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS。
- Rust `cargo test --locked --manifest-path src-tauri/Cargo.toml`：PASS，34/34；其中 `tray_menu_presentation_reflects_timer_state` 覆盖未开始、运行中、暂停、已结束倒计时、换行清洗和标题截断。
- `pnpm check`：PASS。
- `pnpm build`：PASS，Vite 2066 modules。
- 原生托盘导航前端回归：PASS；事件可切换记录和待办页面，并保留主窗口导航状态。
- 高并发完整前端回归首轮：60 项通过，10 项因本机 Chromium 并发资源触发 session/page 超时；这 10 项随后使用单 worker 串行复跑，10/10 通过。没有出现断言失败。

## Windows native / Release 验收

- `pnpm tauri build --debug`：PASS；v2.10.13 隔离启动进程响应正常，生成 `focused-moment-runtime.json` 与 `focused-moment-state.json`，并检测到该进程拥有原生 `tray_icon_app` 托盘宿主窗口。
- smoke 使用独立数据目录 `output/qa/TRAY-01/native-20260913-final`；测试进程已关闭。用户正在使用的 `Focused Moment v2.10.12.exe` PID 27160 在整个过程中保持运行且未被停止。
- 菜单状态、禁用规则、事项标题清洗/截断由 Rust 单元测试覆盖；页面跳转由前端事件桥接回归覆盖。当前 Tauri 2/tray-icon API 没有提供可脱离用户桌面坐标的 Windows 菜单弹出接口，因此 native smoke 只记录真实托盘宿主注册，不把坐标点击结果冒充为菜单内容验证。
- `pnpm package:release`：PASS；本地 Windows 资产已生成：portable `23,794,176` 字节，Setup `16,176,642` 字节，MSI `17,158,144` 字节；完整 SHA-256 见 `docs/v2.10.13/RELEASE_NOTES.md`。
- 远程 Windows Checks：[`34753128877`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34753128877) PASS；远程前端 `70/70`，Rust fmt/check/test 全部通过。
- GitHub Release：[`v2.10.13`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.13) 已正式发布；portable、Setup、MSI 三项资产均为 `uploaded`，远端 digest 与本地 SHA-256 一致。

## 平台保护

本轮不构建、不上传、不运行任何 macOS 版本链路。v2.10.11 保持最后一个当前双平台发布版本。
