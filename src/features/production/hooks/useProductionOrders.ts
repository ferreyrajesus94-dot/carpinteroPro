import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getProductionOrder,
	getProductionOrderEvents,
	getProductionPipelineStats,
	getQuotesWithProductionStatus,
	listProductionOrders,
	startProductionOrder,
	transitionProductionOrderState,
	type ListProductionOrdersFilters,
	type ProductionOrder,
	type ProductionOrderDetailRow,
	type ProductionOrderEvent,
	type ProductionOrderListRow,
	type ProductionPipelineStat,
	type QuoteWithProductionStatus,
	type QuotesWithProductionStatusFilters,
	type StartProductionOrderInput,
	type TransitionProductionOrderInput,
} from "../api/productionOrders";
import { isPersistableQueryKey } from "@/shared/lib/cachePrivacy";

/**
 * Production orders hooks — TanStack Query wrappers around the typed
 * Supabase RPCs declared in `../api/productionOrders.ts`.
 *
 * Query-key family: every production_orders / production_order_events
 * query key starts with `"production_orders"` and is NOT persistable
 * (per the production-orders spec "Query-Key Cache Privacy" requirement).
 * The project-wide `isPersistableQueryKey` returns false for every key by
 * default, and the production data layer does NOT opt-in to persistence.
 * The contract is exercised end-to-end by
 * `useProductionOrders.cachePrivacy.test.ts`, which imports the REAL
 * `isPersistableQueryKey` (no mock) and asserts that every production
 * query-key family returns false.
 *
 * Invalidation: the start and transition mutations invalidate every
 * read-side key whose data could change (list, detail, events, pipeline,
 * plus the quotes-with-production-status projection that the dashboard
 * and quote integration depend on).
 *
 * NOTE on feature boundary: the `eslint-plugin-import`
 * `import/no-restricted-paths` rule will enforce the production slice
 * boundary in PR 6 (via `featureZone("production")` in `eslint.config.js`).
 * It is NOT yet added in PR 5 because no cross-feature consumers exist
 * yet — adding it now would be premature.
 */

const PRODUCTION_ORDERS_KEY = "production_orders";
const PRODUCTION_ORDERS_LIST_KEY = [PRODUCTION_ORDERS_KEY, "list"] as const;
const PRODUCTION_ORDERS_DETAIL_KEY = [PRODUCTION_ORDERS_KEY, "detail"] as const;
const PRODUCTION_ORDERS_EVENTS_KEY = [PRODUCTION_ORDERS_KEY, "events"] as const;
const PRODUCTION_ORDERS_PIPELINE_KEY = [
	PRODUCTION_ORDERS_KEY,
	"pipeline",
] as const;
const QUOTES_WITH_PRODUCTION_STATUS_KEY = [
	"quotes",
	"with_production_status",
] as const;

/**
 * List production orders for the caller's workshop with optional filters.
 * Tenant-scoped (RLS) and ordered by planned_start_date ASC NULLS LAST,
 * created_at DESC.
 */
export function useProductionOrders(filters: ListProductionOrdersFilters = {}) {
	return useQuery({
		queryKey: [...PRODUCTION_ORDERS_LIST_KEY, filters],
		queryFn: () => listProductionOrders(filters),
	});
}

/**
 * Fetch a single production order by id. Returns null for cross-workshop
 * ids (RLS hides them). Disabled when the id is null.
 */
export function useProductionOrder(orderId: string | null) {
	return useQuery({
		queryKey: [...PRODUCTION_ORDERS_DETAIL_KEY, orderId],
		queryFn: () => getProductionOrder(orderId!),
		enabled: Boolean(orderId),
	});
}

/**
 * Fetch the append-only audit timeline for a production order.
 * Disabled when the id is null.
 */
export function useProductionOrderEvents(orderId: string | null) {
	return useQuery({
		queryKey: [...PRODUCTION_ORDERS_EVENTS_KEY, orderId],
		queryFn: () => getProductionOrderEvents(orderId!),
		enabled: Boolean(orderId),
	});
}

/**
 * Fetch every quote in the caller's workshop with the projected
 * production status. Used by the dashboard and any future quote list
 * that wants to show the effective status (active orders overlay
 * en_produccion; all-delivered overlays entregado).
 */
export function useQuotesWithProductionStatus(
	filters: QuotesWithProductionStatusFilters = {},
) {
	return useQuery({
		queryKey: [...QUOTES_WITH_PRODUCTION_STATUS_KEY, filters],
		queryFn: () => getQuotesWithProductionStatus(filters),
	});
}

/**
 * Fetch the per-state count of production orders.
 *
 * Returns exactly 5 rows in workflow order — one per active state
 * (`planned`, `in_progress`, `paused`, `quality_check`, `ready`).
 * The terminal states `delivered` and `cancelled` are excluded at
 * the SQL layer (PR 8.1 additive migration
 * `20260630000008_production_pipeline_stats_active_only.sql`). The
 * `PRODUCTION_ORDER_ACTIVE_STATES` constant in
 * `../api/productionOrders` provides the defense-in-depth client
 * filter that the dashboard's `ProductionPipelineWidget` applies
 * as a second line of defense.
 */
export function useProductionPipelineStats() {
	return useQuery({
		queryKey: PRODUCTION_ORDERS_PIPELINE_KEY,
		queryFn: () => getProductionPipelineStats(),
	});
}

function generateRequestId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Start a new production order. Generates a request_id internally for
 * idempotent retry; callers may override with a stable cross-process
 * request id. Invalidates every read-side key whose data changes when a
 * new order is created.
 */
export function useStartProductionOrder() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: StartProductionOrderInput) =>
			startProductionOrder({
				...input,
				requestId: input.requestId ?? generateRequestId(),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_LIST_KEY });
			queryClient.invalidateQueries({
				queryKey: PRODUCTION_ORDERS_DETAIL_KEY,
			});
			queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_PIPELINE_KEY });
			queryClient.invalidateQueries({
				queryKey: QUOTES_WITH_PRODUCTION_STATUS_KEY,
			});
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

/**
 * Transition a production order to a new state. Generates a request_id
 * internally for idempotent retry; callers may override with a stable
 * cross-process request id. Invalidates every read-side key whose data
 * changes when an order transitions: list, detail, events, pipeline, and
 * the quote-projection (because a transition can flip a quote between
 * en_produccion and entregado).
 */
export function useTransitionProductionOrder() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: TransitionProductionOrderInput) =>
			transitionProductionOrderState({
				...input,
				requestId: input.requestId ?? generateRequestId(),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_LIST_KEY });
			queryClient.invalidateQueries({
				queryKey: PRODUCTION_ORDERS_DETAIL_KEY,
			});
			queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_EVENTS_KEY });
			queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_PIPELINE_KEY });
			queryClient.invalidateQueries({
				queryKey: QUOTES_WITH_PRODUCTION_STATUS_KEY,
			});
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

export type {
	ProductionOrder,
	ProductionOrderDetailRow,
	ProductionOrderEvent,
	ProductionOrderListRow,
	ProductionPipelineStat,
	QuoteWithProductionStatus,
};

export {
	// Re-export the runtime helpers from the API layer so cross-feature
	// consumers that need to call RPCs directly (e.g. tests, server
	// scripts) can import them from the production barrel.
	isPersistableQueryKey,
};
