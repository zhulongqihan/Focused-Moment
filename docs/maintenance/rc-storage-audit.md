# RC Rust 存储事务中断恢复审计

日期：2026-09-19。范围：数据修复单元；不包含后续 UI 修复单元。

## 实现范围与归属

本专项源码改动限定于 `app/src-tauri/src/storage.rs` 与 `app/src-tauri/src/timer_engine.rs` 的 `persist_all()`。保留已有 `parse_backup_file` 缺字段严格校验；未修改 commands、UI、版本号或 PROJECT_PLAN，未提交、推送或构建交付 EXE。

主 agent 已将 `commands::export_app_backup_to_path` 接入 `crate::storage::write_backup_atomic(&path, &backup, true)`，本次文档整理已只读核对该调用。外部导出覆盖确认 UI、保留 original 的备份解析/迁移修复由主 agent 负责；不计入本专项的源码改动。

## 事务与恢复语义

- 根因：原 `persist_all()` 顺序保存 state/runtime，错误返回时能回滚，但进程在两次提交之间终止时没有共同事务边界，两文件独立快照可能恢复到不同版本。
- `save_bundle()` 先确认原数据可读取，再将两个主文件和两个快照文件的原始字节、文件缺失状态写入 before journal。日志名为 `focused-moment-transaction.json`，版本为 1，使用固定四个文件位置，不接受日志提供的任意目标路径。
- journal 先写临时文件并 `sync_all()`，再重命名发布；日志发布后才开始两个文件的保存。删除 journal 是提交点：即使两主文件已更新，只要日志仍在，恢复仍回到共同 before。
- 打开存储及普通 state/runtime 读写前检查 journal。恢复先解析日志、检查所有目标类型、暂存全部 before 字节，再逐个恢复主文件及快照。恢复期间再次中断可重复执行同一份 before；文件原先不存在时恢复为不存在。
- 日志损坏、版本不支持或恢复失败会返回错误。未成功恢复时保留日志，阻止本次正常读写继续；不会以默认空状态覆盖原文件。若恢复已完成部分文件后失败，磁盘可能暂时混合，但日志仍保有全部 before，后续访问必须先成功恢复。
- 进程级 mutex 串行化存储实例/克隆句柄的 journal 恢复与普通存储操作；它不是跨进程文件锁，也不是覆盖全部业务内存操作的事务锁。
- `persist_all()` 调用 `save_bundle()`；磁盘回退由存储层负责，失败后的内存 bundle 回退保留在 timer engine。
- 旧目录迁移继续使用既有复制、暂存验证和目录切换流程，没有另加目录迁移 journal。暂存存储打开时会恢复复制过来的未完成 bundle，原迁移源及其恢复信息不被修改。

## 八阶段错误注入矩阵

以下均为操作执行前注入返回错误，不是终止进程。测试先保存两代 bundle，使主文件和快照都有明确的不同版本。存储测试逐字节比较四个文件与事务前状态；已有 restore 集成测试同时检查内存与磁盘业务状态。

| 注入阶段 | 注入点 | 发生错误前可能已完成的变更 | 验收结果 |
| --- | --- | --- | --- |
| `WriteTemp` | state 临时文件写入前 | before journal 已发布 | 四文件恢复为 before，通过 |
| `Backup` | state 快照临时文件写入前 | state 新临时文件已写入 | 四文件恢复为 before，通过 |
| `MoveCurrent` | state 旧主文件移位前 | state 快照已更新 | 四文件恢复为 before，通过 |
| `PromoteNew` | state 新主文件提升前 | state 旧主文件已移位 | 四文件恢复为 before，通过 |
| `RuntimeWriteTemp` | runtime 临时文件写入前 | state 已提交 | 四文件恢复为 before，通过 |
| `RuntimeBackup` | runtime 快照临时文件写入前 | state 已提交，runtime 新临时文件已写入 | 四文件恢复为 before，通过 |
| `RuntimeMoveCurrent` | runtime 旧主文件移位前 | state 已提交，runtime 快照已更新 | 四文件恢复为 before，通过 |
| `RuntimePromoteNew` | runtime 新主文件提升前 | state 已提交，runtime 旧主文件已移位 | 四文件恢复为 before，通过 |

