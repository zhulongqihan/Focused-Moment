# Focused Moment Agent Workflow

## Release discipline

- Every user-facing change that is considered complete should be treated as a release candidate, not left only in the local workspace.
- After finishing a releasable change, default to:
  1. build verification
  2. package verification
  3. commit
  4. push to GitHub
  5. update the matching GitHub Release assets and notes

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
