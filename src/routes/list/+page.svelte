<script lang="ts">
	// Shopping list. "Move bought items to pantry" reuses the same review flow
	// (editable rows + estimated expiry) as the bill scanner.
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ReviewList from '$lib/components/ReviewList.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { app } from '$lib/store.svelte';
	import { matchCatalog, suggestNames } from '$lib/matcher';
	import { estimateShelfLife } from '$lib/shelfLife';
	import { todayISO } from '$lib/dates';
	import { uid } from '$lib/storage';
	import type { ReviewRow, Category } from '$lib/types';

	let newName = $state('');
	let newQty = $state(1);
	let showSuggest = $state(false);

	let reviewing = $state(false);
	let rows = $state<ReviewRow[]>([]);
	let purchaseDate = $state(todayISO());
	let mergePrompt = $state<{ open: boolean; names: string[] }>({ open: false, names: [] });
	let savedMessage = $state('');

	let grouped = $derived.by(() => {
		const map = new Map<Category, typeof app.shopping>();
		for (const s of app.shopping) {
			const list = map.get(s.category) ?? [];
			list.push(s);
			map.set(s.category, list);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	let checked = $derived(app.shopping.filter((s) => s.checked));

	function add(e: SubmitEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (!name) return;
		const m = matchCatalog(name);
		app.addToShopping(m.entry ? m.name : name, newQty, m.unit, m.category);
		newName = '';
		newQty = 1;
		showSuggest = false;
	}

	/** Build review rows from the ticked items, with estimated expiry dates. */
	function startReview() {
		purchaseDate = todayISO();
		rows = checked.map((s) => {
			const m = matchCatalog(s.name);
			const est = estimateShelfLife({
				name: m.name,
				category: m.category,
				catalogDays: m.entry ? m.shelfLife : undefined,
				purchaseDate,
				settings: app.settings
			});
			return {
				id: uid(),
				selected: true,
				name: m.entry ? m.name : s.name,
				rawName: '',
				quantity: s.quantity,
				unit: s.unit,
				category: m.entry ? m.category : s.category,
				place: m.entry ? m.place : app.settings.defaultPlace,
				price: undefined,
				expiryDate: est.expiryDate,
				expiryEstimated: true,
				confidence: m.confidence,
				nonFood: m.nonFood
			};
		});
		reviewing = true;
	}

	let selectedRows = $derived(rows.filter((r) => r.selected && r.name.trim()));

	function commitToPantry() {
		const dupes = selectedRows.filter((r) => app.findDuplicate(r.name, r.place));
		if (dupes.length > 0) {
			mergePrompt = { open: true, names: dupes.map((d) => d.name) };
			return;
		}
		finish(false);
	}

	function finish(merge: boolean) {
		let added = 0;
		let merged = 0;
		for (const r of selectedRows) {
			const dup = app.findDuplicate(r.name, r.place);
			if (dup && merge) {
				app.mergeQuantity(dup.id, r.quantity, r.price ?? dup.price);
				merged++;
			} else {
				app.addItem({
					name: r.name.trim(),
					quantity: r.quantity,
					unit: r.unit,
					category: r.category,
					place: r.place,
					purchaseDate,
					expiryDate: r.expiryDate,
					expiryEstimated: r.expiryEstimated,
					price: r.price
				});
				added++;
			}
		}
		app.clearCheckedShopping();
		mergePrompt = { open: false, names: [] };
		reviewing = false;
		rows = [];
		savedMessage = `${added} moved to the pantry${merged > 0 ? `, ${merged} merged into existing stock` : ''}.`;
		setTimeout(() => (savedMessage = ''), 3000);
	}
</script>

<svelte:head><title>Shopping list · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Shopping list</h1>
		<p>{app.shopping.length} item{app.shopping.length === 1 ? '' : 's'} · {checked.length} ticked</p>
	</div>
	{#if reviewing}
		<button class="btn btn-sm" onclick={() => (reviewing = false)}>Back to list</button>
	{/if}
</div>

{#if savedMessage}
	<div class="ok" role="status"><Icon name="check" size={18} /><span>{savedMessage}</span></div>
{/if}

{#if reviewing}
	<div class="card">
		<h3>Review before adding</h3>
		<p class="small muted">
			Expiry dates are estimated from typical shelf life. Adjust anything that looks wrong.
		</p>
		<label class="field" style="max-width:220px">
			<span>Purchase date</span>
			<input type="date" bind:value={purchaseDate} />
		</label>
		<ReviewList bind:rows {purchaseDate} onchange={(r) => (rows = r)} />
	</div>
	<button
		class="btn btn-primary btn-block"
		style="margin-top:12px"
		onclick={commitToPantry}
		disabled={selectedRows.length === 0}
	>
		<Icon name="check" size={18} /> Add {selectedRows.length} to pantry
	</button>
{:else}
	<form class="card" onsubmit={add} style="margin-bottom:14px">
		<div class="row" style="align-items:flex-end;gap:8px">
			<div class="field" style="flex:1;margin:0;position:relative">
				<label for="sl-name">Add an item</label>
				<input
					id="sl-name"
					type="text"
					bind:value={newName}
					placeholder="e.g. Milk"
					autocomplete="off"
					oninput={() => (showSuggest = true)}
					onblur={() => setTimeout(() => (showSuggest = false), 150)}
				/>
				{#if showSuggest && newName.trim().length > 1}
					{@const sugg = suggestNames(newName, 5)}
					{#if sugg.length > 0}
						<ul class="suggest">
							{#each sugg as s (s)}
								<li>
									<button type="button" onclick={() => { newName = s; showSuggest = false; }}>{s}</button>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
			<label class="field" style="width:84px;margin:0">
				<span>Qty</span>
				<input type="number" min="1" step="1" bind:value={newQty} />
			</label>
			<button type="submit" class="btn btn-primary" aria-label="Add to list"><Icon name="plus" size={18} /></button>
		</div>
	</form>

	{#if app.shopping.length === 0}
		<div class="card">
			<EmptyState
				title="Your shopping list is empty"
				message="Items are added automatically when stock runs out, or you can add them here."
			>
				<a href="/recipes" class="btn btn-sm">Find recipes</a>
			</EmptyState>
		</div>
	{:else}
		{#each grouped as [category, list] (category)}
			<section class="section">
				<div class="section-head">
					<h2 style="display:flex;align-items:center;gap:7px">
						<Icon name={category} size={18} />
						{category}
					</h2>
					<span class="badge badge-muted">{list.length}</span>
				</div>
				<div class="stack">
					{#each list as s (s.id)}
						<div class="sl-row" class:done={s.checked}>
							<input
								type="checkbox"
								checked={s.checked}
								onchange={() => app.toggleShopping(s.id)}
								aria-label="Mark {s.name} as bought"
							/>
							<span class="sl-name truncate">{s.name}</span>
							<span class="small muted">{s.quantity} {s.unit}</span>
							<button
								class="btn btn-sm btn-ghost"
								onclick={() => app.removeShopping(s.id)}
								aria-label="Remove {s.name}"
							>
								<Icon name="trash" size={15} />
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		{#if checked.length > 0}
			<div class="save-bar">
				<strong>{checked.length} ticked</strong>
				<button class="btn btn-primary" onclick={startReview}>Move bought items to pantry</button>
			</div>
		{/if}
	{/if}
{/if}

<ConfirmDialog
	open={mergePrompt.open}
	title="Already in your pantry"
	message="{mergePrompt.names.slice(0, 3).join(', ')} already exist. Increase the existing quantity instead of creating duplicates?"
	confirmLabel="Increase quantity"
	cancelLabel="Add as new"
	onconfirm={() => finish(true)}
	oncancel={() => finish(false)}
/>

<style>
	.sl-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		min-height: 48px;
	}
	.sl-row.done .sl-name {
		text-decoration: line-through;
		color: var(--text-muted);
	}
	.sl-name {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		font-size: 0.95rem;
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
	.save-bar {
		position: sticky;
		bottom: calc(var(--nav-h) + 8px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 11px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
	}
	.ok {
		display: flex;
		gap: 9px;
		align-items: center;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		background: var(--green-soft);
		border: 1px solid var(--green);
		color: var(--green-dark);
		margin-bottom: 12px;
		font-size: 0.89rem;
	}
	:global(:root[data-theme='dark']) .ok {
		color: var(--green);
	}
	@media (min-width: 900px) {
		.save-bar {
			bottom: 14px;
		}
	}
</style>
