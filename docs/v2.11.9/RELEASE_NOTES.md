# v2.11.9 · Cross-theme record persistence and progress accuracy

## Version scope

- This patch follows `v2.11.8` and closes the latest cross-theme records, brand-mark, and today-progress issues.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.8` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Keep a record day’s expanded/collapsed state stable while the application refreshes timer and record snapshots every second, across all five themes.
- Preserve the full record archive so date groups remain openable and previously saved rounds remain visible instead of snapping back during a refresh.
- Standardize the product mark across all five themes: an enclosed outer ring, an inner partial ring, and the accent point placed inside the inner ring’s gap.
- Calculate “today” completion from today’s todo set only: today’s completed todos divided by today’s pending plus completed todos, instead of mixing in historical items.
- Add cross-theme regression coverage for record expansion persistence, brand-mark geometry, and date-scoped completion percentages.

## Root causes addressed

- Record pages were resetting their controlled expansion state whenever a fresh array snapshot arrived from the one-second refresh loop. Night Valley also relied on native `details` state, which was not explicit enough for a refreshed reactive tree.
- The shared mark inherited several theme-specific ring and point rules, so its geometry drifted between themes and could place the point outside the inner ring.
- Todo progress used the global pending/completed totals even when the UI label described today’s progress, so historical completions could make an untouched day appear partially complete.

## Verification

- `pnpm exec playwright test --workers=1`: `145/145 PASS`.
- `pnpm check`: PASS.
- `pnpm build`: PASS, 2067 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `pnpm package:release`: PASS; Tauri produced Windows x64 MSI and NSIS installers, plus portable/Setup exports. The exported EXE metadata reports version `2.11.9`.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.9.exe` | 23,851,520 | `b613ee4ea7202d383c6f7877f007ca5bd0f11850b90e907868051cfef695422a` |
| `Focused Moment Setup v2.11.9.exe` | 16,199,247 | `9fc7198144d6f87fde7078eebf1eed1f4f04c6aecacc40ba577ac6d4b47cfffc` |
| `Focused Moment_2.11.9_x64_en-US.msi` | 17,182,720 | `4856110fdddae0ba3f335fd53c0f079cebd47441a4b9bac981e4a3da312d903d` |

Local export paths: `Focused Moment v2.11.9.exe`, `Focused Moment Setup v2.11.9.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.9_x64_en-US.msi`.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
