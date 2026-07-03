import { PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX } from "@/shared/lib/productionOrderRoutes";

/**
 * Inventory-side deep-link helpers — re-exposed from the inventory
 * barrel so consumers of `@/features/inventory` (and the inventory
 * component layer) can build production-order hrefs without crossing
 * the `featureZone("production")` ESLint boundary.
 *
 * The production feature owns the canonical versions of these helpers
 * (`buildProductionOrderDeepLink`, `shouldShowProductionOrderDeepLink`)
 * and re-exports them from its public API. The inventory copies are
 * thin wrappers over the shared route prefix so the production
 * feature's source of truth is preserved. If the helpers ever need
 * to diverge (e.g. an inventory-specific eligibility rule), the
 * duplication should be resolved by lifting the logic to
 * `@/shared/lib` rather than by importing across features.
 */

/**
 * Build a `/production/:id` deep-link href for a production-order
 * id. The argument is trimmed; an empty/whitespace id throws so a
 * broken input fails fast instead of rendering `/production/`
 * (which resolves to the board, not an order).
 */
export function buildInventoryProductionOrderDeepLink(orderId: string): string {
	const trimmed = orderId.trim();
	if (trimmed === "") {
		throw new Error(
			"buildInventoryProductionOrderDeepLink: orderId is empty or whitespace-only",
		);
	}
	return `${PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX}/${trimmed}`;
}

interface InventoryDeepLinkEligibilityInput {
	reason: string;
	productionDeductionId: string | null;
	productionOrderId: string | null;
}

/**
 * Inventory-side eligibility predicate for the deep-link surface.
 * Mirrors the production feature's `shouldShowProductionOrderDeepLink`
 * — see that module for the full rationale. The duplication is
 * intentional: it keeps the inventory feature self-contained for the
 * ESLint boundary check, and the test suites for both helpers cover
 * the same contract.
 */
export function shouldShowInventoryProductionOrderDeepLink(
	input: InventoryDeepLinkEligibilityInput,
): boolean {
	if (input.reason !== "consumo_produccion") {
		return false;
	}
	if (input.productionDeductionId == null) {
		return false;
	}
	if (input.productionOrderId == null) {
		return false;
	}
	return true;
}
