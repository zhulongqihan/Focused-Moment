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
- Windows 正式包已生成：便携 EXE `110c5047476f159403e10fbb5d0d5a17f11f417938f9c86f0b2b1f5cf6436768`；Setup/NSIS `933f26ead6df14bcea11f8c355a041d285d4be00ac3d120ac6c2bd10462ac1a4`；MSI `eb44afb18a868ab2404a9b5773457b26f604280d12dc85058e8bfdd0ca82c11e`。
- macOS 原生 Smoke、Universal DMG、远程 CI、GitHub Release 资产与最终 digest 将在正式发布收口后补录。

## 已知边界

- 浏览器回归运行在 Chromium + Tauri mock；macOS 原生与 Universal DMG 仍依赖本版本远程 workflow 的最终结果。
- 本版本聚焦 Aurora Ocean 与 Botanical Library 的视觉重做，不改变共享业务状态机、数据格式或用户数据目录。
