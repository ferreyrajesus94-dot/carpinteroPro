import { describe, it, expect } from "vitest";
import { NAV_ITEMS } from "./nav-items";

// PR 6 blocker-fix (WARNING): the production feature was wired in
// `src/app/router.tsx` (lazy `ProductionRoutes` mounted at
// `/production/*`) and in `src/app/layouts/nav-items.ts` (a
// `Producción` entry with the `fi-rr-tools` icon). Neither wiring
// had an app-level test; this file adds a small, focused unit test
// for the nav-items surface (the `ProductionRoutes` component is
// already covered by `src/features/production/routes.test.tsx`).

describe("NAV_ITEMS — PR 6 wiring", () => {
	it("includes a /production entry with the Spanish label 'Producción'", () => {
		const production = NAV_ITEMS.find((item) => item.to === "/production");
		expect(production).toBeDefined();
		expect(production?.label).toBe("Producción");
	});

	it("uses the fi-rr-tools icon for the production entry", () => {
		const production = NAV_ITEMS.find((item) => item.to === "/production");
		expect(production?.icon).toBe("fi-rr-tools");
	});

	it("does not expose a contextual FAB label for the production entry (the board has its own on-page trigger)", () => {
		const production = NAV_ITEMS.find((item) => item.to === "/production");
		expect(production?.fabLabel).toBeUndefined();
		expect(production?.fabHref).toBeUndefined();
		expect(production?.fabAction).toBeUndefined();
	});

	it("places the production entry after /inventory (per the workshop workflow order)", () => {
		const inventoryIdx = NAV_ITEMS.findIndex((item) => item.to === "/inventory");
		const productionIdx = NAV_ITEMS.findIndex((item) => item.to === "/production");
		expect(inventoryIdx).toBeGreaterThanOrEqual(0);
		expect(productionIdx).toBeGreaterThan(inventoryIdx);
	});
});
