<script lang="ts">
	// The hero flow: capture -> clean up -> OCR -> parse -> review -> pantry.
	// Tesseract.js is imported lazily (only on this route) inside a Web Worker.
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import ReviewList from '$lib/components/ReviewList.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { app } from '$lib/store.svelte';
	import { parseBill } from '$lib/parser';
	import { buildReviewRows, categoryTotals } from '$lib/reviewRows';
	import { loadImage, drawToCanvas, binarize, imageQuality } from '$lib/imagePrep';
	import { todayISO, formatDate } from '$lib/dates';
	import type { ParsedBill, ReviewRow } from '$lib/types';

	type Stage = 'capture' | 'adjust' | 'reading' | 'review' | 'error';

	let stage = $state<Stage>('capture');
	let errorMessage = $state('');
	let errorHint = $state('');

	let sourceFile = $state<File | null>(null);
	let sourceImg: HTMLImageElement | null = null;
	let rotation = $state(0);
	let cropPct = $state({ top: 0, bottom: 0 });
	let previewUrl = $state('');
	let cleanedUrl = $state('');
	let qualityWarning = $state('');

	let progress = $state(0);
	let progressLabel = $state('Starting');
	let controller: AbortController | null = null;

	let bill = $state<ParsedBill | null>(null);
	let rawText = $state('');
	let rows = $state<ReviewRow[]>([]);
	let purchaseDate = $state(todayISO());
	let storeName = $state('');
	let billTotal = $state<number | undefined>(undefined);

	let pasteMode = $state(false);
	let pasteText = $state('');
	let zoomOpen = $state(false);
	let mergePrompt = $state<{ open: boolean; names: string[] }>({ open: false, names: [] });
	let pendingCommit: ReviewRow[] = [];
	let savedMessage = $state('');

	const SAMPLES = [
		{ file: '/samples/bill-clean.png', label: 'Clean layout' },
		{ file: '/samples/bill-rotated.png', label: 'Slightly rotated' },
		{ file: '/samples/bill-many.png', label: 'Many items' }
	];

	/* ---------------- capture ---------------- */

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		await useFile(file);
		input.value = '';
	}

	async function useFile(file: File | Blob) {
		try {
			resetResults();
			sourceFile = file as File;
			sourceImg = await loadImage(file);
			rotation = 0;
			cropPct = { top: 0, bottom: 0 };
			previewUrl = URL.createObjectURL(file);
			stage = 'adjust';
			refreshCleaned();
		} catch (err) {
			showError((err as Error).message, 'Try another photo or use "Paste bill text" below.');
		}
	}

	async function useSample(path: string) {
		try {
			const res = await fetch(path);
			if (!res.ok) throw new Error('Sample bill could not be loaded.');
			await useFile(await res.blob());
		} catch (err) {
			showError((err as Error).message, 'Check your connection and try again.');
		}
	}

	function resetResults() {
		bill = null;
		rows = [];
		rawText = '';
		savedMessage = '';
		qualityWarning = '';
		cleanedUrl = '';
	}

	/* ---------------- clean-up preview ---------------- */

	function buildCanvas(): HTMLCanvasElement | null {
		if (!sourceImg) return null;
		const sw = sourceImg.naturalWidth;
		const sh = sourceImg.naturalHeight;
		const top = Math.round((cropPct.top / 100) * sh);
		const bottom = Math.round((cropPct.bottom / 100) * sh);
		const h = Math.max(32, sh - top - bottom);
		const canvas = drawToCanvas(sourceImg, {
			rotate: rotation,
			crop: { x: 0, y: top, w: sw, h }
		});
		binarize(canvas);
		return canvas;
	}

	function refreshCleaned() {
		const canvas = buildCanvas();
		if (!canvas) return;
		cleanedUrl = canvas.toDataURL('image/png');
		const q = imageQuality(canvas);
		if (q.sharpness < 0.02) {
			qualityWarning = 'This photo looks blurry or very low contrast. OCR may miss lines — try more light or a flatter bill.';
		} else if (q.inkRatio > 0.55) {
			qualityWarning = 'The cleaned image looks very dark. Try better lighting or crop out the background.';
		} else {
			qualityWarning = '';
		}
	}

	function rotate(delta: number) {
		rotation = (rotation + delta + 360) % 360;
		refreshCleaned();
	}

	/* ---------------- OCR ---------------- */

	async function runOcr() {
		const canvas = buildCanvas();
		if (!canvas) return;
		cleanedUrl = canvas.toDataURL('image/png');

		stage = 'reading';
		progress = 0;
		progressLabel = 'Loading the OCR engine';
		controller = new AbortController();

		try {
			// lazy import: Tesseract only ever loads on this page
			const { getOcrProvider } = await import('$lib/ocr/provider');
			const provider = getOcrProvider();
			const result = await provider.recognize(cleanedUrl, {
				signal: controller.signal,
				onProgress: (p) => {
					progressLabel = humanStatus(p.status);
					progress = Math.round((p.progress ?? 0) * 100);
				}
			});
			rawText = result.text ?? '';
			handleParsed(parseBill(rawText));
		} catch (err) {
			const e = err as Error;
			if (e.name === 'AbortError') {
				stage = 'adjust';
				return;
			}
			showError(
				e.message || 'The bill could not be read.',
				'You can paste the bill text instead, or add the items manually.'
			);
		} finally {
			controller = null;
		}
	}

	function humanStatus(status: string): string {
		if (/load|download|initializ/i.test(status)) return 'Loading the OCR engine';
		if (/recogniz/i.test(status)) return 'Reading the bill';
		return status.replace(/^\w/, (c) => c.toUpperCase());
	}

	function cancelOcr() {
		controller?.abort();
	}

	/* ---------------- parse + review ---------------- */

	function handleParsed(parsed: ParsedBill) {
		bill = parsed;
		purchaseDate = parsed.date ?? todayISO();
		storeName = parsed.store ?? '';
		billTotal = parsed.total;
		rows = buildReviewRows(parsed, app.settings, purchaseDate);
		if (rows.length === 0) {
			showError(
				'No items could be read from this bill.',
				'Try a sharper photo with the whole bill in frame, paste the bill text, or add items manually.'
			);
			return;
		}
		stage = 'review';
	}

	function parsePasted() {
		if (!pasteText.trim()) return;
		resetResults();
		rawText = pasteText;
		handleParsed(parseBill(pasteText));
	}

	function showError(message: string, hint = '') {
		errorMessage = message;
		errorHint = hint;
		stage = 'error';
	}

	/* ---------------- save ---------------- */

	let selectedRows = $derived(rows.filter((r) => r.selected && r.name.trim()));
	let selectedSum = $derived(
		Math.round(selectedRows.reduce((s, r) => s + (r.price ?? 0), 0) * 100) / 100
	);

	function addToPantry() {
		const dupes = selectedRows.filter((r) => app.findDuplicate(r.name, r.place));
		pendingCommit = selectedRows;
		if (dupes.length > 0) {
			mergePrompt = { open: true, names: dupes.map((d) => d.name) };
			return;
		}
		commit(false);
	}

	function commit(mergeDuplicates: boolean) {
		let added = 0;
		let merged = 0;
		for (const r of pendingCommit) {
			const dup = app.findDuplicate(r.name, r.place);
			if (dup && mergeDuplicates) {
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

		// receipt record for the spending charts; the photo itself is never stored
		if (selectedRows.length > 0) {
			app.addReceipt({
				store: storeName.trim() || 'Unknown store',
				date: purchaseDate,
				total: billTotal ?? selectedSum,
				itemCount: selectedRows.length,
				categoryTotals: categoryTotals(rows)
			});
		}

		mergePrompt = { open: false, names: [] };
		savedMessage = `${added} item${added === 1 ? '' : 's'} added${merged > 0 ? `, ${merged} merged into existing stock` : ''}.`;
		pendingCommit = [];
		setTimeout(() => goto('/pantry'), 900);
	}

	function startOver() {
		resetResults();
		sourceFile = null;
		sourceImg = null;
		previewUrl = '';
		stage = 'capture';
	}

	onDestroy(async () => {
		controller?.abort();
		try {
			const mod = await import('$lib/ocr/provider');
			mod.disposeOcrProvider();
		} catch {
			/* provider was never loaded */
		}
	});
</script>

<svelte:head>
	<title>Scan bill · PantryPilot</title>
</svelte:head>

<div class="page-head">
	<div>
		<h1>Scan bill</h1>
		<p>Read a grocery bill and fill your pantry in one go.</p>
	</div>
	{#if stage !== 'capture'}
		<button class="btn btn-sm" onclick={startOver}>Start over</button>
	{/if}
</div>

{#if savedMessage}
	<div class="notice notice-ok" role="status"><Icon name="check" size={18} /><span>{savedMessage}</span></div>
{/if}

<!-- ============ CAPTURE ============ -->
{#if stage === 'capture'}
	<div class="card">
		<div class="frame">
			<span class="corner tl"></span><span class="corner tr"></span>
			<span class="corner bl"></span><span class="corner br"></span>
			<div class="frame-inner">
				<Icon name="camera" size={38} />
				<p class="small muted" style="margin:10px 0 0;text-align:center">
					Flatten the bill, good light, fill the frame
				</p>
			</div>
		</div>

		<div class="btn-row" style="margin-top:14px">
			<label class="btn btn-primary" style="flex:1">
				<Icon name="camera" size={18} /> Take photo
				<input class="sr-only" type="file" accept="image/*" capture="environment" onchange={onFile} />
			</label>
			<label class="btn" style="flex:1">
				<Icon name="upload" size={18} /> Upload image
				<input class="sr-only" type="file" accept="image/*" onchange={onFile} />
			</label>
		</div>

		<p class="small muted" style="margin:12px 0 0">
			The first scan downloads the OCR engine once (about 8 MB) and then works from your browser cache.
			Your bill photo is processed on this device and is never uploaded.
		</p>
	</div>

	<div class="card">
		<h3>Try with a sample bill</h3>
		<p class="small muted">
			Three synthetic bills with fictional stores, so you can see the whole pipeline run.
		</p>
		<div class="btn-row">
			{#each SAMPLES as s (s.file)}
				<button class="btn btn-sm" onclick={() => useSample(s.file)}>{s.label}</button>
			{/each}
		</div>
	</div>

	<div class="card">
		<div class="row-between" style="margin-bottom:8px">
			<h3 style="margin:0">Paste bill text</h3>
			<button class="btn btn-sm btn-ghost" onclick={() => (pasteMode = !pasteMode)}>
				{pasteMode ? 'Hide' : 'Show'}
			</button>
		</div>
		<p class="small muted">For e-bills copied from WhatsApp or email. Uses the same parser.</p>
		{#if pasteMode}
			<textarea bind:value={pasteText} placeholder="Paste the bill text here..." aria-label="Bill text"></textarea>
			<button class="btn btn-primary btn-block" style="margin-top:8px" onclick={parsePasted}>
				Read pasted text
			</button>
		{/if}
	</div>

	<p class="small muted" style="text-align:center">
		OCR on crumpled or faded bills is imperfect. Always review the detected items before saving.
		<br /><a href="/add">Add an item manually instead</a>
	</p>
{/if}

<!-- ============ ADJUST ============ -->
{#if stage === 'adjust'}
	<div class="card">
		<div class="preview-wrap">
			<img src={cleanedUrl || previewUrl} alt="Cleaned preview of the bill, ready for reading" />
		</div>

		{#if qualityWarning}
			<div class="notice notice-warn" role="status"><Icon name="warning" size={18} /><span>{qualityWarning}</span></div>
		{/if}

		<div class="btn-row" style="margin-top:12px">
			<button class="btn btn-sm" onclick={() => rotate(-90)} aria-label="Rotate left 90 degrees">
				<Icon name="rotate" size={16} /> Left
			</button>
			<button class="btn btn-sm" onclick={() => rotate(90)} aria-label="Rotate right 90 degrees">
				<Icon name="rotate" size={16} /> Right
			</button>
		</div>

		<div class="crop" style="margin-top:12px">
			<span class="label"><Icon name="crop" size={14} /> Crop top ({cropPct.top}%)</span>
			<input
				type="range"
				min="0"
				max="40"
				bind:value={cropPct.top}
				onchange={refreshCleaned}
				aria-label="Crop from the top"
			/>
			<span class="label">Crop bottom ({cropPct.bottom}%)</span>
			<input
				type="range"
				min="0"
				max="40"
				bind:value={cropPct.bottom}
				onchange={refreshCleaned}
				aria-label="Crop from the bottom"
			/>
		</div>

		<p class="small muted" style="margin-top:10px">
			Cleaned up for reading: resized to 1600px, grayscale, contrast boosted and adaptive threshold applied.
		</p>

		<button class="btn btn-primary btn-block" style="margin-top:10px" onclick={runOcr}>
			<Icon name="scan" size={18} /> Read this bill
		</button>
	</div>
{/if}

<!-- ============ READING ============ -->
{#if stage === 'reading'}
	<div class="card reading">
		<div class="scan-anim" aria-hidden="true">
			{#if cleanedUrl}<img src={cleanedUrl} alt="" />{/if}
			<span class="scan-line"></span>
		</div>
		<h3 style="margin-top:14px">{progressLabel}</h3>
		<div
			class="bar"
			role="progressbar"
			aria-valuenow={progress}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-label="Reading progress"
		>
			<span style="width:{progress}%"></span>
		</div>
		<p class="small muted" style="margin-top:8px">{progress}% · this runs on your device, in the background</p>
		<button class="btn btn-block" style="margin-top:10px" onclick={cancelOcr}>Cancel</button>
	</div>
{/if}

<!-- ============ ERROR ============ -->
{#if stage === 'error'}
	<div class="card">
		<div class="notice notice-err" role="alert">
			<Icon name="warning" size={18} />
			<span>{errorMessage}</span>
		</div>
		{#if errorHint}<p class="small muted">{errorHint}</p>{/if}
		<div class="btn-row">
			<button class="btn" onclick={() => (stage = sourceImg ? 'adjust' : 'capture')}>Try again</button>
			<button class="btn" onclick={() => { stage = 'capture'; pasteMode = true; }}>Paste bill text</button>
			<a class="btn" href="/add">Add manually</a>
		</div>
		{#if rawText}
			<details style="margin-top:12px">
				<summary class="small muted">Show the raw text that was read</summary>
				<pre class="raw-text">{rawText}</pre>
			</details>
		{/if}
	</div>
{/if}

<!-- ============ REVIEW ============ -->
{#if stage === 'review' && bill}
	{#if cleanedUrl}
		<button class="receipt-thumb" onclick={() => (zoomOpen = true)} aria-label="Zoom the receipt image">
			<img src={cleanedUrl} alt="The scanned bill, tap to zoom" />
			<span class="zoom-hint small">Tap to zoom</span>
		</button>
	{/if}

	{#if bill.mismatch}
		<div class="notice notice-warn" role="status">
			<Icon name="warning" size={18} />
			<span>
				Some items may be missing or misread. Please review. Items add up to
				{app.settings.currency}{bill.itemsSum.toFixed(2)} but the bill total reads
				{app.settings.currency}{bill.total?.toFixed(2)}.
			</span>
		</div>
	{/if}

	<div class="card">
		<div class="grid-2">
			<label class="field">
				<span>Store</span>
				<input type="text" bind:value={storeName} placeholder="Store name" />
			</label>
			<label class="field">
				<span>Bill date</span>
				<input type="date" bind:value={purchaseDate} />
			</label>
		</div>
		<p class="small muted" style="margin:0">
			Expiry dates are estimated from typical shelf life ({formatDate(purchaseDate)} + shelf life).
			Adjust any row that looks wrong.
		</p>
	</div>

	<div class="card">
		<ReviewList bind:rows {purchaseDate} onchange={(r) => (rows = r)} />
	</div>

	<div class="save-bar">
		<div>
			<strong>{selectedRows.length} selected</strong>
			<span class="small muted"> · {app.settings.currency}{selectedSum.toFixed(2)}</span>
		</div>
		<button class="btn btn-primary" onclick={addToPantry} disabled={selectedRows.length === 0}>
			<Icon name="check" size={18} /> Add to pantry
		</button>
	</div>
{/if}

{#if zoomOpen}
	<div
		class="zoom"
		role="presentation"
		onclick={() => (zoomOpen = false)}
	>
		<img src={cleanedUrl} alt="The scanned bill at full size" />
		<button class="btn btn-sm zoom-close" onclick={() => (zoomOpen = false)}>
			<Icon name="close" size={16} /> Close
		</button>
	</div>
{/if}

<ConfirmDialog
	open={mergePrompt.open}
	title="Already in your pantry"
	message="{mergePrompt.names.slice(0, 3).join(', ')}{mergePrompt.names.length > 3
		? ` and ${mergePrompt.names.length - 3} more`
		: ''} already exist. Increase the existing quantity instead of creating duplicates?"
	confirmLabel="Increase quantity"
	cancelLabel="Add as new"
	onconfirm={() => commit(true)}
	oncancel={() => commit(false)}
/>

<style>
	.frame {
		position: relative;
		border-radius: var(--radius);
		background: var(--surface-2);
		min-height: 210px;
		display: grid;
		place-items: center;
	}
	.frame-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: var(--text-muted);
		padding: 22px;
	}
	.corner {
		position: absolute;
		width: 26px;
		height: 26px;
		border: 3px solid var(--green);
	}
	.tl {
		top: 10px;
		left: 10px;
		border-right: 0;
		border-bottom: 0;
		border-radius: 8px 0 0 0;
	}
	.tr {
		top: 10px;
		right: 10px;
		border-left: 0;
		border-bottom: 0;
		border-radius: 0 8px 0 0;
	}
	.bl {
		bottom: 10px;
		left: 10px;
		border-right: 0;
		border-top: 0;
		border-radius: 0 0 0 8px;
	}
	.br {
		bottom: 10px;
		right: 10px;
		border-left: 0;
		border-top: 0;
		border-radius: 0 0 8px 0;
	}

	.preview-wrap {
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-2);
		max-height: 420px;
		display: grid;
		place-items: center;
	}
	.preview-wrap img {
		max-width: 100%;
		max-height: 420px;
		object-fit: contain;
		display: block;
	}

	.crop {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.crop input[type='range'] {
		width: 100%;
		accent-color: var(--green);
		min-height: 36px;
	}
	.crop .label {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.reading {
		text-align: center;
	}
	.scan-anim {
		position: relative;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-2);
		max-height: 260px;
		display: grid;
		place-items: center;
	}
	.scan-anim img {
		max-width: 100%;
		max-height: 260px;
		object-fit: contain;
		opacity: 0.85;
	}
	.scan-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, transparent, var(--green), transparent);
		animation: sweep 1.9s ease-in-out infinite;
	}
	@keyframes sweep {
		0% {
			top: 2%;
		}
		50% {
			top: 97%;
		}
		100% {
			top: 2%;
		}
	}
	.bar {
		height: 9px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--green);
		border-radius: 999px;
		transition: width 0.25s ease;
	}

	.notice {
		display: flex;
		gap: 9px;
		align-items: flex-start;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		margin-bottom: 12px;
	}
	.notice-warn {
		background: var(--amber-soft);
		border: 1px solid var(--amber);
		color: #8a5a06;
	}
	.notice-err {
		background: var(--red-soft);
		border: 1px solid var(--red);
		color: #b92a2f;
	}
	.notice-ok {
		background: var(--green-soft);
		border: 1px solid var(--green);
		color: var(--green-dark);
	}
	:global(:root[data-theme='dark']) .notice-warn {
		color: var(--amber);
	}
	:global(:root[data-theme='dark']) .notice-err {
		color: var(--red);
	}
	:global(:root[data-theme='dark']) .notice-ok {
		color: var(--green);
	}

	.receipt-thumb {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		cursor: zoom-in;
		position: relative;
		margin-bottom: 12px;
	}
	.receipt-thumb img {
		width: 100%;
		max-height: 190px;
		object-fit: cover;
		object-position: top;
		display: block;
	}
	.zoom-hint {
		position: absolute;
		right: 8px;
		bottom: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		padding: 3px 9px;
		border-radius: 999px;
	}

	.zoom {
		position: fixed;
		inset: 0;
		background: rgba(10, 14, 9, 0.93);
		z-index: 200;
		overflow: auto;
		padding: 16px;
		cursor: zoom-out;
	}
	.zoom img {
		width: 100%;
		max-width: 900px;
		margin: 0 auto;
		display: block;
	}
	.zoom-close {
		position: fixed;
		top: 14px;
		right: 14px;
	}

	.save-bar {
		position: sticky;
		bottom: calc(var(--nav-h) + 8px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 11px 14px;
		margin-top: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
	}

	.raw-text {
		white-space: pre-wrap;
		font-size: 0.76rem;
		background: var(--surface-2);
		padding: 10px;
		border-radius: 8px;
		max-height: 240px;
		overflow: auto;
	}

	@media (min-width: 900px) {
		.save-bar {
			bottom: 14px;
		}
	}
</style>
