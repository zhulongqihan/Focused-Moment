<script lang="ts">
  import { onMount } from 'svelte';
  
  export let onClose: () => void;
  
  let showRules = false;
  
  function toggleRules() {
    showRules = !showRules;
  }
</script>

<div class="announcement-overlay" role="button" tabindex="0" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="announcement-modal ark-card" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
    <!-- 装饰角 -->
    <div class="ornament-corner ornament-top-left"></div>
    <div class="ornament-corner ornament-top-right"></div>
    <div class="ornament-corner ornament-bottom-left"></div>
    <div class="ornament-corner ornament-bottom-right"></div>
    
    <div class="announcement-header">
      <div class="header-icon">◆</div>
      <h2 class="ark-title">罗德岛寻访公告</h2>
      <div class="header-icon">◆</div>
    </div>

    <div class="announcement-content">
      <div class="announcement-section">
        <h3 class="section-title">欢迎，博士</h3>
        <p class="announcement-text">
          感谢您使用 Focused Moment 专注时刻应用。完成番茄钟工作会话即可获得合成玉和龙门币，用于寻访干员！
        </p>
      </div>

      <div class="announcement-section highlight">
        <h3 class="section-title">🎁 奖励机制</h3>
        <div class="reward-grid">
          <div class="reward-item">
            <div class="reward-label">普通番茄钟</div>
            <div class="reward-value">100 合成玉 + 300 龙门币</div>
          </div>
          <div class="reward-item">
            <div class="reward-label">Boss 番茄钟</div>
            <div class="reward-value">200 合成玉 + 500 龙门币</div>
          </div>
          <div class="reward-item">
            <div class="reward-label">挑战完成</div>
            <div class="reward-value">额外 +50 合成玉</div>
          </div>
        </div>
      </div>

      <div class="announcement-section">
        <button class="rules-toggle ark-button" on:click={toggleRules}>
          {showRules ? '▼' : '▶'} 寻访规则说明
        </button>
        
        {#if showRules}
          <div class="rules-content">
            <div class="rule-item">
              <div class="rule-title">📊 基础概率</div>
              <ul class="rule-list">
                <li>6★ 干员：2%</li>
                <li>5★ 干员：8%</li>
                <li>4★ 干员：50%</li>
                <li>3★ 干员：40%</li>
              </ul>
            </div>

            <div class="rule-item">
              <div class="rule-title">🎯 保底机制</div>
              <ul class="rule-list">
                <li>从第 51 次寻访开始，每次未获得 6★ 干员时，下次获得 6★ 的概率提升 2%</li>
                <li>第 99 次寻访必定获得 6★ 干员（硬保底）</li>
                <li>获得 6★ 干员后，保底计数器重置为 0</li>
              </ul>
            </div>

            <div class="rule-item">
              <div class="rule-title">✨ 十连保底</div>
              <ul class="rule-list">
                <li>每次十连寻访必定包含至少一个 5★ 或 6★ 干员</li>
                <li>十连寻访消耗 6000 合成玉（相当于 10 次单抽）</li>
              </ul>
            </div>

            <div class="rule-item">
              <div class="rule-title">🔄 重复干员</div>
              <ul class="rule-list">
                <li>获得重复干员时，该干员的潜能等级 +1</li>
                <li>潜能等级上限为 6</li>
                <li>达到潜能上限后，重复干员将转换为资源</li>
              </ul>
            </div>

            <div class="rule-item">
              <div class="rule-title">💎 消耗说明</div>
              <ul class="rule-list">
                <li>单次寻访：600 合成玉</li>
                <li>十连寻访：6000 合成玉</li>
                <li>合成玉可通过完成番茄钟工作会话获得</li>
              </ul>
            </div>
          </div>
        {/if}
      </div>

      <div class="announcement-footer">
        <p class="footer-text">
          祝您寻访顺利，早日集齐心仪的干员！
        </p>
        <p class="footer-signature">—— 罗德岛人事部</p>
      </div>
    </div>

    <button class="close-button ark-button" on:click={onClose}>
      我知道了
    </button>
  </div>
</div>

<style>
  @import '$lib/styles/arknights-theme.css';

  .announcement-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .announcement-modal {
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 40px;
    position: relative;
    animation: slideUp 0.4s ease;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
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

  .announcement-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid var(--ark-border);
  }

  .header-icon {
    color: var(--ark-accent);
    font-size: 24px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .announcement-header h2 {
    margin: 0;
    font-size: 32px;
    letter-spacing: 4px;
    text-align: center;
  }

  .announcement-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .announcement-section {
    padding: 20px;
    background: rgba(0, 152, 220, 0.05);
    border: 1px solid var(--ark-border);
    border-radius: 4px;
  }

  .announcement-section.highlight {
    background: linear-gradient(135deg, rgba(0, 152, 220, 0.1) 0%, rgba(255, 184, 0, 0.05) 100%);
    border-color: var(--ark-accent);
  }

  .section-title {
    color: var(--ark-accent);
    font-size: 20px;
    font-weight: bold;
    margin: 0 0 16px 0;
    letter-spacing: 2px;
  }

  .announcement-text {
    color: var(--ark-text-primary);
    font-size: 16px;
    line-height: 1.8;
    margin: 0;
  }

  .reward-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .reward-item {
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--ark-border);
    border-radius: 4px;
    text-align: center;
  }

  .reward-label {
    color: var(--ark-text-secondary);
    font-size: 14px;
    margin-bottom: 8px;
  }

  .reward-value {
    color: var(--ark-accent);
    font-size: 16px;
    font-weight: bold;
  }

  .rules-toggle {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    text-align: left;
    margin-bottom: 16px;
  }

  .rules-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .rule-item {
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid var(--ark-accent);
  }

  .rule-title {
    color: var(--ark-accent);
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 12px;
  }

  .rule-list {
    margin: 0;
    padding-left: 24px;
    color: var(--ark-text-primary);
    line-height: 1.8;
  }

  .rule-list li {
    margin-bottom: 8px;
  }

  .announcement-footer {
    text-align: center;
    padding-top: 20px;
    border-top: 1px solid var(--ark-border);
  }

  .footer-text {
    color: var(--ark-text-primary);
    font-size: 16px;
    margin: 0 0 12px 0;
  }

  .footer-signature {
    color: var(--ark-text-secondary);
    font-size: 14px;
    font-style: italic;
    margin: 0;
  }

  .close-button {
    width: 100%;
    padding: 16px;
    font-size: 18px;
    letter-spacing: 4px;
    margin-top: 24px;
  }

  /* 滚动条样式 */
  .announcement-modal::-webkit-scrollbar {
    width: 8px;
  }

  .announcement-modal::-webkit-scrollbar-track {
    background: rgba(0, 152, 220, 0.1);
    border: 1px solid var(--ark-border);
  }

  .announcement-modal::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, var(--ark-primary) 0%, var(--ark-primary-dark) 100%);
    border: 1px solid var(--ark-border);
  }

  .announcement-modal::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, var(--ark-primary-light) 0%, var(--ark-primary) 100%);
  }
</style>
