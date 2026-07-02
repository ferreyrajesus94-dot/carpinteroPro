import { beforeEach, describe, expect, it, vi } from "vitest";

interface RpcCall {
	rpcName: string;
	params: Record<string, unknown>;
}

interface RpcScript {
	match?: (rpcName: string, params: Record<string, unknown>) => boolean;
	resolve: unknown;
}

let rpcScript: RpcScript = { resolve: { data: null, error: null } };
const rpcCalls: RpcCall[] = [];

function makeThenable<T>(value: T): {
	then: (onFulfilled?: (v: T) => unknown) => Promise<unknown>;
} {
	return {
		then: (onFulfilled?: (v: T) => unknown) =>
			Promise.resolve(onFulfilled ? onFulfilled(value) : value),
	};
}

vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		rpc: (rpcName: string, params: Record<string, unknown>) => {
			rpcCalls.push({ rpcName, params });
			const matched =
				!rpcScript.match || rpcScript.match(rpcName, params);
			if (!matched) {
				return makeThenable({ data: null, error: null });
			}
			return rpcScript.resolve as {
				then: (fn?: (v: unknown) => unknown) => Promise<unknown>;
			};
		},
	},
}));

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
	state: "planned",
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
	quote_status: "aprobado",
	quote_client_id: "55555555-5555-4555-8555-555555555555",
	quote_client_name: "Acme SRL",
};

const SAMPLE_EVENT_ROW = {
	id: EVENT_ID,
	workshop_id: WORKSHOP_ID,
	production_order_id: ORDER_ID,
	// PR 7: the SQL helper writes event_type on every event row.
	event_type: "created",
	from_state: null,
	to_state: "planned",
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
	stored_status: "aprobado",
	production_status: "en_produccion",
	has_active_production: true,
	last_event_at: "2026-06-30T10:00:00Z",
};

const SAMPLE_PIPELINE_ROW = { state: "planned", count: 3 };

function resetRpc() {
	rpcCalls.length = 0;
	rpcScript = { resolve: { data: null, error: null } };
}

beforeEach(() => {
	resetRpc();
});

describe("listProductionOrders", () => {
	it("calls list_production_orders with default filters", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_LIST_ROW], error: null }),
		};

		const { listProductionOrders } = await import("./productionOrders");
		const result = await listProductionOrders();

		expect(rpcCalls[0].rpcName).toBe("list_production_orders");
		expect(rpcCalls[0].params).toEqual({
			p_states: null,
			p_assigned_to: null,
			p_quote_id: null,
			p_search: null,
			p_limit: 100,
			p_offset: 0,
		});
		expect(result).toEqual([SAMPLE_LIST_ROW]);
	});

	it("passes provided filters and arrays of states to the RPC", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_LIST_ROW], error: null }),
		};

		const { listProductionOrders } = await import("./productionOrders");
		await listProductionOrders({
			states: ["planned", "in_progress"],
			assignedTo: ACTOR_ID,
			quoteId: QUOTE_ID,
			search: "OP-2026",
			limit: 25,
			offset: 50,
		});

		expect(rpcCalls[0].params).toEqual({
			p_states: ["planned", "in_progress"],
			p_assigned_to: ACTOR_ID,
			p_quote_id: QUOTE_ID,
			p_search: "OP-2026",
			p_limit: 25,
			p_offset: 50,
		});
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("RLS denied") }),
		};

		const { listProductionOrders } = await import("./productionOrders");
		await expect(listProductionOrders()).rejects.toThrow("RLS denied");
	});

	it("returns an empty array when the RPC returns null data", async () => {
		rpcScript = { resolve: makeThenable({ data: null, error: null }) };

		const { listProductionOrders } = await import("./productionOrders");
		await expect(listProductionOrders()).resolves.toEqual([]);
	});
});

describe("getProductionOrder", () => {
	it("calls get_production_order with the order id and returns the first row", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_DETAIL_ROW], error: null }),
		};

		const { getProductionOrder } = await import("./productionOrders");
		const result = await getProductionOrder(ORDER_ID);

		expect(rpcCalls[0].rpcName).toBe("get_production_order");
		expect(rpcCalls[0].params).toEqual({ p_order_id: ORDER_ID });
		expect(result).toEqual(SAMPLE_DETAIL_ROW);
	});

	it("returns null when the RPC returns zero rows (cross-workshop invisible)", async () => {
		rpcScript = { resolve: makeThenable({ data: [], error: null }) };

		const { getProductionOrder } = await import("./productionOrders");
		await expect(getProductionOrder(ORDER_ID)).resolves.toBeNull();
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("DB error") }),
		};

		const { getProductionOrder } = await import("./productionOrders");
		await expect(getProductionOrder(ORDER_ID)).rejects.toThrow("DB error");
	});
});

