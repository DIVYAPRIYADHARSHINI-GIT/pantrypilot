<script lang="ts">
	import Icon from './Icon.svelte';
	import { app } from '$lib/store.svelte';
	import { daysLeftLabel, formatDate } from '$lib/dates';
	import type { PantryItem } from '$lib/types';

	interface Props {
		item: PantryItem;
		onedit?: (item: PantryItem) => void;
		ondelete?: (item: PantryItem) => void;
		ondiscard?: (item: PantryItem) => void;
		compact?: boolean;
	}
	let { item, onedit, ondelete, ondiscard, compact = false }: Props = $props();

	let state = $derived(app.stateOf(item));
	let open = $state(false);

	function useSome() {
		const hitZero = app.useSome(item.id, 1);
		if (hitZero) app.addToShopping(item.name, 1, item.unit, item.category);
	}
</script>

<article class="item-card" data-state={state}>
	<div class="main">
		<span class="cat-icon" aria-hidden="true"><Icon name={item.category} size={20} /></span>
		<div class="info">
			<div class="name-row">
				<h3 class="truncate">{item.name}</h3>
				<span class="badge badge-{state === 'fresh' ? 'fresh' : state === 'soon' ? 'soon' : 'expired'}">
					{daysLeftLabel(item.expiryDate)}
				</span>
			</div>
			<p class="meta small muted">
				{item.quantity}
				{item.unit} · {item.category} · {item.place}
				{#if item.expiryEstimated}<span class="badge badge-muted" title="Expiry estimated from typical shelf life">Estimated</span>{/if}
			</p>
			{#if !compact}
				<p class="small muted" style="margin:0">
					Expires {formatDate(item.expiryDate)}{item.price !== undefined
						? ` · ${app.settings.currency}${item.price}`
						: ''}
				</p>
			{/if}
		</div>
	</div>

	{#if !compact}
		<div class="actions">
			<button class="btn btn-sm" onclick={useSome}>Used some</button>
			<button class="btn btn-sm" onclick={() => app.useAll(item.id)}>Used all</button>
			<button
				class="btn btn-sm"
				onclick={() => (ondiscard ? ondiscard(item) : app.discard(item.id))}
				title="Mark as wasted"
			>
				Discard
			</button>
			<button class="btn btn-sm btn-ghost" onclick={() => onedit?.(item)} aria-label="Edit {item.name}">
				<Icon name="edit" size={16} />
			</button>
			<button class="btn btn-sm btn-ghost" onclick={() => ondelete?.(item)} aria-label="Delete {item.name}">
				<Icon name="trash" size={16} />
			</button>
		</div>
	{/if}
	{#if open}<span></span>{/if}
</article>

<style>
	.item-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px solid var(--green);
		border-radius: var(--radius-sm);
		padding: 11px 12px;
		box-shadow: var(--shadow);
	}
	.item-card[data-state='soon'] {
		border-left-color: var(--amber);
	}
	.item-card[data-state='expired'] {
		border-left-color: var(--red);
	}
	.main {
		display: flex;
		gap: 11px;
		align-items: flex-start;
	}
	.cat-icon {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 9px;
		background: var(--surface-2);
		color: var(--green-dark);
		display: grid;
		place-items: center;
	}
	:global(:root[data-theme='dark']) .cat-icon {
		color: var(--green);
	}
	.info {
		min-width: 0;
		flex: 1;
	}
	.name-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.name-row h3 {
		margin: 0;
		font-size: 0.98rem;
	}
	.meta {
		margin: 2px 0 0;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}
</style>
