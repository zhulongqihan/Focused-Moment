# v2.10.1 · Night Valley 今日页体验精修

发布日期：2026-09-10

## 重点更新

- 修复 Night Valley 今日路径节点信息容易被视口边界和单行省略隐藏的问题：边缘节点向内锚定，标题可换行，保留节点编号、标题和时间。
- 收紧今日路径的节点节奏，让路径从稀疏的长间隔改为更连续的蜿蜒波形。
- 移除今日页左下角的快速命令视觉入口；全局命令面板仍可通过 `Ctrl+K` 打开。
- 右侧卡片改为下一节点/当前状态信息卡，移除今日页的计时环、开始/暂停/完成动作；计时统一由第二个“计时”页承载。
- 右卡保留“查看计时”入口，点击后进入计时页，不改变真实待办、记录或计时状态机。

## 代码范围

- Night Valley 今日页：`src/components/TodayDashboard.tsx`、`src/App.css`。
- 命令面板关闭后的焦点回收：`src/MainShell.tsx`。
- 视觉与交互回归：`tests/today-visual.spec.mjs`、`tests/app.spec.mjs`。
- 证据：`docs/qa/REFINE-06-night-valley-today.md`。

## 验证

- `pnpm check`：通过。
- `pnpm exec playwright test tests/today-visual.spec.mjs --workers=1`：28/28 通过。
- `pnpm exec playwright test tests/app.spec.mjs --workers=1`：31/31 通过。
- `pnpm test:frontend -- --workers=1`：59/59 通过。
- `pnpm build`：通过，2061 modules transformed。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests 通过。
- `pnpm package:release`：通过，生成 Windows EXE、NSIS Setup 与 MSI。

## 发布资产

- 便携 EXE：`Focused Moment v2.10.1.exe`，SHA-256 `3DA2322844D8DC7DDF6032B9271BC0671D270461A94F16819CB19F8C170A83C`。
- Setup/NSIS：`Focused Moment Setup v2.10.1.exe`，SHA-256 `5A7009CD7A24BB9D1D19F819F1BB86EB2D68A44769088CFAF86A349B920260CF`。
- MSI：`Focused Moment_2.10.1_x64_en-US.msi`，SHA-256 `F8281C639C07AE2C3FA30EBA6F385219D5F04200B53FD620F678870E7CC80238`。
- 远程 CI、GitHub Release 链接、macOS Universal DMG 和远端 digest 将在 v2.10.1 正式收口后补录。
