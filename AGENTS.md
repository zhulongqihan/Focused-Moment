# Focused Moment Agent Workflow

## Current project plan

- Read `PROJECT_PLAN.md` at the repository root before continuing project work. It is the maintained project-wide status, priorities, acceptance criteria, and handoff entry for every model, including Luna.
- Reconcile its baseline with the current source, Git state, and latest user instructions before acting. Historical roadmaps and context summaries do not define current progress.
- Update the relevant task status, verification evidence, and next task in `PROJECT_PLAN.md` after each work unit, unless the task explicitly protects that user-owned file; in that case record the exception in the handoff report and leave it byte-for-byte unchanged. Planning-only documentation changes do not require an application version bump or rebuilt Release assets.

## Controlled verification guardrails

- Use the real repository root `F:\Focused Moment` for Git and workspace inspection, and run application commands from `F:\Focused Moment\app`; do not use a Junction, symlink, mirror, temporary checkout, or disposable worktree to make a test pass.
- Playwright evidence belongs under the ignored `artifacts/qa/frontend/<unique-run-id>/` directory. Use one run ID for the whole invocation and `test.info().outputPath(...)` for screenshots and JSON evidence; never write fixed-path test output that can collide with another run.
- Keep `PROJECT_PLAN.md`, the root `Focused Moment.exe`, installers, `artifacts/`, `archive/`, user data, backups, and pre-existing user changes protected unless a task explicitly authorizes them. A root executable is a directly testable entry only when its source/build provenance is recorded; an old binary or installer is not a substitute.
- Report browser-mock tests, Rust checks, and Windows-native application checks as separate evidence classes. Never treat a mock or a prior result as proof that an unrun native check passed.
- For one independent bug fix, once its related changes and required checks pass, default to committing and pushing that fix to the explicitly confirmed repository and branch. Multiple related changes for the same bug may share one complete commit, but do not defer an accepted independent fix until an unrelated interface is complete. Commit/push, remote CI, tag, GitHub Release, and asset upload are separate actions; formal release requires explicit authorization.

## Delivery and release discipline

- The confirmed Windows development root is `F:\Focused Moment`; keep `Focused Moment.exe` as the preferred existing entry. If application source or build inputs change, a delivered application entry must have matching build/source provenance; an old EXE, installer, or copied artifact is not a new delivery.
- Changes limited to tests, rules, or documentation that do not change application build inputs may keep the existing entry. Record “not rebuilt; entry unchanged” instead of inventing new build provenance.
- Normal CI and other authorized checkouts run from their actual checkout root; repository configuration must not hard-code `F:\Focused Moment`.
- Preserve the version synchronization and release-note rules below. Root-entry export failure detection remains follow-up work and is not implied by this section.
- Do not force-push, mix user changes, delete tests, weaken assertions, or increase retries to make verification pass. Junctions and mirrors are not valid test substitutes; this does not prohibit normal Git worktree use when separately authorized.

## Version discipline

- Do not keep shipping meaningful post-release changes under an old version number.
- When a released version receives additional user-visible changes, bump the version before publishing again.
- Patch-level updates (`1.x.y`) are appropriate for:
  - copy clarification
  - UI polish
  - bug fixes
  - release follow-up fixes
- Minor updates (`1.x.0`) are appropriate for:
  - new feature groups
  - meaningful workflow additions
  - larger experience changes

## Required version sync

- When the version changes, update all relevant sources together:
  - `app/package.json`
  - `app/src-tauri/Cargo.toml`
  - `app/src-tauri/tauri.conf.json`
  - `app/src-tauri/src/runtime.rs`
  - frontend snapshot version/milestone text
  - release notes/docs folder names when needed

## Release notes

- Each version bump should have matching release notes in `docs/`.
- GitHub Release notes should be refreshed to match the current shipped build, rather than pointing at stale notes from the previous state.

## Focused Moment repository boundaries

- 本次连续工作区重构对 `PROJECT_PLAN.md` 执行只读保护：保留开始时的真实字节与用户已有 diff，不修改、不暂存、不提交、不移动；本轮结果记录在 `docs/maintenance/workspace-migration.md`。
- 长期目录职责见 `docs/architecture.md`；README 是用户和开发命令入口。不要把被忽略且未跟踪的旧维护文档当作本轮文件覆盖或强制添加。
- `app/` 是完整应用工程：源码、Tauri/Rust、前端资源、测试、脚本、配置、锁文件、依赖和中间缓存都在这里；应用命令从此目录执行。
- `docs/` 只收正式产品、开发、架构、有效计划和提示词；测试生成物、旧执行报告和过期上下文记录分别进入 `artifacts/` 或 `archive/`，不改写历史记录中的原路径事实。
- `artifacts/qa/<class>/<unique-run-id>/` 保存当前测试、视觉、原生证据和日志；`artifacts/builds/local/<build-id>/` 保存当前根 EXE 的 provenance。它们不进入 Git。
- `archive/` 只放已核实身份的旧程序、旧安装器、历史报告和恢复副本；迁移清单与校验记录必须和恢复路径一起保留。`local/` 只放明确属于本机私有/工作中的资料，不得当作真实用户数据目录。
- `pnpm verify` 只运行静态、契约、fixture、结构、Playwright 输出 guardrail、交付脚本测试和 Rust 检查，不启动真实应用、不制作安装包、不发布；隔离 Windows 原生冒烟单独运行 `pnpm native:windows`。
- 应用输入改变并作为交付时，在 `app` 中使用 `pnpm package:local` 更新根目录 `Focused Moment.exe`，并把 provenance 写入 `artifacts/builds/local/<build-id>/`、旧入口恢复副本写入 `archive/executables/local/<build-id>/`；Debug、旧 EXE、安装器和日期挑选的文件不能替代 Release candidate。禁止自动 tag、GitHub Release、资产上传和安装器运行。
- 新文件归属规则：应用源码/配置/测试/开发脚本进 `app`；正式说明进 `docs`；当前构建/测试证据进 `artifacts`；确认过期的程序/报告进 `archive`；明确本地私有资料进 `local`；Git/CI/许可证/根 README/AGENTS 等仓库基础设施留在外层。真实数据、备份、未知私人资料和 `PROJECT_PLAN.md` 未获额外授权不得迁移。
- 提交前按路径检查 diff；`PROJECT_PLAN.md`、真实用户数据、用户备份、未知本地文件、旧历史二进制和工作树元数据始终不混入提交。独立验收单元通过后，默认提交并快进推送到已确认的 `main`。
