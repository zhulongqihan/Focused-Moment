# ARCH-01 验证报告

- 日期：2026-09-08
- 源码提交：`abf2bc4`（`refactor: establish theme rendering boundary`）
- 版本：`2.6.9`（未改版本号与已发布 Release）
- 目的：在不复制计时、存储、待办、记录和设置业务的前提下，建立主题页面渲染边界，并清理 `MainShell` 中已不可达的旧页面。

## 实现结果

- 新增 `src/components/ThemeSurface.tsx`，由它按当前页面把 Today、Focus、Todos、Records、Settings 的完整业务 props 交给 Night Valley 视图。
- `MainShell` 继续统一持有 signals、Tauri 调用、刷新和动作 handler，只负责组装数据/动作，不再直接承载五页页面 JSX。
- 新增 `src/components/ThemeSurface.css`，为主题边界的安全回退保留最小样式；未来主题通过显式实现映射接入，不复制壳层和状态机。
- 从 `MainShell` 删除四组 `Show when={false}` 旧视图及其专属 helper，删除无用的主壳层音效 input 引用；音效文件 input 改由 Settings 组件自身管理。
- 未知或未实现主题 ID 通过显式实现映射回退到 `night-valley`；现有 `implemented` 元数据仍只用于设置可用性，不作为未来主题页面的隐式渲染器。

## 验证

- `pnpm check`：PASS。
- `pnpm test:frontend`：PASS，45/45，约 1.3 分钟；最终源码复跑，包含五页视觉、命令面板、浮窗、倒计时、错误态、长历史和 30 秒编辑态计时用例。
- `pnpm exec playwright test tests/today-visual.spec.mjs -g "Theme registry exposes one implemented surface and four disabled previews" --workers=1`：PASS，1/1。
- `pnpm tauri build --debug`：PASS；包含最终 Vite 构建、Rust debug 编译、MSI 和 NSIS 打包。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：PASS。
- `git diff --check`：PASS。

最终 debug 产物（均为本次 `abf2bc4` 源码构建）：

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `src-tauri/target/debug/focused-moment.exe` | 28,151,808 bytes | `CB82C49A4189C54526508CF440FAA424AAF45C3E9E58482D404729C8C4DC5E6B` |
| `src-tauri/target/debug/bundle/msi/Focused Moment_2.6.9_x64_en-US.msi` | 18,481,152 bytes | `F91F58A019A3F8A977BADF44A5A1A2F030835BC35BB6F769BDCF7A0F456D1BFC` |
| `src-tauri/target/debug/bundle/nsis/Focused Moment_2.6.9_x64-setup.exe` | 16,653,482 bytes | `FC4F3875E8FBFDB0A728E77E82CB0CBCC676728B79B9B8B2FA014421BF5760A0` |

## 剩余边界

- 目前只建立了可替换边界，第二套 Editorial Paper 仍未实现，不能把五套主题标为可用。
- `App.css` 的完整 token/共享控件/主题页面分层仍需 QA-01 结合真实回归后继续收口；本任务没有为了减少行数大规模迁移级联规则。
- 本轮没有新增 macOS 原生窗口、单实例或安装证据；CORE-03 / DESK-02 的平台阻塞保持原记录。
- Release 资产与版本闭环留给 REL-01；本报告只记录 debug 包验证。
