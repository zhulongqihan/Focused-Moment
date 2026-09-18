# 当前产物区

`artifacts/` 只保存本地或 CI 生成的当前构建交付、测试证据、日志和来源记录，不保存应用源码，也不进入 Git。

- `qa/<class>/<unique-run-id>/`：Playwright、契约、CSS、原生 smoke 和视觉证据。
- `builds/local/<build-id>/`：根目录 `Focused Moment.exe` 的候选、manifest、输入指纹和交付日志。
- `builds/exports/<profile>/`：明确授权的构建导出资产；安装器不会在外层根目录生成。
