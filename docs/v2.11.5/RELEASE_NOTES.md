# v2.11.5 · Editorial Paper interaction and todo rhythm fixes

## Version scope

- This patch follows `v2.11.4` and closes the latest user-visible interface feedback across the Editorial Paper theme and the shared todo layout used by all five themes.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.4` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Restored the Editorial Paper brand mark's offset accent dot and placed both the inner ring and dot fully inside the outer ring.
- Stabilized the Editorial Paper timer shell so switching to “计时” no longer causes the desktop workspace to contract toward the center.
- Matched the five Editorial Paper page headings to the Today page's readable title scale.
- Replaced the pending/active/middle-column todo layout with date-grouped, collapsible pending sections plus a completed column in Editorial Paper, Graphite Console, Aurora Ocean, and Botanical Library. Overdue items are included in their date group instead of disappearing from the pending view.
- Kept local scrolling inside expanded date groups so a long todo list does not create one oversized page scroll area.
- Replaced the unused Settings shortcut panel in the four affected themes with persistent focus-rhythm controls for focus, break, and stopwatch reminder minutes.

## Root causes addressed

- The brand mark was being overridden by higher-specificity shared cinematic navigation rules, which pushed the inner ring outside the outer mark and hid the accent dot.
- The timer page inherited an intrinsic-width layout that changed the workspace grid when its wider panel mounted.
- Todo columns were duplicated independently in each theme, so the old middle state survived even after it stopped carrying useful work. Date grouping now uses a shared component and a stable pending data source that combines active and overdue items.
- Settings exposed shortcut copy without a useful theme-specific control surface; the replacement writes real timer preferences through the existing persistence path.

## Verification

- `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`: `138/138 PASS`.
- `pnpm check`: PASS.
- `pnpm build`: PASS, 2066 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `pnpm package:release`: PASS; the Tauri release bundle produced Windows x64 MSI and NSIS installers, and the portable/Setup exports were generated.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.5.exe` | 23,849,984 | `01009c0175f724fec7369991825a44cb6ca9d71159d99e7b38512bc2c3e597fc` |
| `Focused Moment Setup v2.11.5.exe` | 16,194,184 | `99578c2177f3323abb9e2105d18defe875828336e55674946f3f6a2da735b29a` |
| `Focused Moment_2.11.5_x64_en-US.msi` | 17,182,720 | `96925fb2df13a7606c1c3e810d9aee67ac6fe75adacec1e528995bcb0099b5a7` |

Local export paths: `Focused Moment v2.11.5.exe`, `Focused Moment Setup v2.11.5.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.5_x64_en-US.msi`.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
