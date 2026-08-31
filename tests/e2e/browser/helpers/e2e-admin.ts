import { execFileSync } from "node:child_process";

/**
 * Admin user reused by the E2E browser tests in lieu of the SDD 7
 * trial-user fixtures. We deliberately avoid `auth.admin.*` (which
 * would require the `E2E_SUPABASE_SERVICE_ROLE_KEY` secret) by
 * reusing the long-lived `E2E_ADMIN_EMAIL` admin user that already
 * exists in the linked project. That user owns a single workshop
 * (`00000000-0000-4000-8000-000000000001`) and an `active`
 * subscription, so it can complete the full inventory → recipe →
 * quote → production → delivery flow without us provisioning any
 * rows in advance.
 *
 * Trade-off: every test in this suite writes artifacts into the
 * admin's workshop. We keep them scoped to per-run stamps so the
 * cleanup query never touches the admin's real data.
 */

export interface AdminUser {
	email: string;
	password: string;
	workshopId: string;
	userId: string;
}

const ADMIN_WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

/**
 * UUID for the long-lived "E2E test client" that the tests attach
 * every quote to. A deterministic UUID lets the assertions stay
 * stable across runs and lets the cleanup query scope its DELETE to
 * just this client without touching any real data.
 */
export const TEST_CLIENT_ID = "00000000-0000-4000-8000-0000000700e2";

/** Read the admin email/password and look up the IDs from the database. */
export async function getAdminUser(): Promise<AdminUser> {
	const email = process.env.E2E_ADMIN_EMAIL;
	const password = process.env.E2E_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error(
			"E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set; see .env.example and docs/testing/runbook.md",
		);
	}

	// Look up the admin's user_id from auth.users. Done once per test
	// run; result is cheap and the lookup keeps the helper free of
	// hard-coded UUIDs (which would silently break if the admin user
	// is ever re-created in Supabase).
	const rows = fetchDbJson<{ id: string }[]>(
		`SELECT id FROM auth.users WHERE email = ${quoteSql(email)}`,
	);
	if (rows.length === 0) {
		throw new Error(
			`E2E_ADMIN_EMAIL user (${email}) not found in auth.users. ` +
				`Create it via the Supabase dashboard or supabase admin API before running this test.`,
		);
	}
	return {
		email,
		password,
		workshopId: ADMIN_WORKSHOP_ID,
		userId: rows[0]!.id,
	};
}

/**
 * Upsert the "E2E test client" for the admin's workshop so every
 * test in this suite can attach a quote to a stable client. The
 * upsert is idempotent — re-running the suite does not duplicate the
 * client. Done via the linked Supabase CLI so we do not need
 * service-role credentials.
 */
export function ensureTestClient(): void {
	runDb(
		`INSERT INTO clients (id, workshop_id, name, phone, email, source, updated_at)
		 VALUES (${quoteSql(TEST_CLIENT_ID)}, ${quoteSql(ADMIN_WORKSHOP_ID)},
		         'E2E Test Client', '+5491100000000', 'e2e-test@example.invalid',
		         'otro', now())
		 ON CONFLICT (id) DO UPDATE
		   SET name = EXCLUDED.name,
		       updated_at = now()`,
	);
}

/**
 * Delete every artifact left behind by a previous run. Match by
 * either a `E2E ...` name prefix (for materials, recipes, quotes)
 * or an `OP-` production number prefix (for production orders).
 * Both selectors keep the cleanup query from touching the admin's
 * real data.
 */
export async function cleanupE2EArtifacts(workshopId: string): Promise<void> {
	// Delete in FK-safe order: production_order_events → production_orders
	// → stock_movements → quote_* (snapshots, extras) → quotes →
	// recipe_items → furniture_templates → materials.
	const statements: string[] = [
		`DELETE FROM production_order_events
		   WHERE production_order_id IN (
		     SELECT id FROM production_orders WHERE workshop_id = ${quoteSql(workshopId)}
		   )`,
		`DELETE FROM production_orders
		   WHERE workshop_id = ${quoteSql(workshopId)}
		     AND production_number LIKE 'OP-%'`,
		`DELETE FROM quote_recipe_snapshots
		   WHERE quote_id IN (
		     SELECT id FROM quotes WHERE workshop_id = ${quoteSql(workshopId)} AND client_id = ${quoteSql(TEST_CLIENT_ID)}
		   )`,
		`DELETE FROM quote_labor_snapshots
		   WHERE quote_id IN (
		     SELECT id FROM quotes WHERE workshop_id = ${quoteSql(workshopId)} AND client_id = ${quoteSql(TEST_CLIENT_ID)}
		   )`,
		`DELETE FROM quote_extras
		   WHERE quote_id IN (
		     SELECT id FROM quotes WHERE workshop_id = ${quoteSql(workshopId)} AND client_id = ${quoteSql(TEST_CLIENT_ID)}
		   )`,
		`DELETE FROM quotes
		   WHERE workshop_id = ${quoteSql(workshopId)}
		     AND client_id = ${quoteSql(TEST_CLIENT_ID)}`,
		`DELETE FROM labor_items
		   WHERE workshop_id = ${quoteSql(workshopId)}`,
		`DELETE FROM recipe_items
		   WHERE furniture_template_id IN (
		     SELECT id FROM furniture_templates
		         WHERE workshop_id = ${quoteSql(workshopId)} AND name LIKE 'E2E %'
		   )`,
		`DELETE FROM furniture_templates
		   WHERE workshop_id = ${quoteSql(workshopId)} AND name LIKE 'E2E %'`,
		`DELETE FROM stock_movements
		   WHERE material_id IN (
		     SELECT id FROM materials WHERE workshop_id = ${quoteSql(workshopId)} AND name LIKE 'E2E %'
		   )`,
		`DELETE FROM materials
		   WHERE workshop_id = ${quoteSql(workshopId)} AND name LIKE 'E2E %'`,
		// The "E2E Test Client" is the only client the suite uses; drop
		// it last so the FK on quotes.client_id stays valid throughout
		// the cleanup.
		`DELETE FROM clients
		   WHERE id = ${quoteSql(TEST_CLIENT_ID)}`,
		`INSERT INTO clients (id, workshop_id, name, phone, email, source, updated_at)
		   VALUES (${quoteSql(TEST_CLIENT_ID)}, ${quoteSql(workshopId)},
		           'E2E Test Client', '+5491100000000', 'e2e-test@example.invalid',
		           'otro', now())
		   ON CONFLICT (id) DO NOTHING`,
	];
	for (const sql of statements) {
		runDb(sql);
	}
}

/** Run a SQL command via the linked Supabase CLI. */
export function runDb(sql: string): void {
	execFileSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf8" });
}

/** Run a SQL query via the linked Supabase CLI and return its rows. */
export function fetchDbJson<T>(sql: string): T[] {
	const output = execFileSync(
		"supabase",
		["db", "query", "--linked", "--output", "json", sql],
		{ encoding: "utf8" },
	);
	// R3-FETCH-BRITTLE fix: walk braces from the first top-level `{`
	// to its matching close, respecting string literals, instead of
	// slicing between the first `{` and last `}` (which folds any
	// braces from the CLI warning preamble into the parse).
	const firstBrace = output.indexOf("{");
	if (firstBrace === -1) {
		throw new Error(
			`No JSON object found in supabase CLI output:\n${output}`,
		);
	}
	const payload = extractFirstJsonObject(output, firstBrace);
	const parsed = JSON.parse(payload) as { rows?: T[] };
	return parsed.rows ?? [];
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
export function quoteSql(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}