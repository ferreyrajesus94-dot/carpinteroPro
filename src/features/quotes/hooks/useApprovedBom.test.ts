import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("../api/approvedBom", () => ({
	captureApprovedBom: vi.fn().mockResolvedValue(undefined),
	fetchApprovedBomLines: vi.fn().mockResolvedValue([
		{
			id: "bom-1",
			line_number: 1,
			material_name: "Melamina Blanca",
			material_unit: "un",
			material_category: "madera",
			deduction_quantity: 3,
			calculation_method: "direct_quantity",
			is_complete: true,
			warning_code: null,
			calculation_context: {},
		},
	]),
}));

function makeQueryWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			children,
		);
	};
}

describe("useApprovedBomLines", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches approved BOM lines for a quote", async () => {
		const { useApprovedBomLines } = await import("./useApprovedBom");
		const { result } = renderHook(() => useApprovedBomLines("quote-1"), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toHaveLength(1);
		expect(result.current.data![0].material_name).toBe("Melamina Blanca");
		expect(result.current.data![0].deduction_quantity).toBe(3);
	});

	it("does not fetch when quoteId is null", async () => {
		const { fetchApprovedBomLines } = await import("../api/approvedBom");
		const { useApprovedBomLines } = await import("./useApprovedBom");
		const { result } = renderHook(() => useApprovedBomLines(null), {
			wrapper: makeQueryWrapper(),
		});

		expect(result.current.isLoading).toBe(false);
		expect(fetchApprovedBomLines).not.toHaveBeenCalled();
	});
});

describe("useCaptureApprovedBom", () => {
	beforeEach(() => vi.clearAllMocks());

	it("calls captureApprovedBom and invalidates queries on success", async () => {
		const { captureApprovedBom } = await import("../api/approvedBom");
		const { useCaptureApprovedBom } = await import("./useApprovedBom");
		const { result } = renderHook(() => useCaptureApprovedBom(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() => result.current.mutateAsync("quote-1"));

		expect(captureApprovedBom).toHaveBeenCalledWith("quote-1");
	});

	it("shows error toast on failure", async () => {
		const { captureApprovedBom } = await import("../api/approvedBom");
		vi.mocked(captureApprovedBom).mockRejectedValue(
			new Error("BOM capture failed"),
		);

		const { useCaptureApprovedBom } = await import("./useApprovedBom");
		const { result } = renderHook(() => useCaptureApprovedBom(), {
			wrapper: makeQueryWrapper(),
		});

		await act(() => result.current.mutateAsync("quote-1").catch(() => {}));

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});
