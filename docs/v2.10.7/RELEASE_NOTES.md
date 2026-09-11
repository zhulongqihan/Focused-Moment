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
- 远程 CI、macOS 资产和 GitHub Release digest：待发布闭环完成后补录。

## 资产

本地 Windows 产物：

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.7.exe` | 23,733,248 bytes | `91a2a774e068d281f5bad396d07f43e8fa2bc645813e18ada9853ae0e0cad46d` |
| `Focused Moment Setup v2.10.7.exe` | 16,130,946 bytes | `77085edd6288ce50dbbf1651ffa1638ffae9ecacbfe9b8808427c0063b550ae7` |
| `Focused Moment_2.10.7_x64_en-US.msi` | 17,113,088 bytes | `67a1d078b366354e7e63ca9787263f14410b4e1cad880959c6d0f920bdc47207` |

macOS Universal DMG、GitHub Release 地址和远程 digest 待发布闭环完成后补录。
