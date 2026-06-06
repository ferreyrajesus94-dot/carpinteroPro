import { describe, expect, it } from "vitest";
import { calculateQuote } from "./quotesCalculator";

describe("calculateQuote shared characterization", () => {
	it("preserves on_cost margins, cost base, visible extras, and margin amount", () => {
		const result = calculateQuote({
			recipeCost: 10_000,
			extras: [
				{ amount: 1_000, show_in_quote: true },
				{ amount: 500, show_in_quote: false },
			],
			marginMode: "on_cost",
			marginPct: 25,
		});

		expect(result).toEqual({
			costBase: 11_500,
			visibleExtras: 1_000,
			marginAmount: 2_875,
			salePrice: 14_375,
		});
	});

	it("preserves on_price margins by dividing cost base by the remaining price percentage", () => {
		const result = calculateQuote({
			recipeCost: 10_000,
			extras: [],
			marginMode: "on_price",
			marginPct: 50,
		});

		expect(result).toEqual({
			costBase: 10_000,
			visibleExtras: 0,
			marginAmount: 10_000,
			salePrice: 20_000,
		});
	});

	it("preserves the zero-margin edge for on_cost and on_price modes", () => {
		expect(
			calculateQuote({
				recipeCost: 5_000,
				extras: [{ amount: 750, show_in_quote: true }],
				marginMode: "on_cost",
				marginPct: 0,
			}),
		).toEqual({
			costBase: 5_750,
			visibleExtras: 750,
			marginAmount: 0,
			salePrice: 5_750,
		});

		expect(
			calculateQuote({
				recipeCost: 8_000,
				extras: [{ amount: 2_000, show_in_quote: false }],
				marginMode: "on_price",
				marginPct: 0,
			}),
		).toEqual({
			costBase: 10_000,
			visibleExtras: 0,
			marginAmount: 0,
			salePrice: 10_000,
		});
	});

	it("preserves the on_price division-by-zero guard by falling back to cost base", () => {
		const result = calculateQuote({
			recipeCost: 5_000,
			extras: [{ amount: 250, show_in_quote: true }],
			marginMode: "on_price",
			marginPct: 100,
		});

		expect(result).toEqual({
			costBase: 5_250,
			visibleExtras: 250,
			marginAmount: 0,
			salePrice: 5_250,
		});
	});
});
