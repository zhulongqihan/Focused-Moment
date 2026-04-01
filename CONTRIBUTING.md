# 贡献指南

感谢你对 Focused Moment 项目的关注！我们欢迎任何形式的贡献。

## 🤝 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 在 [Issues](https://github.com/zhulongqihan/Focused-Moment/issues) 页面搜索，确保问题尚未被报告
2. 创建新的 Issue，使用清晰的标题和详细的描述
3. 如果是 bug，请提供：
   - 操作系统版本
   - 应用版本
   - 复现步骤
   - 预期行为和实际行为
   - 截图（如果适用）

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   ```

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/你的用户名/Focused-Moment.git
   cd Focused-Moment
   ```

3. **创建分支**
   ```bash
   git checkout -b feature/你的功能名称
   # 或
   git checkout -b fix/你的修复名称
   ```

4. **安装依赖**
   ```bash
   npm install
   ```

5. **进行修改**
   - 遵循现有的代码风格
   - 添加必要的注释
   - 确保代码可以正常运行

6. **测试你的修改**
   ```bash
   npm run check
   npm run tauri:dev
   ```

7. **提交修改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   # 或
   git commit -m "fix: 修复问题描述"
   ```

8. **推送到你的 Fork**
   ```bash
   git push origin feature/你的功能名称
   ```

9. **创建 Pull Request**
   - 在 GitHub 上打开你的 Fork
   - 点击 "New Pull Request"
   - 填写 PR 描述，说明你的修改
   - 等待审核

## 📝 代码规范

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档修改
- `style:` 代码格式修改（不影响代码运行）
- `refactor:` 重构（既不是新增功能，也不是修复 bug）
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

示例：
```
feat: 添加番茄钟暂停功能
fix: 修复待办任务无法删除的问题
docs: 更新使用指南
```

### TypeScript/Svelte 代码规范

- 使用 2 空格缩进
- 使用单引号
- 函数和变量使用驼峰命名
- 类型定义使用 PascalCase
- 添加必要的类型注解
- 保持代码简洁易读

示例：
```typescript
type Todo = {
  id: string;
  title: string;
  done: boolean;
};

function addTodo(title: string): void {
  // 实现
}
```

### Rust 代码规范

- 遵循 Rust 官方代码规范
- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 检查代码
- 添加必要的错误处理
- 添加文档注释

示例：
```rust
/// 保存应用状态到数据库
#[tauri::command]
fn save_app_state(app: AppHandle, payload: String) -> Result<(), String> {
    // 实现
}
```

## 🎨 UI/UX 设计规范

### 颜色系统
- 主色调：暖色系（米黄、橙色）
- 背景色：`#f6f5ef`
- 文字色：`#1e1a16`
- 强调色：`#ff9944`

### 组件规范
- 圆角：12-18px
- 间距：8px 的倍数
- 字体：Space Grotesk, Noto Sans SC
- 等宽字体：JetBrains Mono

## 🧪 测试

目前项目还没有完整的测试套件，但我们鼓励：

1. **手动测试**
   - 测试你修改的功能
   - 测试相关的功能是否受影响
   - 在不同场景下测试

2. **代码检查**
   ```bash
   npm run check
   npm run check:desktop
   ```

## 📚 开发环境设置

### 必需工具
- Node.js 18+
- Rust 1.70+
- Windows 10/11（当前版本）

### 推荐工具
- VS Code
- Rust Analyzer 扩展
- Svelte for VS Code 扩展
- Tauri 扩展

### 开发流程
1. 启动开发服务器：`npm run tauri:dev`
2. 修改代码，保存后自动热重载
3. 测试功能
4. 提交代码

## 🐛 调试技巧

### 前端调试
- 在 Tauri 窗口中按 F12 打开开发者工具
- 使用 `console.log()` 输出调试信息
- 检查 Network 标签查看网络请求

### 后端调试
- 在 Rust 代码中使用 `println!()` 或 `eprintln!()`
- 查看终端输出
- 使用 `cargo check` 检查编译错误

## 📖 文档贡献

文档同样重要！你可以：

- 改进现有文档
- 添加使用示例
- 翻译文档
- 修正错别字

## 🎯 优先级

我们特别欢迎以下方面的贡献：

### 高优先级
- 性能优化
- Bug 修复
- 用户体验改进
- 文档完善

### 中优先级
- 新功能开发
- 代码重构
- 测试覆盖

### 低优先级
- 代码风格调整
- 注释补充

## 💡 功能建议

如果你有好的功能想法：

1. 先在 Issues 中讨论
2. 等待社区反馈
3. 获得认可后再开始开发
4. 保持功能简洁，避免过度设计

## 🚫 不接受的贡献

- 与项目目标不符的功能
- 过于复杂的实现
- 未经讨论的重大重构
- 违反隐私原则的功能（如强制联网、数据上传）

## 📞 联系方式

- GitHub Issues: https://github.com/zhulongqihan/Focused-Moment/issues
- GitHub Discussions: https://github.com/zhulongqihan/Focused-Moment/discussions

## 🙏 致谢

感谢所有贡献者的付出！你的贡献让 Focused Moment 变得更好。

---

**再次感谢你的贡献！** 🎉
