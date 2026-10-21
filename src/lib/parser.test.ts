import { describe, it, expect } from 'vitest';
import { parseBill, parseAmount, repairNumber, extractQuantity, isNoiseLine, matchTotalLine, extractStore } from './parser';
import { cleanItemName, matchCatalog } from './matcher';
import { parseBillDate, addDays, daysLeft, todayISO } from './dates';
import { estimateShelfLife } from './shelfLife';
import { rankRecipes } from './rank';
import type { PantryItem } from './types';

/* ------------------------------------------------------------------ */
/* 10+ sample OCR text blocks, clean and messy                          */
/* ------------------------------------------------------------------ */

const BILL_1_CLEAN = `GREEN BASKET SUPERMARKET
12 Market Road, Anna Nagar
GSTIN: 33ABCDE1234F1Z5
Bill No: GB/2026/1182
Date: 14/03/2026

ITEM                QTY   AMOUNT
Milk 1 L              1     56.00
Tomato 1 KG           1     38.00
Onion 2 KG            2     74.00
Bread                 1     45.00
Paneer 200 G          1     95.00
Eggs 6 PCS            1     48.00
------------------------
TOTAL                      356.00
CASH                       400.00
CHANGE                      44.00
Thank you, visit again!`;

const BILL_2_MULTIPLIER = `FRESH MART DAILY NEEDS
Invoice No. FM-99213
Date : 02-04-2026
Curd 500 G          2 x 45.00     90.00
Sunflower Oil 1 L   1 @ 145       145.00
Biscuits            3 x 20.00     60.00
Potato 2 KG                        56.00
SUBTOTAL                          351.00
CGST 2.5%                           4.50
SGST 2.5%                           4.50
GRAND TOTAL                       360.00`;

const BILL_3_NEXT_LINE_PRICE = `SUNRISE PROVISION STORE
Date: 21-02-2026
Basmati Rice 5 KG
525.00
Toor Dal 1 KG
165.00
Ghee 500 G
320.00
Sugar 1 KG
48.00
NET AMOUNT
1058.00`;

const BILL_4_OCR_NOISE = `CITY FRESH GROCERS
GSTIN 29AABCU9603R1ZX
Date: l5/0l/2026
MLK TONED 1L          S6.OO
TMT 1KG               38.0O
ONN 1KG               42.00
PNR 2OO G             9S.00
BTR 1OO G             6O.00
AMOUNT PAYABLE       291.00`;

const BILL_5_MANY_ITEMS = `DAILY NEEDS HYPERMARKET
Bill No 44120 Date 09/03/2026
Rice 10 KG                620.00
Wheat Flour 5 KG          245.00
Toor Dal 1 KG             168.00
Moong Dal 500 G            82.00
Sugar 2 KG                 96.00
Salt 1 KG                  22.00
Sunflower Oil 1 L         148.00
Tea Powder 500 G          240.00
Coffee Powder 200 G       180.00
Milk 1 L                   56.00
Curd 400 G                 42.00
Paneer 200 G               95.00
Butter 100 G               58.00
Eggs 12 PCS                96.00
Bread                      45.00
Tomato 1 KG                38.00
Onion 2 KG                 74.00
Potato 2 KG                56.00
Carrot 500 G               32.00
Apple 1 KG                180.00
Banana 1 DOZ               60.00
Biscuits 2 PKT             60.00
Detergent Powder 1 KG     210.00
Dishwash Liquid 500 ML     99.00
Carry Bag                  10.00
TOTAL                    3012.00`;

const BILL_6_DIFFERENT_LAYOUT = `=========================
   VILLAGE KITCHEN STORE
   Tax Invoice
=========================
Dt. 18 Mar 2026
S.No Description      Amount
1    Chicken 1 KG     245.00
2    Fish 500 G       180.00
3    Green Chilli 100 G  12.00
4    Coriander Leaves    15.00
5    Lemon 4 PCS         20.00
-------------------------
Total Items : 5
AMOUNT PAYABLE      472.00
UPI - PhonePe       472.00`;

