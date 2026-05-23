import { describe, it, expect } from "vitest";
import { pricingPlan } from "./pricing";

describe("pricing", () => {
	it("has a non-empty plan name", () => {
		expect(pricingPlan.name.trim().length).toBeGreaterThan(0);
	});

	it("has a non-empty price", () => {
		expect(pricingPlan.price.trim().length).toBeGreaterThan(0);
	});

	it("has a currency", () => {
		expect(pricingPlan.currency.trim().length).toBeGreaterThan(0);
	});

	it("has at least one feature", () => {
		expect(pricingPlan.features.length).toBeGreaterThan(0);
	});

	it("all features are non-empty", () => {
		for (const feature of pricingPlan.features) {
			expect(feature.trim().length).toBeGreaterThan(0);
		}
	});

	it("CTA points to /login", () => {
		expect(pricingPlan.ctaHref).toBe("/login");
	});

	it("CTA label is non-empty", () => {
		expect(pricingPlan.ctaLabel.trim().length).toBeGreaterThan(0);
	});
});
