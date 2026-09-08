# v2.6.1 · 夜谷主题前端完成

## 主要变化

- 依据 `01-night-valley` 视觉逆向资料完成今日、计时、待办、记录、设置五个 Night Valley 真实页面；页面比例与主要坐标按 1487×1058 基准实现。
- 保留并接通真实 Tauri 数据与交互：计时模式、倒计时、待办关联、开始/暂停/继续、完成记录、待办创建/编辑/完成/删除、逾期分组、记录日期选择与编辑删除、提醒和音效设置、备份/恢复/清空数据。
- 将路径、计时舱、记录图表、统计卡片、设置面板和主题预览实现为可交互 HTML/SVG/CSS 层，不把概念图当作整张交互背景。
- 注册五套主题；本版本只完整实现 Night Valley，其余 Editorial Paper、Graphite Console、Aurora Ocean、Botanical Library 保留预览与禁用入口，不展示半成品页面。
- 补齐 1280/1024 窄桌面布局、高 DPI 检查、任意数量专注段、空待办、长历史记录和窄窗口无横向溢出回归覆盖。

## 验证

- `pnpm check`
- `pnpm test:frontend`（29 项通过）
- `pnpm build`
- `pnpm package:release`（Windows 安装包与可执行文件）
- GitHub Actions `release-macos.yml` 保留为 v2.6.1 的 universal macOS 构建与上传流程；本地 Windows 环境不宣称已产出 macOS 包。
