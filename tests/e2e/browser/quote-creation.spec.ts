import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	fetchFixtureQuoteByFurnitureName,
	getActiveTrialUser,
	seedQuoteWorkflowFixture,
} from "../../../scripts/e2e/fixtures";

test.describe("quote creation operational workflow", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("creates a quote from seeded recipe data and persists calculated costs", async ({
		page,
	}) => {
		const fixture = await seedQuoteWorkflowFixture();
		const user = getActiveTrialUser();

		await page.goto("/login");
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Ingresar" }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		await page.goto("/quotes/new");
		await expect(
			page.getByRole("heading", { name: /Nuevo presupuesto/ }),
		).toBeVisible();

		await page
			.getByRole("button", { name: /SDD 7 Cliente Presupuesto/ })
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: /SDD 7 Mesa Operativa/ }).click();
		await expect(page.getByText(/481/).first()).toBeVisible();

		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Crear" }).click();

		await expect(page).toHaveURL(/\/quotes$/);
		await expect(
			page.getByRole("cell", { name: "SDD 7 Mesa Operativa" }),
		).toBeVisible();
		await expect(page.getByRole("cell", { name: /481/ })).toBeVisible();

		const quote = await fetchFixtureQuoteByFurnitureName(
			"SDD 7 Mesa Operativa",
		);
		expect(quote).toEqual(
			expect.objectContaining({
				client_id: fixture.clientId,
				furniture_template_id: fixture.templateId,
				recipe_cost: fixture.expectedRecipeCost,
				margin_mode: "on_cost",
				margin_pct: 30,
			}),
		);
		expect(quote?.recipe_snapshots).toEqual([
			expect.objectContaining({
				material_id: fixture.materialId,
				quantity: 2,
				waste_pct: 10,
				price_per_unit: 100,
			}),
		]);
		expect(quote?.labor_snapshots).toEqual([
			expect.objectContaining({
				description: "Armado E2E",
				hours: 3,
				rate: 50,
			}),
		]);
	});
});
