import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StockMovementLedgerTable } from "./StockMovementLedgerTable";
import type { StockMovementLedgerRow } from "../api/stockMovements";

function Wrapper({ children }: { children: React.ReactNode }) {
	return <MemoryRouter>{children}</MemoryRouter>;
}

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

const ROW_WITH_CREATOR: StockMovementLedgerRow = {
	id: "mov-1",
	workshop_id: WORKSHOP_ID,
	material_id: "mat-1",
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 5,
	reason: "compra",
	note: "Compra proveedor A",
	quote_id: "quote-1",
	quote_number: "Q-2026-001",
	created_at: "2026-01-15T10:30:00Z",
	created_by: "user-1",
	creator_name: "Juan Pérez",
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
};

const ROW_WITHOUT_CREATOR: StockMovementLedgerRow = {
	id: "mov-2",
	workshop_id: WORKSHOP_ID,
	material_id: "mat-2",
	material_name: "Tornillos 5x50",
	material_unit: "un",
	delta: -3,
	reason: "consumo",
	note: null,
	quote_id: null,
	quote_number: null,
	created_at: "2026-02-20T14:00:00Z",
	created_by: null,
	creator_name: null,
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
};

const ROW_WITH_QUOTE: StockMovementLedgerRow = {
	id: "mov-3",
	workshop_id: WORKSHOP_ID,
	material_id: "mat-1",
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 10,
	reason: "descuento_presupuesto",
	note: "Descuento automático",
	quote_id: "quote-2",
	quote_number: "Q-2026-002",
	created_at: "2026-03-10T09:00:00Z",
	created_by: "user-1",
	creator_name: "Juan Pérez",
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
};

const MOCK_ROWS = [ROW_WITH_CREATOR, ROW_WITHOUT_CREATOR, ROW_WITH_QUOTE];

const PRODUCTION_ROW: StockMovementLedgerRow = {
	...ROW_WITH_CREATOR,
	id: "mov-4",
	material_name: "Melamina 18mm",
	delta: -5,
	reason: "consumo_produccion",
	quote_id: "q-3",
	quote_number: "P-2026-003",
	note: "Inicio de producción",
	production_deduction_id: "pd-1",
	is_production_deduction: true,
	production_deduction_status: "completed",
};

describe("StockMovementLedgerTable", () => {
	it("renders material name, signed delta, reason label, note, timestamp, and creator name for each row", () => {
		render(<StockMovementLedgerTable rows={MOCK_ROWS} />, { wrapper: Wrapper });

		expect(screen.getAllByText("Madera MDF 18mm")).toHaveLength(2);
		expect(screen.getByText("Tornillos 5x50")).toBeInTheDocument();

		expect(screen.getByText("+5")).toBeInTheDocument();
		expect(screen.getByText("-3")).toBeInTheDocument();
		expect(screen.getByText("+10")).toBeInTheDocument();

		expect(screen.getByText("Compra")).toBeInTheDocument();
		expect(screen.getByText("Consumo")).toBeInTheDocument();
		expect(screen.getByText("Descuento presupuesto")).toBeInTheDocument();

		expect(screen.getByText("Compra proveedor A")).toBeInTheDocument();
		expect(screen.getByText("Descuento automático")).toBeInTheDocument();

		// Juan Pérez appears twice — also creator of row 3
		expect(screen.getAllByText("Juan Pérez")).toHaveLength(2);
	});

	it("links material names to the dedicated movement detail page", () => {
		render(<StockMovementLedgerTable rows={[ROW_WITH_CREATOR]} />, {
			wrapper: Wrapper,
		});

		expect(
			screen.getByRole("link", { name: "Madera MDF 18mm" }),
		).toHaveAttribute("href", "/inventory/movements/mov-1");
	});

	it("shows reversal reason label and human reversal reason instead of technical note", () => {
		render(
			<StockMovementLedgerTable
				rows={[
					{
						...ROW_WITH_CREATOR,
						id: "rev-1",
						reason: "reversion",
						note: "Reversión de movimiento 93000000-0000-0000-0000-000000000005",
						reversal_reason: "QA visual: reversión desde UI",
						reversal_of_movement_id: "93000000-0000-0000-0000-000000000005",
						reversed_original_reason: "ajuste",
						is_reversal: true,
					},
				]}
			/>,
			{ wrapper: Wrapper },
		);

		expect(screen.getByText("Reversión")).toBeInTheDocument();
		expect(
			screen.getByText("QA visual: reversión desde UI"),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/93000000-0000-0000-0000-000000000005/),
		).not.toBeInTheDocument();
	});

	it("shows 'Sin registrar' when creator is null", () => {
		render(<StockMovementLedgerTable rows={[ROW_WITHOUT_CREATOR]} />, {
			wrapper: Wrapper,
		});
		expect(screen.getByText("Sin registrar")).toBeInTheDocument();
	});

	it("shows empty state (Spanish copy) when data is []", () => {
		render(<StockMovementLedgerTable rows={[]} />, { wrapper: Wrapper });
		expect(screen.getByText("Sin movimientos")).toBeInTheDocument();
	});

	it("shows loading skeleton/spinner when isLoading is true", () => {
		const { container } = render(
			<StockMovementLedgerTable rows={[]} isLoading={true} />,
			{ wrapper: Wrapper },
		);
		const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it("renders production indicator badge and quote reference for production-origin rows", () => {
		render(<StockMovementLedgerTable rows={[PRODUCTION_ROW]} />, {
			wrapper: Wrapper,
		});

		expect(screen.getByText("Consumo producción")).toBeInTheDocument();
		expect(screen.getByText("P-2026-003")).toBeInTheDocument();
	});

	it("shows error message (Spanish copy) when query has an error", () => {
		render(
			<StockMovementLedgerTable
				rows={[]}
				error={new Error("Something went wrong")}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("Error al cargar movimientos")).toBeInTheDocument();
	});
});
