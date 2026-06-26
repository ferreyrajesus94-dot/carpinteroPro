import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isPersistableQueryKey,
	purgeSensitiveBrowserState,
} from "./cachePrivacy";
import { queryClient } from "./queryClient";

describe("cachePrivacy", () => {
	beforeEach(() => {
		localStorage.clear();
		queryClient.clear();
		vi.unstubAllGlobals();
	});

	it("fails closed for every query key (defensive kill-switch)", () => {
		// The current contract is: no key is persistable. The function exists
		// as a safety net so a future persister wiring cannot accidentally
		// leak workshop data. If a future feature needs persistent cache for
		// non-sensitive data (UI prefs, theme), it must be added to the
		// allowlist in cachePrivacy.ts and wired in queryClient.ts.
		const sensitiveKeys: unknown[][] = [
			["quotes", "workshop-1"],
			["clients", "workshop-1"],
			["tasks", "workshop-1"],
			["materials", "workshop-1"],
			["stock_movements", "material-1"],
			["stock_movements", "ledger", {}],
			["stock_movements", "detail", "mov-1"],
			["price_history", "material-1"],
			["price_history_all", "workshop-1", 30],
			["subscription", "workshop-1"],
			["recipes", "workshop-1"],
			["contract_templates", "workshop-1"],
			["workshop_settings", "workshop-1"],
			["brand-new-query", "value"],
			// Edge cases the kill-switch must also cover:
			[],
			["theme"],
			["ui", "palette", "amber"],
		];

		for (const key of sensitiveKeys) {
			expect(isPersistableQueryKey(key)).toBe(false);
		}
	});

	it("purges targeted app cache state while preserving auth and non-app keys", async () => {
		localStorage.setItem("theme", "dark");
		localStorage.setItem("cp.palette", "amber");
		localStorage.setItem("cp.density", "compact");
		localStorage.setItem("cp.howto.dashboard", "done");
		localStorage.setItem("carpinteroPro.rememberedEmail", "demo@example.com");
		localStorage.setItem("REACT_QUERY_OFFLINE_CACHE", "sensitive");
		localStorage.setItem("carpinteroPro.cache.clients", "sensitive");
		localStorage.setItem("carpinteroPro.business.snapshot", "sensitive");
		localStorage.setItem("sb-project-auth-token", "auth-session");
		localStorage.setItem("third-party-key", "keep-me");

		queryClient.setQueryData(["quotes", "workshop-1"], [{ id: "quote-a" }]);

		const deleteCache = vi.fn().mockResolvedValue(true);
		vi.stubGlobal("caches", { delete: deleteCache });

		await purgeSensitiveBrowserState("logout");

		expect(queryClient.getQueryData(["quotes", "workshop-1"])).toBeUndefined();
		expect(localStorage.getItem("theme")).toBe("dark");
		expect(localStorage.getItem("cp.palette")).toBe("amber");
		expect(localStorage.getItem("cp.density")).toBe("compact");
		expect(localStorage.getItem("cp.howto.dashboard")).toBe("done");
		expect(localStorage.getItem("carpinteroPro.rememberedEmail")).toBe(
			"demo@example.com",
		);
		expect(localStorage.getItem("REACT_QUERY_OFFLINE_CACHE")).toBeNull();
		expect(localStorage.getItem("carpinteroPro.cache.clients")).toBeNull();
		expect(localStorage.getItem("carpinteroPro.business.snapshot")).toBeNull();
		expect(localStorage.getItem("sb-project-auth-token")).toBe("auth-session");
		expect(localStorage.getItem("third-party-key")).toBe("keep-me");
		expect(deleteCache).toHaveBeenCalledWith("supabase-api");
	});

	it("tolerates cleanup errors without throwing", async () => {
		vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		vi.stubGlobal("caches", {
			delete: vi.fn().mockRejectedValue(new Error("denied")),
		});

		await expect(
			purgeSensitiveBrowserState("session-removed"),
		).resolves.toBeUndefined();
	});
});
