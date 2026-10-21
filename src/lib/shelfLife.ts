// Shelf-life estimator: converts a catalog match (or a bare category) into an
// estimated expiry date. Every estimate is flagged so the UI can show the
// "Estimated" badge and the user can correct it.

import { DEFAULT_SHELF_LIFE, catalogByExactName } from './catalog';
import { addDays, todayISO } from './dates';
import type { Category, Settings } from './types';

export interface ShelfLifeEstimate {
	days: number;
	expiryDate: string;
	estimated: true;
	source: 'catalog' | 'settings' | 'category-default';
}

/**
 * Estimate shelf life in days for an item.
 * Priority: user's per-category override > catalog entry > category default.
 */
export function estimateShelfLife(
	opts: {
		name?: string;
		category?: Category;
		catalogDays?: number;
		purchaseDate?: string;
		settings?: Pick<Settings, 'shelfLifeByCategory'>;
	} = {}
): ShelfLifeEstimate {
	const purchase = opts.purchaseDate ?? todayISO();
	const override = opts.category ? opts.settings?.shelfLifeByCategory?.[opts.category] : undefined;

	if (typeof override === 'number' && override > 0) {
		return { days: override, expiryDate: addDays(purchase, override), estimated: true, source: 'settings' };
	}

	if (typeof opts.catalogDays === 'number' && opts.catalogDays > 0) {
		return {
			days: opts.catalogDays,
			expiryDate: addDays(purchase, opts.catalogDays),
			estimated: true,
			source: 'catalog'
		};
	}

	if (opts.name) {
		const entry = catalogByExactName(opts.name);
		if (entry) {
			return {
				days: entry.shelfLife,
				expiryDate: addDays(purchase, entry.shelfLife),
				estimated: true,
				source: 'catalog'
			};
		}
	}

	const cat = opts.category ?? 'other';
	const days = DEFAULT_SHELF_LIFE[cat] ?? DEFAULT_SHELF_LIFE.other;
	return { days, expiryDate: addDays(purchase, days), estimated: true, source: 'category-default' };
}
