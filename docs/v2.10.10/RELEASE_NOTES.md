# v2.10.10 · 全主题用户体验复核与细节修复

## 变化

- 完成 Night Valley、Editorial Paper、Graphite Console、Aurora Ocean、Botanical Library 五套主题的今日、计时、待办、记录、设置共 25 个页面，每页至少三轮真实浏览器体验。
- 修复跨 Tab 保留长页面滚动位置导致新页面标题被顶出的问题；切换页面后回到新目的地顶部。
- 移除记录页中未接入的导出按钮、日期范围筛选占位、Night Valley 导出快捷键和 Graphite 虚构的响应延迟读数。
- 移除 Graphite 不可操作的环境音选择和其他主题未提供的 F11 快捷键说明，让设置页只保留真实可执行的控制。
- 修复 Editorial Paper 窄窗口下品牌栏占用导航网格导致第五个 Tab 换行的问题。
- 修复 Aurora Ocean 和 Botanical Library 七日图表日期按钮被放进 SVG 后实际尺寸为 0 的问题；日期点现在是可聚焦、可点击的 HTML 控件。

## 验证

- 逐页主体验：25 页 × 3 轮 = 75 轮；每页主操作成功，滚动复位、水平溢出、禁用占位、标题可见性、导航几何和焦点检查均无失败。
- 紧凑密度与宽/窄窗口专项：50 个组合，均无水平溢出、导航越界或标题不可见。
- 设置页内部锚点：20 个实际锚点全部存在并可到达；Editorial Paper 无内部锚点。
- 前端 Playwright：67/67；Vite：2062 modules；Rust：33/33；`cargo fmt --check`、`cargo check --locked`、`git diff --check` 均通过。

## 本地 Windows 资产

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.10.exe` | 23,730,688 | `669D351BAA62494974025F0969600AE09F5F502C2901F2246D7201ED9191BF54` |
| `Focused Moment Setup v2.10.10.exe` | 16,129,834 | `533E2DD0715EA3B9E411A73DEF92C6F721803FC02B345257262E5CC6A658F20A` |
| `Focused Moment_2.10.10_x64_en-US.msi` | 17,104,896 | `0C34EA36603DF0C185E3AF60FA8627A7B017C91D19145576F79825AEC2C98363` |

## GitHub Release 资产

| 文件 | 字节数 | 远端 SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.10.exe` | 23,730,688 | `669d351baa62494974025f0969600ae09f5f502c2901f2246d7201ed9191bf54` |
| `Focused.Moment.Setup.v2.10.10.exe` | 16,129,834 | `533e2dd0715ea3b9e411a73def92c6f721803fc02b345257262e5cc6a658f20a` |
| `Focused.Moment_2.10.10_x64_en-US.msi` | 17,104,896 | `0c34ea36603df0c185e3af60fa8627a7b017c91d19145576f79825aec2c98363` |
| `Focused.Moment_2.10.10_universal.dmg` | 34,257,708 | `ad6d944a503de6bfe38684862e9d703744013eab8b045dc9d708e3f3e979d34b` |

GitHub Release：[v2.10.10](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.10)，正式非 Draft、非 Pre-release，四项资产均为 `uploaded`。

## 远程验证

- Checks：`34636727552`，67/67 前端测试、Rust 格式/检查/测试全部通过。
- macOS Native Smoke：`34636727575`，原生存储与 bundle smoke 通过。
- macOS Release：`34636745046`，Universal bundle 构建并上传成功。
