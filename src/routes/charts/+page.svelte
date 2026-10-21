<script lang="ts">
	// Plain SVG charts. Every number comes from stored receipts and use/waste
	// records; when there is no data we show an empty state instead of a guess.
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { app } from '$lib/store.svelte';
	import { monthKey, monthLabel } from '$lib/dates';
	import type { Category } from '$lib/types';

	let currency = $derived(app.settings.currency);

	// ---- monthly spend from scanned bills ----
	let monthly = $derived.by(() => {
		const map = new Map<string, number>();
		for (const r of app.receipts) {
			const k = monthKey(r.date);
			map.set(k, Math.round(((map.get(k) ?? 0) + r.total) * 100) / 100);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
	});
	let monthlyMax = $derived(Math.max(1, ...monthly.map(([, v]) => v)));

	// ---- spend by category ----
	let byCategory = $derived.by(() => {
		const map = new Map<Category, number>();
		for (const r of app.receipts) {
			for (const [cat, amount] of Object.entries(r.categoryTotals)) {
				const c = cat as Category;
				map.set(c, Math.round(((map.get(c) ?? 0) + (amount ?? 0)) * 100) / 100);
			}
		}
		return [...map.entries()].sort((a, b) => b[1] - a[1]);
	});
	let categoryMax = $derived(Math.max(1, ...byCategory.map(([, v]) => v)));
	let categorySum = $derived(byCategory.reduce((s, [, v]) => s + v, 0));

	// ---- used vs wasted ----
	let usedCount = $derived(app.waste.filter((w) => w.kind === 'used').length);
	let wastedCount = $derived(app.waste.filter((w) => w.kind === 'wasted').length);
	let usedValue = $derived(
		Math.round(app.waste.filter((w) => w.kind === 'used').reduce((s, w) => s + (w.price ?? 0), 0) * 100) / 100
	);
	let wastedValue = $derived(
		Math.round(app.waste.filter((w) => w.kind === 'wasted').reduce((s, w) => s + (w.price ?? 0), 0) * 100) / 100
	);
	let totalLogged = $derived(usedCount + wastedCount);

	let hasAnyData = $derived(app.receipts.length > 0 || app.waste.length > 0);
</script>

<svelte:head><title>Spending &amp; waste · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Spending &amp; waste</h1>
		<p>Only from bills you scanned and items you logged.</p>
	</div>
</div>

{#if !hasAnyData}
	<div class="card">
		<EmptyState
			title="No data yet"
			message="Scan a bill, or mark items as used or discarded, and the charts will fill in."
		>
			<a href="/scan" class="btn btn-primary btn-sm">Scan a bill</a>
		</EmptyState>
	</div>
{:else}
	<!-- Monthly spend -->
	<section class="card section">
		<h2>Monthly spend</h2>
		{#if monthly.length === 0}
			<p class="muted small">No receipts recorded yet.</p>
		{:else}
			<svg class="chart" viewBox="0 0 320 150" role="img" aria-label="Monthly spend from scanned bills">
				<title>Monthly spend from scanned bills</title>
				{#each monthly as [key, value], i (key)}
					{@const barW = 320 / monthly.length}
					{@const h = Math.max(2, (value / monthlyMax) * 100)}
					<rect
						x={i * barW + barW * 0.22}
						y={118 - h}
						width={barW * 0.56}
						height={h}
						rx="4"
						fill="var(--green)"
					/>
					<text x={i * barW + barW / 2} y="134" text-anchor="middle" font-size="9" fill="var(--text-muted)">
						{monthLabel(key)}
					</text>
					<text x={i * barW + barW / 2} y={112 - h} text-anchor="middle" font-size="9" fill="var(--text-muted)">
						{Math.round(value)}
					</text>
				{/each}
			</svg>
			<p class="small muted" style="margin:0">
				Totals in {currency} from {app.receipts.length} scanned bill{app.receipts.length === 1 ? '' : 's'}.
			</p>
		{/if}
	</section>

	<!-- Spend by category -->
	<section class="card section">
		<h2>Spend by category</h2>
		{#if byCategory.length === 0}
			<p class="muted small">No category totals recorded yet.</p>
		{:else}
			<div class="bars">
				{#each byCategory as [cat, value] (cat)}
					<div class="bar-row">
						<span class="bar-label">
							<Icon name={cat} size={15} />
							<span class="truncate">{cat}</span>
						</span>
						<span class="bar-track">
							<span class="bar-fill" style="width:{(value / categoryMax) * 100}%"></span>
						</span>
						<span class="bar-value small">{currency}{Math.round(value)}</span>
					</div>
				{/each}
			</div>
			<p class="small muted" style="margin:8px 0 0">
				{currency}{Math.round(categorySum)} tracked across {byCategory.length} categories.
			</p>
		{/if}
	</section>

	<!-- Used vs wasted -->
	<section class="card section">
		<h2>Items used vs wasted</h2>
		{#if totalLogged === 0}
			<p class="muted small">
				Nothing logged yet. Use "Used all" or "Discard" on a pantry item and it will show up here.
			</p>
		{:else}
			{@const usedPct = Math.round((usedCount / totalLogged) * 100)}
			<svg class="chart" viewBox="0 0 320 54" role="img" aria-label="Items used versus wasted">
				<title>Items used versus wasted</title>
				<rect x="0" y="8" width="320" height="26" rx="13" fill="var(--red-soft)" />
				<rect x="0" y="8" width={(usedCount / totalLogged) * 320} height="26" rx="13" fill="var(--green)" />
				<text x="8" y="26" font-size="12" font-weight="700" fill="#fff">{usedPct}% used</text>
			</svg>
			<div class="legend small">
				<span><i style="background:var(--green)"></i> Used: {usedCount} item{usedCount === 1 ? '' : 's'} ({currency}{Math.round(usedValue)})</span>
				<span><i style="background:var(--red)"></i> Wasted: {wastedCount} item{wastedCount === 1 ? '' : 's'} ({currency}{Math.round(wastedValue)})</span>
			</div>
		{/if}
	</section>

	<!-- Money saved vs wasted -->
	<section class="card section">
		<h2>Estimated value</h2>
		{#if usedValue === 0 && wastedValue === 0}
			<p class="muted small">No prices recorded on the items you have used or discarded yet.</p>
		{:else}
			<div class="grid-2">
				<div class="stat stat-good">
					<span class="small muted">Value used</span>
					<strong>{currency}{Math.round(usedValue)}</strong>
				</div>
				<div class="stat stat-bad">
					<span class="small muted">Value wasted</span>
					<strong>{currency}{Math.round(wastedValue)}</strong>
				</div>
			</div>
			<p class="small muted" style="margin:10px 0 0">
				Based only on items where a price was recorded, so the real figures may be higher.
			</p>
		{/if}
	</section>

	<!-- Receipts -->
	<section class="card section">
		<h2>Scanned bills</h2>
		{#if app.receipts.length === 0}
			<p class="muted small">No bills scanned yet.</p>
		{:else}
			<div class="stack">
				{#each [...app.receipts].sort((a, b) => b.date.localeCompare(a.date)) as r (r.id)}
					<div class="receipt-row">
						<div style="min-width:0">
							<strong class="truncate" style="display:block">{r.store}</strong>
							<span class="small muted">{r.date} · {r.itemCount} items</span>
						</div>
						<span class="row" style="gap:6px">
							<strong>{currency}{Math.round(r.total)}</strong>
							<button
								class="btn btn-sm btn-ghost"
								onclick={() => app.removeReceipt(r.id)}
								aria-label="Delete receipt from {r.store}"
							>
								<Icon name="trash" size={15} />
							</button>
						</span>
					</div>
				{/each}
			</div>
			<p class="small muted" style="margin:10px 0 0">Bill photos are not stored, only these totals.</p>
		{/if}
	</section>
{/if}

<style>
	.chart {
		width: 100%;
		height: auto;
		display: block;
		margin-bottom: 8px;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.bar-row {
		display: grid;
		grid-template-columns: 112px 1fr 64px;
		align-items: center;
		gap: 8px;
	}
	.bar-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		color: var(--text-muted);
		min-width: 0;
	}
	.bar-track {
		height: 12px;
		background: var(--surface-2);
		border-radius: 999px;
		overflow: hidden;
	}
	.bar-fill {
		display: block;
		height: 100%;
		background: var(--green);
		border-radius: 999px;
	}
	.bar-value {
		text-align: right;
		font-weight: 600;
	}
	.legend {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--text-muted);
	}
	.legend i {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 3px;
		margin-right: 5px;
	}
	.stat {
		padding: 12px;
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat strong {
		font-family: var(--font-head);
		font-size: 1.3rem;
	}
	.stat-good {
		background: var(--green-soft);
	}
	.stat-bad {
		background: var(--red-soft);
	}
	.receipt-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
</style>
