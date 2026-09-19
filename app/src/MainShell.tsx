import { For, Show } from "solid-js";
import {
  ChartNoAxesCombined,
  CircleDot,
  Clock3,
  LockKeyhole,
  LockKeyholeOpen,
  Maximize2,
  Minus,
  Settings,
  SlidersHorizontal,
  SquareCheck,
  X,
} from "lucide-solid";
import {
  lockFocusFloating,
  lockFloatingTodos,
  minimizeMainWindow,
  restoreMainFromFloatingTodos,
  restoreMainFromFocusFloating,
  startDraggingWindow,
  toggleMaximizeMainWindow,
  unlockFloatingTodos,
  unlockFocusFloating,
} from "./lib/window-controls";
import CommandPalette from "./components/CommandPalette";
import QuickCaptureDialog from "./components/QuickCaptureDialog";
import ManualFocusRecordDialog from "./components/ManualFocusRecordDialog";
import ContinuationNotePrompt from "./components/ContinuationNotePrompt";
import FocusRecordEditDialog from "./components/FocusRecordEditDialog";
import PortableBackupPanel from "./components/PortableBackupPanel";
import ThemeSurface from "./components/ThemeSurface";
import {
  formatAnalyticsDate,
  formatArchiveRangeDate,
  formatDurationMs,
  formatRecordDate,
  formatRecordDay,
} from "./features/shared/date-utils";
import { formatTodoDue, importanceLabel } from "./features/todos/derived";
import {
  defaultFloatingOpacity,
  minFloatingOpacity,
  getMotionIntensityMode,
  isFloatingWindow,
  isFocusFloatingWindow,
  isFocusUnlockWindow,
  isUnlockWindow,
  useMainShellController,
} from "./features/shell/useMainShellController";
import "./App.css";
import "./components/EditorialPaperViews.css";
import "./components/GraphiteConsoleViews.css";
import "./components/AuroraOceanViews.css";
import "./components/BotanicalLibraryViews.css";
import "./components/DailyFocusLine.css";
import "./components/BrandMark.css";

