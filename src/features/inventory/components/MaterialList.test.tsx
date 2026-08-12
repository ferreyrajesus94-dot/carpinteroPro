import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MaterialList table layout", () => {
	it("does not render a 'Tendencia' column header", () => {
		const source = readFileSync(
			resolve(__dirname, "MaterialList.tsx"),
			"utf8",
		);
		expect(source).not.toMatch(/TableHead[^>]*>Tendencia</);
	});

	it("does not render a PriceSparkline inside a materials row (the column was removed)", () => {
		const source = readFileSync(
			resolve(__dirname, "MaterialList.tsx"),
			"utf8",
		);
		// After the removal the only remaining PriceSparkline usage is
		// inside the per-detail chart, not in the materials table.
		const tablePriceSparkline = source.match(
			/<TableCell>[\s\S]*?<PriceSparkline[\s\S]*?<\/TableCell>/,
		);
		expect(tablePriceSparkline).toBeNull();
	});
});
