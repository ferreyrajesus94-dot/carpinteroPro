import { describe, it, expect } from "vitest";
import { escapeForOrFilter } from "./index";

describe("escapeForOrFilter", () => {
	it("escapes commas so the .or() clause is not split", () => {
		expect(escapeForOrFilter("a,b")).toBe("a\\,b");
	});

	it("escapes backslashes first so subsequent escapes are not double-escaped", () => {
		expect(escapeForOrFilter("a\\b")).toBe("a\\\\b");
		expect(escapeForOrFilter("a\\,b")).toBe("a\\\\\\,b");
	});

	it("escapes the ilike wildcards % and _", () => {
		expect(escapeForOrFilter("100%")).toBe("100\\%");
		expect(escapeForOrFilter("a_b")).toBe("a\\_b");
	});

	it("escapes grouping parentheses", () => {
		expect(escapeForOrFilter("(madera)")).toBe("\\(madera\\)");
	});

	it("leaves normal characters alone", () => {
		expect(escapeForOrFilter("mesa de comedor")).toBe("mesa de comedor");
		expect(escapeForOrFilter("PR-2026002")).toBe("PR-2026002");
	});

	it("escapes every special char in a single pass (no ordering bugs)", () => {
		// Combined stress test: backslash, comma, paren, percent, underscore.
		expect(escapeForOrFilter("a\\,b(c)100%_x")).toBe(
			"a\\\\\\,b\\(c\\)100\\%\\_x",
		);
	});
});
