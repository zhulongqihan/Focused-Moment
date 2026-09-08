# v2.6.7 · 夜谷共享品牌标记修复

## 修复内容

- 将左侧栏品牌标记统一为共享组件，不再根据 Today、计时、待办、记录、设置页面切换样式。
- 将圆环缺口固定在右上方，并让暖色圆点落在缺口中心位置。
- 统一所有页面的品牌文字排版，避免同一侧栏在不同页面出现两套视觉语言。

## 验证

- `pnpm check`
- `pnpm exec playwright test tests/today-visual.spec.mjs`
- `pnpm build`
- `pnpm package:release`
