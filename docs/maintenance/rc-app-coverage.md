# 应用流程测试覆盖映射

基线：`origin/main` / `ec8ed2549380b074a9d12ebc9ae11d148dece977` 的 `app/tests/app.spec.mjs`。由 Git 旧测试声明与当前测试声明逐项比对；测试名称保留本身不代替执行证据，完整运行结果由 RC 报告记录。

原45项：44项名称保留；1项因默认不自动迷你的新产品要求更名，并保留显式开启自动迷你的独立用例。最终86项，无删减/跳过来制造通过。

“原名保留”不表示所有旧 DOM 断言逐字未改：旧 Today trail/驾驶舱布局按已批准的“当前事项、最多三项精选、今日投入”迁移，不能继续要求旧长轨道、Today streak 或虚假槽位；默认开始不再自动迷你窗口。计时运行态、编辑中继续计时、空状态、日期分组、长历史可达、窗口控件、键盘可访问性、撤销与同步等不冲突的主要流程继续独立验证。视觉几何迁移的逐项理由另见101项映射，未降低通用溢出/可见性阈值。

| 编号 | 旧测试 | 当前映射 |
| --- | --- | --- |
| 1 | Today cockpit exposes the overview and command palette | 原名保留 |
| 2 | command palette keeps keyboard focus inside the dialog and executes the active option | 原名保留 |
| 3 | command palette can open the floating workspace | 原名保留 |
| 4 | native tray navigation event switches the main window view | 原名保留 |
| 5 | initial data errors stay visible and recover through the retry action | 原名保留 |
| 6 | Today overview keeps timing work in the focus page | 原名保留 |
| 7 | Today trail expands into a scrollable route beyond five segments | 原名保留 |
| 8 | Today trail does not invent tasks when there are no todos | 原名保留 |
| 9 | main window keeps its top bar available while scrolling and exposes a drag surface | 原名保留 |
| 10 | records and settings pages keep all three native window controls clickable | 原名保留 |
| 11 | countdown duration keeps the user value while timer snapshots refresh | 原名保留 |
| 12 | starting a countdown opens the floating workspace | starting a countdown stays in the current page by default；另测 auto mini preference opens the mini workspace only after a real start |
| 13 | floating workspace switches between todos and the active timer | 原名保留 |
| 14 | floating workspace can adjust and remember its opacity | 原名保留 |
| 15 | floating timer receives main-window state sync without polling | 原名保留 |
| 16 | floating workspace only shows todos when there is no active timer | 原名保留 |
| 17 | completed countdown clearly offers to save the focus record | 原名保留 |
| 18 | reminder settings expose popup, taskbar and a palette of sound controls | 原名保留 |
| 19 | records page turns a long history into a selectable archive trail | 原名保留 |
| 20 | records page keeps a long archive inside a bounded history viewport | 原名保留 |
| 21 | record day keeps its collapsed state during background refresh | 原名保留 |
| 22 | records page aligns route points and explains focus hours | 原名保留 |
| 23 | records page keeps empty seven-day data at zero | 原名保留 |
| 24 | record title can be edited and saved without changing its duration | 原名保留 |
| 25 | timer snapshots keep refreshing while a record draft is open | 原名保留 |
| 26 | stopwatch shows a clear target duration instead of a one-minute target | 原名保留 |
| 27 | timer page uses the current day's saved session count | 原名保留 |
| 28 | timer workspace keeps only actionable controls and state copy | 原名保留 |
| 29 | timer workspace distinguishes a completed countdown | 原名保留 |
| 30 | timer workspace distinguishes a recovered session | 原名保留 |
| 31 | timer workspace offers quick durations and a usable pre-start reset | 原名保留 |
| 32 | timer page can reopen the focus floating window after returning to main | 原名保留 |
| 33 | paused focus floating window can continue without returning to the main window | 原名保留 |
| 34 | focus unlock window exposes a retryable unlock control | 原名保留 |
| 35 | main window clears a stale title after another window finishes the session | 原名保留 |
| 36 | todo editor saves a date selected from the native date picker | 原名保留 |
| 37 | completing a todo keeps it visible in the completed section | 原名保留 |
| 38 | app messages appear as dismissible top-right toasts and auto-dismiss | 原名保留 |
| 39 | todo board keeps completed actions aligned without a needless scrollbar | 原名保留 |
| 40 | todo workspace stacks cleanly on a phone viewport | 原名保留 |
| 41 | todo board groups pending items by date and keeps one group open | 原名保留 |
| 42 | todo date group keeps its scroll position during background refresh | 原名保留 |
| 43 | records overview info explains the seven-day chart on hover and focus | 原名保留 |
| 44 | overdue todos are shown in their own status section | 原名保留 |
| 45 | Today cockpit remains usable on a narrow window | 原名保留 |

