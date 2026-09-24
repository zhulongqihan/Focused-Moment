# Focused Moment 2.13.1

## 设置中保留旧版主题入口

- 在所有主题的设置页底部增加默认收起的「旧版主题」入口，内含「极光海面」与「植物书房」的预览和切换按钮；正在使用旧主题时入口会自动展开。
- 旧主题不加入常用五主题列表；切换立即保存，旧版五个页面仍可使用，并可从旧主题设置页切回当前主题。
- 新的归档选择使用独立偏好 ID `legacy-aurora-ocean` / `legacy-botanical-library`。既有偏好 ID `aurora-ocean` / `botanical-library` 仍分别迁移到「今日班次」/「今日赛场」，保持已有用户数据行为不变。
- 不改变备份 schema 或专注/待办数据格式。

## 验证与交付

- `pnpm check`、`pnpm verify` 通过；Rust 测试 39/39，覆盖历史主题 ID 迁移、命名空间 ID 保留及备份恢复。
- 全量 Playwright 浏览器 mock 回归 156/156 通过，run `artifacts/qa/frontend/run-inv-muewo4v6-29708-4be15ef2-6aa1-4814-b618-cbc2dc587b7d/`；最终两项旧主题入口测试在追加主选择器数量断言后再次 2/2 通过，run `artifacts/qa/frontend/run-inv-muex68ba-19912-c4488d85-96a9-4485-92ee-f803680130be/`。
- `pnpm build` 通过（2089 modules）；Vite 保留现有大 chunk 提示，不影响构建成功。
- Playwright CLI 纯 Vite 预览确认设置页折叠/展开布局；该预览没有 Tauri IPC，不作为持久化或 Windows 原生证据。
- Windows Release 根目录 EXE 与 provenance、隔离 Windows 原生冒烟待源代码提交后完成。
- 本次为本地 Windows 构建与分支同步；不创建 GitHub Release、tag 或安装器。
