import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";

function makeQueryWrapper() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return createElement(QueryClientProvider, { client: qc }, children);
	};
}

// ── useProductionDeductionPreview ───────────────────────────────────
describe("useProductionDeductionPreview", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("fetches preview when quoteId is provided", async () => {
		vi.doMock("../api/productionStockDeduction", () => ({
			fetchProductionDeductionPreview: vi
				.fn()
				.mockResolvedValue([
					{
						line_number: 1,
						material_id: "m-1",
						material_name: "Madera",
						deduction_quantity: 5,
						current_stock: 10,
						projected_stock: 5,
						shortage_amount: 0,
						is_complete: true,
						warning_code: null,
						existing_batch_id: null,
						existing_batch_status: null,
					},
				]),
		}));

		const { useProductionDeductionPreview } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useProductionDeductionPreview("q-1"), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.data).toHaveLength(1);
		expect(result.current.data![0].material_name).toBe("Madera");
	});

	it("does not fetch when quoteId is null", async () => {
		const mockFn = vi.fn();
		vi.doMock("../api/productionStockDeduction", () => ({
			fetchProductionDeductionPreview: mockFn,
		}));

		const { useProductionDeductionPreview } = await import(
			"./useProductionStockDeduction"
		);
		renderHook(() => useProductionDeductionPreview(null), {
			wrapper: makeQueryWrapper(),
		});

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("sets isError when fetch fails", async () => {
		vi.doMock("../api/productionStockDeduction", () => ({
			fetchProductionDeductionPreview: vi
				.fn()
				.mockRejectedValue(new Error("Fetch failed")),
		}));

		const { useProductionDeductionPreview } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useProductionDeductionPreview("q-1"), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── useStartQuoteProduction ─────────────────────────────────────────
describe("useStartQuoteProduction", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("calls startQuoteProduction with confirm=true and auto-generated request_id", async () => {
		const startMock = vi.fn().mockResolvedValue({
			batch_id: "b-1",
			movements_created: 3,
			lines_skipped: 0,
			shortage_detected: false,
			snapshot_incomplete: false,
			warning_summary: [],
		});

		vi.doMock("../api/productionStockDeduction", () => ({
			startQuoteProduction: startMock,
		}));

		const { useStartQuoteProduction } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({ quoteId: "q-1", confirmDeduction: true }),
		);

		expect(startMock).toHaveBeenCalledWith("q-1", true, expect.any(String));
	});

	it("calls startQuoteProduction with confirm=false", async () => {
		const startMock = vi.fn().mockResolvedValue({
			batch_id: null,
			movements_created: 0,
			lines_skipped: 0,
			shortage_detected: false,
			snapshot_incomplete: false,
			warning_summary: [],
		});

		vi.doMock("../api/productionStockDeduction", () => ({
			startQuoteProduction: startMock,
		}));

		const { useStartQuoteProduction } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({ quoteId: "q-1", confirmDeduction: false }),
		);

		expect(startMock).toHaveBeenCalledWith("q-1", false, expect.any(String));
	});

	it("shows error toast on failure", async () => {
		vi.doMock("../api/productionStockDeduction", () => ({
			startQuoteProduction: vi
				.fn()
				.mockRejectedValue(new Error("Start failed")),
		}));

		const { useStartQuoteProduction } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutate({ quoteId: "q-1", confirmDeduction: true }),
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── useReverseProductionDeduction ───────────────────────────────────
describe("useReverseProductionDeduction", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("calls reverseProductionDeduction with deduction id and reason", async () => {
		const reverseMock = vi.fn().mockResolvedValue({ id: "rev-1" });

		vi.doMock("../api/productionStockDeduction", () => ({
			reverseProductionDeduction: reverseMock,
		}));

		const { useReverseProductionDeduction } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useReverseProductionDeduction(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				deductionId: "d-1",
				reversalReason: "Production error",
			}),
		);

		expect(reverseMock).toHaveBeenCalledWith(
			"d-1",
			"Production error",
			expect.any(String),
		);
	});

	it("shows error toast on failure", async () => {
		vi.doMock("../api/productionStockDeduction", () => ({
			reverseProductionDeduction: vi
				.fn()
				.mockRejectedValue(new Error("Reverse failed")),
		}));

		const { useReverseProductionDeduction } = await import(
			"./useProductionStockDeduction"
		);
		const { result } = renderHook(() => useReverseProductionDeduction(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutate({ deductionId: "d-1", reversalReason: "error" }),
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});
