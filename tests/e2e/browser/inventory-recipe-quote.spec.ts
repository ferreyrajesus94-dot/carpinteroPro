import { expect, test } from "@playwright/test";
import {
	cleanupE2EArtifacts,
	ensureTestClient,
	fetchDbJson,
	getAdminUser,
	quoteSql,
	TEST_CLIENT_ID,
} from "./helpers/e2e-admin";

/**
 * End-to-end browser test for the first three steps of the CarpinteroPro
 * operational cycle:
 *
 *   1. Create a material in the inventory.
 *   2. Adjust its stock via the stock-adjust dialog.
 *   3. Build a furniture template (recipe) that consumes that material.
 *   4. Create a quote that uses the recipe and verify the recipe cost.
 *
 * Uses the long-lived `E2E_ADMIN_EMAIL` admin user instead of the
 * SDD 7 trial-user fixtures so this suite does not need the
 * `E2E_SUPABASE_SERVICE_ROLE_KEY` secret. The admin's workshop is
 * well-known and the cleanup query only touches artifacts whose
 * names start with `E2E `.
 */
test.describe("inventory → recipe → quote workflow", () => {
	test.afterEach(async () => {
		const admin = await getAdminUser();
		await cleanupE2EArtifacts(admin.workshopId);
	});

	test("creates a material, adjusts stock, builds a template, and issues a quote", async ({
		page,
	}) => {
		test.setTimeout(120_000);

		const user = await getAdminUser();
		ensureTestClient();
		const stamp = Date.now();
		const materialName = `E2E InvRecQuote Material ${stamp}`;
		const templateName = `E2E InvRecQuote Mueble ${stamp}`;

		// 1. Login as the admin user (replaces the SDD 7 trial user
		//    fixture that required service-role to provision). The
		//    localStorage clear before login is required so a stale
		//    TanStack Query cache from a previous run does not hide
		//    clients / templates / materials that this test just
		//    created.
		await page.goto("/login");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Ingresar" }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		// 2. Open inventory and create a new material via MaterialForm.
		await page.goto("/inventory");
		await page.getByRole("button", { name: "Nuevo material" }).click();

		const materialDialog = page.getByRole("dialog");
		await expect(
			materialDialog.getByRole("heading", { name: "Nuevo material" }),
		).toBeVisible();

		// Defaults: category=madera, unit=un. We only need to fill the editable fields.
		await materialDialog.getByLabel("Nombre del material").fill(materialName);
		await materialDialog.getByLabel("Precio/u (ARS)").fill("50");
		await materialDialog.getByLabel("Stock actual").fill("10");
		await materialDialog.getByLabel("Stock mínimo").fill("2");
		await materialDialog
			.getByRole("button", { name: "Agregar material" })
			.click();
		await expect(materialDialog).toBeHidden();

		// The new material appears in the MaterialList.
		const materialRow = page
			.getByRole("row")
			.filter({ has: page.getByText(materialName) });
		await expect(materialRow).toBeVisible();

		// 3. Click "Ajustar stock" on that row, add 5 more units, submit.
		await materialRow
			.getByRole("button", { name: "Ajustar stock" })
			.click();
		const stockDialog = page.getByRole("dialog");
		await expect(
			stockDialog.getByRole("heading", { name: "Ajustar stock" }),
		).toBeVisible();

		// Default direction is "Ingresar stock (+)" with reason "Compra".
		await stockDialog.getByLabel("Cantidad").fill("5");
		await stockDialog
			.getByRole("button", { name: "Guardar movimiento" })
			.click();
		await expect(stockDialog).toBeHidden();

		// The MaterialList now shows the new stock (15 = 10 initial + 5 delta).
		await expect(materialRow).toContainText("15");

		// 4. The /inventory/movements ledger shows the movement we just recorded.
		await page.goto("/inventory/movements");
		await expect(
			page.getByRole("link", { name: materialName }).first(),
		).toBeVisible();

		// 5. Create a furniture template that consumes the new material.
		await page.goto("/recipes");
		await page.getByRole("button", { name: "Nuevo mueble" }).click();

		const muebleDialog = page.getByRole("dialog");
		await expect(
			muebleDialog.getByRole("heading", { name: "Nuevo mueble" }),
		).toBeVisible();

		await muebleDialog.getByLabel("Nombre del mueble").fill(templateName);

		// Add a wood recipe item that references the material we just created.
		await muebleDialog
			.getByRole("button", { name: "Agregar madera" })
			.click();

		// The Material select has a "Seleccioná madera" placeholder; click it and
		// choose our newly-created material from the dropdown.
		await muebleDialog
			.getByRole("combobox")
			.filter({ hasText: "Seleccioná madera" })
			.click();
		await page
			.getByRole("option", { name: materialName })
			.click();

		// Fill quantity (2) and waste % (0). aria-label was added to make these
		// inputs programmatically labeled for accessibility and selector use.
		await muebleDialog.getByLabel("Cantidad").fill("2");
		await muebleDialog.getByLabel("Merma %").fill("0");

		await muebleDialog.getByRole("button", { name: "Crear mueble" }).click();
		await expect(muebleDialog).toBeHidden();

		// The new template appears as a card on /recipes.
		await expect(
			page.getByRole("heading", { name: templateName }),
		).toBeVisible();

		// 6. Create a quote for the seeded client + the new furniture template.
		await page.goto("/quotes/new");
		await expect(
			page.getByRole("heading", { name: /Nuevo presupuesto/ }),
		).toBeVisible();

		// Step 1 — pick the test client. The list of available
		// clients is filtered to those in the admin's workshop and
		// the helper ensures the E2E Test Client row exists before
		// the test starts.
		await page
			.getByRole("button", { name: /E2E Test Client/ })
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();

		// Step 2 — pick our new template.
		await page
			.getByRole("button", { name: new RegExp(templateName) })
			.click();

		// Recipe cost = quantity 2 × price 50 = 100. Confirm via the
		// editable input — the live preview also renders the same
		// number but Playwright's text matcher on es-AR currency
		// strings is brittle (the locale inserts a NBSP between $ and
		// the digits).
		await expect(page.getByLabel("Costo base ($)")).toHaveValue("100");

		// Step 3 (Extras) and Step 4 (Precio) need no input for this flow.
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Crear" }).click();

		await expect(page).toHaveURL(/\/quotes$/);
		await expect(
			page.getByRole("cell", { name: templateName }),
		).toBeVisible();

		// 7. DB verification — assert the rows the test created landed where
		// we expect. Counts and lookups are scoped by the unique name stamps
		// so the assertions don't depend on internal UUIDs.
		const materialQuery = fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM materials WHERE name = ${quoteSql(materialName)} AND workshop_id = '00000000-0000-0000-0000-000000000001'`,
		);
		expect(materialQuery[0]?.count).toBe(1);

		const movementQuery = fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM stock_movements WHERE material_id IN (SELECT id FROM materials WHERE name = ${quoteSql(materialName)})`,
		);
		expect(movementQuery[0]?.count).toBeGreaterThanOrEqual(1);

		const templateQuery = fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM furniture_templates WHERE name = ${quoteSql(templateName)} AND workshop_id = '00000000-0000-0000-0000-000000000001'`,
		);
		expect(templateQuery[0]?.count).toBe(1);

		const recipeItemQuery = fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM recipe_items WHERE furniture_template_id IN (SELECT id FROM furniture_templates WHERE name = ${quoteSql(templateName)})`,
		);
		expect(recipeItemQuery[0]?.count).toBeGreaterThanOrEqual(1);

		const quoteQuery = fetchDbJson<{
			furniture_template_id: string;
			client_id: string;
			furniture_name: string;
		}[]>(
			`SELECT furniture_template_id, client_id, furniture_name FROM quotes WHERE furniture_name = ${quoteSql(templateName)}`,
		);
		expect(quoteQuery).toHaveLength(1);
		const persistedQuote = quoteQuery[0]!;
		expect(persistedQuote.furniture_name).toBe(templateName);
		expect(persistedQuote.client_id).toBe(TEST_CLIENT_ID);
		expect(persistedQuote.furniture_template_id).not.toBeNull();
	});
});
