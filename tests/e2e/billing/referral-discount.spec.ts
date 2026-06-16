import { test, expect } from "@playwright/test";

test.describe("Referral Discount Display", () => {
	test("billing settings card does not show discount line by default", async ({
		page,
	}) => {
		// This test verifies the discount UI path exists but is inactive
		// when no referral data is present. Full verification requires seeded
		// data which is done via fixture scripts.
		await page.goto("/settings");
		await page.waitForURL("/settings");

		// Billing card should render
		await expect(
			page.getByText(/Facturación|Pago requerido|Suscripción/i),
		).toBeVisible({ timeout: 15000 });

		// Discount line should NOT be visible for non-referred users
		const discountLine = page.getByText(/Descuento aplicado/i);
		await expect(discountLine).toHaveCount(0);
	});
});
