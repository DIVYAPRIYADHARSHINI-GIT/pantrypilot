// Measures the REAL OCR pipeline in a headless browser: it drives the actual
// /scan page (canvas clean-up -> Tesseract Web Worker -> parser) on each
// generated test bill and scores the parsed items against the expected list.
//
// Run: node tests/ocr-accuracy.mjs [baseUrl]

import { chromium } from 'playwright';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const billsDir = join(root, 'tests', 'bills');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const PER_BILL_TIMEOUT = 120_000;

const bills = readdirSync(billsDir)
	.filter((f) => f.endsWith('.png'))
	.sort();

function norm(s) {
	return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => {
	if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 160));
});

const results = [];

for (const bill of bills) {
	const name = bill.replace(/\.png$/, '');
	const expectPath = join(billsDir, `${name}.expect.json`);
	const { title, expect } = JSON.parse(readFileSync(expectPath, 'utf8'));

	process.stdout.write(`\n${name} (${title})\n`);

	await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle', timeout: 30000 });

	// upload the bill through the real file input
	const input = page.locator('input[type="file"]').first();
	await input.setInputFiles(join(billsDir, bill));

	// adjust stage -> run the real OCR
	await page.getByRole('button', { name: /Read this bill/i }).click({ timeout: 20000 });

	// wait for the review stage (or an error card)
	const t0 = Date.now();
	let stage = 'reading';
	while (Date.now() - t0 < PER_BILL_TIMEOUT) {
		if (await page.getByText(/selected/).first().isVisible().catch(() => false)) {
			stage = 'review';
			break;
		}
		if (await page.getByRole('alert').first().isVisible().catch(() => false)) {
			stage = 'error';
			break;
		}
		await page.waitForTimeout(700);
	}
	const seconds = ((Date.now() - t0) / 1000).toFixed(1);

	if (stage !== 'review') {
		console.log(`  FAILED to reach review (${stage}) after ${seconds}s`);
		results.push({ name, title, expected: expect.length, parsed: 0, correct: 0, seconds, stage });
		continue;
	}

	// read back what the review screen actually holds
	const parsed = await page.evaluate(() => {
		const inputs = [...document.querySelectorAll('input[aria-label="Item name"]')];
		return inputs.map((i) => i.value);
	});

	const expectedNorm = expect.map(norm);
	const parsedNorm = parsed.map(norm);
	const matched = new Set();
	let correct = 0;
	for (const e of expectedNorm) {
		const idx = parsedNorm.findIndex(
			(p, i) => !matched.has(i) && (p === e || p.includes(e) || e.includes(p))
		);
		if (idx >= 0) {
			matched.add(idx);
			correct++;
		}
	}

	const pct = Math.round((correct / expect.length) * 100);
	console.log(`  parsed ${parsed.length} rows, ${correct}/${expect.length} expected items matched (${pct}%) in ${seconds}s`);
	const missing = expect.filter((e, i) => {
		const en = expectedNorm[i];
		return !parsedNorm.some((p) => p === en || p.includes(en) || en.includes(p));
	});
	if (missing.length) console.log(`  missing: ${missing.join(', ')}`);
	const extras = parsed.filter((p, i) => !matched.has(i));
	if (extras.length) console.log(`  extra rows: ${extras.join(' | ')}`);

	results.push({
		name,
		title,
		expected: expect.length,
		parsed: parsed.length,
		correct,
		pct,
		seconds,
		stage,
		missing,
		extras
	});
}

await browser.close();

const totalExpected = results.reduce((s, r) => s + r.expected, 0);
const totalCorrect = results.reduce((s, r) => s + r.correct, 0);
const overall = Math.round((totalCorrect / totalExpected) * 100);

console.log('\n================ OCR ACCURACY ================');
for (const r of results) {
	console.log(`${r.name.padEnd(18)} ${String(r.correct).padStart(2)}/${String(r.expected).padEnd(2)}  ${String(r.pct ?? 0).padStart(3)}%  ${r.seconds}s`);
}
console.log(`${'OVERALL'.padEnd(18)} ${totalCorrect}/${totalExpected}  ${overall}%`);

writeFileSync(join(root, 'tests', 'ocr-results.json'), JSON.stringify({ base: BASE, overall, results }, null, 2));
process.exit(overall >= 50 ? 0 : 1);
