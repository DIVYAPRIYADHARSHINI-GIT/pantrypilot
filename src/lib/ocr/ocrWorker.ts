// Dedicated Web Worker that runs Tesseract.js, so the OCR pass never blocks
// the UI thread. All engine assets are served from /tesseract (self-hosted).

import { createWorker } from 'tesseract.js';

type InMsg = { type: 'recognize'; dataUrl: string } | { type: 'terminate' };
type OutMsg =
	| { type: 'progress'; status: string; progress: number }
	| { type: 'done'; text: string; confidence: number }
	| { type: 'error'; message: string };

let workerPromise: ReturnType<typeof createWorker> | null = null;

function post(msg: OutMsg) {
	(self as unknown as Worker).postMessage(msg);
}

async function getWorker() {
	if (!workerPromise) {
		// Absolute URLs: inside a worker, importScripts cannot resolve a
		// root-relative path, so build them from the worker's own origin.
		const origin = new URL(self.location.href).origin;
		workerPromise = createWorker('eng', 1, {
			// self-hosted assets, nothing from a CDN
			workerPath: `${origin}/tesseract/worker.min.js`,
			corePath: `${origin}/tesseract`,
			langPath: `${origin}/tesseract`,
			gzip: false,
			logger: (m: { status: string; progress: number }) => {
				post({ type: 'progress', status: m.status, progress: m.progress ?? 0 });
			}
		});
	}
	return workerPromise;
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
	const msg = e.data;
	if (msg.type === 'terminate') {
		try {
			const w = await workerPromise;
			await w?.terminate();
		} catch {
			/* ignore */
		}
		workerPromise = null;
		return;
	}

	if (msg.type === 'recognize') {
		try {
			const worker = await getWorker();
			const result = await worker.recognize(msg.dataUrl);
			post({
				type: 'done',
				text: result.data.text ?? '',
				confidence: result.data.confidence ?? 0
			});
		} catch (err) {
			post({ type: 'error', message: (err as Error)?.message ?? 'OCR failed' });
		}
	}
};
