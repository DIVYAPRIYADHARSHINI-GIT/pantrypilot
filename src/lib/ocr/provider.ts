// OcrProvider interface. The browser Tesseract provider is the default and the
// only one that ships enabled; a cloud provider can be added later behind an
// environment variable. The app works fully without any cloud provider.

export interface OcrProgress {
	status: string;
	progress: number;
}

export interface OcrResult {
	text: string;
	confidence: number;
}

export interface OcrProvider {
	readonly id: string;
	readonly label: string;
	recognize(
		dataUrl: string,
		opts: { onProgress?: (p: OcrProgress) => void; signal?: AbortSignal; timeoutMs?: number }
	): Promise<OcrResult>;
	dispose(): void;
}

export const OCR_TIMEOUT_MS = 60_000;

/** Browser-side Tesseract.js provider running inside a dedicated Web Worker. */
export class BrowserTesseractProvider implements OcrProvider {
	readonly id = 'tesseract-browser';
	readonly label = 'Tesseract.js (on this device)';
	private worker: Worker | null = null;

	private ensureWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL('./ocrWorker.ts', import.meta.url), { type: 'module' });
		}
		return this.worker;
	}

	recognize(
		dataUrl: string,
		opts: { onProgress?: (p: OcrProgress) => void; signal?: AbortSignal; timeoutMs?: number } = {}
	): Promise<OcrResult> {
		const timeoutMs = opts.timeoutMs ?? OCR_TIMEOUT_MS;
		const worker = this.ensureWorker();

		return new Promise<OcrResult>((resolve, reject) => {
			let settled = false;

			const cleanup = () => {
				worker.removeEventListener('message', onMessage);
				clearTimeout(timer);
				opts.signal?.removeEventListener('abort', onAbort);
			};

			const finish = (fn: () => void) => {
				if (settled) return;
				settled = true;
				cleanup();
				fn();
			};

			const onMessage = (e: MessageEvent) => {
				const msg = e.data;
				if (msg?.type === 'progress') {
					opts.onProgress?.({ status: msg.status, progress: msg.progress });
				} else if (msg?.type === 'done') {
					finish(() => resolve({ text: msg.text, confidence: msg.confidence }));
				} else if (msg?.type === 'error') {
					finish(() => reject(new Error(msg.message)));
				}
			};

			const onAbort = () => {
				// a cancelled run gets a fresh worker, because Tesseract has no mid-run cancel
				this.dispose();
				finish(() => reject(new DOMException('Cancelled', 'AbortError')));
			};

			const timer = setTimeout(() => {
				this.dispose();
				finish(() =>
					reject(
						new Error(
							'Reading the bill took longer than 60 seconds. Try a smaller or clearer photo, or paste the bill text instead.'
						)
					)
				);
			}, timeoutMs);

			if (opts.signal?.aborted) {
				onAbort();
				return;
			}
			opts.signal?.addEventListener('abort', onAbort, { once: true });
			worker.addEventListener('message', onMessage);
			worker.postMessage({ type: 'recognize', dataUrl });
		});
	}

	dispose() {
		try {
			this.worker?.postMessage({ type: 'terminate' });
			this.worker?.terminate();
		} catch {
			/* ignore */
		}
		this.worker = null;
	}
}

let active: OcrProvider | null = null;

/** Lazily create the provider; only called from the scan page. */
export function getOcrProvider(): OcrProvider {
	if (!active) active = new BrowserTesseractProvider();
	return active;
}

export function disposeOcrProvider(): void {
	active?.dispose();
	active = null;
}
