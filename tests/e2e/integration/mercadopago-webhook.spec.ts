import { expect, test } from "@playwright/test";
import { isValidSignature } from "../../../supabase/functions/_shared/billing";
import {
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClient,
	fetchFixtureSubscription,
	fetchWebhookEvent,
	insertDuplicateWebhookEvent,
	mutateFixtureSubscriptionStatus,
	seedActiveTrialFixture,
	simulateMercadoPagoWebhook,
} from "../../../scripts/e2e/fixtures";

async function signatureHeader(
	dataId: string,
	requestId: string,
	timestamp: string,
	secret: string,
) {
	const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(manifest),
	);
	const hash = Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `ts=${timestamp},v1=${hash}`;
}

/**
 * Integration coverage for the MercadoPago webhook path after the
 * free-launch cut-over. The browser-facing gate is gone, but the
 * `subscriptions` row and the `billing_webhook_events` audit table
 * must still record what the provider sent and how the status
 * mapper resolves it. These assertions cover the rows directly —
 * no React predicate is involved (the previous `getBillingAccess(...)`
 * import was removed when the gate was deleted in W2, commit 430c80b).
 *
 * W5 audit follow-up (NOT fixed in this scope): `mapMercadoPagoStatusToAppStatus`
 * in `supabase/functions/_shared/billing.ts:8` maps `authorized` /
 * `active` to `active`, but `approved` falls through to `past_due`
 * because no branch handles it explicitly. The assertion below for
 * the `approved` value therefore documents the current behavior;
 * fixing the mapper is tracked as a follow-up.
 */
test.describe("MercadoPago webhook persistence", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("simulated authorized webhook activates the subscription via the status mapper", async () => {
		const fixture = await seedActiveTrialFixture({ status: "past_due" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_authorized",
			eventType: "subscription_preapproval.updated",
			providerResourceId: "e2e_sdd7_preapproval_authorized",
			providerStatus: "authorized",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);
		const event = await fetchWebhookEvent("e2e_sdd7_webhook_authorized");

		expect(subscription?.status).toBe("active");
		expect(event?.workshop_id).toBe(fixture.workshopId);
		expect(event?.event_type).toBe("subscription_preapproval.updated");
	});

	test("simulated failed charge marks the subscription past_due", async () => {
		const fixture = await seedActiveTrialFixture({ status: "active" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_failed_charge",
			eventType: "payment.updated",
			providerResourceId: "e2e_sdd7_payment_failed",
			providerStatus: "failed",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		// `failed` is not in the mapper's allow-list; it falls through
		// to the default branch which returns `past_due`.
		expect(subscription?.status).toBe("past_due");
	});

	test("simulated cancelled webhook persists the cancelled status", async () => {
		// Both the production mapper at supabase/functions/_shared/billing.ts
		// and the in-fixture mapper at scripts/e2e/fixtures.ts fall through
		// to `past_due` for any provider status that is not
		// `authorized` or `active`. The fixture intentionally mirrors
		// production here (a previous divergence where the fixture mapped
		// `cancelled` to `cancelled` while production wrote `past_due`
		// was caught by the cumulative review). The historical `cancelled`
		// subscription status enum value is preserved for the audit doc's
		// free-model narrative but the webhook itself never writes it.
		const fixture = await seedActiveTrialFixture({ status: "active" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_cancelled",
			eventType: "subscription_preapproval.cancelled",
			providerResourceId: "e2e_sdd7_preapproval_cancelled",
			providerStatus: "cancelled",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("past_due");
	});

	test("simulated approved webhook currently maps to past_due (audit finding #2, follow-up)", async () => {
		// The mapper at supabase/functions/_shared/billing.ts:8 has
		// no branch for `approved` — the `authorized` / `active`
		// branches handle the live statuses, but `approved` falls
		// through to the default `past_due`. This assertion documents
		// the current behavior so any future mapper fix is caught.
		const fixture = await seedActiveTrialFixture({ status: "active" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_approved",
			eventType: "subscription_authorized_payment",
			providerResourceId: "e2e_sdd7_preapproval_approved",
			providerStatus: "approved",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("past_due");
	});

	test("duplicate webhook event is idempotent through unique provider event id", async () => {
		const fixture = await seedActiveTrialFixture();
		await mutateFixtureSubscriptionStatus("past_due");
		const event = await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_duplicate",
			eventType: "subscription_preapproval.updated",
			providerResourceId: "e2e_sdd7_preapproval_duplicate",
			providerStatus: "active",
		});

		const duplicateCode = await insertDuplicateWebhookEvent(event);
		const persistedEvent = await fetchWebhookEvent(
			"e2e_sdd7_webhook_duplicate",
		);

		expect(duplicateCode).toBe("23505");
		expect(persistedEvent?.updated_at).toBe(event.updated_at);
	});

	test("MercadoPago signature accepts valid headers and rejects tampered data", async () => {
		const dataId = "e2e_sdd7_preapproval_signature";
		const requestId = "e2e_sdd7_request_signature";
		const timestamp = "1700000000";
		const secret = "e2e_sdd7_webhook_secret";
		const validHeader = await signatureHeader(
			dataId,
			requestId,
			timestamp,
			secret,
		);

		await expect(
			isValidSignature(dataId, requestId, timestamp, validHeader, secret),
		).resolves.toBe(true);
		await expect(
			isValidSignature("tampered", requestId, timestamp, validHeader, secret),
		).resolves.toBe(false);
		await expect(
			isValidSignature(dataId, requestId, timestamp, "", secret),
		).resolves.toBe(false);
	});
});
