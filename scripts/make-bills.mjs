// Generates synthetic bill images for the sample gallery and OCR testing.
// Fictional store names only; no real branding, no real customer data.
// Renders SVG text to PNG with sharp (dev dependency, not shipped to the client).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Monospace receipt body: pads an item line to a fixed width. */
function line(left, right, width = 38) {
	const l = String(left);
	const r = String(right);
	const pad = Math.max(1, width - l.length - r.length);
	return l + ' '.repeat(pad) + r;
}

const BILLS = {
	'bill-clean': {
		title: 'Clean layout',
		rotate: 0,
		contrast: 1,
		lines: [
			'   GREEN BASKET SUPERMARKET',
			'    12 Market Road, Anna Nagar',
			'   GSTIN: 33ABCDE1234F1Z5',
			'',
			'Bill No: GB/2026/1182',
			'Date: 14/03/2026',
			'--------------------------------------',
			line('ITEM', 'AMOUNT'),
			'--------------------------------------',
			line('Milk 1 L', '56.00'),
			line('Tomato 1 KG', '38.00'),
			line('Onion 2 KG', '74.00'),
			line('Bread', '45.00'),
			line('Paneer 200 G', '95.00'),
			line('Eggs 6 PCS', '48.00'),
			'--------------------------------------',
			line('TOTAL', '356.00'),
			line('CASH', '400.00'),
			line('CHANGE', '44.00'),
			'',
			'     Thank you, visit again!'
		],
		expect: ['Milk', 'Tomato', 'Onion', 'Bread', 'Paneer', 'Eggs']
	},

	'bill-rotated': {
		title: 'Slightly rotated',
		rotate: 3,
		contrast: 1,
		lines: [
			'    FRESH MART DAILY NEEDS',
			'   Shop 4, Gandhi Bazaar',
			'   GSTIN: 29AABCU9603R1ZX',
			'',
			'Invoice No. FM-99213',
			'Date : 02-04-2026',
			'--------------------------------------',
			line('Curd 500 G   2 x 45.00', '90.00'),
			line('Sunflower Oil 1 L', '145.00'),
			line('Biscuits 3 PKT', '60.00'),
			line('Potato 2 KG', '56.00'),
			line('Carrot 500 G', '32.00'),
			'--------------------------------------',
			line('SUBTOTAL', '383.00'),
			line('CGST 2.5%', '4.50'),
			line('SGST 2.5%', '4.50'),
			line('GRAND TOTAL', '392.00'),
			line('UPI', '392.00')
		],
		expect: ['Curd', 'Sunflower Oil', 'Biscuits', 'Potato', 'Carrot']
	},

	'bill-lowcontrast': {
		title: 'Low contrast / faded',
		rotate: 0,
		contrast: 0.42,
		lines: [
			'     SRI LAKSHMI STORES',
			'     Dt. 14/03/2026',
			'--------------------------------------',
			line('Idli Rice 5 KG', '310.00'),
			line('Urad Dal 500 G', '105.00'),
			line('Coconut 2 PCS', '70.00'),
			line('Curry Leaves', '10.00'),
			line('Mustard Seeds 100 G', '28.00'),
			'--------------------------------------',
			line('TOTAL', '523.00')
		],
		expect: ['Idli Rice', 'Urad Dal', 'Coconut', 'Curry Leaves', 'Mustard Seeds']
	},

	'bill-many': {
		title: 'Many items',
		rotate: 0,
		contrast: 1,
		lines: [
			'    DAILY NEEDS HYPERMARKET',
			'    Plot 8, Industrial Estate',
			'    GSTIN: 33PQRSX4321K1Z9',
			'',
			'Bill No 44120   Date 09/03/2026',
			'--------------------------------------',
			line('Rice 10 KG', '620.00'),
			line('Wheat Flour 5 KG', '245.00'),
			line('Toor Dal 1 KG', '168.00'),
			line('Moong Dal 500 G', '82.00'),
			line('Sugar 2 KG', '96.00'),
			line('Salt 1 KG', '22.00'),
			line('Sunflower Oil 1 L', '148.00'),
			line('Tea Powder 500 G', '240.00'),
			line('Milk 1 L', '56.00'),
			line('Curd 400 G', '42.00'),
			line('Paneer 200 G', '95.00'),
			line('Butter 100 G', '58.00'),
			line('Eggs 12 PCS', '96.00'),
			line('Bread', '45.00'),
			line('Tomato 1 KG', '38.00'),
			line('Onion 2 KG', '74.00'),
			line('Potato 2 KG', '56.00'),
			line('Apple 1 KG', '180.00'),
			line('Banana 1 DOZ', '60.00'),
			line('Detergent Powder 1 KG', '210.00'),
			line('Carry Bag', '10.00'),
			'--------------------------------------',
			line('TOTAL', '2641.00')
		],
		expect: [
			'Rice', 'Wheat Flour', 'Toor Dal', 'Moong Dal', 'Sugar', 'Salt',
			'Sunflower Oil', 'Tea Powder', 'Milk', 'Curd', 'Paneer', 'Butter',
			'Eggs', 'Bread', 'Tomato', 'Onion', 'Potato', 'Apple', 'Banana',
			'Detergent Powder', 'Carry Bag'
		]
	},

	'bill-layout2': {
		title: 'Different layout (S.No columns)',
		rotate: 0,
		contrast: 1,
		lines: [
			'======================================',
			'       VILLAGE KITCHEN STORE',
			'           Tax Invoice',
			'======================================',
			'Dt. 18 Mar 2026',
			'',
			'S.No  Description        Amount',
			'--------------------------------------',
			'1     Chicken 1 KG       245.00',
			'2     Fish 500 G         180.00',
			'3     Green Chilli 100 G  12.00',
			'4     Coriander Leaves    15.00',
			'5     Lemon 4 PCS         20.00',
			'6     Ginger 200 G        24.00',
			'--------------------------------------',
			'Total Items : 6',
			line('AMOUNT PAYABLE', '496.00'),
			line('CARD', '496.00')
		],
		expect: ['Chicken', 'Fish', 'Green Chilli', 'Coriander Leaves', 'Lemon', 'Ginger']
	}
};

