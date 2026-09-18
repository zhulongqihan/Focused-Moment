# Focused Moment 2.12.0 Release Candidate 验收记录

本记录只覆盖 `codex/focused-moment-continuity` 的 RC 收口，不扩展重复任务、休息流或 OS 全局快捷键，不执行 merge、tag、GitHub Release 或资产上传。

## 1. Git 基线与 2.11.11 差异

- 初始 RC HEAD：`44da0110422abe7713abd631eeaf8fca6f7cb0ed`
- 分支：`codex/focused-moment-continuity`
- `origin/main`：`ec8ed2549380b074a9d12ebc9ae11d148dece977`
- merge-base：`ec8ed2549380b074a9d12ebc9ae11d148dece977`
- `PROJECT_PLAN.md` 开始时 SHA-256：`E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`

2.11.11 差异分为两类：

1. `PROJECT_PLAN.md` 的 31 行本地用户私有/计划/营销差异继续保持未提交、未暂存、未修改；本轮没有把它混入 RC。
2. 相对 merge-base 的应用源码、配置、测试和资源改动全部已经进入初始 2.12.0 提交 `44da011` 的 48 文件范围；未发现另一个独立的 2.11.11 产品源码修复留在当前分支之外，也没有静默覆盖或丢弃产品修复。

重构前 `origin/main` 的前端测试基线为 146 项（旧 app 45 项 + 旧 Today 视觉 101 项）。旧 Today 文件没有删除，而是原样保留为 `app/tests/today-visual-v2.11.11.legacy.mjs`；当前 RC 使用新的真实信息架构测试文件 `app/tests/today-visual.spec.mjs`。旧套件的对照运行结果和映射见下文。

## 2. 前端回归与覆盖映射

当前默认清单目标为 64 项（当前 app workflow + 8 项主题/响应式视觉套件），命令为：

```text
pnpm test:frontend -- --list
pnpm test:frontend -- --workers=1 --retries=0
```

当前 RC 64 项必须报告 `passed / failed / skipped` 三项，不允许通过 skip、retry 或削弱断言制造通过。

旧 101 项视觉套件按功能映射到当前测试，而不是简单删除：

| 旧测试范围 | 当前 RC 覆盖 |
| --- | --- |
| Today trail、时钟、品牌壳和滚动 | Today 三层真实数据、Focus 路径、窗口控制、无虚拟槽位 |
| 主题注册表与五套页面 | 五套主题共享 Today workflow、真实 ThemePicker、Focus 可达性 |
| Editorial Today 旧布局 | 当前事项、今日精选、今日投入、收件箱和窄窗口 |
| Editorial Timer 旧布局 | 真实 `update_timer_context → start_timer`、暂停/继续/完成、恢复计时 |
| Todos/Records 旧布局 | 收件箱/日期分组、真实记录、来源标签、手动补录与修正 |
| Settings/性能旧布局 | 即时主题切换、autosave 失败重试、竞态、备份预览/选择恢复 |
| Night Valley 响应式和计时 | 1487px、1024px、560px 与五套主题 RC 视觉套件 |
| shell/adversarial 断言 | native window controls、真实空状态、同步和不造数据约束 |

此前对旧 101 项执行过不改断言的完整审计：155 项合并运行中 63 passed、92 failed、0 skipped。92 项失败是旧选择器、旧主题结构、Today streak/虚假槽位和旧开发文案与 2.12.0 明确移除项冲突；旧文件保留为证据，不把它们伪装成当前 RC 通过。

## 3. Schema v3 / migration / backup

Rust 隔离测试覆盖：

- v1/v2 backup → v3、v3 → v3 no-op、重复迁移幂等；
- 损坏 JSON、缺失顶层字段、非法 duration/date/id、重复 ID、future schema；
- 保存中断、导入中断、内存/磁盘 rollback；
- 只恢复 todos、只恢复 records、只恢复 settings；未恢复 todo 的 record 引用会清除 numeric dangling ID 并保留历史标题；未恢复 custom audio 时不会保留不可用的 custom sound 引用；
- current todo / today picks / completed or deleted todo 引用清理；inbox 空日期；focus plan 去重和最多 3 项；
- timer/runtime 恢复、重复 restore 不产生重复记录；
- completion-day attribution 不伪造跨午夜拆分。

真实用户目录不参与这些测试；测试使用 Rust 临时隔离目录和合成数据。外部 backup preview 在确认前不写状态；导入前写 rollback，解析或持久化失败不报告成功。

## 4. 核心行为矩阵

| 路径 | browser mock | Rust/contract | Windows GUI |
| --- | --- | --- | --- |
| Inbox 捕捉、安排日期、不过期污染排序 | PASS | PASS | MANUAL/UNVERIFIED |
| current todo 设置/替换/三项精选/清理 | PASS | PASS | MANUAL/UNVERIFIED |
| todo 开始专注真正 start timer，默认不弹 mini | PASS | PASS | MANUAL/UNVERIFIED |
| 手动打开 mini、锁定/解锁/同步 | PASS | PASS | MANUAL/UNVERIFIED |
| 同一 todo 多轮、record 关联且不自动完成 | PASS | PASS | MANUAL/UNVERIFIED |
| 停笔书签保存/跳过/下轮继续 | PASS | PASS | MANUAL/UNVERIFIED |
| manual record、时长/标题/日期/todo 修正 | PASS | PASS | PASS by contract; GUI MANUAL |
| analytics 当日/累计/active/streak/best/recent 重算 | PASS | PASS | MANUAL/UNVERIFIED |
| autosave 失败、重试、旧保存晚到不覆盖新主题 | PASS | PASS | MANUAL/UNVERIFIED |
| viral_quote 兼容 fallback、无旧 mp3 死引用 | PASS | PASS | MANUAL/UNVERIFIED |
| backup export/preview/cancel/import/rollback/custom audio | 部分 PASS | PASS for isolated state/rollback | MANUAL/UNVERIFIED |

## 5. Native 与 provenance 边界

`pnpm native:windows` 的自动证据只证明：Release EXE 启动、精确复制 hash、隔离 `LOCALAPPDATA/APPDATA/TEMP/USERPROFILE`、WebView2 数据目录、无旧工作目录存储、合成 v2 legacy migration 和受控清理。它不覆盖完整 GUI 交互，因此 tray pause/resume、通知、提示音、迷你工作台点击、外部文件选择、取消 import、custom audio 恢复等必须单列 MANUAL/UNVERIFIED。

最终 clean build 必须从最终 feature branch HEAD 执行 `pnpm package:local`，不得使用 `SkipBuild`；manifest 必须同时记录 source HEAD、branch、`relevantBuildInputDirty=false`、input fingerprint、candidate hash 和根 `Focused Moment.exe` hash，且两者完全一致。

## 6. 发布边界

本 RC 只推送 feature branch 并创建指向 `main` 的 Pull Request，等待 CI；不 merge、不 tag、不创建 GitHub Release、不上传资产，等待最终人工验收。
