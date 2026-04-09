# Focused Moment

Focused Moment 是一个面向 Windows 的轻量桌面效率助手，目标是把精准计时、
任务追踪与本地数据复盘整合进一个安静、低干扰的工作空间。

## 当前版本

`v0.2` 已完成：

- Tauri 2 桌面宿主与 SolidJS 前端基础架构
- 自定义无边框主窗口壳层
- Rust 驱动的正向计时核心
- 本地专用 `docs/` 版本文档与反馈记录流程

## 技术栈

- Tauri 2
- Rust
- SolidJS
- TypeScript
- Vite

## 开发命令

安装依赖：

```bash
pnpm install
```

启动桌面开发环境：

```bash
pnpm tauri dev
```

仅构建前端：

```bash
pnpm build
```

检查前端类型：

```bash
pnpm check
```

## 版本流程

- 只在 `main` 分支上开发
- 每次只交付一个版本
- 必须等当前版本验收通过后再进入下一版
- 每个版本通过后：
  - 更新本地 `docs/`
  - 本地提交
  - 通过 SSH 推送到 `origin/main`

## 本地文档

`docs/` 目录只保留在本地，并已被 Git 忽略。

- `docs/vX.X/plan.md`
- `docs/vX.X/test.md`
- `docs/vX.X/notes.md`
- `docs/user-feedback.md`
