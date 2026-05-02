# Focused Moment v1.6.3

## 本版重点

- 让 `release:ship` 自动带上当前版本的正式 Release Notes
- 去掉发布说明临时文件里的 BOM，减少 GitHub Release 开头出现隐藏字符的概率
- 把发布文档同步这件事真正接进自动发版链路

## 这次更新了什么

- `publish-release.ps1` 现在会优先查找 `docs/v当前版本/RELEASE_NOTES.md`
- `release-ship.ps1` 会在发版时把当前版本的 release notes 文件一并传给发布脚本
- 发布脚本写临时说明文件时改为 UTF-8 无 BOM
- 版本信息统一更新到 `1.6.3`

## 核心能力仍然保持

- 正向计时与番茄钟
- 任务创建、编辑、完成和专注关联
- 按范围复盘、趋势查看和记录清理
- 本地备份导出与恢复
- 本地存储、异常恢复、托盘常驻、单实例

## 说明

`v1.6.3` 仍然属于发布链路补强版本，重点是把“文档更新”和“GitHub Release 说明”真正同步起来。
