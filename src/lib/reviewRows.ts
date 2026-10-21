// Builds the editable review rows from a ParsedBill, and commits the selected
// rows into the pantry (merging duplicates instead of creating them).

import { estimateShelfLife } from './shelfLife';
import { todayISO } from './dates';
import { uid } from './storage';
import type { ParsedBill, ReviewRow, Settings, Category } from './types';

export function buildReviewRows(
	bill: ParsedBill,
	settings: Pick<Settings, 'shelfLifeByCategory'>,
	purchaseDate?: string
): ReviewRow[] {
	const purchase = purchaseDate ?? bill.date ?? todayISO();
	return bill.items.map((it) => {
		const est = estimateShelfLife({
			name: it.name,
			category: it.category,
			catalogDays: it.shelfLife,
			purchaseDate: purchase,
			settings
		});
		return {
			id: uid(),
			// non-food lines stay unchecked by default
			selected: !it.nonFood,
			name: it.name,
			rawName: it.rawText,
			quantity: it.quantity,
			unit: it.unit,
			category: it.category,
			place: it.place,
			price: it.price,
			expiryDate: est.expiryDate,
			expiryEstimated: true,
			confidence: it.confidence,
			nonFood: it.nonFood
		};
	});
}

export function blankRow(settings: Settings, purchaseDate?: string): ReviewRow {
	const purchase = purchaseDate ?? todayISO();
	const est = estimateShelfLife({ category: 'other', purchaseDate: purchase, settings });
	return {
		id: uid(),
		selected: true,
		name: '',
		rawName: '',
		quantity: 1,
		unit: settings.defaultUnit,
		category: 'other' as Category,
		place: settings.defaultPlace,
		price: undefined,
		expiryDate: est.expiryDate,
		expiryEstimated: true,
		confidence: 1
	};
}

/** Category totals for the receipt record, from the selected rows. */
export function categoryTotals(rows: ReviewRow[]): Partial<Record<Category, number>> {
	const out: Partial<Record<Category, number>> = {};
	for (const r of rows) {
		if (!r.selected || r.price === undefined) continue;
		out[r.category] = Math.round(((out[r.category] ?? 0) + r.price) * 100) / 100;
	}
	return out;
}
