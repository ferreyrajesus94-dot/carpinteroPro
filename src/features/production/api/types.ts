/**
 * Production order state machine — runtime constants and type.
 *
 * The 7 state literals mirror the `production_order_state` enum in
 * `supabase/migrations/20260630000000_production_orders.sql`. The const +
 * derived type is the canonical runtime + compile-time source of truth for
 * the production feature. Components and hooks should reference
 * `PRODUCTION_ORDER_STATE.X` (or `ProductionOrderState` for union types)
 * instead of string literals so a future enum value is a compile error.
 */
export const PRODUCTION_ORDER_STATE = {
	PLANNED: "planned",
	IN_PROGRESS: "in_progress",
	PAUSED: "paused",
	QUALITY_CHECK: "quality_check",
	READY: "ready",
	DELIVERED: "delivered",
	CANCELLED: "cancelled",
} as const;

export type ProductionOrderState =
	(typeof PRODUCTION_ORDER_STATE)[keyof typeof PRODUCTION_ORDER_STATE];

/**
 * Ordered list of active states — used by the production board to render one
 * column per active state. Terminal states (delivered, cancelled) are
 * rendered separately in detail/history views, not on the board.
 */
export const PRODUCTION_ORDER_ACTIVE_STATES: readonly ProductionOrderState[] = [
	PRODUCTION_ORDER_STATE.PLANNED,
	PRODUCTION_ORDER_STATE.IN_PROGRESS,
	PRODUCTION_ORDER_STATE.PAUSED,
	PRODUCTION_ORDER_STATE.QUALITY_CHECK,
	PRODUCTION_ORDER_STATE.READY,
] as const;

/**
 * Terminal states — orders in these states reject further transitions.
 * Kept here so the UI can label detail pages without inlining the literals.
 */
export const PRODUCTION_ORDER_TERMINAL_STATES: readonly ProductionOrderState[] = [
	PRODUCTION_ORDER_STATE.DELIVERED,
	PRODUCTION_ORDER_STATE.CANCELLED,
] as const;