function esc(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render(name, spec) {
	const fontSize = 19;
	const lineHeight = 26;
	const padX = 34;
	const padY = 34;
	const width = 620;
	const height = padY * 2 + spec.lines.length * lineHeight;

	// faded bills: lighter ink on slightly grey paper
	const ink = spec.contrast >= 1 ? '#161616' : `rgb(${Math.round(150 - 60 * spec.contrast)},${Math.round(150 - 60 * spec.contrast)},${Math.round(150 - 60 * spec.contrast)})`;
	const paper = spec.contrast >= 1 ? '#ffffff' : '#e8e6e0';

	const text = spec.lines
		.map(
			(l, i) =>
				`<text x="${padX}" y="${padY + (i + 1) * lineHeight}" xml:space="preserve">${esc(l)}</text>`
		)
		.join('\n');

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${paper}"/>
  <g font-family="DejaVu Sans Mono, Menlo, Courier New, monospace" font-size="${fontSize}" fill="${ink}">
${text}
  </g>
</svg>`;

	let img = sharp(Buffer.from(svg), { density: 144 });
	if (spec.rotate) {
		img = img.rotate(spec.rotate, { background: paper });
	}
	const outDirs = [join(root, 'static', 'samples'), join(root, 'tests', 'bills')];
	for (const dir of outDirs) mkdirSync(dir, { recursive: true });

	const buf = await img.png().toBuffer();
	for (const dir of outDirs) writeFileSync(join(dir, `${name}.png`), buf);

	// also write the expected item list so the test harness can score it
	writeFileSync(
		join(root, 'tests', 'bills', `${name}.expect.json`),
		JSON.stringify({ title: spec.title, expect: spec.expect }, null, 2)
	);
	console.log(`wrote ${name}.png (${width}x${height}) expecting ${spec.expect.length} items`);
}

for (const [name, spec] of Object.entries(BILLS)) {
	await render(name, spec);
}
console.log('done');
