import { describe, expect, it } from "vitest";
import {
	applyWaste,
	computeRecipeCost,
	resolveItemQuantity,
	type RecipeCostItem,
} from "./recipeCosting";

type TestCategory = "madera" | "herraje" | "otro" | "pintura";

function makeItem(overrides: {
	id?: string;
	category: TestCategory;
	price_per_unit: number;
	quantity: number;
	waste_pct?: number | null;
	quantity_formula?: string | null;
	wood_subtype?: RecipeCostItem["material"]["wood_subtype"];
	unit?: RecipeCostItem["material"]["unit"];
	length_cm?: number | null;
	width_cm?: number | null;
}): RecipeCostItem {
	const id = overrides.id ?? "ri-1";
	return {
		quantity_formula: overrides.quantity_formula ?? null,
		quantity: overrides.quantity,
		waste_pct: overrides.waste_pct ?? 0,
		material: {
			id: `mat-${id}`,
			name: "Material",
			unit: overrides.unit ?? "un",
			category: overrides.category,
			price_per_unit: overrides.price_per_unit,
			wood_subtype: overrides.wood_subtype ?? null,
			length_cm: overrides.length_cm ?? null,
			width_cm: overrides.width_cm ?? null,
			thickness_cm: null,
		},
	};
}

describe("recipeCosting shared characterization", () => {
	it("returns zeros for empty items and no labor", () => {
		expect(computeRecipeCost([])).toEqual({
			woodsTotal: 0,
			extrasTotal: 0,
			laborTotal: 0,
			total: 0,
		});
	});

	it("applies waste_pct, null, and zero without rounding", () => {
		expect(applyWaste(2.5, 12)).toBe(2.8000000000000003);
		expect(applyWaste(2.5, null)).toBe(2.5);
		expect(applyWaste(2.5, 0)).toBe(2.5);
	});

	it("splits mixed madera and extras while accumulating labor", () => {
		const result = computeRecipeCost(
			[
				makeItem({ category: "madera", price_per_unit: 2_500, quantity: 4 }),
				makeItem({
					id: "ri-2",
					category: "herraje",
					price_per_unit: 150,
					quantity: 8,
				}),
			],
			[{ hours: 4, rate: 2_500 }],
		);

		expect(result).toEqual({
			woodsTotal: 10_000,
			extrasTotal: 1_200,
			laborTotal: 10_000,
			total: 21_200,
		});
	});

	it("evaluates formula variables through safeEvalFormula", () => {
		const item = makeItem({
			category: "otro",
			price_per_unit: 100,
			quantity: 3,
			quantity_formula: "ancho * 2 + alto",
		});

		expect(resolveItemQuantity(item, { ancho: 4, alto: 1 })).toBe(9);
		expect(computeRecipeCost([item], [], { ancho: 4, alto: 1 })).toEqual({
			woodsTotal: 0,
			extrasTotal: 900,
			laborTotal: 0,
			total: 900,
		});
	});

	it("falls back to the stored quantity for unsafe or non-finite formulas", () => {
		const item = makeItem({
			category: "pintura",
			price_per_unit: 250,
			quantity: 3,
			quantity_formula: "ancho / 0",
		});

		expect(resolveItemQuantity(item, { ancho: 4 })).toBe(3);
		expect(computeRecipeCost([item], [], { ancho: 4 })).toEqual({
			woodsTotal: 0,
			extrasTotal: 750,
			laborTotal: 0,
			total: 750,
		});
	});
});
