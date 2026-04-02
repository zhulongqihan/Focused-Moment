<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { onMount } from "svelte";
  import '$lib/styles/arknights-theme.css';

  type Todo = {
    id: string;
    title: string;
    done: boolean;
    createdAt: number;
    completedAt?: number;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    pomodoroCount?: number;
  };

  type FocusSession = {
    id: string;
    startAt: number;
    endAt: number;
    minutes: number;
    mode: "work" | "break";
    completed: boolean;
    isBoss: boolean;
    challengeId?: string;
    challengePassed?: boolean;
  };

  type VisitLog = {
    id: string;
    url: string;
    domain: string;
    createdAt: number;
    whitelisted: boolean;
    softWarned: boolean;
  };

  type AppSettings = {
    workMinutes: number;
    breakMinutes: number;
    dailyGoal: number;
    whitelist: string[];
  };

  type Challenge = {
    id: string;
    title: string;
    reward: string;
  };

  type Achievement = {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    unlockedAt?: number;
  };

  const STORAGE_KEY = "focused_moment_v1";
  const CHALLENGES: Challenge[] = [
    { id: "c1", title: "专注期间不切到其它窗口", reward: "+20 宠物经验" },
    { id: "c2", title: "本轮不允许暂停", reward: "+15 宠物经验" },
    { id: "c3", title: "结束后写一句今日最清醒的话", reward: "Boss 积分 +1" },
    { id: "c4", title: "完成后立刻处理一个待办", reward: "今日金币 +30" },
    { id: "c5", title: "连续完成3个番茄不休息", reward: "+50 宠物经验" },
    { id: "c6", title: "在凌晨时段完成番茄", reward: "夜猫子徽章" },
  ];

  const DAILY_QUOTES = [
    "专注是通往心流的唯一道路。",
    "每一个番茄钟，都是对拖延症的一次胜利。",
    "不要让分心成为你的常态。",
    "今天的专注，是明天的成就。",
    "量子仓鼠在看着你，别让它失望。",
    "Boss战即将开启，准备好了吗？",
    "专注不是天赋，而是选择。",
    "走神污染指数正在下降...",
    "你的大脑值得更好的待遇。",
    "专注时刻，城市修复中...",
  ];

  const ACHIEVEMENTS: Achievement[] = [
    { id: "a1", title: "初次专注", description: "完成第一个番茄钟", unlocked: false },
    { id: "a2", title: "专注新手", description: "累计完成10个番茄钟", unlocked: false },
    { id: "a3", title: "专注达人", description: "累计完成50个番茄钟", unlocked: false },
    { id: "a4", title: "专注大师", description: "累计完成100个番茄钟", unlocked: false },
    { id: "a5", title: "Boss杀手", description: "完成10次Boss番茄", unlocked: false },
    { id: "a6", title: "挑战者", description: "成功完成20次挑战", unlocked: false },
    { id: "a7", title: "宠物培养师", description: "宠物达到10级", unlocked: false },
    { id: "a8", title: "待办清道夫", description: "单日完成10个待办", unlocked: false },
    { id: "a9", title: "连击王", description: "连续7天完成每日目标", unlocked: false },
    { id: "a10", title: "夜猫子", description: "在凌晨2-5点完成番茄", unlocked: false },
  ];

  const DEFAULT_SETTINGS: AppSettings = {
    workMinutes: 25,
    breakMinutes: 5,
    dailyGoal: 6,
    whitelist: ["docs", "wikipedia.org", "github.com", "developer.mozilla.org"],
  };

  let activeTab = $state<"focus" | "todo" | "stats" | "web" | "pet" | "achievements">("focus");

  let settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  let todos = $state<Todo[]>([]);
  let sessions = $state<FocusSession[]>([]);
  let visitLogs = $state<VisitLog[]>([]);

  let timerSecondsLeft = $state(DEFAULT_SETTINGS.workMinutes * 60);
  let timerRunning = $state(false);
  let timerMode = $state<"work" | "break">("work");
  let timerCountMode = $state<"countdown" | "countup">("countdown"); // 倒计时或正向计时
  let timerStartedAt = $state<number | null>(null);
  let timerTickRef: number | null = null;
  let selectedChallenge = $state<Challenge | null>(null);
  let challengeBroken = $state(false);

  let petLevel = $state(1);
  let petXp = $state(0);
  let bossPoints = $state(0);
  let achievements = $state<Achievement[]>([...ACHIEVEMENTS]);
  let dailyQuote = $state("");
  let consecutiveDays = $state(0);
  let lastActiveDate = $state<string | null>(null);

  let todoInput = $state("");
  let todoPriority = $state<"low" | "medium" | "high">("medium");
  let todoTags = $state("");
  let todoFilter = $state<"all" | "active" | "done">("all");
  let statsView = $state<"today" | "week" | "month" | "all">("today");
  let urlInput = $state("https://");
  let whitelistInput = $state("");
  let focusNote = $state("");
  let currentTip = $state("准备好了吗？今天把分心雾霾清掉。");
  let hydrated = false;
  let saveTimerRef: number | null = null;

  function nowId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function applyPersistedState(parsed: Record<string, unknown>) {
    settings = (parsed.settings as AppSettings) ?? { ...DEFAULT_SETTINGS };
    todos = (parsed.todos as Todo[]) ?? [];
    sessions = (parsed.sessions as FocusSession[]) ?? [];
    visitLogs = (parsed.visitLogs as VisitLog[]) ?? [];
    petLevel = Number(parsed.petLevel ?? 1);
    petXp = Number(parsed.petXp ?? 0);
    bossPoints = Number(parsed.bossPoints ?? 0);
    focusNote = String(parsed.focusNote ?? "");
    achievements = (parsed.achievements as Achievement[]) ?? [...ACHIEVEMENTS];
    consecutiveDays = Number(parsed.consecutiveDays ?? 0);
    lastActiveDate = (parsed.lastActiveDate as string) ?? null;
    timerSecondsLeft = settings.workMinutes * 60;
    
    checkDailyStreak();
    dailyQuote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
  }

  async function saveState() {
    const data = {
      settings,
      todos,
      sessions,
      visitLogs,
      petLevel,
      petXp,
      bossPoints,
      focusNote,
      achievements,
      consecutiveDays,
      lastActiveDate,
    };
    const payload = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, payload);
    await invoke("save_app_state", { payload });
  }

  function scheduleSave() {
    if (!hydrated) {
      return;
    }
    if (saveTimerRef !== null) {
      window.clearTimeout(saveTimerRef);
    }
    saveTimerRef = window.setTimeout(() => {
      void saveState();
    }, 200);
  }

  async function loadState() {
    try {
      const persisted = await invoke<string | null>("load_app_state");
      if (persisted) {
        const parsed = JSON.parse(persisted) as Record<string, unknown>;
        applyPersistedState(parsed);
        hydrated = true;
        return;
      }
    } catch {
      // Fall back to localStorage migration path.
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      hydrated = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      applyPersistedState(parsed);
      hydrated = true;
      await saveState();
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      hydrated = true;
    }
  }

  function formatClock(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function todayWorkSessionsCount(): number {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return sessions.filter(
      (session) =>
        session.mode === "work" && session.completed && session.startAt >= dayStart.getTime()
    ).length;
  }

  function isBossRound(): boolean {
    return timerMode === "work" && todayWorkSessionsCount() + 1 >= settings.dailyGoal;
  }

  function spinChallenge() {
    selectedChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    challengeBroken = false;
    currentTip = `今日挑战：${selectedChallenge.title}`;
  }

  function addTodo() {
    const title = todoInput.trim();
    if (!title) {
      return;
    }
    const tags = todoTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    todos = [
      {
        id: nowId("todo"),
        title,
        done: false,
        createdAt: Date.now(),
        priority: todoPriority,
        tags: tags.length > 0 ? tags : undefined,
        pomodoroCount: 0,
      },
      ...todos,
    ];
    todoInput = "";
    todoTags = "";
    todoPriority = "medium";
    scheduleSave();
  }

  function toggleTodo(id: string) {
    todos = todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }
      const done = !todo.done;
      return {
        ...todo,
        done,
        completedAt: done ? Date.now() : undefined,
      };
    });
    currentTip = "任务触发城市修复事件：东区路灯恢复供电。";
    scheduleSave();
  }

  function removeTodo(id: string) {
    todos = todos.filter((todo) => todo.id !== id);
    scheduleSave();
  }

  function clearCompletedTodos() {
    todos = todos.filter((todo) => !todo.done);
    currentTip = "已清除所有已完成任务。";
    scheduleSave();
  }

  function filteredTodos(): Todo[] {
    if (todoFilter === "active") return todos.filter((t) => !t.done);
    if (todoFilter === "done") return todos.filter((t) => t.done);
    return todos;
  }

  function priorityColor(priority?: string): string {
    if (priority === "high") return "#ff4444";
    if (priority === "medium") return "#ff9944";
    return "#44aa44";
  }

  function applyWorkSettings() {
    if (timerRunning) {
      return;
    }
    timerSecondsLeft = (timerMode === "work" ? settings.workMinutes : settings.breakMinutes) * 60;
    scheduleSave();
  }

  function clearTick() {
    if (timerTickRef !== null) {
      window.clearInterval(timerTickRef);
      timerTickRef = null;
    }
  }

  function finishSession(completed: boolean) {
    if (timerStartedAt === null) {
      return;
    }

    const bossRound = isBossRound();
    sessions = [
      {
        id: nowId("session"),
        startAt: timerStartedAt,
        endAt: Date.now(),
        minutes: timerMode === "work" ? settings.workMinutes : settings.breakMinutes,
        mode: timerMode,
        completed,
        isBoss: bossRound,
        challengeId: selectedChallenge?.id,
        challengePassed: selectedChallenge ? !challengeBroken && completed : undefined,
      },
      ...sessions,
    ];

    if (timerMode === "work" && completed) {
      const gain = bossRound ? 35 : 20;
      petXp += gain;
      if (selectedChallenge && !challengeBroken) {
        petXp += 20;
      }

      while (petXp >= petLevel * 100) {
        petXp -= petLevel * 100;
        petLevel += 1;
        currentTip = `🎊 宠物升级！现在是 Lv.${petLevel}`;
      }

      if (bossRound) {
        bossPoints += 1;
        currentTip = "Boss 番茄击破，迷雾核心塔恢复 3%！";
      } else {
        currentTip = "专注成功，赛博宠物获得经验值。";
      }

      playNotificationSound();
      checkAchievements();
    }

    timerRunning = false;
    timerStartedAt = null;
    clearTick();
    timerMode = timerMode === "work" ? "break" : "work";
    timerSecondsLeft = (timerMode === "work" ? settings.breakMinutes : settings.workMinutes) * 60;
    selectedChallenge = null;
    challengeBroken = false;
    scheduleSave();
  }

  function startTimer() {
    if (!selectedChallenge && timerMode === "work") {
      spinChallenge();
    }
    if (timerRunning) {
      return;
    }

    timerRunning = true;
    timerStartedAt = Date.now();
    clearTick();

    timerTickRef = window.setInterval(() => {
      if (timerCountMode === "countdown") {
        // 倒计时模式
        timerSecondsLeft -= 1;
        if (timerSecondsLeft <= 0) {
          finishSession(true);
        }
      } else {
        // 正向计时模式
        timerSecondsLeft += 1;
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!timerRunning) {
      return;
    }
    timerRunning = false;
    challengeBroken = true;
    clearTick();
    scheduleSave();
  }

  function resetTimer() {
    timerRunning = false;
    clearTick();
    challengeBroken = true;
    timerStartedAt = null;
    timerSecondsLeft = (timerMode === "work" ? settings.workMinutes : settings.breakMinutes) * 60;
    scheduleSave();
  }

  function skipSession() {
    challengeBroken = true;
    finishSession(false);
  }

  function extractDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function isWhitelisted(domain: string): boolean {
    return settings.whitelist.some((item) => domain.includes(item.toLowerCase()));
  }

  async function openLearningUrl() {
    const domain = extractDomain(urlInput);
    if (!domain) {
      currentTip = "链接无效，请输入完整 URL。";
      return;
    }

    const whitelisted = isWhitelisted(domain);
    const softWarned = !whitelisted;
    if (softWarned) {
      const yes = window.confirm(
        "该网站不在学习白名单中。继续打开将记录一次诱惑事件，是否继续？"
      );
      if (!yes) {
        return;
      }
    }

    visitLogs = [
      {
        id: nowId("visit"),
        url: urlInput,
        domain,
        createdAt: Date.now(),
        whitelisted,
        softWarned,
      },
      ...visitLogs,
    ];

    await openUrl(urlInput);
    currentTip = whitelisted
      ? "学习资料已打开，保持专注。"
      : "已放行并记录一次偏航，请尽快回到任务轨道。";
    scheduleSave();
  }

  function addWhitelist() {
    const value = whitelistInput.trim().toLowerCase();
    if (!value || settings.whitelist.includes(value)) {
      return;
    }
    settings = {
      ...settings,
      whitelist: [...settings.whitelist, value],
    };
    whitelistInput = "";
    scheduleSave();
  }

  function removeWhitelist(item: string) {
    settings = {
      ...settings,
      whitelist: settings.whitelist.filter((value) => value !== item),
    };
    scheduleSave();
  }

  function totalFocusedMinutes(): number {
    return sessions
      .filter((session) => session.mode === "work" && session.completed)
      .reduce((total, session) => total + session.minutes, 0);
  }

  function completedTodosCount(): number {
    return todos.filter((todo) => todo.done).length;
  }

  function getStatsTimeRange(): [number, number] {
    const now = Date.now();
    if (statsView === "today") {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      return [dayStart.getTime(), now];
    }
    if (statsView === "week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return [weekStart.getTime(), now];
    }
    if (statsView === "month") {
      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);
      return [monthStart.getTime(), now];
    }
    return [0, now];
  }

  function getStatsFocusMinutes(): number {
    const [start, end] = getStatsTimeRange();
    return sessions
      .filter((s) => s.mode === "work" && s.completed && s.startAt >= start && s.startAt <= end)
      .reduce((total, s) => total + s.minutes, 0);
  }

  function getStatsCompletedSessions(): number {
    const [start, end] = getStatsTimeRange();
    return sessions.filter(
      (s) => s.mode === "work" && s.completed && s.startAt >= start && s.startAt <= end
    ).length;
  }

  function getStatsCompletedTodos(): number {
    const [start, end] = getStatsTimeRange();
    return todos.filter(
      (t) => t.done && t.completedAt && t.completedAt >= start && t.completedAt <= end
    ).length;
  }

  function getStatsTotalTodos(): number {
    const [start, end] = getStatsTimeRange();
    return todos.filter((t) => t.createdAt >= start && t.createdAt <= end).length;
  }

  function getStatsCompletionRate(): number {
    const [start, end] = getStatsTimeRange();
    const total = sessions.filter(
      (s) => s.mode === "work" && s.startAt >= start && s.startAt <= end
    ).length;
    const completed = sessions.filter(
      (s) => s.mode === "work" && s.completed && s.startAt >= start && s.startAt <= end
    ).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  function getStatsBossWins(): number {
    const [start, end] = getStatsTimeRange();
    return sessions.filter(
      (s) => s.isBoss && s.completed && s.startAt >= start && s.startAt <= end
    ).length;
  }

  function getStatsChallengeSuccess(): number {
    const [start, end] = getStatsTimeRange();
    return sessions.filter(
      (s) => s.challengePassed && s.startAt >= start && s.startAt <= end
    ).length;
  }

  function getStatsInterruptions(): number {
    const [start, end] = getStatsTimeRange();
    return sessions.filter(
      (s) => s.mode === "work" && !s.completed && s.startAt >= start && s.startAt <= end
    ).length;
  }

  function getRecentSessions(): FocusSession[] {
    const [start, end] = getStatsTimeRange();
    return sessions
      .filter((s) => s.startAt >= start && s.startAt <= end)
      .slice(0, 10);
  }

  function formatSessionTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
  }

  function checkDailyStreak() {
    const today = new Date().toDateString();
    if (lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastActiveDate === yesterday.toDateString()) {
        consecutiveDays += 1;
      } else if (lastActiveDate !== null) {
        consecutiveDays = 1;
      } else {
        consecutiveDays = 1;
      }
      lastActiveDate = today;
      scheduleSave();
    }
  }

  function checkAchievements() {
    const totalCompleted = sessions.filter((s) => s.mode === "work" && s.completed).length;
    const bossWins = sessions.filter((s) => s.isBoss && s.completed).length;
    const challengeWins = sessions.filter((s) => s.challengePassed).length;
    const todayCompleted = getStatsCompletedTodos();

    const checks = [
      { id: "a1", condition: totalCompleted >= 1 },
      { id: "a2", condition: totalCompleted >= 10 },
      { id: "a3", condition: totalCompleted >= 50 },
      { id: "a4", condition: totalCompleted >= 100 },
      { id: "a5", condition: bossWins >= 10 },
      { id: "a6", condition: challengeWins >= 20 },
      { id: "a7", condition: petLevel >= 10 },
      { id: "a8", condition: todayCompleted >= 10 },
      { id: "a9", condition: consecutiveDays >= 7 },
      { id: "a10", condition: sessions.some((s) => {
        const hour = new Date(s.startAt).getHours();
        return s.completed && hour >= 2 && hour < 5;
      }) },
    ];

    let newUnlock = false;
    achievements = achievements.map((ach) => {
      const check = checks.find((c) => c.id === ach.id);
      if (check && check.condition && !ach.unlocked) {
        newUnlock = true;
        currentTip = `🎉 成就解锁：${ach.title}`;
        return { ...ach, unlocked: true, unlockedAt: Date.now() };
      }
      return ach;
    });

    if (newUnlock) {
      scheduleSave();
    }
  }

  function getUnlockedAchievements(): Achievement[] {
    return achievements.filter((a) => a.unlocked);
  }

  function playNotificationSound() {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0vBSh+zPDajzsKElyx6OyrWBUIQ5zd8sFuJAUuhM/z24k2CBhku+zooVARC0yl4fG5ZRwFNo3V7859LwUofsz");
      audio.volume = 0.3;
      audio.play();
    } catch {
      // Ignore audio errors
    }
  }

  function getHeatmapData(): Array<{ label: string; count: number }> {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      
      const count = sessions.filter(
        (s) => s.mode === "work" && s.completed && s.startAt >= dayStart && s.startAt < dayEnd
      ).length;
      
      const label = i === 0 ? "今" : `${date.getMonth() + 1}/${date.getDate()}`;
      result.push({ label, count });
    }
    return result;
  }

  function getHeatmapColor(count: number): string {
    if (count === 0) return "#f0f0f0";
    if (count <= 2) return "#c6e48b";
    if (count <= 4) return "#7bc96f";
    if (count <= 6) return "#239a3b";
    return "#196127";
  }

  function focusHeatLabel(): string {
    const today = todayWorkSessionsCount();
    if (today >= settings.dailyGoal) return "晴空喷射流";
    if (today >= Math.floor(settings.dailyGoal / 2)) return "多云稳态";
    return "电子沙尘暴";
  }

  async function exportData() {
    try {
      const filePath = await invoke<string>("export_app_state");
      currentTip = `备份成功！文件保存在：${filePath}`;
    } catch (error) {
      currentTip = `导出失败：${error}`;
    }
  }

  async function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await invoke("import_app_state", { payload: text });
        await loadState();
        currentTip = "数据导入成功！页面即将刷新...";
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        currentTip = `导入失败：${error}`;
      }
    };
    input.click();
  }

  async function toggleTimerWidget() {
    try {
      await invoke("toggle_timer_widget");
    } catch (error) {
      currentTip = `打开计时器失败：${error}`;
    }
  }

  async function toggleTodoWidget() {
    try {
      await invoke("toggle_todo_widget");
    } catch (error) {
      currentTip = `打开待办清单失败：${error}`;
    }
  }

  onMount(() => {
    void loadState();
    return () => clearTick();
  });
