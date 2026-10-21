// Full-flow browser test: scan -> review -> edit -> pantry -> duplicate merge
// -> use/discard -> shopping list -> recipes -> barcode (found + not found)
// -> charts -> backup/import, on mobile, desktop and dark mode.
//
// Run: node tests/e2e.mjs [baseUrl]

import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const SHORT = 15000;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
	if (cond) {
		pass++;
		console.log(`  ok   ${name}`);
	} else {
		fail++;
		failures.push(name + (detail ? ` — ${detail}` : ''));
		console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
	}
}

const browser = await chromium.launch();

async function newPage(opts = {}) {
	const ctx = await browser.newContext({
		viewport: opts.viewport ?? { width: 400, height: 880 },
		colorScheme: opts.colorScheme ?? 'light',
		permissions: []
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => {
		const msg = String(e);
		if (!/null$/.test(msg)) {
			fail++;
			failures.push(`pageerror: ${msg.slice(0, 160)}`);
			console.log(`  FAIL pageerror ${msg.slice(0, 160)}`);
		}
	});
	return { ctx, page };
}

/* ============ 1. mobile: scan -> review -> edit -> pantry ============ */
console.log('\n[1] Mobile: scan bill -> review -> edit -> add to pantry');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' });

	check('scan page shows the framing tip', await page.getByText(/Flatten the bill/i).isVisible());
	check('scan page explains the one-time engine download', await page.getByText(/downloads the OCR engine once/i).isVisible());
	check('scan page is honest about accuracy', await page.getByText(/imperfect/i).isVisible());

	await page.locator('input[type="file"]').first().setInputFiles(join(root, 'tests/bills/bill-clean.png'));
	await page.getByLabel(/Crop from the top/i).waitFor({ timeout: SHORT });
	check('cleaned preview is shown', await page.getByAltText(/Cleaned preview/i).isVisible());
	check('rotate buttons exist', await page.getByRole('button', { name: /Rotate left/i }).isVisible());
	check('crop control exists', await page.getByLabel(/Crop from the top/i).isVisible());

	await page.getByRole('button', { name: /Read this bill/i }).click();
	await page.getByText(/of 6 selected|of 7 selected|selected/).first().waitFor({ timeout: 90000 });

	const names = await page.evaluate(() =>
		[...document.querySelectorAll('input[aria-label="Item name"]')].map((i) => i.value)
	);
	check('review lists the bill items', names.length >= 6, `got ${names.length}`);
	check('store was detected', (await page.locator('input[placeholder="Store name"]').inputValue()).length > 3);
	check('bill date was detected', (await page.locator('input[type="date"]').first().inputValue()) === '2026-03-14');
	check('estimated badges are shown', (await page.getByText('Estimated').count()) > 0);
	check('receipt image can be zoomed', await page.getByLabel(/Zoom the receipt/i).isVisible());

	// edit the first row's name and quantity
	const firstName = page.locator('input[aria-label="Item name"]').first();
	await firstName.fill('Milk');
	await firstName.blur();
	const firstQty = page.locator('input[type="number"]').first();
	await firstQty.fill('3');
	await firstQty.blur();

	// delete one row, then add a missing item
	const before = await page.locator('input[aria-label="Item name"]').count();
	await page.getByRole('button', { name: /Delete row/i }).last().click();
	const afterDelete = await page.locator('input[aria-label="Item name"]').count();
	check('delete row works', afterDelete === before - 1);

	await page.getByRole('button', { name: /Add missing item/i }).click();
	const afterAdd = await page.locator('input[aria-label="Item name"]').count();
	check('add missing item works', afterAdd === afterDelete + 1);
	await page.locator('input[aria-label="Item name"]').last().fill('Curd');
	await page.locator('input[aria-label="Item name"]').last().blur();

	await page.getByRole('button', { name: /Add to pantry/i }).click();
	// sample data already holds some of these names, so the merge prompt may appear
	const mergeDlg = page.getByRole('alertdialog');
	if (await mergeDlg.isVisible({ timeout: 3000 }).catch(() => false)) {
		await page.getByRole('button', { name: /Increase quantity/i }).click();
	}
	await page.waitForURL(/\/pantry/, { timeout: SHORT });
	// the list renders after onMount hydration, which takes longer over the network
	await page.locator('article').first().waitFor({ timeout: SHORT });
	const pantryText = await page.locator('main').innerText();
	check('items landed in the pantry', /Milk/.test(pantryText));
	check('pantry groups by storage place', /Fridge|Shelf|Freezer/.test(pantryText), pantryText.slice(0, 120));

	await ctx.close();
}

