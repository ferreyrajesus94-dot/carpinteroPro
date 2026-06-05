import createSubscriptionSource from "../../supabase/functions/create-subscription/index.ts?raw";
import cancelSubscriptionSource from "../../supabase/functions/cancel-subscription/index.ts?raw";
import mercadoPagoWebhookSource from "../../supabase/functions/mercadopago-webhook/index.ts?raw";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// Vitest does not expose the Deno global; the response helper uses Deno.env
// inside `corsHeaders()`. We provide a minimal stub before importing the module
// so the pure helpers can be exercised under npm test. The module URL is
// resolved from `import.meta.url` at runtime; tsc only sees a dynamic
// `import(string)` with a `string` typed argument.
beforeAll(() => {
	const stub: { env: { get: (k: string) => string | undefined } } = {
		env: {
			get: (k: string) =>
				k === "APP_ORIGIN" ? "https://app.example.com" : undefined,
		},
	};
	(globalThis as { Deno?: unknown }).Deno = stub;
});

afterAll(() => {
	delete (globalThis as { Deno?: unknown }).Deno;
});

type ResponseModule = {
	preflight: (req: Request) => Response | null;
	json: (data: unknown, status?: number) => Response;
	err: (message: string, status?: number) => Response;
	structuredErr: (code: string, message: string, status?: number) => Response;
};

function responseUrl(): string {
	const here = (import.meta as ImportMeta & { url: string }).url;
	// tests/supabase-functions/response.test.ts -> ../../supabase/functions/_shared/response.ts
	const idx = here.lastIndexOf("/tests/");
	const base = idx === -1 ? here : here.slice(0, idx + 1);
	return new URL("supabase/functions/_shared/response.ts", base).href;
}

async function loadResponse(): Promise<ResponseModule> {
	return (await import(/* @vite-ignore */ responseUrl())) as ResponseModule;
}

describe("supabase/functions/_shared/response", () => {
	it("json() returns a Response with the provided JSON body, status and content-type", async () => {
		const { json } = await loadResponse();
		const res = json({ hello: "world" }, 201);
		expect(res.status).toBe(201);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		expect(await res.json()).toEqual({ hello: "world" });
	});

	it("json() exposes the configured APP_ORIGIN in CORS", async () => {
		const { json } = await loadResponse();
		const res = json({ ok: true });
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app.example.com",
		);
	});

	it("err() preserves the legacy { error: message } shape", async () => {
		const { err } = await loadResponse();
		const res = err("Boom", 500);
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "Boom" });
	});

	it("structuredErr() returns { error: { code, message } } with status", async () => {
		const { structuredErr } = await loadResponse();
		const res = structuredErr("checkout_unavailable", "Try again later", 503);
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error: { code: "checkout_unavailable", message: "Try again later" },
		});
	});

	it("structuredErr() defaults to status 500 when no status is provided", async () => {
		const { structuredErr } = await loadResponse();
		const res = structuredErr("internal_error", "Unexpected");
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			error: { code: "internal_error", message: "Unexpected" },
		});
	});

	it("structuredErr() does not leak provider payloads, stacks, or raw headers", async () => {
		const { structuredErr } = await loadResponse();
		const res = structuredErr(
			"provider_invalid_response",
			"MercadoPago rejected the request",
			502,
		);
		const body = await res.json();
		expect(body).not.toHaveProperty("stack");
		expect(body).not.toHaveProperty("headers");
		expect(body).not.toHaveProperty("provider");
		expect(body).not.toHaveProperty("x-signature");
	});

	it("preflight() returns a CORS response for OPTIONS, null otherwise", async () => {
		const { preflight } = await loadResponse();
		const options = preflight(
			new Request("https://x.test", { method: "OPTIONS" }),
		);
		expect(options).not.toBeNull();
		expect(options!.status).toBe(200);
		expect(options!.headers.get("Access-Control-Allow-Methods")).toContain(
			"POST",
		);
		const post = preflight(new Request("https://x.test", { method: "POST" }));
		expect(post).toBeNull();
	});
});

// Stable error codes used by the three billing edge functions. This source-text
// guard is intentionally narrow because the project has no Deno test runner yet;
// it verifies that handlers use structuredErr with the promised stable codes and
// no longer call the legacy err() helper.
describe("supabase billing error code contract", () => {
	function expectCodes(source: string, codes: string[]): void {
		for (const code of codes) {
			expect(source).toMatch(new RegExp(`structuredErr\\(\\s*"${code}"`));
		}
		expect(source).not.toMatch(/\berr\(/);
	}

	it("pins create-subscription stable error codes", () => {
		expectCodes(createSubscriptionSource, [
			"method_not_allowed",
			"subscription_lookup_failed",
			"subscription_upsert_failed",
			"auth_failed",
			"checkout_unavailable",
		]);
	});

	it("pins cancel-subscription stable error codes", () => {
		expectCodes(cancelSubscriptionSource, [
			"method_not_allowed",
			"subscription_lookup_failed",
			"no_provider_subscription",
			"subscription_update_failed",
			"auth_failed",
			"cancel_failed",
		]);
	});

	it("pins mercadopago-webhook stable error codes", () => {
		expectCodes(mercadoPagoWebhookSource, [
			"method_not_allowed",
			"webhook_not_configured",
			"missing_signature_headers",
			"invalid_json",
			"missing_data_id",
			"invalid_signature",
			"provider_fetch_failed",
			"subscription_lookup_failed",
			"event_record_failed",
			"subscription_update_failed",
		]);
	});
});
