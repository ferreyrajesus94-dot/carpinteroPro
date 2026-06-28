import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock the API module — we test hook behavior, not network calls
vi.mock("../api/stockMovements", () => ({
	fetchStockMovementLedger: vi.fn(),
	fetchStockMovementDetail: vi.fn(),
	fetchStockMovements: vi.fn(),
	applyStockMovement: vi.fn(),
	reverseStockMovement: vi.fn(),
}));

import * as stockMovementsApi from "../api/stockMovements";
import type {
	StockMovementDetail,
	StockMovementLedgerFilters,
	StockMovementLedgerRow,
	StockMovementReason,
} from "../api/stockMovements";

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const MATERIAL_ID = "mat-1";

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_LEDGER_ROW: StockMovementLedgerRow = {
	id: "mov-1",
	workshop_id: WORKSHOP_ID,
	material_id: MATERIAL_ID,
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 5,
	reason: "compra",
	note: null,
	quote_id: null,
	quote_number: null,
	created_at: "2026-01-01T00:00:00Z",
	created_by: "user-1",
	creator_name: "User One",
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
};

const MOCK_DETAIL: StockMovementDetail = {
	...MOCK_LEDGER_ROW,
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	reversal_request_id: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
	can_reverse: true,
};

describe("useStockMovementDetail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches one movement detail when enabled", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		const { useStockMovementDetail } = await import("./useStockMovements");
		const { result } = renderHook(() => useStockMovementDetail("mov-1"), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(MOCK_DETAIL);
		expect(stockMovementsApi.fetchStockMovementDetail).toHaveBeenCalledWith(
			"mov-1",
		);
	});

	it("does not fetch detail when movement id is null", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		const { useStockMovementDetail } = await import("./useStockMovements");
		const { result } = renderHook(() => useStockMovementDetail(null), {
			wrapper: makeQueryWrapper(),
		});

		await new Promise((r) => setTimeout(r, 50));

		expect(result.current.isFetching).toBe(false);
		expect(stockMovementsApi.fetchStockMovementDetail).not.toHaveBeenCalled();
	});
});

describe("useStockMovementLedger", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls fetchStockMovementLedger with default filters and returns data", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const { result } = renderHook(() => useStockMovementLedger({}), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([MOCK_LEDGER_ROW]);
		expect(stockMovementsApi.fetchStockMovementLedger).toHaveBeenCalledWith({});
	});

	it("passes filters to the API call", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const { result } = renderHook(
			() =>
				useStockMovementLedger({ reason: "compra", materialId: MATERIAL_ID }),
			{ wrapper: makeQueryWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(stockMovementsApi.fetchStockMovementLedger).toHaveBeenCalledWith({
			reason: "compra",
			materialId: MATERIAL_ID,
		});
	});

	it("does not fetch when enabled is false", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const { result } = renderHook(
			() => useStockMovementLedger({}, { enabled: false }),
			{ wrapper: makeQueryWrapper() },
		);

		// Wait a tick to ensure no fetch fires
		await new Promise((r) => setTimeout(r, 50));

		expect(result.current.isFetching).toBe(false);
		expect(stockMovementsApi.fetchStockMovementLedger).not.toHaveBeenCalled();
	});

	it("uses the canonical query key ['stock_movements', 'ledger', filters]", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const filters = { reason: "compra" as const };
		renderHook(() => useStockMovementLedger(filters), { wrapper });

		await waitFor(() => {
			const all = queryClient
				.getQueryCache()
				.findAll({ queryKey: ["stock_movements", "ledger"] });
			expect(all.length).toBeGreaterThan(0);
		});

		const cached = queryClient
			.getQueryCache()
			.findAll({ queryKey: ["stock_movements", "ledger"] });
		expect(cached[0].queryKey).toEqual(["stock_movements", "ledger", filters]);
	});

	it("creates a new query entry when filters change", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const { rerender } = renderHook(
			({ filters }: { filters: StockMovementLedgerFilters }) =>
				useStockMovementLedger(filters),
			{
				wrapper,
				initialProps: {
					filters: { reason: "compra" as StockMovementReason },
				},
			},
		);

		await waitFor(() => {
			const all = queryClient
				.getQueryCache()
				.findAll({ queryKey: ["stock_movements", "ledger"] });
			expect(all.length).toBe(1);
		});

		rerender({
			filters: { reason: "ajuste" as StockMovementReason },
		});

		await waitFor(() => {
			const all = queryClient
				.getQueryCache()
				.findAll({ queryKey: ["stock_movements", "ledger"] });
			expect(all.length).toBe(2);
		});
	});

	it("returns error when API fails", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockRejectedValue(
			new Error("Network error"),
		);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const { result } = renderHook(() => useStockMovementLedger({}), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});
});

describe("useReverseStockMovement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("takes no workshopId parameter and invalidates per-material, ledger, and detail on success", async () => {
		vi.mocked(stockMovementsApi.reverseStockMovement).mockResolvedValue(
			"rev-1",
		);

		const { useReverseStockMovement } = await import("./useStockMovements");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		// No argument — the hook no longer takes a workshopId
		const { result } = renderHook(() => useReverseStockMovement(), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				movementId: "mov-1",
				materialId: MATERIAL_ID,
				reason: "Error de carga",
			});
		});

		// requestId is auto-generated as a UUID v4
		const callArg = vi.mocked(stockMovementsApi.reverseStockMovement).mock
			.calls[0][0];
		expect(callArg.movementId).toBe("mov-1");
		expect(callArg.reason).toBe("Error de carga");
		expect(callArg.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);

		// The hook no longer invalidates the ['materials', workshopId] bucket
		expect(invalidateSpy).not.toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["materials", WORKSHOP_ID] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["stock_movements", MATERIAL_ID] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["stock_movements", "ledger"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ["stock_movements", "detail", "mov-1"],
			}),
		);
	});

	it("preserves a caller-supplied requestId for cross-process idempotency", async () => {
		vi.mocked(stockMovementsApi.reverseStockMovement).mockResolvedValue(
			"rev-1",
		);

		const { useReverseStockMovement } = await import("./useStockMovements");
		const wrapper = makeQueryWrapper();

		const { result } = renderHook(() => useReverseStockMovement(), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				movementId: "mov-1",
				materialId: MATERIAL_ID,
				reason: "Error de carga",
				requestId: "11111111-2222-4333-8444-555555555555",
			});
		});

		expect(stockMovementsApi.reverseStockMovement).toHaveBeenCalledWith({
			movementId: "mov-1",
			reason: "Error de carga",
			requestId: "11111111-2222-4333-8444-555555555555",
		});
	});
});

describe("useApplyStockMovement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("takes no workshopId parameter and invalidates per-material and ledger on success", async () => {
		vi.mocked(stockMovementsApi.applyStockMovement).mockResolvedValue(15);

		const { useApplyStockMovement } = await import("./useStockMovements");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useApplyStockMovement(), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				materialId: MATERIAL_ID,
				delta: 5,
				reason: "compra",
			});
		});

		expect(stockMovementsApi.applyStockMovement).toHaveBeenCalledWith({
			materialId: MATERIAL_ID,
			delta: 5,
			reason: "compra",
		});

		// The hook no longer invalidates the ['materials', workshopId] bucket
		expect(invalidateSpy).not.toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["materials", WORKSHOP_ID] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["stock_movements", MATERIAL_ID] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["stock_movements", "ledger"] }),
		);
	});
});
