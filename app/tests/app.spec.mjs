import { expect, test } from "@playwright/test";

import { testOutputPath } from "./helpers/test-output.mjs";

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function bootWithTauriMock(page, { includeOverdue = false, includeRecords = false, windowLabel = "main", pausedFocus = false, completedCountdown = false, initialLoadError = false, autoMiniOnStart = false, todayRecordCount = includeRecords ? 1 : 0, todayTodoCount = 1, futureTodoCount = 0, completedTodoCount = 0, historyDayCount = 0, freshTodoSnapshots = false, freshRecordSnapshots = false, firstTodoId = 1 } = {}) {
  await page.addInitScript(({ today, includeOverdue, includeRecords, windowLabel, pausedFocus, completedCountdown, initialLoadError, autoMiniOnStart, todayRecordCount, todayTodoCount, futureTodoCount, completedTodoCount, historyDayCount, freshTodoSnapshots, freshRecordSnapshots, firstTodoId }) => {
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterdayDate = dateKey(yesterday);
    const overdueDate = yesterdayDate;
    let todos = [
      {
        id: firstTodoId,
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
    window.__resetTimerCalls = 0;
    window.__startTimerCalls = 0;
    window.__miniWorkspaceShown = false;
    window.__quickCaptureCalls = 0;
    window.__continuationNoteCalls = 0;
    window.__manualRecordCalls = 0;
    window.__recordUpdateCalls = 0;
    window.__backupPreviewCalls = 0;
    window.__backupImportCalls = 0;
    window.__dialogOpenResult = "C:\\Users\\test\\focused-moment-backup.json";
    window.__dialogSaveResult = "C:\\Users\\test\\focused-moment-export.json";
    window.__dialogOpenCalls = 0;
    window.__dialogSaveCalls = 0;
    window.__backupPreviewSourcePath = null;
    window.__backupExportPaths = [];
    window.__lastBackupImportOptions = null;
    window.__appPreferenceUpdateCalls = 0;
    window.__failAppPreferenceSave = false;
    window.__appPreferenceSavePlan = [];
    window.__appPreferenceWrites = [];
    window.__failContinuationSave = false;
    window.__lastEmittedState = null;
    window.__emittedStates = [];
    window.__continuationRequests = [];
    window.__failContinuationEvent = false;
    window.__restoredMainCalls = 0;
    window.__continuationRequestReady = false;
    window.__exitRequestReady = false;
    window.__quitApplicationCalls = 0;
    window.__failFocusPlanSave = false;
    window.__appPreferenceReadCalls = 0;
    window.__mockAppPreferences = null;
    let initialLoadFailures = initialLoadError ? 1 : 0;
    const eventCallbacks = new Map();
    const eventListeners = new Map();
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
    window.__mockToday = today;
    const cleanFocusPlan = () => {
      const pendingIds = new Set(todos.filter((item) => !item.isCompleted).map((item) => item.id));
      focusPlan = {
        currentTodoId: pendingIds.has(focusPlan.currentTodoId) ? focusPlan.currentTodoId : null,
        todayPickIds: focusPlan.todayPickIds.filter((id) => pendingIds.has(id) && todos.some((item) => item.id === id && (item.scheduledDate === window.__mockToday || item.scheduledDate === ""))),
      };
    };
    todos = todos.map((item) => ({ ...item, continuationNote: item.continuationNote ?? "", continuationUpdatedAt: item.continuationUpdatedAt ?? null }));
    focusRecords = focusRecords.map((record) => ({ ...record, source: record.source ?? "timer", timeBasis: record.timeBasis ?? "completion_day", editedAt: record.editedAt ?? null }));
    let timer = {
      modeKey: completedCountdown ? "countdown" : "stopwatch",
      phaseKey: completedCountdown ? "countdown" : "stopwatch",
      mode: completedCountdown ? "倒计时" : "正向计时",
      phaseLabel: completedCountdown ? "倒计时" : "正向计时",
      status: completedCountdown ? "已结束" : "待开始",
      isRunning: false,
      elapsedMs: completedCountdown ? 60 * 60 * 1000 : pausedFocus ? 30_000 : 0,
      elapsedLabel: completedCountdown ? "00:00:00" : pausedFocus ? "00:00:30" : "00:00:00",
      targetDurationMs: completedCountdown ? 60 * 60 * 1000 : 25 * 60 * 1000,
      remainingMs: completedCountdown ? 0 : null,
      secondaryLabel: completedCountdown ? "本轮剩余时间" : "已累计时长",
      canCompleteSession: true,
      hasUnsubmittedProgress: completedCountdown || pausedFocus,
      activeTaskTitle: pausedFocus ? "写完产品复盘" : "",
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
      focusRecords.sort((left, right) => right.completedDate.localeCompare(left.completedDate) || right.completedTime.localeCompare(left.completedTime) || right.id - left.id);
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
      const todayRecords = focusRecords.filter((record) => record.completedDate === window.__mockToday);
      const activeDays = breakdown.filter((day) => day.totalDurationMs > 0).length;
      const best = breakdown.reduce((current, day) => !current || day.totalDurationMs > current.totalDurationMs ? day : current, null);
      analytics = { ...analytics, totalFocusDurationMs: total, totalFocusDurationLabel: total ? formatDuration(total) : "0 分钟", sessionCount: focusRecords.length, linkedSessionCount: focusRecords.filter((record) => record.linkedTodoId !== null).length, independentSessionCount: focusRecords.filter((record) => record.linkedTodoId === null).length, pendingTodoCount: todos.filter((item) => !item.isCompleted).length, completedTodoCount: todos.filter((item) => item.isCompleted).length, activeDays, averageDailyDurationLabel: activeDays ? formatDuration(total / activeDays) : "0 分钟", todayFocusDurationLabel: todayRecords.length ? formatDuration(todayRecords.reduce((sum, record) => sum + record.durationMs, 0)) : "0 分钟", todaySessionCount: todayRecords.length, bestFocusDate: best?.date ?? null, bestFocusDurationLabel: best?.totalDurationLabel ?? null, dailyBreakdown: breakdown };
      const days = new Set(breakdown.filter((day) => day.totalDurationMs > 0).map((day) => day.date));
      const cursor = new Date(`${window.__mockToday}T00:00:00`);
      if (!days.has(window.__mockToday)) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (days.has(dateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      analytics.currentStreakDays = streak;
    };
    recalculateAnalytics();
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
            if (args.event === "focus-continuation-request") window.__continuationRequestReady = true;
            if (args.event === "app-exit-request") window.__exitRequestReady = true;
            return args.handler;
          }
          case "plugin:event|unlisten":
            return null;
          case "plugin:event|emit": {
            if (args.event === "focus-continuation-request") {
              if (window.__failContinuationEvent) throw new Error("模拟跨窗口请求失败");
              window.__continuationRequests.push(structuredClone(args.payload));
              // Tests may bridge the event to another real browser page.
              if (window.__forwardContinuationRequest) await window.__forwardContinuationRequest(args.payload);
            }
            if (args.event === "app-state-sync") {
              window.__lastEmittedState = structuredClone(args.payload);
              window.__emittedStates.push(structuredClone(args.payload));
            }
            for (const callbackId of eventListeners.get(args.event) ?? []) {
              eventCallbacks.get(callbackId)?.({
                event: args.event,
                id: callbackId,
                payload: args.payload,
              });
            }
            return null;
          }
          case "get_timer_snapshot":
            window.__timerSnapshotCalls += 1;
            return timer;
          case "get_timer_preferences":
            return timerPreferences;
          case "get_app_preferences":
            window.__appPreferenceReadCalls += 1;
            return appPreferences;
          case "get_focus_plan":
            cleanFocusPlan();
            return structuredClone(focusPlan);
          case "update_app_preferences":
            window.__appPreferenceUpdateCalls += 1;
            window.__appPreferenceWrites.push(structuredClone(args.preferences));
            {
              const plan = window.__appPreferenceSavePlan.shift() ?? {};
              if (plan.hold) await new Promise((resolve) => { window.__releasePreferenceSave = resolve; });
              if (plan.delay) await new Promise((resolve) => setTimeout(resolve, plan.delay));
              if (plan.fail || window.__failAppPreferenceSave) throw new Error("模拟外观设置保存失败");
            }
            appPreferences = { ...appPreferences, ...args.preferences, schemaVersion: 3 };
            window.__mockAppPreferences = appPreferences;
            return appPreferences;
          case "update_focus_plan":
            if (window.__failFocusPlanSave) throw new Error("模拟焦点计划保存失败");
            focusPlan = { currentTodoId: args.currentTodoId ?? null, todayPickIds: Array.from(new Set(args.todayPickIds ?? [])).slice(0, 3) };
            return focusPlan;
          case "plugin:dialog|open":
            window.__dialogOpenCalls += 1;
            return window.__dialogOpenResult;
          case "plugin:dialog|save":
            window.__dialogSaveCalls += 1;
            return window.__dialogSaveResult;
          case "preview_app_backup_path":
            window.__backupPreviewCalls += 1;
            return {
              sourcePath: window.__backupPreviewSourcePath ?? args.path,
              appVersion: "2.12.0",
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
            window.__backupExportPaths.push(args.path);
            return { fileName: args.path.split(/[\\\\/]/).pop() || "focused-moment-backup.json", filePath: args.path, exportedAt: `${today}T12:00:00Z` };
          case "import_app_backup_path":
            window.__backupImportCalls += 1;
            window.__lastBackupImportOptions = {
              restoreTodos: Boolean(args.restoreTodos),
              restoreRecords: Boolean(args.restoreRecords),
              restoreAppPreferences: Boolean(args.restoreAppPreferences),
            };
            return { importedFileName: "focused-moment-backup.json", rollbackFileName: "mock-rollback.json", todoCount: todos.length, focusRecordCount: focusRecords.length, restoredAppPreferences: Boolean(args.restoreAppPreferences), restoredRuntimeSession: Boolean(args.restoreTodos && args.restoreRecords), migratedFromFormatVersion: null };
          case "get_todo_items":
            window.__todoItemsCalls += 1;
            return freshTodoSnapshots ? todos.map((item) => ({ ...item })) : todos;
          case "get_focus_records":
            window.__focusRecordCalls += 1;
            return freshRecordSnapshots ? focusRecords.map((record) => ({ ...record })) : focusRecords;
          case "delete_focus_record":
            focusRecords = focusRecords.filter((record) => record.id !== args.id);
            recalculateAnalytics();
            return focusRecords;
          case "restore_focus_record":
            if (focusRecords.some((record) => record.id === args.record.id)) throw new Error("记录已存在");
            focusRecords = [...focusRecords, structuredClone(args.record)];
            recalculateAnalytics();
            return focusRecords;
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
            recalculateAnalytics();
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
            if (window.__failContinuationSave) throw new Error("模拟书签写入失败");
            todos = todos.map((item) => item.id === args.id ? { ...item, continuationNote: args.note, continuationUpdatedAt: args.note ? `${today}T12:00:00` : null } : item);
            return todos;
          case "toggle_todo_item":
            todos = todos.map((item) => item.id === args.id
              ? { ...item, isCompleted: !item.isCompleted }
              : item);
            cleanFocusPlan();
            recalculateAnalytics();
            return todos;
          case "delete_todo_item":
            todos = todos.filter((item) => item.id !== args.id);
            focusRecords = focusRecords.map((record) => record.linkedTodoId === args.id ? { ...record, linkedTodoId: null, editedAt: `${today}T12:00:00` } : record);
            if (timer.linkedTodoId === args.id) timer = { ...timer, linkedTodoId: null };
            cleanFocusPlan();
            recalculateAnalytics();
            return todos;
          case "restore_todo_item":
            if (todos.some((item) => item.id === args.item.id)) throw new Error("待办已存在");
            todos = [...todos, structuredClone(args.item)];
            recalculateAnalytics();
            return todos;
          case "list_app_backups":
            return [];
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
              cleanFocusPlan();
            }
            focusRecords = [...focusRecords, {
              id: 1000 + focusRecords.length,
              title: args.title,
              durationMs,
              durationLabel,
              modeKey: timer.modeKey,
              modeLabel: timer.mode,
              phaseLabel: timer.phaseLabel,
              linkedTodoId: timer.linkedTodoId,
              linkedTodoTitle: timer.linkedTodoId === null ? null : todos.find((item) => item.id === timer.linkedTodoId)?.title ?? null,
              completedAt: `${today}T12:00:00`,
              completedDate: today,
              completedTime: "12:00",
              source: "timer",
              timeBasis: "completion_day",
              editedAt: null,
            }];
            recalculateAnalytics();
            timer = {
              ...timer,
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
            timer = { ...timer, isRunning: true, elapsedMs: timer.elapsedMs || 60_000, elapsedLabel: timer.elapsedMs ? timer.elapsedLabel : "00:01:00", hasUnsubmittedProgress: true, status: "正向计时中" };
            return timer;
          case "show_focus_floating":
            window.__focusFloatingShown = true;
            return null;
          case "restore_main_from_floating_todos":
          case "show_main_window_from_tray":
          case "restore_main_from_focus_floating":
            window.__restoredMainCalls += 1;
            return null;
          case "show_floating_todos":
            window.__floatingTodosShown = true;
            window.__miniWorkspaceShown = true;
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
          case "quit_application":
            window.__quitApplicationCalls += 1;
            return null;
          case "flash_main_window_attention":
            window.__flashMainWindowAttention = true;
            return null;
          case "update_timer_preferences":
            timerPreferences = args.preferences;
            return timerPreferences;
          case "pause_timer":
            timer = { ...timer, isRunning: false, status: "已暂停" };
            return timer;
          case "reset_timer":
            window.__resetTimerCalls += 1;
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
            return timer;
          case "update_timer_context":
            timer = { ...timer, activeTaskTitle: args.title, linkedTodoId: args.linkedTodoId ?? null, completeLinkedTodoOnFinish: Boolean(args.completeLinkedTodoOnFinish) };
            return timer;
          case "switch_timer_mode":
            timer = {
              ...timer,
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
              targetDurationMs: Number(args.minutes) * 60 * 1000,
              remainingMs: Number(args.minutes) * 60 * 1000,
            };
            return timer;
          default:
            return null;
        }
      },
    };
  }, { today: localDate(), includeOverdue, includeRecords, windowLabel, pausedFocus, completedCountdown, initialLoadError, autoMiniOnStart, todayRecordCount, todayTodoCount, futureTodoCount, completedTodoCount, historyDayCount, freshTodoSnapshots, freshRecordSnapshots, firstTodoId });

  await page.goto("/");
  if (windowLabel === "main") {
    await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  } else if (windowLabel === "todo-unlock" || windowLabel === "focus-unlock") {
    await expect(page.getByRole("button", { name: /解除.*锁定/ })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
  }
}

test("Today cockpit exposes the overview and command palette", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect(page.getByText("写完产品复盘").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByText("当前事项", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("今日精选", { exact: true })).toBeVisible();
  await expect(page.getByText("今日投入", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看计时", exact: true })).toHaveCount(0);
  await expect(page.locator(".trail-node")).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("记录");
  await expect(page.getByRole("option", { name: "打开记录" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeHidden();
  await expect(page.getByRole("button", { name: "今日", exact: true })).toBeFocused();
});

test("command palette keeps keyboard focus inside the dialog and executes the active option", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "你想做什么？" });
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  const close = page.getByRole("button", { name: "关闭命令面板" });

  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-today");
  await page.keyboard.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-focus");
  await expect(page.getByRole("option", { name: "打开完整计时" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toHaveClass(/active/);

  await page.keyboard.press("Control+K");
  await expect(search).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await search.fill("没有这个命令");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await close.focus();
  await page.keyboard.press("Space");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeFocused();

  await page.keyboard.press("Control+K");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeFocused();
});

test("command palette searches task and record history and focuses records by task", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, todayRecordCount: 1 });

  await page.keyboard.press("Control+K");
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  await search.fill("产品复盘");

  const taskResult = page.getByRole("option").filter({ hasText: "任务：写完产品复盘" });
  const recordResult = page.getByRole("option").filter({ hasText: "记录：完成产品复盘" });
  await expect(taskResult).toBeVisible();
  await expect(recordResult).toBeVisible();

  await taskResult.click();
  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();
  await expect(page.locator(".records-task-filter")).toContainText("写完产品复盘");
  await expect(page.getByText("完成产品复盘", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "清除任务筛选" }).click();
  await expect(page.locator(".records-task-filter")).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await search.fill(localDate());
  const dateResult = page.getByRole("option").filter({ hasText: `日期：${localDate()}` });
  await expect(dateResult).toBeVisible();
  await dateResult.click();
  await expect(page.locator(".app-message")).toContainText("已定位到日期归档");
});

test("command palette can open the floating workspace", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill("迷你工作台");
  await expect(page.getByRole("option", { name: "打开迷你工作台" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect.poll(() => page.evaluate(() => window.__floatingTodosShown)).toBe(true);
});

test("native tray navigation event switches the main window view", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect.poll(() => page.evaluate(() => Boolean(window.__trayNavigationCallback))).toBe(true);
  await page.evaluate(() => window.__trayNavigationCallback({ payload: "records" }));
  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();

  await page.evaluate(() => window.__trayNavigationCallback({ payload: "todos" }));
  await expect(page.getByRole("button", { name: /^待办/ })).toHaveClass(/active/);
});

test("initial data errors stay visible and recover through the retry action", async ({ page }) => {
  await bootWithTauriMock(page, { initialLoadError: true });

  const loadError = page.getByRole("alert");
  await expect(loadError).toContainText("暂时无法读取本地数据");
  await expect(loadError).toContainText("模拟本地数据读取失败");
  const retry = loadError.getByRole("button", { name: "重试读取" });
  await expect(retry).toBeVisible();
  await retry.click();

  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await expect(loadError).toBeHidden();
  await expect(page.getByText("当前事项", { exact: true }).first()).toBeVisible();
});

test("Today overview keeps timing work in the focus page", async ({ page }) => {
  await bootWithTauriMock(page);

  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.locator(".trail-timer")).toHaveCount(0);
  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.getByText("专注计时", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "计时", exact: true })).toBeVisible();
});

test("Today trail expands into a scrollable route beyond five segments", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, todayRecordCount: 7, todayTodoCount: 6 });

  await expect(page.locator(".trail-node")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByText("今日投入", { exact: true })).toBeVisible();
});

