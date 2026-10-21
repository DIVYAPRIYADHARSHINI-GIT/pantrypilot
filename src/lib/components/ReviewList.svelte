<script lang="ts">
	// Mandatory review step. Cards on mobile, a wider grid on desktop.
	import Icon from '$lib/components/Icon.svelte';
	import { app } from '$lib/store.svelte';
	import { suggestNames, matchCatalog } from '$lib/matcher';
	import { estimateShelfLife } from '$lib/shelfLife';
	import { blankRow } from '$lib/reviewRows';
	import type { ReviewRow, Category, StoragePlace } from '$lib/types';

	interface Props {
		rows: ReviewRow[];
		purchaseDate: string;
		onchange: (rows: ReviewRow[]) => void;
	}
	let { rows = $bindable(), purchaseDate, onchange }: Props = $props();

	const CATEGORIES: Category[] = [
		'dairy', 'vegetables', 'fruits', 'grains', 'snacks', 'meat',
		'beverages', 'bakery', 'spices', 'frozen', 'household', 'other'
	];
	const PLACES: StoragePlace[] = ['fridge', 'freezer', 'shelf'];
	const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'pkt', 'dozen', 'bunch'];

	let activeSuggest = $state<string | null>(null);

	let selectedRows = $derived(rows.filter((r) => r.selected));
	let selectedTotal = $derived(
		Math.round(selectedRows.reduce((s, r) => s + (r.price ?? 0), 0) * 100) / 100
	);

	function update(id: string, patch: Partial<ReviewRow>) {
		rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
		onchange(rows);
	}

	/** Re-match the catalog when the user edits a name, refreshing the estimate. */
	function onNameChange(row: ReviewRow, value: string) {
		const m = matchCatalog(value);
		const est = estimateShelfLife({
			name: m.name,
			category: m.category,
			catalogDays: m.entry ? m.shelfLife : undefined,
			purchaseDate,
			settings: app.settings
		});
		update(row.id, {
			name: value,
			category: m.entry ? m.category : row.category,
			place: m.entry ? m.place : row.place,
			unit: m.entry ? m.unit : row.unit,
			confidence: value.trim() ? Math.max(m.confidence, 0.9) : row.confidence,
			expiryDate: m.entry ? est.expiryDate : row.expiryDate,
			expiryEstimated: true,
			nonFood: m.nonFood
		});
	}

	function pickSuggestion(row: ReviewRow, name: string) {
		onNameChange(row, name);
		activeSuggest = null;
	}

	function deleteRow(id: string) {
		rows = rows.filter((r) => r.id !== id);
		onchange(rows);
	}

	function addRow() {
		rows = [...rows, blankRow(app.settings, purchaseDate)];
		onchange(rows);
	}

	function toggleAll(on: boolean) {
		rows = rows.map((r) => ({ ...r, selected: on }));
		onchange(rows);
	}
</script>

<div class="review-head row-between">
	<div>
		<strong>{selectedRows.length} of {rows.length} selected</strong>
		<p class="small muted" style="margin:0">
			Total {app.settings.currency}{selectedTotal.toFixed(2)}
		</p>
	</div>
	<div class="btn-row">
		<button class="btn btn-sm" onclick={() => toggleAll(true)}>Select all</button>
		<button class="btn btn-sm" onclick={() => toggleAll(false)}>Clear</button>
	</div>
</div>

