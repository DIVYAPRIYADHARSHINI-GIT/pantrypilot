<script lang="ts">
	// Barcode entry: native BarcodeDetector where available, @zxing/browser as a
	// fallback, and plain typing always. Lookup goes through our server route.
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { app } from '$lib/store.svelte';
	import { estimateShelfLife } from '$lib/shelfLife';
	import { matchCatalog } from '$lib/matcher';
	import { todayISO } from '$lib/dates';
	import type { Category } from '$lib/types';

	type Result = {
		found: boolean;
		code: string;
		name?: string;
		brand?: string;
		quantity?: number;
		unit?: string;
		quantityText?: string;
		category?: string;
		message?: string;
	};

	let typed = $state('');
	let scanning = $state(false);
	let cameraError = $state('');
	let looking = $state(false);
	let result = $state<Result | null>(null);
	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream: MediaStream | null = null;
	let zxingControls: { stop: () => void } | null = null;
	let rafId = 0;
	let saved = $state('');

	let supportsNative = $derived(typeof window !== 'undefined' && 'BarcodeDetector' in window);

	async function startScan() {
		cameraError = '';
		result = null;
		scanning = true;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			// wait a tick for the <video> to mount
			await new Promise((r) => setTimeout(r, 50));
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
			}
			if (supportsNative) {
				await nativeLoop();
			} else {
				await zxingLoop();
			}
		} catch (err) {
			const e = err as Error;
			cameraError =
				e.name === 'NotAllowedError'
					? 'Camera access was denied. Allow the camera in your browser settings, or type the barcode below.'
					: 'The camera could not be opened on this device. Type the barcode below instead.';
			stopScan();
		}
	}

	async function nativeLoop() {
		const Detector = (window as unknown as { BarcodeDetector: new (o?: unknown) => { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } })
			.BarcodeDetector;
		const detector = new Detector({
			formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
		});
		const tick = async () => {
			if (!scanning || !videoEl) return;
			try {
				const codes = await detector.detect(videoEl);
				if (codes.length > 0 && codes[0].rawValue) {
					const value = codes[0].rawValue;
					stopScan();
					typed = value;
					await lookup(value);
					return;
				}
			} catch {
				/* keep trying */
			}
			rafId = requestAnimationFrame(() => void tick());
		};
		await tick();
	}

	async function zxingLoop() {
		const { BrowserMultiFormatReader } = await import('@zxing/browser');
		const reader = new BrowserMultiFormatReader();
		if (!videoEl) return;
		const controls = await reader.decodeFromVideoElement(videoEl, (res) => {
			if (res) {
				const value = res.getText();
				stopScan();
				typed = value;
				void lookup(value);
			}
		});
		zxingControls = controls;
	}

	function stopScan() {
		scanning = false;
		// onDestroy also runs during SSR, where the rAF/media APIs do not exist
		if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
		try {
			zxingControls?.stop();
		} catch {
			/* ignore */
		}
		zxingControls = null;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
	}

	async function lookup(code: string) {
		const clean = code.replace(/\D/g, '');
		if (!clean) return;
		looking = true;
		result = null;
		try {
			const res = await fetch(`/api/barcode/${clean}`);
			result = (await res.json()) as Result;
		} catch {
			result = { found: false, code: clean, message: 'The lookup failed. You can add this item manually.' };
		} finally {
			looking = false;
		}
	}

	function addFromResult() {
		if (!result?.found) return;
		const name = result.name ?? '';
		const m = matchCatalog(name);
		const category = (m.entry ? m.category : (result.category as Category) ?? 'other') as Category;
		const place = m.entry ? m.place : app.settings.defaultPlace;
		const est = estimateShelfLife({
			name,
			category,
			catalogDays: m.entry ? m.shelfLife : undefined,
			purchaseDate: todayISO(),
			settings: app.settings
		});

		const dup = app.findDuplicate(name, place);
		if (dup) {
			app.mergeQuantity(dup.id, result.quantity ?? 1);
			saved = `Increased the quantity of ${dup.name}.`;
		} else {
			app.addItem({
				name,
				quantity: result.quantity ?? 1,
				unit: result.unit ?? m.unit,
				category,
				place,
				purchaseDate: todayISO(),
				expiryDate: est.expiryDate,
				expiryEstimated: true,
				barcode: result.code,
				brand: result.brand
			});
			saved = `${name} added to your pantry.`;
		}
		setTimeout(() => goto('/pantry'), 700);
	}

	function manualWithBarcode() {
		const params = new URLSearchParams({ barcode: result?.code ?? typed.replace(/\D/g, '') });
		if (result?.name) params.set('name', result.name);
		if (result?.brand) params.set('brand', result.brand);
		if (result?.category) params.set('category', result.category);
		goto(`/add?${params.toString()}`);
	}

	onDestroy(stopScan);
