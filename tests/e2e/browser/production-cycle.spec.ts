import { expect, test } from "@playwright/test";
import {
	cleanupE2EArtifacts,
	ensureTestClient,
	fetchDbJson,
	getAdminUser,
	quoteSql,
	runDb,
} from "./helpers/e2e-admin";

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
 *   4. Advance the production order to `delivered` via the DB. The
 *      new `ProductionOrderActions` UI added in commit 3aa0303 exposes
 *      every legal transition, so this part of the test could in
 *      theory be replaced by UI clicks; we keep the DB-level path
 *      because the `delivered` transition is terminal and we want
 *      the test to assert the full event log without an intermediate
 *      page navigation. The `transition_production_order_state` RPC
 *      is exercised by every transition we fire.
 *
 * The CRM client-detail gap was closed by the new
 * `ClientProductionSection` in commit 3aa0303, but that surface is
 * not asserted here — the focus is the production board.
 *
 * Cleanup is handled by `cleanupE2EArtifacts`, which deletes only
 * artifacts the suite created (no SDD 7 trial-user fixtures needed).
 */
test.describe("quote -> production board -> delivered", () => {
	test.afterEach(async () => {
		const admin = await getAdminUser();
		await cleanupE2EArtifacts(admin.workshopId);
	});

	test("creates a production order from an approved quote and advances it to delivered", async ({
		page,
	}) => {
		test.setTimeout(120_000);

		const user = await getAdminUser();
		ensureTestClient();
		const stamp = Date.now();
		const materialName = `E2E ProdCycle Material ${stamp}`;
		const templateName = `E2E ProdCycle Mueble ${stamp}`;
		const productionNumber = `OP-${stamp}`;

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
			.getByRole("button", { name: /E2E Test Client/ })
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

		const quoteLookup = fetchDbJson<{ id: string }>(
			`SELECT id FROM quotes WHERE furniture_name = ${quoteSql(templateName)}`,
		);
		expect(quoteLookup).toHaveLength(1);
		const quoteId = quoteLookup[0]!.id;

		// Advance quote.status -> aprobado. The production board picker
		// (ProductionBoard.tsx) filters on
		// `stored_status === "aprobado" && has_active_production === false`,
		// so the quote must stay in `aprobado` until the production order
		// is created. The `get_quotes_with_production_status` RPC overlays
		// `en_produccion` automatically once a production_order exists, so
		// we don't need a second UPDATE here.
		runDb(
			`UPDATE quotes SET status = 'aprobado' WHERE id = ${quoteSql(quoteId)}`,
		);

		// 4. Open the production board, pick the quote, fill the
		//    StartProductionDialog, submit.
		await page.goto("/production");
		await expect(
			page.getByRole("heading", { name: "Producción", exact: true }),
		).toBeVisible();
		// The picker is keyed on quote_number — select by value
		// (the quote id) since Playwright's `selectOption({ label: ... })`
		// requires a plain string, not a regex.
		const quoteSelect = page.locator("#production-start-quote");
		await quoteSelect.selectOption(quoteId);
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
		//    `delivered` via the new ProductionOrderActions UI (commit
		//    3aa0303) so the test exercises the same surface the user
		//    will use in production. Each transition is destructive
		//    (except `in_progress`), so the cancel/pause/deliver
		//    actions route through a ConfirmDialog that the test
		//    dismisses.
		const orderLookup = fetchDbJson<{ id: string }>(
			`SELECT id FROM production_orders WHERE production_number = ${quoteSql(productionNumber)}`,
		);
		expect(orderLookup).toHaveLength(1);
		const orderId = orderLookup[0]!.id;

		// Walk the legal state machine and confirm the destructive
		// transitions (each one opens a ConfirmDialog with a
		// confirmLabel like "Confirmar entregado").
		const transitions: Array<{ to: string; confirm: boolean }> = [
			{ to: "in_progress", confirm: false },
			{ to: "quality_check", confirm: false },
			{ to: "ready", confirm: false },
			{ to: "delivered", confirm: true },
		];
		for (const step of transitions) {
			await page.goto(`/production/${orderId}`);
			await expect(
				page.getByTestId("order-detail-grid"),
			).toBeVisible();
			const action = page.getByTestId(`order-action-${step.to}`);
			await action.click();
			if (step.confirm) {
				const dialog = page.getByRole("dialog").filter({
					hasText: /Confirmar cambio/,
				});
				await expect(dialog).toBeVisible();
				await dialog
					.getByRole("button", { name: /Confirmar/ })
					.click();
			}
			// Wait for the order detail grid to refresh by checking
			// the action button for the target is no longer there
			// (the next state has its own button).
			await expect(action).not.toBeVisible({ timeout: 10_000 });
		}

		// 6. Verify the order is now in the terminal `delivered` state
		//    and that the event log captured every transition. We assert
		//    via the UI because the linked Supabase CLI does not have
		//    an `auth.uid()`, so RLS-scoped SELECTs return empty (the
		//    `get_current_workshop_id()` helper returns NULL for the
		//    CLI). The detail grid renders the state label and the
		//    timeline lists every event with `from_state → to_state`,
		//    so the same assertions hold in the browser session.
		await page.goto(`/production/${orderId}`);
		await expect(
			page.getByText("Estado").locator("..").getByText("Entregado"),
		).toBeVisible();
		await expect(
			page.getByText("Esta orden está en estado terminal y no admite más cambios."),
		).toBeVisible();
		const expectedTransitions = [
			"Planificado → En producción",
			"En producción → Control de calidad",
			"Control de calidad → Listo",
			"Listo → Entregado",
		];
		const timeline = page.getByTestId("order-timeline-section");
		for (const transition of expectedTransitions) {
			await expect(timeline.getByText(transition)).toBeVisible();
		}
	});
});
