import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	getActiveTrialUser,
	seedContractQuoteFixture,
} from "../../../scripts/e2e/fixtures";

test.describe("contract and PDF browser surface", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("renders contract data and starts PDF download", async ({ page }) => {
		const fixture = await seedContractQuoteFixture();
		const user = getActiveTrialUser();

		await page.goto("/login");
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Ingresar" }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		await page.goto(`/quotes/${fixture.quoteId}/contract`);
		await expect(
			page.getByRole("heading", { name: `Contrato — ${fixture.quoteNumber}` }),
		).toBeVisible();
		await expect(page.getByText("SDD 7 Cliente Presupuesto")).toBeVisible();
		await expect(page.getByText("SDD 7 Mesa Operativa")).toBeVisible();
		await expect(page.getByText(/481/)).toBeVisible();

		const downloadPromise = page.waitForEvent("download");
		await page.getByRole("button", { name: "Descargar PDF" }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe(
			`presupuesto-${fixture.quoteNumber}.pdf`,
		);
	});
});
