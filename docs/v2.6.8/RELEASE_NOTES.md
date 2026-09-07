# v2.6.8 · 夜谷共享左侧导航模块统一

## 修复内容

- 将今日、计时、待办、记录、设置统一为同一个左侧导航模块，不再按页面切换不同宽度和布局。
- 恢复所有导航入口的图标，并统一图标尺寸、文字间距和 tab 基础样式。
- 统一各页面当前 tab 的圆角渐变胶囊状态，切换页面只改变选中项。

## 验证

- `pnpm check`
- `pnpm exec playwright test tests/today-visual.spec.mjs`
- `pnpm build`
- `pnpm package:release`
