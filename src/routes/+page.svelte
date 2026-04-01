<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";

  type Todo = {
    id: string;
    title: string;
    done: boolean;
    createdAt: number;
    completedAt?: number;
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

  const STORAGE_KEY = "focused_moment_v1";
  const CHALLENGES: Challenge[] = [
    { id: "c1", title: "专注期间不切到其它窗口", reward: "+20 宠物经验" },
    { id: "c2", title: "本轮不允许暂停", reward: "+15 宠物经验" },
    { id: "c3", title: "结束后写一句今日最清醒的话", reward: "Boss 积分 +1" },
    { id: "c4", title: "完成后立刻处理一个待办", reward: "今日金币 +30" },
  ];

  const DEFAULT_SETTINGS: AppSettings = {
    workMinutes: 25,
    breakMinutes: 5,
    dailyGoal: 6,
    whitelist: ["docs", "wikipedia.org", "github.com", "developer.mozilla.org"],
  };

  let activeTab = $state<"focus" | "todo" | "stats" | "web" | "pet">("focus");

  let settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  let todos = $state<Todo[]>([]);
  let sessions = $state<FocusSession[]>([]);
  let visitLogs = $state<VisitLog[]>([]);

  let timerSecondsLeft = $state(DEFAULT_SETTINGS.workMinutes * 60);
  let timerRunning = $state(false);
  let timerMode = $state<"work" | "break">("work");
  let timerStartedAt = $state<number | null>(null);
  let timerTickRef: number | null = null;
  let selectedChallenge = $state<Challenge | null>(null);
  let challengeBroken = $state(false);

  let petLevel = $state(1);
  let petXp = $state(0);
  let bossPoints = $state(0);

  let todoInput = $state("");
  let urlInput = $state("https://");
  let whitelistInput = $state("");
  let focusNote = $state("");
  let currentTip = $state("准备好了吗？今天把分心雾霾清掉。");

  function nowId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function saveState() {
    const data = {
      settings,
      todos,
      sessions,
      visitLogs,
      petLevel,
      petXp,
      bossPoints,
      focusNote,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      settings = parsed.settings ?? { ...DEFAULT_SETTINGS };
      todos = parsed.todos ?? [];
      sessions = parsed.sessions ?? [];
      visitLogs = parsed.visitLogs ?? [];
      petLevel = parsed.petLevel ?? 1;
      petXp = parsed.petXp ?? 0;
      bossPoints = parsed.bossPoints ?? 0;
      focusNote = parsed.focusNote ?? "";
      timerSecondsLeft = settings.workMinutes * 60;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
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
    todos = [
      {
        id: nowId("todo"),
        title,
        done: false,
        createdAt: Date.now(),
      },
      ...todos,
    ];
    todoInput = "";
    saveState();
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
    saveState();
  }

  function removeTodo(id: string) {
    todos = todos.filter((todo) => todo.id !== id);
    saveState();
  }

  function applyWorkSettings() {
    if (timerRunning) {
      return;
    }
    timerSecondsLeft = (timerMode === "work" ? settings.workMinutes : settings.breakMinutes) * 60;
    saveState();
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
      }

      if (bossRound) {
        bossPoints += 1;
        currentTip = "Boss 番茄击破，迷雾核心塔恢复 3%！";
      } else {
        currentTip = "专注成功，赛博宠物获得经验值。";
      }
    }

    timerRunning = false;
    timerStartedAt = null;
    clearTick();
    timerMode = timerMode === "work" ? "break" : "work";
    timerSecondsLeft = (timerMode === "work" ? settings.breakMinutes : settings.workMinutes) * 60;
    selectedChallenge = null;
    challengeBroken = false;
    saveState();
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
      timerSecondsLeft -= 1;
      if (timerSecondsLeft <= 0) {
        finishSession(true);
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
    saveState();
  }

  function resetTimer() {
    timerRunning = false;
    clearTick();
    challengeBroken = true;
    timerStartedAt = null;
    timerSecondsLeft = (timerMode === "work" ? settings.workMinutes : settings.breakMinutes) * 60;
    saveState();
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
    saveState();
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
    saveState();
  }

  function removeWhitelist(item: string) {
    settings = {
      ...settings,
      whitelist: settings.whitelist.filter((value) => value !== item),
    };
    saveState();
  }

  function totalFocusedMinutes(): number {
    return sessions
      .filter((session) => session.mode === "work" && session.completed)
      .reduce((total, session) => total + session.minutes, 0);
  }

  function completedTodosCount(): number {
    return todos.filter((todo) => todo.done).length;
  }

  function focusHeatLabel(): string {
    const today = todayWorkSessionsCount();
    if (today >= settings.dailyGoal) return "晴空喷射流";
    if (today >= Math.floor(settings.dailyGoal / 2)) return "多云稳态";
    return "电子沙尘暴";
  }

  $effect(() => {
    loadState();
    return () => clearTick();
  });
</script>

<main class="shell">
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
  </nav>

  {#if activeTab === "focus"}
    <section class="panel panel-focus">
      <div class="timer-box">
        <p class="mode">{timerMode === "work" ? "专注回合" : "恢复回合"}</p>
        <p class="clock">{formatClock(timerSecondsLeft)}</p>
        <p class="boss">{isBossRound() && timerMode === "work" ? "Boss 回合：开启" : "普通回合"}</p>
        <div class="controls">
          <button onclick={startTimer}>开始</button>
          <button onclick={pauseTimer}>暂停</button>
          <button onclick={resetTimer}>重置</button>
          <button onclick={skipSession}>跳过</button>
        </div>
      </div>

      <div class="challenge-box">
        <h3>反拖延轮盘</h3>
        <p>{selectedChallenge ? selectedChallenge.title : "点击抽取挑战后开始番茄。"}</p>
        <small>{selectedChallenge ? selectedChallenge.reward : "奖励将在专注成功后结算"}</small>
        <div class="controls">
          <button onclick={spinChallenge}>抽挑战</button>
        </div>
      </div>

      <div class="settings-box">
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
          <input type="number" min="1" max="16" bind:value={settings.dailyGoal} onchange={saveState} />
        </label>
      </div>
    </section>
  {/if}

  {#if activeTab === "todo"}
    <section class="panel">
      <div class="todo-add">
        <input placeholder="输入待办，例如：整理线代笔记" bind:value={todoInput} />
        <button onclick={addTodo}>添加任务</button>
      </div>

      <ul class="todo-list">
        {#each todos as todo (todo.id)}
          <li class:done={todo.done}>
            <label>
              <input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo.id)} />
              <span>{todo.title}</span>
            </label>
            <button class="ghost" onclick={() => removeTodo(todo.id)}>删除</button>
          </li>
        {/each}
        {#if todos.length === 0}
          <li class="empty">暂无待办，先加一个最重要的任务。</li>
        {/if}
      </ul>
    </section>
  {/if}

  {#if activeTab === "stats"}
    <section class="panel stats-grid">
      <article class="stat-card">
        <h3>累计专注时长</h3>
        <p class="metric">{totalFocusedMinutes()} 分钟</p>
      </article>
      <article class="stat-card">
        <h3>完成待办</h3>
        <p class="metric">{completedTodosCount()} / {todos.length}</p>
      </article>
      <article class="stat-card">
        <h3>Boss 胜场</h3>
        <p class="metric">{bossPoints}</p>
      </article>
      <article class="stat-card">
        <h3>心流天气</h3>
        <p class="metric">{focusHeatLabel()}</p>
      </article>

      <article class="stat-wide">
        <h3>专注留言</h3>
        <textarea bind:value={focusNote} placeholder="写下一句今天最清醒的话" onblur={saveState}></textarea>
      </article>
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
      <p class="tip">{currentTip}</p>
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
    grid-template-columns: repeat(5, minmax(0, 1fr));
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
    background: #fff;
    border-radius: 14px;
    padding: 14px;
    border: 1px solid rgba(30, 26, 22, 0.1);
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
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 12px;
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
