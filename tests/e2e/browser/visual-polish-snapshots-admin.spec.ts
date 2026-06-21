import { expect, test } from "@playwright/test";

test.describe("Visual polish: admin BillingPage snapshots", () => {
	test("BillingPage renders in light mode with data",
		{ tag: ["@snapshot", "@visual", "@admin", "@VISUAL-POLISH-008"] },
		async ({ page }) => {
			await page.goto("/admin/billing");
			await page.waitForLoadState("networkidle");
			// Wait for admin data fetch to resolve (supabase.functions.invoke)
			await page.waitForTimeout(2000);

			// Assert admin content is actually rendered — not just an empty/error state
			await expect(
				page.getByRole("heading", { name: "Suscripciones" }),
			).toBeVisible();
			// Assert the subscription table has data rows
			await expect(
				page.getByRole("table", { name: "Suscripciones" }),
			).toBeVisible();
			// Assert mock data rows are present in the table
			await expect(
				page.getByText("Carpintería El Ñandú"),
			).toBeVisible();
			await expect(
				page.getByText("Mueblería La Estancia"),
			).toBeVisible();
			await expect(
				page.getByText("Taller del Sur"),
			).toBeVisible();

			// Stabilize dynamic timestamp (TanStack Query dataUpdatedAt) before snapshot
			const subtitleLight = page.locator("p").filter({
				hasText: /Actualizado \d{2}:\d{2}/,
			});
			const subCountLight = await subtitleLight.count();
			if (subCountLight > 0) {
				await subtitleLight.evaluate((el) => {
					el.textContent = el.textContent!.replace(
						/· Actualizado \d{2}:\d{2}/,
						"",
					);
				});
			}

			await expect(page).toHaveScreenshot("billing-light.png", {
				fullPage: true,
				maxDiffPixelRatio: 0.01,
			});
		},
	);

	test("BillingPage renders in dark mode with data",
		{ tag: ["@snapshot", "@visual", "@admin", "@VISUAL-POLISH-009"] },
		async ({ page }) => {
			await page.goto("/admin/billing");
			await page.waitForLoadState("networkidle");
			await page.evaluate(() =>
				document.documentElement.classList.add("dark")
			);
			await page.waitForTimeout(2000);

			// Assert admin content is actually rendered in dark mode
			await expect(
				page.getByRole("heading", { name: "Suscripciones" }),
			).toBeVisible();
			await expect(
				page.getByRole("table", { name: "Suscripciones" }),
			).toBeVisible();
			await expect(
				page.getByText("Carpintería El Ñandú"),
			).toBeVisible();

			// Stabilize dynamic timestamp before snapshot
			const subtitleDark = page.locator("p").filter({
				hasText: /Actualizado \d{2}:\d{2}/,
			});
			const subCountDark = await subtitleDark.count();
			if (subCountDark > 0) {
				await subtitleDark.evaluate((el) => {
					el.textContent = el.textContent!.replace(
						/· Actualizado \d{2}:\d{2}/,
						"",
					);
				});
			}

			await expect(page).toHaveScreenshot("billing-dark.png", {
				fullPage: true,
				maxDiffPixelRatio: 0.01,
			});
		},
	);
});
