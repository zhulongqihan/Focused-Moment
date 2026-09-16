# v2.11.8 · Cross-theme shell and Aurora layout polish

## Version scope

- This patch follows `v2.11.7` and closes the latest cross-theme window-shell, notification, settings, and Aurora Ocean layout issues.
- This release targets Windows x64 assets only; macOS workflows remain frozen.
- The `v2.11.7` tag, Release, and Windows assets remain unchanged as historical artifacts.

## Fixes

- Make Editorial Paper rhythm settings useful and explicit: focus/rest presets now configure the next Pomodoro, while the stopwatch reminder has its own clearly labeled duration.
- Keep action feedback in a shared top-right toast layer across all five themes, with theme-appropriate colors, five-second auto-dismissal, click dismissal, close-button dismissal, and keyboard dismissal.
- Restore Graphite Console's native minimize, maximize/restore, and close controls, and restore a real draggable top-bar surface without adding a second visible header.
- Remove the Aurora Ocean archive page's stray decorative ellipse, allow the page to grow naturally, and preserve long task, orbit, record, and archive labels instead of silently clipping them.
- Add cross-theme regression coverage for rhythm presets, toast geometry and dismissal, Graphite window controls/dragging, and Aurora full-label layout behavior.

## Root causes addressed

- Editorial Paper's previous rhythm block exposed raw values without explaining their effect; the new presets and copy connect each value to the actual timer behavior.
- Graphite Console hid the shared app bar wholesale. That removed both the native window controls and the only drag surface; the app bar is now a transparent interaction layer with a visible drag hit area and theme-styled controls.
- Aurora Ocean used a large pseudo-element ellipse and several single-line ellipsis rules. The pseudo-element visually crossed the records page, while the clipping rules hid user data and the fixed page assumptions cut off lower content.

## Verification

- `npm run test:frontend -- --workers=1`: `143/143 PASS`.
- `npm run check`: PASS.
- `npm run build`: PASS, 2067 modules.
- `git diff --check`: PASS.
- `cargo fmt --check`: PASS.
- `cargo check --locked`: PASS.
- `cargo test --locked`: `35/35 PASS`.
- `npm run package:release`: PASS; Tauri produced Windows x64 MSI and NSIS installers, plus portable/Setup exports.

## Remote verification

- Windows Checks: pending the release commit.
- GitHub Release: pending candidate packaging and Windows asset upload.

## Windows assets

| File | Size | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.8.exe` | 23,852,032 | `371fba470e6b3d24b04d747927e37625dcc41ba36e1c31b33f2233feb81a0a18` |
| `Focused Moment Setup v2.11.8.exe` | 16,194,496 | `02a72d751ff31d8a8a4601b6bceb8a86e4850c861c6ff14b8913c37fc354fc05` |
| `Focused Moment_2.11.8_x64_en-US.msi` | 17,186,816 | `b16e0707b46026f02970f1ab7546c5e80567bee18f520953655b52af87f04eac` |

Local export paths: `Focused Moment v2.11.8.exe`, `Focused Moment Setup v2.11.8.exe`, and `src-tauri/target/release/bundle/msi/Focused Moment_2.11.8_x64_en-US.msi`.

## Release boundary

- Release targets: Windows x64 portable, Setup/NSIS, and MSI.
- Do not run any macOS workflow.
- Do not stop a user-run Focused Moment process.
