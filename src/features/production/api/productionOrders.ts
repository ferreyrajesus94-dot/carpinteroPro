import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import type { ProductionOrderState } from "./types";

/**
 * Production orders data layer — typed Supabase wrappers around the
 * production-order-state-machine RPCs.
 *
 * The `production_orders` and `production_order_events` tables are tenant-
 * scoped by SELECT-only RLS (`workshop_id = get_current_workshop_id()`),
 * and all write paths flow through SECURITY DEFINER RPCs that gate on
 * role + workshop. The functions below call those RPCs by name and
 * project the return shape to typed shapes from `database.ts`.
 *
 * Query keys derived from these functions MUST remain non-persistable
 * (per spec "Query-Key Cache Privacy"); the project's
 * `isPersistableQueryKey` returns false for every key by default and the
 * production hooks do not opt-in to persistence.
 */

/** Underlying production_orders row (1:1 with the SQL table). */
export type ProductionOrder =
	Database["public"]["Tables"]["production_orders"]["Row"];

/** Insert payload for a new production order. */
export type ProductionOrderInsert =
	Database["public"]["Tables"]["production_orders"]["Insert"];

/** Update payload for a production order. */
export type ProductionOrderUpdate =
	Database["public"]["Tables"]["production_orders"]["Update"];

/**
 * One row of the list_production_orders RPC (16 columns). The RPC JOINs
 * quotes + profiles to denormalize quote_number, quote_furniture_name, and
 * assigned_to_name so the board can render without an N+1 query.
 */
export type ProductionOrderListRow =
	Database["public"]["Functions"]["list_production_orders"]["Returns"][number];

/**
 * One row of the get_production_order RPC (19 columns). Adds quote_status,
 * quote_client_id, quote_client_name on top of the list row for the
 * detail page.
 */
export type ProductionOrderDetailRow =
	Database["public"]["Functions"]["get_production_order"]["Returns"][number];

/**
 * One row of the get_production_order_events RPC (12 columns). Ordered by
 * (created_at ASC, id ASC) for deterministic ordering when two events
 * share a timestamp.
 *
 * PR 7: the `event_type` column is the canonical UI label (one of
 * `created` / `transitioned` / `paused` / `resumed` / `cancelled` /
 * `delivered`). The `note` column is the human note attached to the
 * event. The `reason` column is preserved for back-compat and carries
 * the same value as `note` for new rows. The EventTimeline UI prefers
 * `event_type` for the label and `note` for the rendered text, with
 * the (from_state, to_state) pair kept as a fallback so an event
 * whose `event_type` is missing (e.g. pre-PR 7 data) still renders.
 */
export type ProductionOrderEvent =
	Database["public"]["Functions"]["get_production_order_events"]["Returns"][number];

/**
 * One row of the get_quotes_with_production_status RPC (10 columns).
 * `production_status` is the projected status (any active order overlays
 * stored_status with en_produccion; all-delivered overlays with entregado;
 * otherwise the stored status is returned). `has_active_production` lets
 * the UI render an active-state badge without a second query.
 */
export type QuoteWithProductionStatus =
	Database["public"]["Functions"]["get_quotes_with_production_status"]["Returns"][number];

/**
 * One row of the get_production_pipeline_stats RPC (2 columns). Returns
 * exactly 5 rows (one per ACTIVE state: planned, in_progress, paused,
 * quality_check, ready) in workflow order, with zero counts included for
 * active states with no orders. Terminal states (delivered, cancelled) are
 * EXCLUDED from the pipeline per the production-orders spec
 * "Production Pipeline Stats RPC" requirement — the dashboard widget no
 * longer needs to filter terminal states client-side (defense in depth
 * keeps the client-side filter too, see
 * `PRODUCTION_ORDER_TERMINAL_STATES` in `./types.ts`).
 */
export type ProductionPipelineStat =
	Database["public"]["Functions"]["get_production_pipeline_stats"]["Returns"][number];

