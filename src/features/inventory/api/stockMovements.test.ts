import { describe, it, expect, vi, beforeEach } from "vitest";

function makeThenable<T>(result: T): {
	then: (onFulfilled?: (v: T) => unknown) => Promise<unknown>;
} {
	return {
		then: (onFulfilled?: (v: T) => unknown) =>
			Promise.resolve(onFulfilled ? onFulfilled(result) : result),
	};
}

// Module-level mock state
let rpcReturnValue: unknown = makeThenable({ data: [], error: null });
let fromResult: unknown = undefined;
const rpcCallHistory: { args: unknown[][] } = { args: [] };

vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		rpc: (...args: unknown[]) => {
			rpcCallHistory.args.push(args);
			return rpcReturnValue as {
				then: (fn?: (v: unknown) => unknown) => Promise<unknown>;
			};
		},
		from: () => fromResult,
	},
}));

import {
	fetchStockMovementLedger,
	applyStockMovement,
	fetchStockMovements,
	fetchStockMovementDetail,
	reverseStockMovement,
} from "./stockMovements";
import type { StockMovementReason } from "./stockMovements";

function setRpcReturn(value: unknown) {
	rpcReturnValue = value;
}

function resetMocks() {
	rpcReturnValue = makeThenable({ data: [], error: null });
	rpcCallHistory.args = [];
	fromResult = undefined;
}

describe("fetchStockMovementLedger", () => {
	beforeEach(() => {
		resetMocks();
	});

	it("calls rpc with all filters defaulted to null and default limit/offset", async () => {
		setRpcReturn(makeThenable({ data: [], error: null }));
		await fetchStockMovementLedger({});

		expect(rpcCallHistory.args[0][0]).toBe("get_stock_movement_ledger");
		expect(rpcCallHistory.args[0][1]).toEqual({
			p_reason: null,
			p_material_id: null,
			p_creator_id: null,
			p_from: null,
			p_to: null,
			p_search: null,
			p_limit: 50,
			p_offset: 0,
		});
	});

	it("passes provided filters and defaults absent ones to null", async () => {
		setRpcReturn(makeThenable({ data: [], error: null }));
		await fetchStockMovementLedger({
			reason: "compra" as StockMovementReason,
			materialId: "abc",
		});

		expect(rpcCallHistory.args[0][0]).toBe("get_stock_movement_ledger");
		expect(rpcCallHistory.args[0][1]).toEqual({
			p_reason: "compra",
			p_material_id: "abc",
			p_creator_id: null,
			p_from: null,
			p_to: null,
			p_search: null,
			p_limit: 50,
			p_offset: 0,
		});
	});

	it("normalizes date-only end filters to an exclusive next-day timestamp", async () => {
		setRpcReturn(makeThenable({ data: [], error: null }));
		await fetchStockMovementLedger({
			from: "2026-06-01",
			to: "2026-06-25",
		});

		expect(rpcCallHistory.args[0][1]).toMatchObject({
			p_from: "2026-06-01",
			p_to: "2026-06-26T00:00:00.000Z",
		});
	});

	it("throws the Supabase error when rpc returns an error", async () => {
		const testError = new Error("Database error");
		setRpcReturn(makeThenable({ data: null, error: testError }));

		await expect(fetchStockMovementLedger({})).rejects.toThrow(
			"Database error",
		);
	});

	it("returns the data array on success", async () => {
		const testData = [
			{
				id: "1",
				workshop_id: "ws-1",
				material_id: "mat-1",
				material_name: "Test",
				material_unit: "un" as const,
				delta: 5,
				reason: "compra" as const,
				note: null,
				quote_id: null,
				quote_number: null,
				created_at: "2026-01-01",
				created_by: "user-1",
				creator_name: "User 1",
			},
		];
		setRpcReturn(makeThenable({ data: testData, error: null }));

		const result = await fetchStockMovementLedger({});

		expect(result).toEqual(testData);
	});
});

describe("fetchStockMovementDetail", () => {
	beforeEach(() => {
		resetMocks();
	});

	it("calls detail rpc with the movement id", async () => {
		setRpcReturn(makeThenable({ data: [], error: null }));

		await fetchStockMovementDetail("mov-1");

		expect(rpcCallHistory.args[0][0]).toBe("get_stock_movement_detail");
		expect(rpcCallHistory.args[0][1]).toEqual({ p_movement_id: "mov-1" });
	});

	it("returns the first detail row on success", async () => {
		const detail = {
			id: "mov-1",
			workshop_id: "ws-1",
			material_id: "mat-1",
			material_name: "MDF",
			material_unit: "un" as const,
			delta: 5,
			reason: "compra" as const,
			note: null,
			quote_id: null,
			quote_number: null,
			created_at: "2026-01-01",
			created_by: "user-1",
			creator_name: "User 1",
			reversal_of_movement_id: null,
			reversal_reason: null,
			reversed_original_reason: null,
			reversal_request_id: null,
			is_reversal: false,
			reversed_by_movement_id: null,
			can_reverse: true,
		};
		setRpcReturn(makeThenable({ data: [detail], error: null }));

		const result = await fetchStockMovementDetail("mov-1");

		expect(result).toEqual(detail);
	});

	it("returns null when detail rpc returns no rows", async () => {
		setRpcReturn(makeThenable({ data: [], error: null }));

		await expect(fetchStockMovementDetail("missing")).resolves.toBeNull();
	});

	it("throws the Supabase error when detail rpc returns an error", async () => {
		const testError = new Error("Forbidden");
		setRpcReturn(makeThenable({ data: null, error: testError }));

		await expect(fetchStockMovementDetail("mov-1")).rejects.toThrow(
			"Forbidden",
		);
	});
});

