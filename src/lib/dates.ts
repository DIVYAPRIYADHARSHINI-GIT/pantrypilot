// Local-date helpers. Every date in PantryPilot is a plain YYYY-MM-DD string
// interpreted in the user's local time zone. We never use Date.toISOString()
// for a calendar date, because that converts to UTC and can shift the day.

/** Today as a local YYYY-MM-DD string. */
export function todayISO(d: Date = new Date()): string {
	return toISO(d);
}

/** Format a Date as a local YYYY-MM-DD string (no UTC conversion). */
export function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local Date at midnight. */
export function fromISO(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Add days to a YYYY-MM-DD string, staying in local time. */
export function addDays(iso: string, days: number): string {
	const d = fromISO(iso);
	d.setDate(d.getDate() + days);
	return toISO(d);
}

/**
 * Whole calendar days from today until `iso`.
 * 0 = expires today, negative = already expired.
 */
export function daysLeft(iso: string, today: string = todayISO()): number {
	const a = fromISO(today).getTime();
	const b = fromISO(iso).getTime();
	return Math.round((b - a) / 86400000);
}

export type FreshState = 'fresh' | 'soon' | 'expired';

export function freshState(iso: string, warningDays: number, today = todayISO()): FreshState {
	const left = daysLeft(iso, today);
	if (left < 0) return 'expired';
	if (left <= warningDays) return 'soon';
	return 'fresh';
}

/** Human label like "Expires today", "3 days left", "Expired 2 days ago". */
export function daysLeftLabel(iso: string, today = todayISO()): string {
	const left = daysLeft(iso, today);
	if (left === 0) return 'Expires today';
	if (left === 1) return '1 day left';
	if (left > 1) return `${left} days left`;
	if (left === -1) return 'Expired yesterday';
	return `Expired ${Math.abs(left)} days ago`;
}

export function formatDate(iso: string): string {
	if (!iso) return '';
	const d = fromISO(iso);
	return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function monthKey(iso: string): string {
	return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

/**
 * Parse a date found on a bill. Handles DD/MM/YYYY, DD-MM-YY, YYYY-MM-DD and
 * "12 Mar 2026" styles. Indian bills are day-first, so ambiguous values are read
 * day-first. Returns a local YYYY-MM-DD string or undefined.
 */
export function parseBillDate(text: string): string | undefined {
	const t = text.replace(/[,]/g, ' ');

	// YYYY-MM-DD / YYYY/MM/DD
	let m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
	if (m) return safe(+m[1], +m[2], +m[3]);

	// DD-MM-YYYY / DD/MM/YY
	m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
	if (m) {
		let [, d, mo, y] = m;
		let year = +y;
		if (year < 100) year += 2000;
		let day = +d;
		let mon = +mo;
		// if the first field cannot be a day but the second can, swap
		if (day > 31 || (day > 12 && mon > 12)) return undefined;
		if (mon > 12 && day <= 12) {
			[day, mon] = [mon, day];
		}
		return safe(year, mon, day);
	}

	// 12 Mar 2026 / 12 March 2026
	const MONTHS = [
		'jan', 'feb', 'mar', 'apr', 'may', 'jun',
		'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
	];
	m = t.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(20\d{2})\b/i);
	if (m) {
		const idx = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
		if (idx >= 0) return safe(+m[3], idx + 1, +m[1]);
	}

	// Mar 12 2026
	m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})\s+(20\d{2})\b/i);
	if (m) {
		const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
		if (idx >= 0) return safe(+m[3], idx + 1, +m[2]);
	}

	return undefined;
}

function safe(y: number, m: number, d: number): string | undefined {
	if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
	const dt = new Date(y, m - 1, d);
	if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
	return toISO(dt);
}