test("Today trail does not invent tasks when there are no todos", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 0 });

  await expect(page.locator(".trail-node")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
  await expect(page.getByText("选择一件事开始", { exact: true })).toBeVisible();
  await expect(page.getByText("本段任务", { exact: true })).toHaveCount(0);
  await expect(page.getByText("整理今天的会议笔记", { exact: true })).toHaveCount(0);
  await expect(page.getByText("OPEN SLOT", { exact: true })).toHaveCount(0);
});

test("main window keeps its top bar available while scrolling and exposes a drag surface", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await expect(page.locator(".app-bar")).toHaveCSS("position", "sticky");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(".app-bar")).toBeVisible();

  await page.locator(".app-bar").click({ position: { x: 220, y: 24 } });
  await expect.poll(() => page.evaluate(() => window.__mainWindowDragged)).toBe(true);
});

test("records and settings pages keep all three native window controls clickable", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "设置", exact: true }).click();
  const settingsControls = page.locator(".window-control");
  await expect(settingsControls).toHaveCount(3);
  const settingsHitTargets = await settingsControls.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || hit?.closest(".window-control") === button;
  }));
  expect(settingsHitTargets).toEqual([true, true, true]);

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const controls = page.locator(".window-control");
  await expect(controls).toHaveCount(3);

  const hitTargets = await controls.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || hit?.closest(".window-control") === button;
  }));
  expect(hitTargets).toEqual([true, true, true]);

  await controls.nth(0).click();
  await controls.nth(1).click();
  await controls.nth(2).click();

  await expect.poll(() => page.evaluate(() => ({
    minimize: window.__minimizeMainWindowCalls,
    maximize: window.__toggleMaximizeMainWindowCalls,
    close: window.__closeMainWindowCalls,
    dragged: window.__mainWindowDragged,
  }))).toEqual({ minimize: 1, maximize: 1, close: 1, dragged: false });
});

test("countdown duration keeps the user value while timer snapshots refresh", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();

  const durationInput = page.locator('input[name="countdownMinutes"]');
  await durationInput.fill("60");
  await page.waitForTimeout(1200);

  await expect(durationInput).toHaveValue("60");
  await expect(page.locator(".timer-readout strong")).toHaveText("01:00:00");
});

test("starting a countdown stays in the current page by default", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "倒计时" }).click();
  await page.locator('input[name="countdownMinutes"]').fill("60");
  await page.locator('input[name="sessionTitle"]').fill("完成季度复盘");
  await page.getByRole("button", { name: "开始", exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__miniWorkspaceShown)).toBe(false);
  await expect(page.getByRole("heading", { name: "专注计时", exact: true })).toBeVisible();
});

test("auto mini preference opens the mini workspace only after a real start", async ({ page }) => {
  await bootWithTauriMock(page, { autoMiniOnStart: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.locator('input[name="sessionTitle"]').fill("自动打开工作台测试");
  await page.getByRole("button", { name: "开始", exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__miniWorkspaceShown)).toBe(true);
});

test("floating workspace switches between todos and the active timer", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const todoTab = page.locator(".floating-tab").filter({ hasText: "待办" });
  const timerTab = page.locator(".floating-tab").filter({ hasText: "当前计时" });
  await expect(todoTab).toBeVisible();
  await expect(timerTab).toBeVisible();
  await expect(timerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".floating-timer")).toContainText("00:00:30");
  const workspaceHeight = await page.locator(".floating-todo").evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(workspaceHeight).toBeLessThan(420);
  const controlHeights = await page.locator(".floating-timer .focus-floating__controls button").evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().height))
  );
  expect(Math.max(...controlHeights)).toBeLessThan(60);

  await todoTab.click();
  await expect(todoTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".floating-todo__item")).toContainText("写完产品复盘");

  await timerTab.click();
  await expect(page.locator(".floating-timer")).toContainText("写完产品复盘");
});

test("floating workspace can adjust and remember its opacity", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const opacityButton = page.getByRole("button", { name: "调整悬浮窗透明度" });
  await opacityButton.click();
  await expect(page.getByRole("dialog", { name: "悬浮窗透明度" })).toBeVisible();

  const slider = page.getByRole("slider", { name: "悬浮窗透明度" });
  await slider.fill("62");
  await expect(slider).toHaveValue("62");
  await expect(page.locator(".floating-todo")).toHaveCSS("opacity", "0.62");
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_app_preferences"))).toMatchObject({ floatingOpacity: 62 });
});

test("floating timer receives main-window state sync without polling", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });

  const initialCalls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__appStateSyncReady)).toBe(true);
  await page.evaluate(() => {
    window.__replaceTimer({
      elapsedMs: 42_000,
      elapsedLabel: "00:00:42",
      status: "已暂停",
    });
    return window.__TAURI_INTERNALS__.invoke("plugin:event|emit", {
      event: "app-state-sync",
      payload: window.__getAppStateSyncPayload(),
    });
  });
  await expect(page.getByText("00:00:42", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBe(initialCalls);
});

