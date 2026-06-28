import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn(() => ({
	select: vi.fn(() => ({
		eq: vi.fn(() => ({
			order: vi.fn().mockResolvedValue({ data: [], error: null }),
		})),
	})),
}));

vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		rpc: mockRpc,
		from: mockFrom,
	},
}));

describe("captureApprovedBom", () => {
	beforeEach(() => vi.clearAllMocks());

	it("calls the capture_quote_approved_bom RPC with the correct parameter", async () => {
		mockRpc.mockResolvedValue({ error: null });

		const { captureApprovedBom } = await import("./approvedBom");
		await captureApprovedBom("quote-1");

		expect(mockRpc).toHaveBeenCalledWith("capture_quote_approved_bom", {
			p_quote_id: "quote-1",
		});
	});

	it("throws when the RPC returns an error", async () => {
		mockRpc.mockResolvedValue({ error: new Error("RPC failed") });

		const { captureApprovedBom } = await import("./approvedBom");
		await expect(captureApprovedBom("quote-1")).rejects.toThrow("RPC failed");
	});
});

describe("fetchApprovedBomLines", () => {
	beforeEach(() => vi.clearAllMocks());

	it("queries quote_approved_bom_lines by quote_id ordered by line_number", async () => {
		const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockEq = vi.fn(() => ({ order: mockOrder }));
		const mockSelect = vi.fn(() => ({ eq: mockEq }));
		mockFrom.mockReturnValue({ select: mockSelect });

		const { fetchApprovedBomLines } = await import("./approvedBom");
		await fetchApprovedBomLines("quote-1");

		expect(mockFrom).toHaveBeenCalledWith("quote_approved_bom_lines");
		expect(mockSelect).toHaveBeenCalledWith("*");
		expect(mockEq).toHaveBeenCalledWith("quote_id", "quote-1");
		expect(mockOrder).toHaveBeenCalledWith("line_number", { ascending: true });
	});

	it("throws on query error", async () => {
		const mockOrder = vi
			.fn()
			.mockResolvedValue({ data: null, error: new Error("Query failed") });
		const mockEq = vi.fn(() => ({ order: mockOrder }));
		const mockSelect = vi.fn(() => ({ eq: mockEq }));
		mockFrom.mockReturnValue({ select: mockSelect });

		const { fetchApprovedBomLines } = await import("./approvedBom");

		await expect(fetchApprovedBomLines("quote-1")).rejects.toThrow(
			"Query failed",
		);
	});
});
