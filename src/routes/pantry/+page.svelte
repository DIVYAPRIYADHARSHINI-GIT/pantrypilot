<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { app } from '$lib/store.svelte';
	import { daysLeft } from '$lib/dates';
	import type { PantryItem, StoragePlace, Category } from '$lib/types';

	const PLACES: Array<{ id: StoragePlace; label: string }> = [
		{ id: 'fridge', label: 'Fridge' },
		{ id: 'freezer', label: 'Freezer' },
		{ id: 'shelf', label: 'Shelf' }
	];

	let query = $state('');
	let categoryFilter = $state<Category | 'all'>('all');
	let stateFilter = $state<'all' | 'soon' | 'expired'>('all');
	let sortBy = $state<'expiry' | 'name' | 'added'>('expiry');

	let deleteTarget = $state<PantryItem | null>(null);
	let discardTarget = $state<PantryItem | null>(null);
	let editTarget = $state<PantryItem | null>(null);

	let categories = $derived([...new Set(app.items.map((i) => i.category))].sort());

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		let out = app.items.filter((i) => {
			if (q && !i.name.toLowerCase().includes(q)) return false;
			if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
			const d = daysLeft(i.expiryDate);
			if (stateFilter === 'soon' && !(d >= 0 && d <= app.settings.warningDays)) return false;
			if (stateFilter === 'expired' && d >= 0) return false;
			return true;
		});
		out = [...out].sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'added') return b.createdAt - a.createdAt;
			return daysLeft(a.expiryDate) - daysLeft(b.expiryDate);
		});
		return out;
	});

	function byPlace(place: StoragePlace) {
		return filtered.filter((i) => i.place === place);
	}

	function saveEdit(e: SubmitEvent) {
		e.preventDefault();
		if (!editTarget) return;
		app.updateItem(editTarget.id, {
			name: editTarget.name,
			quantity: editTarget.quantity,
			unit: editTarget.unit,
			category: editTarget.category,
			place: editTarget.place,
			expiryDate: editTarget.expiryDate,
			expiryEstimated: false,
			price: editTarget.price,
			notes: editTarget.notes
		});
		editTarget = null;
	}
</script>

<svelte:head><title>Pantry · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Pantry</h1>
		<p>{app.items.length} item{app.items.length === 1 ? '' : 's'} in stock</p>
	</div>
	<a href="/add" class="btn btn-primary btn-sm"><Icon name="plus" size={17} /> Add</a>
</div>

