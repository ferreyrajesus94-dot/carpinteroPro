import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("QuoteList 'Sin cliente' label", () => {
	it("renders 'Sin cliente' for quotes without a client, never an em-dash", () => {
		const source = readFileSync(
			resolve(__dirname, "QuoteList.tsx"),
			"utf8",
		);
		// No remaining "—"-as-fallback pattern inside the client column.
		expect(source).not.toMatch(/client\?\.name\s*\?\?\s*\(\s*<span[^>]*>—</);
	});
});
