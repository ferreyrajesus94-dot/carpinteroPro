import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("../api/productionOrders", () => ({
	listProductionOrders: vi.fn(),
	getProductionOrder: vi.fn(),
	getProductionOrderEvents: vi.fn(),
	getQuotesWithProductionStatus: vi.fn(),
	getProductionPipelineStats: vi.fn(),
	startProductionOrder: vi.fn(),
	transitionProductionOrderState: vi.fn(),
}));

// NOTE: the `isPersistableQueryKey` policy is NOT mocked here. The
// cache-privacy contract is exercised in
// `useProductionOrders.cachePrivacy.test.ts`, which imports the real
// policy and would catch a future change that allowed production
// query keys to be persisted.

import * as api from "../api/productionOrders";
import {
	PRODUCTION_ORDER_STATE,
	type ProductionOrderState,
} from "../api/types";

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";

const SAMPLE_LIST_ROW = {
	id: ORDER_ID,
	workshop_id: WORKSHOP_ID,
	quote_id: QUOTE_ID,
	production_number: "OP-2026-0001",
	state: "planned" as ProductionOrderState,
	planned_start_date: "2026-07-01",
	planned_end_date: "2026-07-10",
	actual_start_date: null,
	actual_end_date: null,
	assigned_to: ACTOR_ID,
	notes: "Sample order",
	created_at: "2026-06-30T10:00:00Z",
	updated_at: "2026-06-30T10:00:00Z",
	quote_number: "Q-2026-0001",
	quote_furniture_name: "Mesa de roble",
	assigned_to_name: "Jane Doe",
};

const SAMPLE_DETAIL_ROW = {
	...SAMPLE_LIST_ROW,
	quote_status: "aprobado" as const,
	quote_client_id: "55555555-5555-4555-8555-555555555555",
	quote_client_name: "Acme SRL",
};

const SAMPLE_EVENT_ROW = {
	id: EVENT_ID,
	workshop_id: WORKSHOP_ID,
	production_order_id: ORDER_ID,
	event_type: "created" as const,
	from_state: null as ProductionOrderState | null,
	to_state: "planned" as ProductionOrderState,
	reason: "production order created",
	note: "production order created",
	actor_id: ACTOR_ID,
	metadata: { request_id: "req-1", operation: "start" },
	created_at: "2026-06-30T10:00:00Z",
	actor_name: "Jane Doe",
};

const SAMPLE_QUOTE_WITH_PROD_ROW = {
	id: QUOTE_ID,
	workshop_id: WORKSHOP_ID,
	quote_number: "Q-2026-0001",
	furniture_name: "Mesa de roble",
	client_id: "55555555-5555-4555-8555-555555555555",
	client_name: "Acme SRL",
	stored_status: "aprobado" as const,
	production_status: "en_produccion" as const,
	has_active_production: true,
	last_event_at: "2026-06-30T10:00:00Z",
};

const SAMPLE_PIPELINE_ROW = { state: "planned" as ProductionOrderState, count: 3 };

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useProductionOrders", () => {
	it("calls listProductionOrders with provided filters and returns data", async () => {
		vi.mocked(api.listProductionOrders).mockResolvedValue([SAMPLE_LIST_ROW]);

		const { useProductionOrders } = await import("./useProductionOrders");
		const { result } = renderHook(
			() =>
				useProductionOrders({
					states: ["planned", "in_progress"],
					search: "OP-2026",
				}),
			{ wrapper: makeQueryWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([SAMPLE_LIST_ROW]);
		expect(api.listProductionOrders).toHaveBeenCalledWith({
			states: ["planned", "in_progress"],
			search: "OP-2026",
		});
	});

	it("uses the canonical query key ['production_orders', 'list', filters]", async () => {
		vi.mocked(api.listProductionOrders).mockResolvedValue([SAMPLE_LIST_ROW]);

		const { useProductionOrders } = await import("./useProductionOrders");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const filters = { states: ["planned" as const] };
		renderHook(() => useProductionOrders(filters), { wrapper });

		await waitFor(() => {
			const all = queryClient
				.getQueryCache()
				.findAll({ queryKey: ["production_orders", "list"] });
			expect(all.length).toBeGreaterThan(0);
		});

		const cached = queryClient
			.getQueryCache()
			.findAll({ queryKey: ["production_orders", "list"] });
		expect(cached[0].queryKey).toEqual([
			"production_orders",
			"list",
			filters,
		]);
	});
});

