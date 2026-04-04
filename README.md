# Focused Moment

<div align="center">

![Version](https://img.shields.io/badge/version-0.10.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

**一款本地优先的专注力桌面应用，结合番茄钟、待办事项和明日方舟主题设计**

[快速开始](#-快速开始) • [功能特性](#-功能特性) • [下载](#-下载) • [文档](#-文档) • [反馈](#-反馈)

</div>

---

## 📖 简介

Focused Moment 是一款专为提升专注力而设计的桌面应用，采用明日方舟主题，提供沉浸式的专注体验。应用集成了番茄钟计时器、待办事项管理、明日方舟抽卡系统和 AI 功能，让专注变得更有趣。

### ✨ 核心特点

- 🍅 **番茄钟计时器** - 25 分钟工作 + 5 分钟休息，Boss 回合机制
- ✅ **待办事项** - 简洁的任务管理，本地存储
- 🎲 **抽卡系统** - 真实的明日方舟抽卡体验，保底机制
- 👥 **干员收藏** - 查看和管理你的干员，带图片展示
- 🤖 **AI 集成** - 通义千问 API，生成专注建议
- 🎨 **明日方舟主题** - 精美的 UI 设计，沉浸式体验
- 💾 **本地优先** - 所有数据本地存储，隐私安全

---

## 🚀 快速开始

### 下载和安装

1. 下载最新版本：`Focused-Moment-v0.10.0-ui-enhancements.exe`
2. 双击运行即可使用（绿色版，无需安装）

### 首次使用

1. **设置 AI API**（可选）
   - 点击设置按钮
   - 输入通义千问 API 密钥
   - 保存配置

2. **开始专注**
   - 点击"开始专注"按钮
   - 完成 25 分钟工作会话
   - 获得合成玉奖励

3. **体验抽卡**
   - 点击"寻访系统"
   - 使用合成玉进行抽卡
   - 收集你的干员

---

## 🎯 功能特性

### 番茄钟计时器
- 25 分钟工作时间 + 5 分钟休息时间
- Boss 回合：达到每日目标后触发特殊回合
- 随机 Boss 名称（14 个明日方舟 Boss）
- 可拖拽的浮动计时器窗口
- 完成提示音效

### 待办事项管理
- 创建、完成、删除任务
- 任务分类：进行中 / 已完成
- 可拖拽的浮动待办窗口
- 本地持久化存储

### 明日方舟抽卡系统
- **单抽**：600 合成玉
- **十连**：6000 合成玉
- **真实概率**：
  - 6★: 2% (保底：50 抽后每抽 +2%)
  - 5★: 8%
  - 4★: 50%
  - 3★: 40%
- 保底计数器显示
- 干员图片展示（PRTS Wiki）
- 抽卡公告系统

### 干员收藏系统
- 查看所有获得的干员
- 干员图片展示（lazy loading）
- 按稀有度、职业筛选
- 按稀有度、等级、获得时间排序
- 干员详情页面

### 资源管理
- 合成玉（抽卡货币）
- 龙门币（升级货币）
- 通过专注会话获得奖励
- Boss 回合额外奖励

### AI 功能
- 通义千问 API 集成
- AI 生成专注建议
- 错误处理和用户反馈

---

## 📦 下载

### 最新版本

**v0.10.0 - UI 增强版本** (2026-04-04)

- 📥 [Focused-Moment-v0.10.0-ui-enhancements.exe](./Focused-Moment-v0.10.0-ui-enhancements.exe) (~15 MB)

**新功能：**
- ✅ 干员图片显示系统
- ✅ Boss 名称随机化
- ✅ Todo Widget 可见性修复
- ✅ 性能优化

### 系统要求

- **操作系统：** Windows 10/11
- **运行时：** WebView2（Windows 11 自带）
- **磁盘空间：** ~50 MB
- **内存：** 建议 4GB+

---

## 📚 文档

- [项目总览](./docs/项目总览.md) - 完整的项目介绍和技术架构
- [使用指南](./docs/使用指南.md) - 详细的使用说明
- [快速开始](./docs/快速开始.md) - 快速上手指南
- [功能增强建议](./docs/功能增强建议.md) - 功能建议列表
- [发布说明](./RELEASE_NOTES_v0.10.0.md) - v0.10.0 发布说明
- [更新日志](./CHANGELOG.md) - 完整的版本历史

---

## 🛠️ 开发

### 技术栈

- **前端：** Svelte 5 + SvelteKit + TypeScript
- **后端：** Tauri 2 + Rust
- **数据库：** SQLite
- **测试：** fast-check + proptest

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/zhulongqihan/Focused-Moment.git
cd Focused-Moment

# 安装依赖
npm install

# 启动开发服务器
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

### 项目结构

```
Focused-Moment/
├── src/                    # 前端源代码
│   ├── routes/            # SvelteKit 路由
│   ├── lib/               # 共享库
│   └── app.html           # HTML 模板
├── src-tauri/             # Tauri 后端
│   ├── src/               # Rust 源代码
│   └── Cargo.toml         # Rust 依赖
├── docs/                  # 文档
├── .kiro/                 # Kiro 规格文档
└── README.md              # 本文件
```

---

## 🐛 反馈

### 报告问题

如果你遇到问题或有建议，请通过以下方式反馈：

1. **用户反馈文档**：[docs/用户反馈.md](./docs/用户反馈.md)
2. **GitHub Issues**：[提交 Issue](https://github.com/zhulongqihan/Focused-Moment/issues)

### 反馈模板

```markdown
**问题描述：** [简要描述]
**复现步骤：** [如何复现]
**预期行为：** [应该发生什么]
**实际行为：** [实际发生了什么]
**版本：** v0.10.0
```

---

## 🗺️ 路线图

### v0.11.0（计划中）
- [ ] 宠物系统重新设计
- [ ] AI 故事生成功能
- [ ] 设置页面版本显示
- [ ] 更多 Boss 名称

### 未来计划
- [ ] 数据统计和可视化
- [ ] 成就系统
- [ ] 主题切换
- [ ] 多平台支持

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](./LICENSE) 文件

---

## 🙏 致谢

- **明日方舟** - 主题设计灵感
- **PRTS Wiki** - 干员图片来源
- **Tauri** - 跨平台框架
- **Svelte** - 前端框架

---

## 📞 联系

- **GitHub：** [@zhulongqihan](https://github.com/zhulongqihan)
- **项目地址：** [Focused-Moment](https://github.com/zhulongqihan/Focused-Moment)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star！**

Made with ❤️ by zhulongqihan

</div>
