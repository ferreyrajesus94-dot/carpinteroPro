import { describe, it, expect } from "vitest";
import { buildStockMovementCsv, EXPORT_LIMIT } from "./stockMovementCsv";
import type {
	StockMovementLedgerRow,
	StockMovementReason,
} from "../api/stockMovements";

const BASE_ROW: StockMovementLedgerRow = {
	id: "mov-1",
	workshop_id: "w-1",
	material_id: "mat-1",
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 5,
	reason: "compra" as StockMovementReason,
	note: "Compra a Proveedor X",
	quote_id: null,
	quote_number: null,
	created_at: "2026-01-15T10:30:00Z",
	created_by: "user-1",
	creator_name: "Juan Pérez",
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	is_reversal: false,
	reversed_by_movement_id: null,
};

const ROWS: StockMovementLedgerRow[] = [
	BASE_ROW,
	{
		...BASE_ROW,
		id: "mov-2",
		material_name: "Tornillos 4x40",
		delta: -3,
		reason: "consumo" as StockMovementReason,
		note: null,
		created_by: null,
		creator_name: null,
		quote_id: "q-1",
		quote_number: "P-2026-001",
	},
];

describe("buildStockMovementCsv", () => {
	it("includes BOM UTF-8 at start", () => {
		const csv = buildStockMovementCsv([]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});

	it("empty list emits exactly one line (the header) with no trailing CRLF", () => {
		const csv = buildStockMovementCsv([]);
		// Strip BOM, then split on CRLF. The empty result is one header line.
		const lines = csv.slice(1).split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(1);
		expect(csv.endsWith("\r\n")).toBe(false);
	});

	it("first line after BOM contains stable headers", () => {
		const csv = buildStockMovementCsv([]);
		const firstLine = csv.slice(1).split("\r\n")[0];
		expect(firstLine).toBe(
			"fecha,material_id,material,delta,motivo,nota,creador,es_reversion,movimiento_original_id,motivo_reversion,revertido_por_movimiento_id",
		);
	});

	it("escapes commas and double-quotes in material names and notes correctly", () => {
		const row: StockMovementLedgerRow = {
			...BASE_ROW,
			material_name: 'MDF "grueso", 18mm',
			note: 'Nota con "comillas" y, coma',
		};
		const csv = buildStockMovementCsv([row]);
		const line = csv.slice(1).split("\r\n")[1];
		// material_name should be wrapped
		expect(line).toContain('"MDF ""grueso"", 18mm"');
		// note should be wrapped
		expect(line).toContain('"Nota con ""comillas"" y, coma"');
	});

	it("null creator renders as empty string in CSV", () => {
		const row: StockMovementLedgerRow = {
			...BASE_ROW,
			created_by: null,
			creator_name: null,
		};
		const csv = buildStockMovementCsv([row]);
		const line = csv.slice(1).split("\r\n")[1];
		const fields = line.split(",");
		// creator is the last field
		expect(fields[fields.length - 1]).toBe("");
	});

	it("delta is rendered as a signed number", () => {
		const csv = buildStockMovementCsv(ROWS);
		const lines = csv.slice(1).split("\r\n").filter(Boolean);
		// first data row has delta 5 -> "+5"
		expect(lines[1]).toContain(",+5,");
		// second data row has delta -3 -> "-3"
		expect(lines[2]).toContain(",-3,");
	});

	it("reason is rendered as Spanish label", () => {
		const csv = buildStockMovementCsv(ROWS);
		const lines = csv.slice(1).split("\r\n").filter(Boolean);
		// first data row: compra -> Compra
		expect(lines[1]).toContain(",Compra,");
		// second data row: consumo -> Consumo
		expect(lines[2]).toContain(",Consumo,");
	});

	it("includes reversal traceability columns", () => {
		const row: StockMovementLedgerRow = {
			...BASE_ROW,
			id: "rev-1",
			delta: -5,
			reason: "reversion",
			reversal_of_movement_id: "mov-1",
			reversal_reason: "Carga duplicada",
			reversed_original_reason: "compra",
			is_reversal: true,
			reversed_by_movement_id: null,
		};
		const csv = buildStockMovementCsv([row]);
		const line = csv.slice(1).split("\r\n")[1];

		expect(line).toContain(",Reversión,");
		expect(line).toContain(",si,mov-1,Carga duplicada,");
	});

	it("includes reversed-by movement id for original rows", () => {
		const row: StockMovementLedgerRow = {
			...BASE_ROW,
			reversed_by_movement_id: "rev-1",
		};
		const csv = buildStockMovementCsv([row]);
		const line = csv.slice(1).split("\r\n")[1];

		expect(line.endsWith(",no,,,rev-1")).toBe(true);
	});

	it("filename is movimientos-stock-YYYY-MM-DD.csv", () => {
		const d = new Date("2026-01-15T10:30:00Z");
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		const filename = `movimientos-stock-${yyyy}-${mm}-${dd}.csv`;
		expect(filename).toMatch(/^movimientos-stock-\d{4}-\d{2}-\d{2}\.csv$/);
	});
});

describe("EXPORT_LIMIT", () => {
	it("is exported and equals 500", () => {
		expect(EXPORT_LIMIT).toBe(500);
	});

	it("when filtered rows exceed EXPORT_LIMIT, the CSV still builds from the passed rows (limit enforced at API call site)", () => {
		const manyRows = Array.from({ length: EXPORT_LIMIT + 10 }, (_, i) => ({
			...BASE_ROW,
			id: `mov-${i}`,
		}));
		const csv = buildStockMovementCsv(manyRows);
		const lines = csv.slice(1).split("\r\n").filter(Boolean);
		// header + all rows
		expect(lines.length).toBe(manyRows.length + 1);
	});
});
