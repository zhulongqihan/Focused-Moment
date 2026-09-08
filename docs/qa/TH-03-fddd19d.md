# TH-03 · Graphite Console 五页主题

## 任务与提交

- 任务：`TH-03`
- 功能提交：`fddd19d` (`feat(theme): implement Graphite Console surfaces`)
- 日期：2026-09-09（Asia/Shanghai）
- 发布状态：源码候选完成，v2.7.0 版本同步、原生包、远程 CI、Windows/macOS Release 资产尚待 REL-01 收口；未把本地验证写成已发布。

## 实现范围

- 新增 `GraphiteConsoleViews.tsx` 与 `GraphiteConsoleViews.css`，接入今日、计时、待办、记录、设置五页。
- 通过 `ThemeSurface` 显式分派 Graphite，主题注册从禁用预览变为 `implemented: true`；Aurora Ocean 与 Botanical Library 继续禁用并安全回退。
- 保留 MainShell 的真实待办、计时、记录、备份、提醒和外观动作；Today → Focus → running 链路、Focus → 记录导航、主题保存/重载均有回归覆盖。
- 主题壳层覆盖旧 Night Valley 的固定高度、绝对定位侧栏、窄桌面工作区和背景伪元素，避免 Graphite 页面被旧壳层推到视口外或互相遮挡。
- 将 Night Valley 待办过期判断、Graphite 待办日期码改为本地日期键，修复本地午夜至 UTC 日期切换窗口的误判。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm exec playwright test tests/today-visual.spec.mjs -g "Graphite Console" --workers=1` | PASS，3/3；主题选择持久化、五页渲染、1120/820/560/420 压力宽度与启动链 |
| `pnpm test:frontend` | PASS，53/53 |
| `pnpm build` | PASS，Vite 2057 modules，11.24s |
| `git diff --check` | PASS |

## 证据

- 五页截图：`output/qa/TH-03/fddd19d/{today,focus,todos,records,settings}.png`
- 页面几何：`output/qa/TH-03/fddd19d/geometry.json`
- 视觉参考：`docs/design-references/concept-images/03-graphite-console/`

## 未完成边界

- 当前仍需按发布纪律同步到 v2.7.0，执行 debug/release 包验证、隔离启动冒烟、远程 Checks、Windows 资产、macOS Universal workflow/Release 资产与说明。
- CORE-03/DESK-02 的 macOS 原生数据目录、单实例、窗口交互和安装冒烟仍因没有 macOS 主机证据保持阻塞；本任务不伪造该平台证据。