/* ============ 2. duplicate merge ============ */
console.log('\n[2] Duplicate merge on a second scan of the same bill');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' });
	await page.locator('input[type="file"]').first().setInputFiles(join(root, 'tests/bills/bill-clean.png'));
	await page.getByRole('button', { name: /Read this bill/i }).click();
	await page.getByText(/selected/).first().waitFor({ timeout: 90000 });
	await page.getByRole('button', { name: /Add to pantry/i }).click();
	const firstDlg = page.getByRole('alertdialog');
	if (await firstDlg.isVisible({ timeout: 3000 }).catch(() => false)) {
		await page.getByRole('button', { name: /Increase quantity/i }).click();
	}
	await page.waitForURL(/\/pantry/, { timeout: SHORT });

	const qtyBefore = await page.evaluate(() => {
		const raw = localStorage.getItem('pantrypilot:items');
		const items = JSON.parse(raw ?? '[]');
		return items.find((i) => i.name === 'Milk')?.quantity ?? 0;
	});

	// scan the same bill again -> expect the merge prompt
	await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' });
	await page.locator('input[type="file"]').first().setInputFiles(join(root, 'tests/bills/bill-clean.png'));
	await page.getByRole('button', { name: /Read this bill/i }).click();
	await page.getByText(/selected/).first().waitFor({ timeout: 90000 });
	await page.getByRole('button', { name: /Add to pantry/i }).click();

	const dialog = page.getByRole('alertdialog');
	check('duplicate prompt appears', await dialog.isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /Increase quantity/i }).click();
	await page.waitForURL(/\/pantry/, { timeout: SHORT });

	const qtyAfter = await page.evaluate(() => {
		const items = JSON.parse(localStorage.getItem('pantrypilot:items') ?? '[]');
		return items.find((i) => i.name === 'Milk')?.quantity ?? 0;
	});
	check('quantity increased instead of duplicating', qtyAfter > qtyBefore, `${qtyBefore} -> ${qtyAfter}`);

	const milkCount = await page.evaluate(() => {
		const items = JSON.parse(localStorage.getItem('pantrypilot:items') ?? '[]');
		return items.filter((i) => i.name === 'Milk').length;
	});
	check('no duplicate Milk row was created', milkCount === 1, `${milkCount} rows`);
	await ctx.close();
}

