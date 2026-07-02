/**
 * Public API of the `production` feature slice.
 *
 * Cross-feature consumers MUST import from this barrel — never from
 * `../api/...` or `../hooks/...` directly. The `eslint-plugin-import`
 * `import/no-restricted-paths` rule (see `eslint.config.js` and the
 * `featureZone` helper) is the mechanism that enforces this staged
 * model across the codebase. As of PR 6 the
 * `featureZone("production")` boundary IS active in `eslint.config.js`
 * so any future cross-feature import from `src/features/production/**`
 * into another feature will be rejected at lint time.
 *
 * Exposed:
 * - PR 5: frontend data layer (constants, types, typed RPC wrappers,
 *   TanStack Query hooks).
 * - PR 6: nothing new in the barrel itself — `ProductionBoard`,
 *   `StartProductionDialog`, and `ProductionRoutes` are wired
 *   internally (consumed by `src/app/router.tsx` via the direct
 *   `routes.tsx` import path, matching the inventory pattern). The
 *   new `useStartProductionOrder` hook was already exposed in PR 5.
 * - PR 7: detail page + timeline + inventory deep-link helpers.
 * - PR 8: dashboard `ProductionPipelineWidget` so the home dashboard
 *   can show the per-state order counts without crossing the
 *   `featureZone("production")` ESLint boundary.
 *
 * Planned for future PRs:
 * - PR 9: deprecation of the legacy `startQuoteProduction` stock-
 *   deduction wrapper.
 */

// Constants + types from the data layer
export {
	PRODUCTION_ORDER_STATE,
	PRODUCTION_ORDER_ACTIVE_STATES,
	PRODUCTION_ORDER_TERMINAL_STATES,
	type ProductionOrderState,
} from "./api/types";

// Typed RPC wrappers
export {
	listProductionOrders,
	getProductionOrder,
	getProductionOrderEvents,
	getQuotesWithProductionStatus,
	getProductionPipelineStats,
	startProductionOrder,
	transitionProductionOrderState,
	type ProductionOrder,
	type ProductionOrderInsert,
	type ProductionOrderUpdate,
	type ProductionOrderListRow,
	type ProductionOrderDetailRow,
	type ProductionOrderEvent,
	type QuoteWithProductionStatus,
	type ProductionPipelineStat,
	type ListProductionOrdersFilters,
	type QuotesWithProductionStatusFilters,
	type StartProductionOrderInput,
	type TransitionProductionOrderInput,
} from "./api/productionOrders";

// TanStack Query hooks
export {
	useProductionOrders,
	useProductionOrder,
	useProductionOrderEvents,
	useQuotesWithProductionStatus,
	useProductionPipelineStats,
	useStartProductionOrder,
	useTransitionProductionOrder,
} from "./hooks/useProductionOrders";

// PR 7: deep-link helpers — owned by the production feature so other
// features (inventory, future analytics dashboards) consume the route
// shape through this seam instead of hard-coding `/production/...`.
export {
	PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX,
	buildProductionOrderDeepLink,
	shouldShowProductionOrderDeepLink,
} from "./lib/productionOrderLinks";

// PR 7: read-only presentational components. The detail page is
// mounted directly by `src/features/production/routes.tsx`; the
// timeline is a building block for future widgets (dashboard, etc.).
export { ProductionOrderDetailPage } from "./components/ProductionOrderDetailPage";
export { EventTimeline } from "./components/EventTimeline";

// PR 8: dashboard pipeline widget. Owned by the production feature so
// the dashboard (and any future surface) can mount the per-state
// order counts without crossing the `featureZone("production")` ESLint
// boundary. The widget reads through `useProductionPipelineStats` and
// inherits the canonical `["production_orders", "pipeline"]` query key
// and the cache-privacy contract exercised by
// `useProductionOrders.cachePrivacy.test.ts`.
export { ProductionPipelineWidget } from "./components/ProductionPipelineWidget";
