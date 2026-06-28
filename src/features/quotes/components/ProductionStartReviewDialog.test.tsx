import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ProductionStartReviewDialog } from "./ProductionStartReviewDialog";

// Mock the production stock deduction hooks
vi.mock("../hooks/useProductionStockDeduction", () => ({
	useProductionDeductionPreview: vi.fn(),
	useStartQuoteProduction: vi.fn(),
}));

import {
	useProductionDeductionPreview,
	useStartQuoteProduction,
} from "../hooks/useProductionStockDeduction";

const mockUsePreview = vi.mocked(useProductionDeductionPreview);
const mockUseStart = vi.mocked(useStartQuoteProduction);

function makeQueryWrapper() {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return createElement(
			MemoryRouter,
			null,
			createElement(QueryClientProvider, { client: qc }, children),
		);
	};
}

const mockPreviewRows = [
	{
		line_number: 1,
		material_id: "m-1",
		material_name: "Melamina 18mm",
		material_unit: "un",
		material_category: "madera",
		deduction_quantity: 5,
		current_stock: 10,
		projected_stock: 5,
		shortage_amount: 0,
		is_complete: true,
		warning_code: null,
		existing_batch_id: null,
		existing_batch_status: null,
	},
];

const mockStartResult = {
	batch_id: "b-1",
	status: "completed",
	movements_created: 3,
	lines_skipped: 0,
	shortage_detected: false,
	snapshot_incomplete: false,
	warning_summary: [],
};

describe("ProductionStartReviewDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUsePreview.mockReturnValue({
			data: mockPreviewRows,
			isLoading: false,
			isError: false,
		});
		mockUseStart.mockReturnValue({
			mutateAsync: vi.fn().mockResolvedValue(mockStartResult),
			isPending: false,
		} as unknown as ReturnType<typeof useStartQuoteProduction>);
	});

	it("renders loading state when preview is fetching", () => {
		mockUsePreview.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		expect(screen.getByText(/cargando/i)).toBeDefined();
	});

	it("renders preview rows with material name and quantities", () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		expect(screen.getByText("Melamina 18mm")).toBeDefined();
		expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("10")).toBeDefined();
	});

	it("shows shortage warning when projected stock is negative", () => {
		mockUsePreview.mockReturnValue({
			data: [
				{
					...mockPreviewRows[0],
					current_stock: 2,
					projected_stock: -3,
					shortage_amount: 3,
				},
			],
			isLoading: false,
			isError: false,
		});

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		expect(
			screen.getAllByText(/stock insuficiente/i).length,
		).toBeGreaterThanOrEqual(1);
	});

	it("shows incomplete BOM warning when is_complete is false", () => {
		mockUsePreview.mockReturnValue({
			data: [
				{
					...mockPreviewRows[0],
					deduction_quantity: null,
					is_complete: false,
					warning_code: "missing_dimensions",
				},
			],
			isLoading: false,
			isError: false,
		});

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		expect(screen.getByText(/materiales incompletos/i)).toBeDefined();
	});

	it("cancel calls onOpenChange(false) and does not start production", () => {
		const onOpenChange = vi.fn();
		const mutateAsync = vi.fn();
		mockUseStart.mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useStartQuoteProduction>);

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={onOpenChange}
				/>
			</Wrapper>,
		);

		fireEvent.click(screen.getByText(/cancelar/i));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("confirm with autoStockDiscount=true calls startQuoteProduction with confirmDeduction=true and requestId", async () => {
		const mutateAsync = vi.fn().mockResolvedValue(mockStartResult);
		mockUseStart.mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useStartQuoteProduction>);

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
					autoStockDiscount={true}
				/>
			</Wrapper>,
		);

		const confirmButton = screen.getByRole("button", {
			name: /descontar stock/i,
		});
		fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					quoteId: "q-1",
					confirmDeduction: true,
					requestId: expect.any(String),
				}),
			);
		});
	});

	it("confirm with autoStockDiscount=false calls startQuoteProduction with confirmDeduction=false", async () => {
		const mutateAsync = vi.fn().mockResolvedValue(mockStartResult);
		mockUseStart.mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useStartQuoteProduction>);

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
					autoStockDiscount={false}
				/>
			</Wrapper>,
		);

		const confirmButton = screen.getByRole("button", {
			name: /sin descontar stock/i,
		});
		fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					quoteId: "q-1",
					confirmDeduction: false,
					requestId: expect.any(String),
				}),
			);
		});
	});

	it("shows success result after production starts", async () => {
		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
					autoStockDiscount={true}
				/>
			</Wrapper>,
		);

		fireEvent.click(screen.getByRole("button", { name: /descontar stock/i }));

		await waitFor(() => {
			expect(screen.getByText(/producción iniciada/i)).toBeDefined();
			expect(screen.getByText(/3 movimiento/i)).toBeDefined();
			expect(
				screen.getByRole("link", { name: /ver movimientos/i }),
			).toHaveAttribute("href", "/inventory/movements");
		});
	});

	it("shows existing batch info when quote already has a deduction", () => {
		mockUsePreview.mockReturnValue({
			data: [
				{
					...mockPreviewRows[0],
					existing_batch_id: "b-1",
					existing_batch_status: "completed",
				},
			],
			isLoading: false,
			isError: false,
		});

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		expect(screen.getByText(/ya fue iniciada/i)).toBeDefined();
	});

	it("does not show confirm button when quote has existing batch", () => {
		mockUsePreview.mockReturnValue({
			data: [
				{
					...mockPreviewRows[0],
					existing_batch_id: "b-1",
					existing_batch_status: "completed",
				},
			],
			isLoading: false,
			isError: false,
		});

		const Wrapper = makeQueryWrapper();
		render(
			<Wrapper>
				<ProductionStartReviewDialog
					quoteId="q-1"
					quoteNumber="P-001"
					open={true}
					onOpenChange={vi.fn()}
				/>
			</Wrapper>,
		);

		// There should be no "Iniciar" button when batch already exists
		expect(screen.queryByRole("button", { name: /iniciar/i })).toBeNull();
	});
});
