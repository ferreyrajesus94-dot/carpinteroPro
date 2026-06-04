import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/shared/lib/formatters";

describe("formatCurrency", () => {
	it("formats ARS amounts using the existing Argentine currency behavior", () => {
		expect(formatCurrency(1000)).toBe("$ 1.000");
		expect(formatCurrency(0)).toBe("$ 0");
		expect(formatCurrency(1234.56)).toBe("$ 1.235");
		expect(formatCurrency(-500)).toBe("-$ 500");
	});
});
