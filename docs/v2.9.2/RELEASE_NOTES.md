# v2.9.2 · Graphite Console 主题精修

发布日期：2026-09-09

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
- GitHub Checks `34350535611`：通过；macOS Native Smoke `34350535428`：通过；macOS Universal Release `34350728878`：通过。
- GitHub Release `v2.9.2` 已发布，四项资产均为 `uploaded`：Windows EXE、Windows Setup、Windows MSI、macOS Universal DMG。
- 资产 SHA-256：EXE `7f4bf850be1e3ad45a109f9faec27fd6df97b30b07589cb98eda015cb5126c24`；Setup `663d920c5e456ce3afd0f449c258ee908919be4df7e9f9324bb52e82a014e3ae`；MSI `b1f59ae78b494e574e37665f63dd1ce513031e90d1b09012d76224b5804ecb07`；Universal DMG `fd70541461cecdbd2122817be6ba6917d9680be992280762efe8a9e09c24023d`。

## 已知边界

- 本版本只精修 Graphite Console；Aurora Ocean 与 Botanical Library 已登记为后续独立精修任务，不把本次 Graphite 改动冒充三套主题全部完成。
- 当前 UI 回归仍运行在 Chromium + Tauri mock；macOS Native Smoke 与 Universal DMG 已通过发布链路验收。
