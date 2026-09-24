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
- Release 候选已从源提交 `cce109596d4b5091b57754e56ba7a69a270cb521` 构建：版本 `2.13.1`，34,907,648 bytes，SHA-256 `C42EC636B5E07D78C3C72A1313A3257074D8DE14A5E0F4D9FC9C4038CFA1C360`，位于 `app/src-tauri/target/release/focused-moment.exe`。
- 根目录入口尚未替换：当前 `Focused Moment.exe` 仍为 `2.13.0`，SHA-256 `D936D5D419319993818D7E9C5B8973B892D0038AED9D732CA13FA63C5EE7E5B9`；构建前后检测到该程序仍由 PID 17784 运行。为避免覆盖正在使用的文件，`package:local`、交付 provenance/恢复副本及 Windows 原生冒烟尚未运行。关闭应用后可用现有候选执行 `package-local.ps1 -SkipBuild`，再运行 `pnpm native:windows` 并补齐本节。
- 本次为本地 Windows 构建与分支同步；不创建 GitHub Release、tag 或安装器。