test("floating workspace only shows todos when there is no active timer", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float" });

  await expect(page.locator(".floating-tab")).toHaveCount(1);
  await expect(page.locator(".floating-tab").first()).toContainText("待办");
  await expect(page.locator(".floating-tab").filter({ hasText: "当前计时" })).toBeHidden();
});

test("completed countdown clearly offers to save the focus record", async ({ page }) => {
  await bootWithTauriMock(page, { completedCountdown: true });

  await expect(page.getByRole("alert")).toContainText("倒计时已结束");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已累计专注 60 分钟");
  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("已累计专注 60 分钟");
  await expect(page.getByRole("button", { name: "保存并记录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "稍后处理" })).toBeVisible();
});

test("reminder settings expose popup, taskbar and a palette of sound controls", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();

  await expect(page.getByRole("heading", { name: "结束提醒" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /应用内弹窗/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /任务栏闪烁/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /声音提醒/ })).toBeChecked();
  await expect(page.locator(".nv-sound-option")).toHaveCount(6);
  await expect(page.locator(".nv-sound-option.is-selected")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /老牧师原声/ })).toHaveCount(0);

  await page.getByRole("checkbox", { name: /任务栏闪烁/ }).uncheck();
  await expect.poll(() => page.evaluate(() => window.__TAURI_INTERNALS__.invoke("get_timer_preferences"))).toMatchObject({
    windowAttentionReminderEnabled: false,
  });
});

test("records page turns a long history into a selectable archive trail", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.getByRole("heading", { name: "专注记录" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把时间连成一条路" })).toBeVisible();
  await expect(page.locator(".records-archive__summary")).toContainText("01:30:00");
  await expect(page.locator(".records-archive__timeline-footer")).toContainText("2 天有投入");
  await expect(page.locator(".records-archive__detail")).toContainText("1 段专注");
  await expect(page.locator(".records-archive__detail .records-hero__dial")).toContainText("1");
  await expect(page.locator(".records-archive__stats .records-stats__progress")).toContainText("0%");
  await expect(page.locator(".record-history__heading")).toContainText("3 轮");

  const archiveNodes = page.locator(".records-archive__node");
  await expect(archiveNodes).toHaveCount(7);
  await archiveNodes.nth(5).click();
  await expect(page.locator(".records-archive__detail")).toContainText("昨天");
  await expect(page.locator(".records-archive__detail")).toContainText("2 段专注");

  const recordDays = page.locator(".record-day");
  await expect(recordDays).toHaveCount(2);
  await expect(recordDays.first()).toHaveAttribute("open", "");
  await expect(recordDays.nth(1)).toHaveAttribute("open", "");
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeVisible();

  await recordDays.nth(1).locator("summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();

  await recordDays.nth(1).locator("summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
});

test("records page keeps a long archive inside a bounded history viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootWithTauriMock(page, { includeRecords: true, historyDayCount: 28 });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const recordDays = page.locator(".record-day");
  await expect(recordDays).toHaveCount(30);

  const historyViewport = await page.locator(".record-list").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(historyViewport.scrollHeight).toBeGreaterThan(historyViewport.clientHeight);
  expect(historyViewport.clientHeight).toBeLessThanOrEqual(520);
  expect(historyViewport.scrollWidth).toBeLessThanOrEqual(historyViewport.clientWidth);

  const historyList = page.locator(".record-list");
  await historyList.scrollIntoViewIfNeeded();
  await historyList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await recordDays.last().locator("summary").scrollIntoViewIfNeeded();
  await expect(recordDays.last().locator(".record-row").first()).toBeVisible();
  await recordDays.last().locator("summary").evaluate((element) => element.click());
  await expect(recordDays.last().locator(".record-row").first()).toBeHidden();
  await recordDays.last().locator("summary").evaluate((element) => element.click());
  await expect(recordDays.last().locator(".record-row")).toBeVisible();
  await expect(recordDays.last()).toContainText("历史归档 28");
});

test("record day keeps its collapsed state during background refresh", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, freshRecordSnapshots: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const recordDays = page.locator(".record-day");
  await recordDays.nth(1).locator("summary").click();
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();

  const callsBeforeRefresh = await page.evaluate(() => window.__focusRecordCalls);
  await expect.poll(() => page.evaluate(() => window.__focusRecordCalls), { timeout: 3000 })
    .toBeGreaterThan(callsBeforeRefresh);
  await expect(recordDays.nth(1).locator(".record-row").first()).toBeHidden();
  await expect(recordDays.nth(1)).not.toHaveAttribute("open", "");
});

test("records page aligns route points and explains focus hours", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.locator(".nv-records-distribution__heading h2")).toHaveText("你通常在什么时候进入状态？");
  await expect(page.locator(".nv-records-distribution")).toContainText("上午");
  await expect(page.locator(".nv-records-distribution")).toContainText("晚间");
  await expect(page.locator(".nv-records-distribution")).toContainText("45 分钟");
  await expect(page.locator(".nv-records-distribution")).not.toContainText("节点高度按当天真实投入时长变化");

  const distributionHeights = await page.locator(".nv-records-distribution__track > span").evaluateAll((bars) => bars.map((bar) => bar.style.height));
  expect(distributionHeights).toEqual(["0%", "100%", "0%", "100%"]);

  const chartGeometry = await page.locator(".records-archive__map").evaluate((map) => {
    const mapRect = map.getBoundingClientRect();
    const svg = map.querySelector("svg");
    const path = map.querySelector(".records-archive__route-line");
    if (!svg || !path) throw new Error("archive chart is incomplete");

    const svgRect = svg.getBoundingClientRect();
    const nodes = Array.from(map.querySelectorAll(".records-archive__node"));
    const nodePoints = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2 - mapRect.left) / mapRect.width) * 100,
        y: ((rect.top + rect.height / 2 - mapRect.top) / mapRect.height) * 100,
      };
    });
    const totalLength = path.getTotalLength();
    const samples = Array.from({ length: 500 }, (_, index) => path.getPointAtLength((totalLength * index) / 499));
    const distances = nodePoints.map((point) => Math.min(...samples.map((sample) => Math.hypot(sample.x - point.x, sample.y - point.y))));

    return {
      map: { width: mapRect.width, height: mapRect.height },
      svg: { left: svgRect.left - mapRect.left, top: svgRect.top - mapRect.top, width: svgRect.width, height: svgRect.height },
      nodePoints,
      distances,
    };
  });

  expect(Math.abs(chartGeometry.svg.left)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.top)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.width - chartGeometry.map.width)).toBeLessThan(0.5);
  expect(Math.abs(chartGeometry.svg.height - chartGeometry.map.height)).toBeLessThan(1.5);
  expect(chartGeometry.nodePoints[0].x).toBeCloseTo(7, 0);
  expect(chartGeometry.nodePoints.at(-1).x).toBeCloseTo(93, 0);
  expect(chartGeometry.distances.every((distance) => distance < 1.5)).toBe(true);
});

test("records page keeps empty seven-day data at zero", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "记录", exact: true }).click();

  await expect(page.locator(".nv-records-trend h2")).toHaveText("最近 7 天，平均每天 00:00:00。");
  await expect(page.locator(".records-archive__stats")).toContainText("活跃日平均 0 分钟");
  await expect.poll(() => page.locator(".nv-records-distribution__track > span").evaluateAll((bars) => bars.map((bar) => bar.style.height))).toEqual([
    "0%",
    "0%",
    "0%",
    "0%",
  ]);
});

test("record title can be edited and saved without changing its duration", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();

  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();

  const input = record.locator('input[name="editRecordTitle-3"]');
  await expect(input).toHaveValue("完成产品复盘");
  await input.fill("完成季度复盘");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(record).toContainText("完成季度复盘");
  await expect(record).toContainText("00:45:00");
  await expect(record).not.toContainText("完成产品复盘");
  await expect(page.locator(".app-message")).toContainText("专注记录已更新");
});

test("timer snapshots keep refreshing while a record draft is open", async ({ page }) => {
  test.setTimeout(60_000);
  await bootWithTauriMock(page, { includeRecords: true, pausedFocus: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();

  const input = record.locator('input[name="editRecordTitle-3"]');
  await input.fill("仍在编辑中的草稿");
  const timerCallsBefore = await page.evaluate(() => window.__timerSnapshotCalls);
  const todoCallsBefore = await page.evaluate(() => window.__todoItemsCalls);
  await page.evaluate(() => window.__replaceTimer({
    status: "运行中",
    isRunning: true,
    elapsedMs: 31_000,
    elapsedLabel: "00:00:31",
  }));

  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls), { timeout: 2500 })
    .toBeGreaterThan(timerCallsBefore);
  await expect.poll(() => page.evaluate(() => window.__todoItemsCalls), { timeout: 2500 })
    .toBe(todoCallsBefore);
  await expect(input).toHaveValue("仍在编辑中的草稿");

  await page.waitForTimeout(30_000);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls), { timeout: 5000 })
    .toBeGreaterThan(timerCallsBefore + 20);
  expect(await page.evaluate(() => window.__todoItemsCalls)).toBe(todoCallsBefore);
  await expect(input).toHaveValue("仍在编辑中的草稿");

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".timer-readout")).toContainText("00:00:31");
});

test("stopwatch shows a clear target duration instead of a one-minute target", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".timer-readout")).toContainText("目标 25 分钟");
  await expect(page.locator(".timer-readout")).not.toContainText("1 分钟");
});

test("timer page uses the current day's saved session count", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();

  await expect(page.locator(".nv-focus-brief__stats")).toContainText("今天已记录1 段");
  await expect(page.locator(".nv-focus-panel__session-data")).toContainText("今日已完成1 段");
  await expect(page.locator(".nv-focus-brief__stats")).not.toContainText("0 段");
  await expect(page.locator(".nv-focus-panel__session-data")).not.toContainText("0 段");
});

test("timer workspace keeps only actionable controls and state copy", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".nv-focus-panel .nv-panel-kicker")).toContainText("本次专注");
  await expect(page.locator(".nv-focus-panel .timer-readout")).toBeVisible();
  await expect(page.locator(".nv-chronograph__bezel")).toHaveCount(0);
  await expect(page.locator(".nv-focus-brief")).toBeVisible();
  await expect(page.locator(".nv-focus-route")).toHaveCount(0);
  await expect(page.locator(".nv-focus-instrument")).toHaveCount(0);
  await expect(page.locator(".nv-focus-footer")).toHaveCount(0);
  await expect(page.locator(".nv-focus-panel__shortcut")).toHaveCount(0);
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已暂停");

  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("运行中");

  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已暂停");

  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("保存成功");
  await expect.poll(() => page.evaluate(() => window.__completedFocusCalls)).toBe(1);

  await page.getByRole("button", { name: "清空设置", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
});

test("timer workspace distinguishes a completed countdown", async ({ page }) => {
  await bootWithTauriMock(page, { completedCountdown: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.locator(".nv-focus-panel__status")).toContainText("到点待保存");
  await expect(page.locator(".nv-focus-panel__status")).toContainText("保存后会写入专注记录");
});

test("timer workspace distinguishes a recovered session", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.evaluate(() => window.__replaceTimer({ recoveredFromLastSession: true }));
  await expect(page.locator(".nv-focus-panel__status")).toContainText("已恢复");
  await expect(page.locator(".nv-focus-panel__status")).toContainText("可以继续、保存或清空");
});

test("timer workspace offers quick durations and a usable pre-start reset", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await expect(page.getByRole("button", { name: "进入悬浮窗", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "25 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "45 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "60 分钟", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "清空设置", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "45 分钟", exact: true }).click();
  await expect(page.locator(".nv-mode-switcher button.active")).toHaveText("倒计时");
  await expect(page.locator(".timer-readout")).toContainText("45:00");

  await page.getByRole("button", { name: "清空设置", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__resetTimerCalls)).toBe(1);
});

