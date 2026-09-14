import { expect, type Page, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	getActiveTrialUser,
	mutateFixtureSubscriptionStatus,
	seedActiveTrialFixture,
} from "../../../scripts/e2e/fixtures";

async function login(page: Page) {
	const user = getActiveTrialUser();
	await page.goto("/login");
	await page.getByLabel("Email").fill(user.email);
	await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
	await page.getByRole("button", { name: "Ingresar" }).click();
}

/**
 * Browser coverage for the historical-subscription / free-launch
 * regression: the React `BillingBlockedScreen` gate was removed in
 * W2 (commit 430c80b). These tests prove that a workshop whose
 * `subscriptions` row was previously mutated to a `past_due` status
 * — or whose `trial_ends_at` is already in the past — can still log
 * in and reach the free dashboard, because the historical row does
 * not gate access. The new assertions check for the dashboard
 * heading, the absence of the legacy block copy, and the absence of
 * any subscribe / update-payment CTA.
 */
test.describe("billing gate removed — historical rows do not block free access", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("user with expired trial reaches the free dashboard without a billing block", async ({
		page,
	}) => {
		await seedActiveTrialFixture({
			trialEndsAt: new Date(Date.now() - 86_400_000),
		});

		await login(page);

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByRole("heading", { name: "Inicio" }),
		).toBeVisible();
		await expect(
			page.getByRole("navigation", { name: "Navegación principal" }).first(),
		).toBeVisible();
		await expect(
			page.getByText(/Tu acceso a la app está suspendido/i),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: /Empezar suscripción/i }),
		).toHaveCount(0);
	});

	test("user with past_due historical row still reaches the free dashboard", async ({
		page,
	}) => {
		await seedActiveTrialFixture();
		await mutateFixtureSubscriptionStatus("past_due");

		await login(page);

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByRole("heading", { name: "Inicio" }),
		).toBeVisible();
		await expect(
			page.getByText("Pago pendiente", { exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByText("Suscripción cancelada", { exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: /Actualizar pago/i }),
		).toHaveCount(0);
	});

	test("user with cancelled historical row still reaches the free dashboard", async ({
		page,
	}) => {
		await seedActiveTrialFixture();
		await mutateFixtureSubscriptionStatus("cancelled");

		await login(page);

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByRole("heading", { name: "Inicio" }),
		).toBeVisible();
		await expect(
			page.getByText(/Suscripción cancelada|Pago pendiente/i),
		).toHaveCount(0);
	});
});
