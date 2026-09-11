# 2026-09-12 本地旧归档与构建产物清理清单

> 用户明确要求删除 v2.9.0 之前的本地归档及相关内容，并清理此前约 80 GiB 的构建产物。本清单在删除前生成；只处理已确认不属于用户数据、当前发布资产或 Git 历史的本地路径。

## 删除边界

- 仅删除下表列出的本地路径；不使用宽泛 glob，不触碰 `F:\Focused Moment Backups`。
- 不删除 Git tag、`.git` 历史、远程分支、GitHub Release 或远程 Release 资产。
- 保留 v2.9.0 及之后的版本文档和 QA 证据；保留 Git 已跟踪的 v2.9.0 之前历史文档，因为当前计划、资源清单或历史证据仍引用其中部分，删除只释放约 0.11 MiB 且会制造断链。
- 保留 `F:\Focused Moment Release Staging 20260911-2308` 中的 v2.10.9 资产、`.release\artifacts.debug.json`、`.release\artifacts.release.json`、`output\qa`、`.playwright-cli`、主题素材和根目录可执行文件。

## 删除目标（删除前核对）

| 精确路径 | 分类 | 文件数 | 字节数 | 删除理由 | 恢复方式 |
| --- | --- | ---: | ---: | --- | --- |
| `F:\Focused Moment Maintenance Archive 20260911-2016` | 外部维护归档 | 97,350 | 90,199,404,101 | 仅含 Cargo/Tauri、依赖、dist、测试结果等可再生生成物；用户明确要求清理 80+ GiB 构建归档 | 由锁文件、Cargo/Tauri 和现有脚本重新生成 |
| `F:\Focused Moment\src-tauri\target` | 当前构建缓存 | 10,027 | 6,795,811,901 | 当前 debug/release Cargo/Tauri 生成物，发布资产已有隔离暂存和远程副本 | `pnpm tauri build` |
| `F:\Focused Moment Clean Checkout 20260911-2028` | 临时验证 checkout | 22,783 | 5,113,763,078 | detached `ae6ac45`、工作树干净，仅用于 MAINT-06 验证；主仓库和 Git 历史保留 | 从 Git checkout 重建 |
| `F:\Focused Moment\node_modules` | 依赖安装物 | 16,345 | 144,357,978 | 可由 lockfile 重建 | `pnpm install --frozen-lockfile` |
| `F:\Focused Moment\dist` | Vite 构建物 | 12 | 14,727,316 | 可再生前端产物 | `pnpm build` |
| `F:\Focused Moment\test-results` | 临时测试结果 | 1 | 45 | Playwright 会重新生成 | `pnpm test:frontend` |
| `F:\Focused Moment\output\playwright\v2.6.5` | 旧版本 Playwright 证据 | 8 | 6,050,475 | v2.6.5 旧证据，无当前文件引用；保留其余 QA 证据 | 从 Git/历史运行重新生成（如仍可重现） |
| `F:\Focused Moment\.release\release-notes-1.6.2.md`、`release-notes-1.6.4.md`、`release-notes-v1.6.4.md`、`v1.8.0-desktop-check.png`、`v1.8.0-focused-check.png` | 旧发布辅助文件 | 5 | 314,933 | 无当前引用；当前发布仅使用两个 artifacts manifest | 从历史 tag 或 Release 记录恢复 |
| `F:\Focused Moment\docs\context_summary_20260906_1801.md`、`context_summary_20260909_0020.md`、`deprecated-ark-route.md`、`project-complete-summary.md` | 已被当前计划取代的本地摘要 | 4 | 25,283 | 忽略文件，无当前引用，用户要求清理归档 | 由当前 `PROJECT_PLAN.md` 和 Git 历史重建 |
| `F:\Focused Moment\docs\v*` 中 Git 未跟踪且被忽略、版本 `< 2.9.0` 的文件 | 旧忽略版本副本 | 95 | 53,481 | 与 Git 已跟踪历史分离，无当前引用；只删除 ignored 文件，不删除同目录下的 tracked 文件 | 从对应 tag 或 Release 记录恢复 |
| `F:\Focused Moment Native Smoke Data 20260911-2028`、5 个 `Native Timer Repro` 隔离目录 | 合成原生测试数据 | 16 | 7,291 | 仅为本轮 native 验证生成，未接触用户数据 | 重新运行隔离 native 测试 |

删除前合计约 102,274,515,882 字节（约 95.25 GiB）。上述路径均已检查存在；项目进程检查未发现正在使用 Focused Moment、Cargo、Playwright 或项目 pnpm 命令的进程。

## 执行结果

- 已成功删除表中全部 12 个目录目标：外部维护归档、临时 clean checkout、5 个隔离 native 测试目录、当前 `src-tauri\target`、`node_modules`、`dist`、`test-results` 和旧版 `output\playwright\v2.6.5`。
- 已成功删除表中 9 个显式文件目标，以及 95 个 v2.9.0 之前 Git 未跟踪且被忽略的旧版本文件；同时清理了删除后留下的空旧版本目录。
- 删除后复核：删除目标残留 0；保护目标缺失 0；`Focused Moment Backups` 仍有 2 个文件；v2.9.0 之前 ignored `docs/v*` 文件数为 0；未发现删除失败或路径越界。
- 删除后仍保留：`output` 440.18 MiB（当前 QA/Playwright 证据，不含已清理的 v2.6.5 子目录）、`.playwright-cli` 40.98 MiB、`docs` 100.47 MiB（含 Git 跟踪历史）、`.release` 当前两个 manifest、v2.10.9 发布暂存目录、主题素材、Git 历史和远程发布对象。
- 当前本地构建依赖和 Cargo/Vite 生成目录已按用户要求移除；下次本地开发或构建前，按现有锁文件执行 `pnpm install --frozen-lockfile` 和对应构建命令即可重新生成。
