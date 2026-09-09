# v2.10.0 · Aurora Ocean + Botanical Library 主题精修

发布日期：2026-09-09

## 重点更新

- Aurora Ocean 五页从通用控制台壳层改为深海极光 / 流体光场：轨道气泡、玻璃水滴、潮汐路径、液态计时环和深海档案图表各自对应真实业务状态。
- Botanical Library 五页从通用换色页面改为木质书房 / 植物生长档案：书架导航、木桌、纸卡、植物节点、暖灯、年轮计时盘和阅读生长图表形成独立视觉语言。
- 两套主题继续复用 MainShell 的真实待办、计时、记录、设置动作；主题层不制造固定任务、历史记录或伪造系统指标。
- 新增两套主题的五页结构断言、响应式压力宽度验证与独立截图证据，确保差异来自布局、材质、导航和交互反馈，而不是仅替换颜色。

## 验证

- `pnpm check`：通过。
- `pnpm build`：通过，2061 modules。
- `pnpm test:frontend -- --workers=1`：58/58 通过。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：33/33 library tests 通过。
- Windows 正式包已生成并上传：便携 EXE `a1239d72fab7ad48ed94465f4d0a5d502b5fe4e337a9e88d2bfdeb6a0a60a183`；Setup/NSIS `2ed00567a7ab9be0a34da3490336bf0b1e7d1a2e4cfbefd0d4d7c446335cbed3`；MSI `38db19662a37bd8348e36e300cf79a46276617804f379b77faa06fd5b012549f`。
- GitHub Checks `34364439803`：通过，前端 `58 passed (5.0m)`，Rust check/test 通过。
- macOS Native Smoke `34364439775`：通过。
- macOS Universal Release `34364312849`：通过并上传 Universal DMG。
- GitHub Release `v2.10.0`：四项资产均为 `uploaded`。Release digest：便携 EXE `a1239d72fab7ad48ed94465f4d0a5d502b5fe4e337a9e88d2bfdeb6a0a60a183`；Setup EXE `2ed00567a7ab9be0a34da3490336bf0b1e7d1a2e4cfbefd0d4d7c446335cbed3`；MSI `38db19662a37bd8348e36e300cf79a46276617804f379b77faa06fd5b012549f`；Universal DMG `5f126a92e975ebc0c1799edfbe4c82eecd6fe9d131b1e31580a2a3dbea00dabf`。

## 已知边界

- 浏览器回归运行在 Chromium + Tauri mock；macOS Native Smoke 与 Universal DMG workflow 已通过，但发布资产未做代码签名、公证或真实 `/Applications` 安装承诺。
- 本版本聚焦 Aurora Ocean 与 Botanical Library 的视觉重做，不改变共享业务状态机、数据格式或用户数据目录。
