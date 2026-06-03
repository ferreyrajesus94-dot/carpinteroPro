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

test.describe("billing gate blocked browser access", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("expired trial user sees billing block instead of dashboard", async ({
		page,
	}) => {
		await seedActiveTrialFixture({
			trialEndsAt: new Date(Date.now() - 86_400_000),
		});

		await login(page);

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByText("Período de prueba", { exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByText(/Tu acceso a la app está suspendido/i),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: /Empezar suscripción/i }),
		).toBeVisible();
		await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(
			0,
		);
	});

	test("past-due user sees payment-required billing block", async ({
		page,
	}) => {
		await seedActiveTrialFixture();
		await mutateFixtureSubscriptionStatus("past_due");

		await login(page);

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByText("Pago pendiente", { exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByText(/Tu acceso a la app está suspendido/i),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: /Actualizar pago/i }),
		).toBeVisible();
		await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(
			0,
		);
	});
});
