import type { StockMovementLedgerRow } from "../api/stockMovements";
import { REASON_LABELS } from "./stockMovementLabels";

export const EXPORT_LIMIT = 500;

const HEADERS = [
	"fecha",
	"material_id",
	"material",
	"delta",
	"motivo",
	"nota",
	"creador",
	"es_reversion",
	"movimiento_original_id",
	"motivo_reversion",
	"revertido_por_movimiento_id",
	"origen_produccion",
	"presupuesto",
	"production_deduction_id",
] as const;

function escape(value: unknown): string {
	if (value === null || value === undefined) return "";
	const s = String(value);
	if (/[",\n\r]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

export function buildStockMovementCsv(rows: StockMovementLedgerRow[]): string {
	const lines = rows.map((r) => {
		return [
			r.created_at,
			r.material_id,
			r.material_name,
			// Intentionally non-localized: the CSV is meant to be opened in
			// spreadsheets where a fixed decimal separator is more reliable.
			r.delta > 0 ? `+${r.delta}` : String(r.delta),
			REASON_LABELS[r.reason] ?? r.reason,
			r.note ?? "",
			r.creator_name ?? "",
			r.is_reversal ? "si" : "no",
			r.reversal_of_movement_id ?? "",
			r.reversal_reason ?? "",
			r.reversed_by_movement_id ?? "",
			r.is_production_deduction ? "si" : "no",
			r.quote_number ?? "",
			r.production_deduction_id ?? "",
		]
			.map(escape)
			.join(",");
	});
	const header = HEADERS.map(escape).join(",");
	return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

function todayFilename(): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `movimientos-stock-${yyyy}-${mm}-${dd}.csv`;
}

export function exportStockMovementCsv(rows: StockMovementLedgerRow[]): void {
	const csv = buildStockMovementCsv(rows);
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = todayFilename();
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