/** Filters for `listProductionOrders`. */
export interface ListProductionOrdersFilters {
	/** Active or terminal states to include. Supabase typed client expects
	 *  a mutable array of enum values; callers may pass `as ProductionOrderState[]`
	 *  or rely on the cast inside the implementation. */
	states?: ProductionOrderState[];
	assignedTo?: string | null;
	quoteId?: string | null;
	search?: string | null;
	limit?: number;
	offset?: number;
}

/** Pagination input for `getQuotesWithProductionStatus`. */
export interface QuotesWithProductionStatusFilters {
	limit?: number;
	offset?: number;
}

/** Input for `startProductionOrder`. Maps to the 8-arg RPC signature. */
export interface StartProductionOrderInput {
	quoteId: string;
	productionNumber: string;
	plannedStartDate?: string | null;
	plannedEndDate?: string | null;
	assignedTo?: string | null;
	notes?: string | null;
	/**
	 * Optional idempotency token. When omitted, a fresh UUID v4 is generated
	 * per call so retries with the same p_request_id hit the same order
	 * (per the SQL idempotency contract).
	 */
	requestId?: string;
	/**
	 * Whether the RPC also creates a deduction batch with
	 * production_order_id = NEW.id. Default true. The frontend always
	 * passes true; PR 2 tests pass false to keep start_production_order
	 * isolated from the deduction path.
	 */
	createDeduction?: boolean;
}

/** Input for `transitionProductionOrderState`. Maps to the 4-arg RPC. */
export interface TransitionProductionOrderInput {
	orderId: string;
	toState: ProductionOrderState;
	reason?: string | null;
	/** Optional idempotency token; fresh UUID v4 generated when omitted. */
	requestId?: string;
}

function generateRequestId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	// Fallback for jsdom + older test envs: 32 hex chars from Math.random.
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Fetch a paginated list of production orders for the caller's workshop.
 * SECURITY INVOKER: RLS scopes by workshop; cross-workshop rows are
 * filtered out automatically.
 */
export async function listProductionOrders(
	filters: ListProductionOrdersFilters = {},
): Promise<ProductionOrderListRow[]> {
	const { data, error } = await supabase.rpc("list_production_orders", {
		p_states: (filters.states ?? null) as
			| ProductionOrderState[]
			| null,
		p_assigned_to: filters.assignedTo ?? null,
		p_quote_id: filters.quoteId ?? null,
		p_search: filters.search ?? null,
		p_limit: filters.limit ?? 100,
		p_offset: filters.offset ?? 0,
	});
	if (error) throw error;
	return (data as ProductionOrderListRow[]) ?? [];
}

/**
 * Fetch a single production order by id. Returns null when the caller's
 * RLS context does not include the row (cross-workshop invisible, or the
 * id does not exist). Callers should treat null uniformly as "not visible"
 * — the RPC does not distinguish 404 from 403.
 */
export async function getProductionOrder(
	orderId: string,
): Promise<ProductionOrderDetailRow | null> {
	const { data, error } = await supabase.rpc("get_production_order", {
		p_order_id: orderId,
	});
	if (error) throw error;
	return ((data as ProductionOrderDetailRow[] | null) ?? [])[0] ?? null;
}

/**
 * Fetch the append-only audit timeline for a production order, ordered
 * by created_at ASC. Returns [] for invisible (cross-workshop) ids.
 */
export async function getProductionOrderEvents(
	orderId: string,
): Promise<ProductionOrderEvent[]> {
	const { data, error } = await supabase.rpc("get_production_order_events", {
		p_order_id: orderId,
	});
	if (error) throw error;
	return (data as ProductionOrderEvent[]) ?? [];
}

/**
 * Fetch every quote in the caller's workshop with the projected
 * production status. The `production_status` column overlays the stored
 * status according to the projection rules in PR 3 (active -> en_produccion;
 * all-delivered -> entregado; otherwise stored status).
 */