test("timer page can reopen the focus floating window after returning to main", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();

  const floatingButton = page.getByRole("button", { name: "打开迷你工作台", exact: true });
  await expect(floatingButton).toBeVisible();
  await expect(floatingButton).toBeEnabled();
  await expect(floatingButton).toBeInViewport();

  await floatingButton.click();

  await expect.poll(() => page.evaluate(() => window.__floatingTodosShown)).toBe(true);
});

test("paused focus floating window can continue without returning to the main window", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-float", pausedFocus: true });

  await expect(page.getByRole("button", { name: "继续" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "暂停" })).toBeHidden();

  await page.getByRole("button", { name: "继续" }).click();

  await expect(page.getByRole("button", { name: "暂停" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "继续" })).toBeHidden();
});

test("focus unlock window exposes a retryable unlock control", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-unlock" });

  const unlockButton = page.getByRole("button", { name: "解除专注锁定，恢复计时操作" });
  await expect(unlockButton).toBeVisible();
  await unlockButton.click();
  await expect.poll(() => page.evaluate(() => window.__focusFloatingUnlocked)).toBe(true);
  await expect(unlockButton).toBeVisible();
});

test("main window clears a stale title after another window finishes the session", async ({ page }) => {
  await bootWithTauriMock(page, { pausedFocus: true });

  await page.getByRole("button", { name: "计时", exact: true }).click();
  const sessionTitle = page.locator('input[name="sessionTitle"]');
  await expect(sessionTitle).toHaveValue("写完产品复盘");

  await page.evaluate(() => window.__replaceTimer({
    status: "待开始",
    elapsedMs: 0,
    elapsedLabel: "00:00:00",
    activeTaskTitle: "",
    linkedTodoId: null,
    recoveredFromLastSession: false,
  }));

  await expect.poll(() => sessionTitle.inputValue()).toBe("");
});

test("todo editor saves a date selected from the native date picker", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: /^待办/ }).click();
  await page.getByRole("button", { name: "编辑" }).click();

  const todoItemsCallsBeforeWaiting = await page.evaluate(() => window.__todoItemsCalls);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__todoItemsCalls)).toBe(todoItemsCallsBeforeWaiting);

  const dateInput = page.locator('input[name="editTodoDate-1"]');
  const geometry = await page.evaluate(() => {
    const selectors = {
      date: 'input[name="editTodoDate-1"]',
      time: 'input[name="editTodoTime-1"]',
      save: '.todo-edit-form button.primary-button',
    };
    return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      const points = [
        [rect.left + 2, rect.top + rect.height / 2],
        [rect.right - 2, rect.top + rect.height / 2],
      ];
      return [key, {
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        hits: points.map(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 80)),
      }];
    }));
  });
  expect(geometry.date.rect.right).toBeLessThanOrEqual(geometry.time.rect.left);
  expect(geometry.date.hits[1]).toContain('editTodoDate-1');

  const tomorrow = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });

  await dateInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, tomorrow);
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.locator(".todo-row").getByText("明天截止 · 10:00")).toBeVisible();
});

test("completing a todo keeps it visible in the completed section", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: /^待办/ }).click();
  await page.getByRole("button", { name: "标记“写完产品复盘”完成" }).click();

  const completedRow = page.locator(".completed-row").filter({ hasText: "写完产品复盘" });
  await expect(completedRow).toContainText("已完成");
  await expect(completedRow.locator(".completed-row__marker")).toHaveText("✓");
  await expect(completedRow.locator(".completed-row__title")).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator(".app-message")).toContainText("已完成“写完产品复盘”");
});

test("app messages appear as dismissible top-right toasts and auto-dismiss", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();
  const record = page.locator(".record-row").first();
  await record.getByRole("button", { name: "编辑记录“完成产品复盘”" }).click();
  await record.locator('input[name="editRecordTitle-3"]').fill("完成季度复盘");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  const toast = page.locator(".app-message");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("position", "fixed");
  const toastBox = await toast.boundingBox();
  expect(toastBox?.x ?? 0).toBeGreaterThan(700);
  expect(toastBox?.y ?? 999).toBeLessThan(140);

  await toast.click();
  await expect(toast).toBeHidden();

  await record.getByRole("button", { name: "编辑记录“完成季度复盘”" }).click();
  await record.locator('input[name="editRecordTitle-3"]').fill("完成季度复盘二次");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 6500 });
});

test("todo board keeps completed actions aligned without a needless scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await bootWithTauriMock(page, { todayTodoCount: 0, completedTodoCount: 9 });

  await page.getByRole("button", { name: /^待办/ }).click();

  const layout = await page.evaluate(() => {
    const board = document.querySelector(".nv-todo-board");
    const columns = [...document.querySelectorAll(".nv-todo-column")];
    const completedList = document.querySelector(".nv-todo-column--done .nv-todo-column__list");
    const completedRow = document.querySelector(".nv-completed-row");
    const title = completedRow?.querySelector(".completed-row__title");
    const actions = completedRow ? [...completedRow.querySelectorAll(".row-action")].map((element) => element.getBoundingClientRect()) : [];
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    return {
      board: rect(board),
      columns: columns.map(rect),
      completedList: completedList ? { clientHeight: completedList.clientHeight, scrollHeight: completedList.scrollHeight } : null,
      completedRow: rect(completedRow),
      title: rect(title),
      actions: actions.map((value) => ({ left: value.left, right: value.right, top: value.top, bottom: value.bottom })),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(layout.board?.width).toBeGreaterThan(700);
  expect(layout.columns).toHaveLength(2);
  expect(layout.columns[0].right).toBeLessThanOrEqual(layout.columns[1].left + 0.5);
  expect(Math.abs(layout.columns[0].height - layout.columns[1].height)).toBeLessThan(2);
  expect(layout.completedList?.scrollHeight).toBe(layout.completedList?.clientHeight);
  expect(layout.title?.right).toBeLessThanOrEqual(layout.actions[0].left + 1);
  expect(Math.abs(layout.actions[0].top - layout.actions[1].top)).toBeLessThan(2);
  expect(layout.scrollWidth).toBeLessThanOrEqual(1487);
  await expect(page.locator(".completed-row")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "恢复" })).toHaveCount(9);
  await page.screenshot({ path: testOutputPath("screenshots", "night-valley-todo-completed-layout.png"), animations: "disabled", fullPage: true });
});

test("todo workspace stacks cleanly on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 860 });
  await bootWithTauriMock(page, { todayTodoCount: 0, completedTodoCount: 3 });

  await page.getByRole("button", { name: /^待办/ }).click();

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
    };
    return {
      page: rect(".nv-todo-page"),
      board: rect(".nv-todo-board"),
      focus: rect(".nv-todo-focus-panel"),
      columns: [...document.querySelectorAll(".nv-todo-column")].map((element) => {
        const value = element.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      }),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(560);
  expect(layout.page?.left).toBeGreaterThanOrEqual(0);
  expect(layout.page?.right).toBeLessThanOrEqual(560);
  expect(layout.board?.left).toBeGreaterThanOrEqual(layout.page?.left ?? 0);
  expect(layout.board?.right).toBeLessThanOrEqual(layout.page?.right ?? 560);
  expect(layout.columns[0].bottom).toBeLessThanOrEqual(layout.columns[1].top + 1);
  expect(layout.columns).toHaveLength(2);
  expect(layout.board?.bottom).toBeLessThanOrEqual(layout.focus?.top ?? 0);
  await expect(page.getByRole("button", { name: "添加待办" })).toBeVisible();
  await expect(page.locator(".completed-row")).toHaveCount(3);
  await page.screenshot({ path: testOutputPath("screenshots", "night-valley-todo-phone-layout.png"), animations: "disabled", fullPage: true });
});

test("todo board groups pending items by date and keeps one group open", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 12, futureTodoCount: 4 });

  await page.getByRole("button", { name: /^待办/ }).click();

  await expect(page.locator(".nv-todo-column")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "进行中" })).toHaveCount(0);
  await expect(page.locator(".nv-todo-summary")).not.toContainText("进行中");

  const navGeometry = await page.locator(".minimal-nav > button").nth(2).evaluate((button) => {
    const label = button.querySelector(".minimal-nav__label")?.getBoundingClientRect();
    const count = button.querySelector(".minimal-nav__count")?.getBoundingClientRect();
    if (!label || !count) throw new Error("todo navigation count is incomplete");
    return { labelRight: label.right, countLeft: count.left, countWidth: count.width };
  });
  expect(navGeometry.labelRight).toBeLessThanOrEqual(navGeometry.countLeft + 0.5);
  expect(navGeometry.countWidth).toBeGreaterThanOrEqual(18);

  const groups = page.locator(".nv-todo-date-group");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(groups.nth(1).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(groups.nth(0).locator(".nv-todo-card")).toHaveCount(12);
  await expect(groups.nth(1).locator(".nv-todo-card")).toHaveCount(0);

  const openGroupViewport = await groups.nth(0).locator(".nv-todo-date-group__items").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(openGroupViewport.scrollHeight).toBeGreaterThan(openGroupViewport.clientHeight);
  expect(openGroupViewport.clientHeight).toBeLessThanOrEqual(430);

  await groups.nth(1).locator(".nv-todo-date-group__toggle").click();
  await expect(groups.nth(0).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(groups.nth(1).locator(".nv-todo-date-group__toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(groups.nth(1).locator(".nv-todo-card")).toHaveCount(2);
});

test("todo date group keeps its scroll position during background refresh", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 18, freshTodoSnapshots: true });

  await page.getByRole("button", { name: /^待办/ }).click();

  const items = page.locator(".nv-todo-date-group").first().locator(".nv-todo-date-group__items");
  const callsBeforeScroll = await page.evaluate(() => window.__todoItemsCalls);
  await items.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => window.__todoItemsCalls), { timeout: 3000 })
    .toBeGreaterThan(callsBeforeScroll);
  expect(await items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("records overview info explains the seven-day chart on hover and focus", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });

  await page.getByRole("button", { name: "记录", exact: true }).click();

  const info = page.locator(".nv-info-tip");
  const tooltip = page.locator("#records-overview-help");
  await expect(info).toBeVisible();
  await info.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("最近 7 个自然日");

  await info.focus();
  await expect(tooltip).toBeVisible();
});

test("overdue todos are shown in their own status section", async ({ page }) => {
  await bootWithTauriMock(page, { includeOverdue: true });

  await page.getByRole("button", { name: /^待办/ }).click();

  const overdueSection = page.locator(".todo-status-section--overdue");
  await expect(page.getByRole("heading", { name: "已过期" })).toBeVisible();
  await expect(overdueSection).toContainText("过期事项");
  await expect(overdueSection.locator(".todo-row__overdue-label")).toHaveText("已过期");
  await expect(overdueSection.getByRole("button", { name: "编辑" })).toBeVisible();

  await overdueSection.getByRole("button", { name: "标记“过期事项”完成" }).click();
  await expect(page.locator(".completed-section")).toContainText("过期事项");
  await expect(overdueSection).toBeHidden();
});

test("Today cockpit remains usable on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 860 });
  await bootWithTauriMock(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始", exact: true })).toBeVisible();
});

