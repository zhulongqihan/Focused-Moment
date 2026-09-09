# TH-05 · Botanical Library 五页主题专项证据

日期：2026-09-09  
源码提交：`acf3b2b`  主题实现提交 `feat(theme): implement Botanical Library surfaces`  
状态：REVIEW，等待 REL-01 版本化发布后转 DONE

## 交付范围

- 新增 `src/components/BotanicalLibraryViews.tsx`，实现今日、计时、待办、记录、设置五个真实页面。
- 新增 `src/components/BotanicalLibraryViews.css`，建立植物年轮、木质书架、纸张和安静生长的独立视觉层；窄屏首尾趋势日期标签向内对齐，避免 420px 横向溢出。
- 接入 `ThemeSurface`、`MainShell` 和 `src/lib/themes.ts`；主题从禁用预览变为可持久化、可切换的已实现主题。
- 五页继续复用 MainShell 的待办、计时、记录、设置动作和数据 props，没有复制业务状态机，也没有把导出/环境音等未接入能力伪装成可用功能。

## 验收证据

截图与几何元数据：`output/qa/TH-05/acf3b2b/`

- `today.png`
- `focus.png`
- `todos.png`
- `records.png`
- `settings.png`
- `geometry.json`：固定视口 `1487 × 1058`；五页边界均在视口内。

响应式专项覆盖 `1120 / 820 / 560 / 420px`：五页 surface 均不越界，并从今日页启动专注、切换计时页、进入运行中状态；420px 下记录页趋势线两端日期标签不再产生横向滚动。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `pnpm check` | PASS |
| `pnpm exec playwright test tests/today-visual.spec.mjs -g "Botanical Library"` | PASS，3/3 |
| `pnpm exec playwright test tests/today-visual.spec.mjs -g "Theme registry"` | PASS，1/1 |
| `pnpm test:frontend` | PASS，57/57 |
| `pnpm build` | PASS，2061 modules transformed |
| `git diff --check` | PASS |

## 边界与后续

- 本轮是浏览器/Tauri mock 与 Windows 工作区证据，不替代 CORE-03 要求的真实 macOS 数据目录、Finder、第二实例、托盘和浮窗原生验收。
- v2.8.0 已发布；Botanical 属于新增主题功能组，必须在 REL-01 中同步为 v2.9.0，完成本地包、远程 Checks、macOS Universal DMG、四项 Release 资产和说明核对后，TH-05 才能标记 DONE。
