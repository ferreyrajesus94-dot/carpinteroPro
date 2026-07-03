import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { QuoteWithExtras } from "../types";

vi.mock("../api/quotes", () => ({
	fetchQuotes: vi.fn(),
	fetchQuote: vi.fn(),
	createQuote: vi.fn(),
	updateQuote: vi.fn(),
	updateQuoteStatus: vi.fn(),
	deleteQuote: vi.fn(),
	generateQuoteNumber: vi.fn(),
}));

vi.mock("../api/approvedBom", () => ({
	captureApprovedBom: vi.fn().mockResolvedValue(undefined),
	fetchApprovedBomLines: vi.fn().mockResolvedValue([]),
}));

import * as quotesApi from "../api/quotes";
import * as approvedBomApi from "../api/approvedBom";

// ensure approvedBomApi is accessible for assertions

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_QUOTES: QuoteWithExtras[] = [
	{
		id: "q-1",
		workshop_id: WORKSHOP_ID,
		quote_number: "P-0001",
		client_id: null,
		furniture_template_id: null,
		furniture_name: "Ropero 2 puertas",
		recipe_cost: 10000,
		status: "presupuesto",
		margin_mode: "on_cost",
		margin_pct: 30,
		notes: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		extras: [],
		client: null,
	},
	{
		id: "q-2",
		workshop_id: WORKSHOP_ID,
		quote_number: "P-0002",
		client_id: "cli-1",
		furniture_template_id: null,
		furniture_name: "Mesa comedor",
		recipe_cost: 25000,
		status: "aprobado",
		margin_mode: "on_price",
		margin_pct: 40,
		notes: "Patas de roble",
		created_at: "2026-01-02T00:00:00Z",
		updated_at: "2026-01-02T00:00:00Z",
		extras: [
			{
				id: "ex-1",
				workshop_id: "00000000-0000-0000-0000-000000000001",
				quote_id: "q-2",
				description: "Barniz",
				amount: 2000,
				show_in_quote: true,
				sort_order: 0,
			},
		],
		client: null,
	},
];

