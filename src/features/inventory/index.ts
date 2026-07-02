export { PriceSparkline } from "./components/PriceSparkline";
export { useMaterials } from "./hooks/useMaterials";
export { useAllPriceHistory } from "./hooks/useAllPriceHistory";

// Hooks
export {
	useStockMovements,
	useApplyStockMovement,
	useStockMovementLedger,
	useStockMovementDetail,
	useReverseStockMovement,
	useReverseProductionDeduction,
} from "./hooks/useStockMovements";

// API
export {
	applyStockMovement,
	fetchStockMovements,
	fetchStockMovementLedger,
	fetchStockMovementDetail,
	reverseProductionDeduction,
	reverseStockMovement,
} from "./api/stockMovements";

// Types
export type {
	StockMovement,
	StockMovementReason,
	ApplyStockMovementInput,
	StockMovementLedgerFilters,
	StockMovementLedgerRow,
	StockMovementDetail,
	ReverseProductionDeductionInput,
	ReverseStockMovementInput,
} from "./api/stockMovements";

// PR 7: production-order deep-link surface. The route prefix lives in
// `@/shared/lib/productionOrderRoutes`; the inventory-local helpers
// wrap the prefix so the inventory component layer can build
// production-order hrefs without crossing the
// `featureZone("production")` ESLint boundary.
export {
	buildInventoryProductionOrderDeepLink,
	shouldShowInventoryProductionOrderDeepLink,
} from "./lib/productionOrderDeepLink";
export { PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX } from "@/shared/lib/productionOrderRoutes";
