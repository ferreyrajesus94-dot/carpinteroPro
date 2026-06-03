import { expect, test } from "@playwright/test";
import { getBillingAccess } from "../../../src/features/billing/lib/access";
import { isValidSignature } from "../../../supabase/functions/_shared/billing";
import {
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClient,
	fetchFixtureSubscription,
	fetchWebhookEvent,
	insertDuplicateWebhookEvent,
	simulateMercadoPagoWebhook,
	mutateFixtureSubscriptionStatus,
	seedActiveTrialFixture,
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

test.describe("MercadoPago webhook persistence", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("simulated authorized webhook activates subscription and records event", async () => {
		const fixture = await seedActiveTrialFixture({ status: "past_due" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_authorized",
			eventType: "subscription_preapproval.updated",
			providerResourceId: "e2e_sdd7_preapproval_authorized",
			providerStatus: "active",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);
		const event = await fetchWebhookEvent("e2e_sdd7_webhook_authorized");

		expect(subscription?.status).toBe("active");
		expect(getBillingAccess(subscription, new Date())).toBe("allowed");
		expect(event?.workshop_id).toBe(fixture.workshopId);
		expect(event?.event_type).toBe("subscription_preapproval.updated");
	});

	test("simulated failed charge marks subscription past_due", async () => {
		const fixture = await seedActiveTrialFixture({ status: "active" });
		const client = await createAuthenticatedFixtureClient();

		await simulateMercadoPagoWebhook(fixture.workshopId, {
			providerEventId: "e2e_sdd7_webhook_failed_charge",
			eventType: "payment.updated",
			providerResourceId: "e2e_sdd7_payment_failed",
			providerStatus: "past_due",
		});

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("past_due");
		expect(getBillingAccess(subscription, new Date())).toBe("blocked");
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