test("quick capture creates an inbox item and keeps the current page", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.getByRole("button", { name: "快速记一件事", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  await dialog.getByRole("textbox").fill("临时想到的开头");
  await dialog.getByRole("button", { name: "放入收件箱" }).click();

  await expect.poll(() => page.evaluate(() => window.__quickCaptureCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
  await expect(page.getByText("已放入收件箱，稍后整理。", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^待办/ }).click();
  const inbox = page.locator(".nv-todo-date-group").filter({ hasText: "收件箱 · 未安排" });
  await expect(inbox).toContainText("临时想到的开头");
  await expect(inbox).not.toContainText("已过期");
});

test("quick capture during a running timer does not pause or navigate", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.locator(".continuity-board__card--current").getByRole("button", { name: "开始专注" }).click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();

  await page.getByRole("button", { name: "快速记一件事", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  await dialog.getByRole("textbox").fill("计时中想到的补充");
  await dialog.getByRole("button", { name: "放入收件箱" }).click();

  await expect.poll(() => page.evaluate(() => window.__quickCaptureCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect(page.getByRole("heading", { name: "今天，从一件事开始" })).toBeVisible();
});

test("current item and today picks stay user-controlled with a three-item limit", async ({ page }) => {
  await bootWithTauriMock(page, { todayTodoCount: 4 });

  await page.getByRole("button", { name: /^待办/ }).click();
  const plan = page.getByRole("region", { name: "当前事项和今日精选" });
  await expect(plan.getByRole("button", { name: "移出精选" })).toHaveCount(3);
  await expect(plan.getByRole("button", { name: "加入精选" })).toBeDisabled();

  await plan.getByRole("button", { name: "移出精选" }).first().click();
  await expect(plan.getByRole("button", { name: "加入精选" }).first()).toBeEnabled();
  await plan.getByRole("button", { name: "加入精选" }).first().click();
  await expect(plan.getByRole("button", { name: "移出精选" })).toHaveCount(3);

  await plan.getByRole("button", { name: "设为当前" }).first().click();
  await expect(plan.getByRole("button", { name: "取消当前" }).first()).toBeVisible();
});

test("finishing a linked round keeps the todo open and saves a continuation bookmark", async ({ page }) => {
  await bootWithTauriMock(page);

  await page.locator(".continuity-board__card--current").getByRole("button", { name: "开始专注" }).click();
  await page.getByRole("button", { name: "计时", exact: true }).click();
  const finish = page.getByRole("button", { name: "完成并记录", exact: true });
  await expect(finish).toBeEnabled();
  await finish.click();

  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("textbox").fill("从第三段的例子继续");
  await prompt.getByRole("button", { name: "保存下次位置" }).click();

  await expect.poll(() => page.evaluate(() => window.__continuationNoteCalls)).toBe(1);
  await expect(prompt).toBeHidden();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("下次继续：从第三段的例子继续", { exact: true })).toBeVisible();
  await expect(page.getByText("1 轮", { exact: true })).toBeVisible();
});

test("the same todo can continue through multiple rounds without auto-completing", async ({ page }) => {
  await bootWithTauriMock(page);

  const currentCard = page.locator(".continuity-board__card--current");
  await currentCard.getByRole("button", { name: "开始专注" }).click();
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await page.getByRole("dialog", { name: "保存停笔书签" }).getByRole("button", { name: "暂不记录" }).click();

  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("1 轮", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续专注", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(2);

  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await page.getByRole("dialog", { name: "保存停笔书签" }).getByRole("button", { name: "暂不记录" }).click();

  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("2 轮", { exact: true })).toBeVisible();
  await expect(page.locator(".continuity-board__card--current")).toContainText("写完产品复盘");
  await expect(page.getByText("已完成事项", { exact: true })).toHaveCount(0);
});

test("records support manual entry and detailed correction", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "记录", exact: true }).click();

  await page.getByRole("button", { name: "补录专注" }).click();
  const manual = page.getByRole("dialog", { name: "补录一段专注" });
  await manual.getByRole("textbox", { name: "标题" }).fill("手动回顾一段工作");
  await manual.getByRole("spinbutton", { name: "时长（分钟）" }).fill("35");
  await manual.getByRole("button", { name: "补录记录" }).click();
  await expect.poll(() => page.evaluate(() => window.__manualRecordCalls)).toBe(1);
  const manualRecord = page.locator(".record-row").filter({ hasText: "手动回顾一段工作" });
  await expect(manualRecord).toContainText("手动补录");

  const record = manualRecord;
  await record.getByRole("button", { name: "详细编辑" }).click();
  const editor = page.getByRole("dialog", { name: "编辑专注记录" });
  await editor.getByRole("spinbutton", { name: "时长（分钟）" }).fill("40");
  await editor.getByRole("button", { name: "保存修改" }).click();
  await expect.poll(() => page.evaluate(() => window.__recordUpdateCalls)).toBe(1);
  await expect(record).toContainText("00:40:00");
  await expect(record).toContainText("已修正");
});

test("portable backup preview and import expose the v3 restore choice", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();

  const path = page.getByRole("textbox", { name: "外部备份文件路径" });
  await expect(path).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "选择 JSON 文件" }).click();
  await expect(path).toHaveValue("C:\\Users\\test\\focused-moment-backup.json");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__backupPreviewCalls)).toBe(1);
  await expect(page.locator(".portable-backup-panel__preview")).toContainText("v3 / v3");
  await expect(page.getByRole("checkbox", { name: "待办、收件箱和当前事项" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "专注记录和统计" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /主题.*自定义音效/ })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "待办、收件箱和当前事项" }).uncheck();
  await page.getByRole("checkbox", { name: "专注记录和统计" }).uncheck();
  await page.getByRole("checkbox", { name: /主题.*自定义音效/ }).check();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "确认导入并生成回滚" }).click();
  await expect.poll(() => page.evaluate(() => window.__backupImportCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__lastBackupImportOptions)).toEqual({
    restoreTodos: false,
    restoreRecords: false,
    restoreAppPreferences: true,
  });
});

test("failed appearance persistence keeps the live change and offers retry", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.evaluate(() => { window.__failAppPreferenceSave = true; });
  await page.locator(".theme-picker__option").filter({ hasText: "编辑纸页" }).click();

  const error = page.getByRole("alert").filter({ hasText: "外观设置保存失败" });
  await expect(error).toBeVisible({ timeout: 3000 });
  await page.evaluate(() => { window.__failAppPreferenceSave = false; });
  await error.getByRole("button", { name: "重试保存" }).click();
  await expect(error).toBeHidden({ timeout: 3000 });
  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBeGreaterThan(1);
});

test("appearance autosave keeps the newest theme after a stale save resolves late", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.evaluate(() => {
    window.__appPreferenceSavePlan = [{ delay: 450 }, { delay: 0 }];
  });

  await page.locator(".theme-picker__option").filter({ hasText: "编辑纸页" }).click();
  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBe(1, { timeout: 3000 });
  await page.locator(".theme-picker__option").filter({ hasText: "石墨控制台" }).click();

  await expect.poll(() => page.evaluate(() => window.__appPreferenceUpdateCalls)).toBe(2, { timeout: 5000 });
  await expect.poll(() => page.evaluate(() => window.__mockAppPreferences?.themeId)).toBe("graphite-console", { timeout: 5000 });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
});

test("RC autosave failed A is superseded by B and its detached retry cannot overwrite B", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.evaluate(() => { window.__appPreferenceSavePlan = [{ fail: true }]; });
  await page.locator(".theme-picker__option").filter({ hasText: "编辑纸页" }).click();
  const retry = page.getByRole("alert").filter({ hasText: "外观设置保存失败" }).getByRole("button", { name: "重试保存" });
  await expect(retry).toBeVisible();
  const staleRetry = await retry.elementHandle();
  const polls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBeGreaterThan(polls + 1);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "editorial-paper");
  await page.locator(".theme-picker__option").filter({ hasText: "石墨控制台" }).click();
  await expect.poll(() => page.evaluate(() => window.__mockAppPreferences?.themeId)).toBe("graphite-console");
  await expect(retry).toHaveCount(0);
  await staleRetry.evaluate((button) => button.click());
  const afterB = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBeGreaterThan(afterB);
  expect(await page.evaluate(() => window.__appPreferenceWrites.map((item) => item.themeId))).toEqual(["editorial-paper", "graphite-console"]);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
});

test("RC autosave held retry and rapid theme intensity changes preserve the final full snapshot", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.evaluate(() => { window.__appPreferenceSavePlan = [{ fail: true }, { hold: true }]; });
  await page.locator(".theme-picker__option").filter({ hasText: "编辑纸页" }).click();
  await page.getByRole("alert").filter({ hasText: "外观设置保存失败" }).getByRole("button", { name: "重试保存" }).click();
  await expect.poll(() => page.evaluate(() => typeof window.__releasePreferenceSave)).toBe("function");
  await page.locator(".theme-picker__option").filter({ hasText: "石墨控制台" }).click();
  await page.locator(".theme-picker__option").filter({ hasText: "夜谷" }).click();
  for (const [name, value] of [["视觉强度", "21"], ["动效强度", "13"], ["视觉强度", "83"]]) {
    await page.getByRole("slider", { name, exact: true }).fill(value);
  }
  const polls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBeGreaterThan(polls + 1);
  await expect(page.getByRole("slider", { name: "视觉强度", exact: true })).toHaveValue("83");
  await page.evaluate(() => window.__releasePreferenceSave());
  await expect.poll(() => page.evaluate(() => window.__mockAppPreferences)).toMatchObject({ themeId: "night-valley", visualIntensity: 83, motionIntensity: 13 });
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await expect(page.getByRole("slider", { name: "动效强度", exact: true })).toHaveValue("13");
  expect(await page.evaluate(() => window.__appPreferenceWrites.at(-1))).toMatchObject({ themeId: "night-valley", visualIntensity: 83, motionIntensity: 13 });
});

