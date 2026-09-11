# v2.10.7 · Night Valley 计时页今日记录数一致性修复

## 变更

- 修复 Night Valley 主题“计时”页显示“今日已完成 0 段”而“今日”页已有实际专注记录的问题。
- “今天已记录”和“今日已完成”现在统一使用按日期汇总的当天记录数，与“今日”页口径一致。
- 保留计时引擎内部完成轮次的独立语义，不改变计时、保存、重置和历史数据。

## 验证

- `pnpm check`：PASS。
- 当天已有记录、计时运行态完成轮次为 0 的定向 Playwright 回归：PASS，1/1。
- 完整前端回归：PASS，66/66。
- Rust 格式、编译和测试：PASS；33/33 library tests。
- Vite 构建：PASS，2062 modules；Windows 正式打包：PASS。
- 远程 Checks：PASS，run `34583376302`；macOS Native Smoke：PASS，run `34583376235`；macOS Universal Release：PASS，run `34583470779`。
- GitHub Release：PASS，正式 Release，四项资产均 uploaded。

## 资产

本地 Windows 产物：

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.7.exe` | 23,733,248 bytes | `91a2a774e068d281f5bad396d07f43e8fa2bc645813e18ada9853ae0e0cad46d` |
| `Focused Moment Setup v2.10.7.exe` | 16,130,946 bytes | `77085edd6288ce50dbbf1651ffa1638ffae9ecacbfe9b8808427c0063b550ae7` |
| `Focused Moment_2.10.7_x64_en-US.msi` | 17,113,088 bytes | `67a1d078b366354e7e63ca9787263f14410b4e1cad880959c6d0f920bdc47207` |
| `Focused.Moment_2.10.7_universal.dmg` | 34,260,780 bytes | `f1593a7bc435bac225c855c5aa795f60f71110a6a836cf94d31214eec06cd6e0` |

GitHub Release：[v2.10.7](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.7)。发布提交 `9f7590215bdd0bfafece4cda697afecd05f8ca3f`，`v2.10.7` tag 固定于该提交；远端 digest 与本地 Windows 三项 SHA 一致。Checks 另有 1 个 Today 窄宽度用例首跑失败、重试通过并标为 flaky，整体为成功。
