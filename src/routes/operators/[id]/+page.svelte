<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { invoke } from '@tauri-apps/api/core';
	import type { Operator, Resources, UpgradeResult } from '$lib/types/gacha';

	let operator: Operator | null = null;
	let resources: Resources | null = null;
	let loading = true;
	let error = '';
	let upgrading = false;
	let eliting = false;

	// 计算升级所需资源
	function calculateUpgradeCost(level: number, rarity: number): { lmd: number; exp: number } {
		const baseLmd = rarity === 3 ? 50 : rarity === 4 ? 100 : rarity === 5 ? 200 : 300;
		const baseExp = rarity === 3 ? 100 : rarity === 4 ? 150 : rarity === 5 ? 250 : 400;
		return {
			lmd: baseLmd * (level + 1),
			exp: baseExp * (level + 1)
		};
	}

	// 计算精英化所需资源
	function calculateEliteCost(
		rarity: number,
		targetElite: number
	): { lmd: number; exp: number; chips: number } {
		const costs: Record<string, { lmd: number; exp: number; chips: number }> = {
			'3-1': { lmd: 10000, exp: 5000, chips: 2 },
			'4-1': { lmd: 15000, exp: 8000, chips: 3 },
			'5-1': { lmd: 30000, exp: 15000, chips: 4 },
			'6-1': { lmd: 50000, exp: 25000, chips: 5 },
			'3-2': { lmd: 20000, exp: 10000, chips: 3 },
			'4-2': { lmd: 30000, exp: 15000, chips: 4 },
			'5-2': { lmd: 60000, exp: 30000, chips: 6 },
			'6-2': { lmd: 100000, exp: 50000, chips: 8 }
		};
		return costs[`${rarity}-${targetElite}`] || { lmd: 10000, exp: 5000, chips: 2 };
	}

	// 获取等级上限
	function getMaxLevel(elite: number): number {
		return elite === 0 ? 50 : elite === 1 ? 70 : 90;
	}

	// 加载干员数据
	async function loadOperator() {
		try {
			loading = true;
			error = '';

			const operatorId = $page.params.id;

			// 获取抽卡状态（包含所有干员）
			const state = await invoke<any>('get_gacha_state');
			operator = state.operators.find((op: Operator) => op.id === operatorId) || null;

			if (!operator) {
				error = '干员不存在';
				return;
			}

			// 获取资源
			resources = await invoke<Resources>('get_resources_balance');
		} catch (e) {
			error = `加载失败: ${e}`;
		} finally {
			loading = false;
		}
	}

	// 升级干员
	async function handleUpgrade() {
		if (!operator || upgrading) return;

		try {
			upgrading = true;
			error = '';

			const result = await invoke<UpgradeResult>('upgrade_operator', {
				operatorId: operator.id
			});

			if (result.success) {
				// 重新加载数据
				await loadOperator();
			} else {
				error = result.message;
			}
		} catch (e) {
			error = `升级失败: ${e}`;
		} finally {
			upgrading = false;
		}
	}

	// 精英化干员
	async function handleElite() {
		if (!operator || eliting) return;

		try {
			eliting = true;
			error = '';

			const result = await invoke<UpgradeResult>('elite_operator_promotion', {
				operatorId: operator.id
			});

			if (result.success) {
				// 重新加载数据
				await loadOperator();
			} else {
				error = result.message;
			}
		} catch (e) {
			error = `精英化失败: ${e}`;
		} finally {
			eliting = false;
		}
	}

	onMount(() => {
		loadOperator();
	});

	$: upgradeCost = operator ? calculateUpgradeCost(operator.level, operator.rarity) : null;
	$: eliteCost =
		operator && operator.elite < 2
			? calculateEliteCost(operator.rarity, operator.elite + 1)
			: null;
	$: maxLevel = operator ? getMaxLevel(operator.elite) : 0;
	$: canUpgrade = operator && operator.level < maxLevel;
	$: canElite = operator && operator.level >= maxLevel && operator.elite < 2;
</script>

