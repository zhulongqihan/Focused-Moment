# Focused Moment v2.14.0

## 日常操作统一

- 七种首页主题使用一致的专注主操作：开始、暂停、继续和完成记录都在当前首页完成，并保持与同一计时会话关联。
- 没有可继续事项时，首页主操作改为“快速记事”，打开收集对话框，不会意外启动计时或切换页面。
- 空首页的已完成事项和历史记录入口分别打开待办与记录，避免误触后新开一轮专注。
- Clutch Court 的专注操作与“完成并记录”按钮各自独立，窄屏布局保留可点击空间。

## 浮窗完成与停笔书签

- 从专注浮窗完成一轮后，只保存一次专注记录，再将可选的停笔书签交给主窗口处理。
- 主窗口重新显示后会读取待处理提示；用户可以保存下次继续位置，也可以跳过。
- 保存书签会同时写入待办位置并确认该提示；重试主窗口恢复只重试窗口动作，不会重复完成计时或新增记录。
- 已删除或已完成的待办不会显示过期书签提示。

## 验证

- 完整 Playwright 浏览器 mock：212/212 通过，4 workers、无重试；覆盖七种首页主题、快速记事、浮窗书签交接及 Clutch Court 桌面/平板/窄屏流程。
- `pnpm verify` 通过；Rust 单测 53 passed、0 failed、1 ignored。

## 本地 Release 候选状态（2026-10-15；未创建正式 Release）

- 默认 `pnpm package:local` 已生成 build ID `local-20261015-194816-ff963e39a1`。候选与根入口 SHA-256 均为 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`，PE FileVersion/ProductVersion 均为 2.14.0。来源 HEAD 为 `3f33b574f6245a121f56ca1bc3a9e3476f68fb7f`；构建输入 195 项前后摘要均为 `7AF0A62D2256606512301E9C1A22377D39437A6E46796E053CA0C11C040DE3BF`。完整 manifest：`artifacts/builds/local/local-20261015-194816-ff963e39a1/manifest.json`。
- B 批 2.13.10 根入口备份位于 `archive/executables/local/local-20261015-194816-ff963e39a1/Focused Moment.exe`，SHA-256 为 `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40`。
- Windows 隔离启动 smoke `windows-native-20261015-195043-03386d1148` 记录了哈希匹配、存储/WebView2 目录创建、旧路径防护和合成旧数据迁移断言通过。该 smoke 不覆盖本版本的浮窗和书签交互；其窗口句柄断言未核验实际句柄归属。
- C 候选的本机交互验收仍待完成：WebView2 CDP 页面 target 为空且 `Page.enable` 超时；2.13.10 同条件对照也出现相同超时，UIA 当前只返回单一 Pane。浮窗完成、主窗保存/跳过和恢复重试不重复写入尚无 Windows 原生交互通过证据。未创建 GitHub Release、tag、安装器或上传资产。
- 新的隔离启动复核 `c-interaction-20261015-203553-02c2f272` 以候选同哈希 QA 副本创建了合成存储和 WebView2 profile，但当前会话未生成任何候选顶层窗口（主 HWND 与前台 HWND 均为 0），因此未进行业务交互。QA 副本和隔离 profile 已清理；过程报告见 `artifacts/qa/native/c-interaction-20261015-203553-02c2f272/report.md`。
- 已准备供登录桌面运行的隔离启动器 `artifacts/qa/native/c-interaction-desktop-20261015-204411-8a33c5cf/launch-interactive.ps1`；仅通过 PowerShell 语法解析，尚未从可见桌面执行。它校验候选哈希、隔离应用/WebView2 数据，并要求候选自身出现可见 HWND 后才保留进程。
