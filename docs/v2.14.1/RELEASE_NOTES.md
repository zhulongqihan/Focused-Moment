# Focused Moment v2.14.1

## 更轻的持续同步

- 主窗和浮窗通过业务域版本号判断待办、记录、应用设置、计时设置与今日计划是否变化；无变化时不再每秒读取完整业务数据。
- 成功提交后返回对应域的新版本并广播变更，窗口按需读取受影响域。读请求按窗口单飞，慢请求期间到达的更新会排队，旧快照不会覆盖新状态。
- 每 30 秒校准版本，窗口重新获得焦点或变为可见时也校准；业务、版本或音频读取失败时按 1、2、5、10、30 秒退避重试。
- 计时每秒只同步小型计时快照。浮窗接收有序样本；主窗样本超过 2.5 秒未到时，浮窗才启用轻量回退读取。
- 应用偏好快照只带音源元数据；主窗仅在音源版本变化时单独读取音频数据，浮窗不加载音频。
- 外观偏好改为字段补丁，避免一个窗口用过时的整份偏好覆盖另一窗口刚保存的设置。

## 验证状态

- 浏览器同步专项覆盖 60 秒空闲流量、慢快照单飞、漏版本事件校准、10,000 条记录与 5 MB 音源下的固定版本载荷、音频重试与浮窗计时样本。
- Rust 专项覆盖域版本提交、事务回滚、偏好补丁保留未修改字段与音频，以及版本快照固定序列化形状。
- 完整浏览器 mock：219/219 passed，4 workers、0 retries。目录：`artifacts/qa/frontend/d-full-final-20261022-inv-mvjc8w2z-39320-e1a77ce2-8473-4f43-917b-704f3fca9e30/`。
- `pnpm verify` 通过；Rust `fmt/check/test` 通过，57 passed、0 failed、1 ignored。日志：`artifacts/qa/verify/d-batch-20261022-final/pnpm-verify.log`。默认 Release 构建转换 2,097 个模块，Vite 提示入口 chunk 大于 500 kB，留给 2.14.2 优化。
- 最终默认 `pnpm package:local` 生成 build ID `local-20261022-183356-2a14d0298d`，源 HEAD `639a852f15aec1c15483a48bd214ff2cbbfad8a6`。Release 候选与根目录 `Focused Moment.exe` SHA-256 均为 `71F0E8B24E1B3F99B51F39E57F6BFE42B24BDE22596608A7E22DAD5CFEA834C5`，FileVersion/ProductVersion 均为 2.14.1。196 个构建输入摘要为 `4C6F9BBE033BE43D027E351CD46C149B49F7AE318B9B00329480B884B29EA1D7`，打包期间输入冻结断言通过。manifest/journal：`artifacts/builds/local/local-20261022-183356-2a14d0298d/`；日志：`artifacts/qa/build/d-root-delivery-20261022-183355-746/package-local.log`。
- 旧根入口 2.14.0 SHA-256 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C` 已备份至 `archive/executables/local/local-20261022-183356-2a14d0298d/Focused Moment.exe`。源码实现提交 `0da9bc39bfab27b645cd3e941d566bfea038a2e7` 与最终打包来源 HEAD `639a852f15aec1c15483a48bd214ff2cbbfad8a6` 均在确认分支；打包时远端指针与 HEAD 一致。
- 同候选隔离 Windows smoke `windows-native-20261022-183531-3160ffc11a` 通过，QA 副本与源候选哈希相同。覆盖可见启动、隔离用户/WebView2 目录、旧路径防护和合成旧数据迁移；不覆盖计时、托盘、浮窗、声音、通知等 UI 交互。报告：`artifacts/qa/native/windows-native-20261022-183531-3160ffc11a/report.md`；命令日志：`artifacts/qa/native/d-release-smoke-20261022-183530-354/native-windows.log`。
- Provenance 如实记录 `source.dirty=true`：受保护的 `PROJECT_PLAN.md`、用户已有文件及三份未跟踪辅助脚本未被提交；辅助脚本计入构建 provenance，但不进入 Vite/Tauri 编译。此次不创建正式 GitHub Release/tag/安装器或上传资产。
- 本说明记录的是本地候选，不代表正式 GitHub Release、tag、安装器或资产上传。
