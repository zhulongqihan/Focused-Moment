# Focused Moment 2.14.2 发布收口

as_of: 2026-10-23 16:35（Asia/Shanghai）

## 授权与基线

- 用户要求执行上一轮全部后续建议，包含恢复竞态排查、最终候选原生验收、PR 整理/合并与 Windows 发布。
- 最新纠正：多人试用先跳过，由用户本人日常使用；不等待外部参与者或一周观察。
- 源码分支 `codex/focused-moment-continuity`，起点 `47131be585654aaf95596b512889161affec7e4c`；公开版本 v2.11.10，当前本地候选 2.14.2。
- `PROJECT_PLAN.md` 保持只读，起始 SHA-256 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；不提交既有未跟踪文件。macOS 发布继续冻结。

## 执行状态

| 单元 | 状态 | 验收 |
| --- | --- | --- |
| 初始错误恢复 | 本地验证完成 | 自动恢复与手动重试分别稳定覆盖；完整 mock 225/225、静态/Rust 通过、审查后定向 2/2；准备独立提交推送 |
| 最终 Windows 原生验收 | 进行中 | 同一候选下托盘、隐藏提醒/音效、浮窗与书签、备份恢复及公开旧版升级；隔离数据与进程，记录实际覆盖 |
| PR、合并、Windows 发布 | 待验收 | 最终范围/版本/源提交/资产来源一致，远程检查通过，资产 digest 核对 |
| 多人真实试用 | 按用户要求跳过 | 由用户本人使用，不虚构反馈或观察结果 |

## 当前判断

历史失败是首读失败后自动恢复与旧手动重试测试的时间窗口竞争；用受控时间和持久故障输入分别验证两类行为，不增加重试、不放宽断言。自动 smoke 的窗口检查仍需验证 HWND 所有者和可见性。原生准备与发布范围审查由独立子任务并行完成，主任务负责整合和最终判断。

## 初始读取恢复验证

- 自动恢复与持续失败后的手动重试分开覆盖，保留原错误提示、实际点击、概览和待办恢复断言；新增失败重试仍可操作、成功后停止重试的验证。
- `pnpm verify` 通过，Rust 57 passed / 0 failed / 1 ignored；日志 `artifacts/qa/verification/release-readiness-verify-20261023-031254-ad88cea4/verify.log`。
- 完整浏览器 mock 225/225，4 workers、0 retries、4.7 分钟；目录 `artifacts/qa/frontend/release-readiness-full-20261023-inv-mvjx4xom-47780-fc5e9887-776e-4d92-801f-4c5835868be3/`，命令日志 `artifacts/qa/verification/release-readiness-full-20261023-031254-e8d8f215/playwright.log`。
- 独立审查发现时钟 install/pause 的同一时间点可能在慢 CI 中倒退，已改为先安装早一分钟的时间，再在应用启动前暂停；并强化失败点击确实发起读取的计数断言。最终定向 2/2 通过，目录 `artifacts/qa/frontend/recovery-reviewed-final-20261023-inv-mvjxgjh7-45516-7ad36fbb-44c0-45dd-b9fa-cc0ca0a24ed0/`，续作时已核对 `.last-run.json` 为 passed / failedTests=[]。
- 本单元只有测试/fixture 变化，生产源码无差异；not rebuilt; entry unchanged。

## 本轮工具异常与恢复

文档审查中的 `rg` 实际解析为本机 npm `rg.cmd` 包装器，包含嵌入引号和 `>` 的检索模式经过 cmd 二次解析，意外将 `app/src-tauri/src/runtime.rs` 截断。该文件在本轮开始时无用户差异；已从 HEAD blob 按原始字节恢复并匹配原 Release manifest：96,500 bytes、SHA-256 `599FE33074C8005C80F1C7C6F994FFB5E99154B8E8B8B844EB90951A1BF78A98`。恢复后源码 diff 为空；所有代理改用真实 `rg.exe`，不将截断计入产品修改或提交。

## 中断后恢复

- 16:30 用户要求继续；原三个子任务已停止，落盘测试、文档与脚本保留。重新安排原生验收和只读发布审查，不重做已完成的性能矩阵。
- 最新 `47131be` 远程 Checks 已成功，PR #1 仍 OPEN / CLEAN。未合并、未创建 v2.14.2 Release。
- 旧原生运行中部分步骤通过，但最新 tray、floating、backup、upgrade 场景报告均失败，仍需完成；不将局部断言或旧版本验证计作最终候选通过。
- 再次核对根 EXE、runtime.rs 和受保护 PROJECT_PLAN 的哈希均符合上述基线；没有运行中的 Focused Moment 实例。
