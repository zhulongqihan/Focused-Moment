# MAINT-03 仓库内容与引用审计

> 审计日期：2026-09-11
>
> 目的：在不改变计时/窗口逻辑的前提下，区分运行、构建、发布、用户数据、历史证据与明确死资源。基线为 `0bade576f1aa9e48a4f7e783c06ea270078b3b32`，清理前 tracked 283、untracked 0；本文件与清理 manifest 属维护记录，尚未作为用户功能说明。

## 结论摘要

- 只确认两项 tracked 脚手架资源没有任何源码、配置、脚本、测试或 README 引用：`public/vite.svg`、`public/tauri.svg`。它们已从当前工作树删除，待 MAINT-06 的干净 checkout 构建、启动和页面回归通过后作为最终删除提交的一部分收口。
- 没有发现可以在本工作单元安全删除的依赖、脚本、Tauri command、capability、页面组件、主题资源或 QA/Release 证据。
- `src/assets/logo.svg` 不属于删除候选：`index.html` 仍把它作为 favicon 引用；CSS 绘制的页面 logo 类名与该文件不是同一资源。
- 版本文档、旧版本 QA/Release notes、设计概念图与当前 runtime 资源具有追溯或发布价值；重复图像哈希只记录为审查信号，不作为删除依据。
- 138 个被忽略的 `docs/` 文件、`output/`、`.playwright-cli/`、`.release/`、根目录 EXE 和 `Focused Moment Backups/` 不在本次仓库内容删除范围内。

## 分类清单

### KEEP：运行与构建必须保留

| 范围 | 证据 |
| --- | --- |
| `src/`、`src-tauri/src/`、`src-tauri/capabilities/`、`src-tauri/tauri.conf.json` | `MainShell`、五套主题页面、计时/存储 runtime、Tauri command 与窗口配置共同构成应用；不能以文件名或暂时未命中某个页面为删除理由 |
| `src/assets/focus-trail-atmosphere-v3.png`、`v4.png` | `src/App.css` 多处 `url(...)` 引用，构建产物包含对应图片 |
| `src/assets/viral-quote-sample.mp3` | `src/MainShell.tsx` 通过 `new URL(..., import.meta.url)` 引用，属于提醒声音素材 |
| `src/assets/logo.svg` | `index.html` 的 favicon 仍引用 `/src/assets/logo.svg` |
| `src/data/copy-library.json` | `src/lib/copy-library.ts` 导入；README 与语料来源文档也引用 |
| `public/theme-previews/*.png` | `src/lib/themes.ts` 为五套主题显式提供预览路径；设置页和主题测试依赖 |
| `src-tauri/icons/`、`src-tauri/focused-moment-icon.svg` | Tauri bundle 的平台图标与构建资源；不按重复哈希删除 |
| `package.json`、`pnpm-lock.yaml`、TypeScript/Vite/Playwright 配置 | npm/pnpm 脚本、依赖解析、构建和测试入口；本轮没有修改 lockfile |
| `scripts/*.ps1`、`scripts/macos-native-smoke.sh` | 导出、清理、性能基线、发布和 macOS workflow 均有入口或引用；`export`/`publish` 脚本还读取 `.release` manifest |
| `.github/workflows/*.yml` | CI、macOS 原生 Smoke 和 macOS Release 的远程验收/发布入口 |
| `tests/*.mjs` | 67 项前端流程与视觉回归；清理后已重新通过 |

### KEEP：历史证据与项目治理

保留 `AGENTS.md`、`PROJECT_PLAN.md`、`PRODUCT.md`、`THEME_REFINEMENT_PROMPT.md`、`docs/qa/`、`docs/v*/`、`docs/design-references/`、`docs/content/` 和已跟踪的上下文/维护文档。它们分别承担协作协议、当前状态、产品边界、主题验收约束、回归证据、版本发布记录、设计基线、素材来源和维护追溯；历史内容不回写成当前事实。

