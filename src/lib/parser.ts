// Bill parser: turns raw OCR text (or pasted e-bill text) into a ParsedBill.
// Pure, synchronous and dependency-free so it can be unit tested directly.
//
// Design notes:
// - OCR digit repair (O->0, l/I->1, S->5, B->8) is applied ONLY inside numeric
//   fields, never to item names, so "SOAP" never becomes "50AP".
// - A line is an item when it has item text followed by a trailing amount, or
//   when the amount legitimately sits on the following line.
// - Noise lines (GST, phone, invoice no, payment modes, totals, addresses) are
//   rejected before item detection.

import { cleanItemName, matchCatalog, looksNonFood } from './matcher';
import { parseBillDate, todayISO, addDays } from './dates';
import type { ParsedBill, ParsedItem } from './types';

/* ------------------------------------------------------------------ */
/* numeric repair                                                      */
/* ------------------------------------------------------------------ */

/** Repair OCR confusions inside a numeric token only. */
export function repairNumber(token: string): string {
	return token
		.replace(/[Oo]/g, '0')
		.replace(/[lI|]/g, '1')
		.replace(/[Ss]/g, '5')
		.replace(/[Bb]/g, '8')
		.replace(/[Zz]/g, '2')
		.replace(/[gq]/g, '9');
}

/**
 * Parse an amount that may contain OCR noise and Indian digit grouping.
 * "1,234.50" -> 1234.5, "45,00" -> 45.00, "l20.0O" -> 120.00
 */
export function parseAmount(raw: string): number | undefined {
	if (!raw) return undefined;
	// Strip currency words/symbols BEFORE digit repair, otherwise the "s" in
	// "Rs." would be repaired into a 5 ("Rs.148.00" -> "5148.00").
	let s = raw.trim().replace(/^\s*(?:₹|rs\.?|inr|mrp)\s*/i, '');
	s = repairNumber(s).replace(/[^0-9.,\-]/g, '');
	if (!s) return undefined;

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');

	if (lastComma > -1 && lastDot > -1) {
		// both present: the later one is the decimal separator
		if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
		else s = s.replace(/,/g, '');
	} else if (lastComma > -1) {
		const after = s.length - lastComma - 1;
		// "45,00" is a decimal comma; "1,234" is a thousands separator
		if (after === 2 && s.replace(/,/g, '').length <= 6 && !/,\d{3}$/.test(s)) {
			s = s.replace(',', '.');
		} else if (after === 2 && /^\d{1,2},\d{2}$/.test(s)) {
			s = s.replace(',', '.');
		} else {
			s = s.replace(/,/g, '');
		}
	}

	// collapse multiple dots: keep the last as decimal
	const parts = s.split('.');
	if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];

	const n = parseFloat(s);
	if (!isFinite(n)) return undefined;
	return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* line classification                                                 */
/* ------------------------------------------------------------------ */

const TOTAL_KEYS = [
	'grand total', 'nett total', 'net amount', 'net total', 'amount payable',
	'payable amount', 'total amount', 'bill amount', 'total payable', 'total'
];

