import {
	computeWoodUsage,
	type WoodMaterial,
} from "@/shared/lib/computeWoodUsage";
import { safeEvalFormula } from "@/shared/lib/evalFormula";

export interface RecipeCost {
	woodsTotal: number;
	extrasTotal: number;
	laborTotal: number;
	total: number;
}

export type RecipeCostItem = {
	quantity: number;
	waste_pct: number | null;
	quantity_formula?: string | null;
	material: WoodMaterial & { category: string; price_per_unit: number };
};

export type RecipeCostLaborItem = {
	hours: number;
	rate: number;
};

/** Aplica merma a la cantidad: qty * (1 + waste_pct/100). */
export function applyWaste(
	qty: number,
	wastePct: number | null | undefined,
): number {
	const w = wastePct ?? 0;
	return qty * (1 + w / 100);
}

/** Cantidad efectiva: si hay fórmula evaluable con los params, la usa; si no, `quantity`. */
export function resolveItemQuantity(
	item: Pick<RecipeCostItem, "quantity" | "quantity_formula">,
	paramValues: Record<string, number> = {},
): number {
	return safeEvalFormula(item.quantity_formula, paramValues, item.quantity);
}

/**
 * Calcula el costo estimado de un mueble a partir de sus items.
 * Nunca se persiste — siempre se recalcula en tiempo de lectura.
 */
export function computeRecipeCost(
	items: RecipeCostItem[],
	laborItems: RecipeCostLaborItem[] = [],
	paramValues: Record<string, number> = {},
): RecipeCost {
	let woodsTotal = 0;
	let extrasTotal = 0;
	for (const item of items) {
		const baseQty = resolveItemQuantity(item, paramValues);
		const qty = applyWaste(baseQty, item.waste_pct);
		if (item.material.category === "madera") {
			woodsTotal += computeWoodUsage(item.material, qty).subtotal;
		} else {
			extrasTotal += qty * item.material.price_per_unit;
		}
	}
	const laborTotal = laborItems.reduce((s, l) => s + l.hours * l.rate, 0);
	return {
		woodsTotal,
		extrasTotal,
		laborTotal,
		total: woodsTotal + extrasTotal + laborTotal,
	};
}