test("RC manual correction delete undo keep records analytics and broadcast consistent", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "记录", exact: true }).click();
  const assertTotals = async (minutes, count, linked, todayCount) => {
    // Check the first broadcast carrying the mutation, so the next one-second
    // refresh cannot conceal stale analytics emitted immediately after saving.
    await expect.poll(() => page.evaluate(({ minutes, count }) => window.__emittedStates.find((state) =>
      state.records.length === count && state.records.reduce((sum, record) => sum + record.durationMs, 0) === minutes * 60_000
    )?.analytics, { minutes, count })).toMatchObject({
      totalFocusDurationMs: minutes * 60_000, sessionCount: count, linkedSessionCount: linked,
      independentSessionCount: count - linked, todaySessionCount: todayCount,
    });
    await expect(page.locator(".records-archive__metric").filter({ hasText: "累计专注" })).toContainText(`${count} 条记录`);
    await expect(page.locator(".records-archive__metric").filter({ hasText: "累计专注" }).locator("strong")).toHaveText(minutes ? `00:${String(minutes).padStart(2, "0")}:00` : "0 分钟");
    expect(await page.evaluate(() => window.__getAppStateSyncPayload().analytics)).toMatchObject({ totalFocusDurationMs: minutes * 60_000, sessionCount: count });
  };
  await page.getByRole("button", { name: "补录专注" }).click();
  const manual = page.getByRole("dialog", { name: "补录一段专注" });
  await manual.getByRole("textbox", { name: "标题", exact: true }).fill("RC 原始记录");
  await manual.getByRole("spinbutton").fill("35");
  await manual.getByLabel("完成时间（可选）").fill("09:12");
  await manual.getByRole("button", { name: "补录记录" }).click();
  await expect(manual).toBeHidden();
  await assertTotals(35, 1, 0, 1);
  const original = page.locator(".record-row").filter({ hasText: "RC 原始记录" });
  await original.getByRole("button", { name: "详细编辑" }).click();
  const editor = page.getByRole("dialog", { name: "编辑专注记录" });
  const yesterday = new Date(`${localDate()}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  await editor.getByRole("textbox", { name: "标题", exact: true }).fill("RC 修正记录");
  await editor.getByRole("spinbutton").fill("47");
  await editor.getByLabel("完成日期").fill(date);
  await editor.getByLabel("完成时间（可选）").fill("23:59");
  await editor.getByRole("combobox").selectOption("1");
  await editor.getByRole("button", { name: "保存修改" }).click();
  await expect(editor).toBeHidden();
  await assertTotals(47, 1, 1, 0);
  const saved = await page.evaluate(() => window.__getAppStateSyncPayload().records[0]);
  expect(saved).toMatchObject({ title: "RC 修正记录", durationMs: 47 * 60_000, completedDate: date, completedTime: "23:59", linkedTodoId: 1, linkedTodoTitle: "写完产品复盘", source: "manual", timeBasis: "completion_day" });
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().analytics.dailyBreakdown)).toEqual([{ date, totalDurationMs: 47 * 60_000, totalDurationLabel: "00:47:00", sessionCount: 1, linkedSessionCount: 1, independentSessionCount: 0 }]);
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().todos[0].isCompleted)).toBe(false);
  const corrected = page.locator(".record-row").filter({ hasText: "RC 修正记录" });
  // Expand the date group after moving the only record to another day.
  const group = page.locator(".record-day").filter({ hasText: "RC 修正记录" });
  if (!(await corrected.isVisible())) await group.locator("summary").click();
  await page.evaluate(() => { window.__emittedStates = []; });
  await corrected.getByRole("button", { name: "删除记录“RC 修正记录”" }).click();
  await assertTotals(0, 0, 0, 0);
  await expect(corrected).toHaveCount(0);
  await page.evaluate(() => { window.__emittedStates = []; });
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await assertTotals(47, 1, 1, 0);
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().records)).toEqual([saved]);
});

test("RC inline rename preserves exact seconds and record metadata", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.locator(".continuity-board__card--current").getByRole("button", { name: "开始专注" }).click();
  await page.evaluate(() => window.__replaceTimer({ elapsedMs: 91_234, elapsedLabel: "00:01:31" }));
  await page.getByRole("button", { name: "计时", exact: true }).click();
  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await page.getByRole("dialog", { name: "保存停笔书签" }).getByRole("button", { name: "暂不记录" }).click();
  const before = await page.evaluate(() => window.__getAppStateSyncPayload().records[0]);
  await page.getByRole("button", { name: "记录", exact: true }).click();
  const row = page.locator(".record-row").first();
  await row.getByRole("button", { name: "编辑记录“写完产品复盘”" }).click();
  await row.getByRole("textbox").fill("只改标题");
  await row.getByRole("button", { name: "保存", exact: true }).click();
  await expect(row).toContainText("只改标题");
  const after = await page.evaluate(() => window.__getAppStateSyncPayload().records[0]);
  expect(after).toEqual({ ...before, title: "只改标题", editedAt: expect.any(String) });
  expect(after.durationMs).toBe(91_234);
  expect(await page.evaluate(() => window.__recordUpdateCalls)).toBe(0);
});

test("RC continuation skip replace and retry preserve three rounds on the same task", async ({ page }) => {
  await bootWithTauriMock(page);
  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  for (let round = 1; round <= 3; round += 1) {
    await page.getByRole("button", { name: "今日", exact: true }).click();
    await page.locator(".continuity-board__card--current").getByRole("button", { name: round === 1 ? "开始专注" : "继续专注", exact: true }).click();
    await page.evaluate(() => window.__replaceTimer({ elapsedMs: 120_000, elapsedLabel: "00:02:00" }));
    await page.getByRole("button", { name: "计时", exact: true }).click();
    await page.getByRole("button", { name: "完成并记录", exact: true }).click();
    await expect(prompt).toBeVisible();
    if (round === 2) {
      await prompt.getByRole("button", { name: "暂不记录" }).click();
    } else {
      await prompt.getByRole("textbox").fill(round === 1 ? "第一版书签" : "替换后的书签");
      if (round === 3) await page.evaluate(() => { window.__failContinuationSave = true; });
      await prompt.getByRole("button", { name: "保存下次位置" }).click();
      if (round === 3) {
        await expect(prompt.getByRole("alert")).toContainText("保存失败");
        await expect(prompt.getByRole("textbox")).toHaveValue("替换后的书签");
        expect(await page.evaluate(() => window.__getAppStateSyncPayload().todos[0].continuationNote)).toBe("第一版书签");
        await page.evaluate(() => { window.__failContinuationSave = false; });
        await prompt.getByRole("button", { name: "重试保存" }).click();
      }
    }
    await expect(prompt).toBeHidden();
    const state = await page.evaluate(() => window.__getAppStateSyncPayload());
    expect(state.records).toHaveLength(round);
    expect(state.records.every((record) => record.linkedTodoId === 1 && record.durationMs === 120_000)).toBe(true);
    expect(state.todos[0]).toMatchObject({ isCompleted: false, continuationNote: round === 3 ? "替换后的书签" : "第一版书签" });
    expect(state.focusPlan.currentTodoId).toBe(1);
    expect(state.analytics).toMatchObject({ sessionCount: round, totalFocusDurationMs: round * 120_000, linkedSessionCount: round });
  }
  expect(await page.evaluate(() => window.__continuationNoteCalls)).toBe(3);
});

test("RC command palette distinguishes same-name tasks and handles dates empty results and keyboard", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.getByRole("button", { name: "快速记一件事", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "先记下来，稍后再整理" });
  await capture.getByRole("textbox").fill("写完产品复盘");
  await capture.getByRole("button", { name: "放入收件箱" }).click();
  await expect(capture).toBeHidden();
  await page.keyboard.press("Control+K");
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  await search.fill("写完产品复盘");
  await expect(page.getByRole("option").filter({ hasText: "任务：写完产品复盘" })).toHaveCount(2);
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-history-task-1");
  await search.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-history-task-2");
  await search.press("Enter");
  await expect(page.locator(".records-task-filter")).toContainText("写完产品复盘");
  await expect(page.locator(".record-row")).toHaveCount(0);
  await expect(page.locator(".records-task-filter")).toContainText("0 条匹配记录");
  await expect(page.locator(".record-history__heading")).toContainText("0 轮");
  await expect(page.locator(".record-history .empty-copy")).toBeVisible();
  await page.keyboard.press("Control+K");
  await search.fill("写完产品复盘");
  await page.locator("#command-palette-option-history-task-1").click();
  await expect(page.locator(".records-task-filter")).toContainText("1 条匹配记录");
  await expect(page.locator(".record-row")).toHaveCount(1);
  await expect(page.locator(".record-history__heading")).toContainText("1 轮");
  await page.keyboard.press("Control+K");
  await search.fill(localDate());
  await expect(page.locator("#command-palette-option-history-record-3")).toBeVisible();
  await expect(search).toHaveAttribute("aria-activedescendant", `command-palette-option-history-date-${localDate()}`);
  await search.press("End");
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-history-record-3");
  const refreshCalls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBeGreaterThan(refreshCalls + 1);
  await expect(search).toHaveAttribute("aria-activedescendant", "command-palette-option-history-record-3");
  await search.press("Home");
  await expect(search).toHaveAttribute("aria-activedescendant", `command-palette-option-history-date-${localDate()}`);
  await search.press("Enter");
  await expect(page.locator(".records-task-filter")).toHaveCount(0);
  await expect(page.locator(".records-archive__node--selected")).toHaveAttribute("aria-label", /00:45:00/);
  await expect(page.locator(".records-archive__detail")).toContainText("1 条可回看记录");
  await page.keyboard.press("Control+K");
  await search.fill("绝不匹配-rc-empty");
  await expect(page.getByRole("option")).toHaveCount(0);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter"]) await search.press(key);
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await expect(page.getByRole("dialog", { name: "你想做什么？" })).toBeVisible();
  await search.press("Escape");
  await expect(page.getByRole("button", { name: "记录", exact: true })).toBeFocused();
});

for (const scope of ["default", "todos", "records", "settings"]) {
  test(`RC backup confirmation lists only ${scope} scope and cancel makes no changes`, async ({ page }) => {
    await bootWithTauriMock(page, { pausedFocus: true, includeRecords: true });
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "选择 JSON 文件" }).click();
    await page.getByRole("button", { name: "预览", exact: true }).click();
    const todos = page.getByRole("checkbox", { name: "待办、收件箱和当前事项" });
    const records = page.getByRole("checkbox", { name: "专注记录和统计" });
    const settings = page.getByRole("checkbox", { name: /主题.*自定义音效/ });
    await todos.setChecked(scope === "default" || scope === "todos");
    await records.setChecked(scope === "default" || scope === "records");
    await settings.setChecked(scope === "settings");
    const before = await page.evaluate(() => structuredClone(window.__getAppStateSyncPayload()));
    const dialogPromise = page.waitForEvent("dialog");
    const click = page.getByRole("button", { name: "确认导入并生成回滚" }).click();
    const confirm = await dialogPromise;
    const selectedScopes = confirm.message().split("。", 1)[0];
    expect(selectedScopes.includes("待办、收件箱和当前事项")).toBe(scope === "default" || scope === "todos");
    expect(selectedScopes.includes("专注记录和统计")).toBe(scope === "default" || scope === "records");
    expect(selectedScopes.includes("计时运行态")).toBe(scope === "default");
    expect(selectedScopes.includes("外观、计时设置和自定义音效")).toBe(scope === "settings");
    await confirm.dismiss();
    await click;
    expect(await page.evaluate(() => window.__backupImportCalls)).toBe(0);
    expect(await page.evaluate(() => window.__getAppStateSyncPayload())).toEqual(before);
    await expect(page.locator(".portable-backup-panel__preview")).toBeVisible();
  });
}

test("RC backup no selected scopes disables import and mismatched source cannot import", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "选择 JSON 文件" }).click();
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await page.getByRole("checkbox", { name: "待办、收件箱和当前事项" }).uncheck();
  await page.getByRole("checkbox", { name: "专注记录和统计" }).uncheck();
  const restore = page.getByRole("button", { name: "确认导入并生成回滚" });
  await expect(restore).toBeDisabled();
  expect(await page.evaluate(() => window.__backupImportCalls)).toBe(0);
  await page.getByRole("checkbox", { name: "待办、收件箱和当前事项" }).check();
  await page.evaluate(() => { window.__backupPreviewSourcePath = "C:\\Users\\test\\different.json"; });
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__backupPreviewCalls)).toBe(2);
  // The controller must reject a preview belonging to a different source path.
  await restore.click();
  await expect(page.locator(".app-message")).toContainText("请先预览一份有效备份");
  expect(await page.evaluate(() => window.__backupImportCalls)).toBe(0);
});

test("RC backup native chooser cancellation and save path preserve preview safety", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const path = page.getByRole("textbox", { name: "外部备份文件路径" });
  await expect(path).toHaveAttribute("readonly", "");
  await page.evaluate(() => { window.__dialogOpenResult = null; });
  await page.getByRole("button", { name: "选择 JSON 文件" }).click();
  await expect.poll(() => page.evaluate(() => window.__dialogOpenCalls)).toBe(1);
  await expect(path).toHaveValue("");
  await expect(page.getByRole("button", { name: "预览", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "选择导出位置" }).click();
  await expect.poll(() => page.evaluate(() => window.__dialogSaveCalls)).toBe(1);
  await expect(path).toHaveValue("C:\\Users\\test\\focused-moment-export.json");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("C:\\Users\\test\\focused-moment-export.json");
    expect(dialog.message()).toContain("覆盖");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "导出到此路径" }).click();
  expect(await page.evaluate(() => window.__backupExportPaths)).toEqual([]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "导出到此路径" }).click();
  await expect.poll(() => page.evaluate(() => window.__backupExportPaths)).toEqual(["C:\\Users\\test\\focused-moment-export.json"]);
  expect(await page.evaluate(() => window.__backupImportCalls)).toBe(0);
});

for (const windowLabel of ["todo-float", "focus-float"]) {
  test(`RC ${windowLabel} completion opens the bookmark editor in the main window`, async ({ page, context }) => {
    await bootWithTauriMock(page);
    await expect.poll(() => page.evaluate(() => window.__continuationRequestReady)).toBe(true);
    const floating = await context.newPage();
    await bootWithTauriMock(floating, { windowLabel, pausedFocus: true });
    await floating.exposeFunction("__forwardContinuationRequest", (payload) => page.evaluate((payload) =>
      window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "focus-continuation-request", payload }), payload));
    await floating.evaluate(async () => {
      window.__replaceTimer({ linkedTodoId: 1, activeTaskTitle: "写完产品复盘", elapsedMs: 120_000 });
      await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
    });
    if (windowLabel === "todo-float") await floating.locator(".floating-tab").filter({ hasText: "当前计时" }).click();
    await floating.getByRole("button", { name: "完成并记录", exact: true }).click();
    const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("写完产品复盘");
    await expect.poll(() => floating.evaluate(() => window.__restoredMainCalls)).toBe(1);
    expect(await floating.evaluate(() => window.__continuationRequests)).toEqual([{ todoId: 1 }]);
    expect(await floating.evaluate(() => window.__getAppStateSyncPayload().records)).toHaveLength(1);
    await prompt.getByRole("textbox").fill("浮窗完成后接着第三段");
    await prompt.getByRole("button", { name: "保存下次位置" }).click();
    await expect(prompt).toBeHidden();
    expect(await page.evaluate(() => window.__getAppStateSyncPayload().todos[0].continuationNote)).toBe("浮窗完成后接着第三段");
    await floating.close();
  });
}

test("RC continuation event rejects missing completed and malformed todos and preserves an open draft", async ({ page }) => {
  await bootWithTauriMock(page);
  await expect.poll(() => page.evaluate(() => window.__continuationRequestReady)).toBe(true);
  const send = (payload) => page.evaluate((payload) => window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "focus-continuation-request", payload }), payload);
  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  for (const payload of [null, {}, { todoId: 1.5 }, { todoId: -1 }, { todoId: 999 }]) await send(payload);
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("toggle_todo_item", { id: 1 }));
  await send({ todoId: 1 });
  await expect(prompt).toHaveCount(0);
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("toggle_todo_item", { id: 1 }));
  await send({ todoId: 1, title: "不可信旧标题" });
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText("写完产品复盘");
  await prompt.getByRole("textbox").fill("尚未提交的书签草稿");
  await send({ todoId: 1 });
  await expect(prompt.getByRole("textbox")).toHaveValue("尚未提交的书签草稿");
  expect(await page.evaluate(() => window.__continuationNoteCalls)).toBe(0);
});

test("RC continuation event failure does not roll back floating record completion or prevent return", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "focus-float", pausedFocus: true });
  await page.evaluate(async () => {
    window.__failContinuationEvent = true;
    window.__replaceTimer({ linkedTodoId: 1, activeTaskTitle: "写完产品复盘", elapsedMs: 120_000 });
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
  });
  await page.getByRole("button", { name: "完成并记录", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__restoredMainCalls)).toBe(1);
  const state = await page.evaluate(() => window.__getAppStateSyncPayload());
  expect(state.records).toHaveLength(1);
  expect(state.records[0]).toMatchObject({ linkedTodoId: 1, durationMs: 120_000 });
  expect(state.timer.hasUnsubmittedProgress).toBe(false);
  expect(state.todos[0].isCompleted).toBe(false);
  expect(await page.evaluate(() => window.__completedFocusCalls)).toBe(1);
});

test("RC continuation event accepts the first persisted todo with id zero", async ({ page }) => {
  await bootWithTauriMock(page, { firstTodoId: 0 });
  await expect.poll(() => page.evaluate(() => window.__continuationRequestReady)).toBe(true);
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("plugin:event|emit", {
    event: "focus-continuation-request", payload: { todoId: 0 },
  }));
  const prompt = page.getByRole("dialog", { name: "保存停笔书签" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("textbox").fill("第一条待办的停笔位置");
  await prompt.getByRole("button", { name: "保存下次位置" }).click();
  await expect(prompt).toBeHidden();
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().todos[0])).toMatchObject({ id: 0, isCompleted: false, continuationNote: "第一条待办的停笔位置" });
});

test("RC focus plan polling clears yesterday picks after rollover but retains inbox and current todo", async ({ page }) => {
  await page.clock.install({ time: new Date(`${localDate()}T12:00:00`) });
  await bootWithTauriMock(page, { includeRecords: true });
  await expect(page.locator(".unified-today-page__date > strong")).toHaveText(localDate());
  await expect(page.locator(".continuity-board__value")).toHaveText("45 分钟");
  await page.evaluate(async () => {
    await window.__TAURI_INTERNALS__.invoke("create_todo_item", { title: "跨日收件箱", scheduledDate: "", scheduledTime: "", importanceKey: "medium" });
    await window.__TAURI_INTERNALS__.invoke("update_focus_plan", { currentTodoId: 1, todayPickIds: [1, 2] });
  });
  const picks = page.locator(".continuity-board__picks");
  await expect(picks).toContainText("跨日收件箱");
  await expect(picks).toContainText("写完产品复盘");
  const tomorrow = new Date(`${localDate()}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await page.clock.setSystemTime(tomorrow);
  await page.evaluate((date) => { window.__mockToday = date; }, nextDate);
  await expect.poll(() => page.evaluate(() => window.__getAppStateSyncPayload().focusPlan)).toEqual({ currentTodoId: 1, todayPickIds: [2] });
  await expect(picks).not.toContainText("写完产品复盘");
  await expect(picks).toContainText("跨日收件箱");
  await expect(page.locator(".continuity-board__card--current")).toContainText("写完产品复盘");
  await expect(page.locator(".unified-today-page__date > strong")).toHaveText(nextDate);
  await expect(page.locator(".continuity-board__value")).toHaveText("0 分钟");
  await expect(page.locator(".continuity-board__card--investment")).toContainText("0 段完成");
  const nextCopyId = await page.evaluate(async (date) => (await import("/src/lib/copy-library.ts")).getDailyCopy(date).id, nextDate);
  await expect(page.locator(".daily-focus-line")).toHaveAttribute("data-copy-id", nextCopyId);
});

