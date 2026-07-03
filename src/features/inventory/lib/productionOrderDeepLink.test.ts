import { describe, it, expect } from "vitest";
import {
	buildInventoryProductionOrderDeepLink,
	shouldShowInventoryProductionOrderDeepLink,
} from "./productionOrderDeepLink";

/**
 * Pure helper tests for the inventory-side deep-link surface. The
 * inventory barrel re-exports these helpers so cross-feature consumers
 * of the inventory feature can build production-order hrefs without
 * crossing the `featureZone("production")` ESLint boundary.
 */
describe("buildInventoryProductionOrderDeepLink", () => {
	it("returns the canonical /production/:id path for a non-empty id", () => {
		expect(buildInventoryProductionOrderDeepLink("order-1")).toBe(
			"/production/order-1",
		);
	});

	it("preserves UUID-shaped ids verbatim", () => {
		const id = "11111111-1111-4111-8111-111111111111";
		expect(buildInventoryProductionOrderDeepLink(id)).toBe(
			`/production/${id}`,
		);
	});

	it("trims whitespace-padded ids", () => {
		expect(buildInventoryProductionOrderDeepLink("  order-1  ")).toBe(
			"/production/order-1",
		);
	});

	it("throws on an empty id so callers can detect a broken link early", () => {
		expect(() => buildInventoryProductionOrderDeepLink("")).toThrow();
	});

	it("throws on a whitespace-only id", () => {
		expect(() => buildInventoryProductionOrderDeepLink("   ")).toThrow();
	});
});

describe("shouldShowInventoryProductionOrderDeepLink", () => {
	const PRODUCTION_REASON = "consumo_produccion" as const;
	const NON_PRODUCTION_REASON = "compra" as const;

	it("returns true when the movement is production-origin and the deduction has a non-null production_order_id", () => {
		expect(
			shouldShowInventoryProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(true);
	});

	it("returns false when the movement is production-origin but the deduction has a null production_order_id (legacy batch)", () => {
		expect(
			shouldShowInventoryProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: null,
			}),
		).toBe(false);
	});

	it("returns false when the movement is production-origin but there is no deduction id at all", () => {
		expect(
			shouldShowInventoryProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: null,
				productionOrderId: null,
			}),
		).toBe(false);
	});

	it("returns false when the reason is NOT production-origin even if a production_order_id is somehow present", () => {
		expect(
			shouldShowInventoryProductionOrderDeepLink({
				reason: NON_PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(false);
	});

	it("returns false when the reason is a reversal", () => {
		expect(
			shouldShowInventoryProductionOrderDeepLink({
				reason: "reversion",
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(false);
	});
});
