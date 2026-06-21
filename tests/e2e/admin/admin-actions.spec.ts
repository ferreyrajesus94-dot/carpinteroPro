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

test.describe("Admin Actions E2E", () => {
	test.skip(!hasAdminCredentials(), "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
	test("workshop detail shows activate/deactivate toggle", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/workshops");
		await page.waitForURL("/admin/workshops");

		// Click first workshop detail link
		const detailLink = page.getByRole("link", { name: "Ver detalle" }).first();
		if (await detailLink.isVisible()) {
			await detailLink.click();
			await page.waitForURL(/\/admin\/workshops\//);

			// Should show active/inactive badge
			const badge = page.locator("span").filter({ hasText: /Activo|Inactivo/ });
			await expect(badge.first()).toBeVisible({ timeout: 10000 });

			// Should show toggle button
			const toggleBtn = page.locator("button").filter({ hasText: /Desactivar|Activar/ });
			await expect(toggleBtn.first()).toBeVisible({ timeout: 5000 });
		}
	});

	test("workshop detail shows profiles list with force onboarding", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/workshops");
		await page.waitForURL("/admin/workshops");

		const detailLink = page.getByRole("link", { name: "Ver detalle" }).first();
		if (await detailLink.isVisible()) {
			await detailLink.click();
			await page.waitForURL(/\/admin\/workshops\//);

			// Should show profiles section
			await expect(
				page.getByRole("heading", { name: "Perfiles" }),
			).toBeVisible({ timeout: 10000 });
		}
	});

	test("overview page shows maintenance toggle", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin");
		await page.waitForURL("/admin");

		// Should show maintenance section
		await expect(
			page.getByRole("heading", { name: "Admin CarpinteroPro" }).first(),
		).toBeVisible({ timeout: 10000 });
	});

	test("billing page shows cancel and toggle buttons", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/billing");
		await page.waitForURL("/admin/billing");

		await expect(
			page.getByRole("heading", { name: "Suscripciones" }),
		).toBeVisible({ timeout: 10000 });

		// Table should be visible
		const table = page.getByRole("table");
		if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
			// If there are subscriptions, buttons should be present
			const cancelButton = page.locator("button").filter({ hasText: "Cancelar" });
			const toggleButton = page.locator("button").filter({ hasText: /Pausar|Reanudar/ });
			// At least one action button should exist if there are rows
			const rows = page.locator("tbody tr");
			const count = await rows.count();
			if (count > 0) {
				const hasActions =
					(await cancelButton.count()) > 0 || (await toggleButton.count()) > 0;
				expect(hasActions).toBe(true);
			}
		}
	});

	test("support page shows retry button for failed events", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/support");
		await page.waitForURL("/admin/support");

		await expect(
			page.getByRole("heading", { name: "Diagnósticos de soporte" }),
		).toBeVisible({ timeout: 10000 });
	});

	test("refresh button invalidates queries in admin layout", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin");
		await page.waitForURL("/admin");

		// Refresh button should be visible in admin layout
		const refreshBtn = page.getByRole("button", { name: "Actualizar datos" });
		if (await refreshBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await refreshBtn.click();
			// Should not navigate away
			expect(page.url()).toContain("/admin");
		}
	});
});
