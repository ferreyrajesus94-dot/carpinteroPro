import { expect, test } from "@playwright/test";
import {
	createSyntheticUser,
	deleteSyntheticUser,
} from "../../../scripts/e2e/fixtures";

/**
 * Synthetic-account signup journey.
 *
 * Project: `chromium` (requires the local Supabase stack seeded with
 * the E2E env vars). Creates a fresh user per spec run via
 * `supabase.auth.admin.createUser` (server-side, requires
 * `E2E_SUPABASE_SERVICE_ROLE_KEY` — never bundled to the browser),
 * then drives the /login page as a registered user and asserts the
 * free dashboard renders.
 *
 * The signup email-confirmation step is intentionally skipped:
 * `supabase/config.toml:221` keeps `enable_confirmations = false`,
 * so a freshly-created `auth.users` row is immediately sign-in
 * capable. Out of scope: password reset email delivery (requires
 * SMTP + `enable_confirmations = true`; recorded as unverified in
 * the audit completion record).
 */
test.describe("synthetic signup journey", () => {
	let userEmail: string;
	let userId: string | null = null;

	test.beforeAll(async () => {
		const stamp = Date.now();
		userEmail = `signup-journey-${stamp}@e2e.local`;
		const created = await createSyntheticUser({
			email: userEmail,
			workshopName: `E2E Signup Workshop ${stamp}`,
		});
		userId = created.userId;
	});

	test.afterAll(async () => {
		if (userId) {
			await deleteSyntheticUser(userId);
		}
	});

	test("a freshly-created user logs in and reaches the free dashboard", async ({
		page,
	}) => {
		await page.goto("/login");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByLabel("Email").fill(userEmail);
		await page.getByLabel("Contraseña", { exact: true }).fill(
			process.env.E2E_TEST_PASSWORD ?? "E2E_synthetic_password_change_me!",
		);
		await page.getByRole("button", { name: "Ingresar" }).click();

		// Synthetic user has no profile → the auth bootstrap
		// redirects to /onboarding (step 1). The wizard's only
		// visible "Saltar" button at step 1 calls
		// `finish("/dashboard")`, which sets onboarded_at via
		// markOnboarded and navigates to /dashboard. Clicking it is
		// the user-driven onboarding skip — no `onboarded_at` write
		// is performed from the test itself.
		await expect(page).toHaveURL(/\/onboarding/);
		await page.getByRole("button", { name: "Saltar" }).click();
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByRole("heading", { name: "Inicio" }),
		).toBeVisible();
		await expect(
			page.getByRole("navigation", { name: "Navegación principal" }).first(),
		).toBeVisible();
		await expect(
			page.getByText(/Pago pendiente|Suscripción cancelada/i),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: /Empezar suscripción/i }),
		).toHaveCount(0);
	});
});