</script>

<main class="shell ark-border originium-texture">
  <!-- 罗德岛装饰角 -->
  <div class="ornament-corner ornament-top-left"></div>
  <div class="ornament-corner ornament-top-right"></div>
  <div class="ornament-corner ornament-bottom-left"></div>
  <div class="ornament-corner ornament-bottom-right"></div>

  <header class="headline">
    <div>
      <p class="eyebrow">Focused Moment</p>
      <h1>走神污染治理局</h1>
      <p class="subtitle">本地存储模式已启用。你的数据不会上传云端。</p>
    </div>
    <div class="goal-chip">
      <span>今日进度</span>
      <strong>{todayWorkSessionsCount()} / {settings.dailyGoal}</strong>
    </div>
  </header>

  <nav class="tabs">
    <button class:active={activeTab === "focus"} onclick={() => (activeTab = "focus")}>番茄战场</button>
    <button class:active={activeTab === "todo"} onclick={() => (activeTab = "todo")}>待办舱</button>
    <button class:active={activeTab === "stats"} onclick={() => (activeTab = "stats")}>统计星图</button>
    <button class:active={activeTab === "web"} onclick={() => (activeTab = "web")}>资料航道</button>
    <button class:active={activeTab === "pet"} onclick={() => (activeTab = "pet")}>赛博宠物</button>
    <button class:active={activeTab === "achievements"} onclick={() => (activeTab = "achievements")}>成就殿堂</button>
  </nav>

  <div class="daily-quote">
    <span class="quote-icon">💭</span>
    <p>{dailyQuote}</p>
  </div>

  {#if activeTab === "focus"}
    <section class="panel panel-focus">
      <div class="timer-box ark-border originium-texture">
        <!-- 罗德岛装饰 -->
        <div class="ornament-corner ornament-top-left"></div>
        <div class="ornament-corner ornament-top-right"></div>
        
        <p class="mode">{timerMode === "work" ? "专注回合" : "恢复回合"}</p>
        <p class="clock">{formatClock(timerSecondsLeft)}</p>
        <p class="boss">{isBossRound() && timerMode === "work" ? "Boss 回合：开启" : "普通回合"}</p>
        
        <!-- 计时模式切换 -->
        <div class="timer-mode-switch">
          <button 
            class:active={timerCountMode === "countdown"} 
            onclick={() => { timerCountMode = "countdown"; resetTimer(); }}
            class="mode-btn"
          >
            ⏱️ 倒计时
          </button>
          <button 
            class:active={timerCountMode === "countup"} 
            onclick={() => { timerCountMode = "countup"; timerSecondsLeft = 0; resetTimer(); }}
            class="mode-btn"
          >
            ⏲️ 正向计时
          </button>
        </div>
        
        <div class="controls">
          <button onclick={startTimer}>开始</button>
          <button onclick={pauseTimer}>暂停</button>
          <button onclick={resetTimer}>重置</button>
          <button onclick={skipSession}>跳过</button>
        </div>
      </div>

      <div class="challenge-box ark-border originium-texture">
        <!-- 罗德岛装饰 -->
        <div class="ornament-corner ornament-top-left"></div>
        <div class="ornament-corner ornament-top-right"></div>
        
        <h3>反拖延轮盘</h3>
        <p>{selectedChallenge ? selectedChallenge.title : "点击抽取挑战后开始番茄。"}</p>
        <small>{selectedChallenge ? selectedChallenge.reward : "奖励将在专注成功后结算"}</small>
        <div class="controls">
          <button onclick={spinChallenge}>抽挑战</button>
        </div>
      </div>

      <div class="settings-box ark-border originium-texture">
        <!-- 罗德岛装饰 -->
        <div class="ornament-corner ornament-bottom-left"></div>
        <div class="ornament-corner ornament-bottom-right"></div>
        
        <h3>计时设置</h3>
        <label>
          专注分钟
          <input type="number" min="10" max="90" bind:value={settings.workMinutes} onchange={applyWorkSettings} />
        </label>
        <label>
          休息分钟
          <input type="number" min="3" max="30" bind:value={settings.breakMinutes} onchange={applyWorkSettings} />
        </label>
        <label>
          每日目标番茄
          <input type="number" min="1" max="16" bind:value={settings.dailyGoal} onchange={scheduleSave} />
        </label>
      </div>
    </section>
  {/if}

  {#if activeTab === "todo"}
    <section class="panel">
      <div class="todo-add">
        <input placeholder="输入待办，例如：整理线代笔记" bind:value={todoInput} />
        <select bind:value={todoPriority}>
          <option value="low">低优先级</option>
          <option value="medium">中优先级</option>
          <option value="high">高优先级</option>
        </select>
        <input placeholder="标签（逗号分隔）" bind:value={todoTags} />
        <button onclick={addTodo}>添加任务</button>
      </div>

      <div class="todo-filters">
        <button class:active={todoFilter === "all"} onclick={() => (todoFilter = "all")}>全部</button>
        <button class:active={todoFilter === "active"} onclick={() => (todoFilter = "active")}>进行中</button>
        <button class:active={todoFilter === "done"} onclick={() => (todoFilter = "done")}>已完成</button>
        <button class="ghost" onclick={clearCompletedTodos}>清除已完成</button>
      </div>

      <ul class="todo-list">
        {#each filteredTodos() as todo (todo.id)}
          <li class:done={todo.done}>
            <label>
              <input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo.id)} />
              <div class="todo-content">
                <span class="todo-title">{todo.title}</span>
                {#if todo.tags && todo.tags.length > 0}
                  <div class="todo-tags">
                    {#each todo.tags as tag}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            </label>
            <div class="todo-meta">
              {#if todo.priority}
                <span class="priority-dot" style="background: {priorityColor(todo.priority)}"></span>
              {/if}
              <button class="ghost" onclick={() => removeTodo(todo.id)}>删除</button>
            </div>
          </li>
        {/each}
        {#if filteredTodos().length === 0}
          <li class="empty">暂无待办，先加一个最重要的任务。</li>
        {/if}
      </ul>
    </section>
  {/if}

  {#if activeTab === "stats"}
    <section class="panel">
      <div class="stats-tabs">
        <button class:active={statsView === "today"} onclick={() => (statsView = "today")}>今日</button>
        <button class:active={statsView === "week"} onclick={() => (statsView = "week")}>本周</button>
        <button class:active={statsView === "month"} onclick={() => (statsView = "month")}>本月</button>
        <button class:active={statsView === "all"} onclick={() => (statsView = "all")}>全部</button>
      </div>

      <div class="stats-grid">
        <article class="stat-card">
          <h3>专注时长</h3>
          <p class="metric">{getStatsFocusMinutes()} 分钟</p>
        </article>
        <article class="stat-card">
          <h3>完成番茄</h3>
          <p class="metric">{getStatsCompletedSessions()}</p>
        </article>
        <article class="stat-card">
          <h3>完成待办</h3>
          <p class="metric">{getStatsCompletedTodos()} / {getStatsTotalTodos()}</p>
        </article>
        <article class="stat-card">
          <h3>完成率</h3>
          <p class="metric">{getStatsCompletionRate()}%</p>
        </article>
        <article class="stat-card">
          <h3>Boss 胜场</h3>
          <p class="metric">{getStatsBossWins()}</p>
        </article>
        <article class="stat-card">
          <h3>挑战成功</h3>
          <p class="metric">{getStatsChallengeSuccess()}</p>
        </article>
        <article class="stat-card">
          <h3>心流天气</h3>
          <p class="metric">{focusHeatLabel()}</p>
        </article>
        <article class="stat-card">
          <h3>中断次数</h3>
          <p class="metric">{getStatsInterruptions()}</p>
        </article>

        <article class="stat-wide">
          <h3>专注热力图（最近7天）</h3>
          <div class="heatmap">
            {#each getHeatmapData() as day}
              <div class="heatmap-day" style="background: {getHeatmapColor(day.count)}">
                <span class="heatmap-label">{day.label}</span>
                <span class="heatmap-count">{day.count}</span>
              </div>
            {/each}
          </div>
        </article>

        <article class="stat-wide">
          <h3>专注留言</h3>
          <textarea bind:value={focusNote} placeholder="写下一句今天最清醒的话" onblur={scheduleSave}></textarea>
        </article>

        <article class="stat-wide">
          <h3>最近专注记录</h3>
          <ul class="session-history">
            {#each getRecentSessions() as session}
              <li>
                <span class="session-time">{formatSessionTime(session.startAt)}</span>
                <span class="session-mode">{session.mode === "work" ? "专注" : "休息"}</span>
                <span class="session-duration">{session.minutes}分钟</span>
                <span class="session-status" class:completed={session.completed}>
                  {session.completed ? "✓ 完成" : "✗ 中断"}
                </span>
                {#if session.isBoss}
                  <span class="boss-badge">Boss</span>
                {/if}
              </li>
            {/each}
          </ul>
        </article>
      </div>
    </section>
  {/if}

  {#if activeTab === "web"}
    <section class="panel">
      <div class="todo-add">
        <input bind:value={urlInput} placeholder="https://example.com" />
        <button onclick={openLearningUrl}>打开资料</button>
      </div>

      <h3>学习白名单</h3>
      <div class="todo-add">
        <input bind:value={whitelistInput} placeholder="输入域名关键字，例如 arxiv.org" />
        <button onclick={addWhitelist}>加入白名单</button>
      </div>

      <ul class="chips">
        {#each settings.whitelist as item}
          <li>
            <span>{item}</span>
            <button class="ghost" onclick={() => removeWhitelist(item)}>移除</button>
          </li>
        {/each}
      </ul>

      <h3>最近访问</h3>
      <ul class="logs">
        {#each visitLogs.slice(0, 8) as log}
          <li>
            <strong>{log.domain}</strong>
            <span>{log.whitelisted ? "白名单" : "软提醒放行"}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if activeTab === "pet"}
    <section class="panel pet-panel">
      <div class="pet-avatar">
        <span>◉</span>
      </div>
      <h3>量子仓鼠 Mk-{petLevel}</h3>
      <p>等级 {petLevel} · 当前经验 {petXp}/{petLevel * 100}</p>
      <div class="pet-stats">
        <div class="pet-stat">
          <span>Boss胜场</span>
          <strong>{bossPoints}</strong>
        </div>
        <div class="pet-stat">
          <span>连续天数</span>
          <strong>{consecutiveDays}</strong>
        </div>
        <div class="pet-stat">
          <span>成就数</span>
          <strong>{getUnlockedAchievements().length}/{achievements.length}</strong>
        </div>
      </div>
      <p class="tip">{currentTip}</p>
      
      <div class="backup-controls">
        <h3>数据备份</h3>
        <div class="controls">
          <button onclick={exportData}>导出备份</button>
          <button onclick={importData}>导入备份</button>
        </div>
      </div>
    </section>
  {/if}

  {#if activeTab === "achievements"}
    <section class="panel">
      <h2>成就殿堂</h2>
      <p class="subtitle">已解锁 {getUnlockedAchievements().length} / {achievements.length} 个成就</p>
      
      <div class="achievements-grid">
        {#each achievements as achievement}
          <article class="achievement-card" class:unlocked={achievement.unlocked}>
            <div class="achievement-icon">
              {achievement.unlocked ? "🏆" : "🔒"}
            </div>
            <h3>{achievement.title}</h3>
            <p>{achievement.description}</p>
            {#if achievement.unlocked && achievement.unlockedAt}
              <small>解锁于 {new Date(achievement.unlockedAt).toLocaleDateString()}</small>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: "Space Grotesk", "Noto Sans SC", "PingFang SC", sans-serif;
    background: radial-gradient(circle at 0% 0%, #ffe9c9 0%, #f6f5ef 55%, #ece8df 100%);
    color: #1e1a16;
  }

  .shell {
    min-height: 100vh;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1100px;
    margin: 0 auto;
    position: relative;
  }

  /* 主容器的罗德岛装饰 - 更明显 */
  .shell .ornament-corner {
    position: absolute;
    width: 80px;
    height: 80px;
    pointer-events: none;
    z-index: 10;
  }

  .shell .ornament-corner::before,
  .shell .ornament-corner::after {
    content: '';
    position: absolute;
    background: linear-gradient(135deg, #0098DC 0%, #FFB800 100%);
    opacity: 0.8;
  }

  .shell .ornament-top-left::before {
    width: 60px;
    height: 3px;
    top: 15px;
    left: 0;
  }

  .shell .ornament-top-left::after {
    width: 3px;
    height: 60px;
    top: 0;
    left: 15px;
  }

  .shell .ornament-top-right::before {
    width: 60px;
    height: 3px;
    top: 15px;
    right: 0;
  }

  .shell .ornament-top-right::after {
    width: 3px;
    height: 60px;
    top: 0;
    right: 15px;
  }

  .shell .ornament-bottom-left::before {
    width: 60px;
    height: 3px;
    bottom: 15px;
    left: 0;
  }

  .shell .ornament-bottom-left::after {
    width: 3px;
    height: 60px;
    bottom: 0;
    left: 15px;
  }

  .shell .ornament-bottom-right::before {
    width: 60px;
    height: 3px;
    bottom: 15px;
    right: 0;
  }

  .shell .ornament-bottom-right::after {
    width: 3px;
    height: 60px;
    bottom: 0;
    right: 15px;
  }

  /* 面板内的装饰 - 更小更精致 */
  .timer-box .ornament-corner,
  .challenge-box .ornament-corner,
  .settings-box .ornament-corner {
    width: 40px;
    height: 40px;
  }

  .timer-box .ornament-corner::before,
  .timer-box .ornament-corner::after,
  .challenge-box .ornament-corner::before,
  .challenge-box .ornament-corner::after,
  .settings-box .ornament-corner::before,
  .settings-box .ornament-corner::after {
    background: #0098DC;
    opacity: 0.6;
  }

  .timer-box .ornament-top-left::before,
  .challenge-box .ornament-top-left::before,
  .settings-box .ornament-bottom-left::before {
    width: 30px;
    height: 2px;
    top: 8px;
    left: 0;
  }

  .timer-box .ornament-top-left::after,
  .challenge-box .ornament-top-left::after,
  .settings-box .ornament-bottom-left::after {
    width: 2px;
    height: 30px;
    top: 0;
    left: 8px;
  }

  .timer-box .ornament-top-right::before,
  .challenge-box .ornament-top-right::before,
  .settings-box .ornament-bottom-right::before {
    width: 30px;
    height: 2px;
    top: 8px;
    right: 0;
  }

  .timer-box .ornament-top-right::after,
  .challenge-box .ornament-top-right::after,
  .settings-box .ornament-bottom-right::after {
    width: 2px;
    height: 30px;
    top: 0;
    right: 8px;
  }

  .settings-box .ornament-bottom-left::before {
    bottom: 8px;
    top: auto;
  }

  .settings-box .ornament-bottom-left::after {
    bottom: 0;
    top: auto;
  }

  .settings-box .ornament-bottom-right::before {
    bottom: 8px;
    top: auto;
  }

  .settings-box .ornament-bottom-right::after {
    bottom: 0;
    top: auto;
  }

  .headline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid rgba(30, 26, 22, 0.12);
    border-radius: 18px;
    padding: 16px;
    backdrop-filter: blur(8px);
    position: relative;
  }

  .widget-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .widget-controls .ark-button {
    padding: 8px 16px;
    font-size: 13px;
    white-space: nowrap;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 12px;
    color: #80513a;
  }

  h1 {
    margin: 2px 0;
    font-size: 28px;
  }

  .subtitle {
    margin: 0;
    color: #5b4a3f;
    font-size: 14px;
  }

  .goal-chip {
    min-width: 130px;
    text-align: center;
    background: #111;
    color: #fff;
    border-radius: 14px;
    padding: 12px;
  }

  .goal-chip span {
    display: block;
    font-size: 12px;
    opacity: 0.8;
  }

  .goal-chip strong {
    font-size: 24px;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
  }

  .tabs button,
  .controls button,
  .todo-add button,
  .ghost {
    border: 1px solid #1e1a16;
    border-radius: 12px;
    background: #fff;
    color: #1e1a16;
    padding: 10px 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.active {
    background: #1e1a16;
    color: #fff;
  }

  .panel {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 18px;
    border: 1px solid rgba(30, 26, 22, 0.12);
    padding: 16px;
  }

  .panel-focus {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 12px;
  }

  .timer-box,
  .challenge-box,
  .settings-box {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 14px;
    padding: 20px;
    border: 2px solid rgba(0, 152, 220, 0.3);
    position: relative;
    box-shadow: 0 4px 12px rgba(0, 152, 220, 0.1);
  }

  /* 计时模式切换按钮 */
  .timer-mode-switch {
    display: flex;
    gap: 8px;
    margin: 12px 0;
    justify-content: center;
  }

  .mode-btn {
    padding: 8px 16px;
    border: 2px solid rgba(0, 152, 220, 0.3);
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.3s ease;
  }

  .mode-btn:hover {
    background: rgba(0, 152, 220, 0.1);
    border-color: rgba(0, 152, 220, 0.6);
  }

  .mode-btn.active {
    background: linear-gradient(135deg, #0098DC 0%, #33AADF 100%);
    border-color: #0098DC;
    color: white;
    font-weight: bold;
    box-shadow: 0 0 15px rgba(0, 152, 220, 0.4);
  }

  .mode,
  .boss {
    margin: 0;
    color: #725444;
  }

  .clock {
    margin: 4px 0 8px;
    font-size: 64px;
    font-family: "JetBrains Mono", monospace;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .settings-box label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 14px;
  }

  input,
  textarea {
    border: 1px solid rgba(30, 26, 22, 0.2);
    border-radius: 10px;
    padding: 10px;
    font-size: 14px;
    background: #fffdf8;
  }

  .todo-add {
    display: grid;
    grid-template-columns: 2fr auto 1fr auto;
    gap: 8px;
    margin-bottom: 12px;
  }

  .todo-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .todo-filters button {
    padding: 6px 12px;
    font-size: 13px;
  }

  .todo-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .todo-title {
    font-weight: 500;
  }

  .todo-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 11px;
    background: #ff9944;
    color: #fff;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .todo-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .priority-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .stats-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .stats-tabs button {
    padding: 8px 16px;
    font-size: 14px;
  }

  .session-history {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .session-history li {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px;
    background: #fffdf8;
    border-radius: 8px;
    font-size: 13px;
  }

  .session-time {
    color: #725444;
    min-width: 80px;
  }

  .session-mode {
    min-width: 40px;
  }

  .session-duration {
    min-width: 50px;
  }

  .session-status {
    color: #ff4444;
  }

  .session-status.completed {
    color: #44aa44;
  }

  .boss-badge {
    background: #ff4444;
    color: #fff;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .backup-controls {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(30, 26, 22, 0.1);
  }

  .backup-controls h3 {
    margin-bottom: 10px;
  }

  .daily-quote {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 14px;
    border: 1px solid rgba(30, 26, 22, 0.12);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .quote-icon {
    font-size: 24px;
  }

  .daily-quote p {
    margin: 0;
    font-style: italic;
    color: #614a3e;
  }

  .pet-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 16px 0;
  }

  .pet-stat {
    background: #fffdf8;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
    border: 1px solid rgba(30, 26, 22, 0.1);
  }

  .pet-stat span {
    display: block;
    font-size: 12px;
    color: #725444;
    margin-bottom: 4px;
  }

  .pet-stat strong {
    font-size: 20px;
    font-family: "JetBrains Mono", monospace;
  }

  .achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .achievement-card {
    background: #fff;
    border: 1px solid rgba(30, 26, 22, 0.1);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    transition: transform 0.2s;
  }

  .achievement-card.unlocked {
    background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
    border-color: #ff9944;
  }

  .achievement-card:hover {
    transform: translateY(-2px);
  }

  .achievement-icon {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .achievement-card h3 {
    margin: 8px 0 4px;
    font-size: 16px;
  }

  .achievement-card p {
    margin: 0;
    font-size: 13px;
    color: #725444;
  }

  .achievement-card small {
    display: block;
    margin-top: 8px;
    font-size: 11px;
    color: #80513a;
  }

  .heatmap {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-top: 12px;
  }

  .heatmap-day {
    aspect-ratio: 1;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(30, 26, 22, 0.1);
    transition: transform 0.2s;
  }

  .heatmap-day:hover {
    transform: scale(1.1);
  }

  .heatmap-label {
    font-size: 11px;
    color: #614a3e;
  }

  .heatmap-count {
    font-size: 18px;
    font-weight: 600;
    font-family: "JetBrains Mono", monospace;
  }

  .todo-list,
  .chips,
  .logs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .todo-list li,
  .chips li,
  .logs li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border: 1px solid rgba(30, 26, 22, 0.1);
    border-radius: 10px;
    padding: 10px;
    gap: 10px;
  }

  .todo-list li.done span {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .empty {
    color: #6d5b4f;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-card,
  .stat-wide {
    background: #fff;
    border: 1px solid rgba(30, 26, 22, 0.1);
    border-radius: 12px;
    padding: 12px;
  }

  .stat-wide {
    grid-column: 1 / -1;
  }

  .metric {
    font-size: 28px;
    margin: 6px 0 0;
    font-family: "JetBrains Mono", monospace;
  }

  textarea {
    min-height: 90px;
    width: 100%;
    box-sizing: border-box;
  }

  .pet-panel {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pet-avatar {
    margin: 0 auto;
    width: 86px;
    height: 86px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: conic-gradient(from 0deg, #ff8a3d, #ffc14a, #ff8a3d);
    color: #fff;
    font-size: 40px;
    animation: orbit 5s linear infinite;
  }

  .tip {
    color: #614a3e;
  }

  @keyframes orbit {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 900px) {
    .panel-focus {
      grid-template-columns: 1fr;
    }

    .tabs {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .achievements-grid {
      grid-template-columns: 1fr;
    }

    .todo-add {
      grid-template-columns: 1fr;
    }
  }
</style>
