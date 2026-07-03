import { describe, expect, it } from "vitest";
import { isPersistableQueryKey } from "@/shared/lib/cachePrivacy";

/**
 * Cache-privacy contract for production_orders query keys.
 *
 * Spec: "Query-Key Cache Privacy" — every `production_orders` and
 * `production_order_events` query-key family MUST be non-persistable.
 *
 * This file is intentionally split from `useProductionOrders.test.ts`
 * so that the real `isPersistableQueryKey` policy is exercised here.
 * The companion test file mocks `@/shared/lib/cachePrivacy` to keep
 * the API/hook mocks surgical; mixing both into one file would either
 * mock the policy under test (tautology) or interfere with the
 * API/hook mocks this contract depends on.
 */
describe("production_orders query-key cache privacy (real policy)", () => {
	it("the real isPersistableQueryKey is the defensive kill-switch (returns false for every key, including non-production keys)", () => {
		// Sanity check: confirm the real policy is genuinely a kill-switch
		// (returns false even for keys that are clearly not workshop data).
		// If a future change ever turns this into an allowlist, this
		// assertion fires and surfaces the policy change for review.
		expect(isPersistableQueryKey(["theme"])).toBe(false);
		expect(isPersistableQueryKey(["ui", "palette", "amber"])).toBe(false);
		expect(isPersistableQueryKey([])).toBe(false);
	});

	it("list_production_orders query key is NOT persistable", () => {
		const listKey = ["production_orders", "list", {}];
		expect(isPersistableQueryKey(listKey)).toBe(false);
	});

	it("list_production_orders query key (with filters) is NOT persistable", () => {
		const listKey = [
			"production_orders",
			"list",
			{ states: ["planned", "in_progress"], search: "OP-2026" },
		];
		expect(isPersistableQueryKey(listKey)).toBe(false);
	});

	it("get_production_order query key is NOT persistable", () => {
		const orderId = "11111111-1111-4111-8111-111111111111";
		const detailKey = ["production_orders", "detail", orderId];
		expect(isPersistableQueryKey(detailKey)).toBe(false);
	});

	it("get_production_order_events query key is NOT persistable", () => {
		const orderId = "11111111-1111-4111-8111-111111111111";
		const eventsKey = ["production_orders", "events", orderId];
		expect(isPersistableQueryKey(eventsKey)).toBe(false);
	});

	it("get_production_pipeline_stats query key is NOT persistable", () => {
		const pipelineKey = ["production_orders", "pipeline"];
		expect(isPersistableQueryKey(pipelineKey)).toBe(false);
	});

	it("get_quotes_with_production_status query key is NOT persistable", () => {
		const quotesKey = ["quotes", "with_production_status", {}];
		expect(isPersistableQueryKey(quotesKey)).toBe(false);
	});
});
