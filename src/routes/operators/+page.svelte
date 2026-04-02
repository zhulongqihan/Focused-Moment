<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { GachaSystemState, Operator } from '$lib/types/gacha';

  let gachaState: GachaSystemState | null = null;
  let filteredOperators: Operator[] = [];
  let isLoading = true;
  let errorMessage = '';

  // 筛选和排序状态
  let selectedRarity: number | null = null;
  let selectedClass: string | null = null;
  let sortBy: 'rarity' | 'level' | 'obtained' = 'rarity';
  let sortOrder: 'asc' | 'desc' = 'desc';

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

  // 精英化阶段显示
  const eliteNames: Record<number, string> = {
    0: 'Elite 0',
    1: 'Elite 1',
    2: 'Elite 2'
  };

  onMount(async () => {
    await loadOperators();
  });

  async function loadOperators() {
    isLoading = true;
    errorMessage = '';
    
    try {
      gachaState = await invoke<GachaSystemState>('get_gacha_state');
      applyFiltersAndSort();
    } catch (e) {
      console.error('Failed to load operators:', e);
      errorMessage = '加载干员数据失败';
    } finally {
      isLoading = false;
    }
  }

  function applyFiltersAndSort() {
    if (!gachaState) {
      filteredOperators = [];
      return;
    }

    let operators = [...gachaState.operators];

    // 应用稀有度筛选
    if (selectedRarity !== null) {
      operators = operators.filter(op => op.rarity === selectedRarity);
    }

    // 应用职业筛选
    if (selectedClass !== null) {
      operators = operators.filter(op => op.class === selectedClass);
    }

    // 应用排序
    operators.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'rarity':
          comparison = a.rarity - b.rarity;
          break;
        case 'level':
          comparison = a.level - b.level;
          break;
        case 'obtained':
          comparison = a.obtainedAt - b.obtainedAt;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    filteredOperators = operators;
  }

  function toggleRarityFilter(rarity: number) {
    selectedRarity = selectedRarity === rarity ? null : rarity;
    applyFiltersAndSort();
  }

  function toggleClassFilter(operatorClass: string) {
    selectedClass = selectedClass === operatorClass ? null : operatorClass;
    applyFiltersAndSort();
  }

  function changeSortBy(newSortBy: 'rarity' | 'level' | 'obtained') {
    if (sortBy === newSortBy) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = newSortBy;
      sortOrder = 'desc';
    }
    applyFiltersAndSort();
  }

  function clearFilters() {
    selectedRarity = null;
    selectedClass = null;
    sortBy = 'rarity';
    sortOrder = 'desc';
    applyFiltersAndSort();
  }
</script>

