# MAINT-05 GitHub 远程维护审计

> 审计日期：2026-09-11
>
> 本阶段只做远程只读核对和维护清单，不删除分支、tag、Release 或资产，不改写历史。

## 远程基线

| 项目 | 已核对事实 |
| --- | --- |
| 仓库 | `https://github.com/zhulongqihan/Focused-Moment`，公开仓库，默认分支 `main` |
| 远程 main | `0bade576f1aa9e48a4f7e783c06ea270078b3b32` |
| 开放 PR | 0 |
| 分支 | `main`、`backup-pre-v1.2.2-rollback-20260418`、`codex/night-valley-today`、`codex/v2.0.0`；均未删除 |
| tag | 远程现有历史 tag 全部保留；本地与远程数量差异中的额外远程 tag 为 `v0.11.9`、`v0.2.1`，未删除 |
| 最新 Release | `v2.10.8`，Latest，非 Draft、非 Pre-release |
| 最新成功验证 | Checks `34594860391`；macOS Native Smoke `34594860252`；均针对 `0bade57` |

## v2.10.8 保护核对

Release URL：<https://github.com/zhulongqihan/Focused-Moment/releases/tag/v2.10.8>

| 资产 | 状态 | 字节 | 远端 digest |
| --- | --- | ---: | --- |
| `Focused.Moment.Setup.v2.10.8.exe` | uploaded | 16,129,531 | `sha256:d7fca7086b31c97b1546f4fde39e90c62442a4a6964c425675b1ac5c841bba23` |
| `Focused.Moment.v2.10.8.exe` | uploaded | 23,733,248 | `sha256:dab65cefb611785d4238ef6e322f7469fcb615be09f6b1dc17c568e55c22b782` |
| `Focused.Moment_2.10.8_universal.dmg` | uploaded | 34,262,466 | `sha256:d4eb4b6e8d9678ec18346ef5449a52f24b52e6158cfee12cd87e691b7cb32692` |
| `Focused.Moment_2.10.8_x64_en-US.msi` | uploaded | 17,104,896 | `sha256:e1f5a4ea58c08b4dd7dd84d795f01e5019efd0b6459b4fab848368d2e645d9e1` |

tag `v2.10.8` 的 GitHub ref 是 annotated tag object；其 tag peeled commit 为 `96c22914e393924b7f5d312b5ce37ab675c25111`。本次维护不移动、不覆盖、不删除该 tag 或上述四项资产。

## 本次允许的远程动作

| 动作 | 决定 | 理由 |
| --- | --- | --- |
| 推送维护文档、README 和明确删除候选 | 允许，但须先通过本地/干净 checkout 验证 | 属于当前用户目标范围，使用普通 commit/push，不重写历史 |
| 等待该 commit 的 Checks/macOS Native Smoke | 必须 | AGENTS.md 的发布与维护闭环要求；失败时保留链接并暂停发布 |
| 新建未来修复版本的 annotated tag/Release | 仅在 REFINE-13 用户可见修复通过后 | 版本 patch 必须与代码、包、CI 和 Release notes 同步；不把维护文档伪装成新产品 Release |

## 明确禁止/暂不执行

- 不删除或归档任何远程分支；当前分支名和历史用途还不足以证明可删。
- 不删除或移动任何历史 tag；包括远程独有的 `v0.11.9`、`v0.2.1`。
- 不修改 v2.10.8 Release 的标题、说明、四项资产或 digest。
- 不 force push，不重写 `main` 历史，不使用 GitHub 的资产替换来掩盖校验差异。
- 不因仓库公开、无开放 PR 或历史 Release 数量多而自动执行远程清理。

## 当前结论

MAINT-05 的远程风险已收窄为“正常推送维护变更并等待 CI”；没有需要用户确认的远程删除操作。v2.10.8 保护对象完整，下一步是完成 MAINT-06 干净 checkout 验证，再决定是否提交当前维护变更并进入 Night Valley 计时页原生复现。