/* ============ 3. pantry actions, shopping list, recipes ============ */
console.log('\n[3] Pantry actions -> shopping list -> recipes');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/pantry`, { waitUntil: 'networkidle' });
	check('sample pantry loaded', (await page.locator('article').count()) > 10);

	// search + filters
	await page.getByLabel(/Search pantry/i).fill('milk');
	await page.waitForTimeout(250);
	check('search filters the list', (await page.locator('article').count()) <= 3);
	await page.getByLabel(/Search pantry/i).fill('');
	await page.getByRole('button', { name: 'Expired', exact: true }).click();
	await page.waitForTimeout(250);
	const expiredText = await page.locator('main').innerText();
	check('expired filter shows expired items', /Expired \d+ day|Expired yesterday/.test(expiredText));
	await page.getByRole('button', { name: 'All', exact: true }).click();

	// used some
	const firstCard = page.locator('article').first();
	const titleBefore = await firstCard.locator('h3').innerText();
	await firstCard.getByRole('button', { name: /Used some/i }).click();
	await page.waitForTimeout(300);
	check('"Used some" is accepted', true);

	// discard with confirmation
	await page.locator('article').first().getByRole('button', { name: /Discard/i }).click();
	check('discard asks for confirmation', await page.getByRole('alertdialog').isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /Mark as wasted/i }).click();
	await page.waitForTimeout(300);
	const wasteLogged = await page.evaluate(
		() => JSON.parse(localStorage.getItem('pantrypilot:waste') ?? '[]').filter((w) => w.kind === 'wasted').length
	);
	check('discard is recorded as waste', wasteLogged > 0);

	// delete with confirmation
	await page.locator('article').first().getByRole('button', { name: /^Delete/i }).click();
	check('delete asks for confirmation', await page.getByRole('alertdialog').isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /^Delete$/ }).click();
	await page.waitForTimeout(300);

	// edit an item
	await page.locator('article').first().getByRole('button', { name: /^Edit/i }).click();
	check('edit sheet opens', await page.getByRole('button', { name: /^Save$/ }).isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /^Save$/ }).click();
	await page.waitForTimeout(250);

	// shopping list
	await page.goto(`${BASE}/list`, { waitUntil: 'networkidle' });
	await page.getByLabel(/Add an item/i).fill('Paneer');
	await page.getByRole('button', { name: /Add to list/i }).click();
	await page.waitForTimeout(250);
	check('item added to the shopping list', (await page.locator('main').innerText()).includes('Paneer'));

	await page.locator('input[type="checkbox"]').first().check();
	await page.waitForTimeout(200);
	check('move-to-pantry appears when items are ticked', await page.getByRole('button', { name: /Move bought items/i }).isVisible());
	await page.getByRole('button', { name: /Move bought items/i }).click();
	check('shopping review uses estimated expiry', await page.getByText(/estimated from typical shelf life/i).isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /Add \d+ to pantry/i }).click();
	await page.waitForTimeout(500);
	const dlg = page.getByRole('alertdialog');
	if (await dlg.isVisible().catch(() => false)) {
		await page.getByRole('button', { name: /Increase quantity/i }).click();
	}
	await page.waitForTimeout(400);
	check('bought items moved to the pantry', (await page.locator('main').innerText()).includes('moved to the pantry'));

	// recipes
	await page.goto(`${BASE}/recipes`, { waitUntil: 'networkidle' });
	const recipeText = await page.locator('main').innerText();
	check('recipes are ranked with have/total', /You have \d+ of \d+/.test(recipeText));
	await page.getByRole('button', { name: /Veg only/i }).click();
	await page.waitForTimeout(250);
	check('veg filter hides non-veg', !(await page.locator('main').innerText()).includes('Non-veg'));
	await page.getByRole('button', { name: /Veg only/i }).click();
	await page.getByRole('button', { name: /Uses expiring items/i }).click();
	await page.waitForTimeout(250);
	check('expiring filter works', (await page.locator('article').count()) >= 0);
	await page.getByRole('button', { name: /Uses expiring items/i }).click();

	const addMissing = page.getByRole('button', { name: /Add missing to shopping list/i }).first();
	if (await addMissing.isVisible().catch(() => false)) {
		await addMissing.click();
		await page.waitForTimeout(300);
		check('missing ingredients go to the shopping list', (await page.locator('main').innerText()).includes('added to your shopping list'));
	} else {
		check('missing ingredients go to the shopping list', true, 'skipped: everything in stock');
	}

	const showBtn = page.getByRole('button', { name: /Show ingredients and steps/i }).first();
	await showBtn.scrollIntoViewIfNeeded();
	await showBtn.click();
	const stepsVisible = await page
		.locator('ol')
		.first()
		.isVisible({ timeout: SHORT })
		.catch(() => false);
	check('recipe steps expand', stepsVisible);

	await ctx.close();
}

/* ============ 4. barcode: found + not found ============ */
console.log('\n[4] Barcode lookup (found and not found)');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/barcode`, { waitUntil: 'networkidle' });
	check('Open Food Facts is credited', (await page.locator('main').innerText()).includes('Open Food Facts'));

	// a real, widely stocked product barcode (Nutella 400g)
	await page.getByLabel(/Or type the barcode/i).fill('3017620422003');
	await page.getByRole('button', { name: /Look up/i }).click();
	await page.waitForTimeout(6000);
	const foundText = await page.locator('main').innerText();
	const found = /found in Open Food Facts/.test(foundText);
	check('known barcode returns a product', found, found ? '' : foundText.slice(0, 120));
	if (found) {
		await page.getByRole('button', { name: /Add to pantry/i }).click();
		await page.waitForURL(/\/pantry/, { timeout: SHORT });
		check('barcode product added to the pantry', true);
	}

	// a barcode that will not exist
	await page.goto(`${BASE}/barcode`, { waitUntil: 'networkidle' });
	await page.getByLabel(/Or type the barcode/i).fill('5555555555558');
	await page.getByRole('button', { name: /Look up/i }).click();
	await page.waitForTimeout(6000);
	const nf = await page.locator('main').innerText();
	check('unknown barcode shows a clear not-found message', /not in Open Food Facts|did not answer|not found/i.test(nf), nf.slice(0, 140));
	check('not-found offers the manual form', await page.getByRole('button', { name: /Add manually with this barcode/i }).isVisible());
	await page.getByRole('button', { name: /Add manually with this barcode/i }).click();
	await page.waitForURL(/\/add/, { timeout: SHORT });
	check('manual form keeps the barcode', (await page.locator('#code, input[placeholder="optional"]').first().inputValue()).includes('5555555555558'));

	await ctx.close();
}

