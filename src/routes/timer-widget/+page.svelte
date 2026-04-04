<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { selectRandomBoss } from '$lib/utils/operator';

  let minutes = 25;
  let seconds = 0;
  let isRunning = false;
  let mode: 'work' | 'break' = 'work';
  let interval: number | null = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let currentBossName = '';
  let dailyGoal = 4; // 默认每日目标
  let workSessionsCount = 0;

  const appWindow = getCurrentWebviewWindow();

  onMount(() => {
    // 加载保存的状态
    loadTimerState();
    loadSettings();
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  async function loadSettings() {
    try {
      const state = await invoke('load_app_state');
      if (state) {
        const data = JSON.parse(state as string);
        if (data.settings) {
          dailyGoal = data.settings.dailyGoal || 4;
        }
        if (data.workSessionsCount !== undefined) {
          workSessionsCount = data.workSessionsCount;
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  async function loadTimerState() {
    try {
      const state = await invoke('load_app_state');
      if (state) {
        const data = JSON.parse(state as string);
        if (data.timerWidget) {
          minutes = data.timerWidget.minutes || 25;
          seconds = data.timerWidget.seconds || 0;
          mode = data.timerWidget.mode || 'work';
        }
      }
    } catch (e) {
      console.error('Failed to load timer state:', e);
    }
  }

  async function saveTimerState() {
    try {
      const state = await invoke('load_app_state');
      const data = state ? JSON.parse(state as string) : {};
      data.timerWidget = { minutes, seconds, mode };
      await invoke('save_app_state', { payload: JSON.stringify(data) });
    } catch (e) {
      console.error('Failed to save timer state:', e);
    }
  }

  function isBossRound(): boolean {
    return mode === 'work' && workSessionsCount + 1 >= dailyGoal;
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    
    // 如果是Boss回合，选择一个随机Boss名称
    if (isBossRound()) {
      currentBossName = selectRandomBoss();
    }
    
    interval = setInterval(() => {
      if (seconds === 0) {
        if (minutes === 0) {
          // 计时结束
          stopTimer();
          playSound();
          if (mode === 'work') {
            workSessionsCount++;
            mode = 'break';
            minutes = 5;
          } else {
            mode = 'work';
            minutes = 25;
          }
          return;
        }
        minutes--;
        seconds = 59;
      } else {
        seconds--;
      }
      saveTimerState();
    }, 1000);
  }

  function stopTimer() {
    isRunning = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    minutes = mode === 'work' ? 25 : 5;
    seconds = 0;
    saveTimerState();
  }

  function playSound() {
    // 播放提示音
    const audio = new Audio('/sounds/timer-end.mp3');
    audio.play().catch(() => {});
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragOffset = {
      x: e.clientX,
      y: e.clientY
    };
  }

  async function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragOffset.x;
    const deltaY = e.clientY - dragOffset.y;
    
    const position = await appWindow.outerPosition();
    await appWindow.setPosition({
      x: position.x + deltaX,
      y: position.y + deltaY
    });
  }

  function handleMouseUp() {
    isDragging = false;
  }

  $: timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  $: modeText = mode === 'work' ? '专注' : '休息';
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="timer-widget ark-card originium-texture">
  <!-- 装饰角 -->
  <div class="ornament-corner ornament-top-left"></div>
  <div class="ornament-corner ornament-top-right"></div>
  <div class="ornament-corner ornament-bottom-left"></div>
  <div class="ornament-corner ornament-bottom-right"></div>

  <!-- 拖拽区域 -->
  <div class="drag-handle" on:mousedown={handleMouseDown} role="button" tabindex="0">
    <span class="ark-badge {mode === 'work' ? '' : 'gold'}">{modeText}模式</span>
  </div>

  <!-- Boss 回合显示 -->
  {#if isBossRound() && mode === 'work'}
    <div class="boss-name ark-badge gold">
      Boss 回合：{currentBossName || "开启"}
    </div>
  {:else}
    <div class="round-type">普通回合</div>
  {/if}

  <!-- 计时显示 -->
  <div class="timer-display ark-title">
    {timeDisplay}
  </div>

  <!-- 控制按钮 -->
  <div class="controls">
    {#if !isRunning}
      <button class="ark-button" on:click={startTimer}>开始</button>
    {:else}
      <button class="ark-button" on:click={stopTimer}>暂停</button>
    {/if}
    <button class="ark-button" on:click={resetTimer}>重置</button>
  </div>

  <!-- 源石粒子效果 -->
  {#if isRunning}
    <div class="originium-particle" style="left: 20%; animation-delay: 0s;"></div>
    <div class="originium-particle" style="left: 50%; animation-delay: 1s;"></div>
    <div class="originium-particle" style="left: 80%; animation-delay: 2s;"></div>
  {/if}
</div>

<style>
  @import '$lib/styles/arknights-theme.css';

  .timer-widget {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: rgba(26, 26, 26, 0.95);
    backdrop-filter: blur(10px);
    user-select: none;
  }

  .drag-handle {
    cursor: move;
    padding: 4px 0;
    width: 100%;
    text-align: center;
  }

  .boss-name {
    font-size: 14px;
    font-weight: bold;
    padding: 4px 12px;
    text-align: center;
    animation: pulse 2s ease-in-out infinite;
  }

  .round-type {
    font-size: 12px;
    color: var(--ark-text-secondary);
    text-align: center;
    padding: 4px 0;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      text-shadow: 0 0 10px var(--ark-gold);
    }
    50% {
      opacity: 0.8;
      text-shadow: 0 0 20px var(--ark-gold);
    }
  }

  .timer-display {
    font-size: 36px;
    font-weight: bold;
    letter-spacing: 4px;
    text-shadow: 0 0 20px var(--ark-accent-glow);
  }

  .controls {
    display: flex;
    gap: 8px;
  }

  .ark-button {
    padding: 6px 16px;
    font-size: 12px;
  }
</style>
