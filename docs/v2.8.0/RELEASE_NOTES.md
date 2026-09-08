# v2.8.0 · Aurora Ocean 极光海面

发布日期：2026-09-09

## 重点更新

- 新增第四套完整主题「极光海面 / Aurora Ocean」：今日、计时、待办、记录、设置五页均已落地。
- 以潮汐、极光与流动节奏为视觉核心，加入深海青、极光紫、柔和橙色信号与半透明潮汐表面。
- 主题继续复用共享计时、待办、记录、设置状态与动作，刷新后可保持主题选择，并对无效或未实现主题安全回退。
- 新增桌面宽度与压力尺寸覆盖，验证 1120、820、560、420px 下的页面边界和关键专注动作。

## 验证

- `pnpm check`
- `pnpm test:frontend`：55 passed
- `pnpm build`
- Rust `cargo fmt --check`、`cargo check --locked`、`cargo test --locked`
- Windows debug/release 打包与启动冒烟验证

## 已知边界

- Botanical Library 仍为概念预览，未计入本版本已实现主题。
- macOS 原生交互验收仍需真实 macOS 环境；CI 的 Universal DMG 构建仅作为打包证据。
