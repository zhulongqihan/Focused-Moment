# Focused Moment Agent Workflow

## Current project plan

- Read `PROJECT_PLAN.md` at the repository root before continuing project work. It is the maintained project-wide status, priorities, acceptance criteria, and handoff entry for every model, including Luna.
- Reconcile its baseline with the current source, Git state, and latest user instructions before acting. Historical roadmaps and context summaries do not define current progress.
- Update the relevant task status, verification evidence, and next task in `PROJECT_PLAN.md` after each work unit, unless the task explicitly protects that user-owned file; in that case record the exception in the handoff report and leave it byte-for-byte unchanged. Planning-only documentation changes do not require an application version bump or rebuilt Release assets.

## Controlled verification guardrails

- Run project commands from the real repository root `F:\Focused Moment`; do not use a Junction, symlink, mirror, temporary checkout, or disposable worktree to make a test pass.
- Playwright evidence belongs under the ignored `output/qa/frontend/<unique-run-id>/` directory. Use one run ID for the whole invocation and `test.info().outputPath(...)` for screenshots and JSON evidence; never write fixed-path test output that can collide with another run.
- Keep `PROJECT_PLAN.md`, the root `Focused Moment.exe`, installers, `.release/`, user data, backups, and pre-existing user changes protected unless a task explicitly authorizes them. A root executable is a directly testable entry only when its source/build provenance is recorded; an old binary or installer is not a substitute.
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
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/src/runtime.rs`
  - frontend snapshot version/milestone text
  - release notes/docs folder names when needed

## Release notes

- Each version bump should have matching release notes in `docs/`.
- GitHub Release notes should be refreshed to match the current shipped build, rather than pointing at stale notes from the previous state.
