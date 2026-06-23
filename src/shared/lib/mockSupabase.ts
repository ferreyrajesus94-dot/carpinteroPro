/**
 * Mock Supabase client for local development.
 * Activated by VITE_USE_LOCAL_MOCKS=true.
 *
 * Provides enough fidelity to traverse the auth + data flow:
 *   - Authenticated session
 *   - Profile lookup
 *   - Subscription query (single row)
 *   - Material / furniture template / client / quote list queries
 *   - Quote detail query (single)
 *   - `.or()` filters with eq/neq/ilike/like and PostgREST `\,` escape semantics
 *   - `.limit()`, `.range()`, `count: "exact"`
 *
 * NOT a full Supabase mock — only the patterns the app actually uses.
 */
import type { Session } from "@supabase/supabase-js";
import { MOCK_SESSION, getMockTableRecords } from "./mockData";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Operation kind for mock insert/update/delete responses. */
const MUTATION_OPS = {
	INSERT: "insert",
	UPDATE: "update",
	DELETE: "delete",
	SELECT: "select",
} as const;

/**
 * Convert a Supabase ilike pattern (`%foo%`) into a case-insensitive regex.
 * PostgREST treats `\` as a general escape: any character following a
 * backslash is a literal. We mirror that here, so the mock matches
 * production for `\,`, `\(`, `\)`, `\%`, `\_`, and any other escape
 * sequence the client emits.
 */
