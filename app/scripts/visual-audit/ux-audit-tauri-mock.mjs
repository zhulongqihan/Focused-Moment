async (page) => {
  await page.addInitScript(() => {
    const storageKey = "ux-audit.mock-state";
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterdayDate = new Date(`${todayKey}T12:00:00`);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;
    const ago = (days) => {
      const value = new Date(`${todayKey}T12:00:00`);
      value.setDate(value.getDate() - days);
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    };
    const formatDuration = (durationMs) => {
      const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    };
    const baseState = {
      todos: [
        { id: 1, title: "写完产品复盘", isCompleted: false, scheduledDate: todayKey, scheduledTime: "10:00", importanceKey: "high" },
        { id: 2, title: "整理研究资料", isCompleted: false, scheduledDate: yesterday, scheduledTime: "", importanceKey: "medium" },
        { id: 3, title: "准备下一轮用户访谈材料", isCompleted: false, scheduledDate: todayKey, scheduledTime: "15:30", importanceKey: "low" },
        { id: 4, title: "归档本周会议纪要", isCompleted: true, scheduledDate: todayKey, scheduledTime: "08:30", importanceKey: "low" },
      ],
      records: [
        { id: 3, title: "完成产品复盘", durationMs: 45 * 60 * 1000, durationLabel: "00:45:00", modeKey: "stopwatch", modeLabel: "正向计时", phaseLabel: "正向计时", linkedTodoId: 1, linkedTodoTitle: "写完产品复盘", completedAt: `${todayKey}T11:30:00`, completedDate: todayKey, completedTime: "11:30" },
        { id: 2, title: "整理研究资料", durationMs: 30 * 60 * 1000, durationLabel: "00:30:00", modeKey: "countdown", modeLabel: "倒计时", phaseLabel: "倒计时", linkedTodoId: null, linkedTodoTitle: null, completedAt: `${yesterday}T22:40:00`, completedDate: yesterday, completedTime: "22:40" },
        { id: 1, title: "阅读行业报告", durationMs: 15 * 60 * 1000, durationLabel: "00:15:00", modeKey: "stopwatch", modeLabel: "正向计时", phaseLabel: "正向计时", linkedTodoId: null, linkedTodoTitle: null, completedAt: `${ago(2)}T21:10:00`, completedDate: ago(2), completedTime: "21:10" },
      ],
      timer: {
        modeKey: "stopwatch", phaseKey: "stopwatch", mode: "正向计时", phaseLabel: "正向计时", status: "待开始", isRunning: false,
        elapsedMs: 0, elapsedLabel: "00:00:00", targetDurationMs: 25 * 60 * 1000, remainingMs: null, secondaryLabel: "已累计时长",
        canCompleteSession: true, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, currentRound: 1,
        completedFocusCount: 0, completedBreakCount: 0, recoveredFromLastSession: false, modeSwitchLocked: false, modeSwitchHint: null,
        alertSequence: 0, alertKey: null, alertTitle: null, alertMessage: null, startedAt: null,
      },
      preferences: { pomodoroFocusMinutes: 25, pomodoroBreakMinutes: 5, stopwatchReminderMinutes: 25, toastReminderEnabled: true, windowAttentionReminderEnabled: true, soundReminderEnabled: true, alertSoundKey: "soft_chime" },
      backups: [],
    };
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch (_) {
      stored = null;
    }
    let state = stored && stored.todos && stored.records && stored.timer ? stored : baseState;
    const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
    const timerSnapshot = () => {
      const timer = { ...state.timer };
      if (timer.isRunning && timer.startedAt) {
        const elapsedMs = timer.elapsedMs + Math.max(0, Date.now() - timer.startedAt);
        timer.elapsedMs = elapsedMs;
        timer.elapsedLabel = formatDuration(elapsedMs);
        if (timer.modeKey === "countdown" && timer.targetDurationMs !== null) {
          timer.remainingMs = Math.max(0, timer.targetDurationMs - elapsedMs);
          if (timer.remainingMs === 0) {
            timer.isRunning = false;
            timer.status = "已结束";
            timer.startedAt = null;
            timer.alertSequence += 1;
            timer.alertKey = "countdown_complete";
            timer.alertTitle = "倒计时已结束";
            timer.alertMessage = `倒计时已完成，已累计专注 ${Math.round(elapsedMs / 60000)} 分钟。点击“保存并记录”后写入专注记录。`;
          }
        }
      }
      return timer;
    };
    const applyTimer = (patch) => {
      state.timer = { ...state.timer, ...patch };
      save();
      return timerSnapshot();
    };
    const analytics = () => {
      const pendingTodoCount = state.todos.filter((item) => !item.isCompleted).length;
      const completedTodoCount = state.todos.filter((item) => item.isCompleted).length;
      const dailyBreakdown = Array.from({ length: 7 }, (_, index) => {
        const date = ago(6 - index);
        const daysRecords = state.records.filter((record) => record.completedDate === date);
        const totalDurationMs = daysRecords.reduce((total, record) => total + record.durationMs, 0);
        return {
          date,
          totalDurationMs,
          totalDurationLabel: formatDuration(totalDurationMs),
          sessionCount: daysRecords.length,
          linkedSessionCount: daysRecords.filter((record) => record.linkedTodoId !== null).length,
          independentSessionCount: daysRecords.filter((record) => record.linkedTodoId === null).length,
        };
      });
      const totalFocusDurationMs = state.records.reduce((total, record) => total + record.durationMs, 0);
      const todayRecords = state.records.filter((record) => record.completedDate === todayKey);
      const activeDays = dailyBreakdown.filter((day) => day.totalDurationMs > 0).length;
      return {
        totalFocusDurationMs,
        totalFocusDurationLabel: formatDuration(totalFocusDurationMs),
        sessionCount: state.records.length,
        linkedSessionCount: state.records.filter((record) => record.linkedTodoId !== null).length,
        independentSessionCount: state.records.filter((record) => record.linkedTodoId === null).length,
        pendingTodoCount,
        completedTodoCount,
        activeDays,
        averageDailyDurationLabel: formatDuration(activeDays ? totalFocusDurationMs / activeDays : 0),
        todayFocusDurationLabel: formatDuration(todayRecords.reduce((total, record) => total + record.durationMs, 0)),
        todaySessionCount: todayRecords.length,
        currentStreakDays: activeDays,
        bestFocusDate: dailyBreakdown.reduce((best, day) => day.totalDurationMs > (best?.totalDurationMs || 0) ? day : best, null)?.date || null,
        bestFocusDurationLabel: formatDuration(Math.max(0, ...dailyBreakdown.map((day) => day.totalDurationMs))),
        dailyBreakdown,
      };
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    let callbackId = 0;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      transformCallback: (callback) => { callbackId += 1; window[`__uxAuditCallback${callbackId}`] = callback; return callbackId; },
      invoke: async (command, args = {}) => {
        switch (command) {
          case "plugin:event|listen": return 1;
          case "plugin:event|unlisten": return null;
          case "get_timer_snapshot": return timerSnapshot();
          case "get_timer_preferences": return state.preferences;
          case "get_todo_items": return state.todos;
          case "get_focus_records": return state.records;
          case "get_analytics_snapshot": return analytics();
          case "list_app_backups": return state.backups;
          case "update_timer_preferences": state.preferences = args.preferences; save(); return state.preferences;
          case "switch_timer_mode": {
            const countdown = args.mode === "countdown";
            return applyTimer({ modeKey: args.mode, phaseKey: args.mode, mode: countdown ? "倒计时" : "正向计时", phaseLabel: countdown ? "倒计时" : "正向计时", targetDurationMs: countdown ? 25 * 60 * 1000 : null, remainingMs: countdown ? 25 * 60 * 1000 : null, secondaryLabel: countdown ? "本轮剩余时间" : "已累计时长" });
          }
          case "set_countdown_minutes": return applyTimer({ targetDurationMs: Number(args.minutes) * 60 * 1000, remainingMs: Number(args.minutes) * 60 * 1000 });
          case "update_timer_context": return applyTimer({ activeTaskTitle: args.title || "", linkedTodoId: args.linkedTodoId ?? null, completeLinkedTodoOnFinish: Boolean(args.completeLinkedTodoOnFinish) });
          case "start_timer": return applyTimer({ isRunning: true, status: state.timer.modeKey === "countdown" ? "倒计时中" : "正向计时中", startedAt: Date.now() });
          case "pause_timer": {
            const snapshot = timerSnapshot();
            return applyTimer({ ...snapshot, isRunning: false, status: "已暂停", startedAt: null });
          }
          case "reset_timer": return applyTimer({ status: "待开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:00:00", remainingMs: state.timer.modeKey === "countdown" ? state.timer.targetDurationMs : null, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, recoveredFromLastSession: false, alertKey: null, alertTitle: null, alertMessage: null, startedAt: null });
          case "acknowledge_timer_alert": return applyTimer({ alertKey: null, alertTitle: null, alertMessage: null });
          case "complete_focus_session": {
            const snapshot = timerSnapshot();
            const durationMs = snapshot.elapsedMs;
            const nextId = Math.max(0, ...state.records.map((record) => record.id)) + 1;
            state.records = [...state.records, { id: nextId, title: args.title || snapshot.activeTaskTitle || "未命名事项", durationMs, durationLabel: formatDuration(durationMs), modeKey: snapshot.modeKey, modeLabel: snapshot.mode, phaseLabel: snapshot.phaseLabel, linkedTodoId: snapshot.linkedTodoId, linkedTodoTitle: snapshot.linkedTodoId === null ? null : state.todos.find((item) => item.id === snapshot.linkedTodoId)?.title || null, completedAt: `${todayKey}T12:00:00`, completedDate: todayKey, completedTime: "12:00" }];
            if (snapshot.completeLinkedTodoOnFinish && snapshot.linkedTodoId !== null) state.todos = state.todos.map((item) => item.id === snapshot.linkedTodoId ? { ...item, isCompleted: true } : item);
            const reset = { ...state.timer, status: "未开始", isRunning: false, elapsedMs: 0, elapsedLabel: "00:00:00", remainingMs: state.timer.modeKey === "countdown" ? state.timer.targetDurationMs : null, activeTaskTitle: "", linkedTodoId: null, completeLinkedTodoOnFinish: false, recoveredFromLastSession: false, alertKey: null, alertTitle: null, alertMessage: null, startedAt: null };
            state.timer = reset;
            save();
            return { timerSnapshot: timerSnapshot(), records: state.records, todoItems: state.todos };
          }
          case "create_todo_item": {
            const nextId = Math.max(0, ...state.todos.map((item) => item.id)) + 1;
            state.todos = [...state.todos, { id: nextId, title: args.title, isCompleted: false, scheduledDate: args.scheduledDate, scheduledTime: args.scheduledTime || "", importanceKey: args.importanceKey || "medium" }];
            save();
            return state.todos;
          }
          case "update_todo_item": state.todos = state.todos.map((item) => item.id === args.id ? { ...item, title: args.title, scheduledDate: args.scheduledDate, scheduledTime: args.scheduledTime || "", importanceKey: args.importanceKey } : item); save(); return state.todos;
          case "toggle_todo_item": state.todos = state.todos.map((item) => item.id === args.id ? { ...item, isCompleted: !item.isCompleted } : item); save(); return state.todos;
          case "delete_todo_item": state.todos = state.todos.filter((item) => item.id !== args.id); save(); return state.todos;
          case "restore_todo_item": state.todos = [...state.todos, args.item]; save(); return state.todos;
          case "update_focus_record_title": state.records = state.records.map((record) => record.id === args.id ? { ...record, title: args.title } : record); save(); return state.records;
          case "delete_focus_record": state.records = state.records.filter((record) => record.id !== args.id); save(); return state.records;
          case "delete_focus_records": state.records = state.records.filter((record) => !args.ids.includes(record.id)); save(); return state.records;
          case "restore_focus_record": state.records = [...state.records, args.record]; save(); return state.records;
          case "export_app_backup": {
            const fileName = `focused-moment-backup-ux-${Date.now()}.json`;
            state.backups = [{ fileName, exportedAt: new Date().toISOString(), appVersion: "2.10.9", formatVersion: 1, schemaVersion: 1, migrationNeeded: false, focusRecordCount: state.records.length, todoCount: state.todos.length, hasRuntimeSession: timerSnapshot().elapsedMs > 0 }, ...state.backups];
            save();
            return { fileName, filePath: `F:\\Focused Moment\\${fileName}`, exportedAt: new Date().toISOString() };
          }
          case "import_app_backup": return { importedFileName: args.fileName || "mock-backup.json", rollbackFileName: "mock-rollback.json", focusRecordCount: state.records.length, todoCount: state.todos.length, restoredRuntimeSession: timerSnapshot().elapsedMs > 0, migratedFromFormatVersion: null };
          case "clear_app_data": state.todos = []; state.records = []; state.timer = { ...baseState.timer }; save(); return null;
          case "open_app_backup_folder": return null;
          case "show_floating_todos":
          case "lock_floating_todos":
          case "unlock_floating_todos":
          case "restore_main_from_floating_todos":
          case "show_focus_floating":
          case "lock_focus_floating":
          case "unlock_focus_floating":
          case "restore_main_from_focus_floating":
          case "minimize_main_window":
          case "maximize_main_window":
          case "close_main_window":
          case "quit_application":
          case "show_main_window_from_tray":
          case "flash_main_window_attention":
          case "start_dragging_main_window": return null;
          default:
            if (command.startsWith("plugin:window|")) return command.includes("scale_factor") ? 1 : null;
            return null;
        }
      },
    };
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
}
