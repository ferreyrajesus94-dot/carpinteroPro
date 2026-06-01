import { describe, expect, it } from "vitest";
import config from "./vite.config";

type RuntimeCachingEntry = {
	urlPattern?: string | RegExp | ((input: { url: URL }) => boolean);
	handler?: string;
	options?: { cacheName?: string };
};

const SUPABASE_REST_URL = "https://demo.supabase.co/rest/v1/quotes";

describe("vite pwa privacy config", () => {
	it("does not configure runtime caching for supabase rest endpoints", () => {
		const pwaPlugin = (config.plugins ?? []).find((plugin) => {
			return (
				typeof plugin === "object" &&
				plugin !== null &&
				"name" in plugin &&
				plugin.name === "vite-plugin-pwa"
			);
		}) as
			| {
					api?: {
						options?: {
							workbox?: {
								runtimeCaching?: RuntimeCachingEntry[];
							};
						};
					};
			  }
			| undefined;

		const runtimeCaching =
			pwaPlugin?.api?.options?.workbox?.runtimeCaching ?? [];

		const hasSupabaseRestRuntimeCache = runtimeCaching.some((entry) => {
			const pattern = entry.urlPattern;
			if (typeof pattern === "string") {
				return (
					pattern.includes("supabase.co/rest") || pattern.includes("/rest/")
				);
			}
			if (pattern instanceof RegExp) {
				return pattern.test(SUPABASE_REST_URL);
			}
			if (typeof pattern === "function") {
				return pattern({ url: new URL(SUPABASE_REST_URL) });
			}
			return false;
		});

		expect(hasSupabaseRestRuntimeCache).toBe(false);
	});
});