const BILL_7_EBILL_TEXT = `QuickKart Online
Order ID: QK8812340
Delivery Date: 2026-03-25
Items:
Amul Toned Milk 1 L                 1    58.00
Fortune Sunflower Oil 1 L           1   152.00
Tata Salt 1 KG                      1    28.00
Aashirvaad Atta 5 KG                1   285.00
Nescafe Classic 50 G                1   199.00
Item Total                             722.00
Delivery Fee                            25.00
Grand Total                            747.00`;

const BILL_8_LOW_CONTRAST = `SRI LAKSHMI STORES
14/03/2026
Idli Rice 5KG        310.00
Urad Dal 500G        105.00
Coconut 2 PCS         70.00
Curry Leaves          10.00
Mustard Seeds 100G    28.00
TOTAL                523.00`;

const BILL_9_NO_TOTAL = `CORNER SHOP
Milk 1 L     56.00
Bread        45.00
Eggs 6       48.00`;

const BILL_10_NONFOOD_MIX = `HOME ESSENTIALS MART
Date 05/04/2026
Soap 3 PCS            135.00
Detergent Powder 1KG  210.00
Toothpaste 150G       105.00
Milk 1L                56.00
Bread                  45.00
Carry Bag               5.00
GRAND TOTAL           556.00`;

const BILL_11_MESSY = `*** SPEEDY BAZAAR ***
Ph: 044-28123456
GSTIN:33XYZAB5678C1Z2
Date:11/03/2026 Time:19:42
Itm Qty Rate Amt
Chkn Curry Cut 1kg 1 240.00 240.00
Tmt Local 500g 1 22.00 22.00
Onn Big 1kg 1 38.00 38.00
Grn Chilli 100g 1 12.00 12.00
Disc -10.00
Round Off 0.00
Net Amount 302.00
Card XXXX1234 302.00`;

const BILL_12_WHATSAPP = `Hi, your bill from
MEADOW FARM FRESH
Date 28/02/2026
- Greek Yogurt 400 G : 180.00
- Blueberry 125 G : 220.00
- Avocado 2 PCS : 160.00
- Brown Bread : 55.00
Total : 615.00`;

/* ------------------------------------------------------------------ */

describe('repairNumber / parseAmount', () => {
	it('repairs OCR digit confusions', () => {
		expect(repairNumber('S6.OO')).toBe('56.00');
		expect(repairNumber('l20')).toBe('120');
		expect(repairNumber('B5')).toBe('85');
	});

	it('parses plain and noisy amounts', () => {
		expect(parseAmount('56.00')).toBe(56);
		expect(parseAmount('S6.OO')).toBe(56);
		expect(parseAmount('1,234.50')).toBe(1234.5);
		expect(parseAmount('45,00')).toBe(45);
		expect(parseAmount('₹ 99.50')).toBe(99.5);
		expect(parseAmount('Rs.148.00')).toBe(148);
		expect(parseAmount('')).toBeUndefined();
	});
});

describe('extractQuantity', () => {
	it('handles 2 x 45.00', () => {
		const q = extractQuantity('Curd 500 G 2 x 45.00 90.00');
		expect(q.quantity).toBe(2);
		expect(q.unitPrice).toBe(45);
	});
	it('handles 2 @ 45', () => {
		expect(extractQuantity('Oil 2 @ 45 90.00').quantity).toBe(2);
	});
	it('handles 500 G', () => {
		const q = extractQuantity('Paneer 500 G 95.00');
		expect(q.quantity).toBe(500);
		expect(q.unit).toBe('g');
	});
	it('handles 1.5 KG', () => {
		const q = extractQuantity('Tomato 1.5 KG 60.00');
		expect(q.quantity).toBe(1.5);
		expect(q.unit).toBe('kg');
	});
	it('handles 1 PKT', () => {
		const q = extractQuantity('Biscuits 1 PKT 30.00');
		expect(q.quantity).toBe(1);
		expect(q.unit).toBe('pkt');
	});
});

