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

test.describe("Referral Commissions Admin Tab", () => {
	test.skip(!hasAdminCredentials(), "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
	test("commissions tab shows filters and table when data exists", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		// Switch to Comisiones tab
		const comisionesTab = page.getByRole("button", { name: "Comisiones" });
		await comisionesTab.click();

		// Should show the filter controls
		await expect(
			page.getByRole("combobox", { name: /Filtrar por youtuber/i }),
		).toBeVisible({ timeout: 10000 });

		await expect(
			page.getByRole("button", { name: /Exportar CSV/i }),
		).toBeVisible({ timeout: 5000 });

		// If commissions exist, the table should render
		const table = page.getByRole("table", { name: /Comisiones/i });
		if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
			await expect(table.locator("tbody tr").first()).toBeVisible({
				timeout: 5000,
			});
		}
	});

	test("youtubers tab is shown by default", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		// Youtubers tab should be active by default
		await expect(
			page.getByRole("heading", { name: "Youtubers" }),
		).toBeVisible({ timeout: 10000 });

		// Switch to comisiones and back
		await page.getByRole("button", { name: "Comisiones" }).click();
		await page.getByRole("button", { name: "Youtubers" }).click();

		// Should be back on youtubers
		await expect(
			page.getByRole("heading", { name: "Youtubers" }),
		).toBeVisible({ timeout: 5000 });
	});

	test("export CSV button is present in commissions tab", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/admin/referidos");
		await page.waitForURL("/admin/referidos");

		await page.getByRole("button", { name: "Comisiones" }).click();

		// CSV button should be present
		const csvButton = page.getByRole("button", { name: /Exportar CSV/i });
		await expect(csvButton).toBeVisible({ timeout: 10000 });
	});

	test("nav item is visible for admin user", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin");
		await page.waitForURL("/admin");

		// Referidos nav item should be visible
		const navLink = page.getByRole("link", { name: /Referidos/i });
		await expect(navLink).toBeVisible({ timeout: 10000 });
		await expect(navLink).toHaveAttribute("href", "/admin/referidos");
	});
});
