<script lang="ts">
  // Props
  interface Props {
    onComplete?: (minutes: number) => void;
    onTipChange?: (tip: string) => void;
  }
  
  let { onComplete, onTipChange }: Props = $props();
  
  // 状态
  let seconds = $state(0);
  let isRunning = $state(false);
  let startedAt = $state<number | null>(null);
  let tickInterval: number | null = null;
  
  // 格式化时间显示
  function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
  
  // 开始计时
  export function start() {
    if (isRunning) return;
    
    isRunning = true;
    startedAt = Date.now();
    
    if (onTipChange) {
      onTipChange("正向计时开始！");
    }
    
    // 清除旧的定时器
    if (tickInterval !== null) {
      clearInterval(tickInterval);
    }
    
    // 启动正向计时
    tickInterval = window.setInterval(() => {
      seconds += 1;
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
      onTipChange("正向计时已暂停");
    }
  }
  
  // 重置
  export function reset() {
    isRunning = false;
    startedAt = null;
    seconds = 0;
    
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    
    if (onTipChange) {
      onTipChange("正向计时已重置");
    }
  }
  
  // 完成
  export function finish() {
    // 必须先启动过
    if (!startedAt) {
      if (onTipChange) {
        onTipChange("请先点击「开始」按钮");
      }
      return;
    }
    
    // 停止计时器
    isRunning = false;
    
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    
    // 计算实际时长（分钟）
    const actualMinutes = Math.floor(seconds / 60);
    
    if (actualMinutes < 1) {
      if (onTipChange) {
        onTipChange("专注时长太短，至少需要1分钟");
      }
      startedAt = null;
      seconds = 0;
      return;
    }
    
    if (onComplete) {
      onComplete(actualMinutes);
    }
    
    // 重置状态
    startedAt = null;
    seconds = 0;
  }
</script>

<div class="countup-timer">
  <div class="timer-display">
    <p class="timer-label">正向计时模式</p>
    <p class="timer-clock">{formatTime(seconds)}</p>
    <p class="timer-hint">自由计时，手动点击完成</p>
  </div>
  
  <div class="timer-controls">
    <button onclick={start} disabled={isRunning}>开始</button>
    <button onclick={pause} disabled={!isRunning}>暂停</button>
    <button onclick={reset}>重置</button>
    <button onclick={finish} class="finish-btn">完成</button>
  </div>
</div>

<style>
  .countup-timer {
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
  
  .timer-hint {
    margin: 0;
    font-size: 13px;
    color: #80513a;
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
  
  .finish-btn {
    background: linear-gradient(135deg, #0098DC 0%, #33AADF 100%);
    border-color: #0098DC;
    color: white;
  }
  
  .finish-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #33AADF 0%, #0098DC 100%);
  }
</style>
