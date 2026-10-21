// Sample data so a first-time visitor sees a realistic pantry immediately.
// Expiry dates are generated relative to today so the colour states (fresh /
// expiring soon / expired) are always meaningful.

import { addDays, todayISO } from './dates';
import { catalogByExactName } from './catalog';
import { uid } from './storage';
import type { PantryItem, ReceiptRecord, ShoppingItem, Category } from './types';

type Seed = [name: string, qty: number, offsetDays: number, price?: number];

// offsetDays: days from today until expiry (negative = already expired)
const SEEDS: Seed[] = [
	['Milk', 2, 1, 56],
	['Curd', 1, 2, 42],
	['Paneer', 1, 0, 95],
	['Butter', 1, 28, 58],
	['Cheese Slices', 1, 15, 125],
	['Eggs', 10, 12, 96],
	['Tomato', 1, 3, 38],
	['Onion', 2, 22, 74],
	['Potato', 2, 15, 56],
	['Carrot', 1, 6, 32],
	['Spinach', 1, -1, 25],
	['Coriander Leaves', 1, 2, 15],
	['Capsicum', 1, 8, 40],
	['Banana', 1, 2, 60],
	['Apple', 1, 16, 180],
	['Grapes', 1, -2, 90],
	['Bread', 1, 1, 45],
	['Rice', 5, 300, 620],
	['Wheat Flour', 5, 150, 245],
	['Toor Dal', 1, 250, 168],
	['Sunflower Oil', 1, 200, 148],
	['Chicken', 1, 1, 245],
	['Tea Powder', 1, 300, 240],
	['Biscuits', 2, 90, 60],
	['Sugar', 2, 500, 96]
];

// Realistic pack sizes for the gram/millilitre sample items.
const PACK_SIZE: Record<string, number> = {
	Curd: 400,
	Paneer: 200,
	Butter: 100,
	Spinach: 1,
	'Coriander Leaves': 1,
	Grapes: 500,
	'Tea Powder': 250
};

export function sampleItems(today = todayISO()): PantryItem[] {
	return SEEDS.map(([name, quantity, offset, price]) => {
		const entry = catalogByExactName(name);
		const unit = entry?.unit ?? 'pcs';
		// a gram/millilitre item is bought as a pack, so "1 g" would read oddly
		const qty =
			quantity === 1 && (unit === 'g' || unit === 'ml')
				? PACK_SIZE[name] ?? 250
				: quantity;
		const shelf = entry?.shelfLife ?? 14;
		const expiryDate = addDays(today, offset);
		// purchase date derived so the numbers stay coherent
		const purchaseDate = addDays(expiryDate, -shelf);
		return {
			id: uid(),
			name: entry?.name ?? name,
			quantity: qty,
			unit,
			category: (entry?.category ?? 'other') as Category,
			place: entry?.place ?? 'shelf',
			purchaseDate,
			expiryDate,
			expiryEstimated: true,
			price,
			createdAt: Date.now()
		};
	});
}

export function sampleReceipts(today = todayISO()): ReceiptRecord[] {
	return [
		{
			id: uid(),
			store: 'Green Basket Supermarket',
			date: addDays(today, -6),
			total: 1248,
			itemCount: 12,
			categoryTotals: { dairy: 376, vegetables: 240, grains: 432, bakery: 45, snacks: 60, beverages: 95 },
			createdAt: Date.now() - 6 * 86400000
		},
		{
			id: uid(),
			store: 'Fresh Mart Daily Needs',
			date: addDays(today, -27),
			total: 2135,
			itemCount: 18,
			categoryTotals: { dairy: 420, vegetables: 365, grains: 790, meat: 245, household: 210, snacks: 105 },
			createdAt: Date.now() - 27 * 86400000
		}
	];
}

export function sampleShopping(): ShoppingItem[] {
	return [
		{ id: uid(), name: 'Curd', quantity: 1, unit: 'g', category: 'dairy', checked: false, createdAt: Date.now() },
		{ id: uid(), name: 'Green Chilli', quantity: 100, unit: 'g', category: 'vegetables', checked: false, createdAt: Date.now() }
	];
}