### ARCHIVE：已处理的生成物

MAINT-02 中已将 `src-tauri/target`、`src-tauri/target-hotfix`、`src-tauri/target-checkaYyf1y`、`src-tauri/targetOmfbiC`、`node_modules`、`dist`、`test-results` 移入外部可恢复目录 `F:\Focused Moment Maintenance Archive 20260911-2016`。它们是 ignored 生成物，不属于 tracked 仓库内容；重建证据见 `cleanup-manifest-20260911-2016.md`。

### DELETE-CANDIDATE：明确无引用脚手架资源

| 路径 | 证据 | 当前动作 | 最终门槛 |
| --- | --- | --- | --- |
| `public/vite.svg` | 全仓库扫描（排除生成物、历史输出和依赖）无命中；非 `src`/HTML/配置引用 | 已从工作树删除 | 干净 checkout 的安装、构建、启动和页面回归通过后提交 |
| `public/tauri.svg` | 同上，无命中；构建后不存在业务引用 | 已从工作树删除 | 干净 checkout 的安装、构建、启动和页面回归通过后提交 |

删除理由是“无引用且为脚手架默认资源”，不是文件大小、年龄或名称猜测。若后续验证出现引用或构建依赖，应从 Git 恢复，而不是降低验证标准。

### REFACTOR-CANDIDATE：仅记录，不在本轮动手

- `src/App.css` 含多个历史主题/响应式覆盖层，存在未来按主题拆分或建立 token 层的重构空间；但它承载当前五套主题和压力宽度验收，本轮不做大范围重排。
- 历史文档数量较多，适合未来建立索引/归档目录；没有逐项确认来源、链接与法律/发布价值前，不移动或删除。

### UNKNOWN：需要额外证据或用户确认

- 被忽略的 `docs/` 文件和 `output/qa`、`output/playwright`：可能是本地 QA 证据或生成输入，不能按体量删除。
- `Focused Moment Backups/`：用户数据边界；本轮只核对目录属性和文件数量，不读取内容、不移动、不覆盖。
- GitHub 远程旧分支、旧 tag、旧 Release 和历史资产：涉及外部可见状态；MAINT-05 只形成清单并核对，不执行远程删除。
- 资源出处和许可信息：当前文档已记录部分来源，但不把未完成的法律核验写成已完成。

## 引用与依赖核对

| 检查面 | 结果 |
| --- | --- |
| 页面组件导入 | `ThemeSurface.tsx` 统一导入 Today、Night Valley、Editorial Paper、Graphite Console、Aurora Ocean、Botanical Library 视图；没有发现未接入主题文件 |
| CSS 引用 | `MainShell.tsx` 导入公共与四个主题 CSS；背景素材引用已逐项命中 |
| Tauri API/窗口 | `@tauri-apps/api` 在 runtime 交互组件中使用；窗口名、capability 与 Rust command 属运行链，不删除 |
| 直接依赖 | `solid-js`、`lucide-solid` 用于前端；`@tauri-apps/api` 用于桌面 API；Playwright、Tauri CLI、TypeScript、Vite 与 Solid plugin 分别有测试/构建配置引用 |
| 发布链 | `package.json` 的 package/export/release 脚本与 `.github/workflows`、`scripts/` 组成发布链；没有删除脚本或 lockfile 条目 |
| README | 旧 README 含 v2.10.8 用户说明，但对悬浮窗行为的描述需等 MAINT-04 按用户最新实测重写；这不是删除资源的依据 |

## 下一步

1. 在 MAINT-04 重写 README，只保留已验证的安装、使用、数据迁移和反馈说明。
2. 在 MAINT-05 核对 GitHub 分支、tag、Release、Actions 和 README，不删除 `v2.10.8` 任何对象。
3. 在 MAINT-06 用干净 checkout 验证两个删除候选，至少覆盖安装、构建、应用启动和现有页面回归；通过后才允许提交删除。
