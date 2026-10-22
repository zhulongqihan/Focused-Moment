# Focused Moment v2.14.2

## 启动与主题

- 首页先显示并启用常用操作，再在需要时加载其他主题和非关键内容。
- 主题切换期间继续使用当前界面；加载失败时可重试或返回当前主题。
- 主题预览改用轻量 WebP 衍生图，保留原始 PNG。

## 验收摘要

- 生产浏览器首次可操作时加载 228,261 字节 JavaScript，较 2.14.0 的 934,750 字节基线减少 75.58%。
- 七张主题预览 WebP 合计 266,706 字节。
- 本地 Windows Release 与隔离原生验收记录见 `docs/maintenance/optimization-plan.md` 和 `artifacts/`。
