import { expect, test } from "@playwright/test";

test.describe("Visual polish: Dashboard + QuoteList snapshots", () => {
	test("Dashboard renders in light mode",
		{ tag: ["@snapshot", "@visual", "@VISUAL-POLISH-004"] },
		async ({ page }) => {
			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");
			// Assert actual data content is rendered — not loading/error/empty
			await expect(
				page.getByRole("main").getByText("Facturado — Mes actual"),
			).toBeVisible();
			await expect(page.getByText("Pipeline")).toBeVisible();
			// Wait for data to fully render (KPIs, charts, ActiveQuotesPanel)
			await page.waitForTimeout(1000);
			await expect(page).toHaveScreenshot("dashboard-light.png", {
				fullPage: true,
			});
		},
	);

	test("Dashboard renders in dark mode",
		{ tag: ["@snapshot", "@visual", "@VISUAL-POLISH-005"] },
		async ({ page }) => {
			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");
			// Assert data is visible before switching to dark
			await expect(
				page.getByRole("main").getByText("Facturado — Mes actual"),
			).toBeVisible();
			await expect(page.getByText("Pipeline")).toBeVisible();
			await page.evaluate(() =>
				document.documentElement.classList.add("dark")
			);
			await page.waitForTimeout(1000);
			await expect(page).toHaveScreenshot("dashboard-dark.png", {
				fullPage: true,
			});
		},
	);

	test("QuoteList renders in light mode",
		{ tag: ["@snapshot", "@visual", "@VISUAL-POLISH-006"] },
		async ({ page }) => {
			await page.goto("/quotes");
			await page.waitForLoadState("networkidle");
			// Assert real data rows are rendered — not empty/error state
			await expect(
				page.getByRole("heading", { level: 1, name: "Presupuestos" }),
			).toBeVisible();
			await expect(
				page.getByRole("cell", { name: "Biblioteca de pared 3 cuerpos" }),
			).toBeVisible();
			await page.waitForTimeout(1000);
			await expect(page).toHaveScreenshot("quotelist-light.png", {
				fullPage: true,
			});
		},
	);

	test("QuoteList renders in dark mode",
		{ tag: ["@snapshot", "@visual", "@VISUAL-POLISH-007"] },
		async ({ page }) => {
			await page.goto("/quotes");
			await page.waitForLoadState("networkidle");
			// Assert real data before switching to dark
			await expect(
				page.getByRole("heading", { level: 1, name: "Presupuestos" }),
			).toBeVisible();
			await expect(
				page.getByRole("cell", { name: "Biblioteca de pared 3 cuerpos" }),
			).toBeVisible();
			await page.evaluate(() =>
				document.documentElement.classList.add("dark")
			);
			await page.waitForTimeout(1000);
			await expect(page).toHaveScreenshot("quotelist-dark.png", {
				fullPage: true,
			});
		},
	);
});
