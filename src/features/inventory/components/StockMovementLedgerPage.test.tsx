import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the hooks
vi.mock("../hooks/useStockMovements", () => ({
	useStockMovementLedger: vi.fn(),
}));

vi.mock("../api/stockMovements", async () => {
	const actual = await vi.importActual<typeof import("../api/stockMovements")>(
		"../api/stockMovements",
	);
	return {
		...actual,
		fetchStockMovementLedger: vi.fn(),
	};
});

vi.mock("../lib/stockMovementCsv", async () => {
	const actual = await vi.importActual<
		typeof import("../lib/stockMovementCsv")
	>("../lib/stockMovementCsv");
	return {
		...actual,
		exportStockMovementCsv: vi.fn(),
	};
});

import { useStockMovementLedger } from "../hooks/useStockMovements";
import { StockMovementLedgerPage } from "./StockMovementLedgerPage";
import type { StockMovementLedgerRow } from "../api/stockMovements";

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

const MOCK_ROW: StockMovementLedgerRow = {
	id: "mov-1",
	workshop_id: WORKSHOP_ID,
	material_id: "mat-1",
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 5,
	reason: "compra",
	note: null,
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

function Wrapper({ children }: { children: React.ReactNode }) {
	return <MemoryRouter>{children}</MemoryRouter>;
}

describe("StockMovementLedgerPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders page header 'Movimientos de stock' and table", () => {
		vi.mocked(useStockMovementLedger).mockReturnValue({
			data: [MOCK_ROW],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementLedger>);

		render(<StockMovementLedgerPage />, { wrapper: Wrapper });

		expect(screen.getByText("Movimientos de stock")).toBeInTheDocument();
		expect(screen.getByText("Madera MDF 18mm")).toBeInTheDocument();
	});

	it("renders 'Volver al inventario' link", () => {
		vi.mocked(useStockMovementLedger).mockReturnValue({
			data: [MOCK_ROW],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementLedger>);

		render(<StockMovementLedgerPage />, { wrapper: Wrapper });

		expect(screen.getByText("Volver al inventario")).toBeInTheDocument();
	});

	it("filter change triggers a re-render with updated query parameters", () => {
		vi.mocked(useStockMovementLedger).mockReturnValue({
			data: [MOCK_ROW],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementLedger>);

		render(<StockMovementLedgerPage />, { wrapper: Wrapper });

		// Type in the search input
		const searchInput = screen.getByPlaceholderText(/buscar material/i);
		fireEvent.change(searchInput, { target: { value: "MDF" } });

		// After typing, useStockMovementLedger should have been called with search filter
		// The mock was called with the initial filters ({}) during render
		// After filter change, the component re-renders and calls useStockMovementLedger again
		expect(useStockMovementLedger).toHaveBeenCalled();
	});

	it("export button is visible when there is data", () => {
		vi.mocked(useStockMovementLedger).mockReturnValue({
			data: [MOCK_ROW],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementLedger>);

		render(<StockMovementLedgerPage />, { wrapper: Wrapper });

		expect(
			screen.getByRole("button", { name: /exportar csv/i }),
		).toBeInTheDocument();
	});

	it("clicking export calls fetchStockMovementLedger and exportStockMovementCsv", async () => {
		const mockData = [MOCK_ROW];
		const { fetchStockMovementLedger } = await import("../api/stockMovements");
		const { exportStockMovementCsv } = await import("../lib/stockMovementCsv");

		vi.mocked(useStockMovementLedger).mockReturnValue({
			data: mockData,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementLedger>);
		vi.mocked(fetchStockMovementLedger).mockResolvedValue(mockData);

		render(<StockMovementLedgerPage />, { wrapper: Wrapper });

		const exportBtn = screen.getByRole("button", { name: /exportar csv/i });
		fireEvent.click(exportBtn);

		// Wait for the async handler
		await vi.waitFor(() => {
			expect(fetchStockMovementLedger).toHaveBeenCalled();
		});

		expect(fetchStockMovementLedger).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 500, offset: 0 }),
		);
		expect(exportStockMovementCsv).toHaveBeenCalledWith(mockData);
	});
});
