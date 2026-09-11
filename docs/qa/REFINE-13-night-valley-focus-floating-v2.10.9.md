# REFINE-13：Night Valley 计时悬浮窗生命周期验收

## 状态

- 验收对象：第一套主题 Night Valley 的“计时”页。
- 验收基线：`804de40f90fb8eb21ac2200b209ed0f36e7d026a` 加当前工作树修复；版本源已同步到 `2.10.9`，发布闭环仍在进行。
- 验收环境：Windows native debug bundle；隔离数据目录 `F:\Focused Moment Native Timer Repro 20260911-2222`；WebView2 CDP 端口 `9223`。
- native 进程 PID `11292`、`6364` 均为当前源码构建的隔离测试进程，已安全关闭；没有使用真实用户数据目录。

## 根因与最小修改

用户反馈的“返回主界面后没有再次打开悬浮窗入口”不是计时引擎丢失状态，而是入口的布局可发现性问题：已有进度时按钮原本位于 Night Valley 计时卡片的主操作区之后；卡片在普通窗口和部分 native 返回路径中发生滚动时，按钮仍可能存在于 DOM，但落在首屏之外，用户无法看到。

本轮只把已有 `onShowFocusFloating` 动作的按钮移动到计时卡片标题栏右侧，并保留“有计时进度时才显示”的条件、忙碌态禁用和现有窗口动作。没有修改计时引擎、Rust 命令、数据格式、其他主题、今日/待办/记录/设置页面，也没有新增悬浮窗实例。

修改文件：

- `src/components/NightValleyViews.tsx`：将已有入口放入计时卡片 header actions。
- `src/App.css`：补充 header actions 布局、按钮尺寸及 hover/focus 状态。
- `tests/app.spec.mjs`：增加入口位于视口内的回归断言。

## native 证据

使用 Playwright CDP 定位真实 WebView DOM，使用 Win32 窗口枚举核对真实窗口可见性和几何；截图位于 `output/qa/REFINE-13/ae6ac45/`。

| 场景 | 实际结果 | 证据 |
| --- | --- | --- |
| 未开始 | 主窗口正常显示，计时为待开始，浮窗未显示 | `fix-restart-timer-ready.png` |
| 点击开始 | 计时进入运行中；主窗口隐藏，已有 `focus-float` 显示；主窗口/悬浮窗没有重复创建 | `fix-cdp-start-focus.png`；Win32：main `visible=False`，focus `visible=True` |
| 运行中返回主界面 | 计时持续；主窗口恢复；“进入悬浮窗”在 header 且位于视口内 | `fix-return-header.png`；DOM `inViewport=true` |
| 主窗口重新打开悬浮窗 | 点击 header 入口后主窗口隐藏、focus-float 显示，读数继续 | `fix-return-header.png` 后 CDP 点击结果；native `focus=True/main=False` |
| 暂停/继续 | 悬浮窗内暂停后显示“已暂停”，继续后恢复“计时中”，读数保持同一段计时 | CDP 结果：`paused=已暂停`、`running=计时中`，读数相同 |
| 完成并记录 | 主界面显示“保存成功”；随后记录页能看到 `REFINE13-maximized` | `fix-native-fullscreen-completed.png`；CDP `savedRecordVisible=true` |
| 多次 Tab 切换 | 待办 → 记录 → 设置 → 今日 → 计时后，计时仍为运行中，入口仍可见 | `fix-tab-return-timer.png`；五页 class 与状态结果 |
| 应用重启读记录 | 关闭 PID 11292、用同一隔离数据目录启动 PID 6364，记录页重新读取 `REFINE13-native` | `fix-restart-record.png`；CDP `recordVisible=true` |

## 普通、最大化、全屏布局

### 普通窗口

Win32 主窗口：`visible=True`、`zoomed=False`、窗口矩形 `38,0,2220,1466`，客户区 `2160x1453`；WebView2 CSS 视口 `1440x969`。计时卡片和 header 入口均在视口内，页面滚动宽高没有溢出。

证据：`fix-native-ordinary-running.png`。

### 最大化窗口

通过产品现有“最大化或还原窗口”按钮切换。Win32 主窗口：`visible=True`、`zoomed=True`、窗口矩形 `-11,-11,2571,1379`，客户区 `2560x1368`；WebView2 CSS 视口 `1707x912`、DPR `1.5`。计时卡片矩形为 `1063.33,236.34–1623.33,862.31`，入口矩形为 `1488.33,273.01–1594.67,309.01`，均在视口内。

证据：`fix-native-maximized-primary.png`、`fix-native-maximized-return.png`。

### 无边框全屏几何

Night Valley 当前没有独立的 F11/全屏产品命令；主窗口是无装饰窗口。本项使用真实窗口的无边框全屏几何验证布局边界：Win32 主窗口矩形 `0,0,2560,1368`，客户区 `2538x1355`；WebView2 CSS 视口 `1692x904`。计时卡片、说明卡和 header 入口均可见，`scrollWidth=1692`、`scrollHeight=904`。

证据：`fix-native-fullscreen-geometry.png`、`fix-native-fullscreen-completed.png`。这证明全屏尺寸下的可读性与不裁切，不声称产品已经提供 F11 切换。

## 自动化回归

- `pnpm check`：PASS。
- `pnpm test:frontend -- --workers=1 tests/app.spec.mjs -g "timer page can reopen the focus floating window after returning to main"`：1/1 PASS。
- `pnpm test:frontend -- --workers=1 tests/today-visual.spec.mjs -g "Night Valley timer"`：3/3 PASS，覆盖 2560×1368 与 1707×912 CSS 全屏视口、60 分钟读数分离和无溢出。
- `pnpm build`：PASS，2062 modules。
- `pnpm tauri build --debug`：PASS；debug bundle 可启动并创建真实窗口。
- `pnpm tauri build`：PASS；2.10.9 Windows release bundle 生成完成。

## 发布边界

- 2.10.9 版本源已同步；当前尚未创建新 tag、未修改 GitHub Release。v2.10.8 tag、Release 和四项资产保持只读保护。
- 在 Windows 打包、正常推送、远程 CI 和新 Release 完成前，本报告只表示 REFINE-13 修复已通过当前 native 验收和本地回归，不表示 v2.10.9 已发布。
