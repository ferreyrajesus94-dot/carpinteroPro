/**
 * Public API of the `production` feature slice.
 *
 * Cross-feature consumers should import from this barrel instead of
 * reaching into `../api/...` or `../hooks/...` directly. The staged
 * import-boundary rules in `eslint.config.js` enforce that contract.
 *
 * Exposed:
 * - feature data layer (constants, types, typed RPC wrappers, hooks)
 * - route/page components and reusable presentational components
 * - dashboard pipeline widget for app-level composition
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

// Deep-link helpers, owned by the production feature so other features
// consume the route shape through this seam instead of hard-coding
// `/production/...`.
export {
	PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX,
	buildProductionOrderDeepLink,
	shouldShowProductionOrderDeepLink,
} from "./lib/productionOrderLinks";

// Read-only presentational components. The detail page is mounted
// directly by `src/features/production/routes.tsx`; the timeline is a
// building block for future widgets (dashboard, etc.).
export { ProductionOrderDetailPage } from "./components/ProductionOrderDetailPage";
export { EventTimeline } from "./components/EventTimeline";

// Dashboard pipeline widget, owned by the production feature and
// composed by app-level surfaces that need the per-state order counts.
export { ProductionPipelineWidget } from "./components/ProductionPipelineWidget";