test("RC manual records preserve unknown completion time through creation and detailed edits", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByRole("button", { name: "补录专注" }).click();
  const manual = page.getByRole("dialog", { name: "补录一段专注" });
  await manual.getByRole("textbox", { name: "标题", exact: true }).fill("没有填写时间的补录");
  await expect(manual.getByLabel("完成时间（可选）")).toHaveValue("");
  await manual.getByRole("button", { name: "补录记录" }).click();
  const row = page.locator(".record-row").filter({ hasText: "没有填写时间的补录" });
  const timestamp = row.locator(".record-row__details > small");
  await expect(timestamp).toContainText("未填写时间");
  await expect(timestamp).not.toContainText("00:00");
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().records[0].completedTime)).toBe("");
  for (const time of ["17:42", ""]) {
    await row.getByRole("button", { name: "详细编辑" }).click();
    const editor = page.getByRole("dialog", { name: "编辑专注记录" });
    await editor.getByLabel("完成时间（可选）").fill(time);
    await editor.getByRole("button", { name: "保存修改" }).click();
    await expect(editor).toBeHidden();
    await expect(timestamp).toContainText(time || "未填写时间");
    if (!time) await expect(timestamp).not.toContainText("00:00");
    expect(await page.evaluate(() => window.__getAppStateSyncPayload().records[0])).toMatchObject({ completedDate: localDate(), completedTime: time, durationMs: 25 * 60_000 });
  }
});

test("RC history search keeps dates older than seven days selected after refresh", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true, historyDayCount: 12 });
  const oldDate = await page.evaluate(() => window.__getAppStateSyncPayload().records.find((record) => record.title === "历史归档 11").completedDate);
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill(oldDate);
  await page.locator(`#command-palette-option-history-date-${oldDate}`).click();
  const detail = page.getByRole("complementary", { name: "选中日期详情" });
  await expect(detail).toContainText("00:30:00 · 1 条可回看记录");
  const expectedDay = await page.evaluate(async (date) => (await import("/src/features/shared/date-utils.ts")).formatRecordDay(date), oldDate);
  await expect(detail.locator(".records-archive__detail-heading")).toContainText(expectedDay);
  const polls = await page.evaluate(() => window.__timerSnapshotCalls);
  await expect.poll(() => page.evaluate(() => window.__timerSnapshotCalls)).toBeGreaterThan(polls + 1);
  await expect(detail.locator(".records-archive__detail-heading")).toContainText(expectedDay);
  await expect(page.locator(".records-archive__node--selected")).toHaveCount(0);
});

test("RC history search filters exact records beyond the first 200 and clears mutually exclusive task filters", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  const targetId = await page.evaluate(async () => {
    for (let index = 0; index < 205; index += 1) {
      await window.__TAURI_INTERNALS__.invoke("create_manual_focus_record", {
        title: index === 0 ? "深藏记录唯一目标" : `填充记录-${index}`, durationMinutes: 1,
        completedDate: window.__mockToday, completedTime: "08:00", linkedTodoId: 1,
      });
    }
    const records = window.__getAppStateSyncPayload().records;
    const position = records.findIndex((record) => record.title === "深藏记录唯一目标");
    if (position < 200) throw new Error("目标必须位于原始列表第 200 项之后");
    return records[position].id;
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".theme-picker__option").filter({ hasText: "编辑纸页" }).click();
  await page.keyboard.press("Control+K");
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  await search.fill("深藏记录唯一目标");
  await page.locator(`#command-palette-option-history-record-${targetId}`).click();
  await expect(page.locator(".records-task-filter")).toContainText("1 条匹配记录");
  await expect(page.locator(".records-task-filter")).toContainText("累计统计与七日趋势仍包含全部记录");
  await expect(page.locator(".ep-record-entry")).toHaveCount(1);
  await expect(page.locator(".ep-record-entry")).toContainText("深藏记录唯一目标");
  await expect(page.locator(".ep-full-history > .ep-section-heading > span")).toHaveText("1 轮");
  await page.keyboard.press("Control+K");
  await search.fill("写完产品复盘");
  await page.locator("#command-palette-option-history-task-1").click();
  await expect(page.locator(".records-task-filter")).toContainText("206 条匹配记录");
  await expect(page.getByRole("button", { name: "清除记录筛选" })).toHaveCount(0);
  await page.keyboard.press("Control+K");
  await search.fill("深藏记录唯一目标");
  await page.locator(`#command-palette-option-history-record-${targetId}`).click();
  await expect(page.locator(".ep-record-entry")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "清除任务筛选" })).toHaveCount(0);
  await page.getByRole("button", { name: "清除记录筛选" }).click();
  await expect(page.locator(".records-task-filter")).toHaveCount(0);
});

test("RC exact date search reserves archive navigation beyond twenty same-day records", async ({ page }) => {
  await bootWithTauriMock(page);
  const date = "2025-01-15";
  await page.evaluate(async (completedDate) => {
    for (let index = 0; index < 25; index += 1) {
      await window.__TAURI_INTERNALS__.invoke("create_manual_focus_record", {
        title: `同日记录-${index}`, durationMinutes: 1, completedDate, completedTime: "08:00", linkedTodoId: null,
      });
    }
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
  }, date);
  await page.keyboard.press("Control+K");
  await page.getByRole("searchbox", { name: "搜索命令" }).fill(date);
  await expect(page.getByRole("option")).toHaveCount(20);
  await page.locator(`#command-palette-option-history-date-${date}`).click();
  await expect(page.getByRole("complementary", { name: "选中日期详情" })).toContainText("00:25:00 · 25 条可回看记录");
});

