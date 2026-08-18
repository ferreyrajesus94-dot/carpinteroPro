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

/** Returns the admin email or throws when E2E_ADMIN_EMAIL is unset */
export function getAdminEmail(): string {
	const email = process.env.E2E_ADMIN_EMAIL;
	if (!email) throw new Error("E2E_ADMIN_EMAIL not set");
	return email;
}

/** Returns the admin password or throws when E2E_ADMIN_PASSWORD is unset */
export function getAdminPassword(): string {
	const password = process.env.E2E_ADMIN_PASSWORD;
	if (!password) throw new Error("E2E_ADMIN_PASSWORD not set");
	return password;
}