export async function getQuotesWithProductionStatus(
	filters: QuotesWithProductionStatusFilters = {},
): Promise<QuoteWithProductionStatus[]> {
	const { data, error } = await supabase.rpc(
		"get_quotes_with_production_status",
		{
			p_limit: filters.limit ?? 100,
			p_offset: filters.offset ?? 0,
		},
	);
	if (error) throw error;
	return (data as QuoteWithProductionStatus[]) ?? [];
}

/**
 * Fetch the per-state count of production orders for the caller's
 * workshop. Returns exactly 5 rows (one per ACTIVE state: planned,
 * in_progress, paused, quality_check, ready) in workflow order, with zero
 * counts included for active states with no orders. Terminal states
 * (delivered, cancelled) are EXCLUDED from the pipeline per the
 * production-orders spec — the SQL contract honors the spec directly so
 * the dashboard widget consumes a spec-honoring payload and does not need
 * to filter terminal states client-side (defense in depth keeps the
 * filter on the widget too, see
 * `PRODUCTION_ORDER_TERMINAL_STATES` in `./types.ts`).
 */
export async function getProductionPipelineStats(): Promise<
	ProductionPipelineStat[]
> {
	const { data, error } = await supabase.rpc("get_production_pipeline_stats");
	if (error) throw error;
	return (data as ProductionPipelineStat[]) ?? [];
}

/**
 * Create a new production order in state='planned' and append a creation
 * event. SECURITY DEFINER RPC: the body performs role + workshop checks
 * and sets the internal write-context guard before writing. Idempotent on
 * p_request_id: retries with the same id return the existing order
 * without creating a duplicate. The default createDeduction=true creates
 * a deduction batch with production_order_id = NEW.id (PR 4 new flow).
 *
 * Throws if the RPC returns an error OR returns no row. A null `data`
 * with a null `error` from PostgREST means the function contract was
 * violated (the RPC must return the created row); we surface that as an
 * Error so the mutation cannot silently treat a failed creation as a
 * success.
 */
export async function startProductionOrder(
	input: StartProductionOrderInput,
): Promise<ProductionOrder> {
	const { data, error } = await supabase.rpc("start_production_order", {
		p_quote_id: input.quoteId,
		p_production_number: input.productionNumber,
		p_planned_start_date: input.plannedStartDate ?? null,
		p_planned_end_date: input.plannedEndDate ?? null,
		p_assigned_to: input.assignedTo ?? null,
		p_notes: input.notes ?? null,
		p_request_id: input.requestId ?? generateRequestId(),
		p_create_deduction: input.createDeduction ?? true,
	});
	if (error) throw error;
	if (data == null) {
		throw new Error(
			"start_production_order returned no data; the RPC contract requires a row.",
		);
	}
	return data as ProductionOrder;
}

/**
 * Transition a production order to a new state and append an audit event.
 * SECURITY DEFINER RPC: the body enforces the allowed-transitions list at
 * the SQL layer (planned -> in_progress | cancelled; in_progress -> paused
 * | quality_check | cancelled; paused -> in_progress | cancelled;
 * quality_check -> ready | in_progress; ready -> delivered | cancelled;
 * delivered and cancelled are terminal). Idempotent on p_request_id.
 *
 * Throws if the RPC returns an error OR returns no row. A null `data`
 * with a null `error` from PostgREST means the function contract was
 * violated (the RPC must return the updated row); we surface that as an
 * Error so the mutation cannot silently treat a failed transition as a
 * success.
 */
export async function transitionProductionOrderState(
	input: TransitionProductionOrderInput,
): Promise<ProductionOrder> {
	const { data, error } = await supabase.rpc(
		"transition_production_order_state",
		{
			p_order_id: input.orderId,
			p_to_state: input.toState,
			p_reason: input.reason ?? null,
			p_request_id: input.requestId ?? generateRequestId(),
		},
	);
	if (error) throw error;
	if (data == null) {
		throw new Error(
			"transition_production_order_state returned no data; the RPC contract requires a row.",
		);
	}
	return data as ProductionOrder;
}