test("RC history search ignores bookmarks and durations but accepts titles associations and times", async ({ page }) => {
  await bootWithTauriMock(page, { includeRecords: true });
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("update_todo_continuation_note", { id: 1, note: "绝密书签不可搜索" }));
  await page.keyboard.press("Control+K");
  const search = page.getByRole("searchbox", { name: "搜索命令" });
  for (const query of ["绝密书签不可搜索", "00:45:00"]) {
    await search.fill(query);
    await expect(page.getByRole("option")).toHaveCount(0);
  }
  await search.fill("写完产品复盘");
  await expect(page.locator("#command-palette-option-history-task-1")).toContainText("停笔书签：绝密书签不可搜索");
  await expect(page.locator("#command-palette-option-history-record-3")).toBeVisible();
  await search.fill("11:30");
  await expect(page.locator("#command-palette-option-history-record-3")).toBeVisible();
  await search.fill("10:00");
  await expect(page.locator("#command-palette-option-history-task-1")).toBeVisible();
});

test("RC exit waits for autosave and preserves the window on failure until retry succeeds", async ({ page }) => {
  await bootWithTauriMock(page);
  await expect.poll(() => page.evaluate(() => window.__exitRequestReady)).toBe(true);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.evaluate(() => { window.__appPreferenceSavePlan = [{ fail: true }]; });
  await page.getByRole("slider", { name: "视觉强度", exact: true }).fill("29");
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-exit-request", payload: null }));
  await expect(page.locator(".app-message")).toContainText("重试保存后再关闭或退出");
  expect(await page.evaluate(() => window.__restoredMainCalls)).toBe(1);
  expect(await page.evaluate(() => window.__quitApplicationCalls)).toBe(0);
  await page.evaluate(() => { window.__appPreferenceSavePlan = [{ hold: true }]; });
  await page.getByRole("alert").filter({ hasText: "外观设置保存失败" }).getByRole("button", { name: "重试保存" }).click();
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-exit-request", payload: null }));
  await expect.poll(() => page.evaluate(() => typeof window.__releasePreferenceSave)).toBe("function");
  expect(await page.evaluate(() => window.__quitApplicationCalls)).toBe(0);
  await page.evaluate(() => window.__releasePreferenceSave());
  await expect.poll(() => page.evaluate(() => window.__quitApplicationCalls)).toBe(1);
  expect(await page.evaluate(() => window.__mockAppPreferences.visualIntensity)).toBe(29);
});

test("RC range commit pointerup blur and window close flush pending preferences without debounce delay", async ({ page }) => {
  await bootWithTauriMock(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  for (const [index, eventType] of ["change", "pointerup", "blur"].entries()) {
    await page.getByRole("slider", { name: "视觉强度", exact: true }).evaluate((input, { value, eventType }) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event(eventType, { bubbles: true }));
    }, { value: 31 + index, eventType });
    await expect.poll(() => page.evaluate(() => window.__mockAppPreferences?.visualIntensity)).toBe(31 + index);
  }
  await page.evaluate(() => { window.__appPreferenceSavePlan = [{ hold: true }]; });
  await page.getByRole("slider", { name: "视觉强度", exact: true }).evaluate((input) => {
    input.value = "64";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof window.__releasePreferenceSave)).toBe("function");
  expect(await page.evaluate(() => window.__closeMainWindowCalls)).toBe(0);
  await page.evaluate(() => window.__releasePreferenceSave());
  await expect.poll(() => page.evaluate(() => window.__closeMainWindowCalls)).toBe(1);
  expect(await page.evaluate(() => window.__mockAppPreferences.visualIntensity)).toBe(64);
});

test("RC failed current-plan persistence aborts starting focus and preserves the error for retry", async ({ page }) => {
  await bootWithTauriMock(page, { autoMiniOnStart: true });
  await page.evaluate(() => { window.__failFocusPlanSave = true; });
  const start = page.locator(".continuity-board__card--current").getByRole("button", { name: "开始专注", exact: true });
  await start.click();
  await expect(page.locator(".app-message")).toContainText("模拟焦点计划保存失败");
  expect(await page.evaluate(() => window.__startTimerCalls)).toBe(0);
  expect(await page.evaluate(() => window.__miniWorkspaceShown)).toBe(false);
  expect(await page.evaluate(() => window.__getAppStateSyncPayload().timer.hasUnsubmittedProgress)).toBe(false);
  await page.evaluate(() => { window.__failFocusPlanSave = false; });
  await start.click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
});

test("RC mini custom audio sync fetches changed names once and clears removed audio", async ({ page }) => {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });
  await page.evaluate(() => {
    window.__playedAudio = [];
    window.Audio = class {
      constructor(url) { window.__playedAudio.push(url); }
      play() { return Promise.resolve(); }
    };
  });
  const syncAudio = (name, data, sequence) => page.evaluate(async ({ name, data, sequence }) => {
    const current = await window.__TAURI_INTERNALS__.invoke("get_app_preferences");
    await window.__TAURI_INTERNALS__.invoke("update_app_preferences", { preferences: { ...current, customAlertSoundName: name, customAlertSoundData: data } });
    await window.__TAURI_INTERNALS__.invoke("update_timer_preferences", { preferences: { ...window.__getAppStateSyncPayload().timerPreferences, alertSoundKey: "custom" } });
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
    // Wait until the metadata-triggered read resolves, then raise a real alert.
    await Promise.resolve();
    window.__replaceTimer({ alertSequence: sequence, alertKey: "stopwatch_reminder", alertTitle: "音频同步测试", alertMessage: "测试" });
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
  }, { name, data, sequence });
  await syncAudio("first.wav", "data:audio/wav;base64,Zmlyc3Q=", 1);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toContain("data:audio/wav;base64,Zmlyc3Q=");
  const reads = await page.evaluate(() => window.__appPreferenceReadCalls);
  await page.evaluate(async () => {
    for (let index = 0; index < 5; index += 1) await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
  });
  expect(await page.evaluate(() => window.__appPreferenceReadCalls)).toBe(reads);
  await syncAudio("second.wav", "data:audio/wav;base64,c2Vjb25k", 2);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual(["data:audio/wav;base64,Zmlyc3Q=", "data:audio/wav;base64,c2Vjb25k"]);
  await syncAudio("", null, 3);
  expect(await page.evaluate(() => window.__playedAudio)).toHaveLength(2);
  expect(await page.evaluate(() => window.__emittedStates.every((state) => !state.appPreferencesView.customAlertSoundData))).toBe(true);
});

async function bootAudioFingerprintMock(page) {
  await bootWithTauriMock(page, { windowLabel: "todo-float", pausedFocus: true });
  await expect.poll(() => page.evaluate(() => window.__appStateSyncReady)).toBe(true);
  await page.evaluate(async () => {
    const { audioFingerprint } = await import("/src/features/shell/audio-fingerprint.ts");
    window.__playedAudio = [];
    window.Audio = class {
      constructor(url) { window.__playedAudio.push(url); }
      play() { return Promise.resolve(); }
    };
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__heldAudioReads = [];
    window.__holdNextAudioRead = false;
    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      if (command === "get_app_preferences" && window.__holdNextAudioRead) {
        window.__holdNextAudioRead = false;
        const captured = structuredClone(await invoke(command, args));
        return new Promise((resolve) => window.__heldAudioReads.push(() => resolve(captured)));
      }
      return invoke(command, args);
    };
    window.__audioSync = async (data, { persist = true, legacy = false, sequence } = {}) => {
      if (persist) await invoke("update_app_preferences", { preferences: {
        ...window.__mockAppPreferences, customAlertSoundName: "same.wav", customAlertSoundData: data,
      } });
      await invoke("update_timer_preferences", { preferences: {
        ...window.__getAppStateSyncPayload().timerPreferences, alertSoundKey: "custom",
      } });
      if (sequence !== undefined) window.__replaceTimer({ alertSequence: sequence, alertKey: "stopwatch_reminder", alertTitle: "同名音频提醒", alertMessage: "测试" });
      const payload = window.__getAppStateSyncPayload();
      payload.appPreferencesView.customAlertSoundName = "same.wav";
      payload.appPreferencesView.hasCustomAlertSound = true;
      if (!legacy) payload.appPreferencesView.customAlertSoundFingerprint = audioFingerprint(data);
      await invoke("plugin:event|emit", { event: "app-state-sync", payload });
      // Drain the IPC promise handlers without advancing the application's polling clock.
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
  });
}

test("RC audio fingerprint replaces same-name content once and accepts legacy events", async ({ page }) => {
  await bootAudioFingerprintMock(page);
  const first = "data:audio/wav;base64,QQ==";
  const second = "data:audio/wav;base64,Qg==";
  await page.evaluate((data) => window.__audioSync(data, { sequence: 1, legacy: true }), first);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([first]);
  await page.evaluate((data) => window.__audioSync(data, { sequence: 2 }), second);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([first, second]);
  const reads = await page.evaluate(() => window.__appPreferenceReadCalls);
  await page.evaluate(async (data) => {
    for (let index = 0; index < 5; index += 1) await window.__audioSync(data, { persist: false, legacy: index % 2 === 0 });
  }, second);
  expect(await page.evaluate(() => window.__appPreferenceReadCalls)).toBe(reads);
  expect(await page.evaluate(() => window.__emittedStates.every((state) => !state.appPreferencesView.customAlertSoundData))).toBe(true);
});

test("RC audio fingerprint rejects late same-name reads and coalesces pending legacy snapshots", async ({ page }) => {
  await bootAudioFingerprintMock(page);
  const first = "data:audio/wav;base64,QQ==";
  const second = "data:audio/wav;base64,Qg==";
  await page.evaluate(async (data) => {
    window.__holdNextAudioRead = true;
    await window.__audioSync(data);
  }, first);
  await expect.poll(() => page.evaluate(() => window.__heldAudioReads.length)).toBe(1);
  const reads = await page.evaluate(() => window.__appPreferenceReadCalls);
  await page.evaluate(async (data) => {
    await window.__audioSync(data, { persist: false });
    await window.__audioSync(data, { persist: false, legacy: true });
  }, first);
  expect(await page.evaluate(() => window.__appPreferenceReadCalls)).toBe(reads);
  await page.evaluate((data) => window.__audioSync(data, { sequence: 1 }), second);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([second]);
  await page.evaluate(async () => {
    window.__heldAudioReads[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.__replaceTimer({ alertSequence: 2 });
    await window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "app-state-sync", payload: window.__getAppStateSyncPayload() });
  });
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([second, second]);
});

test("RC audio fingerprint rejects pre-save bytes then retries on committed broadcast", async ({ page }) => {
  await bootAudioFingerprintMock(page);
  const first = "data:audio/wav;base64,QQ==";
  const second = "data:audio/wav;base64,Qg==";
  await page.evaluate((data) => window.__audioSync(data, { sequence: 1 }), first);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([first]);
  const reads = await page.evaluate(() => window.__appPreferenceReadCalls);
  await page.evaluate((data) => window.__audioSync(data, { persist: false, sequence: 2 }), second);
  expect(await page.evaluate(() => window.__appPreferenceReadCalls)).toBe(reads + 1);
  expect(await page.evaluate(() => window.__playedAudio)).toEqual([first]);
  await page.evaluate((data) => window.__audioSync(data, { sequence: 2 }), second);
  await expect.poll(() => page.evaluate(() => window.__playedAudio)).toEqual([first, second]);
  expect(await page.evaluate(() => window.__appPreferenceReadCalls)).toBe(reads + 2);
});
