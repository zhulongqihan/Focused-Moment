# v2.11.6 · Graphite Console cleanup and shared brand mark

## Version scope

- This patch follows `v2.11.5` and closes the latest user-visible feedback for the Graphite Console theme.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.5` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Removed shortcut hints from the Graphite Console Today and Todo pages.
- Removed the redundant bottom focus-status strip from the Graphite Console timer page.
- Unified the upper-left product mark across all five themes: one closed outer circle, one smaller inner ring, and one offset accent dot that stays inside the outer boundary.
- Split the Graphite Console Records trend heading into a readable Chinese title and an English archive code so “更长的路” is never clipped.
- Rebuilt Graphite Console Settings as a compact control surface: theme selection, accurate reminder switches, rhythm values, audio, and local data are grouped by use instead of a side navigation rail and unused visual sliders.
- Added regression coverage for shortcut removal, the simplified focus page, the Records heading, settings layout, and shared brand-mark geometry.

## Root causes addressed

- Graphite still rendered legacy shortcut/status components after the surrounding workflow no longer depended on them.
- Each theme had its own high-specificity logo geometry, so the same shared markup produced different circles, offsets, and dot positions.
- The Records panel used one flex heading for both a long Chinese title and a long English code, allowing the title to be squeezed at narrower widths.
- Settings retained an old navigation-and-slider composition even though the useful controls auto-save immediately through the existing persistence path.

## Verification

- `npm run test:frontend -- tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`: `138/138 PASS`.
- `npm run check`: PASS.
- `npm run build`: PASS, 2067 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `npm run package:release`: PASS; Tauri produced Windows x64 MSI and NSIS installers, plus portable/Setup exports.
- Windows Checks [`35008136360`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/35008136360): PASS in 18m18s; frontend reported `137 passed`, with one cross-theme date-todo reload timeout recovered on retry and marked flaky; TypeScript/build and Rust fmt/check/test all passed remotely.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.6.exe` | 23,850,496 | `2bd80378637c623386a2244bc2bc65ffbbcfdb2b76e98b43ed55cae01c12903a` |
| `Focused Moment Setup v2.11.6.exe` | 16,197,615 | `4c7388db52c56c9e4f7afc3109f8592794d9a78fe902d6b9b774e5a8f47bd944` |
| `Focused Moment_2.11.6_x64_en-US.msi` | 17,178,624 | `6aae342164a1e97884d8c218886b7d2b50e4e626d46a55a0ff5e6570c8c42e49` |

Local export paths: `Focused Moment v2.11.6.exe`, `Focused Moment Setup v2.11.6.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.6_x64_en-US.msi`.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
