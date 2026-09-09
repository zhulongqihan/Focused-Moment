# REFINE-05 Botanical Library 主题精修证据

日期：2026-09-09  
代码提交：7bade92  
主题：Botanical Library / 植物书房

## 验收结论

通过。Botanical 不再沿用 Graphite 或 Aurora 的控制台 / 玻璃气泡骨架，五页统一使用木质书房、生长档案和纸张阅读语言：

- 今日：木质书架、植物节点、暖灯和下一张纸条。
- 计时：年轮环形计时器、阅读札记、书签列表。
- 待办：Seedbed / Sprouting / Harvest 三张错落纸卡。
- 记录：真实 archivePath 七日生长图、植物时段分布、可编辑阅读日志。
- 设置：主题书架、书房规则、声音书签、本地目录和书房实时预览。

真实数据边界保持不变：待办、计时快照、专注记录、分析值、主题偏好、提醒和备份动作均继续由 MainShell 传入；植物、书签和纸条是信息表达，不是虚构业务数据。

## 验证

- pnpm check：PASS。
- pnpm build：PASS，Vite transformed 2061 modules。
- pnpm test:frontend -- --workers=1：PASS，58/58。
- Botanical 定向回归：PASS，3/3；提交 7bade92 后追加运行 5 主题专项中的 Botanical 3/3。
- cargo fmt --check --manifest-path src-tauri/Cargo.toml：PASS。
- cargo check --locked --manifest-path src-tauri/Cargo.toml：PASS。
- cargo test --locked --manifest-path src-tauri/Cargo.toml：PASS，33/33 library tests。
- git diff --check：PASS。

## 视觉证据

固定 viewport 为 1487 × 1058，截图使用 reduced motion：

- output/qa/TH-05/7bade92/today.png
- output/qa/TH-05/7bade92/focus.png
- output/qa/TH-05/7bade92/todos.png
- output/qa/TH-05/7bade92/records.png
- output/qa/TH-05/7bade92/settings.png
- output/qa/TH-05/7bade92/geometry.json

结构断言覆盖 bl-library-stilllife、bl-tree-dial、bl-desk-board、bl-growth-chart、bl-preview-room；压力宽度覆盖 1120、820、560、420px，并验证五页不超出 viewport、共享开始专注动作仍能进入运行中状态。
