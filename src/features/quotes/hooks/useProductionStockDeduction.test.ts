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
		// PR 9.1 review-blocker fix: reset the globalThis-backed one-time
		// warning marker AND clear all module mocks so each test starts
		// from a clean slate. The previous test only did
		// `vi.resetModules(); vi.clearAllMocks();` which leaves the
		// globalThis flag set from a prior test in the same process —
		// a regression that would mask the one-time warning contract.
		(
			globalThis as { __carpinteroProLegacyStartQuoteWarned?: boolean }
		).__carpinteroProLegacyStartQuoteWarned = undefined;
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

	// PR 9: deprecation warning
	it("emits a one-time-per-session console.warn instructing callers to migrate to useStartProductionOrder", async () => {
		// Reset the globalThis-backed one-time warning marker so we
		// observe the warning emitted (a prior test in the same
		// process may have already set it).
		(
			globalThis as { __carpinteroProLegacyStartQuoteWarned?: boolean }
		).__carpinteroProLegacyStartQuoteWarned = undefined;

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

		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const { useStartQuoteProduction } = await import(
			"./useProductionStockDeduction"
		);

		// First render in this session: the warning fires.
		const { result: result1 } = renderHook(() => useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});
		await act(() =>
			result1.current.mutateAsync({
				quoteId: "q-1",
				confirmDeduction: true,
			}),
		);

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain(
			"useStartQuoteProduction is deprecated",
		);
		expect(warnSpy.mock.calls[0]?.[0]).toContain("useStartProductionOrder");

		// Second render in the same session (no vi.resetModules between
		// renders): the warning is suppressed.
		const { result: result2 } = renderHook(() => useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});
		await act(() =>
			result2.current.mutateAsync({
				quoteId: "q-2",
				confirmDeduction: false,
			}),
		);

		expect(warnSpy).toHaveBeenCalledTimes(1);

		warnSpy.mockRestore();
	});

	// PR 9.1 review-blocker fix: the globalThis-backed one-time warning
	// marker MUST survive `vi.resetModules()` and a re-import of the
	// hook module. A previous review noted that the existing test
	// "claims" resetModules behavior but never actually does it, leaving
	// the global-state contract untested. This test:
	//   1. Imports the module, renders the hook, and asserts the
	//      warning fired (the globalThis flag is set on first call).
	//   2. Calls `vi.resetModules()` to force vitest to drop the module
	//      cache (a fresh module would re-read the globalThis flag).
	//   3. Re-imports the hook module and renders the hook again.
	//   4. Asserts the warning is NOT fired a second time (the
	//      globalThis flag survived the module reset).
	// This pins the contract: the deprecation marker is a globalThis
	// flag, NOT a module-level let (which vi.resetModules() would
	// reset to undefined). A future refactor that switches the marker
	// to a module-level let would fail this test loudly.
	it("emits the deprecation warning only once across vi.resetModules() and a re-import", async () => {
		// Sanity: reset the flag so we observe the first warning.
		(
			globalThis as { __carpinteroProLegacyStartQuoteWarned?: boolean }
		).__carpinteroProLegacyStartQuoteWarned = undefined;

		const startMock = vi.fn().mockResolvedValue({
			batch_id: "b-1",
			movements_created: 0,
			lines_skipped: 0,
			shortage_detected: false,
			snapshot_incomplete: false,
			warning_summary: [],
		});
		vi.doMock("../api/productionStockDeduction", () => ({
			startQuoteProduction: startMock,
		}));

		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		// First import + render: warning fires once.
		const mod1 = await import("./useProductionStockDeduction");
		const { result: r1 } = renderHook(() => mod1.useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});
		await act(() =>
			r1.current.mutateAsync({ quoteId: "q-1", confirmDeduction: true }),
		);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain(
			"useStartQuoteProduction is deprecated",
		);
		expect(warnSpy.mock.calls[0]?.[0]).toContain("useStartProductionOrder");

		// Force vitest to drop the module cache. A module-level let
		// flag would reset to undefined here; the globalThis flag
		// survives because the global object is not part of the
		// module cache.
		vi.resetModules();
		// Re-apply the doMock AFTER resetModules (vitest clears mocks
		// too) so the re-imported module picks up the same mock.
		vi.doMock("../api/productionStockDeduction", () => ({
			startQuoteProduction: startMock,
		}));

		// Second import + render: the globalThis flag is still set,
		// so the warning is suppressed.
		const mod2 = await import("./useProductionStockDeduction");
		const { result: r2 } = renderHook(() => mod2.useStartQuoteProduction(), {
			wrapper: makeQueryWrapper(),
		});
		await act(() =>
			r2.current.mutateAsync({ quoteId: "q-2", confirmDeduction: false }),
		);
		expect(warnSpy).toHaveBeenCalledTimes(1);

		// Reset the globalThis flag for downstream tests in the same
		// file (the parent beforeEach would do this on the next test,
		// but we reset here too so a failure leaves the suite clean).
		(
			globalThis as { __carpinteroProLegacyStartQuoteWarned?: boolean }
		).__carpinteroProLegacyStartQuoteWarned = undefined;
		warnSpy.mockRestore();
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
