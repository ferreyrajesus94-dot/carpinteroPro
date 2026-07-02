import { PRODUCTION_ORDER_STATE, type ProductionOrderState } from "../api/types";

/**
 * Event-type kinds the timeline UI can render.
 *
 * A `production_order_events` row stores `from_state`, `to_state`, a
 * free-form `event_type` text (PR 7), and a human `note` (PR 7). The
 * timeline UI groups rows into a small set of visual kinds
 * (created / transitioned / paused / resumed / cancelled / delivered)
 * so the icon and the Spanish label are stable regardless of how the
 * underlying `event_type` string evolves.
 *
 * The mapping is implemented as a pure function so the production
 * feature can test it without mocking any I/O. The detail page
 * delegates to `resolveEventTypeFromColumn` to pick the icon and the
 * user-facing text, preferring the SQL-provided `event_type` and
 * falling back to the (from_state, to_state)-derived label when the
 * column is missing (e.g. pre-PR 7 data).
 *
 * The label set mirrors the SQL helper
 * `public.production_order_event_type(from_state, to_state)` defined
 * in `supabase/migrations/20260630000007_production_event_type_note.sql`.
 * The two stay in sync: the SQL helper is the source of truth on the
 * write path (the write RPCs call it to derive `event_type` for every
 * new event), and this TypeScript module is the source of truth on
 * the read path (the EventTimeline UI maps `event_type` to a Spanish
 * label + Lucide icon). If a new label is ever added, both must be
 * updated together.
 */
export const PRODUCTION_ORDER_EVENT_TYPE = {
	CREATED: "created",
	TRANSITIONED: "transitioned",
	RESUMED: "resumed",
	PAUSED: "paused",
	CANCELLED: "cancelled",
	DELIVERED: "delivered",
} as const;

export type ProductionOrderEventTypeKind =
	(typeof PRODUCTION_ORDER_EVENT_TYPE)[keyof typeof PRODUCTION_ORDER_EVENT_TYPE];

const EVENT_TYPE_LABELS: Record<ProductionOrderEventTypeKind, string> = {
	[PRODUCTION_ORDER_EVENT_TYPE.CREATED]: "Orden creada",
	[PRODUCTION_ORDER_EVENT_TYPE.TRANSITIONED]: "Cambio de estado",
	[PRODUCTION_ORDER_EVENT_TYPE.RESUMED]: "Reanudado",
	[PRODUCTION_ORDER_EVENT_TYPE.PAUSED]: "Pausado",
	[PRODUCTION_ORDER_EVENT_TYPE.CANCELLED]: "Cancelado",
	[PRODUCTION_ORDER_EVENT_TYPE.DELIVERED]: "Entregado",
};

/** Stable icon name per event-type kind. */
export const EVENT_TYPE_ICONS: Record<ProductionOrderEventTypeKind, string> = {
	[PRODUCTION_ORDER_EVENT_TYPE.CREATED]: "Plus",
	[PRODUCTION_ORDER_EVENT_TYPE.TRANSITIONED]: "ArrowRight",
	[PRODUCTION_ORDER_EVENT_TYPE.RESUMED]: "Play",
	[PRODUCTION_ORDER_EVENT_TYPE.PAUSED]: "Pause",
	[PRODUCTION_ORDER_EVENT_TYPE.CANCELLED]: "X",
	[PRODUCTION_ORDER_EVENT_TYPE.DELIVERED]: "Check",
};

const KNOWN_EVENT_TYPE_KINDS: ReadonlySet<ProductionOrderEventTypeKind> =
	new Set<ProductionOrderEventTypeKind>([
		PRODUCTION_ORDER_EVENT_TYPE.CREATED,
		PRODUCTION_ORDER_EVENT_TYPE.TRANSITIONED,
		PRODUCTION_ORDER_EVENT_TYPE.RESUMED,
		PRODUCTION_ORDER_EVENT_TYPE.PAUSED,
		PRODUCTION_ORDER_EVENT_TYPE.CANCELLED,
		PRODUCTION_ORDER_EVENT_TYPE.DELIVERED,
	]);

