<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import PomodoroTimer from "$lib/components/PomodoroTimer.svelte";
  import CountupTimer from "$lib/components/CountupTimer.svelte";
  
  let activeMode = $state<"pomodoro" | "countup">("pomodoro");
  let currentTip = $state("选择一个计时模式开始");
  let orundum = $state(0);
  let lmd = $state(0);
  

  
  async function loadCurrencyBalance() {
    try {
      const resources = await invoke<any>("get_resources");
      orundum = resources.currency.orundum;
      lmd = resources.resources.lmd;
    } catch (error) {
      console.error("Failed to load currency balance:", error);
    }
  }
  
  async function handlePomodoroComplete(minutes: number, challengeCompleted: boolean) {
    currentTip = "正在结算奖励...";
    
    try {
      const rewardResult = await invoke<{
        earned_currency: { orundum: number };
        earned_resources: { lmd: number; exp: number };
        message: string;
      }>("complete_focus_session", {
        mode: "work",
        durationMinutes: minutes,
        challengeCompleted,
      });
      
      await loadCurrencyBalance();
      currentTip = rewardResult.message;
    } catch (error) {
      console.error("奖励发放失败:", error);
      currentTip = `奖励发放失败：${error}`;
    }
  }
  
  async function handleCountupComplete(minutes: number) {
    currentTip = "正在结算奖励...";
    
    try {
      const rewardResult = await invoke<{
        earned_currency: { orundum: number };
        earned_resources: { lmd: number; exp: number };
        message: string;
      }>("complete_focus_session", {
        mode: "work",
        durationMinutes: minutes,
        challengeCompleted: false,
      });
      
      await loadCurrencyBalance();
      currentTip = rewardResult.message;
    } catch (error) {
      console.error("奖励发放失败:", error);
      currentTip = `奖励发放失败：${error}`;
    }
  }
  
  function handleTipChange(tip: string) {
    currentTip = tip;
  }
  
  $effect(() => {
    void loadCurrencyBalance();
  });
</script>

<main class="test-page">
  <h1>计时器测试页面</h1>
  
  <div class="currency-display">
    <div class="currency-item">
      <span>💎</span>
      <span>{orundum}</span>
      <span>合成玉</span>
    </div>
    <div class="currency-item">
      <span>💰</span>
      <span>{lmd}</span>
      <span>龙门币</span>
    </div>
  </div>
  
  <div class="tip-box">
    <p>{currentTip}</p>
  </div>
  
  <div class="mode-switch">
    <button 
      class:active={activeMode === "pomodoro"}
      onclick={() => activeMode = "pomodoro"}
    >
      番茄钟模式
    </button>
    <button 
      class:active={activeMode === "countup"}
      onclick={() => activeMode = "countup"}
    >
      正向计时模式
    </button>
  </div>
  
  <div class="timer-container">
    {#if activeMode === "pomodoro"}
      <PomodoroTimer 
        workMinutes={25}
        onComplete={handlePomodoroComplete}
        onTipChange={handleTipChange}
      />
    {:else}
      <CountupTimer 
        onComplete={handleCountupComplete}
        onTipChange={handleTipChange}
      />
    {/if}
  </div>
  
  <div class="back-link">
    <a href="/">返回主页</a>
  </div>
</main>

<style>
  .test-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  
  h1 {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .currency-display {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-bottom: 20px;
  }
  
  .currency-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 16px;
    border-radius: 12px;
    border: 1px solid rgba(0, 152, 220, 0.2);
  }
  
  .tip-box {
    background: rgba(0, 152, 220, 0.1);
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
  }
  
  .tip-box p {
    margin: 0;
    color: #1e1a16;
  }
  
  .mode-switch {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 20px;
  }
  
  .mode-switch button {
    padding: 12px 24px;
    border: 2px solid rgba(0, 152, 220, 0.3);
    background: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    transition: all 0.3s;
  }
  
  .mode-switch button.active {
    background: linear-gradient(135deg, #0098DC 0%, #33AADF 100%);
    border-color: #0098DC;
    color: white;
  }
  
  .timer-container {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 18px;
    border: 1px solid rgba(30, 26, 22, 0.12);
    padding: 24px;
    margin-bottom: 20px;
  }
  
  .back-link {
    text-align: center;
  }
  
  .back-link a {
    color: #0098DC;
    text-decoration: none;
    font-weight: 600;
  }
  
  .back-link a:hover {
    text-decoration: underline;
  }
</style>
