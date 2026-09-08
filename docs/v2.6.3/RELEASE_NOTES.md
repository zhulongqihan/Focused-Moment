# v2.6.3 · 夜谷品牌图标精修

## 主要变化

- 将 Night Valley 左侧品牌标志调整为概念图的居中 mint 环、右下开口和右上金色光点组合。
- 修正品牌标志因通用导航间距规则产生的水平偏移，并细调环线粗细、尺寸、发光和金点定位。
- 本版本只涉及品牌标志视觉精修，不改变 Today tab 图标、页面边框或计时路径行为。

## 验证

- `pnpm check`
- `pnpm test:frontend`（29 项通过）
- `pnpm build`
- `pnpm package:release`（Windows 安装包与可执行文件）
- GitHub Actions `release-macos.yml` 将按 v2.6.3 标签构建并上传 universal macOS 包。
