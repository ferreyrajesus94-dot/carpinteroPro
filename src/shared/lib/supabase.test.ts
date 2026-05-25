import { beforeEach, describe, expect, it, vi } from "vitest";

describe("supabase client tenant headers", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
		vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
	});

	it("does not export workshop header mutation helpers", async () => {
		const module = await import("./supabase");
		const setHelperName = ["set", "Workshop", "Id"].join("");
		const clearHelperName = ["clear", "Workshop", "Id"].join("");

		expect(Object.prototype.hasOwnProperty.call(module, setHelperName)).toBe(
			false,
		);
		expect(Object.prototype.hasOwnProperty.call(module, clearHelperName)).toBe(
			false,
		);
	});
});