describe("reverseStockMovement", () => {
	beforeEach(() => {
		resetMocks();
	});

	it("calls reversal rpc with reason and default request id", async () => {
		setRpcReturn(makeThenable({ data: "rev-1", error: null }));

		await reverseStockMovement({ movementId: "mov-1", reason: "Error" });

		expect(rpcCallHistory.args[0][0]).toBe("reverse_stock_movement");
		expect(rpcCallHistory.args[0][1]).toEqual({
			p_movement_id: "mov-1",
			p_reversal_reason: "Error",
			p_reversal_request_id: null,
		});
	});

	it("passes request id for idempotent retries", async () => {
		setRpcReturn(makeThenable({ data: "rev-1", error: null }));

		await reverseStockMovement({
			movementId: "mov-1",
			reason: "Error",
			requestId: "request-1",
		});

		expect(rpcCallHistory.args[0][1]).toMatchObject({
			p_reversal_request_id: "request-1",
		});
	});

	it("throws when reversal rpc fails", async () => {
		setRpcReturn(makeThenable({ data: null, error: new Error("Not allowed") }));

		await expect(
			reverseStockMovement({ movementId: "mov-1", reason: "Error" }),
		).rejects.toThrow("Not allowed");
	});

	it("returns the reversal movement id", async () => {
		setRpcReturn(makeThenable({ data: "rev-1", error: null }));

		const result = await reverseStockMovement({
			movementId: "mov-1",
			reason: "Error",
		});

		expect(result).toBe("rev-1");
	});
});

describe("applyStockMovement", () => {
	beforeEach(() => {
		resetMocks();
	});

	it("calls rpc with correct parameter mapping", async () => {
		setRpcReturn(makeThenable({ data: 15, error: null }));

		await applyStockMovement({
			materialId: "mat-1",
			delta: 5,
			reason: "compra" as StockMovementReason,
		});

		expect(rpcCallHistory.args[0][0]).toBe("apply_stock_movement");
		expect(rpcCallHistory.args[0][1]).toEqual({
			p_material_id: "mat-1",
			p_delta: 5,
			p_reason: "compra",
			p_note: null,
			p_quote_id: null,
		});
	});

	it("throws on Supabase error", async () => {
		const testError = new Error("RPC failed");
		setRpcReturn(makeThenable({ data: null, error: testError }));

		await expect(
			applyStockMovement({
				materialId: "mat-1",
				delta: 5,
				reason: "compra" as StockMovementReason,
			}),
		).rejects.toThrow("RPC failed");
	});

	it("returns the new stock level on success", async () => {
		setRpcReturn(makeThenable({ data: 15, error: null }));

		const result = await applyStockMovement({
			materialId: "mat-1",
			delta: 5,
			reason: "compra" as StockMovementReason,
		});

		expect(result).toBe(15);
	});
});

describe("fetchStockMovements", () => {
	beforeEach(() => {
		resetMocks();
		// Default: empty success
		const limitFn = vi.fn(() => makeThenable({ data: [], error: null }));
		const orderFn = vi.fn(() => ({ limit: limitFn }));
		const eqFn = vi.fn(() => ({ order: orderFn }));
		fromResult = { select: vi.fn(() => ({ eq: eqFn })) };
	});

	it("calls from with correct table and filter and a bounded limit", async () => {
		const limitFn = vi.fn(() => makeThenable({ data: [], error: null }));
		const orderFn = vi.fn(() => ({ limit: limitFn }));
		const eqFn = vi.fn(() => ({ order: orderFn }));
		const selectFn = vi.fn(() => ({ eq: eqFn }));
		fromResult = { select: selectFn };

		await fetchStockMovements("mat-1");

		expect(selectFn).toHaveBeenCalledWith("*");
		expect(eqFn).toHaveBeenCalledWith("material_id", "mat-1");
		expect(orderFn).toHaveBeenCalledWith("created_at", { ascending: false });
		expect(limitFn).toHaveBeenCalledWith(200);
	});

	it("throws on Supabase error", async () => {
		const limitFn = vi.fn(() =>
			makeThenable({ data: null, error: new Error("DB error") }),
		);
		const orderFn = vi.fn(() => ({ limit: limitFn }));
		const eqFn = vi.fn(() => ({ order: orderFn }));
		const selectFn = vi.fn(() => ({ eq: eqFn }));
		fromResult = { select: selectFn };

		await expect(fetchStockMovements("mat-1")).rejects.toThrow("DB error");
	});

	it("returns data array on success", async () => {
		const testData = [
			{
				id: "1",
				workshop_id: "ws-1",
				material_id: "mat-1",
				delta: 5,
				reason: "compra",
				note: null,
				quote_id: null,
				created_at: "2026-01-01",
				created_by: null,
			},
		];
		const limitFn = vi.fn(() => makeThenable({ data: testData, error: null }));
		const orderFn = vi.fn(() => ({ limit: limitFn }));
		const eqFn = vi.fn(() => ({ order: orderFn }));
		const selectFn = vi.fn(() => ({ eq: eqFn }));
		fromResult = { select: selectFn };

		const result = await fetchStockMovements("mat-1");
		expect(result).toEqual(testData);
	});
});
