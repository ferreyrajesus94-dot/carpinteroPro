import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { StockHistoryDialog } from "./StockHistoryDialog";

// Mock the hook to control what the dialog renders
vi.mock("../hooks/useStockMovements", () => ({
	useStockMovements: vi.fn(),
}));

import { useStockMovements } from "../hooks/useStockMovements";
import type { StockMovement } from "../api/stockMovements";
import type { Material } from "../types";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MATERIAL = {
	id: "mat-1",
	workshop_id: "w-1",
	name: "Madera MDF 18mm",
	category: "madera",
	unit: "un",
	stock: 10,
	price_per_unit: 0,
	min_stock: 0,
	notes: null,
	pack_size: null,
	wood_subtype: null,
	length_cm: null,
	width_cm: null,
	thickness_cm: null,
	volume_ml: null,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
} as unknown as Material;

function mockQuery(data: StockMovement[] | undefined, isLoading: boolean) {
	// Cast through unknown because we only need the data + isLoading + error
	// surface that the dialog actually consumes.
	vi.mocked(useStockMovements).mockReturnValue({
		data,
		isLoading,
		error: null,
	} as unknown as ReturnType<typeof useStockMovements>);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("StockHistoryDialog", () => {
	it("renders the reversion label for a reversal movement", () => {
		const reversal: StockMovement = {
			id: "rev-1",
			workshop_id: "w-1",
			material_id: "mat-1",
			delta: -5,
			reason: "reversion",
			note: "Reversión de movimiento abc-123",
			quote_id: null,
			created_at: "2026-06-25T18:00:00Z",
			created_by: "user-1",
			reversal_of_movement_id: null,
			reversal_reason: null,
			reversed_original_reason: null,
			reversal_request_id: null,
			production_deduction_id: null,
		};
		mockQuery([reversal], false);

		render(<StockHistoryDialog material={MATERIAL} />, {
			wrapper: makeWrapper(),
		});

		expect(screen.getByText("Reversión")).toBeInTheDocument();
		expect(screen.getByText("-5")).toBeInTheDocument();
	});

	it("renders the empty state when there are no movements", () => {
		mockQuery([], false);

		render(<StockHistoryDialog material={MATERIAL} />, {
			wrapper: makeWrapper(),
		});

		expect(
			screen.getByText("Todavía no hay movimientos para este material."),
		).toBeInTheDocument();
	});

	it("renders the loading skeleton when isLoading is true", () => {
		mockQuery(undefined, true);

		const { container } = render(<StockHistoryDialog material={MATERIAL} />, {
			wrapper: makeWrapper(),
		});
		const skeletons = container.querySelectorAll(
			'[class*="animate-pulse"], [data-slot="skeleton"]',
		);
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it("renders each reason label for known reasons", () => {
		const movements: StockMovement[] = [
			{
				id: "m-1",
				workshop_id: "w-1",
				material_id: "mat-1",
				delta: 5,
				reason: "compra",
				note: null,
				quote_id: null,
				created_at: "2026-06-25T10:00:00Z",
				created_by: "user-1",
				reversal_of_movement_id: null,
				reversal_reason: null,
				reversed_original_reason: null,
				reversal_request_id: null,
				production_deduction_id: null,
			},
			{
				id: "m-2",
				workshop_id: "w-1",
				material_id: "mat-1",
				delta: -3,
				reason: "consumo",
				note: null,
				quote_id: null,
				created_at: "2026-06-25T11:00:00Z",
				created_by: "user-1",
				reversal_of_movement_id: null,
				reversal_reason: null,
				reversed_original_reason: null,
				reversal_request_id: null,
				production_deduction_id: null,
			},
		];
		mockQuery(movements, false);

		render(<StockHistoryDialog material={MATERIAL} />, {
			wrapper: makeWrapper(),
		});

		expect(screen.getByText("Compra")).toBeInTheDocument();
		expect(screen.getByText("Consumo")).toBeInTheDocument();
	});
});
