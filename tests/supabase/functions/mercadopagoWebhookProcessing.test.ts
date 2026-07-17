import { describe, expect, it } from "vitest";
import {
	decodeMercadoPagoResource,
	evaluateProviderFreshness,
	emitBillingPlatformDiagnostic,
	processMercadoPagoWebhook,
	type BillingPlatformDiagnostic,
} from "../../../supabase/functions/_shared/mercadopago-webhook-processing";

const preapproval = {
	id: "pre_123",
	status: "authorized",
	last_modified: "2026-07-17T10:00:00.000Z",
};

function dependencies(overrides = {}) {
	const rpc = async () => ({ data: { outcome: "completed", applied: true }, error: null });
	return {
		fetchResource: async () => ({ status: 200, resource: preapproval }),
		resolveSubscription: async () => true,
		rpc,
		logger: { emit: () => undefined },
		...overrides,
	};
}

describe("decodeMercadoPagoResource", () => {
	it("decodes allowed resource facts and primary timestamps", () => {
		expect(decodeMercadoPagoResource("preapproval", preapproval)).toMatchObject({
			kind: "preapproval",
			id: "pre_123",
			providerSnapshotAt: "2026-07-17T10:00:00.000Z",
		});
	});

	it("uses valid fallbacks, represents missing timestamps, and rejects malformed values", () => {
		expect(decodeMercadoPagoResource("payment", { id: "pay", status: "approved", date_created: "2026-07-17T10:00:00.000Z", preapproval: { id: "pre" } })).toMatchObject({ providerSnapshotAt: "2026-07-17T10:00:00.000Z" });
		expect(decodeMercadoPagoResource("preapproval", { id: "pre", status: "authorized", date_created: "2026-07-17T11:00:00.000Z" })).toMatchObject({ providerSnapshotAt: "2026-07-17T11:00:00.000Z" });
		expect(decodeMercadoPagoResource("authorized_payment", { id: "auth", status: "approved", preapproval_id: "pre" })).toMatchObject({ providerSnapshotAt: null });
		expect(decodeMercadoPagoResource("preapproval", { ...preapproval, last_modified: "not-a-date" })).toBeNull();
	});

	it("requires linkage and valid commission facts for payment resources", () => {
		expect(decodeMercadoPagoResource("payment", { id: "pay", status: "approved" })).toBeNull();
		expect(decodeMercadoPagoResource("authorized_payment", { id: "auth", status: "approved", preapproval_id: "pre", transaction_amount: -1 })).toBeNull();
		expect(decodeMercadoPagoResource("authorized_payment", { id: "auth", status: "approved", preapproval_id: "pre", transaction_amount: 12.5, currency_id: "ARS", date_created: "2026-07-17T10:00:00.000Z" })).toMatchObject({ commission: { providerPaymentId: "auth", paymentAmount: 12.5, currency: "ARS" } });
	});
});

describe("evaluateProviderFreshness", () => {
	it("allows newer snapshots and no-ops equal snapshots for the same resource", () => {
		expect(evaluateProviderFreshness("2026-07-17T11:00:00.000Z", "2026-07-17T10:00:00.000Z", true, "preapproval")).toBe("apply");
		expect(evaluateProviderFreshness("2026-07-17T10:00:00.000Z", "2026-07-17T10:00:00.000Z", true, "preapproval")).toBe("noop");
	});
	it("fails closed for stale and equal cross-resource snapshots", () => {
		expect(evaluateProviderFreshness("2026-07-17T09:00:00.000Z", "2026-07-17T10:00:00.000Z", true, "preapproval")).toBe("stale");
		expect(evaluateProviderFreshness("2026-07-17T10:00:00.000Z", "2026-07-17T10:00:00.000Z", false, "preapproval")).toBe("uncertain");
	});
	it("allows missing timestamps only for the same bound preapproval", () => {
		expect(evaluateProviderFreshness(null, null, true, "preapproval")).toBe("apply");
		expect(evaluateProviderFreshness(null, null, true, "payment")).toBe("uncertain");
		expect(evaluateProviderFreshness(null, null, true, "authorized_payment")).toBe("uncertain");
	});
});

describe("emitBillingPlatformDiagnostic", () => {
	it("copies only allowlisted diagnostic fields", () => {
		const entries: BillingPlatformDiagnostic[] = [];
		emitBillingPlatformDiagnostic({ emit: (entry) => entries.push(entry) }, {
			schemaVersion: 1, component: "mercadopago_webhook", correlationId: "generated-id", code: "provider_rate_limited", stage: "provider_fetch", retryable: true, httpStatus: 503, provider: "mercadopago", providerHttpStatus: 429,
			secret: "never-log", rawPayload: { token: "never-log" }, error: new Error("never-log"),
		} as BillingPlatformDiagnostic);
		expect(entries).toEqual([{ schemaVersion: 1, component: "mercadopago_webhook", correlationId: "generated-id", code: "provider_rate_limited", stage: "provider_fetch", retryable: true, httpStatus: 503, provider: "mercadopago", providerHttpStatus: 429 }]);
	});
});

