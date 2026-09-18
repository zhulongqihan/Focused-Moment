# Workspace/app 分离迁移记录

状态：完成（结构迁移、提交推送、根 EXE 重建、原生验证和复验均已通过）。

## 约束

- 仓库根仍为 `F:\Focused Moment`，不移动或重建 `.git`，不创建第二套仓库、镜像或 Junction。
- `PROJECT_PLAN.md`、`Focused Moment Backups/`、真实用户数据和未知私人资料保持原位；本记录不替代它们，也不修改其字节。
- 迁移前已存在且原来被 `.gitignore` 保护的本地设计分析和开发记录仍留在 `docs/` 原位；它们不进入本次提交，避免把未知本地资料上传到 GitHub。
- 应用命令从 `app/` 执行；固定交付入口仍是根目录 `Focused Moment.exe`。
- 本轮不运行安装器，不创建 tag/Release，不上传安装包。

## 实际迁移映射

| 原位置 | 目标位置 | 处理理由 |
| --- | --- | --- |
| 根 `index.html`、`package.json`、`pnpm-lock.yaml`、前端/资源/测试/脚本/配置 | `app/` 对应位置 | 完整应用工程唯一入口 |
| 根 `dist/`、`node_modules/`、`src-tauri/target/` | `app/` 对应构建/依赖位置 | 保留现有依赖和中间缓存，不升级版本 |
| 根 `.vscode/`、`.impeccable/` | `app/` 对应开发配置 | 应用开发配置不再散落外层 |
| `PRODUCT.md`、`THEME_REFINEMENT_PROMPT.md` | `docs/product.md`、`docs/prompts/` | 正式产品说明和提示词 |
| `docs/qa/`、根 `output/qa/`、根 `test-results/`、`.playwright-cli/` | `archive/reports/qa/`、`archive/qa/` | 已有历史测试生成物，保留但不混入正式文档 |
| 根 `output/*.mjs`、`output/playwright/*.mjs` | `app/scripts/visual-audit/` | 仍是开发工具，输出改为唯一运行目录 |
| `output/xiaohongshu/` | `local/marketing/xiaohongshu-20260916/` | 明确命名的本地营销草稿，不作为应用数据 |
| `.release/local/` | `artifacts/builds/local-history/` | 保留历史 provenance 原文 |
| `.release/archive/` | `archive/executables/local-history/` | 保留历史入口恢复副本 |
| `.release` 其余内容 | `archive/release-history/.release/` | 保留旧记录的原始层级和事实 |
| 根旧 Setup/portable EXE（不含当前固定入口） | `archive/executables/legacy-programs/` | 文件名与类型已核实，迁移前先保留校验 |
| `docs/context_summary_*`、过期维护清单、版本目录中的测试/计划材料 | `archive/context-summaries/`、`archive/reports/` | 历史记录归档，不篡改内容 |

完整文件级大小、SHA-256、原路径和目标路径见 `archive/MIGRATION_MANIFEST.json`。旧构建记录本身不改写；新增路径只在本记录和迁移清单中表达。

## 风险与控制

- 旧 QA fixture 中存在迁移前生成的 Junction，且目标已不再存在；迁移时以目录级操作保留它，没有创建新链接，也没有让当前工程依赖它。
- `node_modules` 是 pnpm 依赖目录，未手工搬动其内部链接、未升级依赖；移动后只从 `app/` 运行锁文件安装/检查。
- 应用路径变化会改变构建输入，因此最终根 EXE 必须由 `app` 的真实 Release 构建重新生成，并以新的 provenance 和 SHA-256 验收；旧根入口由交付脚本写入归档恢复副本。
- 运行测试只使用 Playwright mock、临时 fixture 和隔离 Windows native 目录，不访问 `%LOCALAPPDATA%\FocusedMoment` 真实数据，也不读取备份内容。

## 最终验收结论

- 外层已经完成物理分区：应用工程仅在 `app/`；正式文档在 `docs/`；当前构建/验证证据预留在 `artifacts/`；历史材料在 `archive/`；明确本地资料在 `local/`。
- `app` 已通过 `pnpm verify`、`pnpm build`、锁文件冻结安装后的依赖解析、以及 35 项 Rust 单元测试；全量 Playwright 为 143/146，3 项仅发生并发导航超时，按原断言单 worker 隔离重跑为 3/3 通过。
- `pnpm test:local-delivery` 的 7 个本地交付契约用例通过；根目录 EXE 和 Windows 原生冒烟已在提交后的干净应用源码快照上重建并验证。
- 根目录 EXE 已从提交 `6e930c04eaa4f6a91094889d3f594b66db423e4c` 的 `app/` 工程重建：build ID 为 `local-20260918-103807-46a19d6d2a`，候选文件为 `app/src-tauri/target/release/focused-moment.exe`，根入口为 `Focused Moment.exe`，两者 SHA-256 均为 `CD502B2CEFCCBD9745FCFF59D8F4CF0BF4ABC96A1BF8F661FDA09B2954EDA1F0`。完整 provenance 在 `artifacts/builds/local/local-20260918-103807-46a19d6d2a/manifest.json`。
- 重建前的根入口已恢复性归档至 `archive/executables/local/local-20260918-103807-46a19d6d2a/Focused Moment.exe`，原 SHA-256 为 `FD757D77D44187C8F47219E25DC8AFEA821940313E19BC19BF95CC0ECFE338D1`；没有覆盖式丢弃旧入口。
- `pnpm verify` 在重建后再次通过：TypeScript、CSS canonical hash、workspace/docs/artifacts 结构、Playwright 输出护栏、负向结构用例、44 个 Rust command/43 个前端调用/3 个事件契约、7 个本地交付契约、Rust fmt/check 与 35 个 Rust 单元测试均通过。仅保留既有 `runtime.rs` 未使用 import warning。
- Windows 原生冒烟 `windows-native-20260918-104224-f16eae0af4` 通过，报告位于 `artifacts/qa/native/windows-native-20260918-104224-f16eae0af4/report.md`；源 EXE 与隔离 QA 副本哈希一致，测试使用临时 `LOCALAPPDATA`/WebView2/工作目录。
- Playwright 全量运行 `workspace-migration-frontend-inv-mu6bx9ta-20340-ea34f6ce-c1e4-4182-b93b-b432f94d732a` 为 143/146；3 项是并发导航/交互超时而非断言失败。原断言在单 worker 运行 `workspace-migration-single-worker-inv-mu6cf55g-34516-810d53ee-fbc7-48db-84a2-beb3440ae7b0` 中 3/3 通过；没有修改断言、增加重试或减少回归覆盖。
- 重建和测试后再次检查实际文件系统（含 ignored 内容）：根层没有 `package.json`、锁文件、源码、依赖、测试目录、`output/`、`.release/` 或旧安装包；应用生成物在 `app/dist`/`app/src-tauri/target`，证据和 provenance 在 `artifacts/`，旧材料在 `archive/`。
- 保护项：`PROJECT_PLAN.md` 哈希仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；备份、真实数据、未知私人资料保持原位。

当前 Git 工作树只保留这一项受保护的既有修改：`PROJECT_PLAN.md`；`HEAD` 与 `origin/main` 均为 `6e930c0`。归档内仍可见迁移前 fixture 自带的 4 个历史 Junction，它们没有被新建、没有被当前工程引用，原始目标事实记录在 `archive/MIGRATION_MANIFEST.json`。
