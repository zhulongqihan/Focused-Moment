# Focused Moment 2.13.2

## 赛场主题人物视觉区分

- 今日赛场首页、专注计时和战术板中的 Jimmy Butler 视觉现在各自采用独立表达：赛场主视觉海报、低饱和关键时刻肖像、以及轻量战术板签条。
- 每种人物卡使用明确的变体样式、对应文案与不同素材处理；保持原有页面布局、计时与待办行为不变。
- 增加视觉回归断言，验证三页各自的样式标识、图片素材、文案和关键呈现属性。

## 验证与交付

- `pnpm test:frontend -- --workers=1`：156 项通过，覆盖三页人物样式、五主题页面、概念对照截图与桌面/平板/手机布局。
- `pnpm verify`：通过；包含 CSS/结构/本地交付契约检查、Rust 格式/检查及 39 项 Rust 单元测试。
- `pnpm build`：Vite 生产构建成功。
- 根目录 Release EXE 版本 `2.13.2`，34,908,672 字节，SHA-256 `AE8E65FC7BFE156C022B9D9A5D9170048BFC99CBB5848C6BAEFD4B5837F61F91`；与构建候选哈希一致。Build ID：`local-20260926-122555-26ff6fc585`。
- 构建来源为提交 `31d3c033bd9d2c96e7ee724f7e8c7ea48b0da0b0`（`codex/focused-moment-continuity`）；179 项构建输入指纹为 `76094645F418576AD9F08066603FBC92F1BB1C459D4E15D6BEC04E2C5136CC27`，相关输入无未提交改动。Manifest 与交付日志位于 `artifacts/builds/local/local-20260926-122555-26ff6fc585/`。
- 被替换的 `2.13.1` 根程序已备份至 `archive/executables/local/local-20260926-122555-26ff6fc585/Focused Moment.exe`，SHA-256 `C42EC636B5E07D78C3C72A1313A3257074D8DE14A5E0F4D9FC9C4038CFA1C360`。
- Windows 原生冒烟通过：可见窗口启动、隔离存储/WebView2、旧状态迁移及隔离进程清理均通过。报告：`artifacts/qa/native/windows-native-20260926-122737-da6aef8961/report.md`。该自动检查不覆盖计时按钮、托盘、迷你窗口、声音与提醒等人工原生交互。
