import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MaterialForm pack-price placeholder", () => {
	it("uses a single-column grid on small screens so the placeholder is not truncated", () => {
		const source = readFileSync(
			resolve(__dirname, "MaterialForm.tsx"),
			"utf8",
		);
		// The pack section's grid should be grid-cols-1 sm:grid-cols-2 so
		// on the dialog's max-w-lg (≤640px) the inputs stack vertically and
		// the long 'Cargá primero las unidades' placeholder has full width.
		expect(source).toMatch(/grid-cols-1[^"'`]*sm:grid-cols-2/);
	});

	it("keeps the Spanish 'Cargá primero las unidades' placeholder when pack size is empty", () => {
		const source = readFileSync(
			resolve(__dirname, "MaterialForm.tsx"),
			"utf8",
		);
		expect(source).toContain("Cargá primero las unidades");
	});
});
