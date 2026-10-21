// Canvas image clean-up before OCR: resize to ~1600px on the long edge,
// grayscale, contrast boost, then adaptive thresholding. Runs entirely in the
// browser; the photo never leaves the device.

export const TARGET_LONG_EDGE = 1600;

export interface PreparedImage {
	dataUrl: string;
	width: number;
	height: number;
}

/** Load a File/Blob into an ImageBitmap-like source. */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.decoding = 'async';
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('That image could not be opened. Try a different photo.'));
			img.src = url;
		});
		// keep the object URL alive until the bitmap is drawn
		await img.decode().catch(() => undefined);
		return img;
	} finally {
		// revoke later; drawing happens synchronously after this resolves
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}
}

/**
 * Draw the source into a canvas at the target size, applying a rotation
 * (0/90/180/270 degrees) and an optional crop in source pixels.
 */
export function drawToCanvas(
	img: HTMLImageElement,
	opts: { rotate?: number; crop?: { x: number; y: number; w: number; h: number }; longEdge?: number } = {}
): HTMLCanvasElement {
	const rotate = ((opts.rotate ?? 0) % 360 + 360) % 360;
	const longEdge = opts.longEdge ?? TARGET_LONG_EDGE;
	const crop = opts.crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };

	const swapped = rotate === 90 || rotate === 270;
	const srcW = swapped ? crop.h : crop.w;
	const srcH = swapped ? crop.w : crop.h;

	const scale = Math.min(1, longEdge / Math.max(srcW, srcH));
	const outW = Math.max(1, Math.round(srcW * scale));
	const outH = Math.max(1, Math.round(srcH * scale));

	const canvas = document.createElement('canvas');
	canvas.width = outW;
	canvas.height = outH;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas is not available in this browser.');

	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, outW, outH);
	ctx.save();
	ctx.translate(outW / 2, outH / 2);
	ctx.rotate((rotate * Math.PI) / 180);
	const drawW = (swapped ? outH : outW);
	const drawH = (swapped ? outW : outH);
	ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, -drawW / 2, -drawH / 2, drawW, drawH);
	ctx.restore();
	return canvas;
}

/**
 * Grayscale + contrast stretch + adaptive (local mean) threshold.
 * Adaptive thresholding keeps text readable when lighting is uneven, which is
 * the common case for a phone photo of a receipt.
 */
export function binarize(canvas: HTMLCanvasElement, opts: { windowSize?: number; bias?: number } = {}): void {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return;
	const { width: w, height: h } = canvas;
	const img = ctx.getImageData(0, 0, w, h);
	const d = img.data;
	const n = w * h;

	// 1. grayscale (luma) into a flat array
	const gray = new Float32Array(n);
	let min = 255;
	let max = 0;
	for (let i = 0; i < n; i++) {
		const o = i * 4;
		const g = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
		gray[i] = g;
		if (g < min) min = g;
		if (g > max) max = g;
	}

	// 2. contrast stretch to the full range
	const range = Math.max(1, max - min);
	for (let i = 0; i < n; i++) gray[i] = ((gray[i] - min) / range) * 255;

	// 3. integral image for a fast local mean
	const integral = new Float64Array((w + 1) * (h + 1));
	for (let y = 0; y < h; y++) {
		let rowSum = 0;
		for (let x = 0; x < w; x++) {
			rowSum += gray[y * w + x];
			integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
		}
	}

	// 4. adaptive threshold: pixel < localMean - bias => ink
	const win = Math.max(7, opts.windowSize ?? Math.floor(Math.max(w, h) / 40) | 1);
	const half = win >> 1;
	const bias = opts.bias ?? 8;

	for (let y = 0; y < h; y++) {
		const y0 = Math.max(0, y - half);
		const y1 = Math.min(h - 1, y + half);
		for (let x = 0; x < w; x++) {
			const x0 = Math.max(0, x - half);
			const x1 = Math.min(w - 1, x + half);
			const area = (x1 - x0 + 1) * (y1 - y0 + 1);
			const sum =
				integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
				integral[y0 * (w + 1) + (x1 + 1)] -
				integral[(y1 + 1) * (w + 1) + x0] +
				integral[y0 * (w + 1) + x0];
			const mean = sum / area;
			const i = y * w + x;
			const v = gray[i] < mean - bias ? 0 : 255;
			const o = i * 4;
			d[o] = d[o + 1] = d[o + 2] = v;
			d[o + 3] = 255;
		}
	}

	ctx.putImageData(img, 0, 0);
}

/** Full clean-up pipeline. Returns a PNG data URL ready for Tesseract. */
export async function prepareForOcr(
	file: Blob,
	opts: { rotate?: number; crop?: { x: number; y: number; w: number; h: number } } = {}
): Promise<PreparedImage> {
	const img = await loadImage(file);
	const canvas = drawToCanvas(img, opts);
	binarize(canvas);
	return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** A quick blur/contrast sanity check so we can warn before a slow OCR run. */
export function imageQuality(canvas: HTMLCanvasElement): { sharpness: number; inkRatio: number } {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return { sharpness: 1, inkRatio: 0.1 };
	const { width: w, height: h } = canvas;
	const d = ctx.getImageData(0, 0, w, h).data;
	let ink = 0;
	let edges = 0;
	const step = 2;
	for (let y = 1; y < h - 1; y += step) {
		for (let x = 1; x < w - 1; x += step) {
			const i = (y * w + x) * 4;
			if (d[i] < 128) ink++;
			const right = d[(y * w + x + 1) * 4];
			const down = d[((y + 1) * w + x) * 4];
			if (Math.abs(d[i] - right) > 64 || Math.abs(d[i] - down) > 64) edges++;
		}
	}
	const sampled = Math.max(1, Math.floor(((h - 2) / step) * ((w - 2) / step)));
	return { sharpness: edges / sampled, inkRatio: ink / sampled };
}