describe('isNoiseLine', () => {
	const noise = [
		'GSTIN: 33ABCDE1234F1Z5',
		'Bill No: GB/2026/1182',
		'CGST 2.5% 4.50',
		'SGST 2.5% 4.50',
		'IGST 5% 10.00',
		'DISCOUNT -20.00',
		'ROUND OFF 0.50',
		'CASH 400.00',
		'CARD XXXX1234 302.00',
		'UPI - PhonePe 472.00',
		'CHANGE 44.00',
		'Total Items : 5',
		'Ph: 044-28123456',
		'12 Market Road, Anna Nagar',
		'ITEM QTY RATE AMOUNT',
		'Thank you, visit again!',
		'-------------------------'
	];
	for (const n of noise) {
		it(`rejects: ${n}`, () => expect(isNoiseLine(n)).toBe(true));
	}
	it('keeps real item lines', () => {
		expect(isNoiseLine('Milk 1 L 56.00')).toBe(false);
		expect(isNoiseLine('Paneer 200 G 95.00')).toBe(false);
	});
});

describe('matchTotalLine', () => {
	it('reads total variants', () => {
		expect(matchTotalLine('TOTAL 356.00')).toBe(356);
		expect(matchTotalLine('GRAND TOTAL 360.00')).toBe(360);
		expect(matchTotalLine('NET AMOUNT 1058.00')).toBe(1058);
		expect(matchTotalLine('AMOUNT PAYABLE 291.00')).toBe(291);
	});
	it('ignores item-count lines', () => {
		expect(matchTotalLine('Total Items : 5')).toBeUndefined();
	});
});

describe('cleanItemName', () => {
	it('expands abbreviations', () => {
		expect(cleanItemName('MLK TONED 1L')).toBe('Milk Toned');
		expect(cleanItemName('PNR 200 G')).toBe('Paneer');
		expect(cleanItemName('TMT 1KG')).toBe('Tomato');
		expect(cleanItemName('ONN 1KG')).toBe('Onion');
		expect(cleanItemName('BTR 100 G')).toBe('Butter');
		expect(cleanItemName('CHKN CURRY CUT 1kg')).toBe('Chicken Curry Cut');
	});
	it('removes HSN codes and pack noise', () => {
		expect(cleanItemName('Milk HSN 04012000 1 L')).toBe('Milk');
		expect(cleanItemName('Rice 1001 10 KG')).not.toMatch(/\d{4}/);
	});
	it('does not corrupt letters in names', () => {
		expect(cleanItemName('SOAP 3 PCS')).toBe('Soap');
	});
});

describe('matchCatalog', () => {
	it('matches exact and fuzzy names', () => {
		expect(matchCatalog('Milk').name).toBe('Milk');
		expect(matchCatalog('Tomatto').name).toBe('Tomato');
		expect(matchCatalog('Paneer').category).toBe('dairy');
		expect(matchCatalog('Chicken Curry Cut').name).toBe('Chicken');
	});
	it('assigns storage places and shelf life', () => {
		const m = matchCatalog('Chicken');
		expect(m.place).toBe('freezer');
		expect(m.shelfLife).toBeLessThanOrEqual(3);
		expect(matchCatalog('Rice').place).toBe('shelf');
		expect(matchCatalog('Milk').place).toBe('fridge');
	});
	it('flags non-food items', () => {
		expect(matchCatalog('Detergent Powder').nonFood).toBe(true);
		expect(matchCatalog('Carry Bag').nonFood).toBe(true);
		expect(matchCatalog('Soap').nonFood).toBe(true);
	});
	it('falls back to Other with low confidence', () => {
		const m = matchCatalog('Zzqqx Unknown Thing');
		expect(m.category).toBe('other');
		expect(m.confidence).toBeLessThan(0.6);
	});
});

describe('parseBillDate', () => {
	it('parses day-first and ISO formats', () => {
		expect(parseBillDate('Date: 14/03/2026')).toBe('2026-03-14');
		expect(parseBillDate('Date : 02-04-2026')).toBe('2026-04-02');
		expect(parseBillDate('Delivery Date: 2026-03-25')).toBe('2026-03-25');
		expect(parseBillDate('Dt. 18 Mar 2026')).toBe('2026-03-18');
		expect(parseBillDate('05/04/26')).toBe('2026-04-05');
	});
	it('rejects nonsense', () => {
		expect(parseBillDate('no date here')).toBeUndefined();
		expect(parseBillDate('99/99/2026')).toBeUndefined();
	});
});

