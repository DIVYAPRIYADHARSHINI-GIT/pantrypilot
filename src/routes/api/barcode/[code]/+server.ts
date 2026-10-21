// The only server route in PantryPilot: an Open Food Facts proxy.
// Open Food Facts asks for a descriptive User-Agent, which a browser fetch
// cannot set, so the lookup happens here. No API key is required.
// Data: Open Food Facts, licensed under the Open Database License (ODbL).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'PantryPilot/1.0 (https://github.com/DIVYAPRIYADHARSHINI-GIT/pantrypilot)';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
	at: number;
	body: unknown;
	status: number;
}

// simple in-memory cache; serverless instances keep it for their lifetime
const cache = new Map<string, CacheEntry>();

/** Map an Open Food Facts category string onto a PantryPilot category. */
function mapCategory(text: string): string {
	const t = (text || '').toLowerCase();
	const rules: Array<[RegExp, string]> = [
		[/dairy|milk|cheese|yogurt|yoghurt|butter|cream|paneer/, 'dairy'],
		[/beverage|drink|water|juice|soda|tea|coffee/, 'beverages'],
		[/bread|bakery|bun|cake|pastry|biscuit-bread/, 'bakery'],
		[/meat|poultry|chicken|fish|seafood|mutton|egg/, 'meat'],
		[/frozen/, 'frozen'],
		[/snack|chips|chocolate|candy|sweet|biscuit|cookie/, 'snacks'],
		[/vegetable|legume/, 'vegetables'],
		[/fruit/, 'fruits'],
		[/cereal|rice|flour|pasta|grain|pulse|lentil|dal/, 'grains'],
		[/spice|condiment|sauce|oil|salt|sugar|masala/, 'spices']
	];
	for (const [re, cat] of rules) if (re.test(t)) return cat;
	return 'other';
}

/** Pull a quantity + unit out of the Open Food Facts quantity string. */
function parseQuantity(q: string): { quantity: number; unit: string } | null {
	if (!q) return null;
	const m = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gm|gms|ml|l|ltr|cl|pcs|pc)\b/i);
	if (!m) return null;
	const n = parseFloat(m[1].replace(',', '.'));
	if (!isFinite(n)) return null;
	const raw = m[2].toLowerCase();
	const unit = raw === 'gm' || raw === 'gms' ? 'g' : raw === 'ltr' ? 'l' : raw === 'pc' ? 'pcs' : raw;
	return { quantity: n, unit };
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	const code = (params.code ?? '').replace(/\D/g, '');
	if (!code || code.length < 6 || code.length > 18) {
		throw error(400, 'That barcode does not look valid.');
	}

	const cached = cache.get(code);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
		return json(cached.body, { status: cached.status, headers: { 'x-cache': 'hit' } });
	}

	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

	try {
		const url = `${OFF_URL}/${encodeURIComponent(code)}?fields=product_name,brands,quantity,categories,categories_tags,image_front_small_url`;
		const res = await fetch(url, {
			signal: ac.signal,
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
		});

		if (!res.ok) {
			const body = { found: false, code, message: 'Open Food Facts did not answer for this barcode.' };
			cache.set(code, { at: Date.now(), body, status: 200 });
			return json(body);
		}

		const data = (await res.json()) as {
			status?: number;
			product?: {
				product_name?: string;
				brands?: string;
				quantity?: string;
				categories?: string;
				categories_tags?: string[];
				image_front_small_url?: string;
			};
		};

		if (data.status !== 1 || !data.product) {
			const body = {
				found: false,
				code,
				message: 'This product is not in Open Food Facts yet. Coverage of some Indian products is partial.'
			};
			cache.set(code, { at: Date.now(), body, status: 200 });
			return json(body);
		}

		const p = data.product;
		const catText = [p.categories ?? '', ...(p.categories_tags ?? [])].join(' ');
		const qty = parseQuantity(p.quantity ?? '');

		const body = {
			found: true,
			code,
			name: (p.product_name ?? '').trim() || undefined,
			brand: (p.brands ?? '').split(',')[0]?.trim() || undefined,
			quantityText: p.quantity ?? undefined,
			quantity: qty?.quantity,
			unit: qty?.unit,
			category: mapCategory(catText),
			imageUrl: p.image_front_small_url ?? undefined,
			source: 'Open Food Facts'
		};

		cache.set(code, { at: Date.now(), body, status: 200 });
		return json(body);
	} catch (err) {
		const aborted = (err as Error)?.name === 'AbortError';
		return json(
			{
				found: false,
				code,
				message: aborted
					? 'The lookup timed out. Check your connection, or add the item manually.'
					: 'The lookup failed. You can still add this item manually.'
			},
			{ status: 200 }
		);
	} finally {
		clearTimeout(timer);
	}
};