<div class="card" style="margin-bottom:14px">
	<label class="search">
		<Icon name="search" size={18} />
		<input type="search" bind:value={query} placeholder="Search your pantry" aria-label="Search pantry items" />
	</label>

	<div class="chip-row" style="margin-top:10px">
		<button class="chip" aria-pressed={stateFilter === 'all'} onclick={() => (stateFilter = 'all')}>All</button>
		<button class="chip" aria-pressed={stateFilter === 'soon'} onclick={() => (stateFilter = 'soon')}>
			Expiring soon
		</button>
		<button class="chip" aria-pressed={stateFilter === 'expired'} onclick={() => (stateFilter = 'expired')}>
			Expired
		</button>
	</div>

	<div class="grid-2" style="margin-top:10px">
		<label class="field" style="margin:0">
			<span>Category</span>
			<select bind:value={categoryFilter}>
				<option value="all">All categories</option>
				{#each categories as c (c)}<option value={c}>{c}</option>{/each}
			</select>
		</label>
		<label class="field" style="margin:0">
			<span>Sort by</span>
			<select bind:value={sortBy}>
				<option value="expiry">Expiry date</option>
				<option value="name">Name</option>
				<option value="added">Recently added</option>
			</select>
		</label>
	</div>
</div>

{#if app.items.length === 0}
	<div class="card">
		<EmptyState title="Nothing in the pantry yet" message="Scan a bill or add an item to get started.">
			<a href="/scan" class="btn btn-primary btn-sm">Scan a bill</a>
			<a href="/add" class="btn btn-sm">Add manually</a>
		</EmptyState>
	</div>
{:else if filtered.length === 0}
	<div class="card">
		<EmptyState title="No items match" message="Try a different search or clear the filters.">
			<button
				class="btn btn-sm"
				onclick={() => {
					query = '';
					categoryFilter = 'all';
					stateFilter = 'all';
				}}>Clear filters</button
			>
		</EmptyState>
	</div>
{:else}
	{#each PLACES as place (place.id)}
		{@const list = byPlace(place.id)}
		{#if list.length > 0}
			<section class="section">
				<div class="section-head">
					<h2>{place.label}</h2>
					<span class="badge badge-muted">{list.length}</span>
				</div>
				<div class="stack">
					{#each list as item (item.id)}
						<ItemCard
							{item}
							onedit={(i) => (editTarget = { ...i })}
							ondelete={(i) => (deleteTarget = i)}
							ondiscard={(i) => (discardTarget = i)}
						/>
					{/each}
				</div>
			</section>
		{/if}
	{/each}
{/if}

{#if editTarget}
	<div class="backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) editTarget = null; }}>
		<form class="sheet" onsubmit={saveEdit}>
			<div class="row-between" style="margin-bottom:10px">
				<h2 style="margin:0">Edit item</h2>
				<button type="button" class="btn btn-sm btn-ghost" onclick={() => (editTarget = null)} aria-label="Close">
					<Icon name="close" size={18} />
				</button>
			</div>
			<label class="field"><span>Name</span><input type="text" bind:value={editTarget.name} required /></label>
			<div class="grid-2">
				<label class="field"><span>Quantity</span><input type="number" min="0" step="0.01" bind:value={editTarget.quantity} /></label>
				<label class="field"><span>Unit</span><input type="text" bind:value={editTarget.unit} /></label>
			</div>
			<div class="grid-2">
				<label class="field">
					<span>Category</span>
					<select bind:value={editTarget.category}>
						{#each ['dairy', 'vegetables', 'fruits', 'grains', 'snacks', 'meat', 'beverages', 'bakery', 'spices', 'frozen', 'household', 'other'] as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Place</span>
					<select bind:value={editTarget.place}>
						<option value="fridge">fridge</option>
						<option value="freezer">freezer</option>
						<option value="shelf">shelf</option>
					</select>
				</label>
			</div>
			<div class="grid-2">
				<label class="field"><span>Expires</span><input type="date" bind:value={editTarget.expiryDate} /></label>
				<label class="field"><span>Price ({app.settings.currency})</span><input type="number" min="0" step="0.01" bind:value={editTarget.price} /></label>
			</div>
			<label class="field"><span>Notes</span><input type="text" bind:value={editTarget.notes} /></label>
			<div class="btn-row" style="justify-content:flex-end">
				<button type="button" class="btn" onclick={() => (editTarget = null)}>Cancel</button>
				<button type="submit" class="btn btn-primary">Save</button>
			</div>
		</form>
	</div>
{/if}

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete {deleteTarget?.name}?"
	message="This removes the item from your pantry. It is not counted as used or wasted."
	confirmLabel="Delete"
	danger
	onconfirm={() => {
		if (deleteTarget) app.removeItem(deleteTarget.id);
		deleteTarget = null;
	}}
	oncancel={() => (deleteTarget = null)}
/>

<ConfirmDialog
	open={discardTarget !== null}
	title="Discard {discardTarget?.name}?"
	message="This marks the item as wasted and counts its price in your waste total."
	confirmLabel="Mark as wasted"
	danger
	onconfirm={() => {
		if (discardTarget) app.discard(discardTarget.id);
		discardTarget = null;
	}}
	oncancel={() => (discardTarget = null)}
/>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text-muted);
	}
	.search input {
		border: 0;
		padding-left: 0;
		background: transparent;
	}
	.search input:focus {
		outline: none;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 24, 18, 0.5);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 120;
		padding: 0;
	}
	.sheet {
		background: var(--surface);
		border-radius: var(--radius) var(--radius) 0 0;
		padding: 18px;
		width: 100%;
		max-width: 540px;
		max-height: 92dvh;
		overflow-y: auto;
		box-shadow: var(--shadow-lg);
	}
	@media (min-width: 700px) {
		.backdrop {
			align-items: center;
			padding: 18px;
		}
		.sheet {
			border-radius: var(--radius);
		}
	}
</style>