describe("useProductionOrder", () => {
	it("calls getProductionOrder with the id and returns the detail row", async () => {
		vi.mocked(api.getProductionOrder).mockResolvedValue(SAMPLE_DETAIL_ROW);

		const { useProductionOrder } = await import("./useProductionOrders");
		const { result } = renderHook(() => useProductionOrder(ORDER_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(SAMPLE_DETAIL_ROW);
		expect(api.getProductionOrder).toHaveBeenCalledWith(ORDER_ID);
	});

	it("does not fetch when order id is null (deterministic, no sleep)", async () => {
		// Deterministic contract: when `orderId` is null the query is
		// `enabled: false`, so the query is in a stable "pending + idle"
		// state synchronously after the first render. We assert that
		// state and the API mock counter BEFORE any waitFor / sleep.
		const { useProductionOrder } = await import("./useProductionOrders");
		const { result } = renderHook(() => useProductionOrder(null), {
			wrapper: makeQueryWrapper(),
		});

		// Synchronous assertions — no setTimeout, no waitFor.
		expect(result.current.fetchStatus).toBe("idle");
		expect(result.current.status).toBe("pending");
		expect(result.current.isFetching).toBe(false);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.data).toBeUndefined();
		expect(api.getProductionOrder).not.toHaveBeenCalled();
	});
});

describe("useProductionOrderEvents", () => {
	it("calls getProductionOrderEvents with the order id", async () => {
		vi.mocked(api.getProductionOrderEvents).mockResolvedValue([SAMPLE_EVENT_ROW]);

		const { useProductionOrderEvents } = await import("./useProductionOrders");
		const { result } = renderHook(() => useProductionOrderEvents(ORDER_ID), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([SAMPLE_EVENT_ROW]);
		expect(api.getProductionOrderEvents).toHaveBeenCalledWith(ORDER_ID);
	});

	it("does not fetch when order id is null (deterministic, no sleep)", async () => {
		// Deterministic contract: when `orderId` is null the query is
		// `enabled: false`, so the query is in a stable "pending + idle"
		// state synchronously after the first render. We assert that
		// state and the API mock counter BEFORE any waitFor / sleep.
		const { useProductionOrderEvents } = await import("./useProductionOrders");
		const { result } = renderHook(() => useProductionOrderEvents(null), {
			wrapper: makeQueryWrapper(),
		});

		// Synchronous assertions — no setTimeout, no waitFor.
		expect(result.current.fetchStatus).toBe("idle");
		expect(result.current.status).toBe("pending");
		expect(result.current.isFetching).toBe(false);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.data).toBeUndefined();
		expect(api.getProductionOrderEvents).not.toHaveBeenCalled();
	});
});

describe("useQuotesWithProductionStatus", () => {
	it("calls getQuotesWithProductionStatus and returns data", async () => {
		vi.mocked(api.getQuotesWithProductionStatus).mockResolvedValue([
			SAMPLE_QUOTE_WITH_PROD_ROW,
		]);

		const { useQuotesWithProductionStatus } = await import(
			"./useProductionOrders"
		);
		const { result } = renderHook(
			() => useQuotesWithProductionStatus({ limit: 25, offset: 50 }),
			{ wrapper: makeQueryWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([SAMPLE_QUOTE_WITH_PROD_ROW]);
		expect(api.getQuotesWithProductionStatus).toHaveBeenCalledWith({
			limit: 25,
			offset: 50,
		});
	});
});

describe("useProductionPipelineStats", () => {
	it("calls getProductionPipelineStats and returns the rows", async () => {
		vi.mocked(api.getProductionPipelineStats).mockResolvedValue([
			SAMPLE_PIPELINE_ROW,
		]);

		const { useProductionPipelineStats } = await import(
			"./useProductionOrders"
		);
		const { result } = renderHook(() => useProductionPipelineStats(), {
			wrapper: makeQueryWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([SAMPLE_PIPELINE_ROW]);
		expect(api.getProductionPipelineStats).toHaveBeenCalled();
	});
});

describe("useStartProductionOrder", () => {
	it("calls startProductionOrder with a generated request id and invalidates the list, detail, and quote projection", async () => {
		vi.mocked(api.startProductionOrder).mockResolvedValue(SAMPLE_LIST_ROW);

		const { useStartProductionOrder } = await import("./useProductionOrders");
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useStartProductionOrder(), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0001",
				plannedStartDate: "2026-07-01",
				plannedEndDate: "2026-07-10",
			});
		});

		const callArg = vi.mocked(api.startProductionOrder).mock.calls[0][0];
		expect(callArg.quoteId).toBe(QUOTE_ID);
		expect(callArg.productionNumber).toBe("OP-2026-0001");
		expect(callArg.plannedStartDate).toBe("2026-07-01");
		expect(callArg.plannedEndDate).toBe("2026-07-10");
		expect(callArg.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);

		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "list"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "detail"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "pipeline"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["quotes", "with_production_status"] }),
		);
	});

	it("preserves a caller-supplied requestId for cross-process idempotency", async () => {
		vi.mocked(api.startProductionOrder).mockResolvedValue(SAMPLE_LIST_ROW);

		const { useStartProductionOrder } = await import("./useProductionOrders");
		const wrapper = makeQueryWrapper();

		const { result } = renderHook(() => useStartProductionOrder(), { wrapper });

		await act(async () => {
			await result.current.mutateAsync({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0001",
				requestId: "11111111-2222-4333-8444-555555555555",
			});
		});

		expect(api.startProductionOrder).toHaveBeenCalledWith({
			quoteId: QUOTE_ID,
			productionNumber: "OP-2026-0001",
			requestId: "11111111-2222-4333-8444-555555555555",
		});
	});
});