describe('date math never shifts a day', () => {
	it('addDays and daysLeft round-trip across DST and month ends', () => {
		expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
		expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(daysLeft('2026-03-15', '2026-03-12')).toBe(3);
		expect(daysLeft('2026-03-12', '2026-03-12')).toBe(0);
		expect(daysLeft('2026-03-10', '2026-03-12')).toBe(-2);
	});
	it('todayISO returns a local YYYY-MM-DD', () => {
		expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('estimateShelfLife', () => {
	it('uses the catalog value', () => {
		const e = estimateShelfLife({ name: 'Milk', category: 'dairy', catalogDays: 3, purchaseDate: '2026-03-10' });
		expect(e.expiryDate).toBe('2026-03-13');
		expect(e.estimated).toBe(true);
	});
	it('prefers a user override', () => {
		const e = estimateShelfLife({
			category: 'dairy',
			catalogDays: 3,
			purchaseDate: '2026-03-10',
			settings: { shelfLifeByCategory: { dairy: 10 } }
		});
		expect(e.expiryDate).toBe('2026-03-20');
		expect(e.source).toBe('settings');
	});
	it('falls back to a category default', () => {
		const e = estimateShelfLife({ category: 'vegetables', purchaseDate: '2026-03-10' });
		expect(e.days).toBeGreaterThan(0);
	});
});

/* ------------------------------------------------------------------ */
/* end-to-end parse checks                                            */
/* ------------------------------------------------------------------ */

describe('parseBill: clean bill', () => {
	const r = parseBill(BILL_1_CLEAN);
	it('reads the store, date and total', () => {
		expect(r.store).toMatch(/GREEN BASKET/i);
		expect(r.date).toBe('2026-03-14');
		expect(r.total).toBe(356);
	});
	it('reads all six items', () => {
		expect(r.items).toHaveLength(6);
		expect(r.items.map((i) => i.name)).toEqual(
			expect.arrayContaining(['Milk', 'Tomato', 'Onion', 'Bread', 'Paneer', 'Eggs'])
		);
	});
	it('sums to the printed total', () => {
		expect(r.itemsSum).toBe(356);
		expect(r.mismatch).toBe(false);
	});
	it('excludes cash and change lines', () => {
		expect(r.items.some((i) => /cash|change/i.test(i.name))).toBe(false);
	});
});

describe('parseBill: multiplier quantities', () => {
	const r = parseBill(BILL_2_MULTIPLIER);
	it('parses 4 items with quantities', () => {
		expect(r.items).toHaveLength(4);
		const curd = r.items.find((i) => i.name === 'Curd');
		expect(curd?.quantity).toBe(2);
		expect(curd?.price).toBe(90);
	});
	it('takes GRAND TOTAL over SUBTOTAL', () => {
		expect(r.total).toBe(360);
	});
	it('drops CGST/SGST lines', () => {
		expect(r.items.some((i) => /gst/i.test(i.rawText))).toBe(false);
	});
});

describe('parseBill: price on the next line', () => {
	const r = parseBill(BILL_3_NEXT_LINE_PRICE);
	it('pairs each item with the following amount', () => {
		expect(r.items).toHaveLength(4);
		expect(r.items.find((i) => i.name === 'Basmati Rice')?.price).toBe(525);
		expect(r.items.find((i) => i.name === 'Ghee')?.price).toBe(320);
	});
	it('reads NET AMOUNT as the total', () => {
		expect(r.total).toBe(1058);
	});
});

describe('parseBill: heavy OCR noise', () => {
	const r = parseBill(BILL_4_OCR_NOISE);
	it('recovers items despite O/0 and S/5 confusion', () => {
		expect(r.items.length).toBeGreaterThanOrEqual(5);
		const names = r.items.map((i) => i.name);
		expect(names).toEqual(expect.arrayContaining(['Milk', 'Tomato', 'Onion', 'Paneer', 'Butter']));
	});
	it('repairs prices', () => {
		expect(r.items.find((i) => i.name === 'Milk')?.price).toBe(56);
		expect(r.items.find((i) => i.name === 'Paneer')?.price).toBe(95);
	});
	it('reads AMOUNT PAYABLE', () => {
		expect(r.total).toBe(291);
	});
});

describe('parseBill: many items', () => {
	const r = parseBill(BILL_5_MANY_ITEMS);
	it('parses at least 24 of 25 lines', () => {
		expect(r.items.length).toBeGreaterThanOrEqual(24);
	});
	it('matches the printed total within 3%', () => {
		expect(r.total).toBe(3012);
		expect(Math.abs(r.itemsSum - 3012) / 3012).toBeLessThan(0.03);
		expect(r.mismatch).toBe(false);
	});
	it('flags the non-food lines', () => {
		const nonFood = r.items.filter((i) => i.nonFood);
		expect(nonFood.map((i) => i.name)).toEqual(
			expect.arrayContaining(['Detergent Powder', 'Dishwash Liquid', 'Carry Bag'])
		);
	});
});

describe('parseBill: different layout with S.No column', () => {
	const r = parseBill(BILL_6_DIFFERENT_LAYOUT);
	it('parses the five numbered rows', () => {
		expect(r.items).toHaveLength(5);
		expect(r.items.map((i) => i.name)).toEqual(
			expect.arrayContaining(['Chicken', 'Fish', 'Green Chilli', 'Coriander Leaves', 'Lemon'])
		);
	});
	it('ignores the item-count line and the UPI line', () => {
		expect(r.items.some((i) => /total items|upi/i.test(i.rawText))).toBe(false);
		expect(r.total).toBe(472);
	});
	it('parses a spelled-out date', () => {
		expect(r.date).toBe('2026-03-18');
	});
});

describe('parseBill: e-bill text with brand names', () => {
	const r = parseBill(BILL_7_EBILL_TEXT);
	it('matches branded lines to catalog items', () => {
		expect(r.items.length).toBeGreaterThanOrEqual(5);
		const names = r.items.map((i) => i.name);
		expect(names).toEqual(expect.arrayContaining(['Milk', 'Sunflower Oil', 'Salt']));
	});
	it('uses Grand Total', () => {
		expect(r.total).toBe(747);
	});
	it('drops the delivery fee line from items', () => {
		expect(r.items.some((i) => /delivery/i.test(i.name))).toBe(false);
	});
});

describe('parseBill: low-contrast short bill', () => {
	const r = parseBill(BILL_8_LOW_CONTRAST);
	it('parses all five items', () => {
		expect(r.items).toHaveLength(5);
		expect(r.total).toBe(523);
		expect(r.mismatch).toBe(false);
	});
});

describe('parseBill: no total present', () => {
	const r = parseBill(BILL_9_NO_TOTAL);
	it('still returns items and no false mismatch', () => {
		expect(r.items).toHaveLength(3);
		expect(r.total).toBeUndefined();
		expect(r.mismatch).toBe(false);
	});
});

describe('parseBill: food and non-food mixed', () => {
	const r = parseBill(BILL_10_NONFOOD_MIX);
	it('separates food from household', () => {
		const food = r.items.filter((i) => !i.nonFood).map((i) => i.name);
		const nonFood = r.items.filter((i) => i.nonFood).map((i) => i.name);
		expect(food).toEqual(expect.arrayContaining(['Milk', 'Bread']));
		expect(nonFood).toEqual(expect.arrayContaining(['Soap', 'Detergent Powder', 'Toothpaste', 'Carry Bag']));
	});
});

describe('parseBill: messy abbreviated bill with rate column', () => {
	const r = parseBill(BILL_11_MESSY);
	it('expands abbreviations and keeps 4 items', () => {
		expect(r.items).toHaveLength(4);
		const names = r.items.map((i) => i.name);
		expect(names).toEqual(expect.arrayContaining(['Chicken', 'Tomato', 'Onion', 'Green Chilli']));
	});
	it('ignores discount, round off and card lines', () => {
		expect(r.items.some((i) => /disc|round|card/i.test(i.rawText))).toBe(false);
		expect(r.total).toBe(302);
	});
});

describe('parseBill: WhatsApp-pasted bill with bullets', () => {
	const r = parseBill(BILL_12_WHATSAPP);
	it('parses colon-separated bullet lines', () => {
		expect(r.items).toHaveLength(4);
		expect(r.total).toBe(615);
		expect(r.mismatch).toBe(false);
	});
});

describe('parseBill: mismatch detection', () => {
	it('warns when items do not add up to the total', () => {
		const r = parseBill(`MY STORE
Date 10/03/2026
Milk 1 L   56.00
Bread      45.00
TOTAL     500.00`);
		expect(r.mismatch).toBe(true);
		expect(r.warnings.join(' ')).toMatch(/may be missing or misread/i);
	});
	it('warns when nothing could be read', () => {
		const r = parseBill('@@@@\n#####\n-----');
		expect(r.items).toHaveLength(0);
		expect(r.warnings.join(' ')).toMatch(/No items/i);
	});
});

describe('extractStore', () => {
	it('picks the top non-noise line', () => {
		expect(extractStore(BILL_1_CLEAN.split('\n'))).toMatch(/GREEN BASKET/i);
		expect(extractStore(BILL_6_DIFFERENT_LAYOUT.split('\n'))).toMatch(/VILLAGE KITCHEN/i);
	});
});

/* ------------------------------------------------------------------ */

describe('rankRecipes', () => {
	const today = '2026-03-12';
	const items: PantryItem[] = [
		mk('Tomato', 'vegetables', '2026-03-13'),
		mk('Onion', 'vegetables', '2026-04-01'),
		mk('Toor Dal', 'grains', '2026-09-01'),
		mk('Turmeric Powder', 'spices', '2027-01-01'),
		mk('Chilli Powder', 'spices', '2027-01-01'),
		mk('Mustard Seeds', 'spices', '2027-01-01'),
		mk('Curry Leaves', 'vegetables', '2026-03-14'),
		mk('Salt', 'spices', '2028-01-01')
	];

	it('ranks the fully stocked recipe first', () => {
		const ranked = rankRecipes(items, { today, warningDays: 3 });
		expect(ranked[0].recipe.id).toBe('tomato-dal');
		expect(ranked[0].missing).toHaveLength(0);
		expect(ranked[0].coverage).toBe(1);
	});

	it('reports have/missing counts', () => {
		const ranked = rankRecipes(items, { today, warningDays: 3 });
		const pulao = ranked.find((r) => r.recipe.id === 'veg-pulao');
		expect(pulao).toBeDefined();
		expect(pulao!.missing.length).toBeGreaterThan(0);
		expect(pulao!.have.length + pulao!.missing.length).toBe(pulao!.recipe.ingredients.length);
	});

	it('flags recipes that use expiring stock', () => {
		const ranked = rankRecipes(items, { today, warningDays: 3 });
		expect(ranked[0].usesExpiring).toEqual(expect.arrayContaining(['Tomato']));
	});

	it('filters veg only', () => {
		const ranked = rankRecipes(items, { today, vegOnly: true });
		expect(ranked.every((r) => r.recipe.veg)).toBe(true);
	});

	it('filters by time', () => {
		const ranked = rankRecipes(items, { today, maxMinutes: 15 });
		expect(ranked.every((r) => r.recipe.minutes <= 15)).toBe(true);
	});

	it('filters to expiring-only', () => {
		const ranked = rankRecipes(items, { today, warningDays: 3, usesExpiringOnly: true });
		expect(ranked.every((r) => r.usesExpiring.length > 0)).toBe(true);
	});
});

function mk(name: string, category: PantryItem['category'], expiry: string): PantryItem {
	return {
		id: name,
		name,
		quantity: 1,
		unit: 'pcs',
		category,
		place: 'shelf',
		purchaseDate: '2026-03-10',
		expiryDate: expiry,
		expiryEstimated: true,
		createdAt: 0
	};
}