</script>

<svelte:head><title>Scan barcode · PantryPilot</title></svelte:head>

<div class="page-head">
	<div>
		<h1>Scan barcode</h1>
		<p>Look a packaged product up in Open Food Facts.</p>
	</div>
</div>

{#if saved}
	<div class="notice ok" role="status"><Icon name="check" size={18} /><span>{saved}</span></div>
{/if}

<div class="card">
	{#if scanning}
		<div class="cam">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} playsinline muted></video>
			<span class="corner tl"></span><span class="corner tr"></span>
			<span class="corner bl"></span><span class="corner br"></span>
		</div>
		<button class="btn btn-block" style="margin-top:10px" onclick={stopScan}>Stop camera</button>
		<p class="small muted" style="margin-top:8px">
			Using {supportsNative ? 'the built-in BarcodeDetector' : 'the ZXing fallback reader'}. Hold the barcode steady in the frame.
		</p>
	{:else}
		<button class="btn btn-primary btn-block" onclick={startScan}>
			<Icon name="camera" size={18} /> Open camera
		</button>
		{#if cameraError}
			<div class="notice err" role="alert" style="margin-top:10px">
				<Icon name="warning" size={18} /><span>{cameraError}</span>
			</div>
		{/if}
	{/if}

	<div class="field" style="margin-top:14px">
		<label for="code">Or type the barcode</label>
		<div class="row">
			<input id="code" type="text" inputmode="numeric" bind:value={typed} placeholder="e.g. 8901058000054" />
			<button class="btn btn-primary" onclick={() => lookup(typed)} disabled={looking || !typed.trim()}>
				{looking ? 'Looking…' : 'Look up'}
			</button>
		</div>
	</div>
</div>

{#if looking}
	<div class="card">
		<div class="skeleton" style="height:22px;width:60%"></div>
		<div class="skeleton" style="height:16px;width:40%;margin-top:8px"></div>
	</div>
{/if}

{#if result}
	<div class="card">
		{#if result.found}
			<h3>{result.name ?? 'Unnamed product'}</h3>
			<p class="small muted" style="margin-bottom:10px">
				{result.brand ? `${result.brand} · ` : ''}{result.quantityText ?? ''}
				{result.category ? ` · ${result.category}` : ''}
				<br />Barcode {result.code} · found in Open Food Facts
			</p>
			<div class="btn-row">
				<button class="btn btn-primary" onclick={addFromResult}>
					<Icon name="plus" size={17} /> Add to pantry
				</button>
				<button class="btn" onclick={manualWithBarcode}>Edit details first</button>
			</div>
		{:else}
			<div class="notice warn" role="status">
				<Icon name="warning" size={18} />
				<span>{result.message ?? 'Product not found.'}</span>
			</div>
			<div class="btn-row">
				<button class="btn btn-primary" onclick={manualWithBarcode}>
					<Icon name="plus" size={17} /> Add manually with this barcode
				</button>
			</div>
		{/if}
	</div>
{/if}

<p class="small muted" style="text-align:center;margin-top:14px">
	Product data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>,
	open data under the Open Database License.
</p>

<style>
	.cam {
		position: relative;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: #000;
		aspect-ratio: 4 / 3;
	}
	.cam video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.corner {
		position: absolute;
		width: 26px;
		height: 26px;
		border: 3px solid var(--green);
	}
	.tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
	.tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
	.bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
	.br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }

	.notice {
		display: flex;
		gap: 9px;
		align-items: flex-start;
		padding: 10px 13px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		margin-bottom: 12px;
	}
	.notice.warn {
		background: var(--amber-soft);
		border: 1px solid var(--amber);
		color: #8a5a06;
	}
	.notice.err {
		background: var(--red-soft);
		border: 1px solid var(--red);
		color: #b92a2f;
	}
	.notice.ok {
		background: var(--green-soft);
		border: 1px solid var(--green);
		color: var(--green-dark);
	}
	:global(:root[data-theme='dark']) .notice.warn { color: var(--amber); }
	:global(:root[data-theme='dark']) .notice.err { color: var(--red); }
	:global(:root[data-theme='dark']) .notice.ok { color: var(--green); }
</style>
