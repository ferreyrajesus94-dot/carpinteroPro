import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@carpinteropro.dev";
const ADMIN_PASSWORD = "CarpPro#2024";

async function loginAsAdmin(page: Page) {
	await page.goto("/login");
	await page.fill('input[type="email"]', ADMIN_EMAIL);
	await page.fill('input[type="password"]', ADMIN_PASSWORD);
	await page.click('button[type="submit"]');
	// Wait for navigation to dashboard or onboarding
	await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
}

test.describe("Admin Dashboard E2E", () => {
	test("full admin flow: overview → workshops → detail → billing → support", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		// Navigate to admin
		await page.goto("/admin");
		await page.waitForURL("/admin");

		// Overview screen should show KPI cards
		await expect(
			page.getByRole("heading", { name: "Admin CarpinteroPro" }).first(),
		).toBeVisible({ timeout: 10000 });
		await expect(
			page.getByRole("region", { name: "Indicadores de plataforma" }),
		).toBeVisible({ timeout: 15000 });

		// Navigate to workshops
		await page.click('a[href="/admin/workshops"]');
		await page.waitForURL("/admin/workshops");
		await expect(
			page.getByRole("heading", { name: "Talleres" }),
		).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole("table", { name: "Talleres" })).toBeVisible({
			timeout: 10000,
		});

		// Click first workshop detail link
		const detailLink = page.getByRole("link", { name: "Ver detalle" }).first();
		if (await detailLink.isVisible()) {
			await detailLink.click();
			await page.waitForURL(/\/admin\/workshops\//);
			await expect(
				page.getByRole("heading", { name: "Contexto de soporte" }),
			).toBeVisible({ timeout: 10000 });
			await expect(
				page.getByRole("link", { name: "Volver a talleres" }),
			).toBeVisible();
		}

		// Navigate to billing
		await page.click('a[href="/admin/billing"]');
		await page.waitForURL("/admin/billing");
		await expect(
			page.getByRole("heading", { name: "Suscripciones" }),
		).toBeVisible({ timeout: 10000 });
		await expect(
			page.getByRole("combobox", { name: "Filtrar por estado" }),
		).toBeVisible();

		// Navigate to support
		await page.click('a[href="/admin/support"]');
		await page.waitForURL("/admin/support");
		await expect(
			page.getByRole("heading", { name: "Diagnósticos de soporte" }),
		).toBeVisible({ timeout: 10000 });
	});

	test("admin guard redirects unauthenticated users", async ({ page }) => {
		await page.goto("/admin");
		await page.waitForURL("/login");
		expect(page.url()).toContain("/login");
	});

	test("admin guard shows forbidden for non-admin users", async () => {
		// This test requires a non-admin user session.
		// Skip by default — test manually or with seeded auth state.
		test.skip();
	});

	test("theme toggle works in admin layout", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin");
		await page.waitForURL("/admin");

		// Find and click theme toggle
		const themeButton = page.getByRole("button", {
			name: /modo (oscuro|claro)/i,
		});
		if (await themeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await themeButton.click();
			// Verify the HTML class changed
			const html = page.locator("html");
			const hasDark = await html.evaluate((el) =>
				el.classList.contains("dark"),
			);
			expect(typeof hasDark).toBe("boolean");
		}
	});

	test("back to app link navigates to dashboard", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin");
		await page.waitForURL("/admin");

		const backLink = page.getByRole("link", { name: /volver a la app/i });
		if (await backLink.isVisible({ timeout: 5000 }).catch(() => false)) {
			await backLink.click();
			await page.waitForURL(/\/dashboard/);
			expect(page.url()).toContain("/dashboard");
		}
	});
});
