// Recipe ranking: score recipes by how many ingredients the user already has,
// with extra weight for ingredients that are about to expire.

import { RECIPES, type Recipe } from './recipes';
import { daysLeft } from './dates';
import type { PantryItem } from './types';

export interface RankedRecipe {
	recipe: Recipe;
	have: string[];
	missing: string[];
	/** 0..1 coverage of the ingredient list */
	coverage: number;
	/** ranking score, coverage plus an expiring-items bonus */
	score: number;
	/** names of expiring-soon stock this recipe would use up */
	usesExpiring: string[];
}

function norm(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Does the pantry contain this ingredient? Loose name match both ways. */
function findStock(ingredient: string, items: PantryItem[]): PantryItem | undefined {
	const ing = norm(ingredient);
	let partial: PantryItem | undefined;
	for (const it of items) {
		if (it.quantity <= 0) continue;
		const n = norm(it.name);
		if (n === ing) return it;
		if (!partial && (n.includes(ing) || ing.includes(n)) && Math.min(n.length, ing.length) >= 4) {
			partial = it;
		}
	}
	return partial;
}

export function rankRecipes(
	items: PantryItem[],
	opts: { warningDays?: number; vegOnly?: boolean; maxMinutes?: number; usesExpiringOnly?: boolean; today?: string } = {}
): RankedRecipe[] {
	const warningDays = opts.warningDays ?? 3;
	const out: RankedRecipe[] = [];

	for (const recipe of RECIPES) {
		if (opts.vegOnly && !recipe.veg) continue;
		if (opts.maxMinutes && recipe.minutes > opts.maxMinutes) continue;

		const have: string[] = [];
		const missing: string[] = [];
		const usesExpiring: string[] = [];
		let expiringBonus = 0;

		for (const ing of recipe.ingredients) {
			const stock = findStock(ing, items);
			if (stock) {
				have.push(ing);
				const left = daysLeft(stock.expiryDate, opts.today);
				if (left >= 0 && left <= warningDays) {
					usesExpiring.push(stock.name);
					// closer to expiry = bigger bonus
					expiringBonus += (warningDays - left + 1) / (warningDays + 1);
				}
			} else {
				missing.push(ing);
			}
		}

		const coverage = recipe.ingredients.length ? have.length / recipe.ingredients.length : 0;
		if (opts.usesExpiringOnly && usesExpiring.length === 0) continue;

		const score = coverage * 10 + expiringBonus * 3;
		out.push({ recipe, have, missing, coverage, score, usesExpiring });
	}

	out.sort((a, b) => b.score - a.score || a.recipe.minutes - b.recipe.minutes);
	return out;
}