const NOISE_PATTERNS: RegExp[] = [
	/\bGSTIN?\b/i,
	/\bGST\s*(NO|IN)\b/i,
	/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}\b/, // GSTIN format
	/\bPAN\b\s*:?/i,
	/\bFSSAI\b/i,
	/\bCIN\b\s*:?/i,
	/\b(C|S|I)GST\b/i,
	/\bTAX(ABLE)?\b/i,
	/\bVAT\b/i,
	/\bCESS\b/i,
	/\bDISCOUNT\b/i,
	/\bDISC\b\s*[:.]?/i,
	/\bSAVINGS?\b/i,
	/\bROUND\s*(ED)?\s*OFF\b/i,
	/\bR\.?O\.?F\b/i,
	/\bCASH\b/i,
	/\bCARD\b/i,
	/\bUPI\b/i,
	/\bPAYTM\b/i,
	/\bPHONEPE\b/i,
	/\bGPAY\b/i,
	/\bCHANGE\b/i,
	/\bTENDER(ED)?\b/i,
	/\bBALANCE\b/i,
	/\bINVOICE\b/i,
	/\bBILL\s*(NO|NUMBER|#)/i,
	/\bRECEIPT\s*(NO|#)/i,
	/\bORDER\s*(NO|ID)/i,
	/\bTOKEN\b/i,
	/\bCOUNTER\b/i,
	/\bCASHIER\b/i,
	/\bOPERATOR\b/i,
	/\bTERMINAL\b/i,
	/\bPH(ONE)?\s*(NO)?\s*[:.]/i,
	/\bMOB(ILE)?\s*(NO)?\s*[:.]/i,
	/\bTEL\b\s*[:.]/i,
	/\bCUSTOMER\b/i,
	/\bMEMBER(SHIP)?\b/i,
	/\bPOINTS?\b/i,
	/\bTHANK\s*YOU\b/i,
	/\bVISIT\s*AGAIN\b/i,
	/\bWELCOME\b/i,
	/\bTERMS\b/i,
	/\bEXCHANGE\b/i,
	/\bNO\.?\s*OF\s*ITEMS?\b/i,
	/\bTOTAL\s*(ITEMS?|QTY|QUANTITY|NOS)\b/i,
	/\bITEMS?\s*(COUNT|SOLD)\b/i,
	/\bSUB\s*TOTAL\b/i,
	/\bSUBTOTAL\b/i,
	/\bMRP\s*(TOTAL|VALUE)\b/i,
	/\bITEM\s*TOTAL\b/i,
	/\bDELIVERY\b/i,
	/\bSHIPPING\b/i,
	/\bPACKING\b/i,
	/\bHANDLING\b/i,
	/\bCONVENIENCE\s*FEE\b/i,
	/\bQTY\b\s*[:.]/i,
	/\bDATE\b\s*[:.]/i,
	/\bTIME\b\s*[:.]/i,
	/\bwww\./i,
	/@[a-z0-9.-]+\.[a-z]{2,}/i,
	/\bPIN\s*(CODE)?\s*[:.]?\s*\d{6}\b/i,
	/\b\d{6}\b\s*$/,
	/\bROAD\b|\bSTREET\b|\bNAGAR\b|\bLAYOUT\b|\bCROSS\b|\bMAIN\b|\bSECTOR\b|\bPHASE\b/i,
	/\bBRANCH\b/i,
	/\bRETAIL\b\s*(INVOICE|BILL)/i,
	/\bSAVED\b/i,
	/\bLOYALTY\b/i
];

/** Column-header rows such as "ITEM QTY RATE AMOUNT". */
const HEADER_PATTERN =
	/^[^a-z0-9]*((s\.?no|sno|sl|item|description|particulars|product)\b).{0,40}\b(qty|quantity|rate|price|mrp|amount|amt|value|total)\b/i;

export function isNoiseLine(line: string): boolean {
	const t = line.trim();
	if (!t) return true;
	if (t.length < 2) return true;
	// separator rows
	if (/^[-=_*.~\s|]+$/.test(t)) return true;
	if (HEADER_PATTERN.test(t)) return true;
	if (/\b(qty|rate|amount)\b.*\b(qty|rate|amount)\b/i.test(t) && !/\d/.test(t)) return true;
	for (const p of NOISE_PATTERNS) if (p.test(t)) return true;
	return false;
}

/** Does this line announce the bill total? Returns the amount when so. */
export function matchTotalLine(line: string): number | undefined {
	const l = line.toLowerCase();
	for (const key of TOTAL_KEYS) {
		if (!l.includes(key)) continue;
		// ignore "total items" / "total qty" style lines
		if (/total\s*(items?|qty|quantity|nos|pcs)/i.test(line)) continue;
		const m = line.match(/((?:₹|rs\.?|inr)?\s*[0-9OolISB][0-9OolISB.,]*)\s*(?:\/-)?\s*$/i);
		if (m) {
			if (!/\d/.test(m[1])) continue;
			const amt = parseAmount(m[1]);
			if (amt !== undefined && amt > 0) return amt;
		}
	}
	return undefined;
}

/** True when the line is only a total keyword, with its amount on the next line. */
export function isTotalKeywordOnly(line: string): boolean {
	const l = line.trim().toLowerCase().replace(/[:\s]+$/, '');
	if (/\d/.test(l)) return false;
	if (/total\s*(items?|qty|quantity|nos|pcs)/i.test(l)) return false;
	return TOTAL_KEYS.some((k) => l === k);
}

/* ------------------------------------------------------------------ */
/* quantity extraction                                                 */
/* ------------------------------------------------------------------ */

export interface QtyInfo {
	quantity?: number;
	unit?: string;
	/** unit price when the line used "2 x 45.00" */
	unitPrice?: number;
}

const UNIT_MAP: Record<string, string> = {
	KG: 'kg', KGS: 'kg', K: 'kg',
	G: 'g', GM: 'g', GMS: 'g', GRAM: 'g', GRAMS: 'g',
	ML: 'ml', L: 'l', LT: 'l', LTR: 'l', LTRS: 'l', LITRE: 'l', LITER: 'l',
	PC: 'pcs', PCS: 'pcs', PCES: 'pcs', NO: 'pcs', NOS: 'pcs', EA: 'pcs',
	PKT: 'pkt', PKTS: 'pkt', PACK: 'pkt', PACKET: 'pkt', PKG: 'pkt',
	DOZ: 'dozen', DZ: 'dozen', DOZEN: 'dozen',
	BUNCH: 'bunch', BDL: 'bunch',
	BTL: 'pcs', BOTTLE: 'pcs', TIN: 'pcs', CAN: 'pcs', BOX: 'pcs', TRAY: 'pcs'
};

/**
 * Extract quantity / unit / unit-price hints from a receipt line.
 * Handles "2 x 45.00", "2 @ 45", "500 G", "1.5 KG", "1 PKT".
 */
export function extractQuantity(line: string): QtyInfo {
	const upper = line.toUpperCase();

	// "2 x 45.00" or "2 @ 45" => count and unit price
	const mult = upper.match(/(\d+(?:[.,]\d+)?)\s*[X@]\s*(?:RS\.?|₹)?\s*(\d+(?:[.,]\d+)?)/);
	if (mult) {
		const q = parseAmount(mult[1]);
		const up = parseAmount(mult[2]);
		if (q !== undefined && q > 0 && q < 1000) {
			return { quantity: q, unit: 'pcs', unitPrice: up };
		}
	}

	// weight / volume / pack: "500 G", "1.5 KG", "2 PKT", "250GM"
	const wt = upper.match(/(\d+(?:[.,]\d+)?)\s*(KGS?|KG|GMS?|GM|GRAMS?|G|ML|LTRS?|LTR|LT|L|PCS?|PCES|NOS?|PKTS?|PKT|PACKETS?|PACK|DOZEN|DOZ|DZ|BUNCH|BDL|BTL|BOTTLE|TIN|CAN|BOX|TRAY)\b/);
	if (wt) {
		const q = parseAmount(wt[1]);
		const unit = UNIT_MAP[wt[2].toUpperCase()] ?? wt[2].toLowerCase();
		if (q !== undefined && q > 0) return { quantity: q, unit };
	}

	// leading bare count: "2 TOMATO 90.00"
	const lead = upper.match(/^\s*(\d{1,2})\s+[A-Z]/);
	if (lead) {
		const q = parseAmount(lead[1]);
		if (q !== undefined && q > 0 && q <= 50) return { quantity: q, unit: 'pcs' };
	}

	return {};
}

/* ------------------------------------------------------------------ */
/* store name                                                          */
/* ------------------------------------------------------------------ */

export function extractStore(lines: string[]): string | undefined {
	for (const raw of lines.slice(0, 6)) {
		const t = raw.trim();
		if (!t || t.length < 3) continue;
		if (/^[-=_*.~\s|]+$/.test(t)) continue;
		if (/\d{5,}/.test(t)) continue;
		if (/\bGSTIN?\b|\bFSSAI\b|\bPAN\b|\bwww\.|@/i.test(t)) continue;
		if (/\b(INVOICE|BILL|RECEIPT|TAX)\b/i.test(t) && t.split(/\s+/).length <= 3) continue;
		if (/\bROAD\b|\bSTREET\b|\bNAGAR\b|\bPH(ONE)?\b|\bPIN\b/i.test(t)) continue;
		const letters = t.replace(/[^A-Za-z]/g, '').length;
		if (letters < 3) continue;
		return t.replace(/[*|_=~]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
	}
	return undefined;
}

/* ------------------------------------------------------------------ */
/* main parser                                                         */
/* ------------------------------------------------------------------ */

// Trailing amount at the end of a line, tolerating OCR digit noise.
// The token must contain at least one real digit, otherwise a store name
// ending in "S" ("SRI LAKSHMI STORES") would look like the amount 5.
const TRAILING_AMOUNT = /(?:₹|rs\.?|inr)?\s*([0-9OolISB]*[0-9][0-9OolISB.,]*)\s*(?:\/-|\-)?\s*$/i;

/** A line that is only an amount (price that slipped to the next line). */
const ONLY_AMOUNT = /^\s*(?:₹|rs\.?|inr)?\s*([0-9OolISB]*[0-9][0-9OolISB.,]*)\s*(?:\/-|\-)?\s*$/i;

/** A line that is essentially just a date (possibly with a Date:/Dt. label). */
function isDateLine(line: string): boolean {
	const d = parseBillDate(line);
	if (!d) return false;
	const stripped = line
		.replace(/\b(date|dt|dated|bill\s*date|invoice\s*date|delivery\s*date|time)\b\.?\s*:?/gi, ' ')
		.replace(/\d{1,2}[:.]\d{2}(\s*[ap]m)?/gi, ' ')
		.replace(/[0-9/.\-:,]/g, ' ')
		.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, ' ')
		.replace(/\s+/g, '');
	// if almost nothing but the date remains, it is a date line, not an item
	return stripped.length <= 2;
}

function hasEnoughLetters(s: string): boolean {
	return s.replace(/[^A-Za-z]/g, '').length >= 3;
}

export function parseBill(text: string, options: { today?: string } = {}): ParsedBill {
	const today = options.today ?? todayISO();
	const rawLines = text
		.replace(/\r/g, '')
		.split('\n')
		.map((l) => l.replace(/\t/g, ' ').replace(/\s{2,}/g, ' ').trim());

	const lines = rawLines.filter((l) => l.length > 0);
	const warnings: string[] = [];

	const store = extractStore(lines);

	// date: first parseable date in the document
	let date: string | undefined;
	for (const l of lines) {
		const d = parseBillDate(l);
		if (d) {
			date = d;
			break;
		}
	}

	// total: prefer the largest "grand total"-ish match
	let total: number | undefined;
	const totalLineIdx = new Set<number>();
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		let t = matchTotalLine(l);
		if (t !== undefined) {
			totalLineIdx.add(i);
		} else if (isTotalKeywordOnly(l)) {
			// "NET AMOUNT" on one line, the figure on the next
			const next = lines[i + 1];
			const only = next?.match(ONLY_AMOUNT);
			if (only) {
				t = parseAmount(only[1]);
				totalLineIdx.add(i);
				totalLineIdx.add(i + 1);
			}
		}
		if (t !== undefined) {
			// a later, larger total (GRAND TOTAL after SUBTOTAL) wins
			if (total === undefined || t >= total) total = t;
		}
	}

	// ---- item detection ----
	const items: ParsedItem[] = [];
	const used = new Set<number>();

	for (let i = 0; i < lines.length; i++) {
		if (used.has(i)) continue;
		if (totalLineIdx.has(i)) continue;
		const line = lines[i];
		if (isNoiseLine(line)) continue;
		if (matchTotalLine(line) !== undefined) continue;
		if (isTotalKeywordOnly(line)) continue;
		if (isDateLine(line)) continue;
		// the store-name line is header text, not an item
		if (store && i < 6 && line.trim() === store) continue;
		if (ONLY_AMOUNT.test(line)) continue; // orphan amount, handled by its owner

		let priceRaw: string | undefined;
		let textPart = line;
		let consumedNext = -1;

		const m = line.match(TRAILING_AMOUNT);
		if (m && m.index !== undefined && m.index > 0) {
			priceRaw = m[1];
			textPart = line.slice(0, m.index);
		} else {
			// price may sit on the next line
			const next = lines[i + 1];
			if (next && !used.has(i + 1) && !totalLineIdx.has(i + 1)) {
				const only = next.match(ONLY_AMOUNT);
				if (only && !isNoiseLine(next)) {
					priceRaw = only[1];
					consumedNext = i + 1;
				}
			}
		}

		if (priceRaw === undefined) continue;
		if (!hasEnoughLetters(textPart)) continue;

		const price = parseAmount(priceRaw);
		if (price === undefined || price <= 0 || price > 100000) continue;

		const qtyInfo = extractQuantity(line);
		const cleanedName = cleanItemName(textPart);
		if (!cleanedName || cleanedName.length < 2) continue;
		if (!hasEnoughLetters(cleanedName)) continue;

		const match = matchCatalog(cleanedName);

		// sanity: a "2 x 45" line should total close to qty*unitPrice
		let quantity = qtyInfo.quantity ?? 1;
		let unit = qtyInfo.unit ?? match.unit;
		if (qtyInfo.unitPrice && qtyInfo.quantity) {
			const expected = qtyInfo.unitPrice * qtyInfo.quantity;
			if (Math.abs(expected - price) / Math.max(price, 1) > 0.25) {
				// multiplier was probably misread; keep the printed amount and the count
			}
		}
		if (quantity <= 0) quantity = 1;

		items.push({
			rawText: line,
			name: match.name === 'Other' ? cleanedName : match.name,
			quantity,
			unit,
			price,
			category: match.category,
			place: match.place,
			shelfLife: match.shelfLife,
			confidence: match.confidence,
			nonFood: match.nonFood || looksNonFood(cleanedName) || undefined
		});

		used.add(i);
		if (consumedNext >= 0) used.add(consumedNext);
	}

	const itemsSum = Math.round(items.reduce((s, it) => s + (it.price ?? 0), 0) * 100) / 100;

	let mismatch = false;
	if (total !== undefined && total > 0 && items.length > 0) {
		mismatch = Math.abs(itemsSum - total) / total > 0.03;
		if (mismatch) warnings.push('Some items may be missing or misread. Please review.');
	}
	if (items.length === 0) {
		warnings.push('No items could be read from this bill. Try a clearer photo, or paste the bill text.');
	}

	void today; // expiry estimation happens in shelfLife.ts
	void addDays;

	return { store, date, total, items, itemsSum, mismatch, warnings };
}
