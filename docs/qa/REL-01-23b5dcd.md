# REL-01 v2.7.0 发布闭环证据

## 结论

REL-01 在提交 `23b5dcd` 上完成。v2.7.0 已同步版本源、生成 Windows debug/release 产物、完成隔离启动冒烟，推送 `main` 与 `v2.7.0` tag，远程 Checks 与 macOS Universal workflow 均通过，GitHub Release 已包含 Windows EXE、NSIS、MSI 和 macOS Universal DMG 四项资产。旧 `v2.6.10` tag 未移动。

Release：<https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.7.0>

## 版本与提交

- 发布提交：`23b5dcd chore(release): prepare v2.7.0`
- 功能基线：`fddd19d`（TH-03 Graphite Console）
- tag：`v2.7.0`，指向 `23b5dcd`
- 远程分支：`origin/main` 已指向 `23b5dcd`
- 版本源：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`README.md`、`docs/v2.7.0/RELEASE_NOTES.md`

## 本地验证

- `pnpm check`：PASS
- `pnpm test:frontend`：53/53 PASS
- Graphite 定向回归：3/3 PASS（记录在 TH-03 报告）
- `pnpm build`：PASS，2057 modules
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：PASS
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：32/32 PASS
- `pnpm package:debug`：PASS
- `pnpm package:release`：PASS，MSI 与 NSIS 均生成
- release EXE 隔离启动：PASS；窗口标题为 `Focused Moment`，文件版本与产品版本均为 `2.7.0`；测试进程按 PID 清理
- `git diff --check`：PASS（仅报告 Git 的 LF/CRLF 转换提示）

### 本地产物 SHA-256

| Profile | 产物 | SHA-256 |
| --- | --- | --- |
| debug | `Focused Moment v2.7.0.exe` | `6e390b524b9765eb21050887e45e43c4f511e7ce33d8c669753d969842cde9f5` |
| debug | `Focused Moment Setup v2.7.0.exe` | `aca3916908804ddfa20521e1592f2e8ee44467b382cc5ec16f79ee6c773d68ce` |
| release | `Focused Moment v2.7.0.exe` | `738ccfbd25fbea64e707e3f9c764f6e06897c0fc857a08e466415895a8fe8c3b` |
| release | `Focused Moment Setup v2.7.0.exe` | `d76613219045f6fae85ed0e36fc6af04ba8660477d77fbd5a1a9f5d042082068` |
| release | `Focused Moment_2.7.0_x64_en-US.msi` | `868bb774fa140b05c95ef6740c9cb83026f73d090bc67f8936c0bfa847eb27a8` |

## 远程验证与 Release 资产

- Checks run [`34252232261`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34252232261)：PASS；前端 flow 53 passed，TypeScript/Vite/Rust format/check/test 均通过。
- macOS Release run [`34252244006`](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34252244006)：PASS；Universal macOS bundle 构建并上传成功。

| Release 资产 | GitHub digest |
| --- | --- |
| `Focused.Moment.v2.7.0.exe` | `sha256:738ccfbd25fbea64e707e3f9c764f6e06897c0fc857a08e466415895a8fe8c3b` |
| `Focused.Moment.Setup.v2.7.0.exe` | `sha256:d76613219045f6fae85ed0e36fc6af04ba8660477d77fbd5a1a9f5d042082068` |
| `Focused.Moment_2.7.0_x64_en-US.msi` | `sha256:868bb774fa140b05c95ef6740c9cb83026f73d090bc67f8936c0bfa847eb27a8` |
| `Focused.Moment_2.7.0_universal.dmg` | `sha256:d8c9460b923a2beccab6d9f394fdcc1e1f2f913cce60d007641db0805c6cf956` |

## 边界

macOS workflow 证明 Universal DMG 能在 GitHub macOS runner 上构建并上传，不等于本机 Finder、托盘、第二实例、数据目录或窗口交互的原生验收；这些仍由 CORE-03/DESK-02 负责。Chromium/Tauri mock 的页面回归也不扩展为所有设备上的绝对性能承诺。
