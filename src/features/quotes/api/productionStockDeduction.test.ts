import { beforeEach, describe, expect, it, vi } from "vitest";

// ── fetchProductionDeductionPreview ──────────────────────────────────
describe("fetchProductionDeductionPreview", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("calls get_quote_production_deduction_preview RPC with quote id", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: [
				{
					line_number: 1,
					material_id: "m-1",
					material_name: "Madera",
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
			],
			error: null,
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { fetchProductionDeductionPreview } = await import(
			"../api/productionStockDeduction"
		);
		const result = await fetchProductionDeductionPreview("q-1");

		expect(mockRpc).toHaveBeenCalledWith(
			"get_quote_production_deduction_preview",
			{
				p_quote_id: "q-1",
			},
		);
		expect(result).toHaveLength(1);
		expect(result[0].material_name).toBe("Madera");
	});

	it("throws when RPC returns an error", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: null,
			error: new Error("RPC failed"),
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { fetchProductionDeductionPreview } = await import(
			"../api/productionStockDeduction"
		);
		await expect(fetchProductionDeductionPreview("q-1")).rejects.toThrow(
			"RPC failed",
		);
	});

	it("returns empty array when data is null", async () => {
		const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { fetchProductionDeductionPreview } = await import(
			"../api/productionStockDeduction"
		);
		const result = await fetchProductionDeductionPreview("q-1");
		expect(result).toEqual([]);
	});
});

// ── startQuoteProduction ────────────────────────────────────────────
describe("startQuoteProduction", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("calls start_quote_production RPC with confirm=true", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: {
				batch_id: "b-1",
				movements_created: 3,
				lines_skipped: 0,
				shortage_detected: false,
				snapshot_incomplete: false,
				warning_summary: [],
			},
			error: null,
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { startQuoteProduction } = await import(
			"../api/productionStockDeduction"
		);
		const result = await startQuoteProduction("q-1", true);

		expect(mockRpc).toHaveBeenCalledWith("start_quote_production", {
			p_quote_id: "q-1",
			p_confirm_deduction: true,
			p_request_id: undefined,
		});
		expect(result.batch_id).toBe("b-1");
	});

	it("calls start_quote_production RPC with confirm=false", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: {
				batch_id: null,
				movements_created: 0,
				lines_skipped: 0,
				shortage_detected: false,
				snapshot_incomplete: false,
				warning_summary: [],
			},
			error: null,
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { startQuoteProduction } = await import(
			"../api/productionStockDeduction"
		);
		const result = await startQuoteProduction("q-1", false);

		expect(mockRpc).toHaveBeenCalledWith("start_quote_production", {
			p_quote_id: "q-1",
			p_confirm_deduction: false,
			p_request_id: undefined,
		});
		expect(result.movements_created).toBe(0);
	});

	it("passes request_id for idempotent retry", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: {
				batch_id: "b-1",
				movements_created: 3,
				lines_skipped: 0,
				shortage_detected: false,
				snapshot_incomplete: false,
				warning_summary: [],
			},
			error: null,
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const requestId = crypto.randomUUID();
		const { startQuoteProduction } = await import(
			"../api/productionStockDeduction"
		);
		await startQuoteProduction("q-1", true, requestId);

		expect(mockRpc).toHaveBeenCalledWith("start_quote_production", {
			p_quote_id: "q-1",
			p_confirm_deduction: true,
			p_request_id: requestId,
		});
	});

	it("throws when RPC returns an error", async () => {
		const mockRpc = vi.fn().mockResolvedValue({
			data: null,
			error: new Error("Production start failed"),
		});

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { startQuoteProduction } = await import(
			"../api/productionStockDeduction"
		);
		await expect(startQuoteProduction("q-1", true)).rejects.toThrow(
			"Production start failed",
		);
	});
});

// ── reverseProductionDeduction ──────────────────────────────────────
describe("reverseProductionDeduction", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("calls reverse_production_stock_deduction RPC with deduction id and reason", async () => {
		const mockRpc = vi.fn().mockResolvedValue({ data: "rev-1", error: null });

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { reverseProductionDeduction } = await import(
			"../api/productionStockDeduction"
		);
		const result = await reverseProductionDeduction("d-1", "Production error");

		expect(mockRpc).toHaveBeenCalledWith("reverse_production_stock_deduction", {
			p_deduction_id: "d-1",
			p_reversal_reason: "Production error",
			p_reversal_request_id: undefined,
		});
		expect(result).toEqual({ id: "rev-1" });
	});

	it("passes reversal_request_id for idempotency", async () => {
		const mockRpc = vi.fn().mockResolvedValue({ data: "rev-1", error: null });

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const requestId = crypto.randomUUID();
		const { reverseProductionDeduction } = await import(
			"../api/productionStockDeduction"
		);
		await reverseProductionDeduction("d-1", "error", requestId);

		expect(mockRpc).toHaveBeenCalledWith("reverse_production_stock_deduction", {
			p_deduction_id: "d-1",
			p_reversal_reason: "error",
			p_reversal_request_id: requestId,
		});
	});

	it("throws when RPC returns an error", async () => {
		const mockRpc = vi
			.fn()
			.mockResolvedValue({ data: null, error: new Error("Reverse failed") });

		vi.doMock("@/shared/lib/supabase", () => ({
			supabase: { rpc: mockRpc },
		}));

		const { reverseProductionDeduction } = await import(
			"../api/productionStockDeduction"
		);
		await expect(reverseProductionDeduction("d-1", "error")).rejects.toThrow(
			"Reverse failed",
		);
	});
});
