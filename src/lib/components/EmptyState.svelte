<script lang="ts">
	// Friendly empty-state illustration: an original drawn pantry shelf with a leaf.
	interface Props {
		title: string;
		message?: string;
		children?: import('svelte').Snippet;
	}
	let { title, message, children }: Props = $props();
</script>

<div class="empty">
	<svg width="132" height="104" viewBox="0 0 132 104" fill="none" role="img" aria-label="An empty pantry shelf">
		<title>An empty pantry shelf</title>
		<rect x="18" y="16" width="96" height="74" rx="8" stroke="var(--border)" stroke-width="2.5" fill="var(--surface-2)" />
		<path d="M18 52h96" stroke="var(--border)" stroke-width="2.5" />
		<rect x="31" y="30" width="15" height="18" rx="3" stroke="var(--green)" stroke-width="2" fill="none" />
		<rect x="53" y="34" width="13" height="14" rx="2.5" stroke="var(--amber)" stroke-width="2" fill="none" />
		<circle cx="88" cy="40" r="7.5" stroke="var(--green)" stroke-width="2" fill="none" />
		<path d="M46 78s-1-9 4.5-13.5S64 61 64 61s.3 9-5 13.5S46 78 46 78Z" stroke="var(--green)" stroke-width="2" fill="none" stroke-linejoin="round" />
		<path d="M51 74l9-9" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" />
		<path d="M78 70h18M78 78h12" stroke="var(--border)" stroke-width="2.5" stroke-linecap="round" />
	</svg>
	<h3>{title}</h3>
	{#if message}<p class="muted">{message}</p>{/if}
	{#if children}
		<div style="margin-top:12px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
			{@render children()}
		</div>
	{/if}
</div>
