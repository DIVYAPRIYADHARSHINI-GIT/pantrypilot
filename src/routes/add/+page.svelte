<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { app } from '$lib/store.svelte';
	import { suggestNames, matchCatalog } from '$lib/matcher';
	import { estimateShelfLife } from '$lib/shelfLife';
	import { todayISO } from '$lib/dates';
	import type { Category, StoragePlace } from '$lib/types';

	const CATEGORIES: Category[] = [
		'dairy', 'vegetables', 'fruits', 'grains', 'snacks', 'meat',
		'beverages', 'bakery', 'spices', 'frozen', 'household', 'other'
	];
	const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'pkt', 'dozen', 'bunch'];
	const QUICK = ['Milk', 'Bread', 'Eggs', 'Tomato', 'Onion', 'Potato', 'Curd', 'Rice', 'Paneer', 'Banana'];

	let name = $state(page.url.searchParams.get('name') ?? '');
	let barcode = $state(page.url.searchParams.get('barcode') ?? '');
	let brand = $state(page.url.searchParams.get('brand') ?? '');
	let quantity = $state(1);
	let unit = $state(app.settings.defaultUnit);
	let category = $state<Category>((page.url.searchParams.get('category') as Category) || 'other');
	let place = $state<StoragePlace>(app.settings.defaultPlace);
	let purchaseDate = $state(todayISO());
	let useEstimate = $state(true);
	let expiryDate = $state('');
	let price = $state<number | undefined>(undefined);
	let notes = $state('');
	let showSuggest = $state(false);
	let saved = $state('');

	let estimate = $derived(
		estimateShelfLife({
			name,
			category,
			catalogDays: matchCatalog(name).entry ? matchCatalog(name).shelfLife : undefined,
			purchaseDate,
			settings: app.settings
		})
	);

	let effectiveExpiry = $derived(useEstimate ? estimate.expiryDate : expiryDate);

	function applyName(value: string) {
		name = value;
		const m = matchCatalog(value);
		if (m.entry) {
			category = m.category;
			place = m.place;
			unit = m.unit;
		}
		showSuggest = false;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		const expiry = effectiveExpiry || estimate.expiryDate;

		const dup = app.findDuplicate(name, place);
		if (dup) {
			app.mergeQuantity(dup.id, quantity, price ?? dup.price);
			saved = `Added ${quantity} ${unit} to the existing ${dup.name}.`;
		} else {
			app.addItem({
				name: name.trim(),
				quantity,
				unit,
				category,
				place,
				purchaseDate,
				expiryDate: expiry,
				expiryEstimated: useEstimate,
				price,
				notes: notes.trim() || undefined,
				barcode: barcode.trim() || undefined,
				brand: brand.trim() || undefined
			});
			saved = `${name.trim()} added to your pantry.`;
		}
		setTimeout(() => goto('/pantry'), 700);
	}
</script>

<svelte:head><title>Add item · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Add item</h1>
		<p>Add something to the pantry by hand.</p>
	</div>
	<a href="/barcode" class="btn btn-sm"><Icon name="barcode" size={16} /> Barcode</a>
</div>

{#if saved}
	<div class="notice-ok" role="status"><Icon name="check" size={18} /><span>{saved}</span></div>
{/if}

<div class="card" style="margin-bottom:12px">
	<span class="label">Quick add</span>
	<div class="chip-row" style="margin-top:6px">
		{#each QUICK as q (q)}
			<button class="chip" onclick={() => applyName(q)}>{q}</button>
		{/each}
	</div>
</div>

<form class="card" onsubmit={submit}>
	<div class="field" style="position:relative">
		<label for="item-name">Name</label>
		<input
			id="item-name"
			type="text"
			bind:value={name}
			placeholder="e.g. Milk"
			required
			autocomplete="off"
			oninput={() => (showSuggest = true)}
			onblur={() => setTimeout(() => (showSuggest = false), 150)}
		/>
		{#if showSuggest && name.trim().length > 1}
			{@const sugg = suggestNames(name, 6)}
			{#if sugg.length > 0}
				<ul class="suggest">
					{#each sugg as s (s)}
						<li><button type="button" onclick={() => applyName(s)}>{s}</button></li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>

	<div class="grid-2">
		<label class="field"><span>Quantity</span><input type="number" min="0" step="0.01" bind:value={quantity} /></label>
		<label class="field">
			<span>Unit</span>
			<select bind:value={unit}>
				{#each UNITS as u (u)}<option value={u}>{u}</option>{/each}
			</select>
		</label>
	</div>

	<div class="grid-2">
		<label class="field">
			<span>Category</span>
			<select bind:value={category}>
				{#each CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Storage place</span>
			<select bind:value={place}>
				<option value="fridge">fridge</option>
				<option value="freezer">freezer</option>
				<option value="shelf">shelf</option>
			</select>
		</label>
	</div>

	<label class="field"><span>Purchase date</span><input type="date" bind:value={purchaseDate} /></label>

	<div class="field">
		<label class="row" style="gap:9px">
			<input type="checkbox" bind:checked={useEstimate} />
			<span>Use shelf-life estimate ({estimate.days} days → {estimate.expiryDate})</span>
		</label>
	</div>

	{#if !useEstimate}
		<label class="field"><span>Expiry date</span><input type="date" bind:value={expiryDate} required /></label>
	{/if}

	<div class="grid-2">
		<label class="field"><span>Price ({app.settings.currency})</span><input type="number" min="0" step="0.01" bind:value={price} /></label>
		<label class="field"><span>Barcode</span><input type="text" bind:value={barcode} placeholder="optional" /></label>
	</div>

	<label class="field"><span>Notes</span><input type="text" bind:value={notes} placeholder="optional" /></label>

	<button type="submit" class="btn btn-primary btn-block">
		<Icon name="plus" size={18} /> Add to pantry
	</button>
</form>

<style>
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
		max-height: 210px;
		overflow-y: auto;
	}
	.suggest button {
		width: 100%;
		text-align: left;
		padding: 9px 10px;
		border: 0;
		background: transparent;
		border-radius: 7px;
		cursor: pointer;
		min-height: 40px;
	}
	.suggest button:hover {
		background: var(--green-soft);
	}
	.notice-ok {
		display: flex;
		gap: 9px;
		align-items: center;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		background: var(--green-soft);
		border: 1px solid var(--green);
		color: var(--green-dark);
		margin-bottom: 12px;
		font-size: 0.9rem;
	}
	:global(:root[data-theme='dark']) .notice-ok {
		color: var(--green);
	}
</style>