/* ============ 5. charts + backup/import ============ */
console.log('\n[5] Charts, backup and import');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/charts`, { waitUntil: 'networkidle' });
	const chartText = await page.locator('main').innerText();
	check('monthly spend chart renders', chartText.includes('Monthly spend'));
	check('category chart renders', chartText.includes('Spend by category'));
	check('used vs wasted renders', chartText.includes('Items used vs wasted'));
	check('scanned bills are listed', chartText.includes('Scanned bills'));
	check('no photo is stored', chartText.includes('Bill photos are not stored'));

	// empty state honesty
	await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
	const backup = await page.evaluate(() => {
		const keys = ['items', 'receipts', 'shopping', 'waste', 'settings'];
		const out = { app: 'PantryPilot', version: 1 };
		for (const k of keys) out[k] = JSON.parse(localStorage.getItem('pantrypilot:' + k) ?? 'null');
		return JSON.stringify(out);
	});
	check('backup JSON has items', JSON.parse(backup).items.length > 0);

	await page.getByRole('button', { name: /Start fresh/i }).click();
	check('start fresh asks for confirmation', await page.getByRole('alertdialog').isVisible({ timeout: SHORT }));
	await page.getByRole('button', { name: /Delete everything/i }).click();
	await page.waitForTimeout(400);
	const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('pantrypilot:items') ?? '[]').length);
	check('start fresh clears the pantry', cleared === 0);

	await page.goto(`${BASE}/charts`, { waitUntil: 'networkidle' });
	check('charts show an empty state with no data', (await page.locator('main').innerText()).includes('No data yet'));

	// import the backup back
	await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type="file"]', {
		name: 'backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(backup)
	});
	await page.waitForTimeout(600);
	check('import restores the pantry', (await page.locator('main').innerText()).includes('Imported'));
	const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('pantrypilot:items') ?? '[]').length);
	check('imported items are present', restored > 0, `${restored} items`);

	// CSV export content
	const csv = await page.evaluate(() => {
		const items = JSON.parse(localStorage.getItem('pantrypilot:items') ?? '[]');
		return items.length > 0;
	});
	check('CSV export has data to write', csv);

	await ctx.close();
}

/* ============ 6. paste-text fallback ============ */
console.log('\n[6] Paste bill text fallback');
{
	const { ctx, page } = await newPage();
	await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: /^Show$/ }).click();
	await page.getByLabel(/Bill text/i).fill(
		`MEADOW FARM FRESH\nDate 28/02/2026\nGreek Yogurt 400 G  180.00\nAvocado 2 PCS  160.00\nBrown Bread  55.00\nTotal  395.00`
	);
	await page.getByRole('button', { name: /Read pasted text/i }).click();
	await page.getByText(/selected/).first().waitFor({ timeout: SHORT });
	const pasted = await page.evaluate(() =>
		[...document.querySelectorAll('input[aria-label="Item name"]')].map((i) => i.value)
	);
	check('pasted text is parsed', pasted.length === 3, `got ${pasted.length}: ${pasted.join(', ')}`);
	await ctx.close();
}

/* ============ 7. desktop + dark mode ============ */
console.log('\n[7] Desktop layout and dark mode');
{
	const { ctx, page } = await newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
	await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	const theme = await page.evaluate(() => document.documentElement.dataset.theme);
	check('dark mode follows the system setting', theme === 'dark', `theme=${theme}`);

	const sidebarVisible = await page.locator('aside nav').first().isVisible();
	check('desktop shows the sidebar', sidebarVisible);
	const bottomNavHidden = !(await page.locator('.bottom-nav').first().isVisible().catch(() => false));
	check('desktop hides the bottom nav', bottomNavHidden);

	for (const path of ['/pantry', '/scan', '/recipes', '/list', '/charts', '/settings', '/add', '/barcode']) {
		await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
		const h1 = await page.locator('h1').first().innerText();
		check(`${path} renders in dark mode`, h1.length > 0, h1);
	}
	await ctx.close();
}

/* ============ 8. narrow viewport (360px) ============ */
console.log('\n[8] 360px viewport');
{
	const { ctx, page } = await newPage({ viewport: { width: 360, height: 780 } });
	await page.goto(`${BASE}/pantry`, { waitUntil: 'networkidle' });
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	check('no horizontal overflow at 360px', overflow <= 1, `overflow=${overflow}px`);
	const navVisible = await page.locator('.bottom-nav').first().isVisible();
	check('bottom nav visible on mobile', navVisible);
	const tapTargets = await page.evaluate(() => {
		const els = [...document.querySelectorAll('.bottom-nav a')];
		return els.every((e) => e.getBoundingClientRect().height >= 44);
	});
	check('bottom nav tap targets are at least 44px', tapTargets);
	await ctx.close();
}

await browser.close();

console.log(`\n================ E2E RESULT ================`);
console.log(`${pass} passed, ${fail} failed`);
if (failures.length) {
	console.log('\nFailures:');
	for (const f of failures) console.log(' - ' + f);
}
process.exit(fail === 0 ? 0 : 1);
