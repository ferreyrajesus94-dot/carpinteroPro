/**
 * Production-order deep-link helpers — the canonical route shape for
 * a production-order detail page, plus a small predicate that decides
 * whether a stock-movement row is eligible to surface a deep-link.
 *
 * The route prefix is owned by `@/shared/lib/productionOrderRoutes`
 * so the inventory feature (and any future cross-feature consumer)
 * can reference the same path constant without crossing the
 * `featureZone("production")` ESLint boundary.
 */

import { PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX } from "@/shared/lib/productionOrderRoutes";

export { PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX };

/**
 * Build the deep-link path for a given production-order id.
 *
 * Throws when the id is empty or whitespace-only so callers can fail
 * fast on a broken input instead of emitting `/production/` (which
 * resolves to the board, not the order).
 */
export function buildProductionOrderDeepLink(orderId: string): string {
	const trimmed = orderId.trim();
	if (trimmed === "") {
		throw new Error(
			"buildProductionOrderDeepLink: orderId is empty or whitespace-only",
		);
	}
	return `${PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX}/${trimmed}`;
}

interface DeepLinkEligibilityInput {
	/** The stock-movement reason (e.g. `consumo_produccion`, `compra`, `reversion`). */
	reason: string;
	/** The deduction batch id linked to the movement, if any. */
	productionDeductionId: string | null;
	/** The production-order id of the deduction batch, if any. */
	productionOrderId: string | null;
}

/**
 * Predicate that decides whether an inventory movement row should
 * surface a "Ver orden de producción" deep-link.
 *
 * The contract is intentionally narrow:
 *
 * - the movement reason MUST be `consumo_produccion` (the only
 *   reason the deduction batch is created via the new flow);
 * - the movement MUST carry a `production_deduction_id`; and
 * - that deduction batch MUST have a non-null `production_order_id`.
 *
 * Reversal rows and non-production movements never show the link.
 * A legacy deduction with `production_order_id = NULL` is hidden
 * because the deep-link target is the production order, not the
 * deduction batch. The inventory detail page keeps the existing
 * deduction metadata visible to the user.
 */
export function shouldShowProductionOrderDeepLink(
	input: DeepLinkEligibilityInput,
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
