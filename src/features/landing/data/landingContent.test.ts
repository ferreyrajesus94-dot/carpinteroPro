import { describe, it, expect } from "vitest";
import { navItems, heroCopy, loginCta, footerColumns } from "./landingContent";

describe("landingContent", () => {
	it("all nav anchor IDs are unique", () => {
		const anchors = navItems.map((n) => n.href);
		const unique = new Set(anchors);
		expect(unique.size).toBe(anchors.length);
	});

	it("primary CTA href is /login", () => {
		expect(heroCopy.primaryCta.href).toBe("/login");
	});

	it("login CTA href is /login", () => {
		expect(loginCta.href).toBe("/login");
	});

	it("no empty strings in required fields", () => {
		for (const item of navItems) {
			expect(item.label.trim().length).toBeGreaterThan(0);
			expect(item.href.trim().length).toBeGreaterThan(0);
		}
		expect(heroCopy.headline.trim().length).toBeGreaterThan(0);
		expect(heroCopy.description.trim().length).toBeGreaterThan(0);
	});

	it("footer legal links point to /terms and /privacy", () => {
		const legalColumn = footerColumns.find((c) => c.title === "Legal");
		expect(legalColumn).toBeDefined();
		const terms = legalColumn!.links.find((l) => l.label === "Términos");
		const privacy = legalColumn!.links.find((l) => l.label === "Privacidad");
		expect(terms?.href).toBe("/terms");
		expect(privacy?.href).toBe("/privacy");
	});
});
