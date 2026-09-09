# Focused Moment 资源清单

核对时间：2026-09-09。本文是运行时资源的来源与用途登记，不是逐项版权或商用许可法律意见。仓库的 MIT 许可不能自动覆盖第三方图片、音频、字体或数据集；凡是出处不完整的条目明确标为待补，不把源码中的字段当作完整法律核验。

## 运行时资源

哈希为 SHA-256，大小为当前工作区字节数。资源运行时随应用本地打包，当前没有为主题或语料增加网络请求。

| 路径 | 用途 | 来源/出处记录 | 许可与状态 | 大小 | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| `src/assets/logo.svg` | 应用品牌标志 | 项目内 SVG；当前仓库未找到作者、生成工具或逐文件来源记录 | 待补来源与许可；不能仅按仓库 MIT 推断 | 1,598 B | `123B04BC6A1241B3115F86DE09908C019F25D4F0D88916AB49C2487121D3DF5` |
| `src/assets/focus-trail-atmosphere-v3.png` | Night Valley 今日/设置空间背景 | 项目历史记录表明同系列位图曾由 ImageGen 生成；v3 当前没有逐文件 prompt、生成记录或来源登记 | 项目内视觉素材；出处/许可未完整核验，待补 | 1,450,719 B | `859538A814B264CDAA31AB5D38EF71BA9F29D8E1F6674B36C76E917F88ADECB3` |
| `src/assets/focus-trail-atmosphere-v4.png` | Night Valley 普通页面背景 | 同系列项目内位图；当前 v4 没有逐文件 prompt、生成记录或来源登记 | 项目内视觉素材；出处/许可未完整核验，待补 | 1,853,221 B | `DEE337DEEA576EE30FD4AF8EF66CC019636E7241895E2491643C85537EC335EC` |
| `src/assets/viral-quote-sample.mp3` | 提醒试听的内置音效 | [Fish Audio 公开模型页面](https://fish.audio/m/8a442e5e61594fccb1d745cad6cdd642/)；模型“老牧师”，作者 `2126572511`；详细登记见 [`docs/v2.3.12/VOICE_ATTRIBUTION.md`](../v2.3.12/VOICE_ATTRIBUTION.md) | 不是 Focused Moment 原创录音；历史页面说明可用于商业内容，但发行前仍须复核模型作者与 Fish Audio 最新条款 | 246,177 B | `466E6D597A6DB0CF6A3853577CB29EBE865CB7F18C56E91BABA419D659FD8103` |
| `public/theme-previews/01-night-valley.png` | Night Valley 主题预览 | 项目内主题预览；未找到逐文件原始图、作者或许可登记 | 待补来源与许可；不把预览图当作备份内容 | 1,946,938 B | `805AA45407451ACE8B7781FF9A870C38C1847B5378B1E327B6729E7AB94F1A6F` |
| `public/theme-previews/02-editorial-paper.png` | Editorial Paper 主题预览 | 项目内主题预览；未找到逐文件原始图、作者或许可登记 | 待补来源与许可 | 2,338,370 B | `2B163FDBAD8A9ABF93F14F84B418486D0DE3BE1B88CFC65B444F739CE07A601C` |
| `public/theme-previews/03-graphite-console.png` | Graphite Console 主题预览 | 项目内主题预览；未找到逐文件原始图、作者或许可登记 | 待补来源与许可 | 2,009,934 B | `AACC92F7005F99A8B10BF478CA8B5DDFE550F8B710853AC4E604900E15D9CD24` |
| `public/theme-previews/04-aurora-ocean.png` | Aurora Ocean 主题预览 | 项目内主题预览；未找到逐文件原始图、作者或许可登记 | 待补来源与许可 | 1,900,145 B | `0D66D2A56F5D777CB9ECC07D8CD49ED72D7B67C2029E0CB53FA56CAEDEC231C0` |
| `public/theme-previews/05-botanical-library.png` | Botanical Library 主题预览 | 项目内主题预览；未找到逐文件原始图、作者或许可登记 | 待补来源与许可 | 2,118,379 B | `E7C116E215EB0CF4DF2FF412CDC607841C6D7F182F017967B1B39EF49BD42FCC` |
| `src/data/copy-library.json` | 每日一句离线语料 | 1,000 条；中文 885 条来自 `gujilab/chinese-classical-corpus` 的 CC0 输出并保留典籍/Wikisource 链接；外文 115 条来自 Project Gutenberg 公共领域作品并保留作品与许可链接；完整说明见 [`copy-library-sources.md`](copy-library-sources.md) 与 [`copy-library-report.json`](copy-library-report.json) | 条目级来源字段已登记；Project Gutenberg 公共领域状态仍需按条目和所在地法律复核；运行时不联网 | 529,627 B | `9E462BA68B7D508E433BBD2BB32C8918E22FEEEBBD16DA581953244039773DF0` |

## 非运行时的设计参考

`docs/design-references/concept-images/**` 和 `docs/design-references/analysis/**` 是设计参考、标注和验收资料，不会作为应用运行时资源随备份搬移。当前仓库没有为其中每张参考图保留来源、作者和许可元数据，因此不将它们写成已获许可的素材，也不把它们的存在当作产品运行时依赖。

## 已知缺口与后续动作

1. 为 logo、v3/v4 背景和五张主题预览补充逐文件生成/来源记录、用途和可发布许可依据；在补齐前保留本清单中的“待补”状态。
2. 对内置 MP3 在实际发布渠道重新核对 Fish Audio 模型作者与平台条款，保留核验日期；不要只引用旧版本说明。
3. `docs/content/copy-library-sources.md` 记载了 `npm run copy:validate` 作为来源校验入口，但当前 `package.json` 未定义该脚本；在补充自动校验命令前，以现有机器报告、条目来源字段和手工审查为证据，不宣称该命令已运行。
