import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
	StockMovementLedgerRow,
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
};

const MOCK_DETAIL: StockMovementDetail = {
	...MOCK_LEDGER_ROW,
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	reversal_request_id: null,
	is_reversal: false,
	reversed_by_movement_id: null,
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

	it("has query key starting with stock_movements, ledger", async () => {
		vi.mocked(stockMovementsApi.fetchStockMovementLedger).mockResolvedValue([
			MOCK_LEDGER_ROW,
		]);

		const { useStockMovementLedger } = await import("./useStockMovements");
		const { result } = renderHook(() => useStockMovementLedger({}), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// Access the query key through react-query internals
		expect(result.current.data).toEqual([MOCK_LEDGER_ROW]);
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

describe("useReverseStockMovement invalidation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("invalidates ledger, movement detail, material movements, and materials on success", async () => {
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

		const { result } = renderHook(() => useReverseStockMovement(WORKSHOP_ID), {
			wrapper,
		});

		await result.current.mutateAsync({
			movementId: "mov-1",
			materialId: MATERIAL_ID,
			reason: "Error de carga",
		});

		expect(stockMovementsApi.reverseStockMovement).toHaveBeenCalledWith({
			movementId: "mov-1",
			reason: "Error de carga",
		});
		expect(invalidateSpy).toHaveBeenCalledWith(
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
});

describe("useApplyStockMovement invalidation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("invalidates ledger and material queries on success", async () => {
		vi.mocked(stockMovementsApi.applyStockMovement).mockResolvedValue(15);

		const { useApplyStockMovement } = await import("./useStockMovements");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useApplyStockMovement(WORKSHOP_ID), {
			wrapper,
		});

		await result.current.mutateAsync({
			materialId: MATERIAL_ID,
			delta: 5,
			reason: "compra",
		});

		expect(stockMovementsApi.applyStockMovement).toHaveBeenCalledWith({
			materialId: MATERIAL_ID,
			delta: 5,
			reason: "compra",
		});

		// Verify invalidation was called for ledger, materials, and per-material stock
		expect(invalidateSpy).toHaveBeenCalledWith(
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
