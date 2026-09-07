# v2.6.2 · 夜谷主题小窗适配

## 主要变化

- 修复窗口缩小到 820px 以下时页面内容被桌面壳层固定高度裁切的问题；Today、计时、待办、记录、设置页面现在会按真实内容增长并支持纵向滚动。
- 修复移动窄窗中透明顶部栏覆盖导航、导致待办、记录和设置无法点击的问题；保留命令入口的可操作性。
- 裁切 Today 外层装饰层的横向溢出，同时保留专注路径画布的内部横向浏览。

## 验证

- `pnpm check`
- `pnpm test:frontend`（29 项通过）
- `pnpm build`
- `pnpm package:release`（Windows 安装包与可执行文件）
- GitHub Actions `release-macos.yml` 将按 v2.6.2 标签构建并上传 universal macOS 包。
