// Central app state using Svelte 5 runes. All data lives in localStorage.
// Writes are explicit (no $effect write-back loops) to avoid reactive cycles.

import { load, save, clearAll, uid } from './storage';
import { sampleItems, sampleReceipts, sampleShopping } from './sampleData';
import { todayISO, daysLeft, freshState } from './dates';
import type {
	PantryItem,
	ReceiptRecord,
	Settings,
	ShoppingItem,
	WasteRecord,
	Category,
	StoragePlace
} from './types';

const DEFAULT_SETTINGS: Settings = {
	warningDays: 3,
	currency: '₹',
	defaultPlace: 'shelf',
	defaultUnit: 'pcs',
	theme: 'system',
	notificationsEnabled: false,
	shelfLifeByCategory: {}
};

class AppStore {
	items = $state<PantryItem[]>([]);
	receipts = $state<ReceiptRecord[]>([]);
	shopping = $state<ShoppingItem[]>([]);
	waste = $state<WasteRecord[]>([]);
	settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	ready = $state(false);

	/** Load from localStorage, seeding sample data on first run. */
	init() {
		if (this.ready) return;
		const seeded = load<boolean>('seeded', false);
		this.settings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) };

		if (!seeded) {
			this.items = sampleItems();
			this.receipts = sampleReceipts();
			this.shopping = sampleShopping();
			this.waste = [];
			this.persistAll();
			save('seeded', true);
		} else {
			this.items = load<PantryItem[]>('items', []);
			this.receipts = load<ReceiptRecord[]>('receipts', []);
			this.shopping = load<ShoppingItem[]>('shopping', []);
			this.waste = load<WasteRecord[]>('waste', []);
		}
		this.ready = true;
	}

	persistAll() {
		save('items', this.items);
		save('receipts', this.receipts);
		save('shopping', this.shopping);
		save('waste', this.waste);
		save('settings', this.settings);
	}

	saveItems() {
		save('items', this.items);
	}
	saveShopping() {
		save('shopping', this.shopping);
	}
	saveReceipts() {
		save('receipts', this.receipts);
	}
	saveWaste() {
		save('waste', this.waste);
	}
	saveSettings() {
		save('settings', this.settings);
	}

	/* ---------------- pantry ---------------- */

	/** Find an existing item with the same name + storage place (duplicate merge). */
	findDuplicate(name: string, place?: StoragePlace): PantryItem | undefined {
		const n = name.trim().toLowerCase();
		return this.items.find(
			(i) => i.name.trim().toLowerCase() === n && (place === undefined || i.place === place)
		);
	}

	addItem(item: Omit<PantryItem, 'id' | 'createdAt'>): PantryItem {
		const full: PantryItem = { ...item, id: uid(), createdAt: Date.now() };
		this.items = [...this.items, full];
		this.saveItems();
		return full;
	}

	updateItem(id: string, patch: Partial<PantryItem>) {
		this.items = this.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
		this.saveItems();
	}

	/** Increase the quantity of an existing item (duplicate merge path). */
	mergeQuantity(id: string, addQty: number, price?: number) {
		this.items = this.items.map((i) =>
			i.id === id
				? {
						...i,
						quantity: Math.round((i.quantity + addQty) * 100) / 100,
						price: price ?? i.price,
						lowStock: false
					}
				: i
		);
		this.saveItems();
	}

	removeItem(id: string) {
		this.items = this.items.filter((i) => i.id !== id);
		this.saveItems();
	}

	/** Consume part of an item. Returns true when it hit zero. */
	useSome(id: string, amount: number): boolean {
		const item = this.items.find((i) => i.id === id);
		if (!item) return false;
		const next = Math.max(0, Math.round((item.quantity - amount) * 100) / 100);
		this.recordUse(item, Math.min(amount, item.quantity), 'used');
		if (next === 0) {
			this.items = this.items.filter((i) => i.id !== id);
			this.saveItems();
			return true;
		}
		this.updateItem(id, { quantity: next });
		return false;
	}

	useAll(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		this.recordUse(item, item.quantity, 'used');
		this.removeItem(id);
	}

	/** Discard an item: counted as waste, with its price. */
	discard(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		this.recordUse(item, item.quantity, 'wasted');
		this.removeItem(id);
	}

	private recordUse(item: PantryItem, quantity: number, kind: 'used' | 'wasted') {
		const share = item.quantity > 0 ? quantity / item.quantity : 1;
		this.waste = [
			...this.waste,
			{
				id: uid(),
				name: item.name,
				category: item.category,
				quantity,
				unit: item.unit,
				price: item.price !== undefined ? Math.round(item.price * share * 100) / 100 : undefined,
				kind,
				date: todayISO()
			}
		];
		this.saveWaste();
	}

	/* ---------------- shopping list ---------------- */

	addToShopping(name: string, quantity = 1, unit = 'pcs', category: Category = 'other') {
		const existing = this.shopping.find(
			(s) => s.name.trim().toLowerCase() === name.trim().toLowerCase() && !s.checked
		);
		if (existing) return;
		this.shopping = [
			...this.shopping,
			{ id: uid(), name, quantity, unit, category, checked: false, createdAt: Date.now() }
		];
		this.saveShopping();
	}

	toggleShopping(id: string) {
		this.shopping = this.shopping.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s));
		this.saveShopping();
	}

	removeShopping(id: string) {
		this.shopping = this.shopping.filter((s) => s.id !== id);
		this.saveShopping();
	}

	clearCheckedShopping() {
		this.shopping = this.shopping.filter((s) => !s.checked);
		this.saveShopping();
	}

	/* ---------------- receipts ---------------- */

	addReceipt(r: Omit<ReceiptRecord, 'id' | 'createdAt'>) {
		this.receipts = [...this.receipts, { ...r, id: uid(), createdAt: Date.now() }];
		this.saveReceipts();
	}

	removeReceipt(id: string) {
		this.receipts = this.receipts.filter((r) => r.id !== id);
		this.saveReceipts();
	}

	/* ---------------- derived ---------------- */

	get expiringToday(): PantryItem[] {
		return this.items.filter((i) => daysLeft(i.expiryDate) === 0);
	}

	get expiringSoon(): PantryItem[] {
		const w = this.settings.warningDays;
		return this.items
			.filter((i) => {
				const d = daysLeft(i.expiryDate);
				return d > 0 && d <= w;
			})
			.sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate));
	}

	get expired(): PantryItem[] {
		return this.items
			.filter((i) => daysLeft(i.expiryDate) < 0)
			.sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate));
	}

	/** Items to use first: expired excluded, soonest expiry first. */
	get useFirst(): PantryItem[] {
		return this.items
			.filter((i) => daysLeft(i.expiryDate) >= 0)
			.sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate))
			.slice(0, 5);
	}

	get alertCount(): number {
		return this.expired.length + this.expiringToday.length + this.expiringSoon.length;
	}

	stateOf(item: PantryItem) {
		return freshState(item.expiryDate, this.settings.warningDays);
	}

	/* ---------------- backup ---------------- */

	exportJSON(): string {
		return JSON.stringify(
			{
				app: 'PantryPilot',
				version: 1,
				exportedAt: new Date().toISOString(),
				items: this.items,
				receipts: this.receipts,
				shopping: this.shopping,
				waste: this.waste,
				settings: this.settings
			},
			null,
			2
		);
	}

	importJSON(text: string): { ok: boolean; message: string } {
		try {
			const data = JSON.parse(text);
			if (!data || typeof data !== 'object') return { ok: false, message: 'That file is not valid JSON.' };
			if (!Array.isArray(data.items)) return { ok: false, message: 'No pantry items found in that backup.' };
			this.items = data.items;
			this.receipts = Array.isArray(data.receipts) ? data.receipts : [];
			this.shopping = Array.isArray(data.shopping) ? data.shopping : [];
			this.waste = Array.isArray(data.waste) ? data.waste : [];
			this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
			this.persistAll();
			save('seeded', true);
			return { ok: true, message: `Imported ${this.items.length} pantry items.` };
		} catch {
			return { ok: false, message: 'That file could not be read as JSON.' };
		}
	}

	exportCSV(): string {
		const head = ['Name', 'Quantity', 'Unit', 'Category', 'Place', 'Purchased', 'Expires', 'Estimated', 'Price'];
		const rows = this.items.map((i) => [
			i.name,
			String(i.quantity),
			i.unit,
			i.category,
			i.place,
			i.purchaseDate,
			i.expiryDate,
			i.expiryEstimated ? 'yes' : 'no',
			i.price !== undefined ? String(i.price) : ''
		]);
		return [head, ...rows]
			.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
			.join('\n');
	}

	startFresh() {
		clearAll();
		this.items = [];
		this.receipts = [];
		this.shopping = [];
		this.waste = [];
		this.settings = { ...DEFAULT_SETTINGS };
		save('seeded', true);
		this.persistAll();
	}

	loadSampleData() {
		this.items = sampleItems();
		this.receipts = sampleReceipts();
		this.shopping = sampleShopping();
		this.waste = [];
		this.persistAll();
		save('seeded', true);
	}
}

export const app = new AppStore();
