<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { GachaSystemState, GachaResult, Operator } from '$lib/types/gacha';

  let gachaState: GachaSystemState | null = null;
  let isLoading = false;
  let gachaResults: Operator[] = [];
  let showResults = false;
  let errorMessage = '';

  // 稀有度颜色映射
  const rarityColors: Record<number, string> = {
    3: '#9E9E9E',
    4: '#B39DDB',
    5: '#FFD54F',
    6: '#FF6B6B'
  };

  // 稀有度星级显示
  const rarityStars: Record<number, string> = {
    3: '★★★',
    4: '★★★★',
    5: '★★★★★',
    6: '★★★★★★'
  };

  // 职业中文名称
  const classNames: Record<string, string> = {
    VANGUARD: '先锋',
    GUARD: '近卫',
    DEFENDER: '重装',
    SNIPER: '狙击',
    CASTER: '术师',
    MEDIC: '医疗',
    SUPPORTER: '辅助',
    SPECIALIST: '特种'
  };

  onMount(async () => {
    await loadGachaState();
  });

  async function loadGachaState() {
    try {
      gachaState = await invoke<GachaSystemState>('get_gacha_state');
    } catch (e) {
      console.error('Failed to load gacha state:', e);
      errorMessage = '加载抽卡状态失败';
    }
  }

  async function performSinglePull() {
    if (isLoading) return;
    
    if (!gachaState || gachaState.currency.orundum < 600) {
      errorMessage = '合成玉不足！需要 600 合成玉';
      return;
    }

    isLoading = true;
    errorMessage = '';
    
    try {
      const result = await invoke<GachaResult>('perform_single_gacha_pull');
      gachaResults = result.operators;
      showResults = true;
      
      // 重新加载状态
      await loadGachaState();
    } catch (e) {
      console.error('Single pull failed:', e);
      errorMessage = String(e);
    } finally {
      isLoading = false;
    }
  }

  async function performTenPull() {
    if (isLoading) return;
    
    if (!gachaState || gachaState.currency.orundum < 6000) {
      errorMessage = '合成玉不足！需要 6000 合成玉';
      return;
    }

    isLoading = true;
    errorMessage = '';
    
    try {
      const result = await invoke<GachaResult>('perform_ten_gacha_pull');
      gachaResults = result.operators;
      showResults = true;
      
      // 重新加载状态
      await loadGachaState();
    } catch (e) {
      console.error('Ten pull failed:', e);
      errorMessage = String(e);
    } finally {
      isLoading = false;
    }
  }

  function closeResults() {
    showResults = false;
    gachaResults = [];
  }

  function clearError() {
    errorMessage = '';
  }
</script>

