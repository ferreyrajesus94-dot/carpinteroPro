import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>("/src/**/*.{ts,tsx,css}", {
	query: "?raw",
	import: "default",
	eager: true,
});
const config = import.meta.glob<string>(["/index.html", "/vercel.json"], {
	query: "?raw",
	import: "default",
	eager: true,
});

describe("Bundled icons loading contract", () => {
	it("contains no live icon-font classes or remote Flaticon dependencies", () => {
		for (const [path, source] of Object.entries({ ...sources, ...config })) {
			if (/\.(test|spec)\./.test(path)) continue;
			expect(source, path).not.toMatch(/\bfi-(?:rr|br)-|flaticon/i);
		}
	});
	it("retains Google typography and its CSP permissions", () => {
		expect(config["/index.html"]).toContain("fonts.googleapis.com/css2");
		expect(config["/index.html"]).toContain("fonts.gstatic.com");
		expect(config["/vercel.json"]).toContain("https://fonts.googleapis.com");
		expect(config["/vercel.json"]).toContain("https://fonts.gstatic.com");
	});
});
