<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  
  // Props
  interface Props {
    workMinutes: number;
    onComplete?: (minutes: number, challengeCompleted: boolean) => void;
    onTipChange?: (tip: string) => void;
  }
  
  let { workMinutes, onComplete, onTipChange }: Props = $props();
  
  // 状态
  let secondsLeft = $state(workMinutes * 60);
  let isRunning = $state(false);
  let startedAt = $state<number | null>(null);
  let tickInterval: number | null = null;
  
  // 挑战系统
  const CHALLENGES = [
    { id: "c1", title: "【资源采集】专注期间不切到其它窗口", reward: "+100 合成玉" },
    { id: "c2", title: "【紧急委托】本轮不允许暂停", reward: "+150 合成玉" },
    { id: "c3", title: "【情报收集】结束后写一句作战总结", reward: "+200 龙门币" },
    { id: "c4", title: "【后勤支援】完成后立刻处理一个待办", reward: "+50 合成玉 +100 龙门币" },
  ];
  
  let currentChallenge = $state<typeof CHALLENGES[0] | null>(null);
  let challengeBroken = $state(false);
  
  // 格式化时间显示
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
  
  // 随机选择挑战
  function selectChallenge() {
    currentChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    challengeBroken = false;
  }
  
  // 开始番茄钟
  export function start() {
    if (isRunning) return;
    
    // 自动选择挑战
    if (!currentChallenge) {
      selectChallenge();
    }
    
    isRunning = true;
    startedAt = Date.now();
    
    if (onTipChange) {
      onTipChange(`番茄钟开始！专注 ${workMinutes} 分钟`);
    }
    
    // 清除旧的定时器
    if (tickInterval !== null) {
      clearInterval(tickInterval);
    }
    
    // 启动倒计时
    tickInterval = window.setInterval(() => {
      secondsLeft -= 1;
      
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        finish(true);
      }
    }, 1000);
  }
  
  // 暂停
  export function pause() {
    if (!isRunning) return;
    
    isRunning = false;
    
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    
    if (onTipChange) {
      onTipChange("番茄钟已暂停");
    }
  }
  
  // 重置
  export function reset() {
    isRunning = false;
    startedAt = null;
    secondsLeft = workMinutes * 60;
    challengeBroken = true;
    
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    
    if (onTipChange) {
      onTipChange("番茄钟已重置，委托失败");
    }
  }
  
  // 跳过
  export function skip() {
    challengeBroken = true;
    finish(false);
  }
  
  // 完成
  function finish(completed: boolean) {
    isRunning = false;
    
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    
    const challengeCompleted = currentChallenge && !challengeBroken && completed;
    
    if (onComplete) {
      onComplete(workMinutes, challengeCompleted);
    }
    
    // 重置状态
    startedAt = null;
    secondsLeft = workMinutes * 60;
    currentChallenge = null;
    challengeBroken = false;
  }
  
  // 响应 workMinutes 变化
  $effect(() => {
    if (!isRunning) {
      secondsLeft = workMinutes * 60;
    }
  });
</script>

<div class="pomodoro-timer">
  <div class="timer-display">
    <p class="timer-label">番茄钟模式</p>
    <p class="timer-clock">{formatTime(secondsLeft)}</p>
  </div>
  
  {#if currentChallenge}
    <div class="challenge-box">
      <h4>作战委托</h4>
      <p class="challenge-title">{currentChallenge.title}</p>
      <small class="challenge-reward">奖励：{currentChallenge.reward}</small>
      <p class="challenge-status">
        {challengeBroken ? "❌ 委托失败" : isRunning ? "⏳ 委托进行中..." : "✅ 准备就绪"}
      </p>
    </div>
  {:else}
    <div class="challenge-box">
      <p class="challenge-hint">开始专注时自动接取委托</p>
    </div>
  {/if}
  
  <div class="timer-controls">
    <button onclick={start} disabled={isRunning}>开始</button>
    <button onclick={pause} disabled={!isRunning}>暂停</button>
    <button onclick={reset}>重置</button>
    <button onclick={skip}>跳过</button>
  </div>
</div>

<style>
  .pomodoro-timer {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .timer-display {
    text-align: center;
  }
  
  .timer-label {
    margin: 0;
    font-size: 14px;
    color: #725444;
  }
  
  .timer-clock {
    margin: 8px 0;
    font-size: 64px;
    font-family: "JetBrains Mono", monospace;
    font-weight: 600;
  }
  
  .challenge-box {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    padding: 16px;
    border: 2px solid rgba(0, 152, 220, 0.3);
  }
  
  .challenge-box h4 {
    margin: 0 0 8px 0;
    color: #1e1a16;
  }
  
  .challenge-title {
    font-weight: 600;
    color: #1e1a16;
    margin: 8px 0;
  }
  
  .challenge-reward {
    color: #ff9944;
    font-weight: 600;
  }
  
  .challenge-status {
    margin: 12px 0 0 0;
    padding: 8px;
    background: rgba(0, 152, 220, 0.1);
    border-radius: 8px;
    font-size: 13px;
    text-align: center;
  }
  
  .challenge-hint {
    color: #725444;
    margin: 0;
    text-align: center;
  }
  
  .timer-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .timer-controls button {
    padding: 12px;
    border: 1px solid #1e1a16;
    border-radius: 12px;
    background: #fff;
    color: #1e1a16;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .timer-controls button:hover:not(:disabled) {
    background: #1e1a16;
    color: #fff;
  }
  
  .timer-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