/**
 * Resolve a UI event-type kind from a `production_order_events` row's
 * `from_state` and `to_state`:
 *
 * - `from_state === null` => `created`.
 * - `to_state === 'cancelled'` => `cancelled` (terminal, regardless of
 *   the prior state).
 * - `to_state === 'delivered'` => `delivered` (terminal, regardless of
 *   the prior state).
 * - `paused -> in_progress` => `resumed`.
 * - `in_progress -> paused` => `paused`.
 * - any other transition => `transitioned`.
 *
 * This is the (from_state, to_state)-derived fallback used when the
 * `event_type` column is missing or unrecognized. The SQL helper
 * `production_order_event_type` (in
 * `20260630000007_production_event_type_note.sql`) is the canonical
 * implementation of this mapping on the server side; this function is
 * its client-side mirror.
 */
export function resolveEventType(
	fromState: ProductionOrderState | null,
	toState: ProductionOrderState,
): ProductionOrderEventTypeKind {
	if (fromState === null) {
		return PRODUCTION_ORDER_EVENT_TYPE.CREATED;
	}
	if (toState === PRODUCTION_ORDER_STATE.CANCELLED) {
		return PRODUCTION_ORDER_EVENT_TYPE.CANCELLED;
	}
	if (toState === PRODUCTION_ORDER_STATE.DELIVERED) {
		return PRODUCTION_ORDER_EVENT_TYPE.DELIVERED;
	}
	if (fromState === "paused" && toState === "in_progress") {
		return PRODUCTION_ORDER_EVENT_TYPE.RESUMED;
	}
	if (fromState === "in_progress" && toState === "paused") {
		return PRODUCTION_ORDER_EVENT_TYPE.PAUSED;
	}
	return PRODUCTION_ORDER_EVENT_TYPE.TRANSITIONED;
}

/**
 * Pick a UI event-type kind for a row, preferring the SQL-provided
 * `event_type` column and falling back to the (from_state, to_state)-
 * derived label when the column is missing or unrecognized.
 *
 * - `event_type` is a string from the SQL helper
 *   `production_order_event_type`. The SQL CHECK constraint on the
 *   `production_order_events` table limits the value to the six known
 *   kinds, so a typo in the database is impossible — but a row from
 *   before PR 7 may have `event_type IS NULL`, in which case we fall
 *   back to the state-derived mapping.
 * - An unknown `event_type` (e.g. a future kind that the client
 *   hasn't been updated for) is also handled: it falls back to the
 *   state-derived label so the timeline still renders a meaningful
 *   Spanish label.
 *
 * This is the single entry point the EventTimeline UI uses to map a
 * raw event row to a kind. The pure `(from_state, to_state)` helper
 * is still exported as `resolveEventType` for callers that don't have
 * the SQL column available (none in production code; tests use it to
 * triangulate the mapping).
 */
export function resolveEventTypeFromColumn(
	eventType: string | null | undefined,
	fromState: ProductionOrderState | null,
	toState: ProductionOrderState,
): ProductionOrderEventTypeKind {
	if (eventType && KNOWN_EVENT_TYPE_KINDS.has(eventType as ProductionOrderEventTypeKind)) {
		return eventType as ProductionOrderEventTypeKind;
	}
	return resolveEventType(fromState, toState);
}

/** Spanish label for a UI event-type kind. */
export function resolveEventTypeLabel(
	kind: ProductionOrderEventTypeKind,
): string {
	return EVENT_TYPE_LABELS[kind];
}

/**
 * Predicate used by the detail page to mark terminal events. The
 * terminal-state list mirrors `PRODUCTION_ORDER_TERMINAL_STATES` in
 * `../api/types`.
 */
export function isTerminalEventKind(
	kind: ProductionOrderEventTypeKind,
): boolean {
	return (
		kind === PRODUCTION_ORDER_EVENT_TYPE.CANCELLED ||
		kind === PRODUCTION_ORDER_EVENT_TYPE.DELIVERED
	);
}