describe("useQuotes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns quotes from the API", async () => {
		vi.mocked(quotesApi.fetchQuotes).mockResolvedValue(MOCK_QUOTES);

		const { useQuotes } = await import("./useQuotes");
		const { result } = renderHook(() => useQuotes(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(MOCK_QUOTES);
		expect(quotesApi.fetchQuotes).toHaveBeenCalledWith(WORKSHOP_ID);
	});

	it("returns empty array when API returns nothing", async () => {
		vi.mocked(quotesApi.fetchQuotes).mockResolvedValue([]);

		const { useQuotes } = await import("./useQuotes");
		const { result } = renderHook(() => useQuotes(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([]);
	});

	it("returns error when API fails", async () => {
		vi.mocked(quotesApi.fetchQuotes).mockRejectedValue(
			new Error("Network error"),
		);

		const { useQuotes } = await import("./useQuotes");
		const { result } = renderHook(() => useQuotes(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("does not fetch when workshopId is empty", async () => {
		const { useQuotes } = await import("./useQuotes");
		const { result } = renderHook(() => useQuotes(""), {
			wrapper: makeQueryWrapper(),
		});

		// query is disabled, stays pending
		expect(result.current.isPending).toBe(true);
		expect(quotesApi.fetchQuotes).not.toHaveBeenCalled();
	});
});

describe("useGenerateQuoteNumber", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the next quote number from the API", async () => {
		vi.mocked(quotesApi.generateQuoteNumber).mockResolvedValue("P-0003");

		const { useGenerateQuoteNumber } = await import("./useQuotes");
		const { result } = renderHook(() => useGenerateQuoteNumber(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toBe("P-0003");
	});
});

// ── useCreateQuote ────────────────────────────────────────────────────────
describe("useCreateQuote", () => {
	beforeEach(() => vi.clearAllMocks());

	it("calls createQuote with quote and extras", async () => {
		vi.mocked(quotesApi.createQuote).mockResolvedValue("q-new");

		const { useCreateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useCreateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		const payload = {
			quote: {
				workshop_id: WORKSHOP_ID,
				quote_number: "P-0003",
				furniture_name: "Mesa comedor",
				recipe_cost: 15_000,
				margin_mode: "on_cost" as const,
				margin_pct: 30,
				status: "presupuesto" as const,
				client_id: null,
				furniture_template_id: null,
				notes: null,
			},
			extras: [
				{
					description: "Barniz",
					amount: 500,
					show_in_quote: true,
					sort_order: 0,
				},
			],
		};

		await act(() => result.current.mutateAsync(payload));

		expect(quotesApi.createQuote).toHaveBeenCalledWith(
			payload.quote,
			payload.extras,
			[],
			[],
		);
	});

	it("sets isError when API fails", async () => {
		vi.mocked(quotesApi.createQuote).mockRejectedValue(
			new Error("Insert failed"),
		);

		const { useCreateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useCreateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutate({
				quote: {
					workshop_id: WORKSHOP_ID,
					quote_number: "P-0003",
					furniture_name: "X",
					recipe_cost: 0,
					margin_mode: "on_cost",
					margin_pct: 0,
					status: "presupuesto",
					client_id: null,
					furniture_template_id: null,
					notes: null,
				},
				extras: [],
			}),
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
	});
});

// ── useUpdateQuote — cambio de estado a "enviado" ─────────────────────────
describe("useUpdateQuote", () => {
	beforeEach(() => vi.clearAllMocks());

	it('can update a quote status to "enviado" without calling stock movement', async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				quote: { status: "enviado" },
				extras: [],
			}),
		);

		expect(quotesApi.updateQuote).toHaveBeenCalledWith(
			"q-1",
			{ status: "enviado" },
			[],
			[],
			[],
		);
		// No stock movement RPC was called
		expect(quotesApi.updateQuote).toHaveBeenCalledTimes(1);
	});

	it("can update quote with new extras", async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		const newExtras = [
			{
				description: "Transporte",
				amount: 1_000,
				show_in_quote: true,
				sort_order: 0,
			},
		];

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				quote: { margin_pct: 35 },
				extras: newExtras,
			}),
		);

		expect(quotesApi.updateQuote).toHaveBeenCalledWith(
			"q-1",
			{ margin_pct: 35 },
			newExtras,
			[],
			[],
		);
	});

	it("sets isError when API fails", async () => {
		vi.mocked(quotesApi.updateQuote).mockRejectedValue(
			new Error("Update failed"),
		);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutate({
				id: "q-1",
				quote: { status: "enviado" },
				extras: [],
			}),
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	it('captures approved BOM when status is "aprobado" in full edit', async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);
		vi.mocked(approvedBomApi.captureApprovedBom).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		const snapshots = [
			{
				material_id: "mat-1",
				material_name: "Melamina",
				material_unit: "un",
				material_category: "madera",
				quantity: 2,
				price_per_unit: 1500,
			},
		];

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				quote: { status: "aprobado" },
				extras: [],
				recipeSnapshots: snapshots,
			}),
		);

		expect(quotesApi.updateQuote).toHaveBeenCalledWith(
			"q-1",
			{ status: "aprobado" },
			[],
			snapshots,
			[],
		);
		expect(approvedBomApi.captureApprovedBom).toHaveBeenCalledWith("q-1");
	});

	// PR 6 blocker-fix: the full-edit path (`useUpdateQuote` /
	// `updateQuote` / `QuoteForm`) can submit a `QuoteUpdate` containing
	// `status: "en_produccion"`. The status-only path was already guarded
	// in PR 6 (see `useUpdateQuoteStatus` tests above), but the
	// full-edit path bypasses that guard. This hook-level guard closes
	// the leak at the application layer (the SQL defense-in-depth trigger
	// is the second line of defense; see
	// `prevent_direct_en_produccion_writes()` in
	// `supabase/migrations/20260630000001_production_orders_rpc.sql`).
	it('rejects full-edit updates with status "en_produccion" and does not call updateQuote', async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(async () => {
			await expect(
				result.current.mutateAsync({
					id: "q-1",
					quote: { status: "en_produccion" },
					extras: [],
				}),
			).rejects.toThrow(/en_produccion/);
		});

		// The API was never touched.
		expect(quotesApi.updateQuote).not.toHaveBeenCalled();
		// BOM capture is irrelevant to a rejected call.
		expect(approvedBomApi.captureApprovedBom).not.toHaveBeenCalled();
	});

	// TRIANGULATE: the rejection error message tells the caller where to
	// go instead (the new `useStartProductionOrder` flow in the
	// production feature).
	it('rejection error for full-edit "en_produccion" mentions the start-production flow', async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(async () => {
			await expect(
				result.current.mutateAsync({
					id: "q-1",
					quote: {
						status: "en_produccion",
						margin_pct: 30,
					},
					extras: [],
				}),
			).rejects.toThrow(/start_production_order|producci[oó]n/i);
		});
	});

	// SAFETY NET: every other status (including the production-derived
	// `entregado` and `cancelado`) must still flow through the full-edit
	// path unchanged. This guarantees the guard is targeted and does
	// not over-block legitimate status transitions.
	it.each([
		"presupuesto",
		"enviado",
		"aprobado",
		"entregado",
		"cancelado",
	] as const)(
		"allows full-edit updates with status %s (no en_produccion regression)",
		async (status) => {
			vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

			const { useUpdateQuote } = await import("./useQuotes");
			const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
				wrapper: makeQueryWrapper(),
			});

			await act(() =>
				result.current.mutateAsync({
					id: "q-1",
					quote: { status },
					extras: [],
				}),
			);

			expect(quotesApi.updateQuote).toHaveBeenCalledWith(
				"q-1",
				{ status },
				[],
				[],
				[],
			);
		},
	);

	// SAFETY NET: full-edit with no status field at all must still work
	// (the user is editing other fields like margin, furniture name, etc.,
	// and the form does not always send status on a full edit).
	it("allows full-edit updates that omit the status field", async () => {
		vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined);

		const { useUpdateQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				quote: { margin_pct: 35 },
				extras: [],
			}),
		);

		expect(quotesApi.updateQuote).toHaveBeenCalledWith(
			"q-1",
			{ margin_pct: 35 },
			[],
			[],
			[],
		);
	});
});

