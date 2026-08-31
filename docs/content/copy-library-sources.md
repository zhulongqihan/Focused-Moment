# Focused Moment 本地每日一句语料库来源清单

源清单版本：3.1.0（沿用 Memento 语料库清单）
采集/核验日期：2026-08-27
运行时策略：文案作为只读资源随应用打包，运行时不请求网络。

## 数量报告

- 总条目：1000
- 中文古典原文：885
- 外文原文（均有中文编译译文）：115
- 原文去重：1000
- 中文译文去重：115
- 原文 + 来源链接组合去重：1000
- 单一作者最多条数：35

机器可读报告见 `docs/content/copy-library-report.json`，校验入口为 `npm run copy:validate`。

## 来源

### 中文古典原文

中文条目由 [gujilab/chinese-classical-corpus](https://huggingface.co/datasets/gujilab/chinese-classical-corpus) 的 CC0 数据集输出筛选而来，使用其中的经典、史传和编年材料短句。每条记录保留典籍名、作者字段和对应的 [中文 Wikisource 典籍页面](https://zh.wikisource.org/) 链接。

该数据集 README 明确将 `output/` 数据标注为 CC0；本项目没有使用之前审计出的 CC BY-NC-SA 数据源。个别典籍的作者字段为“佚名（典籍）”，不把整理者误写成原作者。

### 外文原文

外文条目来自 [Project Gutenberg](https://www.gutenberg.org/) 的公共领域作品页面，覆盖 William Shakespeare、Ralph Waldo Emerson、Henry David Thoreau、Jane Austen、Oscar Wilde 和 Lewis Carroll。每条保存作品页面和 Project Gutenberg 许可说明链接。

外文译文为 Memento 编译译文，不冒充原作者或第三方译者；Focused Moment 同时保存外文原文和中文译文，英文条目在每日一句卡片中优先展示中文译文，并保留原文供对照。

## 许可注意

Project Gutenberg 的许可页提醒：作品是否不受美国版权限制需要逐项检查，美国以外使用者还应遵守所在地法律。因此本批只选择公共领域作者与作品，并保留作品页面和许可页供复核；未来新增来源必须通过同样的逐条核验。

文案库不包含来源不明的现代鸡汤、不把 AI 生成文字伪装成历史作者，也不在运行时抓取网络内容。
