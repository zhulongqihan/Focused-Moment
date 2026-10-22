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
- 默认 `pnpm package:local` 生成 2.14.1 候选，build ID `local-20261022-175851-0138254e16`，SHA-256 `A4F08A49C44A054C81A62881419B44EC6C806429AC484810813959FDEED72D9C`，FileVersion/ProductVersion 均为 2.14.1。196 个构建输入前后 digest 均为 `4C6F9BBE033BE43D027E351CD46C149B49F7AE318B9B00329480B884B29EA1D7`。候选与源码 provenance：`artifacts/builds/local/local-20261022-175851-0138254e16/manifest.json`；打包日志：`artifacts/qa/build/d-batch-20261022/pnpm-package-local-final.log`。
- 根目录入口仍为 2.14.0（SHA-256 `8FB3E4A468C52A6745A4DD1F164B9CB76DDB8969358A3A23E3BA34B670646F4C`），PID 43308 正在运行；为保护用户进程，候选仅保存到 provenance 目录，未替换根入口。文件锁也使旧入口归档副本无法安全复制，manifest 明确记录 `previousRoot.backupPath=null` 和 `delivery.rootReplacementCompleted=false`。
- 对同一候选的 `pnpm native:windows` 尝试被单实例进程守卫拒绝，日志：`artifacts/qa/native/windows-native-d-process-guard-20261022/native-smoke-attempt.log`。该项尚未通过，不能将 D 标记完成；用户关闭当前 2.14.0 窗口后，需重新默认打包、更新根入口并对匹配候选重跑隔离 Windows smoke。
- 本说明记录的是本地候选，不代表正式 GitHub Release、tag、安装器或资产上传。