describe("getProductionOrderEvents", () => {
	it("calls get_production_order_events with the order id and returns the events", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_EVENT_ROW], error: null }),
		};

		const { getProductionOrderEvents } = await import("./productionOrders");
		const result = await getProductionOrderEvents(ORDER_ID);

		expect(rpcCalls[0].rpcName).toBe("get_production_order_events");
		expect(rpcCalls[0].params).toEqual({ p_order_id: ORDER_ID });
		expect(result).toEqual([SAMPLE_EVENT_ROW]);
	});

	it("returns an empty array when the RPC returns null data", async () => {
		rpcScript = { resolve: makeThenable({ data: null, error: null }) };

		const { getProductionOrderEvents } = await import("./productionOrders");
		await expect(getProductionOrderEvents(ORDER_ID)).resolves.toEqual([]);
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("Boom") }),
		};

		const { getProductionOrderEvents } = await import("./productionOrders");
		await expect(getProductionOrderEvents(ORDER_ID)).rejects.toThrow("Boom");
	});
});

describe("getQuotesWithProductionStatus", () => {
	it("calls get_quotes_with_production_status with default limit/offset", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_QUOTE_WITH_PROD_ROW], error: null }),
		};

		const { getQuotesWithProductionStatus } = await import(
			"./productionOrders"
		);
		const result = await getQuotesWithProductionStatus();

		expect(rpcCalls[0].rpcName).toBe("get_quotes_with_production_status");
		expect(rpcCalls[0].params).toEqual({ p_limit: 100, p_offset: 0 });
		expect(result).toEqual([SAMPLE_QUOTE_WITH_PROD_ROW]);
	});

	it("passes provided limit and offset to the RPC", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [], error: null }),
		};

		const { getQuotesWithProductionStatus } = await import(
			"./productionOrders"
		);
		await getQuotesWithProductionStatus({ limit: 25, offset: 50 });

		expect(rpcCalls[0].params).toEqual({ p_limit: 25, p_offset: 50 });
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("Nope") }),
		};

		const { getQuotesWithProductionStatus } = await import(
			"./productionOrders"
		);
		await expect(getQuotesWithProductionStatus()).rejects.toThrow("Nope");
	});
});

describe("getProductionPipelineStats", () => {
	it("calls get_production_pipeline_stats and returns the rows", async () => {
		rpcScript = {
			resolve: makeThenable({ data: [SAMPLE_PIPELINE_ROW], error: null }),
		};

		const { getProductionPipelineStats } = await import(
			"./productionOrders"
		);
		const result = await getProductionPipelineStats();

		expect(rpcCalls[0].rpcName).toBe("get_production_pipeline_stats");
		// The RPC takes no args, so the implementation calls .rpc() with
		// only the function name. Supabase does not pass an empty object;
		// the second argument is undefined.
		expect(rpcCalls[0].params).toBeUndefined();
		expect(result).toEqual([SAMPLE_PIPELINE_ROW]);
	});

	it("returns an empty array when the RPC returns null data", async () => {
		rpcScript = { resolve: makeThenable({ data: null, error: null }) };

		const { getProductionPipelineStats } = await import(
			"./productionOrders"
		);
		await expect(getProductionPipelineStats()).resolves.toEqual([]);
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("Pipeline down") }),
		};

		const { getProductionPipelineStats } = await import(
			"./productionOrders"
		);
		await expect(getProductionPipelineStats()).rejects.toThrow("Pipeline down");
	});
});

