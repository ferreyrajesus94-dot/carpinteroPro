import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	getActiveTrialUser,
	seedActiveTrialFixture,
} from "../../../scripts/e2e/fixtures";

test.describe("billing gate active-trial browser access", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("active trial user can login and reach quotes", async ({ page }) => {
		await seedActiveTrialFixture();
		const user = getActiveTrialUser();

		await page.goto("/login");
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Ingresar" }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByRole("navigation", { name: "Navegación principal" }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();

		await page.goto("/quotes");
		await expect(page).toHaveURL(/\/quotes/);
		await expect(
			page.getByRole("heading", { name: /Presupuestos/i }),
		).toBeVisible();
		await expect(
			page.getByText(/Pago pendiente|Suscripción suspendida/i),
		).toHaveCount(0);
	});
});