对应测试：`storage::tests::bundle_failures_restore_backups_as_well_as_primaries`、`tests::rc_restore_failure_at_each_write_stage_restores_memory_and_disk`。原有单文件故障注入测试仍通过。

## 合成中断及失败保护

`interrupted_bundle_replays_exact_before_images_at_each_commit_boundary` 直接构造磁盘中间态，不运行错误处理/回滚，再重新打开 store。对已有数据和空目录各检查以下五个边界，共十种组合：

1. journal 已发布，主文件未变。
2. state 旧主文件已移位，新文件尚未提升。
3. state 已更新，runtime 尚未更新。
4. runtime 旧主文件已移位，新文件尚未提升。
5. 两主文件已更新，但 journal 尚未删除。

其他隔离测试验证：恢复过程删除文件后再次打开仍能回退；损坏/缺项/未知版本日志阻止后续存储访问；恢复暂存路径被目录占用时保留当前主文件和 journal，解除阻塞后可重试；提交后的 bundle 重开保持不变；未发布的残缺日志临时文件不触发回滚；旧目录迁移在暂存副本恢复未完成 bundle，并保持源目录原样。

这些测试使用系统临时目录下带进程号、时间戳和序列号的独立测试根目录，没有操作真实用户数据。重新打开 store 发生于单元测试进程中，并未真正强杀再启动应用。

## 备份原子写入接口

```rust
pub(crate) fn write_backup_atomic(
    path: &Path,
    backup: &AppBackupFile,
    overwrite: bool,
) -> Result<(), String>
```

写入唯一同目录临时文件，`sync_all()` 后关闭句柄再发布。`overwrite = true` 使用同文件系统重命名替换，调用方负责覆盖确认；不先删除或截断旧目标。`false` 使用 hard link 做不可覆盖发布；文件系统不支持 hard link 时返回错误，不降级为可能覆盖的写入。发布后清理临时文件；异常中断可能留下临时文件，本专项未添加孤立临时文件清理器。

`save_user_backup()` 校验文件名并使用 `false`，同名冲突报错且保留旧备份。隔离测试覆盖成功写入、同名拒绝、路径越界名称拒绝、确认覆盖成功、目标是目录时失败保留内容、Windows 目标文件独占打开时替换失败且旧字节不变。

## 验证证据与边界

- 在真实 `F:\Focused Moment\app` 执行 `cargo test --manifest-path src-tauri/Cargo.toml --lib`：本专项最后一次运行 **58 passed / 0 failed**，包含主 agent 当时已经加入的 commands 预览测试。
- `cargo check --manifest-path src-tauri/Cargo.toml --lib` 曾通过；该次检查在最终可复用 helper 提取之前，helper 最终形态由之后的全量 Rust 测试编译并验证。存在工作区原有未使用导入/死代码警告，未为本专项修改无关源码消除警告。
- 两个源码路径的 `git diff --check` 通过。
- 上述是 Rust 编译及隔离文件系统测试证据，不是浏览器 mock 证据，也不是 Windows 原生应用端到端冒烟结果。
- 合成中断不等于真实进程强杀，更不等于断电。未模拟操作系统缓存丢失、磁盘控制器缓存或文件系统崩溃；没有实现并验证跨平台目录项 fsync 协议，因此不宣称系统掉电后 journal 发布/删除与数据重命名顺序具有完整持久性保证。
- mutex 仅限单进程；未验证绕开应用单实例机制后的多进程并发写入。
- 主 agent 正在进行的全套复核属于独立验收；本报告不预先宣称其通过。本专项没有重建 Release 或更新根 EXE，现有入口未变。

## 交接状态

本专项实现和文档已完成，无待修改源码。PROJECT_PLAN 保持不动，结果记录于本报告。数据修复单元由主 agent 完成独立复核、按路径审查并提交；后续 UI 修复单元单独处理。本专项未执行 Git 提交或推送。
