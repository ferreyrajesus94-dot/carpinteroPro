import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClient,
	fetchFixtureSubscription,
	mutateFixtureSubscriptionStatus,
	seedActiveTrialFixture,
	setFixtureTrialEndsAt,
} from "../../../scripts/e2e/fixtures";

/**
 * Integration coverage for the `subscriptions` row lifecycle after the
 * free-launch cut-over. The browser-facing gate is gone, but the
 * historical `subscriptions` row must still be readable, mutable, and
 * reflect the timestamps we write. These assertions cover the row
 * directly — no React predicate is involved (the previous
 * `getBillingAccess(...)` import was removed when the gate was deleted
 * in W2, commit 430c80b).
 */
test.describe("subscription state persistence", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("seeded fixture writes a trialing subscription with a future trial_ends_at", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("trialing");
		expect(subscription?.workshop_id).toBe(fixture.workshopId);
		expect(new Date(subscription!.trial_ends_at).getTime()).toBeGreaterThan(
			Date.now(),
		);
	});

	test("mutateFixtureSubscriptionStatus persists the new status on the row", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		await mutateFixtureSubscriptionStatus("past_due");
		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);

		expect(subscription?.status).toBe("past_due");
	});

	test("mutateFixtureSubscriptionStatus accepts every documented status value", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		for (const status of ["active", "trialing", "past_due", "unpaid", "cancelled"] as const) {
			await mutateFixtureSubscriptionStatus(status);
			const subscription = await fetchFixtureSubscription(
				client,
				fixture.workshopId,
			);
			expect(subscription?.status).toBe(status);
		}
	});

	test("setFixtureTrialEndsAt writes a past timestamp that persists", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		const past = new Date("2024-01-01T00:00:00.000Z");
		await setFixtureTrialEndsAt(past);

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);
		expect(new Date(subscription!.trial_ends_at).toISOString()).toBe(
			past.toISOString(),
		);
		expect(new Date(subscription!.trial_ends_at).getTime()).toBeLessThan(
			Date.now(),
		);
	});

	test("setFixtureTrialEndsAt writes a future timestamp that persists", async () => {
		const fixture = await seedActiveTrialFixture();
		const client = await createAuthenticatedFixtureClient();

		const future = new Date("2030-01-01T00:00:00.000Z");
		await setFixtureTrialEndsAt(future);

		const subscription = await fetchFixtureSubscription(
			client,
			fixture.workshopId,
		);
		expect(new Date(subscription!.trial_ends_at).toISOString()).toBe(
			future.toISOString(),
		);
		expect(new Date(subscription!.trial_ends_at).getTime()).toBeGreaterThan(
			Date.now(),
		);
	});
});
