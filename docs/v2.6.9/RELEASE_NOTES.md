# v2.6.9 · 夜谷计时路线蜿蜒曲线修复

## 修复内容

- 重新校准计时页七个阶段节点，缩短右侧末段的异常间距。
- 将原本偏平的阶段路线改为连续的多段贝塞尔曲线，形成概念图中的下行、回弹和上扬节奏。
- 调整阶段说明位置，使其与新的路线节点保持视觉对应。

## 验证

- `pnpm check`
- `pnpm exec playwright test tests/today-visual.spec.mjs`
- `pnpm build`
- `pnpm package:release`
