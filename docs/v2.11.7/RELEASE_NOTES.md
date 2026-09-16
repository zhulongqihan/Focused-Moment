# v2.11.7 · Night Valley history and feedback polish

## Version scope

- This patch follows `v2.11.6` and closes the latest Night Valley history, todo layout, and feedback-notification issues.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.6` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Keep Night Valley record-day accordions stable while the app performs its one-second background refresh, so a manually collapsed day stays collapsed and can be inspected.
- Remove the unused third todo-board track, align the pending and completed columns, and let the completed list use the available board height without a needless scrollbar.
- Move action feedback into a fixed top-right toast layer instead of appending it below the page.
- Auto-dismiss toasts after five seconds and allow dismissal by clicking the toast, its close button, or the keyboard.
- Add regression coverage for refresh-safe record accordions, equal todo-column geometry, scrollbar removal, and toast placement/dismissal.

## Root causes addressed

- The records view rebuilt date-group objects on every one-second refresh. Solid then recreated the native `<details>` nodes, which reset their open state.
- The Night Valley todo board still reserved a legacy third grid track, while the completed list retained a fixed height and an extra top offset from the former layout.
- Feedback was rendered as normal document flow content, so it appeared at the bottom and had no lifecycle or dismissal interaction.

## Verification

- `npm run test:frontend -- tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`: `140/140 PASS`.
- `npm run check`: PASS.
- `npm run build`: PASS, 2067 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `npm run package:release`: PASS; Tauri produced Windows x64 MSI and NSIS installers, plus portable/Setup exports.

## Remote verification

- Windows Checks [`35053044558`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/35053044558): PASS in 17m26s; frontend reported `140 passed` and Rust fmt/check/test all passed.
- GitHub Release [`v2.11.7`](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.11.7) is published with all three Windows x64 assets uploaded; remote digests match the local SHA-256 values below.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.7.exe` | 23,850,496 | `6214cfbc73498d699b67b2c81cff391b7e49288e0e3ed725c73964d02ba63c0d` |
| `Focused Moment Setup v2.11.7.exe` | 16,198,089 | `d88ca1998fb87fd0c2661f5c3654d5c1c8eb724956589c40b306bb100d18c8fe` |
| `Focused Moment_2.11.7_x64_en-US.msi` | 17,178,624 | `aaabe1773117e0c50718a6612300f4ec81ec4b7811b22ab80b05e377800f3355` |

Local export paths: `Focused Moment v2.11.7.exe`, `Focused Moment Setup v2.11.7.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.7_x64_en-US.msi`.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
