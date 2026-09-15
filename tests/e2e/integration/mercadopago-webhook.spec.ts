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
 * The fixture's `simulateMercadoPagoWebhook` re-exports the production
 * `mapMercadoPagoStatusToAppStatus` from `supabase/functions/_shared/billing.ts`
 * (see `scripts/e2e/fixtures.ts`), so the rows persisted here MUST
 * match what a real webhook run would write. The `approved` case
 * below intentionally asserts `past_due` because the production mapper
 * has no explicit branch for `approved` -- it falls through to the
 * default branch. That is the correct, documented production behavior,
 * not a known bug.
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
		// The production mapper has an explicit `cancelled` branch that
		// returns `cancelled`. The fixture now re-exports the production
		// helper (see `scripts/e2e/fixtures.ts`), so the persisted row
		// reflects that branch exactly. Earlier revisions of this spec
		// asserted `past_due` because the in-fixture mapper silently
		// aliased every non-active branch to past_due; that divergence
		// is corrected by `scripts/e2e/fixtures-mapper.test.ts`.
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

		expect(subscription?.status).toBe("cancelled");
	});

	test("simulated approved webhook falls through to past_due", async () => {
		// The production mapper has no explicit branch for `approved`,
		// so it falls through to the default `past_due` branch. This
		// is the documented production behavior (any unrecognised
		// provider status maps to `past_due`); the assertion locks it
		// in so any future mapper addition for `approved` is caught
		// here rather than silently changing webhook persistence.
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
