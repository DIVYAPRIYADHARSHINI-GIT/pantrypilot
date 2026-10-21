<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { app } from '$lib/store.svelte';
	import { rankRecipes } from '$lib/rank';

	let vegOnly = $state(false);
	let maxMinutes = $state<number | undefined>(undefined);
	let expiringOnly = $state(false);
	let openId = $state<string | null>(null);
	let added = $state('');

	let ranked = $derived(
		rankRecipes(app.items, {
			warningDays: app.settings.warningDays,
			vegOnly,
			maxMinutes,
			usesExpiringOnly: expiringOnly
		})
	);

	function addMissing(missing: string[]) {
		for (const m of missing) app.addToShopping(m, 1, 'pcs', 'other');
		added = `${missing.length} ingredient${missing.length === 1 ? '' : 's'} added to your shopping list.`;
		setTimeout(() => (added = ''), 2600);
	}
</script>

<svelte:head><title>Recipes · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Recipes</h1>
		<p>Ranked by what you already have.</p>
	</div>
</div>

{#if added}
	<div class="ok" role="status"><Icon name="check" size={18} /><span>{added}</span></div>
{/if}

<div class="card" style="margin-bottom:14px">
	<div class="chip-row">
		<button class="chip" aria-pressed={vegOnly} onclick={() => (vegOnly = !vegOnly)}>Veg only</button>
		<button class="chip" aria-pressed={expiringOnly} onclick={() => (expiringOnly = !expiringOnly)}>
			Uses expiring items
		</button>
		<button
			class="chip"
			aria-pressed={maxMinutes === 20}
			onclick={() => (maxMinutes = maxMinutes === 20 ? undefined : 20)}
		>
			Under 20 min
		</button>
		<button
			class="chip"
			aria-pressed={maxMinutes === 30}
			onclick={() => (maxMinutes = maxMinutes === 30 ? undefined : 30)}
		>
			Under 30 min
		</button>
	</div>
</div>

{#if app.items.length === 0}
	<div class="card">
		<EmptyState title="Add some stock first" message="Recipes are ranked against the items in your pantry.">
			<a href="/scan" class="btn btn-primary btn-sm">Scan a bill</a>
		</EmptyState>
	</div>
{:else if ranked.length === 0}
	<div class="card">
		<EmptyState title="No recipes match these filters" message="Try removing a filter.">
			<button
				class="btn btn-sm"
				onclick={() => {
					vegOnly = false;
					expiringOnly = false;
					maxMinutes = undefined;
				}}>Clear filters</button
			>
		</EmptyState>
	</div>
{:else}
	<div class="stack">
		{#each ranked.slice(0, 25) as r (r.recipe.id)}
			<article class="card recipe">
				<div class="row-between" style="align-items:flex-start">
					<div style="min-width:0">
						<h3 style="margin-bottom:3px">{r.recipe.title}</h3>
						<p class="small muted" style="margin:0">
							{r.recipe.minutes} min · {r.recipe.servings} servings ·
							<span class="badge {r.recipe.veg ? 'badge-fresh' : 'badge-muted'}">
								{r.recipe.veg ? 'Veg' : 'Non-veg'}
							</span>
						</p>
					</div>
					<span class="score badge {r.coverage === 1 ? 'badge-fresh' : 'badge-muted'}">
						You have {r.have.length} of {r.recipe.ingredients.length}
					</span>
				</div>

				{#if r.usesExpiring.length > 0}
					<p class="small" style="margin:9px 0 0;color:var(--amber)">
						<Icon name="warning" size={14} /> Uses {r.usesExpiring.join(', ')} before {r.usesExpiring.length === 1 ? 'it expires' : 'they expire'}
					</p>
				{/if}

				{#if r.missing.length > 0}
					<p class="small muted" style="margin:7px 0 0">Missing: {r.missing.join(', ')}</p>
					<button class="btn btn-sm" style="margin-top:9px" onclick={() => addMissing(r.missing)}>
						<Icon name="plus" size={15} /> Add missing to shopping list
					</button>
				{:else}
					<p class="small" style="margin:7px 0 0;color:var(--green-dark)">
						<Icon name="check" size={14} /> You have everything for this
					</p>
				{/if}

				<button
					class="btn btn-sm btn-ghost"
					style="margin-top:8px"
					aria-expanded={openId === r.recipe.id}
					onclick={() => (openId = openId === r.recipe.id ? null : r.recipe.id)}
				>
					{openId === r.recipe.id ? 'Hide' : 'Show'} ingredients and steps
				</button>

				{#if openId === r.recipe.id}
					<div class="details">
						<h4>Ingredients</h4>
						<ul class="ing">
							{#each r.recipe.ingredients as ing (ing)}
								<li class:have={r.have.includes(ing)}>
									{#if r.have.includes(ing)}<Icon name="check" size={14} />{/if}
									{ing}
								</li>
							{/each}
						</ul>
						<h4>Steps</h4>
						<ol class="steps">
							{#each r.recipe.steps as s, i (i)}<li>{s}</li>{/each}
						</ol>
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<style>
	.recipe h3 {
		font-size: 1.03rem;
	}
	.score {
		flex: none;
	}
	.details {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.details h4 {
		margin: 0 0 6px;
		font-size: 0.88rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ing {
		list-style: none;
		padding: 0;
		margin: 0 0 14px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.ing li {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--surface-2);
		font-size: 0.83rem;
		color: var(--text-muted);
	}
	.ing li.have {
		background: var(--green-soft);
		color: var(--green-dark);
		font-weight: 600;
	}
	:global(:root[data-theme='dark']) .ing li.have {
		color: var(--green);
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		font-size: 0.91rem;
		line-height: 1.6;
	}
	.steps li {
		margin-bottom: 6px;
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
</style>
