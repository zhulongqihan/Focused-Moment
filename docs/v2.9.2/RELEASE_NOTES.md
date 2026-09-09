# v2.9.2 · Graphite Console 主题精修

发布日期：待发布

## 重点更新

- Graphite Console 不再沿用“换色后的通用页面”骨架，改为工业控制台视觉：硬边金属机箱、铆钉面板、信号灯、密集序列槽位和本地控制状态栏。
- 今日页改为 7 个真实序列槽位；没有待办时显示明确的空闲槽位，不制造虚假任务数据。
- 计时页强化实体仪表盘与操作轨；待办页改为 QUEUED / ACTIVE / DONE 三座任务舱；记录页改为信号图表、事件日志和时段分析；设置页改为系统模块面板。
- 状态栏移除硬编码 CPU、内存和同步百分比，改为来自真实记录/计时状态的专注时长、段数、引擎状态与本地存储状态。
- 新增 Graphite 独立视觉回归断言，覆盖七槽位、三任务舱、硬边导航和新增布局边界。

## 验证

- `pnpm check`：通过。
- Graphite Console 定向回归：3/3 通过。
- 完整前端回归：并行运行首轮 57/58；唯一加载超时的 Editorial 压力用例串行重跑 1/1 通过，合计 58/58。
- `pnpm build`：通过，2061 modules。
- Windows / macOS 安装包、GitHub Checks、macOS Universal Release：待本版本发布闭环完成后补录。

## 已知边界

- 本版本只精修 Graphite Console；Aurora Ocean 与 Botanical Library 已登记为后续独立精修任务，不把本次 Graphite 改动冒充三套主题全部完成。
- 当前 UI 回归仍运行在 Chromium + Tauri mock；原生平台验收随发布流程补充。
