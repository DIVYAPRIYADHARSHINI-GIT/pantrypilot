// localStorage wrapper. Every access is wrapped in try/catch so a disabled or
// full storage never breaks the app; callers get a safe fallback instead.

import { browser } from '$app/environment';

const PREFIX = 'pantrypilot:';

export type StorageStatus = 'ok' | 'unavailable' | 'full';

let lastStatus: StorageStatus = 'ok';

export function storageStatus(): StorageStatus {
	return lastStatus;
}

export function load<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		lastStatus = 'unavailable';
		return fallback;
	}
}

export function save(key: string, value: unknown): boolean {
	if (!browser) return false;
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
		lastStatus = 'ok';
		return true;
	} catch (err) {
		// QuotaExceededError (name varies by browser) means storage is full
		const name = (err as { name?: string })?.name ?? '';
		lastStatus = /quota|full/i.test(name) ? 'full' : 'unavailable';
		return false;
	}
}

export function remove(key: string): void {
	if (!browser) return;
	try {
		localStorage.removeItem(PREFIX + key);
	} catch {
		/* ignore */
	}
}

export function clearAll(): void {
	if (!browser) return;
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(PREFIX)) keys.push(k);
		}
		for (const k of keys) localStorage.removeItem(k);
	} catch {
		/* ignore */
	}
}

export function uid(): string {
	try {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	} catch {
		/* fall through */
	}
	return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
