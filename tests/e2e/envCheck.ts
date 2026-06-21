/**
 * Guard helpers for E2E tests that depend on external credentials or env vars.
 * Tests requiring real admin credentials should gate behind env checks so
 * default `npm run test:e2e` does not fail when the backend is not seeded.
 */

/** Returns true iff admin real-backend credentials are configured */
export function hasAdminCredentials(): boolean {
	return Boolean(
		process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD,
	);
}

/** Returns the admin email or the hardcoded dev default */
export function getAdminEmail(): string {
	return process.env.E2E_ADMIN_EMAIL ?? "admin@carpinteropro.dev";
}

/** Returns the admin password or the hardcoded dev default */
export function getAdminPassword(): string {
	return process.env.E2E_ADMIN_PASSWORD ?? "CarpPro#2024";
}
