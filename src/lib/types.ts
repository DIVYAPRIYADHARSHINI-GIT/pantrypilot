// PantryPilot shared types.
// Everything is stored in localStorage; no server, no accounts.

export type StoragePlace = 'fridge' | 'freezer' | 'shelf';

export type Category =
	| 'dairy'
	| 'vegetables'
	| 'fruits'
	| 'grains'
	| 'snacks'
	| 'meat'
	| 'beverages'
	| 'bakery'
	| 'spices'
	| 'frozen'
	| 'household'
	| 'other';

export interface CatalogEntry {
	name: string;
	category: Category;
	place: StoragePlace;
	unit: string;
	/** typical shelf life in days from purchase */
	shelfLife: number;
	/** true for non-food lines like bags, soap, detergent */
	nonFood?: boolean;
	/** extra search tokens / aliases */
	aliases?: string[];
}

export interface PantryItem {
	id: string;
	name: string;
	quantity: number;
	unit: string;
	category: Category;
	place: StoragePlace;
	/** ISO date string, local-date only (YYYY-MM-DD) */
	purchaseDate: string;
	expiryDate: string;
	/** true when expiry came from a shelf-life estimate rather than the user/label */
	expiryEstimated: boolean;
	price?: number;
	notes?: string;
	barcode?: string;
	brand?: string;
	lowStock?: boolean;
	createdAt: number;
}

export interface WasteRecord {
	id: string;
	name: string;
	category: Category;
	quantity: number;
	unit: string;
	price?: number;
	/** 'used' = consumed, 'wasted' = discarded */
	kind: 'used' | 'wasted';
	date: string;
}

export interface ReceiptRecord {
	id: string;
	store: string;
	date: string;
	total: number;
	itemCount: number;
	categoryTotals: Partial<Record<Category, number>>;
	createdAt: number;
}

export interface ShoppingItem {
	id: string;
	name: string;
	quantity: number;
	unit: string;
	category: Category;
	checked: boolean;
	createdAt: number;
}

export interface Settings {
	warningDays: number;
	currency: string;
	defaultPlace: StoragePlace;
	defaultUnit: string;
	theme: 'light' | 'dark' | 'system';
	notificationsEnabled: boolean;
	/** editable default shelf life per category, in days */
	shelfLifeByCategory: Partial<Record<Category, number>>;
}

/** One row on the review screen, before it is committed to the pantry. */
export interface ReviewRow {
	id: string;
	selected: boolean;
	name: string;
	rawName: string;
	quantity: number;
	unit: string;
	category: Category;
	place: StoragePlace;
	price?: number;
	expiryDate: string;
	expiryEstimated: boolean;
	/** 0..1 confidence from catalog matching */
	confidence: number;
	nonFood?: boolean;
}

export interface ParsedItem {
	rawText: string;
	name: string;
	quantity: number;
	unit: string;
	price?: number;
	category: Category;
	place: StoragePlace;
	shelfLife: number;
	confidence: number;
	nonFood?: boolean;
}

export interface ParsedBill {
	store?: string;
	date?: string;
	total?: number;
	items: ParsedItem[];
	/** sum of item prices */
	itemsSum: number;
	/** true when |itemsSum - total| / total > 0.03 */
	mismatch: boolean;
	warnings: string[];
}
