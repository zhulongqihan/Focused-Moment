# v2.6.6 · 夜谷窄窗口可用性修复

## 修复内容

- 修复 Today 页面在 821–1160px 窄桌面窗口下隐藏左侧品牌与导航图标的问题。
- 将“下一站专注”操作卡片放回路径右侧首屏，确保“开始专注”无需先滚动页面即可使用。
- 保留路径区域的横向浏览能力，并避免窄窗口下页面内容被推到不可见区域。

## 验证

- `pnpm check`
- `pnpm exec playwright test tests/today-visual.spec.mjs`
- `pnpm exec playwright test tests/app.spec.mjs -g "Today cockpit remains usable on a narrow window"`
- `pnpm build`
- `pnpm package:release`

已知无关测试问题：`overdue todos are shown in their own status section` 仍因 `.todo-row__overdue-label` 选择器找不到而失败，与本次 Today 窄窗口布局改动无关。
