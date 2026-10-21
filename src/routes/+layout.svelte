<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { app } from '$lib/store.svelte';
	import { storageStatus } from '$lib/storage';

	let { children } = $props();

	let mounted = $state(false);

	onMount(() => {
		app.init();
		applyTheme();
		mounted = true;
	});

	function applyTheme() {
		const t = app.settings.theme;
		const dark =
			t === 'dark' ||
			(t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	}

	// re-apply whenever the setting changes (read-only effect, so no loop)
	$effect(() => {
		void app.settings.theme;
		if (mounted) applyTheme();
	});

	const NAV = [
		{ href: '/', label: 'Home', icon: 'home', center: false },
		{ href: '/pantry', label: 'Pantry', icon: 'pantry', center: false },
		{ href: '/scan', label: 'Scan', icon: 'scan', center: true },
		{ href: '/recipes', label: 'Recipes', icon: 'recipes', center: false },
		{ href: '/list', label: 'List', icon: 'list', center: false }
	];

	let current = $derived(page.url.pathname);

	function isActive(href: string) {
		return href === '/' ? current === '/' : current.startsWith(href);
	}

	let alerts = $derived(mounted ? app.alertCount : 0);
	let storageWarning = $derived(mounted ? storageStatus() : 'ok');
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
	<meta name="theme-color" content="#2F9E6B" />
</svelte:head>

<div class="app-shell">
	<!-- Desktop sidebar -->
	<aside class="sidebar" aria-label="Main navigation">
		<a href="/" class="brand">
			<span class="brand-mark" aria-hidden="true"><Icon name="leaf" size={20} /></span>
			<span class="brand-text">
				<strong>PantryPilot</strong>
				<small>Scan. Stock. Waste less.</small>
			</span>
		</a>
		<nav>
			{#each NAV as n (n.href)}
				<a href={n.href} class="side-link" aria-current={isActive(n.href) ? 'page' : undefined}>
					<Icon name={n.icon} size={20} />
					<span>{n.label}</span>
					{#if n.href === '/' && alerts > 0}<span class="dot-badge">{alerts}</span>{/if}
				</a>
			{/each}
			<a href="/charts" class="side-link" aria-current={isActive('/charts') ? 'page' : undefined}>
				<Icon name="chart" size={20} /><span>Spending</span>
			</a>
			<a href="/settings" class="side-link" aria-current={isActive('/settings') ? 'page' : undefined}>
				<Icon name="settings" size={20} /><span>Settings</span>
			</a>
		</nav>
		<p class="side-foot small muted">
			All data stays in this browser. Bill photos are processed on your device only.
		</p>
	</aside>

	<main class="page">
		{#if storageWarning === 'full'}
			<div class="banner banner-warn" role="status">
				<Icon name="warning" size={18} />
				<span>Browser storage is full. Export a backup and remove some old items.</span>
			</div>
		{:else if storageWarning === 'unavailable'}
			<div class="banner banner-warn" role="status">
				<Icon name="warning" size={18} />
				<span>Browser storage is unavailable, so changes will not be saved between visits.</span>
			</div>
		{/if}
		{@render children()}
	</main>

	<!-- Mobile bottom navigation -->
	<nav class="bottom-nav" aria-label="Main navigation">
		{#each NAV as n (n.href)}
			{#if n.center}
				<a href={n.href} class="nav-center" aria-current={isActive(n.href) ? 'page' : undefined} aria-label="Scan bill">
					<span class="nav-center-btn"><Icon name="scan" size={25} /></span>
					<span class="nav-label">{n.label}</span>
				</a>
			{:else}
				<a href={n.href} class="nav-link" aria-current={isActive(n.href) ? 'page' : undefined}>
					<span class="nav-ico">
						<Icon name={n.icon} size={21} />
						{#if n.href === '/' && alerts > 0}<span class="nav-badge" aria-label="{alerts} items need attention">{alerts}</span>{/if}
					</span>
					<span class="nav-label">{n.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		margin-bottom: 14px;
	}
	.banner-warn {
		background: var(--amber-soft);
		color: #8a5a06;
		border: 1px solid var(--amber);
	}
	:global(:root[data-theme='dark']) .banner-warn {
		color: var(--amber);
	}

	/* ---------- bottom nav (mobile) ---------- */
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--nav-h);
		background: var(--surface);
		border-top: 1px solid var(--border);
		display: flex;
		align-items: stretch;
		justify-content: space-around;
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 50;
	}
	.nav-link,
	.nav-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		text-decoration: none;
		color: var(--text-muted);
		min-height: 44px;
		position: relative;
	}
	.nav-link[aria-current='page'] {
		color: var(--green-dark);
	}
	:global(:root[data-theme='dark']) .nav-link[aria-current='page'] {
		color: var(--green);
	}
	.nav-label {
		font-size: 0.68rem;
		font-weight: 600;
	}
	.nav-ico {
		position: relative;
		display: grid;
		place-items: center;
	}
	.nav-badge {
		position: absolute;
		top: -5px;
		right: -9px;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--red);
		color: #fff;
		font-size: 0.63rem;
		font-weight: 700;
		display: grid;
		place-items: center;
	}
	.nav-center {
		color: var(--green-dark);
	}
	.nav-center-btn {
		width: 50px;
		height: 50px;
		margin-top: -20px;
		border-radius: 999px;
		background: var(--green);
		color: #fff;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 14px rgba(47, 158, 107, 0.42);
		border: 3px solid var(--surface);
	}

	/* ---------- sidebar (desktop) ---------- */
	.sidebar {
		display: none;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--text);
		margin-bottom: 22px;
	}
	.brand-mark {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--green);
		color: #fff;
		display: grid;
		place-items: center;
		flex: none;
	}
	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.brand-text strong {
		font-family: var(--font-head);
		font-size: 1.07rem;
	}
	.brand-text small {
		color: var(--text-muted);
		font-size: 0.73rem;
	}
	.side-link {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.93rem;
		min-height: 44px;
		position: relative;
	}
	.side-link:hover {
		background: var(--surface-2);
	}
	.side-link[aria-current='page'] {
		background: var(--green-soft);
		color: var(--green-dark);
	}
	:global(:root[data-theme='dark']) .side-link[aria-current='page'] {
		color: var(--green);
	}
	.dot-badge {
		margin-left: auto;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 999px;
		background: var(--red);
		color: #fff;
		font-size: 0.7rem;
		display: grid;
		place-items: center;
	}
	.side-foot {
		margin-top: auto;
		padding-top: 16px;
		line-height: 1.45;
	}

	@media (min-width: 900px) {
		.bottom-nav {
			display: none;
		}
		.sidebar {
			display: flex;
			flex-direction: column;
			width: 248px;
			flex: none;
			padding: 24px 16px;
			border-right: 1px solid var(--border);
			background: var(--surface);
			height: 100dvh;
			position: sticky;
			top: 0;
		}
		.sidebar nav {
			display: flex;
			flex-direction: column;
			gap: 3px;
		}
	}
</style>