describe("processMercadoPagoWebhook", () => {
	it("calls the RPC only after a linked, decoded provider resource", async () => {
		let rpcCalls = 0;
		const result = await processMercadoPagoWebhook({ providerEventId: "event-1", eventType: "subscription_preapproval", resourceKind: "preapproval", resourceId: "pre_123", correlationId: "corr-1" }, dependencies({ rpc: async () => { rpcCalls++; return { data: { outcome: "completed", applied: true }, error: null }; } }));
		expect(result).toMatchObject({ httpStatus: 200, outcome: "completed", retryable: false });
		expect(rpcCalls).toBe(1);
	});

	it.each([
		[400, "provider_rejected", 200, false], [404, "provider_not_found", 200, false], [429, "provider_rate_limited", 503, true], [418, "provider_client_error", 502, true], [500, "provider_unavailable", 502, true],
	] as const)("maps provider %i to sanitized %s", async (status, code, httpStatus, retryable) => {
		let rpcCalls = 0;
		const entries: BillingPlatformDiagnostic[] = [];
		const result = await processMercadoPagoWebhook({ providerEventId: "event-2", eventType: "payment", resourceKind: "payment", resourceId: "pay_1", correlationId: "corr-2" }, dependencies({ fetchResource: async () => ({ status }), rpc: async () => { rpcCalls++; return { data: null, error: null }; }, logger: { emit: (entry: BillingPlatformDiagnostic) => entries.push(entry) } }));
		expect(result).toMatchObject({ httpStatus, code, retryable });
		expect(rpcCalls).toBe(0);
		expect(entries[0]).toMatchObject({ correlationId: "corr-2", code, httpStatus, retryable });
	});

	it.each([
		["provider fetch", { fetchResource: async () => { throw new Error("provider token=secret"); } }, "provider_fetch", 0],
		["subscription resolution", { resolveSubscription: async () => { throw new Error("resolver token=secret"); } }, "subscription_resolution", 1],
		["RPC", { rpc: async () => { throw new Error("rpc token=secret"); } }, "rpc", 1],
	] as const)("contains rejected %s dependencies with one sanitized retryable diagnostic", async (_boundary, override, stage, expectedResolverCalls) => {
		let resolverCalls = 0, rpcCalls = 0;
		const entries: BillingPlatformDiagnostic[] = [];
		const result = await processMercadoPagoWebhook({ providerEventId: "event-rejected", eventType: "subscription_preapproval", resourceKind: "preapproval", resourceId: "pre_123", correlationId: "corr-rejected" }, dependencies({ ...override, resolveSubscription: async () => { resolverCalls++; return "resolveSubscription" in override ? await override.resolveSubscription() : true; }, rpc: async () => { rpcCalls++; return "rpc" in override ? await override.rpc() : { data: { outcome: "completed" }, error: null }; }, logger: { emit: (entry: BillingPlatformDiagnostic) => entries.push(entry) } }));
		expect(result).toMatchObject({ httpStatus: 502, code: "provider_unavailable", outcome: "retryable", retryable: true });
		expect(resolverCalls).toBe(expectedResolverCalls);
		expect(rpcCalls).toBe("rpc" in override ? 1 : 0);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ correlationId: "corr-rejected", code: "provider_unavailable", stage, retryable: true, httpStatus: 502 });
		expect(entries[0]).not.toHaveProperty("error");
		expect(entries[0]).not.toHaveProperty("rawPayload");
		expect(entries[0]).not.toHaveProperty("credential");
		expect(entries[0]).not.toHaveProperty("token");
	});

	it("emits one sanitized missing-subscription diagnostic and skips the RPC", async () => {
		let rpcCalls = 0;
		const entries: BillingPlatformDiagnostic[] = [];
		const result = await processMercadoPagoWebhook({ providerEventId: "event-missing", eventType: "subscription_preapproval", resourceKind: "preapproval", resourceId: "pre_123", correlationId: "corr-missing" }, dependencies({ resolveSubscription: async () => false, rpc: async () => { rpcCalls++; return { data: null, error: null }; }, logger: { emit: (entry: BillingPlatformDiagnostic) => entries.push(entry) } }));
		expect(result).toMatchObject({ httpStatus: 200, code: "missing_subscription", retryable: false });
		expect(rpcCalls).toBe(0);
		expect(entries).toEqual([{ schemaVersion: 1, component: "mercadopago_webhook", correlationId: "corr-missing", code: "missing_subscription", stage: "subscription_resolution", retryable: false, httpStatus: 200, provider: "mercadopago", resourceKind: "preapproval" }]);
	});

	it("fails closed for malformed resources and maps retryable RPC errors", async () => {
		const malformed = await processMercadoPagoWebhook({ providerEventId: "event-3", eventType: "payment", resourceKind: "payment", resourceId: "pay_1", correlationId: "corr-3" }, dependencies({ fetchResource: async () => ({ status: 200, resource: { id: "pay", status: "approved" } }) }));
		expect(malformed).toMatchObject({ httpStatus: 502, code: "invalid_provider_resource", retryable: true });
		const rpcFailure = await processMercadoPagoWebhook({ providerEventId: "event-4", eventType: "subscription_preapproval", resourceKind: "preapproval", resourceId: "pre_123", correlationId: "corr-4" }, dependencies({ rpc: async () => ({ data: null, error: { message: "db unavailable" } }) }));
		expect(rpcFailure).toMatchObject({ httpStatus: 500, outcome: "retryable", retryable: true });
	});
});
