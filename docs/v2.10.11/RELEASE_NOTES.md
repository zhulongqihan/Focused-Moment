# v2.10.11 · 五套主题的今日一句

## 本次内容

- 将现有本地每日一句语料库接入五套主题的 Today 页面。
- 同一个日期在不同主题中保持同一句，避免切换主题后内容语义漂移。
- 按主题重新设计呈现位置：
  - Night Valley：标题说明下方的安静注脚。
  - Editorial Paper：页眉中的页边手记。
  - Graphite Console：标题与今日序列之间的横向讯息条。
  - Aurora Ocean：主行动按钮前的潮汐寄语。
  - Botanical Library：开始行动前的书签纸条。
- 英文语料继续显示已有中文译文，并保留原文与出处信息。

## 验证

- pnpm check：通过。
- pnpm test:frontend -- --workers=1：68/68 通过。
- 五套主题的 Today 页面截图与压力宽度专项：通过。
- pnpm build：通过，2066 个模块。
- Windows release bundle：通过，EXE、Setup 和 MSI 均生成且文件版本为 2.10.11。
- Rust 本地验证：fmt、check、33/33 tests 均通过。
- 远程 Checks：通过，[run 34743633071](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34743633071)。
- macOS Native Smoke：通过，[run 34743633053](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34743633053)。
- macOS Universal Release：通过，[run 34743647454](https://github.com/zhulongqihan/Focused-Moment/actions/runs/34743647454)。

## 资产校验

| 文件 | 大小（bytes） | SHA-256 |
| --- | ---: | --- |
| Focused Moment v2.10.11.exe | 23,774,720 | f96a2db97311eb916cd6d5e2ec006ab27988814050584480563e6f13e814b7e3 |
| Focused Moment Setup v2.10.11.exe | 16,172,199 | 4c1a19849e1bf2052a6e92ecc55ebbc220c92206afdf7edba15fa212effda325 |
| Focused Moment_2.10.11_x64_en-US.msi | 17,149,952 | 73813b6ee49c6fb4e3c53f285405d2f8e67b5ee3009b299dec55f25eea51bbb7 |
| Focused Moment_2.10.11_universal.dmg | 34,346,733 | 7df332324074dfd63f7d422fbed2df7f5aa62534123e4e52b875c949119fa6cb |

正式 [GitHub Release v2.10.11](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.11) 已发布，Windows portable、Windows Setup、Windows MSI 和 macOS Universal DMG 四项资产均为 `uploaded`。
