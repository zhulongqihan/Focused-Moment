# Focused Moment 2.13.4

## 巴特勒勇士 10 号肖像

- 计时页更换为 Jimmy Butler 正面持球的勇士蓝金 10 号透明肖像；待办页更换为不同表情与角度的近景侧场肖像，球衣号码完整可见。
- 保持两页原有布局、文字与球场背景不变；首页沿用原有独立海报。
- 两张 PNG 均保留透明通道，按产品素材用途生成并人工核对姿势与号码。

## 验证与本地交付

- 完整浏览器回归：`pnpm test:frontend -- --workers=1` 为 `156/156` 通过。图像标签与透明边缘断言更新后，CC-02 计时页与 CC-03 待办页概念截图定向回归 `2/2` 通过；透明 PNG 的角点及侧边采样 alpha 均为 `0`，构图截图已人工复核。
- `pnpm verify` 通过，含 TypeScript、CSS/结构/原生契约/本地交付检查及 Rust 单元测试 `39/39`；仅有既有未使用导入/死代码警告。`pnpm build` 通过（2089 modules）。
- 根目录 `Focused Moment.exe` 为 `2.13.4` Release 构建，39,206,400 bytes，SHA-256 `5B7E9B565C3357699020A4BD44B41BDEEAA539EDAB5AD3851B30887A58D65641`。build ID：`local-20260926-131839-aeab5611c6`；provenance：`artifacts/builds/local/local-20260926-131839-aeab5611c6/manifest.json`，包含 181 项输入指纹。打包时工作树有本轮待提交的应用改动（`relevantBuildInputDirty=true`），对应文件指纹已记录。
- 被替换的旧根入口 SHA-256 `AE8E65FC7BFE156C022B9D9A5D9170048BFC99CBB5848C6BAEFD4B5837F61F91` 已保存至 `archive/executables/local/local-20260926-131839-aeab5611c6/Focused Moment.exe`，支持回滚。
- Windows 原生隔离冒烟 `windows-native-20260926-132018-03ec821d5c` 通过；源入口与隔离副本 SHA-256 一致，验证可见窗口启动、隔离数据目录与旧状态迁移。此项不代表计时按钮、托盘、浮窗、备份界面、音效和通知的人工原生 UI 操作已全部覆盖。
- 本次为本机可运行交付；不创建安装包、tag 或 GitHub Release，不上传发布资产。
