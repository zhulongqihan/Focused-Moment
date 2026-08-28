# Focused Moment v2.0.8

## 阶段性目标状态修正

- 修正重新保存计时设置时的阶段索引同步，避免已有正向计时漏掉应有的阶段提醒。
- 保持 25、45、60、90、120 分钟阶段目标和持续计时行为不变。

## 验证

- `pnpm check`
- `pnpm build`
- `pnpm test:frontend`（8 项通过）
- `cargo fmt --check`
- `cargo test`（9 项通过）