<div class="rows">
	{#each rows as row (row.id)}
		<div class="review-row" class:low={row.confidence < 0.6} class:nonfood={row.nonFood}>
			<div class="row-top">
				<input
					type="checkbox"
					checked={row.selected}
					onchange={(e) => update(row.id, { selected: e.currentTarget.checked })}
					aria-label="Include {row.name || 'this item'}"
				/>
				<div class="name-field">
					<input
						type="text"
						value={row.name}
						placeholder="Item name"
						aria-label="Item name"
						oninput={(e) => update(row.id, { name: e.currentTarget.value })}
						onchange={(e) => onNameChange(row, e.currentTarget.value)}
						onfocus={() => (activeSuggest = row.id)}
						onblur={() => setTimeout(() => { if (activeSuggest === row.id) activeSuggest = null; }, 150)}
					/>
					{#if activeSuggest === row.id && row.name.trim().length > 1}
						{@const sugg = suggestNames(row.name, 6)}
						{#if sugg.length > 0}
							<ul class="suggest" role="listbox">
								{#each sugg as s (s)}
									<li>
										<button type="button" onclick={() => pickSuggestion(row, s)}>{s}</button>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
				<button class="btn btn-sm btn-ghost del" onclick={() => deleteRow(row.id)} aria-label="Delete row">
					<Icon name="trash" size={16} />
				</button>
			</div>

			<div class="flags">
				{#if row.confidence < 0.6}
					<span class="badge badge-soon" title="This name could not be matched confidently">Check name</span>
				{/if}
				{#if row.nonFood}
					<span class="badge badge-muted">Not food</span>
				{/if}
				{#if row.expiryEstimated}
					<span class="badge badge-muted" title="Estimated from typical shelf life">Estimated</span>
				{/if}
				{#if row.rawName}
					<span class="small muted truncate raw" title={row.rawName}>Read as: {row.rawName}</span>
				{/if}
			</div>

			<div class="fields">
				<label class="f">
					<span class="label">Qty</span>
					<input
						type="number"
						min="0"
						step="0.01"
						value={row.quantity}
						onchange={(e) => update(row.id, { quantity: Number(e.currentTarget.value) || 0 })}
					/>
				</label>
				<label class="f">
					<span class="label">Unit</span>
					<select value={row.unit} onchange={(e) => update(row.id, { unit: e.currentTarget.value })}>
						{#each UNITS as u (u)}<option value={u}>{u}</option>{/each}
						{#if !UNITS.includes(row.unit)}<option value={row.unit}>{row.unit}</option>{/if}
					</select>
				</label>
				<label class="f">
					<span class="label">Category</span>
					<select
						value={row.category}
						onchange={(e) => update(row.id, { category: e.currentTarget.value as Category })}
					>
						{#each CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
					</select>
				</label>
				<label class="f">
					<span class="label">Place</span>
					<select
						value={row.place}
						onchange={(e) => update(row.id, { place: e.currentTarget.value as StoragePlace })}
					>
						{#each PLACES as p (p)}<option value={p}>{p}</option>{/each}
					</select>
				</label>
				<label class="f">
					<span class="label">Price ({app.settings.currency})</span>
					<input
						type="number"
						min="0"
						step="0.01"
						value={row.price ?? ''}
						onchange={(e) =>
							update(row.id, {
								price: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)
							})}
					/>
				</label>
				<label class="f">
					<span class="label">Expires</span>
					<input
						type="date"
						value={row.expiryDate}
						onchange={(e) => update(row.id, { expiryDate: e.currentTarget.value, expiryEstimated: false })}
					/>
				</label>
			</div>
		</div>
	{/each}
</div>

<button class="btn btn-block" style="margin-top:10px" onclick={addRow}>
	<Icon name="plus" size={17} /> Add missing item
</button>

<style>
	.review-head {
		padding: 10px 12px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		margin-bottom: 10px;
		flex-wrap: wrap;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.review-row {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		padding: 11px;
	}
	.review-row.low {
		border-color: var(--amber);
		background: var(--amber-soft);
	}
	.review-row.nonfood {
		opacity: 0.86;
	}
	.row-top {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.name-field {
		flex: 1;
		min-width: 0;
		position: relative;
	}
	.del {
		flex: none;
	}
	.flags {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 7px 0 0 31px;
	}
	.raw {
		max-width: 100%;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin-top: 9px;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.suggest {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 20;
		margin: 3px 0 0;
		padding: 4px;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		max-height: 200px;
		overflow-y: auto;
	}
	.suggest button {
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border: 0;
		background: transparent;
		border-radius: 7px;
		cursor: pointer;
		min-height: 40px;
	}
	.suggest button:hover {
		background: var(--green-soft);
	}

	@media (min-width: 700px) {
		.fields {
			grid-template-columns: repeat(6, 1fr);
		}
	}
</style>
