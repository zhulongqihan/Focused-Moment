import { expect } from "@playwright/test";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


export async function bootWithTauriMock(page, { includeOverdue = false, includeRecords = false, windowLabel = "main", pausedFocus = false, runningFocus = false, completedCountdown = false, initialLoadError = false, autoMiniOnStart = false, delayAppPreferences = false, todayRecordCount = includeRecords ? 1 : 0, todayTodoCount = 1, futureTodoCount = 0, completedTodoCount = 0, historyDayCount = 0, freshTodoSnapshots = false, freshRecordSnapshots = false, initialPendingBookmarkNotices = [] } = {}) {
  await page.addInitScript(({ today, includeOverdue, includeRecords, windowLabel, pausedFocus, runningFocus, completedCountdown, initialLoadError, autoMiniOnStart, delayAppPreferences, todayRecordCount, todayTodoCount, futureTodoCount, completedTodoCount, historyDayCount, freshTodoSnapshots, freshRecordSnapshots, initialPendingBookmarkNotices }) => {
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterdayDate = dateKey(yesterday);
    const overdueDate = yesterdayDate;
    let todos = [
      {
        id: 1,
        title: "写完产品复盘",
        isCompleted: false,
        scheduledDate: today,
        scheduledTime: "10:00",
        importanceKey: "high",
      },
    ];
    if (includeOverdue) {
      todos.push({
        id: 2,
        title: "过期事项",
        isCompleted: false,
        scheduledDate: overdueDate,
        scheduledTime: "",
        importanceKey: "medium",
      });
    }
    if (todayTodoCount === 0) {
      todos = todos.filter((item) => item.scheduledDate !== today);
    }
    let focusRecords = includeRecords ? [
      {
        id: 3,
        title: "完成产品复盘",
        durationMs: 45 * 60 * 1000,
        durationLabel: "00:45:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: 1,
        linkedTodoTitle: "写完产品复盘",
        completedAt: `${today}T11:30:00`,
        completedDate: today,
        completedTime: "11:30",
      },
      {
        id: 2,
        title: "整理研究资料",
        durationMs: 30 * 60 * 1000,
        durationLabel: "00:30:00",
        modeKey: "countdown",
        modeLabel: "倒计时",
        phaseLabel: "倒计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${yesterdayDate}T22:40:00`,
        completedDate: yesterdayDate,
        completedTime: "22:40",
      },
      {
        id: 1,
        title: "阅读行业报告",
        durationMs: 15 * 60 * 1000,
        durationLabel: "00:15:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${yesterdayDate}T21:10:00`,
        completedDate: yesterdayDate,
        completedTime: "21:10",
      },
    ] : [];
    const existingTodayRecordCount = focusRecords.filter((record) => record.completedDate === today).length;
    for (let index = existingTodayRecordCount; index < todayRecordCount; index += 1) {
      const hour = String(12 + index).padStart(2, "0");
      focusRecords.push({
        id: 100 + index,
        title: `专注段 ${index + 1}`,
        durationMs: 45 * 60 * 1000,
        durationLabel: "00:45:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: null,
        linkedTodoTitle: `路线节点 ${index + 1}`,
        completedAt: `${today}T${hour}:00:00`,
        completedDate: today,
        completedTime: `${hour}:00`,
      });
    }
    for (let index = 0; index < historyDayCount; index += 1) {
      const historyDate = new Date(`${today}T00:00:00`);
      historyDate.setDate(historyDate.getDate() - index - 2);
      const historyDateKey = dateKey(historyDate);
      focusRecords.push({
        id: 5000 + index,
        title: `历史归档 ${index + 1}`,
        durationMs: 30 * 60 * 1000,
        durationLabel: "00:30:00",
        modeKey: "stopwatch",
        modeLabel: "正向计时",
        phaseLabel: "正向计时",
        linkedTodoId: null,
        linkedTodoTitle: null,
        completedAt: `${historyDateKey}T09:00:00`,
        completedDate: historyDateKey,
        completedTime: "09:00",
      });
    }
    const existingTodayTodoCount = todos.filter((item) => item.scheduledDate === today).length;
    for (let index = existingTodayTodoCount; index < todayTodoCount; index += 1) {
      todos.push({
        id: 300 + index,
        title: `额外时段 ${index + 1}`,
        isCompleted: false,
        scheduledDate: today,
        scheduledTime: `${String(15 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
        importanceKey: "medium",
      });
    }
    for (let index = 0; index < futureTodoCount; index += 1) {
      const futureDate = new Date(`${today}T00:00:00`);
      futureDate.setDate(futureDate.getDate() + 1 + Math.floor(index / 2));
      todos.push({
        id: 800 + index,
        title: `未来事项 ${index + 1}`,
        isCompleted: false,
        scheduledDate: dateKey(futureDate),
        scheduledTime: `${String(9 + index).padStart(2, "0")}:00`,
        importanceKey: "medium",
      });
    }
    for (let index = 0; index < completedTodoCount; index += 1) {
      todos.push({
        id: 600 + index,
        title: `已完成事项 ${index + 1}`,
        isCompleted: true,
        scheduledDate: today,
        scheduledTime: "",
        importanceKey: "medium",
      });
    }
    let pendingBookmarkNotices = initialPendingBookmarkNotices.map((notice) => ({ ...notice }));
    window.__todoItemsCalls = 0;
    window.__focusRecordCalls = 0;
    window.__timerSnapshotCalls = 0;
    window.__focusFloatingShown = false;
    window.__floatingTodosShown = false;
    window.__focusFloatingUnlocked = false;
    window.__mainWindowDragged = false;
    window.__minimizeMainWindowCalls = 0;
    window.__toggleMaximizeMainWindowCalls = 0;
    window.__closeMainWindowCalls = 0;
    window.__flashMainWindowAttention = false;
    window.__completedFocusCalls = 0;
    window.__pendingBookmarkQueryCalls = 0;
    window.__pendingBookmarkEventReady = false;
    window.__mainWindowShownEventReady = false;
    window.__bookmarkSaveCalls = 0;
    window.__bookmarkAcknowledgementCalls = 0;
    window.__failBookmarkSave = false;
    window.__clearAppDataCalls = 0;
    window.__mainRestored = false;
    window.__mainRestoreCalls = 0;
    window.__failNextMainRestore = false;
    window.__resetTimerCalls = 0;
    window.__resetTimerSuccessCalls = 0;
    window.__resetTimerArgs = [];
    window.__failResetTimer = false;
    window.__holdNextResetTimer = false;
    window.__releaseResetTimer = null;
    window.__startTimerCalls = 0;
    window.__pauseTimerCalls = 0;
    window.__miniWorkspaceShown = false;
    window.__quickCaptureCalls = 0;
    window.__continuationNoteCalls = 0;
    window.__manualRecordCalls = 0;
    window.__recordUpdateCalls = 0;
    window.__backupPreviewCalls = 0;
    window.__backupImportCalls = 0;
    window.__appPreferenceUpdateCalls = 0;
    window.__failAppPreferenceSave = false;
    window.__releaseAppPreferencesLoad = null;
    window.__delayNextAppPreferencesRead = false;
    window.__releaseNextAppPreferencesRead = null;
    window.__delayedAppPreferenceReadsCompleted = 0;
    window.__appStateSyncEmits = 0;
    let initialLoadFailures = initialLoadError ? 1 : 0;
    const eventCallbacks = new Map();
    const eventListeners = new Map();
    const emitMockEvent = (event, payload = null) => {
      for (const callbackId of eventListeners.get(event) ?? []) {
        eventCallbacks.get(callbackId)?.({ event, id: callbackId, payload });
      }
    };
    window.__emitMockEvent = emitMockEvent;
    window.__queuePendingBookmarkNotice = (notice) => pendingBookmarkNotices.push({ ...notice });
    let nextEventCallbackId = 1;
    window.__appStateSyncReady = false;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (event, eventId) => {
        eventListeners.get(event)?.delete(eventId);
        eventCallbacks.delete(eventId);
      },
    };
    let timerPreferences = {
      pomodoroFocusMinutes: 25,
      pomodoroBreakMinutes: 5,
      stopwatchReminderMinutes: 25,
      toastReminderEnabled: true,
      windowAttentionReminderEnabled: true,
      soundReminderEnabled: true,
      alertSoundKey: "soft_chime",
    };
    let appPreferences = {
      schemaVersion: 3,
      themeId: "night-valley",
      visualIntensity: 72,
      motionIntensity: 44,
      density: "roomy",
      floatingOpacity: 100,
      autoMiniOnStart,
      customAlertSoundName: "",
      customAlertSoundData: null,
    };
    let focusPlan = {
      currentTodoId: null,
      todayPickIds: todos.filter((item) => !item.isCompleted && (item.scheduledDate === today || item.scheduledDate === "")).slice(0, 3).map((item) => item.id),
    };
    focusPlan.currentTodoId = focusPlan.todayPickIds[0] ?? null;
    todos = todos.map((item) => ({ ...item, continuationNote: item.continuationNote ?? "", continuationUpdatedAt: item.continuationUpdatedAt ?? null }));
    focusRecords = focusRecords.map((record) => ({ ...record, source: record.source ?? "timer", timeBasis: record.timeBasis ?? "completion_day", editedAt: record.editedAt ?? null }));
    let timer = {
      sessionId: "mock-session-1",
      modeKey: completedCountdown ? "countdown" : "stopwatch",
      phaseKey: completedCountdown ? "countdown" : "stopwatch",
      mode: completedCountdown ? "倒计时" : "正向计时",
      phaseLabel: completedCountdown ? "倒计时" : "正向计时",
      status: completedCountdown ? "已结束" : runningFocus ? "正向计时中" : pausedFocus ? "已暂停" : "待开始",
      isRunning: runningFocus,
      elapsedMs: completedCountdown ? 60 * 60 * 1000 : pausedFocus || runningFocus ? 30_000 : 0,
      elapsedLabel: completedCountdown ? "01:00:00" : pausedFocus || runningFocus ? "00:00:30" : "00:00:00",
      targetDurationMs: completedCountdown ? 60 * 60 * 1000 : 25 * 60 * 1000,
      remainingMs: completedCountdown ? 0 : null,
      secondaryLabel: completedCountdown ? "本轮剩余时间" : "已累计时长",
      canCompleteSession: true,
      hasUnsubmittedProgress: completedCountdown || pausedFocus || runningFocus,
      activeTaskTitle: pausedFocus || runningFocus ? "写完产品复盘" : "",
      linkedTodoId: null,
      completeLinkedTodoOnFinish: false,
      currentRound: 1,
      completedFocusCount: 0,
      completedBreakCount: 0,
      recoveredFromLastSession: false,
      modeSwitchLocked: false,
      modeSwitchHint: null,
      alertSequence: 0,
      alertKey: completedCountdown ? "countdown_complete" : null,
      alertTitle: completedCountdown ? "倒计时已结束" : null,
      alertMessage: completedCountdown ? "倒计时已完成，已累计专注 60 分钟。点击“保存并记录”后写入专注记录。" : null,
    };
    window.__replaceTimer = (patch) => {
      timer = { ...timer, ...patch };
      timer.hasUnsubmittedProgress = Boolean(
        timer.isRunning || timer.elapsedMs > 0 || timer.recoveredFromLastSession
      );
    };
    const formatDuration = (durationMs) => {
      const totalSeconds = Math.round(Math.max(0, durationMs) / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    };
    const recordsByDate = new Map();
    for (const record of focusRecords) {
      const current = recordsByDate.get(record.completedDate) ?? {
        date: record.completedDate,
        totalDurationMs: 0,
        sessionCount: 0,
        linkedSessionCount: 0,
        independentSessionCount: 0,
      };
      current.totalDurationMs += record.durationMs;
      current.sessionCount += 1;
      if (record.linkedTodoId === null) {
        current.independentSessionCount += 1;
      } else {
        current.linkedSessionCount += 1;
      }
      recordsByDate.set(record.completedDate, current);
    }
    const dailyBreakdown = Array.from(recordsByDate.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((day) => ({ ...day, totalDurationLabel: formatDuration(day.totalDurationMs) }));
    const totalFocusDurationMs = focusRecords.reduce((total, record) => total + record.durationMs, 0);
    const activeDays = dailyBreakdown.filter((day) => day.totalDurationMs > 0).length;
    const todayRecords = focusRecords.filter((record) => record.completedDate === today);
    const todayFocusDurationMs = todayRecords.reduce((total, record) => total + record.durationMs, 0);
    const bestDay = dailyBreakdown.reduce((best, day) => !best || day.totalDurationMs > best.totalDurationMs ? day : best, null);
    let analytics = {
      totalFocusDurationMs,
      totalFocusDurationLabel: totalFocusDurationMs > 0 ? formatDuration(totalFocusDurationMs) : "0 分钟",
      sessionCount: focusRecords.length,
      linkedSessionCount: focusRecords.filter((record) => record.linkedTodoId !== null).length,
      independentSessionCount: focusRecords.filter((record) => record.linkedTodoId === null).length,
      pendingTodoCount: todos.length,
      completedTodoCount: 0,
      activeDays,
      averageDailyDurationLabel: activeDays > 0 ? formatDuration(totalFocusDurationMs / activeDays) : "0 分钟",
      todayFocusDurationLabel: todayFocusDurationMs > 0 ? formatDuration(todayFocusDurationMs) : "0 分钟",
      todaySessionCount: todayRecords.length,
      currentStreakDays: activeDays > 0 ? Math.min(activeDays, historyDayCount + (includeRecords ? 2 : 0)) : 0,
      bestFocusDate: bestDay?.date ?? null,
      bestFocusDurationLabel: bestDay?.totalDurationLabel ?? null,
      dailyBreakdown,
    };
    const recalculateAnalytics = () => {
      const byDate = new Map();
      for (const record of focusRecords) {
        const day = byDate.get(record.completedDate) ?? { date: record.completedDate, totalDurationMs: 0, sessionCount: 0, linkedSessionCount: 0, independentSessionCount: 0 };
        day.totalDurationMs += record.durationMs;
        day.sessionCount += 1;
        if (record.linkedTodoId === null) day.independentSessionCount += 1;
        else day.linkedSessionCount += 1;
        byDate.set(record.completedDate, day);
      }
      const breakdown = Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date)).map((day) => ({ ...day, totalDurationLabel: formatDuration(day.totalDurationMs) }));
      const total = focusRecords.reduce((sum, record) => sum + record.durationMs, 0);
      const todayRecords = focusRecords.filter((record) => record.completedDate === today);
      const activeDays = breakdown.filter((day) => day.totalDurationMs > 0).length;
      const best = breakdown.reduce((current, day) => !current || day.totalDurationMs > current.totalDurationMs ? day : current, null);
      analytics = { ...analytics, totalFocusDurationMs: total, totalFocusDurationLabel: total ? formatDuration(total) : "0 分钟", sessionCount: focusRecords.length, linkedSessionCount: focusRecords.filter((record) => record.linkedTodoId !== null).length, independentSessionCount: focusRecords.filter((record) => record.linkedTodoId === null).length, pendingTodoCount: todos.filter((item) => !item.isCompleted).length, completedTodoCount: todos.filter((item) => item.isCompleted).length, activeDays, averageDailyDurationLabel: activeDays ? formatDuration(total / activeDays) : "0 分钟", todayFocusDurationLabel: todayRecords.length ? formatDuration(todayRecords.reduce((sum, record) => sum + record.durationMs, 0)) : "0 分钟", todaySessionCount: todayRecords.length, bestFocusDate: best?.date ?? null, bestFocusDurationLabel: best?.totalDurationLabel ?? null, dailyBreakdown: breakdown };
    };
    window.__getAppStateSyncPayload = () => ({
      timer,
      todos,
      records: focusRecords,
      analytics,
      timerPreferences,
      appPreferencesView: { ...appPreferences, customAlertSoundData: undefined, hasCustomAlertSound: Boolean(appPreferences.customAlertSoundData) },
      focusPlan,
    });

    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: windowLabel },
        currentWebview: { label: windowLabel },
      },
      transformCallback: (callback) => {
        const callbackId = nextEventCallbackId;
        nextEventCallbackId += 1;
        eventCallbacks.set(callbackId, callback);
        if (windowLabel === "main") {
          window.__trayNavigationCallback = callback;
        } else {
          window.__floatingWorkspaceEventCallback = callback;
        }
        return callbackId;
      },
      invoke: async (command, args = {}) => {
        if (initialLoadFailures > 0 && ["get_timer_snapshot", "get_timer_preferences", "get_app_preferences", "get_focus_plan", "get_todo_items", "get_focus_records", "get_analytics_snapshot"].includes(command)) {
          initialLoadFailures -= 1;
          throw new Error("模拟本地数据读取失败");
        }

        switch (command) {
          case "plugin:event|listen": {
            const listeners = eventListeners.get(args.event) ?? new Set();
            listeners.add(args.handler);
            eventListeners.set(args.event, listeners);
            if (args.event === "app-state-sync") {
              window.__appStateSyncReady = true;
            }
            if (args.event === "pending-bookmark-notice") window.__pendingBookmarkEventReady = true;
            if (args.event === "main-window-shown") window.__mainWindowShownEventReady = true;
            return args.handler;
          }
          case "plugin:event|unlisten":
            return null;
          case "plugin:event|emit": {
            if (args.event === "app-state-sync") window.__appStateSyncEmits += 1;
            emitMockEvent(args.event, args.payload);
            return null;
          }
          case "get_timer_snapshot":
            window.__timerSnapshotCalls += 1;
            return timer;
          case "get_timer_preferences":
            return timerPreferences;
          case "get_app_preferences": {
            const snapshot = { ...appPreferences };
            if (delayAppPreferences) {
              await new Promise((resolve) => { window.__releaseAppPreferencesLoad = resolve; });
            }
            if (window.__delayNextAppPreferencesRead) {
              window.__delayNextAppPreferencesRead = false;
              await new Promise((resolve) => { window.__releaseNextAppPreferencesRead = resolve; });
              window.__delayedAppPreferenceReadsCompleted += 1;
            }
            return snapshot;
          }
          case "get_focus_plan":
            return focusPlan;
          case "update_app_preferences":
            window.__appPreferenceUpdateCalls += 1;
            if (window.__failAppPreferenceSave) throw new Error("模拟外观设置保存失败");
            appPreferences = { ...appPreferences, ...args.preferences, schemaVersion: 3 };
            return appPreferences;
          case "update_focus_plan":
            focusPlan = { currentTodoId: args.currentTodoId ?? null, todayPickIds: Array.from(new Set(args.todayPickIds ?? [])).slice(0, 3) };
            return focusPlan;
          case "preview_app_backup_path":
            window.__backupPreviewCalls += 1;
            return {
              sourcePath: args.path,
              appVersion: "2.12.1",
              formatVersion: 3,
              schemaVersion: 3,
              exportedAt: `${today}T12:00:00Z`,
              focusRecordCount: focusRecords.length,
              todoCount: todos.length,
              hasRuntimeSession: Boolean(timer.hasUnsubmittedProgress),
              hasAppPreferences: true,
              hasCustomAlertSound: Boolean(appPreferences.customAlertSoundData),
              migrationNeeded: false,
              warnings: [],
            };
          case "export_app_backup_to_path":
            return { fileName: args.path.split(/[\\\\/]/).pop() || "focused-moment-backup.json", filePath: args.path, exportedAt: `${today}T12:00:00Z` };
          case "import_app_backup_path":
            window.__backupImportCalls += 1;
            return { todoCount: todos.length, focusRecordCount: focusRecords.length, restoredAppPreferences: Boolean(args.restoreAppPreferences), migrated: false, rollbackPath: "mock-rollback.json" };
          case "get_todo_items":
            window.__todoItemsCalls += 1;
            return freshTodoSnapshots ? todos.map((item) => ({ ...item })) : todos;
          case "get_pending_bookmark_notices": {
            window.__pendingBookmarkQueryCalls += 1;
            pendingBookmarkNotices = pendingBookmarkNotices.flatMap((notice) => {
              const todo = todos.find((item) => item.id === notice.todoId);
              if (!todo || todo.isCompleted) return [];
              return [{ ...notice, title: todo.title }];
            });
            return pendingBookmarkNotices.map((notice) => ({ ...notice }));
          }
          case "get_focus_records":
            window.__focusRecordCalls += 1;
            return freshRecordSnapshots ? focusRecords.map((record) => ({ ...record })) : focusRecords;
          case "update_focus_record_title":
            focusRecords = focusRecords.map((record) => record.id === args.id
              ? { ...record, title: args.title, editedAt: `${today}T12:00:00` }
              : record);
            return focusRecords;
          case "update_focus_record": {
            window.__recordUpdateCalls += 1;
            const linkedTodo = args.linkedTodoId == null ? null : todos.find((item) => item.id === Number(args.linkedTodoId));
            focusRecords = focusRecords.map((record) => record.id === args.id ? { ...record, title: args.title, durationMs: Number(args.durationMinutes) * 60 * 1000, durationLabel: formatDuration(Number(args.durationMinutes) * 60 * 1000), completedDate: args.completedDate, completedTime: args.completedTime || "", completedAt: `${args.completedDate}T${args.completedTime || "00:00"}:00`, linkedTodoId: args.linkedTodoId == null ? null : Number(args.linkedTodoId), linkedTodoTitle: linkedTodo?.title ?? null, editedAt: `${today}T12:00:00` } : record);
            recalculateAnalytics();
            return focusRecords;
          }
          case "create_manual_focus_record": {
            window.__manualRecordCalls += 1;
            const linkedTodo = args.linkedTodoId == null ? null : todos.find((item) => item.id === Number(args.linkedTodoId));
            const durationMs = Number(args.durationMinutes) * 60 * 1000;
            focusRecords = [...focusRecords, { id: 9000 + focusRecords.length, title: args.title, durationMs, durationLabel: formatDuration(durationMs), modeKey: "stopwatch", modeLabel: "手动补录", phaseLabel: "手动补录", linkedTodoId: args.linkedTodoId == null ? null : Number(args.linkedTodoId), linkedTodoTitle: linkedTodo?.title ?? null, completedAt: `${args.completedDate}T${args.completedTime || "00:00"}:00`, completedDate: args.completedDate, completedTime: args.completedTime || "", source: "manual", timeBasis: "completion_day", editedAt: null }];
            recalculateAnalytics();
            return focusRecords;
          }
          case "get_analytics_snapshot":
            return analytics;
          case "update_todo_item":
            todos = todos.map((item) => item.id === args.id
              ? {
                  ...item,
                  title: args.title,
                  scheduledDate: args.scheduledDate,
                  scheduledTime: args.scheduledTime,
                  importanceKey: args.importanceKey,
                }
              : item);
            return todos;
          case "create_todo_item": {
            if ((args.scheduledDate ?? "") === "") {
              window.__quickCaptureCalls += 1;
            }
            const nextId = Math.max(0, ...todos.map((item) => item.id)) + 1;
            todos = [...todos, { id: nextId, title: args.title, isCompleted: false, scheduledDate: args.scheduledDate ?? "", scheduledTime: args.scheduledTime ?? "", importanceKey: args.importanceKey ?? "medium", continuationNote: "", continuationUpdatedAt: null }];
            recalculateAnalytics();
            return todos;
          }
          case "update_todo_continuation_note":
            window.__continuationNoteCalls += 1;
            todos = todos.map((item) => item.id === args.id ? { ...item, continuationNote: args.note, continuationUpdatedAt: args.note ? `${today}T12:00:00` : null } : item);
            return todos;
          case "save_continuation_bookmark":
            window.__bookmarkSaveCalls += 1;
            if (window.__failBookmarkSave) {
              window.__failBookmarkSave = false;
              throw new Error("模拟停笔书签保存失败");
            }
            todos = todos.map((item) => item.id === args.todoId ? { ...item, continuationNote: args.note, continuationUpdatedAt: args.note ? `${today}T12:00:00` : null } : item);
            pendingBookmarkNotices = pendingBookmarkNotices.filter((notice) => notice.recordId !== args.recordId);
            return todos;
          case "acknowledge_pending_bookmark_notice":
            window.__bookmarkAcknowledgementCalls += 1;
            pendingBookmarkNotices = pendingBookmarkNotices.filter((notice) => notice.recordId !== args.recordId);
            return null;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id
              ? { ...item, isCompleted: !item.isCompleted }
              : item);
            recalculateAnalytics();
            return todos;
          case "list_app_backups":
            return [];
          case "clear_app_data":
            window.__clearAppDataCalls += 1;
            todos = [];
            focusRecords = [];
            focusPlan = { currentTodoId: null, todayPickIds: [] };
            timer = {
              ...timer,
              status: "待开始",
              isRunning: false,
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              hasUnsubmittedProgress: false,
              remainingMs: timer.modeKey === "countdown" ? timer.targetDurationMs : null,
              activeTaskTitle: "",
              linkedTodoId: null,
              completeLinkedTodoOnFinish: false,
              recoveredFromLastSession: false,
              alertKey: null,
              alertTitle: null,
              alertMessage: null,
            };
            recalculateAnalytics();
            return timer;
          case "complete_focus_session": {
            window.__completedFocusCalls += 1;
            const durationMs = timer.elapsedMs || 0;
            const totalSeconds = Math.round(durationMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const durationLabel = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
            if (timer.completeLinkedTodoOnFinish && timer.linkedTodoId !== null) {
              todos = todos.map((item) => item.id === timer.linkedTodoId ? { ...item, isCompleted: true } : item);
            }
            const recordId = 1000 + focusRecords.length;
            const linkedTodo = timer.linkedTodoId === null ? null : todos.find((item) => item.id === timer.linkedTodoId) ?? null;
            focusRecords = [...focusRecords, {
              id: recordId,
              title: args.title,
              durationMs,
              durationLabel,
              modeKey: timer.modeKey,
              modeLabel: timer.mode,
              phaseLabel: timer.phaseLabel,
              linkedTodoId: timer.linkedTodoId,
              linkedTodoTitle: linkedTodo?.title ?? null,
              completedAt: `${today}T12:00:00`,
              completedDate: today,
              completedTime: "12:00",
              source: "timer",
              timeBasis: "completion_day",
              editedAt: null,
            }];
            if (linkedTodo && !linkedTodo.isCompleted && !pendingBookmarkNotices.some((notice) => notice.recordId === recordId)) {
              pendingBookmarkNotices.push({ recordId, todoId: linkedTodo.id, title: linkedTodo.title });
              emitMockEvent("pending-bookmark-notice");
            }
            recalculateAnalytics();
            timer = {
              ...timer,
              sessionId: `mock-session-complete-${window.__completedFocusCalls}`,
              status: "未开始",
              isRunning: false,
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              hasUnsubmittedProgress: false,
              remainingMs: timer.modeKey === "countdown" ? timer.targetDurationMs : null,
              activeTaskTitle: "",
              linkedTodoId: null,
              completeLinkedTodoOnFinish: false,
              alertKey: null,
              alertTitle: null,
              alertMessage: null,
              recoveredFromLastSession: false,
            };
            return { timerSnapshot: timer, records: focusRecords, todoItems: todos };
          }
          case "start_timer":
            window.__startTimerCalls += 1;
            timer = { ...timer, sessionId: timer.hasUnsubmittedProgress ? timer.sessionId : `mock-session-start-${window.__startTimerCalls}`, isRunning: true, elapsedMs: timer.elapsedMs || 60_000, elapsedLabel: timer.elapsedMs ? timer.elapsedLabel : "00:01:00", hasUnsubmittedProgress: true, status: "正向计时中" };
            return timer;
          case "show_focus_floating":
            window.__focusFloatingShown = true;
            return null;
          case "show_floating_todos":
            window.__floatingTodosShown = true;
            window.__miniWorkspaceShown = true;
            return null;
          case "restore_main_from_floating_todos":
          case "restore_main_from_focus_floating":
            window.__mainRestoreCalls += 1;
            if (window.__failNextMainRestore) {
              window.__failNextMainRestore = false;
              throw new Error("模拟主窗口恢复失败");
            }
            window.__mainRestored = true;
            emitMockEvent("main-window-shown");
            return null;
          case "unlock_focus_floating":
            window.__focusFloatingUnlocked = true;
            return null;
          case "start_dragging_main_window":
            window.__mainWindowDragged = true;
            return null;
          case "minimize_main_window":
            window.__minimizeMainWindowCalls += 1;
            return null;
          case "toggle_maximize_main_window":
            window.__toggleMaximizeMainWindowCalls += 1;
            return false;
          case "close_main_window":
            window.__closeMainWindowCalls += 1;
            return null;
          case "flash_main_window_attention":
            window.__flashMainWindowAttention = true;
            return null;
          case "update_timer_preferences":
            timerPreferences = args.preferences;
            return timerPreferences;
          case "pause_timer":
            window.__pauseTimerCalls += 1;
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "reset_timer":
            window.__resetTimerCalls += 1;
            window.__resetTimerArgs.push({ ...args });
            if (args.sessionId !== timer.sessionId) {
              throw new Error("本轮已在其他窗口发生变化，请检查当前状态后重新操作。");
            }
            if (window.__holdNextResetTimer) {
              window.__holdNextResetTimer = false;
              await new Promise((resolve) => { window.__releaseResetTimer = resolve; });
            }
            if (window.__failResetTimer) {
              window.__failResetTimer = false;
              throw new Error("模拟重置写入失败");
            }
            timer = {
              ...timer,
              sessionId: `mock-session-reset-${window.__resetTimerCalls}`,
              status: "待开始",
              isRunning: false,
              elapsedMs: 0,
              elapsedLabel: "00:00:00",
              hasUnsubmittedProgress: false,
              remainingMs: timer.modeKey === "countdown" ? timer.targetDurationMs : null,
              activeTaskTitle: "",
              linkedTodoId: null,
              completeLinkedTodoOnFinish: false,
              recoveredFromLastSession: false,
              alertKey: null,
              alertTitle: null,
              alertMessage: null,
            };
            window.__resetTimerSuccessCalls += 1;
            return timer;
          case "update_timer_context":
            timer = { ...timer, activeTaskTitle: args.title, linkedTodoId: args.linkedTodoId ?? null, completeLinkedTodoOnFinish: Boolean(args.completeLinkedTodoOnFinish) };
            return timer;
          case "switch_timer_mode":
            timer = {
              ...timer,
              sessionId: `mock-session-mode-${Date.now()}`,
              modeKey: args.mode,
              mode: args.mode === "countdown" ? "倒计时" : "正向计时",
              phaseKey: args.mode,
              phaseLabel: args.mode === "countdown" ? "倒计时" : "正向计时",
              targetDurationMs: args.mode === "countdown" ? 25 * 60 * 1000 : null,
              remainingMs: args.mode === "countdown" ? 25 * 60 * 1000 : null,
            };
            return timer;
          case "set_countdown_minutes":
            timer = {
              ...timer,
              sessionId: `mock-session-countdown-${Date.now()}`,
              targetDurationMs: Number(args.minutes) * 60 * 1000,
              remainingMs: Number(args.minutes) * 60 * 1000,
            };
            return timer;
          default:
            return null;
        }
      },
    };
  }, { today: localDate(), includeOverdue, includeRecords, windowLabel, pausedFocus, runningFocus, completedCountdown, initialLoadError, autoMiniOnStart, delayAppPreferences, todayRecordCount, todayTodoCount, futureTodoCount, completedTodoCount, historyDayCount, freshTodoSnapshots, freshRecordSnapshots, initialPendingBookmarkNotices });

  await page.goto("/");
  if (windowLabel === "main") {
    await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  } else if (windowLabel === "todo-unlock" || windowLabel === "focus-unlock") {
    await expect(page.getByRole("button", { name: /解除.*锁定/ })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
  }
}
