import { expect, test } from "@playwright/test";
import { getBillingAccess } from "../../../src/features/billing/lib/access";
import {
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClient,
	fetchFixtureSubscription,
	mutateFixtureSubscriptionStatus,
	seedActiveTrialFixture,
	setFixtureTrialEndsAt,
} from "../../../scripts/e2e/fixtures";

test.describe("subscription state persistence", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("past_due mutation is visible through authenticated query path and blocks access", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		await mutateFixtureSubscriptionStatus("past_due");
		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("past_due");
		expect(getBillingAccess(subscription, new Date())).toBe("blocked");
	});

	test("trial expiry boundary changes access at one millisecond", async () => {
		const boundary = new Date("2030-01-01T00:00:00.000Z");
		const fixture = await seedActiveTrialFixture({ trialEndsAt: boundary });
		const client = await createAuthenticatedFixtureClient();

		await setFixtureTrialEndsAt(boundary);
		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(
			getBillingAccess(subscription, new Date("2029-12-31T23:59:59.999Z")),
		).toBe("allowed");
		expect(
			getBillingAccess(subscription, new Date("2030-01-01T00:00:00.001Z")),
		).toBe("blocked");
	});
});
