import { describe, it, expect } from "vitest";
import {
	PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX,
	buildProductionOrderDeepLink,
	shouldShowProductionOrderDeepLink,
} from "./productionOrderLinks";

/**
 * Pure helper tests for the production-order deep-link contract. These
 * are pure functions so the test layer is plain Vitest without RTL.
 *
 * The deep-link surface is consumed cross-feature from the inventory
 * detail page (a production-origin movement exposes a "Ver orden de
 * producción" link back to the order). The production feature owns
 * the route shape so other features can import the helper from the
 * production barrel instead of hard-coding `/production/...` strings.
 */
describe("PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX", () => {
	it("is the canonical production feature route prefix", () => {
		expect(PRODUCTION_ORDER_DEEP_LINK_PATH_PREFIX).toBe("/production");
	});
});

describe("buildProductionOrderDeepLink", () => {
	it("returns the canonical /production/:id path for a non-empty id", () => {
		expect(buildProductionOrderDeepLink("order-1")).toBe("/production/order-1");
	});

	it("preserves UUID-shaped ids verbatim", () => {
		const id = "11111111-1111-4111-8111-111111111111";
		expect(buildProductionOrderDeepLink(id)).toBe(
			`/production/${id}`,
		);
	});

	it("does not append a trailing slash", () => {
		expect(buildProductionOrderDeepLink("order-1").endsWith("/")).toBe(false);
	});

	it("does not throw on whitespace-padded ids (returns the trimmed value)", () => {
		expect(buildProductionOrderDeepLink("  order-1  ")).toBe(
			"/production/order-1",
		);
	});

	it("throws on an empty id so callers can detect a broken link early", () => {
		expect(() => buildProductionOrderDeepLink("")).toThrow();
	});

	it("throws on a whitespace-only id", () => {
		expect(() => buildProductionOrderDeepLink("   ")).toThrow();
	});
});

describe("shouldShowProductionOrderDeepLink", () => {
	const PRODUCTION_REASON = "consumo_produccion" as const;
	const NON_PRODUCTION_REASON = "compra" as const;

	it("returns true when the movement is a production-origin and the deduction has a non-null production_order_id", () => {
		expect(
			shouldShowProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(true);
	});

	it("returns false when the movement is a production-origin but the deduction has a null production_order_id (legacy batch)", () => {
		expect(
			shouldShowProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: null,
			}),
		).toBe(false);
	});

	it("returns false when the movement is a production-origin but there is no deduction id at all", () => {
		expect(
			shouldShowProductionOrderDeepLink({
				reason: PRODUCTION_REASON,
				productionDeductionId: null,
				productionOrderId: null,
			}),
		).toBe(false);
	});

	it("returns false when the reason is NOT production-origin even if a production_order_id is somehow present", () => {
		expect(
			shouldShowProductionOrderDeepLink({
				reason: NON_PRODUCTION_REASON,
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(false);
	});

	it("returns false when the reason is a reversal (defense in depth: reversals link to the original movement, not to a production order)", () => {
		expect(
			shouldShowProductionOrderDeepLink({
				reason: "reversion",
				productionDeductionId: "pd-1",
				productionOrderId: "po-1",
			}),
		).toBe(false);
	});
});
