# v2.9.0 · Botanical Library 植物书房

发布日期：2026-09-09

## 重点更新

- 新增第五套完整主题「植物书房 / Botanical Library」：今日、计时、待办、记录、设置五页均已落地。
- 以植物年轮、木质书架、纸张和安静生长为视觉核心，形成独立的木色、橄榄绿、金色信号与环形计时表面。
- 主题继续复用共享计时、待办、记录、设置状态与动作，刷新后保持主题选择，并对无效主题安全回退。
- 新增 Botanical 五页固定视口截图、几何元数据、主题注册回归和 1120、820、560、420px 压力宽度覆盖；420px 记录趋势线首尾日期标签不再横向溢出。

## 验证

- `pnpm check`
- `pnpm test:frontend`：57 passed
- Botanical 专项：3 passed；主题注册专项：1 passed
- `pnpm build`：2061 modules transformed
- Rust `cargo fmt --check`、`cargo check --locked`、`cargo test --locked` 与 Windows debug/release 包由本次 REL-01 收口流程执行

## 已知边界

- macOS 原生数据目录、第二实例、Finder/托盘/浮窗交互仍需真实 macOS 环境；Universal DMG 构建不能替代原生验收。
- 记录导出、环境音、自由笔记等没有现有业务支撑的概念能力仍保持明确禁用，没有在主题实现中伪造功能。
- DATA-01 的跨设备数据搬移流程继续等待 CORE-03 的 macOS 跨平台目录事实。
