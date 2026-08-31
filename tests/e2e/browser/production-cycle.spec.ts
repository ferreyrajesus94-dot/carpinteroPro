import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	getActiveTrialUser,
	seedQuoteWorkflowFixture,
} from "../../../scripts/e2e/fixtures";

/**
 * End-to-end browser test for the production half of the CarpinteroPro
 * operational cycle:
 *
 *   1. Build the inventory -> recipe -> quote chain (same shape as
 *      `inventory-recipe-quote.spec.ts`).
 *   2. Approve the quote and mark it `en_produccion` directly in the DB
 *      because the production board UI does not currently expose
 *      status transitions for quotes (the kanban drag is desktop-only
 *      and tied to the production-start review dialog flow).
 *   3. Open /production, pick the quote from the "Nueva orden" picker,
 *      fill the StartProductionDialog, submit. Verify the kanban shows
 *      the new order in the Planificado column.
 *   4. Advance the production order to `delivered` via the DB because
 *      `ProductionOrderDetailPage` is intentionally read-only
 *      ("Transition actions live on the production board and arrive
 *      in PR 8") and the kanban excludes the terminal `delivered`
 *      column. The `transition_production_order_state` RPC exists in
 *      the API layer (`src/features/production/api/productionOrders.ts`)
 *      but no UI hook calls it. We assert that calling it lands the
 *      order in the terminal state and writes the corresponding event.
 *
 * The `CrmClientDetailPage` gap is acknowledged but out of scope: that
 * page renders only `quotes` for the client, never production orders
 * or deliveries, so there is no UI surface to assert on. Tracking the
 * gap for a future feature change is left as a TODO.
 *
 * Cleanup is handled by `cleanupSdd7Fixtures()`, which already removes
 * production_orders and production_order_events for any workshop it
 * scoped (see scripts/e2e/fixtures.ts).
 */
