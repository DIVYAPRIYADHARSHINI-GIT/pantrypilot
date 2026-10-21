// Catalog matcher: maps a cleaned receipt line to a catalog entry using token
// overlap plus a fuzzy (Dice bigram + edit-distance) score. Returns a confidence
// in 0..1 so the review screen can highlight low-confidence rows.

import { CATALOG, ABBREVIATIONS, DEFAULT_SHELF_LIFE } from './catalog';
import type { CatalogEntry, Category, StoragePlace } from './types';

const STOPWORDS = new Set([
	'fresh', 'premium', 'pack', 'packet', 'pkt', 'pouch', 'bottle', 'btl', 'tin', 'can',
	'box', 'bag', 'jar', 'combo', 'offer', 'new', 'special', 'brand', 'loose', 'local',
	'organic', 'natural', 'pure', 'best', 'quality', 'super', 'extra', 'value', 'family',
	'regular', 'medium', 'large', 'small', 'big', 'refill', 'nos', 'no', 'qty', 'of',
	'and', 'the', 'with', 'for', 'per', 'each', 'rs', 'inr'
]);

/** Strip HSN codes, pack sizes and receipt noise from an item name. */
export function cleanItemName(raw: string): string {
	let s = ' ' + raw.toUpperCase() + ' ';

	// HSN / SAC codes
	s = s.replace(/\bHSN\s*:?\s*\d{4,8}\b/g, ' ');
	s = s.replace(/\bSAC\s*:?\s*\d{4,8}\b/g, ' ');
	// bare long numeric codes (item codes, barcodes)
	s = s.replace(/\b\d{6,14}\b/g, ' ');
	// pack sizes: 500G, 1.5KG, 200 ML, 1 LTR, 6 PCS, 250GM
	s = s.replace(/\b\d+(?:[.,]\d+)?\s*(?:KGS?|KG|GMS?|GM|G|MGS?|ML|LTRS?|LTR|LT|L|PCS?|PC|NOS?|PKTS?|PKT|DOZ|DZ)\b/g, ' ');
	// multiplier remnants: 2X, X2, 2 @
	s = s.replace(/\b\d+\s*[xX@]\s*\d*(?:[.,]\d+)?\b/g, ' ');
	s = s.replace(/\b[xX]\s*\d+\b/g, ' ');
	// trailing prices / currency
	s = s.replace(/\b(?:RS|INR|MRP)\.?\s*\d+(?:[.,]\d+)?/g, ' ');
	s = s.replace(/[₹*#|]/g, ' ');
	// leftover punctuation
	s = s.replace(/[^A-Z0-9&.\- ]/g, ' ');
	s = s.replace(/\s+\d+(?:\.\d+)?\s*$/g, ' ');
	s = s.replace(/\s+/g, ' ').trim();

	// expand abbreviations token by token
	const expanded = s
		.split(' ')
		.map((tok) => {
			const key = tok.replace(/[.\-]/g, '');
			return ABBREVIATIONS[key] ?? tok;
		})
		.filter(Boolean)
		.join(' ');

	return titleCase(expanded);
}

export function titleCase(s: string): string {
	return s
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => (w.length <= 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
		.join(' ');
}

function tokens(s: string): string[] {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, ' ')
		.split(/\s+/)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function bigrams(s: string): Set<string> {
	const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
	const out = new Set<string>();
	for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
	return out;
}

function dice(a: string, b: string): number {
	const A = bigrams(a);
	const B = bigrams(b);
	if (A.size === 0 || B.size === 0) return 0;
	let hits = 0;
	for (const g of A) if (B.has(g)) hits++;
	return (2 * hits) / (A.size + B.size);
}

function editDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (!m) return n;
	if (!n) return m;
	let prev = Array.from({ length: n + 1 }, (_, i) => i);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) {
			cur[j] = Math.min(
				prev[j] + 1,
				cur[j - 1] + 1,
				prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
		}
		prev = cur;
	}
	return prev[n];
}

function similarity(a: string, b: string): number {
	const d = dice(a, b);
	const maxLen = Math.max(a.length, b.length) || 1;
	const ed = 1 - editDistance(a.toLowerCase(), b.toLowerCase()) / maxLen;
	return Math.max(d, ed * 0.95);
}

export interface MatchResult {
	entry?: CatalogEntry;
	name: string;
	category: Category;
	place: StoragePlace;
	unit: string;
	shelfLife: number;
	confidence: number;
	nonFood?: boolean;
}

/**
 * Match a (already cleaned) item name against the catalog.
 * Confidence: 1.0 exact name, 0.8-0.95 strong token/fuzzy, <0.6 => "Other".
 */
export function matchCatalog(name: string): MatchResult {
	const cleaned = name.trim();
	const lower = cleaned.toLowerCase();
	const nameTokens = tokens(cleaned);

	let best: CatalogEntry | undefined;
	let bestScore = 0;

	for (const entry of CATALOG) {
		const candidates = [entry.name, ...(entry.aliases ?? [])];
		for (const cand of candidates) {
			const candLower = cand.toLowerCase();
			let score = 0;

			if (candLower === lower) {
				score = 1;
			} else {
				const candTokens = tokens(cand);
				// token containment: all candidate tokens present in the item name
				const contained = candTokens.length
					? candTokens.filter((t) => nameTokens.includes(t)).length / candTokens.length
					: 0;
				// also reward when the catalog phrase appears as a substring
				// Word-bounded, so "thing" never matches the alias "hing".
				const substring =
					candLower.length >= 4 && containsWord(lower, candLower)
						? 0.9
						: lower.length >= 4 && containsWord(candLower, lower)
							? 0.82
							: 0;
				const fuzzy = similarity(cleaned, cand);
				score = Math.max(contained * 0.92, substring, fuzzy * 0.88);

				// small bonus when the first token matches (receipts lead with the noun)
				if (candTokens.length && nameTokens.length && candTokens[0] === nameTokens[0]) {
					score = Math.min(1, score + 0.06);
				}
			}

			if (score > bestScore) {
				bestScore = score;
				best = entry;
			}
		}
		if (bestScore === 1) break;
	}

	if (best && bestScore >= 0.6) {
		return {
			entry: best,
			name: best.name,
			category: best.category,
			place: best.place,
			unit: best.unit,
			shelfLife: best.shelfLife,
			confidence: Math.min(1, Math.round(bestScore * 100) / 100),
			nonFood: best.nonFood
		};
	}

	return {
		name: cleaned || 'Other',
		category: 'other',
		place: 'shelf',
		unit: 'pcs',
		shelfLife: DEFAULT_SHELF_LIFE.other,
		confidence: Math.round(bestScore * 100) / 100,
		nonFood: looksNonFood(cleaned)
	};
}

const NON_FOOD_HINTS = [
	'bag', 'cover', 'detergent', 'soap', 'shampoo', 'cleaner', 'tissue', 'brush',
	'paste', 'battery', 'candle', 'broom', 'scrub', 'repellent', 'phenyl', 'foil',
	'wash', 'deo', 'napkin', 'pad', 'razor', 'blade', 'polish', 'bulb'
];

export function looksNonFood(name: string): boolean {
	const l = name.toLowerCase();
	return NON_FOOD_HINTS.some((h) => l.includes(h));
}

/** Substring test that respects word boundaries. */
function containsWord(haystack: string, needle: string): boolean {
	const i = haystack.indexOf(needle);
	if (i < 0) return false;
	const before = i === 0 ? ' ' : haystack[i - 1];
	const afterIdx = i + needle.length;
	const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
	return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

/** Suggest catalog names for the manual-add autocomplete. */
export function suggestNames(query: string, limit = 8): string[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const scored: Array<{ name: string; score: number }> = [];
	for (const e of CATALOG) {
		const hay = [e.name, ...(e.aliases ?? [])];
		let s = 0;
		for (const h of hay) {
			const hl = h.toLowerCase();
			if (hl.startsWith(q)) s = Math.max(s, 1);
			else if (hl.includes(q)) s = Math.max(s, 0.8);
			else s = Math.max(s, similarity(q, hl) * 0.6);
		}
		if (s > 0.35) scored.push({ name: e.name, score: s });
	}
	scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of scored) {
		if (seen.has(s.name)) continue;
		seen.add(s.name);
		out.push(s.name);
		if (out.length >= limit) break;
	}
	return out;
}
