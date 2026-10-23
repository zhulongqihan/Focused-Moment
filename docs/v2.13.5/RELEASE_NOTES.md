# Focused Moment 2.13.5

## 巴特勒肖像区分度修复

- 根据页面实览复核，计时与战术板虽引用不同图片，但都采用正面头带、蓝金球衣的棚拍风格，缩略后容易看成同一张；首页海报与设置预览也复用了同一张旧背身素材。
- 战术板改用动态侧身指挥手势的勇士 10 号肖像；设置预览改用无头带、抱臂的勇士 10 号肖像。保留计时页与首页各自原有角色图，并保持应用页面背景、布局和球场装饰不变。
- 新增素材均为真透明 PNG；自动化断言覆盖实际页面资源映射、图像尺寸和透明边缘，避免主题页面再次误用同一张图。

## 验证与交付

- CC-03 战术板与 CC-05 设置预览定向浏览器回归 `8/8` 通过；新增“四个页面肖像资源必须各不相同”回归 `1/1` 通过。两张新 PNG 为 `1024×1536`、RGBA；左上角与边缘采样 alpha 为 `0`。
- `pnpm verify` 通过，Rust 单测 `39/39`；`pnpm build` 通过（2089 modules，保留既有大 chunk 提示）。
- 完整浏览器套件在新增唯一性断言之前为 `154/156`：两项失败均在外观偏好保存/切换时序用例；对应设置切换测试在独立复跑中通过，但失败与通过结果不稳定。本轮未修改偏好保存逻辑、未放宽断言；图像映射相关用例均通过。
- 根目录 `Focused Moment.exe` 为 2.13.5 Release，43,741,696 bytes，SHA-256 `A84C09BDE80A900B41D40B43443549C9A2E1CD62DA2218B840A86089131B8F14`。build ID `local-20260926-141653-0a52e15a68`；provenance 与 delivery journal 位于 `artifacts/builds/local/local-20260926-141653-0a52e15a68/`，记录 183 项输入指纹、源提交 `8fb5e67e8883b3ed7e0e8aa64453d9deb3819682`，且 `relevantBuildInputDirty=false`。
- 被替换的旧根入口 SHA-256 `5B7E9B565C3357699020A4BD44B41BDEEAA539EDAB5AD3851B30887A58D65641` 已保存至 `archive/executables/local/local-20260926-141653-0a52e15a68/Focused Moment.exe`，可恢复。
- Windows 原生隔离冒烟 `windows-native-20260926-141850-67b81e35a3` 通过：可见原生窗口启动、隔离 LOCALAPPDATA/WebView2、旧数据迁移与源备份均通过；该冒烟不替代所有人工原生交互。
- 应用提交 `8fb5e67` 已推送到 `origin/codex/focused-moment-continuity`。本次不创建安装包、tag、GitHub Release 或上传资产。
- `PROJECT_PLAN.md` 保持原有用户修改且哈希仍为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`；本机已有 `div` 与四份 `docs/context_summary_20260924_*.md` 未暂存或提交。
- 不创建 tag、GitHub Release、安装包或上传资产。
