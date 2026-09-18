# 历史归档区

这里只保存已确认身份的旧程序、旧安装器、历史报告、旧视觉证据和可恢复副本。迁移不改写材料内容；原路径、目标路径、大小和 SHA-256 由 `MIGRATION_MANIFEST.json` 记录。

- `executables/`：旧入口和旧构建恢复副本。
- `reports/`：过期 QA、维护审计和历史执行材料。
- `visuals/`、`qa/`：历史视觉/测试生成物。
- `release-history/`：旧 `.release` 目录的原始材料。

归档中的历史 fixture 可能保留迁移前生成的链接对象；当前工程不依赖这些对象，也不使用 Junction 组织新工作区。