<div class="operators-page originium-texture">
  <!-- 装饰角 -->
  <div class="ornament-corner ornament-top-left"></div>
  <div class="ornament-corner ornament-top-right"></div>
  <div class="ornament-corner ornament-bottom-left"></div>
  <div class="ornament-corner ornament-bottom-right"></div>

  <div class="operators-container">
    <!-- 导航链接 -->
    <div class="nav-links">
      <a href="/" class="nav-link ark-button">← 返回主页</a>
      <a href="/gacha" class="nav-link ark-button">🎲 寻访系统</a>
    </div>

    <!-- 标题 -->
    <h1 class="ark-title page-title">干员收藏</h1>

    {#if isLoading}
      <div class="loading-state ark-card">
        <div class="loading-spinner ark-pulse"></div>
        <p>加载中...</p>
      </div>
    {:else if errorMessage}
      <div class="error-message ark-card">
        <span class="error-icon">⚠</span>
        <span class="error-text">{errorMessage}</span>
      </div>
    {:else if gachaState}
      <!-- 统计信息 -->
      <div class="stats-section ark-card">
        <div class="stat-item">
          <span class="stat-label">总干员数</span>
          <span class="stat-value">{gachaState.operators.length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">显示中</span>
          <span class="stat-value">{filteredOperators.length}</span>
        </div>
      </div>

      <!-- 筛选和排序控制 -->
      <div class="controls-section ark-card">
        <!-- 稀有度筛选 -->
        <div class="filter-group">
          <span class="filter-label">稀有度：</span>
          <div class="filter-buttons">
            {#each [6, 5, 4, 3] as rarity}
              <button
                class="filter-btn ark-button"
                class:active={selectedRarity === rarity}
                style="border-color: {rarityColors[rarity]}"
                on:click={() => toggleRarityFilter(rarity)}
              >
                {rarityStars[rarity]}
              </button>
            {/each}
          </div>
        </div>

        <!-- 职业筛选 -->
        <div class="filter-group">
          <span class="filter-label">职业：</span>
          <div class="filter-buttons">
            {#each Object.entries(classNames) as [classKey, className]}
              <button
                class="filter-btn ark-button"
                class:active={selectedClass === classKey}
                on:click={() => toggleClassFilter(classKey)}
              >
                {className}
              </button>
            {/each}
          </div>
        </div>

        <!-- 排序控制 -->
        <div class="sort-group">
          <span class="filter-label">排序：</span>
          <div class="sort-buttons">
            <button
              class="sort-btn ark-button"
              class:active={sortBy === 'rarity'}
              on:click={() => changeSortBy('rarity')}
            >
              稀有度 {sortBy === 'rarity' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button
              class="sort-btn ark-button"
              class:active={sortBy === 'level'}
              on:click={() => changeSortBy('level')}
            >
              等级 {sortBy === 'level' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button
              class="sort-btn ark-button"
              class:active={sortBy === 'obtained'}
              on:click={() => changeSortBy('obtained')}
            >
              获得时间 {sortBy === 'obtained' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>
        </div>

        <!-- 清除筛选按钮 -->
        {#if selectedRarity !== null || selectedClass !== null}
          <button class="clear-btn ark-button" on:click={clearFilters}>
            清除筛选
          </button>
        {/if}
      </div>

      <!-- 干员列表 -->
      {#if filteredOperators.length > 0}
        <div class="operators-grid ark-scrollbar">
          {#each filteredOperators as operator (operator.id)}
            <div 
              class="operator-card operator-frame"
              style="border-color: {rarityColors[operator.rarity]}"
            >
              <div class="operator-header">
                <div class="operator-rarity" style="color: {rarityColors[operator.rarity]}">
                  {rarityStars[operator.rarity]}
                </div>
                {#if operator.potential > 1}
                  <div class="operator-potential ark-badge">潜能 {operator.potential}</div>
                {/if}
              </div>
              
              <div class="operator-name">{operator.name}</div>
              <div class="operator-class">{classNames[operator.class]}</div>
              
              <div class="operator-stats">
                <div class="stat-row">
                  <span class="stat-label-small">等级</span>
                  <span class="stat-value-small">Lv.{operator.level}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label-small">精英化</span>
                  <span class="stat-value-small">{eliteNames[operator.elite]}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state ark-card">
          <p>没有符合条件的干员</p>
          <button class="ark-button" on:click={clearFilters}>清除筛选</button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  @import '$lib/styles/arknights-theme.css';

  .operators-page {
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .operators-container {
    max-width: 1400px;
    width: 95%;
    height: 90vh;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    z-index: 2;
    overflow: hidden;
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

  /* 统计信息 */
  .stats-section {
    display: flex;
    justify-content: center;
    gap: 40px;
    padding: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .stat-label {
    color: var(--ark-text-secondary);
    font-size: 14px;
    letter-spacing: 2px;
  }

  .stat-value {
    color: var(--ark-accent);
    font-size: 28px;
    font-weight: bold;
    font-family: 'Microsoft YaHei', sans-serif;
  }

  /* 控制区域 */
  .controls-section {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .filter-group,
  .sort-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .filter-label {
    color: var(--ark-text-primary);
    font-size: 14px;
    letter-spacing: 2px;
    min-width: 80px;
  }

  .filter-buttons,
  .sort-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-btn,
  .sort-btn {
    padding: 8px 16px;
    font-size: 14px;
    min-width: auto;
  }

  .filter-btn.active,
  .sort-btn.active {
    background: linear-gradient(135deg, var(--ark-accent) 0%, #FF8C00 100%);
    border-color: var(--ark-accent);
  }

  .clear-btn {
    align-self: flex-start;
    padding: 8px 20px;
    font-size: 14px;
  }

  /* 干员网格 */
  .operators-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    overflow-y: auto;
    padding: 20px;
    flex: 1;
  }

  .operator-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(26, 26, 26, 0.8);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .operator-card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 152, 220, 0.4);
  }

  .operator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .operator-rarity {
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 2px;
  }

  .operator-potential {
    font-size: 10px;
    padding: 2px 8px;
  }

  .operator-name {
    color: var(--ark-text-primary);
    font-size: 18px;
    font-weight: bold;
    text-align: center;
  }

  .operator-class {
    color: var(--ark-text-secondary);
    font-size: 14px;
    text-align: center;
  }

  .operator-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--ark-border);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label-small {
    color: var(--ark-text-secondary);
    font-size: 12px;
  }

  .stat-value-small {
    color: var(--ark-text-primary);
    font-size: 12px;
    font-weight: bold;
  }

  /* 空状态 */
  .empty-state {
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .empty-state p {
    color: var(--ark-text-secondary);
    font-size: 18px;
    margin: 0;
  }

  /* 加载和错误状态 */
  .loading-state,
  .error-message {
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
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

  .error-message {
    background: rgba(255, 107, 107, 0.1);
    border: 2px solid #FF6B6B;
    flex-direction: row;
  }

  .error-icon {
    font-size: 24px;
    color: #FF6B6B;
  }

  .error-text {
    color: var(--ark-text-primary);
  }
</style>
