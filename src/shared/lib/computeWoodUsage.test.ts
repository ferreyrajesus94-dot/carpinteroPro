import { describe, expect, it } from "vitest";
import { computeWoodUsage, type WoodMaterial } from "./computeWoodUsage";

function wood(overrides: Partial<WoodMaterial>): WoodMaterial {
	return {
		id: "mat-1",
		name: "Madera",
		category: "madera",
		unit: "un",
		price_per_unit: 1_000,
		wood_subtype: null,
		length_cm: null,
		width_cm: null,
		thickness_cm: null,
		...overrides,
	};
}

describe("computeWoodUsage shared characterization", () => {
	it("charges full placa pieces for placa/un with stock dimensions", () => {
		const result = computeWoodUsage(
			wood({ wood_subtype: "placa", length_cm: 260, width_cm: 183 }),
			5,
		);

		expect(result).toEqual({
			mode: "placa-pieces",
			inputUnitLabel: "m²",
			piecesNeeded: 2,
			pieceLabel: "2,6 × 1,83 m",
			subtotal: 2_000,
		});
	});

	it("charges placa area without rounding for placa/m2", () => {
		const result = computeWoodUsage(
			wood({ unit: "m2", wood_subtype: "placa", price_per_unit: 750 }),
			2.5,
		);

		expect(result).toEqual({
			mode: "placa-area",
			inputUnitLabel: "m²",
			piecesNeeded: null,
			pieceLabel: null,
			subtotal: 1_875,
		});
	});

	it("charges full lineal pieces for liston/un with stock length", () => {
		const result = computeWoodUsage(
			wood({ wood_subtype: "liston", length_cm: 320 }),
			7,
		);

		expect(result).toEqual({
			mode: "lineal-pieces",
			inputUnitLabel: "m",
			piecesNeeded: 3,
			pieceLabel: "3,2 m",
			subtotal: 3_000,
		});
	});

	it("charges lineal meters without rounding for tirante/m", () => {
		const result = computeWoodUsage(
			wood({ unit: "m", wood_subtype: "tirante", price_per_unit: 900 }),
			3.5,
		);

		expect(result).toEqual({
			mode: "lineal-meters",
			inputUnitLabel: "m",
			piecesNeeded: null,
			pieceLabel: null,
			subtotal: 3_150,
		});
	});

	it("falls back to flat mode for non-wood usage metadata", () => {
		const result = computeWoodUsage(
			wood({ unit: "kg", price_per_unit: 400 }),
			6,
		);

		expect(result).toEqual({
			mode: "flat",
			inputUnitLabel: "kg",
			piecesNeeded: null,
			pieceLabel: null,
			subtotal: 2_400,
		});
	});

	it("falls back to flat mode when placa pieces are missing stock dimensions", () => {
		const result = computeWoodUsage(
			wood({ wood_subtype: "placa", length_cm: 260, width_cm: null }),
			5,
		);

		expect(result).toEqual({
			mode: "flat",
			inputUnitLabel: "un",
			piecesNeeded: null,
			pieceLabel: null,
			subtotal: 5_000,
		});
	});
});