function ilikePatternToRegex(pattern: string): RegExp {
	let body = "";
	for (let i = 0; i < pattern.length; i += 1) {
		const ch = pattern[i];
		if (ch === "\\" && i + 1 < pattern.length) {
			// Generic escape: the next char is literal, regardless of what
			// it is. `\%` becomes literal `%` (not a wildcard), `\_`
			// becomes literal `_`, `\,` becomes literal `,`, etc.
			const next = pattern[i + 1];
			body += next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			i += 1;
			continue;
		}
		if (ch === "%") {
			body += ".*";
			continue;
		}
		if (ch === "_") {
			body += ".";
			continue;
		}
		body += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${body}$`, "i");
}

/**
 * Split a string by a single character, honouring backslash escapes.
 * Mirrors how PostgREST parses `.or()` filter strings: a leading `\` makes the
 * next character a literal, so `\,` is not a clause separator.
 */
function splitUnescaped(s: string, char: string): string[] {
	const parts: string[] = [];
	let current = "";
	let escaped = false;
	for (let i = 0; i < s.length; i += 1) {
		const ch = s[i];
		if (escaped) {
			current += ch;
			escaped = false;
			continue;
		}
		if (ch === "\\") {
			current += ch;
			escaped = true;
			continue;
		}
		if (ch === char) {
			parts.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.length > 0) parts.push(current);
	return parts;
}

/**
 * Evaluate a Supabase-style `.or()` filter against a record.
 * Filter string format: "col.op.pattern,col.op.pattern" — record matches if ANY clause matches.
 * Commas inside patterns must be escaped with `\,` to be treated as literals.
 */
function matchesOrFilter(
	record: Record<string, unknown>,
	filter: string,
): boolean {
	const clauses = splitUnescaped(filter, ",")
		.map((c) => c.trim())
		.filter(Boolean);
	return clauses.some((clause) => {
		const dotIndex = clause.indexOf(".");
		if (dotIndex === -1) return false;
		const column = clause.slice(0, dotIndex);
		const rest = clause.slice(dotIndex + 1);
		const opDot = rest.indexOf(".");
		if (opDot === -1) return false;
		const op = rest.slice(0, opDot);
		const pattern = rest.slice(opDot + 1);

		const value = record[column];
		if (value === null || value === undefined) return false;

		switch (op) {
			case "eq":
				return String(value) === pattern;
			case "neq":
				return String(value) !== pattern;
			case "ilike":
			case "like":
				return ilikePatternToRegex(pattern).test(String(value));
			case "gt":
				return Number(value) > Number(pattern);
			case "gte":
				return Number(value) >= Number(pattern);
			case "lt":
				return Number(value) < Number(pattern);
			case "lte":
				return Number(value) <= Number(pattern);
			default:
				return false;
		}
	});
}

type MutationOp = (typeof MUTATION_OPS)[keyof typeof MUTATION_OPS];

interface MockResult<T = unknown> {
	data: T | null;
	error: { message: string; code: string } | null;
	count: number | null;
}

type SubscriptionCallback = (event: string, session: Session | null) => void;

// ─── Query Builder ───────────────────────────────────────────────────────────

type MockInsertValue = Record<string, unknown> | Record<string, unknown>[];

class MockQueryBuilder {
	private table: string;
	private filters: Record<string, unknown> = {};
	private rangeFrom = 0;
	private rangeTo = 0;
	private _single = false;
	private _maybeSingle = false;
	private _orderColumn: string | undefined;
	private _orderAscending = true;
	private _countExact = false;
	private _operation: MutationOp = MUTATION_OPS.SELECT;
	private _insertValues: MockInsertValue | null = null;
	private _updateValues: Record<string, unknown> | null = null;
	private _orFilter: string | null = null;
	private _limitCount: number | null = null;

	constructor(table: string) {
		this.table = table;
	}

	select(_columns?: string): this {
		void _columns;
		return this;
	}

	insert(values: MockInsertValue): this {
		this._operation = MUTATION_OPS.INSERT;
		this._insertValues = values;
		return this;
	}

	update(values: Record<string, unknown>): this {
		this._operation = MUTATION_OPS.UPDATE;
		this._updateValues = values;
		return this;
	}

	delete(): this {
		this._operation = MUTATION_OPS.DELETE;
		return this;
	}

	eq(column: string, value: unknown): this {
		this.filters[column] = value;
		return this;
	}

	order(column: string, opts?: { ascending?: boolean }): this {
		this._orderColumn = column;
		this._orderAscending = opts?.ascending ?? true;
		return this;
	}

	range(from: number, to: number): this {
		this.rangeFrom = from;
		this.rangeTo = to;
		return this;
	}

	/**
	 * Server-side filter that mirrors Supabase's `.or()`.
	 * Filter string format: "col.op.pattern,col.op.pattern"
	 * Supported operators: eq, neq, ilike, like, gt, gte, lt, lte.
	 * Patterns use `%` as wildcard (for ilike/like) and are case-insensitive.
	 * Commas, parens, backslashes, `%` and `_` inside values must be backslash-escaped.
	 */
	or(filter: string): this {
		this._orFilter = filter;
		return this;
	}

	limit(count: number): this {
		this._limitCount = count;
		return this;
	}

	single(): this {
		this._single = true;
		return this;
	}

	maybeSingle(): this {
		this._maybeSingle = true;
		return this;
	}

	/** Used by select with count: 'exact' in quotes API */
	// The count is passed during select — we handle it in the resolve logic.

	private resolveData(): MockResult {
		// ── Mutations: return deterministic mock responses ──
		if (this._operation === MUTATION_OPS.INSERT) {
			return {
				data: this._insertValues as Record<string, unknown> | null,
				error: null,
				count: null,
			};
		}

		if (this._operation === MUTATION_OPS.UPDATE) {
			return {
				data: this._updateValues as Record<string, unknown> | null,
				error: null,
				count: null,
			};
		}

		if (this._operation === MUTATION_OPS.DELETE) {
			return { data: null, error: null, count: null };
		}

		// ── Select: resolve from mock data ──
		const eqEntries = Object.entries(this.filters);

		// First eq filter is typically the id/workshop_id value
		const eqColumn = eqEntries[0]?.[0] ?? "";
		const eqValue = eqEntries[0]?.[1] as string;

		let records = getMockTableRecords(this.table, eqColumn, eqValue);

		// Apply additional eq filters
		for (let i = 1; i < eqEntries.length; i++) {
			const [col, val] = eqEntries[i];
			records = records.filter((r) => r[col] === val);
		}

		// Apply or-filter (server-side semantics)
		if (this._orFilter) {
			records = records.filter((r) => matchesOrFilter(r, this._orFilter!));
		}

		// Sort
		if (this._orderColumn) {
			records.sort((a, b) => {
				const aVal = a[this._orderColumn!] as string | number;
				const bVal = b[this._orderColumn!] as string | number;
				if (typeof aVal === "string" && typeof bVal === "string") {
					return this._orderAscending
						? aVal.localeCompare(bVal)
						: bVal.localeCompare(aVal);
				}
				return this._orderAscending
					? (aVal as number) - (bVal as number)
					: (bVal as number) - (aVal as number);
			});
		}

		// Range
		if (this.rangeTo > 0) {
			records = records.slice(this.rangeFrom, this.rangeTo + 1);
		}

		// Limit (after range so it can be combined)
		if (this._limitCount !== null) {
			records = records.slice(0, this._limitCount);
		}

		const totalCount = records.length;

		if (this._single) {
			const row = records[0] ?? null;
			return {
				data: row as Record<string, unknown> | null,
				error: row ? null : { message: "No rows found", code: "PGRST116" },
				count: null,
			};
		}

		if (this._maybeSingle) {
			return {
				data: (records[0] ?? null) as Record<string, unknown> | null,
				error: null,
				count: null,
			};
		}

		return {
			data: records,
			error: null,
			count: this._countExact ? totalCount : null,
		};
	}

	/**
	 * The Supabase PostgrestFilterBuilder is thenable — await works directly.
	 * We mirror that so `await supabase.from(...)` resolves.
	 */
	then<TResult1 = MockResult, TResult2 = never>(
		onfulfilled?:
			| ((value: MockResult) => TResult1 | PromiseLike<TResult1>)
			| undefined
			| null,
		onrejected?:
			| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
			| undefined
			| null,
	): Promise<TResult1 | TResult2> {
		const result = this.resolveData();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}
}

/**
 * Wrapped query builder that captures the `count` option from select().
 */
function createQueryBuilder(table: string) {
	const builder = new MockQueryBuilder(table);
	const originalSelect = builder.select.bind(builder);

	// Override select to capture the count option
	builder.select = function (
		this: MockQueryBuilder,
		columns?: string,
		opts?: { count?: "exact" | "planned" | "estimated" },
	) {
		(this as unknown as { _countExact: boolean })._countExact =
			opts?.count === "exact";
		return originalSelect(columns);
	}.bind(builder) as typeof builder.select;

	return builder;
}

// ─── Mock Supabase Client ────────────────────────────────────────────────────

let authListeners: SubscriptionCallback[] = [];

function notifyListeners(event: string, session: Session | null) {
	for (const listener of authListeners) {
		try {
			listener(event, session);
		} catch {
			// Swallow listener errors
		}
	}
}

// ─── Mock data for admin functions ────────────────────────────────────────

const MOCK_ADMIN_SUBSCRIPTIONS = {
	subscriptions: [
		{
			id: "mock-sub-001",
			workshopId: "00000000-0000-0000-0000-000000000010",
			workshopName: "Carpintería El Ñandú",
			status: "active",
			plan: "pro",
			provider: "mercadopago",
			providerPreapprovalId: "preapp-mock-001",
			providerStatus: "authorized",
			currentPeriodEnd: "2026-07-20T12:00:00Z",
			updatedAt: "2026-06-20T12:00:00Z",
		},
		{
			id: "mock-sub-002",
			workshopId: "00000000-0000-0000-0000-000000000011",
			workshopName: "Mueblería La Estancia",
			status: "trialing",
			plan: "starter",
			provider: "mercadopago",
			providerPreapprovalId: "preapp-mock-002",
			providerStatus: "authorized",
			currentPeriodEnd: "2026-09-20T12:00:00Z",
			updatedAt: "2026-06-19T10:00:00Z",
		},
		{
			id: "mock-sub-003",
			workshopId: "00000000-0000-0000-0000-000000000012",
			workshopName: "Taller del Sur",
			status: "cancelled",
			plan: "pro",
			provider: "mercadopago",
			providerPreapprovalId: null,
			providerStatus: "cancelled",
			currentPeriodEnd: null,
			updatedAt: "2026-06-15T08:00:00Z",
		},
	],
};

export const mockSupabase = {
	auth: {
		getSession: async (): Promise<{
			data: { session: Session | null };
			error: null;
		}> => {
			return { data: { session: MOCK_SESSION }, error: null };
		},
		onAuthStateChange: (
			callback: SubscriptionCallback,
		): {
			data: { subscription: { unsubscribe: () => void } };
		} => {
			authListeners.push(callback);
			const subscription = {
				unsubscribe: () => {
					authListeners = authListeners.filter((l) => l !== callback);
				},
			};
			return { data: { subscription } };
		},
		signOut: async (): Promise<{ error: null }> => {
			notifyListeners("SIGNED_OUT", null);
			return { error: null };
		},
		signInWithPassword: async (): Promise<{
			data: { session: Session };
			error: null;
		}> => {
			return { data: { session: MOCK_SESSION }, error: null };
		},
		signUp: async (): Promise<{
			data: { session: Session | null; user: Session["user"] | null };
			error: null;
		}> => {
			return {
				data: { session: MOCK_SESSION, user: MOCK_SESSION.user },
				error: null,
			};
		},
		signInWithOAuth: async (): Promise<{
			data: { provider: string; url: string };
			error: null;
		}> => {
			return { data: { provider: "google", url: "/dashboard" }, error: null };
		},
	},
	from: (table: string): MockQueryBuilder => {
		return createQueryBuilder(table);
	},
	functions: {
		invoke: async (
			name: string,
			_options?: { body?: unknown },
		): Promise<{
			data: unknown;
			error: { message: string; code: string } | null;
		}> => {
			void _options;
			if (name === "admin-subscriptions") {
				return { data: MOCK_ADMIN_SUBSCRIPTIONS, error: null };
			}
			// Fail loudly for any admin function not explicitly needed by the current test
			return {
				data: null,
				error: {
					message: `Mock function not implemented: ${name}`,
					code: "NOT_MOCKED",
				},
			};
		},
	},
	rpc: async (
		fn: string,
		_params?: Record<string, unknown>,
	): Promise<{ data: unknown; error: null }> => {
		void _params; // unused in mock
		if (fn === "generate_quote_number") {
			const next = Math.floor(Math.random() * 9000 + 1000);
			return { data: `PR-MOCK-${next}`, error: null };
		}
		return { data: null, error: null };
	},
};
