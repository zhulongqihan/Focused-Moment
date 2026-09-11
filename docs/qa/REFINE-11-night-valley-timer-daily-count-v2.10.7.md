# REFINE-11 · Night Valley 计时页今日记录数一致性修复

版本：v2.10.7
范围：第一套主题 Night Valley 的“计时”单页
开始基线：`aba70db59d8f0a460f774ff238c53b6176b1f657`（v2.10.6 发布证据跟随提交）

## 用户问题与根因

用户提供的同日截图显示：“今日”页右卡已经显示今天有 1 段专注，但切换到“计时”页后仍显示“今日已完成 0 段”。

问题只存在于 Night Valley 计时页的两个统计位置：左侧“今天已记录”和右侧卡片“今日已完成”。原实现读取 `TimerSnapshot.completedFocusCount`，该字段属于计时引擎当前运行态，表示番茄计时内部已完成的专注轮次，不是按日期持久化记录汇总的当天段数；因此在已有正向计时/倒计时记录、当前计时引擎轮次为 0 时必然出现不一致。

## 本轮修改

- MainShell 将分析快照中的 `todaySessionCount` 传给 Night Valley 计时页。
- 两个“今日记录/完成”展示统一使用该按日期汇总值。
- 保留 `TimerSnapshot.completedFocusCount` 及计时引擎语义，不修改计时启停、完成、重置或存储结构。
- 增加当天已有记录而计时运行态为 0 的前端回归测试。

## 明确不在范围内

不修改今日页布局与曲线、其他主题或页面、历史记录算法、计时引擎状态机、用户数据迁移及记录存储结构。

## 验证记录

| 验证 | 结果 |
| --- | --- |
| 浏览器 CLI 复现（注入当天 1 条记录、运行态完成轮次 0） | 修复前复现计时页两处均显示 0 段 |
| `pnpm check` | PASS |
| `pnpm exec playwright test tests/app.spec.mjs --workers=1 --grep "current day's saved session count"` | PASS，1/1 |
| 完整前端回归 `pnpm test:frontend -- --workers=1` | PASS，66/66，约 6 分钟 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | PASS |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | PASS，`focused-moment v2.10.7` |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS，33/33 library tests；binary 0/0；doc-tests 0/0 |
| `pnpm build` | PASS，2062 modules |
| `pnpm package:release` | PASS，生成 v2.10.7 Windows EXE / NSIS / MSI |
| `git diff --check` | PASS |
| 远程 Checks | PASS，run `34583376302` |
| 远程 macOS Native Smoke | PASS，run `34583376235` |
| 远程 macOS Universal Release | PASS，run `34583470779` |
| GitHub Release 与四项资产 digest | PASS，正式 Release，四项资产均 uploaded |

## 发布状态

v2.10.7 已完成版本同步、本地构建/测试/打包、提交、推送、远程 CI、GitHub Release 与四项资产 digest 核对。

## 本地 Windows 产物

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Focused Moment v2.10.7.exe` | 23,733,248 bytes | `91a2a774e068d281f5bad396d07f43e8fa2bc645813e18ada9853ae0e0cad46d` |
| `Focused Moment Setup v2.10.7.exe` | 16,130,946 bytes | `77085edd6288ce50dbbf1651ffa1638ffae9ecacbfe9b8808427c0063b550ae7` |
| `Focused Moment_2.10.7_x64_en-US.msi` | 17,113,088 bytes | `67a1d078b366354e7e63ca9787263f14410b4e1cad880959c6d0f920bdc47207` |

## 远程发布事实

- 发布提交：`9f7590215bdd0bfafece4cda697afecd05f8ca3f`；`v2.10.7` annotated tag 已固定到该提交。
- `origin/main` 已更新到该提交；旧 v2.10.6 tag 未移动。
- GitHub Release：[v2.10.7](https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.7)，正式 Release，地址已可用。

| GitHub Release 资产 | 大小 | 远端 SHA-256 |
| --- | ---: | --- |
| `Focused.Moment.v2.10.7.exe` | 23,733,248 bytes | `91a2a774e068d281f5bad396d07f43e8fa2bc645813e18ada9853ae0e0cad46d` |
| `Focused.Moment.Setup.v2.10.7.exe` | 16,130,946 bytes | `77085edd6288ce50dbbf1651ffa1638ffae9ecacbfe9b8808427c0063b550ae7` |
| `Focused.Moment_2.10.7_x64_en-US.msi` | 17,113,088 bytes | `67a1d078b366354e7e63ca9787263f14410b4e1cad880959c6d0f920bdc47207` |
| `Focused.Moment_2.10.7_universal.dmg` | 34,260,780 bytes | `f1593a7bc435bac225c855c5aa795f60f71110a6a836cf94d31214eec06cd6e0` |

Checks 记录 65 个最终通过用例，并将 1 个 Today 窄宽度用例标为 flaky（首跑失败、重试通过）；本地完整前端回归为 66/66。远程流程另有 Node.js 20 弃用提示，不影响成功结论。