describe("useTransitionProductionOrder", () => {
	it("calls transitionProductionOrderState with a generated request id and invalidates the list, detail, events, and quote projection", async () => {
		const transitionedRow = { ...SAMPLE_LIST_ROW, state: "in_progress" as const };
		vi.mocked(api.transitionProductionOrderState).mockResolvedValue(
			transitionedRow,
		);

		const { useTransitionProductionOrder } = await import(
			"./useProductionOrders"
		);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children);

		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useTransitionProductionOrder(), {
			wrapper,
		});

		await act(async () => {
			await result.current.mutateAsync({
				orderId: ORDER_ID,
				toState: "in_progress",
				reason: "Begin build",
			});
		});

		const callArg = vi.mocked(api.transitionProductionOrderState).mock.calls[0][0];
		expect(callArg.orderId).toBe(ORDER_ID);
		expect(callArg.toState).toBe("in_progress");
		expect(callArg.reason).toBe("Begin build");
		expect(callArg.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);

		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "list"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "detail"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "events"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["production_orders", "pipeline"] }),
		);
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: ["quotes", "with_production_status"] }),
		);
	});

	it("preserves a caller-supplied requestId for cross-process idempotency", async () => {
		vi.mocked(api.transitionProductionOrderState).mockResolvedValue(
			SAMPLE_LIST_ROW,
		);

		const { useTransitionProductionOrder } = await import(
			"./useProductionOrders"
		);
		const wrapper = makeQueryWrapper();

		const { result } = renderHook(() => useTransitionProductionOrder(), {
			wrapper,
		});

		await act(async () => {
			await result.current.mutateAsync({
				orderId: ORDER_ID,
				toState: "in_progress",
				requestId: "11111111-2222-4333-8444-555555555555",
			});
		});

		expect(api.transitionProductionOrderState).toHaveBeenCalledWith({
			orderId: ORDER_ID,
			toState: "in_progress",
			requestId: "11111111-2222-4333-8444-555555555555",
		});
	});
});

describe("PRODUCTION_ORDER_STATE constant", () => {
	it("exposes the 7 production order states with the canonical string literals", () => {
		expect(PRODUCTION_ORDER_STATE).toEqual({
			PLANNED: "planned",
			IN_PROGRESS: "in_progress",
			PAUSED: "paused",
			QUALITY_CHECK: "quality_check",
			READY: "ready",
			DELIVERED: "delivered",
			CANCELLED: "cancelled",
		});
	});
});
