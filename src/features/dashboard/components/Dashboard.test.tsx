import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dashboard page overflow", () => {
	it("constrains the page wrapper with min-w-0 so the recent-quotes table can scroll internally without growing the page", () => {
		// The fix is a single class on the page-level <div> in Dashboard.tsx.
		// We assert the source contains 'min-w-0' on the page wrapper so a
		// regression that removes the class fails this test, without needing
		// to render the full component (which pulls in production pipeline +
		// many hooks that would otherwise need mocking).
		const source = readFileSync(
			resolve(__dirname, "Dashboard.tsx"),
			"utf8",
		);
		expect(source).toMatch(
			/<div\s+className=\{?["'`][^"'`]*pb-24[^"'`]*min-w-0/i,
		);
	});
});