## 新增或按新要求更名的用例

以下还包含两组参数化声明展开的6项（总数以最终 Playwright `--list` 的86项为准，而非只统计字符串声明）：

- `RC backup confirmation lists only default scope and cancel makes no changes`
- `RC backup confirmation lists only todos scope and cancel makes no changes`
- `RC backup confirmation lists only records scope and cancel makes no changes`
- `RC backup confirmation lists only settings scope and cancel makes no changes`
- `RC todo-float completion opens the bookmark editor in the main window`
- `RC focus-float completion opens the bookmark editor in the main window`

- command palette searches task and record history and focuses records by task
- starting a countdown stays in the current page by default
- auto mini preference opens the mini workspace only after a real start
- quick capture creates an inbox item and keeps the current page
- quick capture during a running timer does not pause or navigate
- current item and today picks stay user-controlled with a three-item limit
- finishing a linked round keeps the todo open and saves a continuation bookmark
- the same todo can continue through multiple rounds without auto-completing
- records support manual entry and detailed correction
- portable backup preview and import expose the v3 restore choice
- failed appearance persistence keeps the live change and offers retry
- appearance autosave keeps the newest theme after a stale save resolves late
- RC autosave failed A is superseded by B and its detached retry cannot overwrite B
- RC autosave held retry and rapid theme intensity changes preserve the final full snapshot
- RC manual correction delete undo keep records analytics and broadcast consistent
- RC inline rename preserves exact seconds and record metadata
- RC continuation skip replace and retry preserve three rounds on the same task
- RC command palette distinguishes same-name tasks and handles dates empty results and keyboard
- RC backup no selected scopes disables import and mismatched source cannot import
- RC backup native chooser cancellation and save path preserve preview safety
- RC continuation event rejects missing completed and malformed todos and preserves an open draft
- RC continuation event failure does not roll back floating record completion or prevent return
- RC continuation event accepts the first persisted todo with id zero
- RC focus plan polling clears yesterday picks after rollover but retains inbox and current todo
- RC manual records preserve unknown completion time through creation and detailed edits
- RC history search keeps dates older than seven days selected after refresh
- RC history search filters exact records beyond the first 200 and clears mutually exclusive task filters
- RC exact date search reserves archive navigation beyond twenty same-day records
- RC history search ignores bookmarks and durations but accepts titles associations and times
- RC exit waits for autosave and preserves the window on failure until retry succeeds
- RC range commit pointerup blur and window close flush pending preferences without debounce delay
- RC failed current-plan persistence aborts starting focus and preserves the error for retry
- RC mini custom audio sync fetches changed names once and clears removed audio

视觉101项一对一映射见 `rc-visual-coverage.md`，与本文件合计覆盖原146项基线。新视觉75格矩阵并未代替原101项。

最后新增3项音频同步边界：

- `RC audio fingerprint replaces same-name content once and accepts legacy events`
- `RC audio fingerprint rejects late same-name reads and coalesces pending legacy snapshots`
- `RC audio fingerprint rejects pre-save bytes then retries on committed broadcast`

命令面板键盘用例另外明确等待至少两次后台刷新后，仍要求End选中的记录不变，再用Home选择日期、Enter定位；鼠标悬停在旧点击位置不再因为DOM刷新重置键盘选择。以上定向6项通过，但最终完整270项必须另行执行。
