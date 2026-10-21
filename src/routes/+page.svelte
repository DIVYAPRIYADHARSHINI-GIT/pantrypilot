<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { app } from '$lib/store.svelte';

	let ready = $derived(app.ready);

	let today = $derived(app.expiringToday);
	let soon = $derived(app.expiringSoon);
	let expired = $derived(app.expired);
	let useFirst = $derived(app.useFirst);

	// Savings tip derived from the actual items at risk, never a made-up number.
	let atRiskValue = $derived(
		Math.round([...expired, ...today, ...soon].reduce((s, i) => s + (i.price ?? 0), 0))
	);
	let tip = $derived.by(() => {
		if (expired.length > 0) {
			return `${expired.length} item${expired.length > 1 ? 's have' : ' has'} already expired. Check them before cooking, and log what you threw away so the waste chart stays accurate.`;
		}
		if (today.length > 0 || soon.length > 0) {
			const names = [...today, ...soon].slice(0, 3).map((i) => i.name).join(', ');
			return `Cook with ${names} first.${atRiskValue > 0 ? ` That is about ${app.settings.currency}${atRiskValue} of food you can still save.` : ''}`;
		}
		if (app.items.length > 0) {
			return 'Nothing is close to expiring. Good time to plan meals around what you already have.';
		}
		return 'Scan your next grocery bill to fill the pantry in one go.';
	});
</script>

<svelte:head>
	<title>Home · PantryPilot</title>
	<meta
		name="description"
		content="Track the food at home, get a warning before it expires, and cook from what is in stock."
	/>
</svelte:head>

<div class="page-head">
	<div>
		<h1>Hello</h1>
		<p>Scan. Stock. Waste less.</p>
	</div>
	<a href="/scan" class="btn btn-primary btn-sm"><Icon name="scan" size={17} /> Scan bill</a>
</div>

{#if !ready}
	<div class="stack" aria-busy="true" aria-label="Loading your pantry">
		<div class="skeleton" style="height:76px"></div>
		<div class="skeleton" style="height:120px"></div>
		<div class="skeleton" style="height:120px"></div>
	</div>
{:else}
	{#if app.alertCount > 0}
		<div class="alert-banner" role="status">
			<Icon name="bell" size={19} />
			<div>
				<strong>{app.alertCount} item{app.alertCount > 1 ? 's' : ''} need attention</strong>
				<p class="small" style="margin:0">
					{expired.length} expired · {today.length} expiring today · {soon.length} within {app.settings.warningDays}
					days
				</p>
			</div>
		</div>
	{/if}

	<div class="card tip-card">
		<span class="tip-icon" aria-hidden="true"><Icon name="leaf" size={19} /></span>
		<div>
			<h3 style="margin-bottom:2px">Savings tip</h3>
			<p class="small muted" style="margin:0">{tip}</p>
		</div>
	</div>

	{#if app.items.length === 0}
		<div class="card" style="margin-top:14px">
			<EmptyState
				title="Your pantry is empty"
				message="Scan a grocery bill, scan a barcode, or add an item by hand to get started."
			>
				<a href="/scan" class="btn btn-primary btn-sm">Scan a bill</a>
				<a href="/add" class="btn btn-sm">Add manually</a>
				<button class="btn btn-sm" onclick={() => app.loadSampleData()}>Load sample data</button>
			</EmptyState>
		</div>
	{:else}
		{#if expired.length > 0}
			<section class="section">
				<div class="section-head">
					<h2>Expired</h2>
					<span class="badge badge-expired">{expired.length}</span>
				</div>
				<div class="stack">
					{#each expired.slice(0, 4) as item (item.id)}
						<ItemCard {item} />
					{/each}
				</div>
			</section>
		{/if}

		{#if today.length > 0}
			<section class="section">
				<div class="section-head">
					<h2>Expiring today</h2>
					<span class="badge badge-soon">{today.length}</span>
				</div>
				<div class="stack">
					{#each today as item (item.id)}
						<ItemCard {item} />
					{/each}
				</div>
			</section>
		{/if}

		{#if soon.length > 0}
			<section class="section">
				<div class="section-head">
					<h2>Expiring in {app.settings.warningDays} days</h2>
					<span class="badge badge-soon">{soon.length}</span>
				</div>
				<div class="stack">
					{#each soon.slice(0, 5) as item (item.id)}
						<ItemCard {item} />
					{/each}
				</div>
			</section>
		{/if}

		<section class="section">
			<div class="section-head">
				<h2>Use first</h2>
				<a href="/recipes" class="btn btn-sm btn-ghost">Find recipes</a>
			</div>
			{#if useFirst.length === 0}
				<p class="muted">Nothing in stock with an upcoming expiry date.</p>
			{:else}
				<div class="stack">
					{#each useFirst as item (item.id)}
						<ItemCard {item} compact />
					{/each}
				</div>
			{/if}
		</section>

		<section class="section">
			<div class="section-head"><h2>Quick actions</h2></div>
			<div class="grid-2">
				<a href="/scan" class="quick"><Icon name="scan" size={20} /><span>Scan bill</span></a>
				<a href="/barcode" class="quick"><Icon name="barcode" size={20} /><span>Scan barcode</span></a>
				<a href="/add" class="quick"><Icon name="plus" size={20} /><span>Add item</span></a>
				<a href="/charts" class="quick"><Icon name="chart" size={20} /><span>Spending</span></a>
			</div>
		</section>
	{/if}
{/if}

<style>
	.alert-banner {
		display: flex;
		gap: 11px;
		align-items: center;
		background: var(--amber-soft);
		border: 1px solid var(--amber);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		margin-bottom: 12px;
		color: #8a5a06;
	}
	:global(:root[data-theme='dark']) .alert-banner {
		color: var(--amber);
	}
	.tip-card {
		display: flex;
		gap: 11px;
		align-items: flex-start;
		margin-bottom: 20px;
	}
	.tip-icon {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--green-soft);
		color: var(--green-dark);
		display: grid;
		place-items: center;
	}
	:global(:root[data-theme='dark']) .tip-icon {
		color: var(--green);
	}
	.quick {
		display: flex;
		flex-direction: column;
		gap: 7px;
		align-items: flex-start;
		padding: 14px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.92rem;
		min-height: 44px;
		box-shadow: var(--shadow);
	}
	.quick:hover {
		background: var(--surface-2);
	}
	.quick :global(svg) {
		color: var(--green-dark);
	}
	:global(:root[data-theme='dark']) .quick :global(svg) {
		color: var(--green);
	}
</style>
