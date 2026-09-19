# RC 审阅续接快照

本文件只记录执行上下文，不作为完成证明。最新用户要求：全面审阅、修复未完成功能，并落实本轮范围内的可行性体验建议。

- 当前分支 codex/focused-moment-continuity，起点 4ab5c045206a3e5de5ba75c68bb58c7576d9425d；已有 PR #1。禁止 merge/tag/release/上传资产。
- PROJECT_PLAN.md 为用户已有修改，始终只读，不暂存、不提交。初始 SHA256 E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604。
- 旧报告的全量通过结论不充分：64 项当前测试不能代替被排除发现的 101 项 legacy 视觉测试；需逐项覆盖映射及恢复有效回归。
- 已确认缺陷：选择性恢复 todos/records 时错误替换计时设置和运行态；界面确认/成功反馈不符合实际选择。
- 待核对修复：独立非法日期/id/迁移/回滚测试，autosave 失败后晚到 retry，编辑记录统计一致性，跨日精选/引用完整性，五主题逐页响应式，真实 native 交互。
- 历史 clean EXE provenance 指向 4ab5c04；任何新 build-input 改动后必须重新 clean commit 构建，不沿用旧证据。
- 本轮数据安全修复已独立提交并推送：75351d1，四个Rust文件；58项Rust通过。包括选择性恢复隔离、原子外部备份、多文件恢复journal、未来schema保护、严格备份校验、未知时间保持未知、记录日期排序、旧备份迁移源信息保留。
- 前端/desktop/tests/scripts/docs仍有未提交改动。最新枚举259项（app75+legacy101+visual83），不是最终冻结数；完整前端尚未复跑。
- 主agent已修改desktop托盘打开工作台转show_floating_todos，旧show_focus_floating为别名；托盘退出发app-exit-request等待前端保存。Curie负责前端退出保存回应，尚待最终测试。
- Leibniz(agent 01a0b7ca-b009-7f63-b840-92be05177519)：旧101恢复默认执行+逐项映射+75格视觉矩阵，首轮184项170通过14失败；已修复CSS时钟/长标题/窄屏与合法旧断言迁移，正在原14项定向复核。
- Curie(agent 01a0b7cb-af16-7f82-8380-b0cfb2312f01)：app75项74通过，唯一export-confirm适配后1项定向通过；继续修复>7天日期搜索/精确记录定位/筛选计数/跨日日期signal/退出保存等待。仅controller/MainShell/app.spec/focus-history，主agent不并行改这些。
- Halley(agent 01a0b7cd-2fc6-7983-aca0-1441b8b717a1)：真实native CDP脚本和隔离provenance检查已补，等待最终clean commit build；尚未跑native。允许继续补oldIPC同一工作台断言。所有系统托盘/声音听感/通知等未覆盖须MANUAL。
- Kierkegaard(agent 01a0b7ed-0c37-7353-b2d0-d6171d329fb0)：storage journal与测试已完成，纳入75351d1；说明docs/maintenance/rc-storage-audit.md。
- 一次pnpm verify已全通过，但随后desktop/UI仍有修改，最终需再次verify和全量Playwright workers1 retries0。最新完整Playwright命令尚未执行。
- 后续：完成定向→冻结→完整验证→提交推送feature→clean HEAD package:local→native CDP真应用+手动边界→现有PR CI最终状态。禁止用旧二进制替代。
- 使用 reconcile-project-state 与 frontend-design 技能；依据最新代码和实测，不依赖旧报告 PASS 标签。
- 续接更新：Leibniz 已完成原14项定向复核，14通过0失败0跳过，服务已释放；完整184项仍需统一重跑。
- Curie最后收口还包括：当前事项持久化失败不得启动计时；自定义提醒必须从Rust持久化配置传给实际播放函数，不能读取迁移后清理的旧localStorage；相关专项完成后冻结。
- 75351d1完整SHA为75351d101d30e24535c02ab37dd320baf2098d86。尚未完成本轮最终clean build/native/最终CI，旧EXE不能用于当前交付。
- 主线程完整执行267项（app83+visual184），266passed/1failed/0skipped，15.8min，日志artifacts/qa/checks/rc-20260919-130331-541dcaec/frontend-full.log。失败仅RC command palette...旧End日期末项断言；日期新排序置顶后End变record3。修复要求End精确record3→Home精确date→Enter，不能削弱键盘导航。
- 本轮Playwright session35344已exit1。全部267项输出后Vite清理挂起；主线程通过提升权限CIM确认9272/46980为runner41912的子进程，仅清理二者，runner保留真实失败输出。下一次全量可使用受控提升权限执行避免沙箱进程清理限制。
- 267运行前后build-input指纹相同D6348E6F3B1B791AA4CE592B7BA76EA11B08CC6EAA36A442F18C31677B2CC1DF（172文件）。pnpm verify58Rust已通过，最终前端check也已通过。
- Curie现获准修复上述键盘断言，以及同名自定义音频跨窗替换缺陷：AppPreferencesView可选短指纹+memo按data变更计算，按name/fingerprint防异步旧响应，不携带data URL，不改Rust或备份schema。补同名替换/重复事件/旧事件/迟到响应/保存前时序专项后冻结，主线程必须重新完整跑。
- 新正式审阅文档docs/maintenance/rc-20260919-review.md、rc-app-coverage.md已创建；后者45旧app逐项映射，44原名保留+1更名，两个参数化组6项已单列。除PROJECT_PLAN外工作树修改均来自本轮主/子agents。
- PR#1当前远端75351d1的CI run35422071451已SUCCESS；这不代表未提交UI/脚本修复的最终CI。
- 最终冻结更新：Curie已完成音频短指纹/持久等待提醒序号，以及CommandPalette onMouseMove替代DOM刷新触发mouseenter重置选中项；键盘用例等待2次真实refresh仍要求End记录选中保持。定向6/6通过exit0，1444释放。
- 最终枚举270项=app86+visual184。主线程verify-final.log正在执行(session25356)，完成后按路径commit/push全部本轮剩余文件，保护PLAN；在同一HEAD跑270完整测试与package:local，随后native+最终CI。可并行互不修改输入的验证/构建，若发现新问题仍须修复并重新commit/build/验证。