test.describe("quote -> production board -> delivered", () => {
	test.afterEach(async () => {
		if (process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
			await cleanupSdd7Fixtures();
		}
	});

	test("creates a production order from an approved quote and advances it to delivered", async ({
		page,
	}) => {
		test.setTimeout(120_000);

		// Skip the test when the Supabase service-role env vars are
		// missing. This keeps the test green in CI environments where
		// the vars are injected via secrets, and quiet on developer
		// machines that have not yet been bootstrapped. Run
		// `npx playwright test ...` with the vars exported to opt in.
		// See `docs/testing/runbook.md` for the full list.
		if (
			!process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ||
			!process.env.E2E_SUPABASE_URL ||
			!process.env.E2E_TEST_PASSWORD
		) {
			test.skip(
				true,
				"E2E_SUPABASE_* / E2E_TEST_PASSWORD not set; see docs/testing/runbook.md",
			);
			return;
		}

		await seedQuoteWorkflowFixture();
		const user = getActiveTrialUser();
		const stamp = Date.now();
		const materialName = `E2E ProdCycle Material ${stamp}`;
		const templateName = `E2E ProdCycle Mueble ${stamp}`;
		const productionNumber = `OP-${stamp}`;

		// 1. Login as the seeded active trial user.
		await page.goto("/login");
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Ingresar" }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		// 2. Inventory -> Recipe -> Quote (same flow as the
		//    inventory-recipe-quote spec, just renamed fixtures).
		await page.goto("/inventory");
		await page.getByRole("button", { name: "Nuevo material" }).click();
		const materialDialog = page.getByRole("dialog");
		await expect(
			materialDialog.getByRole("heading", { name: "Nuevo material" }),
		).toBeVisible();
		await materialDialog.getByLabel("Nombre del material").fill(materialName);
		await materialDialog.getByLabel("Precio/u (ARS)").fill("40");
		await materialDialog.getByLabel("Stock actual").fill("8");
		await materialDialog.getByLabel("Stock mínimo").fill("1");
		await materialDialog
			.getByRole("button", { name: "Agregar material" })
			.click();
		await expect(materialDialog).toBeHidden();

		await page.goto("/recipes");
		await page.getByRole("button", { name: "Nuevo mueble" }).click();
		const muebleDialog = page.getByRole("dialog");
		await expect(
			muebleDialog.getByRole("heading", { name: "Nuevo mueble" }),
		).toBeVisible();
		await muebleDialog.getByLabel("Nombre del mueble").fill(templateName);
		await muebleDialog.getByRole("button", { name: "Agregar madera" }).click();
		await muebleDialog
			.getByRole("combobox")
			.filter({ hasText: "Seleccioná madera" })
			.click();
		await page.getByRole("option", { name: materialName }).click();
		await muebleDialog.getByLabel("Cantidad").fill("3");
		await muebleDialog.getByLabel("Merma %").fill("0");
		await muebleDialog.getByRole("button", { name: "Crear mueble" }).click();
		await expect(muebleDialog).toBeHidden();

		await page.goto("/quotes/new");
		await expect(
			page.getByRole("heading", { name: /Nuevo presupuesto/ }),
		).toBeVisible();
		await page
			.getByRole("button", { name: /SDD 7 Cliente Presupuesto/ })
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page
			.getByRole("button", { name: new RegExp(templateName) })
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Crear" }).click();
		await expect(page).toHaveURL(/\/quotes$/);

		// 3. Find the quote row we just created and approve it. The
		//    status change goes through the DB because the production
		//    board UI does not expose quote status transitions (see
		//    docstring).
		const quoteRow = page
			.getByRole("row")
			.filter({ has: page.getByText(templateName) });
		await expect(quoteRow).toBeVisible();

		const quoteLookup = await fetchDbJson<{ id: string }[]>(
			`SELECT id FROM quotes WHERE furniture_name = ${quoteSql(templateName)}`,
		);
		expect(quoteLookup.rows).toHaveLength(1);
		const quoteId = quoteLookup.rows[0]!.id;

		// Advance quote.status -> aprobado. The production board picker
		// (ProductionBoard.tsx) filters on
		// `stored_status === "aprobado" && has_active_production === false`,
		// so the quote must stay in `aprobado` until the production order
		// is created. The `get_quotes_with_production_status` RPC overlays
		// `en_produccion` automatically once a production_order exists, so
		// we don't need a second UPDATE here.
		await runDb(
			`UPDATE quotes SET status = 'aprobado' WHERE id = ${quoteSql(quoteId)}`,
		);

		// 4. Open the production board, pick the quote, fill the
		//    StartProductionDialog, submit.
		await page.goto("/production");
		await expect(
			page.getByRole("heading", { name: "Producción" }),
		).toBeVisible();
		// The picker is keyed on quote_number — fetch it.
		const numberLookup = await fetchDbJson<{ quote_number: string }[]>(
			`SELECT quote_number FROM quotes WHERE id = ${quoteSql(quoteId)}`,
		);
		expect(numberLookup.rows).toHaveLength(1);
		const quoteNumber = numberLookup.rows[0]!.quote_number;
		const quoteSelect = page.locator("#production-start-quote");
		await quoteSelect.selectOption({ label: new RegExp(quoteNumber) });
		await page.getByRole("button", { name: "Nueva orden" }).click();
		const startDialog = page.getByRole("dialog");
		await expect(
			startDialog.getByRole("heading", { name: /Iniciar producción/ }),
		).toBeVisible();
		await startDialog.getByLabel("Número de orden").fill(productionNumber);
		await startDialog
			.getByRole("button", { name: "Confirmar" })
			.click();
		await expect(startDialog).toBeHidden();

		// The new order card should appear in the Planificado column.
		await expect(
			page
				.getByRole("region", { name: "Planificado" })
				.locator("article", { hasText: productionNumber }),
		).toBeVisible();

		// 5. Advance the production order through every state up to
		//    `delivered` via the DB. The RPC enforces the state
		//    machine, so this also exercises it from the happy path.
		const orderLookup = await fetchDbJson<{ id: string }[]>(
			`SELECT id FROM production_orders WHERE production_number = ${quoteSql(productionNumber)}`,
		);
		expect(orderLookup.rows).toHaveLength(1);
		const orderId = orderLookup.rows[0]!.id;

		for (const next of ["in_progress", "quality_check", "ready", "delivered"]) {
			await runDb(
				`SELECT transition_production_order_state(${quoteSql(orderId)}, ${quoteSql(next)}, NULL, ${quoteSql(`e2e-prod-${stamp}-${next}`)})`,
			);
		}

		// 6. Verify the order is now in the terminal `delivered` state
		//    and that the event log captured every transition.
		const finalOrder = await fetchDbJson<
			{ state: string; actual_end_date: string | null }[]
		>(
			`SELECT state, actual_end_date FROM production_orders WHERE id = ${quoteSql(orderId)}`,
		);
		expect(finalOrder.rows).toHaveLength(1);
		expect(finalOrder.rows[0]!.state).toBe("delivered");
		expect(finalOrder.rows[0]!.actual_end_date).not.toBeNull();

		const events = await fetchDbJson<{ event_type: string; to_state: string | null }[]>(
			`SELECT event_type, to_state FROM production_order_events WHERE production_order_id = ${quoteSql(orderId)} ORDER BY created_at ASC`,
		);
		expect(events.rows.map((e) => e.to_state)).toEqual([
			"in_progress",
			"quality_check",
			"ready",
			"delivered",
		]);
	});
});

/** Run a SQL command through the linked Supabase project. */
async function runDb(sql: string): Promise<void> {
	const { execFileSync } = await import("node:child_process");
	execFileSync(
		"supabase",
		["db", "query", "--linked", sql],
		{ encoding: "utf8" },
	);
}

/** Run a SQL query and return its JSON rows. */
async function fetchDbJson<T>(sql: string): Promise<{ rows: T[] }> {
	const { execFileSync } = await import("node:child_process");
	const output = execFileSync(
		"supabase",
		["db", "query", "--linked", "--output", "json", sql],
		{ encoding: "utf8" },
	);
	// R3-FETCH-BRITTLE fix (mirrors inventory-recipe-quote.spec.ts): walk
	// braces from the first `{` to its matching close, ignoring string
	// literals, and parse that single object.
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

/** Scan `source` from `start` for the first balanced JSON object. */
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

/** Wrap a JS string literal in Postgres single-quote SQL. */
function quoteSql(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}