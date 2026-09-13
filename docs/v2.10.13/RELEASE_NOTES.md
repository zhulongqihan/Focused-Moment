# v2.10.13 · Windows 通知区域托盘快速操作

## 本次内容

- Windows 通知区域托盘右键菜单现在展示当前计时状态、已用/剩余时长和当前事项标题。
- 根据计时状态提供“暂停计时”或“继续计时”；没有可继续的进度时保持禁用，避免从托盘误建一段没有事项的专注。
- 有未提交计时时可以直接打开已有的专注悬浮窗，不创建新的窗口实例。
- 可以从托盘直接打开计时、今日、待办和记录页面；页面跳转复用主窗口，不复制一套页面状态。
- 保留“显示主界面”和“退出应用”，并保留原有的左键显示主界面行为。
- 本次只增强 Windows 通知区域托盘。Windows 任务栏应用按钮的右键菜单仍由系统外壳管理；macOS 版本、Universal DMG、macOS Release 和 macOS Native Smoke 按用户决策冻结。

## 验证

- `pnpm check`：通过。
- 托盘导航前端回归：通过（原生事件切换计时/今日/待办/记录桥接；当前新增记录/待办路径）。
- 10 项高并发下超时的前端回归串行复跑：10/10 通过；完整前端首轮其余 60 项通过，超时原因为本机 Chromium 并发资源不足。
- `pnpm build`：通过（Vite 2066 modules）。
- Rust `fmt/check/test --locked`：通过（34/34）。
- Windows 原生托盘菜单单元验证：通过，覆盖未开始、运行中、暂停、已结束倒计时、事项标题清洗与截断。
- Windows debug native smoke：通过；隔离数据目录启动进程响应正常，生成 runtime/state 文件，并检测到进程拥有原生 `tray_icon_app` 托盘宿主窗口；测试进程已关闭，用户正在运行的 v2.10.12 进程未触碰。
- `pnpm package:release`：通过；portable、Setup、MSI 均生成 v2.10.13 Windows 资产。

## 发布边界

- 本版本为 Windows-only 发布。
- v2.10.11 仍是最后一个包含 macOS 资产的版本；macOS 更新需要用户明确授权。
- 同一托盘/快速操作交互单元的修复已集中完成后再统一提交、推送和发布，不按单个小 bug 发布。

## 资产核对

| 资产 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.13.exe`（portable） | 23,794,176 | `BD7C2C81E86550B500BDEF7EB567190AA9F43395F43C849D32EE8697404B6BE3` |
| `Focused Moment Setup v2.10.13.exe`（NSIS） | 16,176,642 | `6DA793885E9520921FC611553C6108F46A088D8A3405FB9110C868DC8ABC804D` |
| `Focused Moment_2.10.13_x64_en-US.msi`（MSI） | 17,158,144 | `3B662C42346A8BA74A5628F57F3570CC716B5B0912EA93E209F561952CFDAEB2` |

本地与 GitHub Release 资产核对：三项资产均为 `uploaded`，远端 digest 与上述本地 SHA-256 一致。

- Release：[v2.10.13](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.13)
- commit：`28b354e6bead620db11c5cb5c01b6ad1a16ec2ac`
- Windows Checks：[`34753128877`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34753128877)，远程前端 `70/70`、Rust fmt/check/test 全部通过。
- Release asset names：`Focused.Moment.v2.10.13.exe`、`Focused.Moment.Setup.v2.10.13.exe`、`Focused.Moment_2.10.13_x64_en-US.msi`。
