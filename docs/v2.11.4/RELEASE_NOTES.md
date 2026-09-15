# v2.11.4 · Editorial Paper 今日页视觉收口

## 版本语义

- 本版本是 `v2.11.3` 发布后的 patch 更新，修复第二套“编辑纸页”主题在“今日”页的导航颜色问题，并收口产品图标与日期文案。
- 本次仅发布 Windows x64 资产；macOS 更新继续冻结。
- `v2.11.3` 的 tag、Release 和 Windows 资产保留为历史记录，不移动、不覆盖。

## 修复内容

- 修复编辑纸页点击“今日”后，侧边栏文字被全局 Today 状态误染成浅色的问题；标签颜色现在始终继承当前 Tab 的纸页主题，数量仍单独使用锈红色。
- 产品图标改为明确的“大圆套小圆”同心圆标记，移除旧的偏置圆点；顶栏图标和侧边栏品牌标记保持一致。
- 将没有实际含义的静态 `DAILY PLAN · VOL. 0905` 改为当天日期，例如 `DAILY PLAN · 2026.09.05`，避免把样稿编号误认为用户数据。
- 增加编辑纸页 Today 导航颜色、同心圆几何和日期文案的回归断言，并完成桌面截图核对。

## 本地验证

- `pnpm check`：PASS。
- 编辑纸页导航/图标/日期定向回归：PASS。
- 编辑纸页五页桌面渲染与截图回归：PASS。
- `pnpm exec playwright test tests/app.spec.mjs tests/today-visual.spec.mjs --workers=1`：`136/136 PASS`。
- `pnpm build`：PASS，2066 modules；Cargo fmt/check/test：`35/35 PASS`。
- `git diff --check`：PASS。
- `pnpm package:release`：PASS；portable、Setup/NSIS、MSI 产物版本均为 `2.11.4`。

## Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.11.4.exe` | 23,848,960 | `eb637e9727e4151658bd5b0afca3a3a3d8917f3dd0d8818b71bb721a1e9f3a3c` |
| `Focused Moment Setup v2.11.4.exe` | 16,198,499 | `fed4b589faf8fa74ec5dfc9c25366872a230bf831110443f4bab05654538220f` |
| `Focused Moment_2.11.4_x64_en-US.msi` | 17,178,624 | `67cff60d2af095c0ac26176c51d56e7d4a575ac74730a422f600c8babc1bcecb` |

本地导出路径：`Focused Moment v2.11.4.exe`、`Focused Moment Setup v2.11.4.exe`、`src-tauri/target/release/bundle/msi/Focused Moment_2.11.4_x64_en-US.msi`。

## 发布边界

- 发布目标：Windows x64 portable、Setup/NSIS、MSI。
- 不运行任何 macOS workflow。
- 不停止用户正在运行的应用进程。
