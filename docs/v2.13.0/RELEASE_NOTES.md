# Focused Moment 2.13.0

## 两套全新主题

- 第四主题「今日班次」以交通导视和站台班次组织首页、计时、待办、记录与设置。
- 第五主题「今日赛场」以篮球场、战术回合与 Jimmy Butler 球星卡组织同样五个界面。
- 前三主题保留原有路由与视觉；生产主题选择器继续为五项。旧第四、第五主题实现及概念资料保留作历史归档。
- 两套主题使用各自的底部导航；桌面、平板和窄屏均可访问页面内容，长记录可滚动查看。

## 记录、设置与数据兼容

- 七日图的日期、散点、曲线和柱状数据共享同一日期坐标；选择某一天会同步摘要、记录与历史展开状态。
- 班次和战术待办连接真实待办、计时状态和专注记录；不生成虚构结束时间、比分或命中率。
- 设置页为明暗、动效和信息密度提供可见的即时预览，偏好自动保存；移除旧的手动“保存书房布置”按钮。
- 保留现有单一番茄休息时长字段；不扩展计时数据结构。
- 旧主题 ID `aurora-ocean`、`botanical-library` 分别迁移到新第四、第五主题；应用偏好和备份恢复使用相同映射。
- 夜谷记录页按日期展开/收起继续生效；编辑纸页设置补足动效程度、信息密度的用途说明和实时反馈。

## 验证与交付

- 两套主题各五个页面均以固定演示数据和 1487×1058 概念画布逐页核对，并检查 1024×900、560×900 的内容访问与溢出。
- 跨主题视觉与交互回归：`tests/today-visual.spec.mjs` 100/100 通过；覆盖主题、记录、计时、待办、设置和响应式场景。
- 完整前端 Playwright 套件 154/154 通过；运行证据位于忽略目录 `artifacts/qa/frontend/v2130-full-playwright-20260924-inv-mues5r0r-30492-ddf94a9e-4dcb-461b-8c42-fbcac4f4e74f/`。
- 旧主题备份恢复迁移专项 Rust 测试通过。
- `pnpm verify` 通过：TypeScript、结构/样式与原生契约、交付脚本测试，以及 Rust fmt/check/test（39/39）；Rust 仍输出既有未使用代码警告。
- 前端生产构建 `pnpm build` 通过（2086 modules）；Vite 提示部分产物 chunk 超过 500 kB，构建成功。
- Windows Release 构建 `pnpm package:local` 通过，build ID `local-20260924-083251-392d39dfb0`；根目录 `Focused Moment.exe` SHA-256 `D936D5D419319993818D7E9C5B8973B892D0038AED9D732CA13FA63C5EE7E5B9`，与 Release 候选一致。provenance 位于忽略目录 `artifacts/builds/local/local-20260924-083251-392d39dfb0/manifest.json`；构建源提交为 `39dd66965b49f5e7a74ee2a3341f3ed142acd5d0`，相关构建输入无未提交改动。
- 原根入口已校验备份至 `archive/executables/local/local-20260924-083251-392d39dfb0/Focused Moment.exe`，SHA-256 `BA71167AA310F890BAF382211208711F5A9F39ACC53CD1869F8590A34C90D952`，可用于恢复。
- Windows 原生隔离冒烟 `windows-native-20260924-083426-1fc83e8741` 通过：Release 副本可显示原生窗口，隔离存储/WebView2 路径正确，合成旧数据迁移成功且旧源保持不变。此脚本不覆盖计时控件、托盘、浮窗、音效和提醒等人工 UI 流程。

本版本按本地 Windows 构建与分支同步流程交付；不创建 GitHub Release、tag 或安装器。
