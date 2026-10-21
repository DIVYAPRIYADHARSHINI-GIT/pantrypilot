<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { app } from '$lib/store.svelte';
	import { DEFAULT_SHELF_LIFE } from '$lib/catalog';
	import type { Category, StoragePlace } from '$lib/types';

	const CATEGORIES = Object.keys(DEFAULT_SHELF_LIFE) as Category[];

	let notice = $state('');
	let confirmFresh = $state(false);
	let importError = $state('');
	let notifState = $state<'default' | 'granted' | 'denied' | 'unsupported'>('default');

	$effect(() => {
		if (typeof Notification === 'undefined') notifState = 'unsupported';
		else notifState = Notification.permission as 'default' | 'granted' | 'denied';
	});

	function setSetting<K extends keyof typeof app.settings>(key: K, value: (typeof app.settings)[K]) {
		app.settings = { ...app.settings, [key]: value };
		app.saveSettings();
	}

	function setShelfLife(cat: Category, value: number) {
		const next = { ...app.settings.shelfLifeByCategory };
		if (!value || value <= 0) delete next[cat];
		else next[cat] = value;
		setSetting('shelfLifeByCategory', next);
	}

	async function askNotifications() {
		if (typeof Notification === 'undefined') return;
		const p = await Notification.requestPermission();
		notifState = p as 'default' | 'granted' | 'denied';
		setSetting('notificationsEnabled', p === 'granted');
		if (p === 'granted') {
			const n = app.alertCount;
			new Notification('PantryPilot', {
				body: n > 0 ? `${n} item${n === 1 ? '' : 's'} need attention today.` : 'Reminders are on.'
			});
		}
	}

	function download(filename: string, content: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	function exportJson() {
		download(`pantrypilot-backup-${new Date().toISOString().slice(0, 10)}.json`, app.exportJSON(), 'application/json');
		flash('Backup downloaded.');
	}

	function exportCsv() {
		download(`pantrypilot-pantry-${new Date().toISOString().slice(0, 10)}.csv`, app.exportCSV(), 'text/csv');
		flash('Pantry CSV downloaded.');
	}

	async function importJson(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		importError = '';
		try {
			const text = await file.text();
			const res = app.importJSON(text);
			if (res.ok) flash(res.message);
			else importError = res.message;
		} catch {
			importError = 'That file could not be read.';
		}
		input.value = '';
	}

	function flash(msg: string) {
		notice = msg;
		setTimeout(() => (notice = ''), 3000);
	}
</script>

<svelte:head><title>Settings · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Settings</h1>
		<p>Preferences, backup and privacy.</p>
	</div>
</div>

{#if notice}
	<div class="ok" role="status"><Icon name="check" size={18} /><span>{notice}</span></div>
{/if}

<section class="card section">
	<h2>Expiry warnings</h2>
	<label class="field">
		<span>Warn me this many days before expiry</span>
		<input
			type="number"
			min="0"
			max="30"
			value={app.settings.warningDays}
			onchange={(e) => setSetting('warningDays', Math.max(0, Number(e.currentTarget.value) || 0))}
		/>
	</label>

	<div class="row-between" style="margin-top:4px">
		<div>
			<strong class="small">In-app reminders</strong>
			<p class="small muted" style="margin:0">
				Banners and badges always work. Browser notifications only appear while the app is open — there is
				no background push, because PantryPilot has no server for it.
			</p>
		</div>
	</div>
	{#if notifState === 'unsupported'}
		<p class="small muted">This browser does not support notifications.</p>
	{:else if notifState === 'granted'}
		<p class="small" style="color:var(--green-dark)"><Icon name="check" size={14} /> Notifications allowed.</p>
	{:else if notifState === 'denied'}
		<p class="small muted">Notifications are blocked in your browser settings.</p>
	{:else}
		<button class="btn btn-sm" onclick={askNotifications}><Icon name="bell" size={16} /> Allow notifications</button>
	{/if}
</section>

<section class="card section">
	<h2>Defaults</h2>
	<div class="grid-2">
		<label class="field">
			<span>Default storage place</span>
			<select
				value={app.settings.defaultPlace}
				onchange={(e) => setSetting('defaultPlace', e.currentTarget.value as StoragePlace)}
			>
				<option value="fridge">fridge</option>
				<option value="freezer">freezer</option>
				<option value="shelf">shelf</option>
			</select>
		</label>
		<label class="field">
			<span>Default unit</span>
			<select value={app.settings.defaultUnit} onchange={(e) => setSetting('defaultUnit', e.currentTarget.value)}>
				{#each ['pcs', 'g', 'kg', 'ml', 'l', 'pkt'] as u (u)}<option value={u}>{u}</option>{/each}
			</select>
		</label>
	</div>
	<div class="grid-2">
		<label class="field">
			<span>Currency</span>
			<select value={app.settings.currency} onchange={(e) => setSetting('currency', e.currentTarget.value)}>
				<option value="₹">₹ Rupee</option>
				<option value="$">$ Dollar</option>
				<option value="€">€ Euro</option>
				<option value="£">£ Pound</option>
			</select>
		</label>
		<label class="field">
			<span>Theme</span>
			<select
				value={app.settings.theme}
				onchange={(e) => setSetting('theme', e.currentTarget.value as 'light' | 'dark' | 'system')}
			>
				<option value="system">Match my system</option>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
			</select>
		</label>
	</div>
</section>

<section class="card section">
	<h2>Default shelf life</h2>
	<p class="small muted">
		Used when an item is not in the built-in catalog. Leave a field empty to use the built-in value.
	</p>
	<div class="shelf-grid">
		{#each CATEGORIES as cat (cat)}
			<label class="shelf-row">
				<span class="row" style="gap:6px"><Icon name={cat} size={15} /> {cat}</span>
				<input
					type="number"
					min="0"
					placeholder={String(DEFAULT_SHELF_LIFE[cat])}
					value={app.settings.shelfLifeByCategory[cat] ?? ''}
					onchange={(e) => setShelfLife(cat, Number(e.currentTarget.value))}
					aria-label="Default shelf life for {cat} in days"
				/>
			</label>
		{/each}
	</div>
</section>

<section class="card section">
	<h2>Backup</h2>
	<div class="btn-row">
		<button class="btn" onclick={exportJson}><Icon name="download" size={17} /> Export JSON backup</button>
		<button class="btn" onclick={exportCsv}><Icon name="download" size={17} /> Export pantry CSV</button>
		<label class="btn">
			<Icon name="upload" size={17} /> Import JSON backup
			<input class="sr-only" type="file" accept="application/json,.json" onchange={importJson} />
		</label>
	</div>
	{#if importError}
		<div class="err" role="alert" style="margin-top:10px"><Icon name="warning" size={17} /><span>{importError}</span></div>
	{/if}
</section>

<section class="card section">
	<h2>Data &amp; privacy</h2>
	<p class="small muted">
		All your data stays in this browser's local storage. Bill photos are processed on your device only and
		are never uploaded or saved. The one network call PantryPilot makes is the barcode lookup to Open Food
		Facts, which receives only the barcode number.
	</p>
	<div class="btn-row">
		<button class="btn btn-sm" onclick={() => { app.loadSampleData(); flash('Sample data loaded.'); }}>
			Load sample data
		</button>
		<button class="btn btn-sm btn-danger" onclick={() => (confirmFresh = true)}>
			<Icon name="trash" size={16} /> Start fresh
		</button>
	</div>
</section>

<p class="small muted" style="text-align:center">
	Product data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>
	(Open Database License). OCR by Tesseract.js, self-hosted and run on your device.
</p>

<ConfirmDialog
	open={confirmFresh}
	title="Delete everything?"
	message="This clears your pantry, shopping list, receipts and settings from this browser. Export a backup first if you want to keep them."
	confirmLabel="Delete everything"
	danger
	onconfirm={() => {
		app.startFresh();
		confirmFresh = false;
		flash('Everything cleared.');
	}}
	oncancel={() => (confirmFresh = false)}
/>

<style>
	.shelf-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 7px;
	}
	.shelf-row {
		display: grid;
		grid-template-columns: 1fr 96px;
		align-items: center;
		gap: 8px;
		font-size: 0.88rem;
		color: var(--text-muted);
	}
	.shelf-row input {
		min-height: 40px;
	}
	.ok,
	.err {
		display: flex;
		gap: 9px;
		align-items: center;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		margin-bottom: 12px;
		font-size: 0.89rem;
	}
	.ok {
		background: var(--green-soft);
		border: 1px solid var(--green);
		color: var(--green-dark);
	}
	.err {
		background: var(--red-soft);
		border: 1px solid var(--red);
		color: #b92a2f;
	}
	:global(:root[data-theme='dark']) .ok {
		color: var(--green);
	}
	:global(:root[data-theme='dark']) .err {
		color: var(--red);
	}
	@media (min-width: 620px) {
		.shelf-grid {
			grid-template-columns: 1fr 1fr;
			gap: 8px 16px;
		}
	}
</style>
