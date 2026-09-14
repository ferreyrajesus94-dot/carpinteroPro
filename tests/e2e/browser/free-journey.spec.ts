import { expect, test } from "@playwright/test";
import {
	createSyntheticUser,
	deleteSyntheticUser,
} from "../../../scripts/e2e/fixtures";
import type { SyntheticUser } from "../../../scripts/e2e/fixtures";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/shared/types/database";

/**
 * End-to-end free journey covered by the W5 audit:
 *   login → onboarding → inventory → quote → contract/PDF →
 *   production.
 *
 * Project: `chromium` (requires the local Supabase stack seeded with
 * the E2E env vars). The spec creates a fresh synthetic user per
 * run, walks the onboarding skip path to land on /dashboard, then
 * provisions the minimum workflow data the quote wizard needs
 * (client + furniture template + recipe + contract template) for
 * the just-created workshop. The wizard is then driven through the
 * UI end-to-end, the PDF download is asserted, and the production
 * board is opened.
 *
 * Out of scope: password reset email delivery (no SMTP wired locally),
 * signup email confirmation (`enable_confirmations = false`),
 * delivery of PDF email attachments, and MercadoPago webhook flows
 * (covered separately by `mercadopago-webhook.spec.ts`).
 */
test.describe("synthetic free journey", () => {
	let user: SyntheticUser | null = null;
	const stamp = Date.now();
	let workshopId: string | null = null;
	let userId: string | null = null;

	test.beforeAll(async () => {
		user = await createSyntheticUser({
			email: `free-journey-${stamp}@e2e.local`,
			workshopName: `E2E Free Journey ${stamp}`,
		});
		userId = user.userId;
	});

	test.afterAll(async () => {
		if (userId) {
			// Best-effort cleanup. The fixtures' `cleanupSdd7Fixtures`
			// only targets hard-coded workshop IDs, so synthetic users
			// must be removed via the auth admin API.
			await deleteSyntheticUser(userId);
		}
	});

	test("login → onboarding → inventory → quote → contract/PDF → production", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		if (!user) throw new Error("synthetic user not provisioned");

		const adminDb = createClient<Database>(
			process.env.E2E_SUPABASE_URL ?? "",
			process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
			{ auth: { persistSession: false, autoRefreshToken: false } },
		);

		// 1. Login as the synthetic user. The localStorage clear
		//    before login prevents a stale TanStack Query cache from
		//    a previous run from hiding rows this spec just created.
		await page.goto("/login");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Contraseña", { exact: true }).fill(
			process.env.E2E_TEST_PASSWORD ?? "E2E_synthetic_password_change_me!",
		);
		await page.getByRole("button", { name: "Ingresar" }).click();

		// 2. The synthetic user has no profile → onboarding flow.
		//    The wizard's `Saltar` button routes to the dashboard.
		await page.waitForURL(/\/onboarding/);
		await page.getByRole("button", { name: "Saltar" }).first().click();
		const skipRemaining = page.getByRole("button", { name: "Saltar" });
		const remainingCount = await skipRemaining.count();
		if (remainingCount > 1) {
			await skipRemaining.last().click();
		}
		await expect(page).toHaveURL(/\/dashboard/);

		// 3. Fetch the workshop_id that onboarding just provisioned.
		//    The synthetic user already has a profile (created during
		//    onboarding step 1), so we can read it directly.
		const { data: profile, error: profileError } = await adminDb
			.from("profiles")
			.select("workshop_id")
			.eq("id", userId!)
			.maybeSingle();
		if (profileError) throw profileError;
		workshopId = profile?.workshop_id ?? null;
		if (!workshopId) {
			throw new Error("onboarding did not create a workshop for the synthetic user");
		}

		// 4. Provision the minimum data the quote wizard needs: a
		//    client, a material, a furniture template with one recipe
		//    item, and a contract template. All rows are scoped to the
		//    synthetic user's workshop via `workshop_id`. We use
		//    `crypto.randomUUID()` (available in both browser and modern
		//    Node) so every ID is a valid RFC-4122 UUID that Postgres
		//    accepts without `invalid input syntax for type uuid`.
		const newUuid = (): string => crypto.randomUUID();
		const clientId = newUuid();
		const materialId = newUuid();
		const templateId = newUuid();
		const recipeId = newUuid();
		const laborId = newUuid();
		const contractTemplateId = newUuid();

		await adminDb.from("clients").upsert({
			id: clientId,
			workshop_id: workshopId,
			name: `E2E Free Client ${stampSuffix}`,
			phone: "+541112345678",
			email: `client-${stampSuffix}@e2e.local`,
			source: "otro",
		});
		await adminDb.from("materials").upsert({
			id: materialId,
			workshop_id: workshopId,
			name: `E2E Free Material ${stampSuffix}`,
			category: "herraje",
			unit: "un",
			price_per_unit: 100,
			stock: 10,
			min_stock: 1,
		});
		await adminDb.from("furniture_templates").upsert({
			id: templateId,
			workshop_id: workshopId,
			name: `E2E Free Mueble ${stampSuffix}`,
			category: "mesa",
			tags: ["e2e_free_journey"],
			suggested_margin_pct: 30,
			params: [],
		});
		await adminDb.from("recipe_items").upsert({
			id: recipeId,
			workshop_id: workshopId,
			furniture_template_id: templateId,
			material_id: materialId,
			quantity: 2,
			waste_pct: 10,
		});
		await adminDb.from("labor_items").upsert({
			id: laborId,
			workshop_id: workshopId,
			furniture_template_id: templateId,
			description: "Armado E2E Free Journey",
			hours: 3,
			rate: 50,
		});
		await adminDb.from("contract_templates").upsert({
			id: contractTemplateId,
			workshop_id: workshopId,
			name: `Contrato Free Journey ${stampSuffix}`,
			body_markdown:
				"Contrato para **{{client_name}}** por {{furniture_name}}. Total: **{{total}}**.",
			is_default: true,
			updated_at: new Date().toISOString(),
		});

		// 5. Refresh the dashboard and navigate to /inventory. The
		//    inventory page renders without errors and shows the new
		//    material row.
		await page.goto("/dashboard");
		await expect(
			page.getByRole("heading", { name: "Inicio" }),
		).toBeVisible();
		await expect(
			page.getByText(/Pago pendiente|Suscripción cancelada/i),
		).toHaveCount(0);

		await page.goto("/inventory");
		await expect(
			page.getByRole("heading", { name: "Inventario" }),
		).toBeVisible();
		await expect(
			page.getByRole("row").filter({
				hasText: `E2E Free Material ${stampSuffix}`,
			}),
		).toBeVisible();

		// 6. Quote wizard — step 1 picks the seeded client, step 2
		//    picks the seeded recipe, steps 3-4 carry defaults, then
		//    `Crear` lands on the /quotes list with the new row.
		await page.goto("/quotes/new");
		await expect(
			page.getByRole("heading", { name: /Nuevo presupuesto/ }),
		).toBeVisible();
		await page
			.getByRole("button", {
				name: new RegExp(`E2E Free Client ${stampSuffix}`),
			})
			.click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page
			.getByRole("button", {
				name: new RegExp(`E2E Free Mueble ${stampSuffix}`),
			})
			.click();
		await expect(page.getByLabel("Costo base ($)")).toHaveValue("220");
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Siguiente" }).click();
		await page.getByRole("button", { name: "Crear" }).click();
		await expect(page).toHaveURL(/\/quotes$/);
		await expect(
			page.getByRole("cell", {
				name: `E2E Free Mueble ${stampSuffix}`,
			}),
		).toBeVisible();

		// 7. The new quote was just created with a fresh UUID. Fetch
		//    its id from the DB so the contract URL is known.
		const { data: persistedQuote, error: persistedQuoteError } =
			await adminDb
				.from("quotes")
				.select("id, quote_number")
				.eq("furniture_name", `E2E Free Mueble ${stampSuffix}`)
				.maybeSingle();
		if (persistedQuoteError) throw persistedQuoteError;
		if (!persistedQuote) throw new Error("newly-created quote not found");

		// 8. Contract preview renders and starts the PDF download.
		await page.goto(`/quotes/${persistedQuote.id}/contract`);
		await expect(
			page.getByRole("heading", {
				name: `Contrato — ${persistedQuote.quote_number}`,
			}),
		).toBeVisible();
		await expect(
			page.getByText(`E2E Free Client ${stampSuffix}`),
		).toBeVisible();
		const downloadPromise = page.waitForEvent("download");
		await page.getByRole("button", { name: "Descargar PDF" }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe(
			`presupuesto-${persistedQuote.quote_number}.pdf`,
		);

		// 9. Approve the quote so it shows up in the production
		//    picker, then open the production board.
		await adminDb
			.from("quotes")
			.update({ status: "aprobado" })
			.eq("id", persistedQuote.id);

		await page.goto("/production");
		await expect(
			page.getByRole("heading", { name: "Producción", exact: true }),
		).toBeVisible();

		// 10. Start production on the new order. The picker lists the
		//     approved quote; selecting it and clicking `Nueva orden`
		//     opens the StartProductionDialog.
		const quoteSelect = page.locator("#production-start-quote");
		await quoteSelect.selectOption(persistedQuote.id);
		await page.getByRole("button", { name: "Nueva orden" }).click();
		const startDialog = page.getByRole("dialog");
		await expect(
			startDialog.getByRole("heading", { name: /Iniciar producción/ }),
		).toBeVisible();
		const productionNumber = `OP-${stampSuffix}`;
		await startDialog.getByLabel("Número de orden").fill(productionNumber);
		await startDialog.getByRole("button", { name: "Confirmar" }).click();
		await expect(startDialog).toBeHidden();

		// 11. The new order appears on the production board in the
		//     Planificado column. The board then loads it as
		//     `in_progress` once the kanban / detail page is opened.
		await expect(
			page
				.getByRole("region", { name: "Planificado" })
				.locator("article", { hasText: productionNumber }),
		).toBeVisible();
	});
});
