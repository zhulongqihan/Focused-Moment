# Focused Moment

Focused Moment is a local-first desktop focus app built with Tauri + Svelte.

## Product Direction

- Core: Pomodoro timer, To-Do list, study time analytics.
- Creative mechanics: cyber pet growth, boss-round pomodoro, anti-procrastination challenge wheel.
- Web study flow: no hard ban. Uses whitelist + soft warnings + behavior logging.
- Privacy: all data is stored locally.

## Tech Stack

- Desktop shell: Tauri v2
- Frontend: SvelteKit + TypeScript
- Local storage (current stage): browser localStorage
- Planned storage upgrade: SQLite (Tauri plugin)

## Run Locally

```bash
npm install
npm run tauri dev
```

If Rust check is unstable on low-memory machines, use:

```bash
npm run check:desktop
```

## Build

```bash
npm run tauri build
```

## Current Implementation Status

- Replaced template UI with Focused Moment MVP shell.
- Added local-first logic for timer, todos, stats, whitelist flow, and creative mechanics.
- Removed template greet command from Rust backend.
- Added GitHub Actions workflow for Windows release builds.

## Repository Bootstrap

```bash
git init
git branch -M main
git remote add origin https://github.com/zhulongqihan/Focused-Moment.git
git add .
git commit -m "feat: initialize Focused Moment MVP"
git push -u origin main
```

## Release Flow

- Create a semantic tag like `v0.1.0`.
- Push the tag: `git push origin v0.1.0`.
- GitHub Actions will build and publish a Windows installer in Releases.

## Next Milestones

- Migrate persistence from localStorage to SQLite.
- Add export/import and automatic backup.
- Add GitHub Actions for Windows installer releases.
