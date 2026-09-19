# 五套原版前端恢复

## 当前决定（2026-09-19）

- 用户确认：恢复 `ec8ed25` 中五套原版前端，不回退当前后端和数据兼容能力。
- 此决定取代此前统一 Today 首页的界面方案，也取代“只退到 44da011 就能恢复原界面”的错误判断。`44da011` 已经包含统一首页替换。
- 当前工作分支：`codex/focused-moment-continuity`。禁止合并 main、tag 或发布。
- `PROJECT_PLAN.md` 只读保护；开始时 SHA-256 为 `E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604`。

## 恢复边界

- 恢复五套原生 Today 路由：夜谷轨迹、编辑纸页、石墨控制台、极光海洋、植物书房。不再渲染统一三卡片首页。
- 恢复原设置页的主题专属选择器、预览构图及侧栏，沿用原主题 CSS，不重新设计。
- 夜谷 Today、两份相关全局 CSS 和主题路由以 `ec8ed25` 为来源；Today 的点击回调保留当前真实开始计时接口。
- Focus 和 Records 沿用现有主题布局及真实记录、补录和纠错接口；不重新用待办冒充专注记录。
- 保留 Rust schema v3、IPC、偏好持久化及数据迁移，不降级或读取真实用户数据。
- 旧设置页保存按钮接当前 native autosave flush；不恢复旧 localStorage 持久化，也不恢复已删除的趣味音频引用。
- 当前事项/精选管理收进待办页末尾的默认折叠区域，避免新面板占据原版页面首屏。快速收件仍可由现有命令面板调用。
- 设置页末尾保留现有自动迷你开关、保存失败重试与完整备份能力。

## 验证与交付

- `pnpm verify` PASS，含类型、CSS 顺序、结构、native contract、交付脚本检查和 38/38 Rust 测试。日志：`artifacts/qa/checks/restore-themes-20260919-160114/verify.log`。
- 完整前端回归：97 passed、0 failed、0 skipped，`--workers=1 --retries=0`，耗时 5.1 分钟。包含 54 项工作流和 43 项视觉/主题检查（含 35 个截图矩阵用例）。
- 最终截图和运行状态：`artifacts/qa/frontend/restored-five-themes-final-inv-mu83l2hx-40516-9e3b08d4-c227-47f7-a21c-c409a9f3af67/`。实际检查了五主题桌面首页、夜谷和植物书房设置页图像；自动化覆盖五主题全部五页与首页 1487/1024/560 宽度。
- 首轮 87 passed / 10 failed 的证据保留。失败是新增测试的命令完整可访问名称未匹配、同时间任务排序夹具不确定和未展开日期组；修正测试操作与夹具后，10 项定向检查及最终 97 项均通过，没有跳过、减少主题或增加重试。
- ThemeSurface、`10-trail-reference.css`、`30-measured-surfaces.css` 与 `ec8ed25` 内容一致；TodayDashboard 仅保留一处真实开始回调差异。后端目录没有工作树差异，受保护计划文件校验值未变。
- 后续 clean-head Release 构建的真实结果以 `artifacts/builds/local/<build-id>/manifest.json` 和交付日志为准；构建成功不等于占用中的根 EXE 已被替换。不得强制结束用户旧进程。
- 本轮状态校准按最新用户确认、Git 源码和实时测试结果执行；系统 Python 启动不可用，技能中的时间戳审计脚本没有运行。
- 本文不是 RC 全项验收通过声明。本次只处理用户要求的原版界面恢复。