// ── useUpdateQuoteStatus — status-only changes ─────────────────────────
describe("useUpdateQuoteStatus", () => {
	beforeEach(() => vi.clearAllMocks());

	it('can update a quote status to "aprobado" and captures approved BOM', async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockResolvedValue(undefined);
		vi.mocked(approvedBomApi.captureApprovedBom).mockResolvedValue(undefined);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				status: "aprobado",
			}),
		);

		expect(quotesApi.updateQuoteStatus).toHaveBeenCalledWith("q-1", "aprobado");
		// BOM capture called after status update
		expect(approvedBomApi.captureApprovedBom).toHaveBeenCalledWith("q-1");
		expect(approvedBomApi.captureApprovedBom).toHaveBeenCalledTimes(1);
		// No stock movement called
		expect(quotesApi.updateQuote).not.toHaveBeenCalled();
	});

	// PR 6: direct writes of en_produccion are rejected. The status
	// "en_produccion" is now derived at the read layer from the
	// production_orders state machine (see get_quotes_with_production_status
	// RPC). Setting it via updateQuoteStatus would bypass the start
	// production order flow and the SQL defense-in-depth triggers. The
	// hook therefore throws synchronously and never touches the API.
	it('rejects "en_produccion" with a helpful error and does not call updateQuoteStatus', async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockResolvedValue(undefined);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(async () => {
			await expect(
				result.current.mutateAsync({
					id: "q-1",
					status: "en_produccion",
				}),
			).rejects.toThrow(/en_produccion/);
		});

		expect(quotesApi.updateQuoteStatus).not.toHaveBeenCalled();
		expect(approvedBomApi.captureApprovedBom).not.toHaveBeenCalled();
	});

	// TRIANGULATE: the error message tells the user where to go instead.
	it('rejection error for "en_produccion" mentions the start-production flow', async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockResolvedValue(undefined);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(async () => {
			await expect(
				result.current.mutateAsync({
					id: "q-2",
					status: "en_produccion",
				}),
			).rejects.toThrow(/start_production_order|producci[oó]n/i);
		});
	});

	it("sets isError when API fails", async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockRejectedValue(
			new Error("Update failed"),
		);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() => result.current.mutate({ id: "q-1", status: "cancelado" }));

		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	// TRIANGULATE: snapshot preservation
	it('preserves existing snapshots when updating status to "aprobado" (does not call replaceSnapshots)', async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockResolvedValue(undefined);
		vi.mocked(approvedBomApi.captureApprovedBom).mockResolvedValue(undefined);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "q-1",
				status: "aprobado",
			}),
		);

		// The status-only path calls updateQuoteStatus (not updateQuote) plus BOM capture
		expect(quotesApi.updateQuoteStatus).toHaveBeenCalledWith("q-1", "aprobado");
		expect(quotesApi.updateQuote).not.toHaveBeenCalled();
		expect(approvedBomApi.captureApprovedBom).toHaveBeenCalledWith("q-1");
	});

	it("preserves existing snapshots when updating status to non-approval, non-production status", async () => {
		vi.mocked(quotesApi.updateQuoteStatus).mockResolvedValue(undefined);

		const { useUpdateQuoteStatus } = await import("./useQuotes");
		const { result } = renderHook(() => useUpdateQuoteStatus(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "q-2",
				status: "cancelado",
			}),
		);

		expect(quotesApi.updateQuoteStatus).toHaveBeenCalledWith("q-2", "cancelado");
		expect(quotesApi.updateQuote).not.toHaveBeenCalled();
		// BOM capture NOT called for non-approval transition
		expect(approvedBomApi.captureApprovedBom).not.toHaveBeenCalled();
	});
});

// ── useDeleteQuote ────────────────────────────────────────────────────────
describe("useDeleteQuote", () => {
	beforeEach(() => vi.clearAllMocks());

	it("calls deleteQuote with the quote id", async () => {
		vi.mocked(quotesApi.deleteQuote).mockResolvedValue(undefined);

		const { useDeleteQuote } = await import("./useQuotes");
		const { result } = renderHook(() => useDeleteQuote(WORKSHOP_ID), {
			wrapper: makeQueryWrapper(),
		});

		await act(() => result.current.mutateAsync("q-1"));

		expect(quotesApi.deleteQuote).toHaveBeenCalledWith("q-1");
	});
});