function MainShell() {
  const {
    activeView,
    timer,
    savedConfirmation,
    todos,
    records,
    analytics,
    sessionTitle,
    setSessionTitle,
    setSessionTitleDirty,
    linkedTodoId,
    setLinkedTodoId,
    completeLinkedTodo,
    setCompleteLinkedTodo,
    countdownMinutes,
    setCountdownMinutes,
    countdownDraftDirty,
    setCountdownDraftDirty,
    timerPreferences,
    customAlertSoundName,
    todoTitle,
    setTodoTitle,
    todoDueDate,
    setTodoDueDate,
    todoDueTime,
    setTodoDueTime,
    todoImportance,
    setTodoImportance,
    editingTodo,
    editingRecord,
    recordEditDialogOpen,
    backups,
    backupLoadState,
    backupLoadError,
    selectedBackupFile,
    setSelectedBackupFile,
    lastBackupPath,
    portableBackupPath,
    setPortableBackupPath,
    portableBackupPreview,
    restorePortableTodos,
    setRestorePortableTodos,
    restorePortableRecords,
    setRestorePortableRecords,
    restorePortableAppPreferences,
    setRestorePortableAppPreferences,
    commandPaletteOpen,
    commandSearch,
    setCommandSearch,
    busy,
    busyLabel,
    message,
    messageKind,
    loadState,
    loadError,
    syncError,
    undoAction,
    floatingTab,
    setFloatingTab,
    floatingOpacity,
    floatingOpacityPanelOpen,
    setFloatingOpacityPanelOpen,
    selectedArchiveDate,
    setSelectedArchiveDate,
    todayDate,
    selectedSearchRecordId,
    selectedSearchRecordTitle,
    visibleRecords,
    recordTaskFilterId,
    recordTaskFilterTitle,
    clearRecordTaskFilter,
    closeMainWindowAfterSave,
    themeId,
    visualIntensity,
    motionIntensity,
    density,
    ready,
    pendingTodos,
    activeTodos,
    overdueTodos,
    completedTodos,
    todayTodos,
    todayCompletedTodos,
    nextTodo,
    selectedBackup,
    recordGroups,
    archiveDays,
    archivePath,
    selectedArchiveDay,
    selectedArchiveRecords,
    recentWeekDurationMs,
    recentWeekActiveDays,
    todoCompletionPercent,
    timerHasProgress,
    timerCanContinue,
    canFinish,
    clearMessage,
    alertIsVisible,
    retryLoad,
    dismissTimerAlert,
    finishFocus,
    changeCompletionPreference,
    changeMode,
    startFocus,
    pauseFocus,
    resetFocus,
    addTodo,
    toggleTodo,
    beginEditTodo,
    patchEditingTodo,
    saveTodoEdit,
    cancelEditTodo,
    useTodoForFocus,
    removeTodo,
    removeRecord,
    beginEditRecord,
    beginDetailedRecordEdit,
    patchEditingRecord,
    patchEditingRecordTitle,
    saveRecordEdit,
    cancelEditRecord,
    undoDelete,
    selectTheme,
    updateVisualIntensity,
    updateMotionIntensity,
    updateDensity,
    autoMiniOnStart,
    appPreferenceSaveError,
    appPreferenceSaveBusy,
    retryAppPreferencesSave,
    updateAutoMiniOnStart,
    currentTodo,
    todayPickTodos,
    focusPlan,
    setCurrentTodo,
    toggleTodayPick,
    startFocusForTodo,
    saveContinuationNote,
    createManualRecord,
    continuationPrompt,
    continuationSaveError,
    dismissContinuationPrompt,
    quickCaptureOpen,
    quickCaptureTitle,
    setQuickCaptureTitle,
    openQuickCapture,
    closeQuickCapture,
    saveQuickCapture,
    manualRecordOpen,
    openManualRecord,
    closeManualRecord,
    saveTimerPreferences,
    previewAlertSound,
    chooseCustomAlertSound,
    clearCustomAlertSound,
    loadBackups,
    createBackup,
    openBackupFolder,
    restoreBackup,
    previewPortableBackup,
    exportPortableBackup,
    importPortableBackup,
    clearAllData,
    changeView,
    startNextTodo,
    openCommandPalette,
    closeCommandPalette,
    executePaletteCommand,
    paletteCommands,
    updateFloatingOpacity,
    showFloatingTodos,
    setCommandInput,
    setCommandTrigger,
    setFloatingWorkspaceElement,
  } = useMainShellController();

  if (isUnlockWindow) {
    return (
      <button
        type="button"
        class="floating-unlock"
        title="解除锁定，恢复待办操作"
        aria-label="解除锁定，恢复待办操作"
        onClick={() => void unlockFloatingTodos()}
      >
        <LockKeyholeOpen size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
    );
  }

  if (isFocusUnlockWindow) {
    return (
      <button
        type="button"
        class="floating-unlock"
        title="解除专注锁定，恢复计时操作"
        aria-label="解除专注锁定，恢复计时操作"
        onClick={() => void unlockFocusFloating()}
      >
        <LockKeyholeOpen size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
    );
  }

  if (isFocusFloatingWindow) {
    return (
      <aside class="focus-floating" aria-label="专注悬浮窗">
        <header class="focus-floating__header">
          <div
            class="floating-todo__drag-handle"
            data-tauri-drag-region
            onMouseDown={(event) => {
              if (event.button === 0) {
                void startDraggingWindow();
              }
            }}
          >
            <span>正在专注</span>
            <strong>{timer().activeTaskTitle || "未命名事项"}</strong>
          </div>
          <div class="floating-todo__actions">
            <button
              type="button"
              class="floating-lock-button"
              title="锁定并开启鼠标穿透"
              aria-label="锁定并开启鼠标穿透"
              onClick={() => void lockFocusFloating()}
            >
              <LockKeyhole size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-button"
              title="返回主窗口"
              onClick={() => void restoreMainFromFocusFloating()}
            >
              返回
            </button>
          </div>
        </header>
        <div class="focus-floating__clock">
          <span>{timer().status}</span>
          <strong>{timer().elapsedLabel}</strong>
        </div>
          <Show when={timer().alertTitle && timerPreferences().toastReminderEnabled}>
            <div class="floating-alert" role="alert">
              <strong>{timer().alertTitle}</strong>
              <span>{timer().alertMessage}</span>
              <Show
                when={timer().alertKey === "countdown_complete"}
                fallback={
                  <button
                    type="button"
                    class="text-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    知道了
                  </button>
                }
              >
                <div class="floating-alert__actions">
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !canFinish()}
                    onClick={() => void finishFocus()}
                  >
                    保存并记录
                  </button>
                  <button
                    type="button"
                    class="text-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    稍后处理
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        <Show when={timer().linkedTodoId !== null}>
          <label class="linked-todo-option linked-todo-option--floating">
            <input
              type="checkbox"
              name="completeLinkedTodoFloating"
              checked={timer().completeLinkedTodoOnFinish}
              disabled={busy()}
              onChange={(event) => void changeCompletionPreference(event.currentTarget.checked)}
            />
            <span>完成后标记待办</span>
          </label>
        </Show>
        <div class="focus-floating__controls">
          <Show
            when={timer().isRunning}
            fallback={
              <button
                type="button"
                class="primary-button"
                disabled={busy() || !timerCanContinue()}
                onClick={() => void startFocus()}
              >
                继续
              </button>
            }
          >
            <button
              type="button"
              class="secondary-button"
              disabled={busy()}
              onClick={() => void pauseFocus()}
            >
              暂停
            </button>
          </Show>
          <button
            type="button"
            class="primary-button"
            disabled={busy() || !canFinish()}
            onClick={() => void finishFocus()}
          >
            完成并记录
          </button>
        </div>
      </aside>
    );
  }

  if (isFloatingWindow) {
    return (
      <aside
        class="floating-todo"
        aria-label="迷你工作台"
        ref={(element) => {
          setFloatingWorkspaceElement(element);
        }}
        style={{ opacity: floatingOpacity() / 100 }}
      >
        <header class="floating-todo__header">
          <div
            class="floating-todo__drag-handle"
            data-tauri-drag-region
            onMouseDown={(event) => {
              if (event.button === 0) {
                void startDraggingWindow();
              }
            }}
          >
            <span>Focused Moment</span>
            <strong>迷你工作台</strong>
          </div>
          <div class="floating-todo__actions">
            <button
              type="button"
              class="floating-lock-button"
              title="锁定并开启鼠标穿透"
              aria-label="锁定并开启鼠标穿透"
              onClick={() => void lockFloatingTodos()}
            >
              <LockKeyhole size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="floating-opacity-button"
              title="调整悬浮窗透明度"
              aria-label="调整悬浮窗透明度"
              aria-expanded={floatingOpacityPanelOpen()}
              aria-controls="floating-opacity-panel"
              onClick={() => setFloatingOpacityPanelOpen((open) => !open)}
            >
              <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-button"
              title="返回主窗口"
              onClick={() => void restoreMainFromFloatingTodos()}
            >
              返回
            </button>
          </div>
        </header>

        <Show when={floatingOpacityPanelOpen()}>
          <section id="floating-opacity-panel" class="floating-opacity-panel" role="dialog" aria-label="悬浮窗透明度">
            <div class="floating-opacity-panel__heading">
              <span>悬浮窗透明度</span>
              <strong>{floatingOpacity()}%</strong>
            </div>
            <label class="floating-opacity-panel__slider">
              <span class="sr-only">悬浮窗透明度</span>
              <input
                type="range"
                min={minFloatingOpacity}
                max={defaultFloatingOpacity}
                step="1"
                value={floatingOpacity()}
                aria-label="悬浮窗透明度"
                onInput={(event) => updateFloatingOpacity(Number(event.currentTarget.value))}
              />
            </label>
            <div class="floating-opacity-panel__scale" aria-hidden="true">
              <span>更透明</span>
              <span>更清晰</span>
            </div>
          </section>
        </Show>

        <nav class="floating-tabs" aria-label="悬浮内容">
          <button
            type="button"
            classList={{ "floating-tab": true, "floating-tab--active": floatingTab() === "todos" }}
            aria-selected={floatingTab() === "todos"}
            onClick={() => setFloatingTab("todos")}
          >
            待办
            <span>{pendingTodos().length}</span>
          </button>
          <Show when={timerHasProgress()}>
            <button
              type="button"
              classList={{ "floating-tab": true, "floating-tab--active": floatingTab() === "timer" }}
              aria-selected={floatingTab() === "timer"}
              onClick={() => setFloatingTab("timer")}
            >
              当前计时
              <span class="floating-tab__signal" aria-label={timer().isRunning ? "正在运行" : "已暂停"} />
            </button>
          </Show>
        </nav>

        <Show
          when={floatingTab() === "timer" && timerHasProgress()}
          fallback={
            <div class="floating-todo__list" role="tabpanel" aria-label="待办列表">
              <Show when={loadState() === "loading"}>
                <p class="floating-empty">正在读取待办…</p>
              </Show>
              <Show when={loadState() === "error"}>
                <div class="floating-empty floating-empty--error">
                  <p>读取失败</p>
                  <button type="button" class="text-button" onClick={() => void retryLoad()}>
                    重试
                  </button>
                </div>
              </Show>
              <Show when={ready() && pendingTodos().length > 0}>
                <For each={pendingTodos()}>
                  {(item) => (
                    <button
                      type="button"
                      class="floating-todo__item"
                      disabled={busy()}
                      onClick={() => void toggleTodo(item.id)}
                    >
                      <span class="floating-check" aria-hidden="true" />
                      <span class="floating-todo__copy">
                        <strong>{item.title}</strong>
                        <small>{formatTodoDue(item)}</small>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
              <Show when={ready() && pendingTodos().length === 0}>
                <p class="floating-empty">没有未完成的待办</p>
              </Show>
            </div>
          }
        >
          <section class="floating-timer" role="tabpanel" aria-label="当前正在的计时">
            <div class="floating-timer__identity">
              <span>当前专注</span>
              <strong>{timer().activeTaskTitle || "未命名事项"}</strong>
            </div>
            <div class="floating-timer__clock">
              <span>{timer().status}</span>
              <strong>{timer().elapsedLabel}</strong>
            </div>
            <Show when={timer().alertTitle && timerPreferences().toastReminderEnabled}>
              <div class="floating-alert" role="alert">
                <strong>{timer().alertTitle}</strong>
                <span>{timer().alertMessage}</span>
                <Show
                  when={timer().alertKey === "countdown_complete"}
                  fallback={
                    <button
                      type="button"
                      class="text-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      知道了
                    </button>
                  }
                >
                  <div class="floating-alert__actions">
                    <button
                      type="button"
                      class="primary-button"
                      disabled={busy() || !canFinish()}
                      onClick={() => void finishFocus()}
                    >
                      保存并记录
                    </button>
                    <button
                      type="button"
                      class="text-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      稍后处理
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={timer().linkedTodoId !== null}>
              <label class="linked-todo-option linked-todo-option--floating">
                <input
                  type="checkbox"
                  name="completeLinkedTodoFloating"
                  checked={timer().completeLinkedTodoOnFinish}
                  disabled={busy()}
                  onChange={(event) => void changeCompletionPreference(event.currentTarget.checked)}
                />
                <span>完成后标记待办</span>
              </label>
            </Show>
            <div class="focus-floating__controls">
              <Show
                when={timer().isRunning}
                fallback={
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !timerCanContinue()}
                    onClick={() => void startFocus()}
                  >
                    继续
                  </button>
                }
              >
                <button
                  type="button"
                  class="secondary-button"
                  disabled={busy()}
                  onClick={() => void pauseFocus()}
                >
                  暂停
                </button>
              </Show>
              <button
                type="button"
                class="primary-button"
                disabled={busy() || !canFinish()}
                onClick={() => void finishFocus()}
              >
                完成并记录
              </button>
            </div>
          </section>
        </Show>
      </aside>
    );
  }

  function handleMainWindowMouseDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, a, .window-controls")) {
      return;
    }

    void startDraggingWindow();
  }

  return (
    <div
      classList={{
        "minimal-app": true,
        "minimal-app--cinematic": true,
        "minimal-app--running": timer().isRunning,
        "minimal-app--paused": !timer().isRunning && timerHasProgress(),
        "minimal-app--break": timer().phaseKey === "break",
        "minimal-app--focus": activeView() === "focus",
        "minimal-app--todos": activeView() === "todos",
        "minimal-app--records": activeView() === "records",
        "minimal-app--settings": activeView() === "settings",
        "minimal-app--trail": activeView() === "today",
      }}
      data-theme={themeId()}
      data-density={density()}
      data-motion={getMotionIntensityMode(motionIntensity())}
      style={`--nv-visual-intensity: ${visualIntensity() / 100}; --nv-visual-opacity: ${0.55 + (visualIntensity() / 100) * 0.45}; --nv-motion-intensity: ${motionIntensity() / 100};`}
    >
      <a class="skip-link" href="#main-content">跳到主要内容</a>
      <header class="app-bar" onMouseDown={handleMainWindowMouseDown}>
        <div class="app-brand" data-tauri-drag-region>
          <span class="app-brand__mark" />
          <strong>Focused Moment</strong>
        </div>
        <div class="app-bar__actions">
          <button
            type="button"
            class="command-trigger"
            ref={(element) => setCommandTrigger(element)}
            aria-keyshortcuts="Control+K Meta+K"
            aria-haspopup="dialog"
            aria-expanded={commandPaletteOpen()}
            aria-controls="command-palette-dialog"
            onClick={openCommandPalette}
          >
            命令 <kbd>Ctrl K</kbd>
          </button>
          <button
            type="button"
            class="quiet-button"
            disabled={busy()}
            onClick={() => void showFloatingTodos()}
          >
            迷你工作台
          </button>
          <div
            class="window-controls"
            aria-label="窗口控制"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              class="window-control"
              aria-label="最小化窗口"
              title="最小化"
              onClick={() => void minimizeMainWindow()}
            >
              <Minus size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="window-control"
              aria-label="最大化或还原窗口"
              title="最大化 / 还原"
              onClick={() => void toggleMaximizeMainWindow()}
            >
              <Maximize2 size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="window-control window-control--close"
              aria-label="关闭窗口"
              title="关闭窗口（隐藏到托盘）"
              onClick={() => void closeMainWindowAfterSave()}
            >
              <X size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

        <main id="main-content" class="minimal-workspace">
        <nav class="minimal-nav" aria-label="主导航">
          <div class="trail-nav__brand" data-tauri-drag-region aria-label="Focused Moment">
            <span class="trail-nav__logo" aria-hidden="true">
              <span class="trail-nav__logo-ring" />
              <span class="trail-nav__logo-dot" />
            </span>
            <strong>Focused</strong>
            <span>Moment</span>
          </div>
          <button
            type="button"
            classList={{ active: activeView() === "today" }}
            aria-current={activeView() === "today" ? "page" : undefined}
            onClick={() => changeView("today")}
          >
            <CircleDot class="trail-nav__icon trail-nav__icon--today" size={23} strokeWidth={1.7} aria-hidden="true" />
            <span class="minimal-nav__label">今日</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "focus" }}
            aria-current={activeView() === "focus" ? "page" : undefined}
            onClick={() => changeView("focus")}
          >
            <Clock3 class="trail-nav__icon trail-nav__icon--focus" size={23} strokeWidth={1.7} aria-hidden="true" />
            <span class="minimal-nav__label">计时</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "todos" }}
            aria-current={activeView() === "todos" ? "page" : undefined}
            onClick={() => changeView("todos")}
          >
            <SquareCheck class="trail-nav__icon trail-nav__icon--todos" size={23} strokeWidth={1.7} aria-hidden="true" />
            <span class="minimal-nav__label">待办</span>
            <span class="minimal-nav__count" aria-label={`${pendingTodos().length} 个未完成待办`}>{pendingTodos().length}</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "records" }}
            aria-current={activeView() === "records" ? "page" : undefined}
            onClick={() => changeView("records")}
          >
            <ChartNoAxesCombined class="trail-nav__icon trail-nav__icon--records" size={23} strokeWidth={1.7} aria-hidden="true" />
            <span class="minimal-nav__label">记录</span>
          </button>
          <button
            type="button"
            classList={{ active: activeView() === "settings" }}
            aria-current={activeView() === "settings" ? "page" : undefined}
            onClick={() => changeView("settings")}
          >
            <Settings class="trail-nav__icon trail-nav__icon--settings" size={23} strokeWidth={1.7} aria-hidden="true" />
            <span class="minimal-nav__label">设置</span>
          </button>
        </nav>

        <section
          classList={{
            "minimal-content": true,
            "minimal-content--records": activeView() === "records",
          }}
          aria-busy={busy() || loadState() === "loading"}
        >
          <Show when={alertIsVisible()}>
            <div class="timer-alert timer-alert--global" role="alert">
              <div class="timer-alert__signal" aria-hidden="true">
                <span class="timer-alert__signal-dot" />
                <span>时间到</span>
              </div>
              <div class="timer-alert__copy">
                <strong>{timer().alertTitle}</strong>
                <p>{timer().alertMessage}</p>
              </div>
              <div class="timer-alert__actions">
                <Show
                  when={timer().alertKey === "countdown_complete"}
                  fallback={
                    <button
                      type="button"
                      class="secondary-button"
                      disabled={busy()}
                      onClick={() => void dismissTimerAlert()}
                    >
                      知道了
                    </button>
                  }
                >
                  <button
                    type="button"
                    class="primary-button"
                    disabled={busy() || !canFinish()}
                    onClick={() => void finishFocus()}
                  >
                    保存并记录
                  </button>
                  <button
                    type="button"
                    class="secondary-button"
                    disabled={busy()}
                    onClick={() => void dismissTimerAlert()}
                  >
                    稍后处理
                  </button>
                </Show>
              </div>
            </div>
          </Show>
          <Show when={syncError()}>
            <div class="sync-error" role="status" aria-live="polite">
              <span>本地数据暂时没有刷新成功。</span>
              <button type="button" class="text-button" disabled={busy()} onClick={() => void retryLoad()}>
                重试
              </button>
            </div>
          </Show>
          <Show when={loadState() === "loading"}>
            <p class="load-copy">正在读取本地数据…</p>
          </Show>
          <Show when={loadState() === "error"}>
            <div class="load-error" role="alert">
              <strong>暂时无法读取本地数据</strong>
              <span>{loadError()}</span>
              <button type="button" class="secondary-button" disabled={busy()} onClick={() => void retryLoad()}>
                重试读取
              </button>
            </div>
          </Show>
          <Show when={activeView() === "records" && (recordTaskFilterId() !== null || selectedSearchRecordId() !== null)}>
            <div class="records-task-filter" role="status">
              <span>{selectedSearchRecordId() !== null ? "正在回顾记录：" : "正在回顾任务："}<strong>{selectedSearchRecordId() !== null ? selectedSearchRecordTitle() : recordTaskFilterTitle()}</strong> · {visibleRecords().length} 条匹配记录</span>
              <span>列表和时段分布按筛选展示；累计统计与七日趋势仍包含全部记录。</span>
              <Show when={visibleRecords().length === 0}><span>没有匹配的专注记录。</span></Show>
              <button type="button" class="text-button" onClick={clearRecordTaskFilter}>
                {selectedSearchRecordId() !== null ? "清除记录筛选" : "清除任务筛选"}
              </button>
            </div>
          </Show>
          <ThemeSurface
            activeView={() => activeView()}
            themeId={() => themeId()}
            today={{
              todayDate: todayDate(),
              todayLabel: formatAnalyticsDate(todayDate()),
              timer: () => timer(),
              ready,
              busy,
              timerHasProgress,
              timerCanContinue,
              nextTodo,
              currentTodo,
              todayPickTodos,
              todayPickIds: () => focusPlan().todayPickIds,
              planTodos: () => pendingTodos().filter((item) => item.scheduledDate === todayDate() || item.scheduledDate === ""),
              todayTodos,
              todayCompletedTodos,
              records: () => records(),
              analytics: () => analytics(),
              defaultFocusMinutes: () => timerPreferences().stopwatchReminderMinutes ?? timerPreferences().pomodoroFocusMinutes,
              formatTodoDue,
              importanceLabel,
              onPause: () => void pauseFocus(),
              onContinue: () => void startFocus(),
              onFinish: () => finishFocus(),
              onStartNext: () => void startNextTodo(),
              onSetCurrentTodo: (id) => void setCurrentTodo(id),
              onToggleTodayPick: (id) => void toggleTodayPick(id),
              onStartTodo: (item) => void startFocusForTodo(item),
              onQuickCapture: openQuickCapture,
              onOpenFocus: () => changeView("focus"),
              onOpenRecords: () => changeView("records"),
              onUseTodo: useTodoForFocus,
              onOpenTodos: () => changeView("todos"),
            }}
            focus={{
              timer: () => timer(),
              todaySessionCount: () => analytics()?.todaySessionCount ?? 0,
              timerPreferences: () => timerPreferences(),
              todos: () => todos(),
              records: () => records(),
              pendingTodos,
              ready,
              busy,
              timerHasProgress,
              timerCanContinue,
              canFinish,
              savedConfirmation,
              sessionTitle: () => sessionTitle(),
              linkedTodoId: () => linkedTodoId(),
              completeLinkedTodo: () => completeLinkedTodo(),
              countdownMinutes: () => countdownMinutes(),
              countdownDraftDirty: () => countdownDraftDirty(),
              busyLabel: () => busyLabel(),
              onSessionTitleChange: setSessionTitle,
              onSessionTitleDirty: () => setSessionTitleDirty(true),
              onLinkedTodoChange: setLinkedTodoId,
              onCompleteLinkedTodoChange: setCompleteLinkedTodo,
              onCountdownMinutesChange: setCountdownMinutes,
              onCountdownDraftDirty: () => setCountdownDraftDirty(true),
              onChangeMode: (mode) => changeMode(mode),
              onStart: () => void startFocus(),
              onPause: () => void pauseFocus(),
              onFinish: () => void finishFocus(),
              onReset: () => void resetFocus(),
              onShowFocusFloating: () => void showFloatingTodos(),
              onOpenRecords: () => changeView("records"),
            }}
            todos={{
              todos: () => todos(),
              activeTodos,
              overdueTodos,
              completedTodos,
              todayTodos,
              todayCompletedTodos,
              timer: () => timer(),
              timerHasProgress,
              ready,
              busy,
              busyLabel: () => busyLabel(),
              todoTitle: () => todoTitle(),
              todoDueDate: () => todoDueDate(),
              todoDueTime: () => todoDueTime(),
              todoImportance: () => todoImportance(),
              editingTodo: () => editingTodo(),
              onTodoTitleChange: setTodoTitle,
              onTodoDueDateChange: setTodoDueDate,
              onTodoDueTimeChange: setTodoDueTime,
              onTodoImportanceChange: setTodoImportance,
              onAddTodo: () => void addTodo(),
              onToggle: (id) => void toggleTodo(id),
              onBeginEdit: beginEditTodo,
              onUseForFocus: useTodoForFocus,
              onRemove: (id) => void removeTodo(id),
              onPatch: patchEditingTodo,
              onSave: () => void saveTodoEdit(),
              onCancel: cancelEditTodo,
              formatTodoDue,
              importanceLabel,
            }}
            records={{
              analytics: () => analytics(),
              records: () => visibleRecords(),
              archiveDays: () => archiveDays(),
              archivePath: () => archivePath(),
              selectedArchiveDate: () => selectedArchiveDate(),
              selectedArchiveDay: () => selectedArchiveDay(),
              selectedArchiveRecords: () => selectedArchiveRecords(),
              recordGroups: () => recordGroups(),
              ready,
              busy,
              editingRecord: () => editingRecord(),
              todoCompletionPercent,
              recentWeekActiveDays,
              recentWeekDurationMs,
              formatAnalyticsDate,
              formatArchiveRangeDate,
              formatRecordDate,
              formatRecordDay,
              formatDurationMs,
              onSelectDate: (date) => {
                clearRecordTaskFilter();
                setSelectedArchiveDate(date);
              },
              onBeginEdit: beginEditRecord,
              onBeginDetailedEdit: beginDetailedRecordEdit,
              onPatchEdit: patchEditingRecordTitle,
              onSaveEdit: () => void saveRecordEdit(),
              onCancelEdit: cancelEditRecord,
              onRemove: (id) => void removeRecord(id),
              onCreateManualRecord: openManualRecord,
            }}
            settings={{
              timerPreferences: () => timerPreferences(),
              busy,
              busyLabel: () => busyLabel(),
              customAlertSoundName: () => customAlertSoundName(),
              backups: () => backups(),
              backupLoadState: () => backupLoadState(),
              backupLoadError: () => backupLoadError(),
              selectedBackupFile: () => selectedBackupFile(),
              selectedBackup: () => selectedBackup(),
              lastBackupPath: () => lastBackupPath(),
              themeId: () => themeId(),
              visualIntensity: () => visualIntensity(),
              motionIntensity: () => motionIntensity(),
              density: () => density(),
              onThemeSelect: selectTheme,
              onVisualIntensityChange: updateVisualIntensity,
              onMotionIntensityChange: updateMotionIntensity,
              onDensityChange: updateDensity,
              autoMiniOnStart,
              appPreferenceSaveError,
              appPreferenceSaveBusy,
              onAutoMiniOnStartChange: updateAutoMiniOnStart,
              onRetryAppPreferenceSave: retryAppPreferencesSave,
              onSaveTimerPreferences: saveTimerPreferences,
              onPreviewAlertSound: previewAlertSound,
              onChooseCustomAlertSound: chooseCustomAlertSound,
              onClearCustomAlertSound: clearCustomAlertSound,
              onSelectedBackupFile: setSelectedBackupFile,
              onLoadBackups: loadBackups,
              onCreateBackup: createBackup,
              onOpenBackupFolder: openBackupFolder,
              onRestoreBackup: restoreBackup,
              onClearAllData: clearAllData,
            }}
          />

          <Show when={activeView() === "settings"}>
            <PortableBackupPanel
              path={portableBackupPath()}
              preview={portableBackupPreview()}
              restoreTodos={restorePortableTodos()}
              restoreRecords={restorePortableRecords()}
              restoreAppPreferences={restorePortableAppPreferences()}
              busy={busy()}
              onPathChange={setPortableBackupPath}
              onPreview={previewPortableBackup}
              onExport={exportPortableBackup}
              onImport={importPortableBackup}
              onRestoreTodosChange={setRestorePortableTodos}
              onRestoreRecordsChange={setRestorePortableRecords}
              onRestoreAppPreferencesChange={setRestorePortableAppPreferences}
            />
          </Show>

          <QuickCaptureDialog
            open={quickCaptureOpen}
            title={quickCaptureTitle}
            busy={busy}
            onTitleChange={setQuickCaptureTitle}
            onSave={saveQuickCapture}
            onClose={closeQuickCapture}
          />
          <ManualFocusRecordDialog
            open={manualRecordOpen}
            busy={busy}
            todayDate={todayDate()}
            todos={() => todos()}
            onSubmit={async (payload) => {
              if (await createManualRecord(payload)) closeManualRecord();
            }}
            onClose={closeManualRecord}
          />
          <FocusRecordEditDialog
            open={recordEditDialogOpen()}
            draft={editingRecord()}
            todos={todos()}
            busy={busy()}
            onChange={patchEditingRecord}
            onSubmit={() => void saveRecordEdit()}
            onClose={cancelEditRecord}
          />
          <ContinuationNotePrompt
            prompt={continuationPrompt}
            error={continuationSaveError}
            busy={busy}
            onSave={async (id, note) => {
              if (await saveContinuationNote(id, note)) dismissContinuationPrompt();
            }}
            onSkip={dismissContinuationPrompt}
          />

          <Show when={message()}>
            <div
              classList={{ "app-message": true, [`app-message--${messageKind()}`]: true }}
              role="status"
              aria-live="polite"
              aria-label="通知，点击关闭"
              tabindex="0"
              title="点击关闭"
              onClick={clearMessage}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
                  event.preventDefault();
                  clearMessage();
                }
              }}
            >
              <span>{message()}</span>
              <button
                type="button"
                class="app-message__dismiss"
                aria-label="关闭通知"
                onClick={(event) => {
                  event.stopPropagation();
                  clearMessage();
                }}
              >
                ×
              </button>
            </div>
          </Show>

          <Show when={undoAction()}>
            {(action) => (
              <div class="undo-bar" role="status" aria-live="polite">
                <span>已删除“{action().item.title}”</span>
                <button type="button" class="secondary-button" disabled={busy()} onClick={() => void undoDelete()}>
                  撤销
                </button>
              </div>
            )}
          </Show>
        </section>
        <CommandPalette
          open={commandPaletteOpen}
          search={commandSearch}
          commands={paletteCommands}
          inputRef={(element) => setCommandInput(element)}
          onSearch={setCommandSearch}
          onClose={closeCommandPalette}
          onExecute={executePaletteCommand}
        />
      </main>
    </div>
  );
}

export default MainShell;
