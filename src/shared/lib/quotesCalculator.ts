export interface CalcExtra {
	amount: number;
	show_in_quote: boolean;
}

export interface CalcInput {
	recipeCost: number;
	extras: CalcExtra[];
	marginMode: "on_cost" | "on_price";
	marginPct: number; // 0-100
}

export interface CalcResult {
	costBase: number; // recipeCost + totalExtras (todos)
	visibleExtras: number; // sum de extras con show_in_quote=true
	marginAmount: number;
	salePrice: number;
}

export function calculateQuote(input: CalcInput): CalcResult {
	const { recipeCost, extras, marginMode, marginPct } = input;

	const totalExtras = extras.reduce((acc, e) => acc + e.amount, 0);
	const visibleExtras = extras
		.filter((e) => e.show_in_quote)
		.reduce((acc, e) => acc + e.amount, 0);

	const costBase = recipeCost + totalExtras;

	let salePrice: number;
	if (marginMode === "on_cost") {
		salePrice = costBase * (1 + marginPct / 100);
	} else {
		// on_price: marginPct must be < 100 to avoid division by zero
		const divisor = 1 - marginPct / 100;
		salePrice = divisor > 0 ? costBase / divisor : costBase;
	}

	return {
		costBase,
		visibleExtras,
		marginAmount: salePrice - costBase,
		salePrice,
	};
}
