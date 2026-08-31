import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	getActiveTrialUser,
	seedQuoteWorkflowFixture,
} from "../../../scripts/e2e/fixtures";

/**
 * End-to-end browser test for the first three steps of the CarpinteroPro
 * operational cycle:
 *
 *   1. Create a material in the inventory.
 *   2. Adjust its stock via the stock-adjust dialog.
 *   3. Build a furniture template (recipe) that consumes that material.
 *   4. Create a quote that uses the recipe and verify the recipe cost.
 *
 * The seeded `quoteClientId` client and the workshop/user/profile/subscription
 * seeded by `seedQuoteWorkflowFixture()` are reused. `cleanupSdd7Fixtures()`
 * in `afterEach` handles teardown — it already deletes the materials,
 * stock_movements, recipe_items, furniture_templates, and quotes created
 * during the test.
 */
test.describe("inventory → recipe → quote workflow", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("creates a material, adjusts stock, builds a template, and issues a quote", async ({
		page,
	}) => {
		test.setTimeout(120_000);

		await seedQuoteWorkflowFixture();
		const user = getActiveTrialUser();
		const stamp = Date.now();
		const materialName = `E2E InvRecQuote Material ${stamp}`;
		const templateName = `E2E InvRecQuote Mueble ${stamp}`;

		// 1. Login as the seeded active trial user.
		await page.goto("/login");
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

		// Step 1 — pick the seeded client.
		await page
			.getByRole("button", { name: /SDD 7 Cliente Presupuesto/ })
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();

		// Step 2 — pick our new template.
		await page
			.getByRole("button", { name: new RegExp(templateName) })
			.click();

		// Recipe cost = quantity 2 × price 50 = 100. Confirm via the editable
		// input AND via the live preview text (es-AR locale renders "$ 100"
		// with a space between the symbol and the amount).
		await expect(page.getByLabel("Costo base ($)")).toHaveValue("100");
		await expect(page.getByText(/\$ ?100/).first()).toBeVisible();

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
		const materialQuery = await fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM materials WHERE name = ${quoteSql(materialName)} AND workshop_id = '00000000-0000-4000-8000-000000070001'`,
		);
		expect(materialQuery.rows[0]?.count).toBe(1);

		const movementQuery = await fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM stock_movements WHERE material_id IN (SELECT id FROM materials WHERE name = ${quoteSql(materialName)})`,
		);
		expect(movementQuery.rows[0]?.count).toBeGreaterThanOrEqual(1);

		const templateQuery = await fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM furniture_templates WHERE name = ${quoteSql(templateName)} AND workshop_id = '00000000-0000-4000-8000-000000070001'`,
		);
		expect(templateQuery.rows[0]?.count).toBe(1);

		const recipeItemQuery = await fetchDbJson<{ count: number }>(
			`SELECT count(*)::int AS count FROM recipe_items WHERE furniture_template_id IN (SELECT id FROM furniture_templates WHERE name = ${quoteSql(templateName)})`,
		);
		expect(recipeItemQuery.rows[0]?.count).toBeGreaterThanOrEqual(1);

		const quoteQuery = await fetchDbJson<{
			furniture_template_id: string;
			client_id: string;
			furniture_name: string;
		}[]>(
			`SELECT furniture_template_id, client_id, furniture_name FROM quotes WHERE furniture_name = ${quoteSql(templateName)}`,
		);
		expect(quoteQuery.rows).toHaveLength(1);
		const persistedQuote = quoteQuery.rows[0]!;
		expect(persistedQuote.furniture_name).toBe(templateName);
		expect(persistedQuote.client_id).toBe(
			"00000000-0000-4000-8000-000000070007",
		);
		expect(persistedQuote.furniture_template_id).not.toBeNull();
	});
});

/** Run a SQL query through the linked Supabase project and return its JSON rows. */
async function fetchDbJson<T>(sql: string): Promise<{ rows: T[] }> {
	const { execFileSync } = await import("node:child_process");
	const output = execFileSync(
		"supabase",
		["db", "query", "--linked", "--output", "json", sql],
		{ encoding: "utf8" },
	);
	// R3-FETCH-BRITTLE fix: parse the FIRST balanced JSON object in the
	// output, not just the slice between the first `{` and last `}`. The
	// supabase CLI prints a textual preamble ("Initialising login role...")
	// and a sentinel-wrapped warning that may itself contain `{` / `}` /
	// URLs, so a naive `indexOf("{")` to `lastIndexOf("}")` slice swallows
	// stray braces from the warning text and produces concatenated
	// non-JSON. Walk braces from the first top-level `{` to its matching
	// close, ignoring string literals, and parse that single object.
	const firstBrace = output.indexOf("{");
	if (firstBrace === -1) {
		throw new Error(
			`No JSON object found in supabase CLI output:\n${output}`,
		);
	}
	const payload = extractFirstJsonObject(output, firstBrace);
	const parsed = JSON.parse(payload) as { rows: T[] };
	return { rows: parsed.rows ?? [] };
}

/**
 * Scan `source` starting at `start` for the first balanced JSON object,
 * respecting string literals and escape sequences. Returns the substring
 * from the opening `{` to the matching `}`.
 */
function extractFirstJsonObject(source: string, start: number): string {
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < source.length; i++) {
		const ch = source[i];
		if (inString) {
			if (escape) {
				escape = false;
			} else if (ch === "\\") {
				escape = true;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
		} else if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(start, i + 1);
			}
		}
	}
	throw new Error(
		`Unterminated JSON object in supabase CLI output starting at offset ${start}:\n${source}`,
	);
}

/** Wrap a JS string literal in Postgres single-quote SQL with proper escaping. */
function quoteSql(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}