describe("startProductionOrder", () => {
	it("calls start_production_order with the 8-arg signature and a generated request id", async () => {
		rpcScript = {
			resolve: makeThenable({ data: SAMPLE_LIST_ROW, error: null }),
		};

		const { startProductionOrder } = await import("./productionOrders");
		const result = await startProductionOrder({
			quoteId: QUOTE_ID,
			productionNumber: "OP-2026-0001",
			plannedStartDate: "2026-07-01",
			plannedEndDate: "2026-07-10",
			assignedTo: ACTOR_ID,
			notes: "Sample order",
		});

		expect(rpcCalls[0].rpcName).toBe("start_production_order");
		expect(rpcCalls[0].params).toEqual({
			p_quote_id: QUOTE_ID,
			p_production_number: "OP-2026-0001",
			p_planned_start_date: "2026-07-01",
			p_planned_end_date: "2026-07-10",
			p_assigned_to: ACTOR_ID,
			p_notes: "Sample order",
			p_request_id: expect.stringMatching(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			) as unknown as string,
			p_create_deduction: true,
		});
		expect(result).toEqual(SAMPLE_LIST_ROW);
	});

	it("passes an explicit requestId and disables deduction creation when requested", async () => {
		rpcScript = {
			resolve: makeThenable({ data: SAMPLE_LIST_ROW, error: null }),
		};

		const { startProductionOrder } = await import("./productionOrders");
		await startProductionOrder({
			quoteId: QUOTE_ID,
			productionNumber: "OP-2026-0002",
			requestId: "11111111-2222-4333-8444-555555555555",
			createDeduction: false,
		});

		expect(rpcCalls[0].params).toMatchObject({
			p_quote_id: QUOTE_ID,
			p_production_number: "OP-2026-0002",
			p_request_id: "11111111-2222-4333-8444-555555555555",
			p_create_deduction: false,
		});
	});

	it("treats null dates/assignee/notes as null in the RPC params", async () => {
		rpcScript = {
			resolve: makeThenable({ data: SAMPLE_LIST_ROW, error: null }),
		};

		const { startProductionOrder } = await import("./productionOrders");
		await startProductionOrder({
			quoteId: QUOTE_ID,
			productionNumber: "OP-2026-0003",
			requestId: "11111111-2222-4333-8444-555555555555",
		});

		expect(rpcCalls[0].params).toMatchObject({
			p_planned_start_date: null,
			p_planned_end_date: null,
			p_assigned_to: null,
			p_notes: null,
		});
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({ data: null, error: new Error("Quote not aprobado") }),
		};

		const { startProductionOrder } = await import("./productionOrders");
		await expect(
			startProductionOrder({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0004",
				requestId: "11111111-2222-4333-8444-555555555555",
			}),
		).rejects.toThrow("Quote not aprobado");
	});

	it("throws when the RPC returns null data with no error (treat as error, not silent success)", async () => {
		// Edge case: PostgREST can return { data: null, error: null } in
		// some failure modes (e.g. the function exists but returns no
		// row). The wrapper must NOT silently return a null order; that
		// would let the UI treat a failed creation as a success.
		rpcScript = {
			resolve: makeThenable({ data: null, error: null }),
		};

		const { startProductionOrder } = await import("./productionOrders");
		await expect(
			startProductionOrder({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0005",
				requestId: "11111111-2222-4333-8444-555555555555",
			}),
		).rejects.toThrow(/start_production_order/);
	});
});

describe("transitionProductionOrderState", () => {
	it("calls transition_production_order_state with to_state and a generated request id", async () => {
		const transitionedRow = { ...SAMPLE_LIST_ROW, state: "in_progress" };
		rpcScript = {
			resolve: makeThenable({ data: transitionedRow, error: null }),
		};

		const { transitionProductionOrderState } = await import(
			"./productionOrders"
		);
		const result = await transitionProductionOrderState({
			orderId: ORDER_ID,
			toState: "in_progress",
			reason: "Begin build",
		});

		expect(rpcCalls[0].rpcName).toBe("transition_production_order_state");
		expect(rpcCalls[0].params).toEqual({
			p_order_id: ORDER_ID,
			p_to_state: "in_progress",
			p_reason: "Begin build",
			p_request_id: expect.stringMatching(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			) as unknown as string,
		});
		expect(result).toEqual(transitionedRow);
	});

	it("passes an explicit requestId and a null reason when omitted", async () => {
		const transitionedRow = { ...SAMPLE_LIST_ROW, state: "paused" };
		rpcScript = {
			resolve: makeThenable({ data: transitionedRow, error: null }),
		};

		const { transitionProductionOrderState } = await import(
			"./productionOrders"
		);
		await transitionProductionOrderState({
			orderId: ORDER_ID,
			toState: "paused",
			requestId: "11111111-2222-4333-8444-555555555555",
		});

		expect(rpcCalls[0].params).toEqual({
			p_order_id: ORDER_ID,
			p_to_state: "paused",
			p_reason: null,
			p_request_id: "11111111-2222-4333-8444-555555555555",
		});
	});

	it("throws when the RPC returns an error", async () => {
		rpcScript = {
			resolve: makeThenable({
				data: null,
				error: new Error("Transition forbidden"),
			}),
		};

		const { transitionProductionOrderState } = await import(
			"./productionOrders"
		);
		await expect(
			transitionProductionOrderState({
				orderId: ORDER_ID,
				toState: "delivered",
				requestId: "11111111-2222-4333-8444-555555555555",
			}),
		).rejects.toThrow("Transition forbidden");
	});

	it("throws when the RPC returns null data with no error (treat as error, not silent success)", async () => {
		// Edge case: PostgREST can return { data: null, error: null }
		// for an RPC that the function contract guarantees to return a
		// row. The wrapper must NOT silently return a null order; that
		// would let the UI treat a failed transition as a success.
		rpcScript = {
			resolve: makeThenable({ data: null, error: null }),
		};

		const { transitionProductionOrderState } = await import(
			"./productionOrders"
		);
		await expect(
			transitionProductionOrderState({
				orderId: ORDER_ID,
				toState: "in_progress",
				requestId: "11111111-2222-4333-8444-555555555555",
			}),
		).rejects.toThrow(/transition_production_order_state/);
	});
});
