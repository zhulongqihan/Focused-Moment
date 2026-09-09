# 数据备份与跨设备搬移

本文说明 Focused Moment 当前（v2.9.1、备份格式 v2、存储 schema v2）的本地备份范围和换机流程。备份文件是一个独立的 JSON 文件，可以在 Windows 和 macOS 之间搬移；应用数据目录本身不是跨平台固定路径。

## 最短流程

1. 在源设备打开「设置」→「本地备份」，点击「导出本地备份」。
2. 在导出结果中找到一个 `focused-moment-backup-v2-*.json` 文件。通过 U 盘、局域网或其他你信任的方式，把这一个文件复制到目标设备；不要把正在运行中的整个 `FocusedMoment` 数据目录当作备份复制。
3. 在目标设备安装并启动相同版本的 Focused Moment 一次，然后在「设置」→「本地备份」中点击「打开备份目录」。把 JSON 文件放进打开的目录。
4. 回到备份列表；如果列表没有立即更新，离开设置页再回来或重启应用。选中这份备份，确认替换提示后执行导入。
5. 导入前应用会自动保存当前数据的回滚备份。导入完成后重启应用，检查待办、专注记录和未完成计时，再删除或归档源设备上的原始数据。

建议在同一版本之间搬移，并在确认目标设备无误前保留源设备和原始 JSON。目标版本如果来自未来、且备份 schema 高于当前版本，当前应用会拒绝恢复，不能把这种拒绝绕过后强行改 JSON。

## 文件位置

| 平台 | 应用数据目录 | 用户备份目录 |
| --- | --- | --- |
| Windows | `%LOCALAPPDATA%\FocusedMoment` | `%LOCALAPPDATA%\FocusedMoment\Focused Moment Backups` |
| macOS | `~/Library/Application Support/FocusedMoment` | `~/Library/Application Support/FocusedMoment/Focused Moment Backups` |

应用提供「打开备份目录」入口时，应优先使用入口得到的实际目录。上表是当前默认目录；如果系统环境变量不可用，运行时存在回退目录，不应据此猜测或覆盖文件。

用户可搬移的文件名以 `focused-moment-backup-v2-` 开头、`.json` 结尾。导入前自动生成的保护副本以 `focused-moment-backup-v2-rollback-before-import-` 开头。以下文件是应用内部的耐久状态文件，不是跨设备搬移接口：

- `focused-moment-state.json`
- `focused-moment-runtime.json`
- `focused-moment-state.backup.json`
- `focused-moment-runtime.backup.json`

不要在应用运行或计时进行中手动替换这些内部文件；它们分属 state/runtime 两条持久化路径，直接拷贝可能造成不同步。

## 备份包含什么

导出的 JSON 是 Rust 后端生成的完整应用备份，包含以下三层信息：

| 层 | 当前包含的内容 |
| --- | --- |
| 数据 state | 专注记录（标题、时长、模式、日期时间、关联待办等）；待办（标题、完成状态、日期、时间、重要度等）；下一条记录/待办 ID；Rust 计时设置 |
| 运行态 runtime | 当前模式；正向/倒计时/番茄钟的已用时、目标时长和阶段；待确认的番茄专注时长；运行中标记与墙上时钟锚点；当前任务标题和关联待办；结束时是否完成关联待办；已完成专注/休息轮数；提醒序号、当前提醒和正向计时阶段 |
| 备份信封 | `kind`、备份格式版本、schema 版本、导出应用版本和导出时间 |

计时设置中的 `alertSoundKey` 会被保存，包括 `custom` 选择；但是“自定义音效”本身是 WebView `localStorage` 中的 data URL，不在 Rust 备份 JSON 中。因此搬移后如果仍显示选择了 `custom`，目标设备仍可能没有音频，需要重新选择音频文件。自定义音效当前上限为 5 MB。

## 不包含什么

这些内容不会随这份 Rust 备份 JSON 自动恢复：

| 范围 | 当前存储位置或原因 | 搬移后的处理 |
| --- | --- | --- |
| 主题选择 | WebView `localStorage`：`focused-moment.theme` | 在目标设备重新选择主题 |
| 视觉强调、动效、密度 | WebView `localStorage`：`focused-moment.visual-intensity`、`focused-moment.motion-intensity`、`focused-moment.density` | 在目标设备重新设置 |
| 悬浮窗透明度 | WebView `localStorage`：`focused-moment.floating-window.opacity` | 在目标设备重新设置 |
| 自定义音效文件和文件名 | WebView `localStorage`：`focused-moment.custom-alert-sound.data/name` | 重新选择原音频；不要把备份 JSON 当作音频备份 |
| 临时提醒认领标记 | WebView `localStorage` 的 `focused-moment.alert-claimed.*` | 不搬移；它只用于避免多窗口重复处理提醒 |
| 应用安装包、版本、系统权限和窗口环境 | 属于目标设备的安装/操作系统环境 | 目标设备单独安装并授予需要的系统权限 |
| 内置语料、图片、主题预览和内置音效 | 随应用版本打包，不属于个人备份数据 | 使用同一版本或包含这些资源的目标安装包 |

因此，“导出本地备份”承诺的是待办、记录、Rust 计时设置和运行态的可恢复搬移，不承诺一次恢复所有外观偏好或用户自定义音频。

## 版本与失败边界

- 当前导出为格式 v2、schema v2。
- 当前版本可以读取格式 v1，并在导入时迁移到当前格式；导入结果会标记发生过旧格式迁移。
- 备份的 `kind` 不匹配、格式版本不支持、schema 高于当前版本、JSON 损坏或计时设置不合法时，导入应失败并显示错误，不应把它当作空数据继续覆盖。
- 导入会替换当前待办、记录和运行态；导入前由应用先写一份自动回滚备份。若导入后发现目标状态不对，优先从导入前生成的 rollback 文件恢复。
- JSON 是明文，可能包含任务标题、完成记录和当前任务上下文。请把它当作个人数据保护，不要上传到不可信网站或共享到公开位置。

## 隔离搬移验收

仓库中的 `portable_backup_round_trip_survives_copy_and_restart` 单测使用两个互不相同的临时存储根目录模拟干净源账户和干净目标账户：源账户导出 JSON，文件复制到目标账户的备份目录，目标账户导入，重新打开目标存储后比较 state/runtime 全量 JSON。该测试不触碰真实用户目录，也不把复制内部 state/runtime 文件当作搬移方案。
