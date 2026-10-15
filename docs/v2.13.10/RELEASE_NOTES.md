# Focused Moment v2.13.10

## 保存事务与崩溃恢复

- 所有状态变更、托盘计时、导入、清空和退出保存共用操作事务锁；事务失败时恢复内存快照。
- 新增内部 sidecar 事务日志。日志保存事务标识、受影响文件的原始内容与目标 SHA-256；pending 日志在写盘前持久化，目标逐项校验后以原子改名作为唯一提交点。
- 启动时幂等恢复未提交事务；已提交事务校验新状态并清理日志。计时事务只处理运行态文件，不复制专注记录历史。
- 日志损坏、回滚失败或校验冲突时保留现场并禁止继续写入，主界面提供恢复材料导出。

## 重置会话保护

- 有未保存进度时，重置先显示事项名称和累计时长，默认焦点为“保留本轮”；空闲计时仍可直接重置。
- 每轮计时带有原生会话标识。暂停和继续保留标识，完成、重置及替换会话时更新标识。
- 重置确认携带打开弹层时捕获的会话标识；确认在事务内核对，旧窗口的迟到确认不能清除另一窗口的新进度。
- 失败时保留进度和确认入口；提交期间锁定重复确认。

## 验证与本地 Release 候选

- `pnpm verify` 通过，Rust 49 passed、0 failed、1 ignored；证据：`artifacts/qa/rust/batch-b-verify-final-20261015-160500-a1c7d942/pnpm-verify.log`。
- `pnpm build` 通过（Vite 6.4.2）；证据：`artifacts/qa/build/batch-b-build-20261015-152010-27f72bf1/pnpm-build.log`。
- Playwright 完整浏览器 mock 183/183 通过，4 workers、无重试；证据目录：`artifacts/qa/frontend/batch-b-full-final-20261015-151021-488af42d-batch-b-full-final-20261015-151021-488af42d/`。重置确认框截图已检查。
- Rust 子进程在事务写入边界突然退出并恢复的测试通过；这是 Rust 证据，不代表 Windows Release 应用进程强退验收。
- 本地 Release build ID：`local-20261015-153109-5c67dc3626`。根目录 `Focused Moment.exe` 与候选版本资源 FileVersion/ProductVersion 均为 2.13.10，SHA-256 均为 `63CE69B934E7A6ADB42A9A2F886AA92926F046845262287D82703F9FDCDB3B40`，大小 46,347,776 bytes。manifest：`artifacts/builds/local/local-20261015-153109-5c67dc3626/manifest.json`；打包日志：`artifacts/qa/build/batch-b-package-20261015-161500-5edb71a4/pnpm-package-local.log`；192 项输入在构建前后摘要均为 `B8B7B42E6ACF072F09503D2C770D96F15361A13CBA23388195B930FAB4D126CF`。
- 原 2.13.9 根入口 SHA-256 `3542369B271858EDEAC71F70AF56F79EB9CEE55F98991498EA153BD1522A63B3` 已恢复备份至 `archive/executables/local/local-20261015-153109-5c67dc3626/Focused Moment.exe`。
- `pnpm native:windows` 隔离冒烟通过，run `windows-native-20261015-153341-0cd5821feb`；覆盖同哈希 Release 副本的可见启动、隔离数据/WebView2 路径、旧路径防护和合成旧数据迁移，不覆盖重置 UI 或活跃写入期间强退；报告另有合成临时目录清理警告。
- Windows Release 启动恢复：pending 日志回滚场景通过，run `windows-release-transaction-recovery-20261015T080915587Z-f16b06b2`；committed 日志保留并清理场景通过，run `windows-release-committed-recovery-20261015T081416228Z-16e0b35e`。两项均使用此版本 EXE 和隔离合成存储，验证启动恢复而非活跃写入期间强退。pending runner 在场景断言通过后因临时 WebView2 profile 清理遇到 `EBUSY` 以退出码 1 结束；committed 场景在 fixture 改用小写 SHA-256 文本后通过。
- Windows 原生重置 UIAutomation run `windows-reset-native-20261015T084539307Z-e809fa5d` 的 8 项断言通过，覆盖默认焦点“保留本轮”、取消保留运行态、确认清空和不创建专注记录。早期乱码来自未设 UTF-8 的测试探针；修正后通过。
- Windows Release 活跃事务强退 run `windows-release-active-write-kill-20261015T091502930Z-d50d1b75` 证明 state 已替换而 runtime 仍旧、pending journal 覆盖两文件时进程退出；同一候选重启后 state 精确回滚、runtime 保持旧值且 pending journal 删除。恢复截图和 `supplemental-verification.json` 位于该 QA run 目录。
- 活跃强退 runner 未产出自身 `report.json`：它选中了没有 UIA 子元素的窗口句柄；EnumWindows 找到可见主窗口后，显式句柄 UIA 检查通过（84 个控件，包含“计时”按钮）。补充 JSON 记录文件哈希、原生窗口结果和 runner 限制；本结论基于这些可复核证据，不把 runner 退出码记为通过。
- **状态：2.13.10 本地 Release 候选与 B 批验收完成。** 根目录入口已写入匹配候选；B 批四个提交已推送至 `origin/codex/focused-moment-continuity`，远端指针经核实为 `d1976da7669e55e979c24bdd319054a529f3d918`。未核验远程 CI，未创建 tag、GitHub Release、安装包或上传资产。