<div class="gacha-page originium-texture">
  <!-- 装饰角 -->
  <div class="ornament-corner ornament-top-left"></div>
  <div class="ornament-corner ornament-top-right"></div>
  <div class="ornament-corner ornament-bottom-left"></div>
  <div class="ornament-corner ornament-bottom-right"></div>

  <div class="gacha-container">
    <!-- 导航链接 -->
    <div class="nav-links">
      <a href="/" class="nav-link ark-button">← 返回主页</a>
      <a href="/operators" class="nav-link ark-button">📋 干员收藏</a>
    </div>

    <!-- 标题 -->
    <h1 class="ark-title page-title">寻访系统</h1>

    {#if gachaState}
      <!-- 货币显示区域 -->
      <div class="currency-section ark-card">
        <div class="currency-item">
          <span class="currency-label">合成玉</span>
          <span class="currency-value originium-glow">{gachaState.currency.orundum}</span>
        </div>
        <div class="currency-item">
          <span class="currency-label">龙门币</span>
          <span class="currency-value">{gachaState.resources.lmd}</span>
        </div>
      </div>

      <!-- 保底计数器 -->
      <div class="pity-section ark-card">
        <div class="pity-label">距离保底</div>
        <div class="pity-counter">
          <span class="pity-value">{gachaState.pityCounter}</span>
          <span class="pity-max">/ 99</span>
        </div>
        <div class="originium-bar">
          <div 
            class="originium-bar-fill" 
            style="width: {(gachaState.pityCounter / 99) * 100}%"
          ></div>
        </div>
        {#if gachaState.pityCounter >= 50}
          <div class="pity-boost ark-badge gold">
            概率提升中！当前 6★ 概率: {(2 + 2 * (gachaState.pityCounter - 50)).toFixed(1)}%
          </div>
        {/if}
      </div>

      <!-- 抽卡按钮区域 -->
      <div class="gacha-buttons">
        <button 
          class="ark-button gacha-btn single-pull"
          on:click={performSinglePull}
          disabled={isLoading || gachaState.currency.orundum < 600}
        >
          <div class="btn-content">
            <span class="btn-label">单次寻访</span>
            <span class="btn-cost">600 合成玉</span>
          </div>
        </button>

        <button 
          class="ark-button gacha-btn ten-pull"
          on:click={performTenPull}
          disabled={isLoading || gachaState.currency.orundum < 6000}
        >
          <div class="btn-content">
            <span class="btn-label">十连寻访</span>
            <span class="btn-cost">6000 合成玉</span>
          </div>
        </button>
      </div>

      <!-- 错误提示 -->
      {#if errorMessage}
        <div class="error-message ark-card" role="button" tabindex="0" on:click={clearError} on:keydown={(e) => e.key === 'Enter' && clearError()}>
          <span class="error-icon">⚠</span>
          <span class="error-text">{errorMessage}</span>
        </div>
      {/if}

      <!-- 加载提示 -->
      {#if isLoading}
        <div class="loading-overlay">
          <div class="loading-spinner ark-pulse"></div>
          <div class="loading-text ark-title">寻访中...</div>
        </div>
      {/if}
    {:else}
      <div class="loading-state ark-card">
        <div class="loading-spinner ark-pulse"></div>
        <p>加载中...</p>
      </div>
    {/if}
  </div>

  <!-- 抽卡结果弹窗 -->
  {#if showResults && gachaResults.length > 0}
    <div class="results-overlay" role="button" tabindex="0" on:click={closeResults} on:keydown={(e) => e.key === 'Escape' && closeResults()}>
      <div class="results-modal ark-card" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation on:keydown|stopPropagation>
        <div class="results-header">
          <h2 class="ark-title">寻访结果</h2>
          <button class="close-btn" on:click={closeResults}>✕</button>
        </div>

        <div class="results-grid">
          {#each gachaResults as operator}
            <div 
              class="operator-card operator-frame"
              style="border-color: {rarityColors[operator.rarity]}"
            >
              <div class="operator-rarity" style="color: {rarityColors[operator.rarity]}">
                {rarityStars[operator.rarity]}
              </div>
              <div class="operator-name">{operator.name}</div>
              <div class="operator-class">{classNames[operator.class]}</div>
              {#if operator.potential > 1}
                <div class="operator-potential ark-badge">潜能 {operator.potential}</div>
              {/if}
            </div>
          {/each}
        </div>

        <button class="ark-button confirm-btn" on:click={closeResults}>
          确认
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  @import '$lib/styles/arknights-theme.css';

  .gacha-page {
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .gacha-container {
    max-width: 800px;
    width: 90%;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: relative;
    z-index: 2;
  }

  .page-title {
    font-size: 48px;
    text-align: center;
    margin: 0;
    letter-spacing: 8px;
  }

  /* 导航链接 */
  .nav-links {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .nav-link {
    padding: 8px 16px;
    font-size: 14px;
    text-decoration: none;
    display: inline-block;
  }

  /* 货币显示 */
  .currency-section {
    display: flex;
    justify-content: space-around;
    padding: 20px;
    gap: 20px;
  }

  .currency-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .currency-label {
    color: var(--ark-text-secondary);
    font-size: 14px;
    letter-spacing: 2px;
  }

  .currency-value {
    color: var(--ark-accent);
    font-size: 32px;
    font-weight: bold;
    font-family: 'Microsoft YaHei', sans-serif;
  }

  /* 保底计数器 */
  .pity-section {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  .pity-label {
    color: var(--ark-text-secondary);
    font-size: 16px;
    letter-spacing: 2px;
  }

  .pity-counter {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .pity-value {
    color: var(--ark-accent);
    font-size: 48px;
    font-weight: bold;
    font-family: 'Microsoft YaHei', sans-serif;
  }

  .pity-max {
    color: var(--ark-text-muted);
    font-size: 24px;
  }

  .originium-bar {
    width: 100%;
    max-width: 400px;
  }

  .pity-boost {
    margin-top: 8px;
    animation: ark-pulse 2s ease-in-out infinite;
  }

  /* 抽卡按钮 */
  .gacha-buttons {
    display: flex;
    gap: 20px;
    justify-content: center;
  }

  .gacha-btn {
    flex: 1;
    max-width: 250px;
    padding: 20px;
    font-size: 18px;
  }

  .gacha-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-label {
    font-size: 20px;
    letter-spacing: 2px;
  }

  .btn-cost {
    font-size: 14px;
    color: var(--ark-text-secondary);
  }

  .ten-pull {
    background: linear-gradient(135deg, #FFB800 0%, #FF8C00 100%);
    border-color: var(--ark-accent);
  }

  .ten-pull:hover:not(:disabled) {
    background: linear-gradient(135deg, #FFD700 0%, #FFB800 100%);
    box-shadow: 0 0 30px rgba(255, 184, 0, 0.6);
  }

  /* 错误提示 */
  .error-message {
    padding: 16px;
    background: rgba(255, 107, 107, 0.1);
    border: 2px solid #FF6B6B;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .error-message:hover {
    background: rgba(255, 107, 107, 0.2);
  }

  .error-icon {
    font-size: 24px;
    color: #FF6B6B;
  }

  .error-text {
    color: var(--ark-text-primary);
    flex: 1;
  }

  /* 加载状态 */
  .loading-state {
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    z-index: 100;
  }

  .loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid var(--ark-border);
    border-top-color: var(--ark-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 24px;
    letter-spacing: 4px;
  }

  /* 结果弹窗 */
  .results-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .results-modal {
    max-width: 900px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 32px;
    animation: slideUp 0.4s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .results-header h2 {
    margin: 0;
    font-size: 32px;
  }

  .close-btn {
    background: none;
    border: 2px solid var(--ark-border);
    color: var(--ark-text-primary);
    width: 40px;
    height: 40px;
    border-radius: 4px;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .close-btn:hover {
    background: var(--ark-primary);
    border-color: var(--ark-accent);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .operator-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: rgba(26, 26, 26, 0.8);
    transition: all 0.3s ease;
    animation: cardAppear 0.5s ease backwards;
  }

  .operator-card:nth-child(1) { animation-delay: 0.05s; }
  .operator-card:nth-child(2) { animation-delay: 0.1s; }
  .operator-card:nth-child(3) { animation-delay: 0.15s; }
  .operator-card:nth-child(4) { animation-delay: 0.2s; }
  .operator-card:nth-child(5) { animation-delay: 0.25s; }
  .operator-card:nth-child(6) { animation-delay: 0.3s; }
  .operator-card:nth-child(7) { animation-delay: 0.35s; }
  .operator-card:nth-child(8) { animation-delay: 0.4s; }
  .operator-card:nth-child(9) { animation-delay: 0.45s; }
  .operator-card:nth-child(10) { animation-delay: 0.5s; }

  @keyframes cardAppear {
    from {
      transform: scale(0.8) rotateY(90deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotateY(0);
      opacity: 1;
    }
  }

  .operator-card:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 152, 220, 0.4);
  }

  .operator-rarity {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
  }

  .operator-name {
    color: var(--ark-text-primary);
    font-size: 16px;
    font-weight: bold;
    text-align: center;
  }

  .operator-class {
    color: var(--ark-text-secondary);
    font-size: 12px;
  }

  .operator-potential {
    margin-top: 4px;
    font-size: 10px;
  }

  .confirm-btn {
    width: 100%;
    padding: 16px;
    font-size: 18px;
    letter-spacing: 4px;
  }
</style>
