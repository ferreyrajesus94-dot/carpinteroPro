import type { StockMovementReason } from "../api/stockMovements";

/**
 * Single source of truth for stock movement user-facing labels and
 * formatting. Previously each surface (table, filters, detail page,
 * history dialog, CSV builder) declared its own REASON_LABELS map and
 * its own signed-delta formatter, and the four copies had already
 * drifted (e.g. 'Descuento por presupuesto' vs 'Descuento presupuesto').
 *
 * Now every surface imports from here, the type system forces new
 * reasons to be added, and the filter dropdown derives its options
 * from the same key set.
 */

export const REASON_LABELS: Record<StockMovementReason, string> = {
	compra: "Compra",
	consumo: "Consumo",
	merma: "Merma",
	ajuste: "Ajuste",
	descuento_presupuesto: "Descuento presupuesto",
	reversion: "Reversión",
};

export const REASON_OPTIONS: ReadonlyArray<{
	value: StockMovementReason;
	label: string;
}> = (Object.keys(REASON_LABELS) as StockMovementReason[]).map((value) => ({
	value,
	label: REASON_LABELS[value],
}));

const NUMBER_FORMATTER = new Intl.NumberFormat("es-AR", {
	maximumFractionDigits: 2,
});

/**
 * Format a signed quantity with es-AR locale formatting and an explicit
 * sign for non-negative values (e.g. `+5,00`). Used by the ledger
 * table, the per-material history dialog, and the detail page.
 */
export function formatSignedQuantity(n: number): string {
	const sign = n > 0 ? "+" : "";
	return `${sign}${NUMBER_FORMATTER.format(n)}`;
}