<div class="operator-detail">
	{#if loading}
		<div class="loading">加载中...</div>
	{:else if error && !operator}
		<div class="error">{error}</div>
	{:else if operator}
		<div class="operator-header">
			<h1 class="operator-name rarity-{operator.rarity}">{operator.name}</h1>
			<div class="operator-meta">
				<span class="rarity">{'★'.repeat(operator.rarity)}</span>
				<span class="class">{operator.class}</span>
			</div>
		</div>

		<div class="operator-stats">
			<div class="stat-row">
				<span class="label">等级</span>
				<span class="value"
					>Lv.{operator.level} / {maxLevel} (Elite {operator.elite})</span
				>
			</div>
			<div class="stat-row">
				<span class="label">潜能</span>
				<span class="value">潜能 {operator.potential}</span>
			</div>
			<div class="stat-row">
				<span class="label">获得时间</span>
				<span class="value">{new Date(operator.obtained_at * 1000).toLocaleString()}</span>
			</div>
		</div>

		{#if resources}
			<div class="resources-panel">
				<h2>当前资源</h2>
				<div class="resource-list">
					<div class="resource-item">
						<span class="resource-name">龙门币</span>
						<span class="resource-value">{resources.lmd.toLocaleString()}</span>
					</div>
					<div class="resource-item">
						<span class="resource-name">经验值</span>
						<span class="resource-value">{resources.exp.toLocaleString()}</span>
					</div>
					{#if resources.chips && Object.keys(resources.chips).length > 0}
						{#each Object.entries(resources.chips) as [chipType, count]}
							<div class="resource-item">
								<span class="resource-name">{chipType}</span>
								<span class="resource-value">{count}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}

		<div class="actions-panel">
			<h2>养成操作</h2>

			{#if canUpgrade && upgradeCost}
				<div class="action-card">
					<h3>升级</h3>
					<div class="cost-info">
						<p>所需资源：</p>
						<ul>
							<li>龙门币: {upgradeCost.lmd.toLocaleString()}</li>
							<li>经验值: {upgradeCost.exp.toLocaleString()}</li>
						</ul>
					</div>
					<button class="upgrade-btn" onclick={handleUpgrade} disabled={upgrading}>
						{upgrading ? '升级中...' : '升级到 Lv.' + (operator.level + 1)}
					</button>
				</div>
			{:else if !canUpgrade && operator.level >= maxLevel}
				<div class="action-card disabled">
					<h3>升级</h3>
					<p class="info-text">已达到当前精英化等级上限</p>
				</div>
			{/if}

			{#if canElite && eliteCost}
				<div class="action-card elite">
					<h3>精英化</h3>
					<div class="cost-info">
						<p>所需资源：</p>
						<ul>
							<li>龙门币: {eliteCost.lmd.toLocaleString()}</li>
							<li>经验值: {eliteCost.exp.toLocaleString()}</li>
							<li>精英化芯片: {eliteCost.chips}</li>
						</ul>
						<p class="warning">注意：精英化后等级将重置为 1</p>
					</div>
					<button class="elite-btn" onclick={handleElite} disabled={eliting}>
						{eliting ? '精英化中...' : '精英化到 Elite ' + (operator.elite + 1)}
					</button>
				</div>
			{:else if operator.elite >= 2}
				<div class="action-card disabled">
					<h3>精英化</h3>
					<p class="info-text">已达到最高精英化等级 (Elite 2)</p>
				</div>
			{/if}
		</div>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}
	{/if}
</div>

<style>
	.operator-detail {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	.loading,
	.error {
		text-align: center;
		padding: 2rem;
		font-size: 1.2rem;
	}

	.operator-header {
		text-align: center;
		margin-bottom: 2rem;
		padding: 2rem;
		background: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.1));
		border: 2px solid rgba(212, 175, 55, 0.3);
		border-radius: 8px;
	}

	.operator-name {
		font-size: 2.5rem;
		margin: 0 0 1rem 0;
		font-weight: bold;
	}

	.operator-name.rarity-6 {
		color: #ff6b35;
		text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
	}

	.operator-name.rarity-5 {
		color: #ffd700;
		text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
	}

	.operator-name.rarity-4 {
		color: #c0c0c0;
	}

	.operator-name.rarity-3 {
		color: #8b7355;
	}

	.operator-meta {
		display: flex;
		justify-content: center;
		gap: 2rem;
		font-size: 1.2rem;
	}

	.rarity {
		color: #ffd700;
	}

	.class {
		color: #d4af37;
	}

	.operator-stats {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(212, 175, 55, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid rgba(212, 175, 55, 0.1);
	}

	.stat-row:last-child {
		border-bottom: none;
	}

	.label {
		color: #d4af37;
		font-weight: bold;
	}

	.value {
		color: #f5f5dc;
	}

	.resources-panel,
	.actions-panel {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(212, 175, 55, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.resources-panel h2,
	.actions-panel h2 {
		color: #d4af37;
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.resource-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.resource-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 4px;
	}

	.resource-name {
		color: #d4af37;
	}

	.resource-value {
		color: #f5f5dc;
		font-weight: bold;
	}

	.action-card {
		background: rgba(0, 0, 0, 0.3);
		border: 2px solid rgba(212, 175, 55, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
	}

	.action-card.elite {
		border-color: rgba(255, 107, 53, 0.5);
	}

	.action-card.disabled {
		opacity: 0.5;
		border-color: rgba(128, 128, 128, 0.3);
	}

	.action-card h3 {
		color: #d4af37;
		margin: 0 0 1rem 0;
		font-size: 1.3rem;
	}

	.cost-info {
		margin-bottom: 1rem;
		color: #f5f5dc;
	}

	.cost-info ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}

	.cost-info li {
		padding: 0.25rem 0;
	}

	.warning {
		color: #ff6b35;
		font-weight: bold;
		margin-top: 0.5rem;
	}

	.info-text {
		color: #999;
		margin: 0;
	}

	.upgrade-btn,
	.elite-btn {
		width: 100%;
		padding: 1rem;
		font-size: 1.1rem;
		font-weight: bold;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.upgrade-btn {
		background: linear-gradient(135deg, #d4af37, #c9a227);
		color: #1a1a1a;
	}

	.upgrade-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #e5c047, #d4af37);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
	}

	.elite-btn {
		background: linear-gradient(135deg, #ff6b35, #ff5722);
		color: white;
	}

	.elite-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #ff7c45, #ff6b35);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
	}

	.upgrade-btn:disabled,
	.elite-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.error-message {
		background: rgba(255, 0, 0, 0.1);
		border: 1px solid rgba(255, 0, 0, 0.3);
		border-radius: 4px;
		padding: 1rem;
		color: #ff6b35;
		margin-top: 1rem;
	}
</style>
