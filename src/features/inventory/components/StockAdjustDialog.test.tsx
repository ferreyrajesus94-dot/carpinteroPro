import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../hooks/useStockMovements", () => ({
	useApplyStockMovement: vi.fn(),
}));

vi.mock("@/shared/hooks/useWorkshopId", () => ({
	useWorkshopId: vi.fn(() => "workshop-1"),
}));

import { useApplyStockMovement } from "../hooks/useStockMovements";
import { StockAdjustDialog } from "./StockAdjustDialog";
import type { Material } from "../types";

const BASE_MATERIAL: Material = {
	id: "mat-1",
	workshop_id: "workshop-1",
	name: "Madera MDF 18mm",
	category: "madera",
	unit: "m2",
	price_per_unit: 2500,
	stock: 5,
	min_stock: 2,
	notes: null,
	wood_subtype: "placa",
	length_cm: 244,
	width_cm: 122,
	thickness_cm: 1.8,
	volume_ml: null,
	pack_size: null,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

describe("StockAdjustDialog", () => {
	const mockMutate = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useApplyStockMovement as ReturnType<typeof vi.fn>).mockReturnValue({
			mutate: mockMutate,
			isPending: false,
		});
	});

	it("submitting a valid 'in' movement calls the mutation with correct parameters", () => {
		render(
			<StockAdjustDialog
				material={BASE_MATERIAL}
				onSuccess={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		// Default direction is "in" and reason is "compra"
		const amountInput = screen.getByLabelText(/cantidad/i);
		fireEvent.change(amountInput, { target: { value: "3" } });

		// Submit
		const submitBtn = screen.getByRole("button", {
			name: /guardar movimiento/i,
		});
		fireEvent.click(submitBtn);

		expect(mockMutate).toHaveBeenCalledWith(
			{
				materialId: "mat-1",
				delta: 3,
				reason: "compra",
				note: null,
			},
			expect.any(Object),
		);
	});

	it("submitting an 'out' movement that would result in negative stock displays an error and does not call the mutation", () => {
		render(
			<StockAdjustDialog
				material={BASE_MATERIAL}
				onSuccess={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		// Switch to "out" direction
		const outBtn = screen.getByRole("button", { name: /restar stock/i });
		fireEvent.click(outBtn);

		// Enter amount larger than current stock (5)
		const amountInput = screen.getByLabelText(/cantidad/i);
		fireEvent.change(amountInput, { target: { value: "10" } });

		// The error message should be visible
		expect(screen.getByText(/no puede quedar negativo/i)).toBeInTheDocument();

		// Submit should be disabled
		const submitBtn = screen.getByRole("button", {
			name: /guardar movimiento/i,
		});
		expect(submitBtn).toBeDisabled();

		// Mutation should NOT have been called
		expect(mockMutate).not.toHaveBeenCalled();
	});
});
