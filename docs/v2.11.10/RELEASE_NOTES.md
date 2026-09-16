# v2.11.10 · Editorial Paper visual and workspace refinements

## Version scope

- This patch follows `v2.11.9` and closes the latest Editorial Paper second-theme visual and information-architecture issues.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.9` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Make the Editorial Paper brand mark clear and consistent with all five themes: a visible outer ring, an enclosed inner partial ring, and the accent point inside the inner-ring gap.
- Align all five Editorial Paper sidebar labels to the same centered layout on every page.
- Restore a single-column document-flow rail at narrow desktop widths so shared cinematic absolute-position rules cannot overlap the five tabs.
- Keep long Editorial Paper record histories inside a bounded, thin-scrollbar reading surface while retaining per-day disclosure controls and expanded-day semantics.
- Replace the low-value Editorial Paper “专注节奏” settings section with useful workspace controls for visual intensity, motion intensity, and information density; the controls use the existing persisted shell settings.
- Add regression coverage for the shared mark geometry, centered navigation, bounded record history, useful settings controls, and pressure-width navigation across the five themes.

## Root causes addressed

- Editorial Paper’s pale, theme-local mark rules were overridden by shared cinematic selectors, and its thicker outer border changed the point’s effective pixel inset.
- The shared shell kept legacy `nth-of-type` absolute offsets and a five-column grid active at narrow desktop widths, so the Editorial Paper buttons occupied overlapping positions.
- The full record history had no local viewport, allowing many date groups and entries to expand the page indefinitely.
- The previous rhythm controls duplicated timer preferences without a clear workspace-level purpose; the replacement maps directly to persisted appearance behavior already used by the shell.

## Verification

- `pnpm test:frontend -- --workers=1`: `146/146 PASS`.
- `pnpm check`: PASS.
- `pnpm build`: PASS, 2067 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `pnpm package:release`: PASS; Tauri produced Windows x64 MSI and NSIS installers, plus portable/Setup exports. The exported EXE metadata reports version `2.11.10`.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.10.exe` | 23,852,544 | `9a1985d232ca91508a68a063bf62430c57c999e6cc2cb690c1f6eaf3a171ea9a` |
| `Focused Moment Setup v2.11.10.exe` | 16,201,726 | `30fa984bb2da6a312732f4f69c4229f2fb1e9e2be62f9fcf71b97f654a6baeb5` |
| `Focused Moment_2.11.10_x64_en-US.msi` | 17,182,720 | `93be252d59f95048f3c8fa7c56b1f392b6c7369d02e147313e2ed75ee1b6e87f` |

Local export paths: `Focused Moment v2.11.10.exe`, `Focused Moment Setup v2.11.10.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.10_x64_en-US.msi`.

## Remote verification

- Windows Checks [`35111971488`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/35111971488): success in 20m09s; the frontend report was `141 passed` with `5 flaky` entries recovered by the configured retry flow, and Rust format/check/tests plus the verification summary passed. The flaky entries were long single-worker navigation/reload pressure cases; the local run was `146/146 PASS`.
- GitHub Release [`v2.11.10`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.11.10) contains all three Windows x64 assets; remote asset sizes and SHA-256 digests match the local values above.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
