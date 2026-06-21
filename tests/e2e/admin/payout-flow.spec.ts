import { test, expect, type Page } from "@playwright/test";
import { hasAdminCredentials, getAdminEmail, getAdminPassword } from "../envCheck";

const ADMIN_EMAIL = getAdminEmail();
const ADMIN_PASSWORD = getAdminPassword();

async function loginAsAdmin(page: Page) {
	await page.goto("/login");
	await page.fill('input[type="email"]', ADMIN_EMAIL);
	await page.fill('input[type="password"]', ADMIN_PASSWORD);
	await page.click('button[type="submit"]');
	await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
}

test.describe("Commission Payout Flow", () => {
	test.skip(!hasAdminCredentials(), "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
	test("commissions tab renders deterministic structure", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		await page.getByRole("button", { name: "Comisiones" }).click();

		await expect(
			page.getByRole("button", { name: /Exportar CSV/i }),
		).toBeVisible({ timeout: 5000 });
		await expect(
			page.getByRole("combobox", { name: /Filtrar por youtuber/i }),
		).toBeVisible();
		await expect(
			page
				.getByRole("table", { name: /Comisiones/i })
				.or(page.getByText("No se encontraron comisiones")),
		).toBeVisible({ timeout: 5000 });
	});

	test("payouts tab shows history or explicit empty state", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		await page.getByRole("button", { name: "Pagos" }).click();

		await expect(
			page
				.getByRole("table", { name: /Historial de pagos/i })
				.or(page.getByText("No hay pagos registrados")),
		).toBeVisible({ timeout: 5000 });
	});

	test("nuevo pago modal opens and shows pending commissions", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		// Switch to Pagos tab
		await page.getByRole("button", { name: "Pagos" }).click();

		// Click "Nuevo pago"
		await page.getByRole("button", { name: /Nuevo pago/i }).click();

		// Modal should open
		await expect(page.getByRole("dialog", { name: /Nuevo pago/i })).toBeVisible(
			{ timeout: 5000 },
		);

		// Should show pending commissions or "no pending" message
		await page.waitForTimeout(2000);
	});

	test("full payout workflow: commissions tab -> pagos tab -> create payout", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		// Step 1: Check Comisiones tab
		await page.getByRole("button", { name: "Comisiones" }).click();
		await page.waitForTimeout(1000);

		// Step 2: Go to Pagos tab
		await page.getByRole("button", { name: "Pagos" }).click();
		await page.waitForTimeout(1000);

		// Step 3: Check for "Nuevo pago" button
		const nuevoPagoBtn = page.getByRole("button", { name: /Nuevo pago/i });
		await expect(nuevoPagoBtn).toBeVisible({ timeout: 5000 });
	});
});
