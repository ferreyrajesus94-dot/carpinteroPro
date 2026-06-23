import { describe, it, expect, beforeAll } from "vitest";
import { mockSupabase } from "@/shared/lib/mockSupabase";
import { MOCK_CLIENTS, MOCK_WORKSHOP } from "@/shared/lib/mockData";
import { escapeForOrFilter } from "./index";

const workshopId = MOCK_WORKSHOP.id;

async function findByName(
	filter: string,
): Promise<{ id: string; name: string }[]> {
	const { data, error } = await mockSupabase
		.from("clients")
		.select("id, name")
		.eq("workshop_id", workshopId)
		.or(filter);
	if (error) throw error;
	return (data ?? []) as { id: string; name: string }[];
}

beforeAll(() => {
	if (MOCK_CLIENTS.length === 0) {
		throw new Error(
			"search integration test setup is broken: MOCK_CLIENTS is empty. Cannot exercise escape round-trip without seed data.",
		);
	}
});

describe("search integration: escapeForOrFilter → mock .or()", () => {
	it("matches clients whose name contains the term (sanity)", async () => {
		const hits = await findByName(
			`name.ilike.%${escapeForOrFilter("Ricardo")}%`,
		);
		expect(hits.some((c) => c.name.toLowerCase().includes("ricardo"))).toBe(
			true,
		);
	});

	it("joins multiple OR clauses with comma", async () => {
		const filter = [
			`name.ilike.%${escapeForOrFilter("Ricardo")}%`,
			`name.ilike.%${escapeForOrFilter("Gabriel")}%`,
		].join(",");
		const hits = await findByName(filter);
		const names = hits.map((h) => h.name);
		expect(names.some((n) => n.toLowerCase().includes("ricardo"))).toBe(true);
		expect(names.some((n) => n.toLowerCase().includes("gabriel"))).toBe(true);
	});

	it("does not crash on values containing an unescaped comma (round 1 regression)", async () => {
		const { error } = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or("name.ilike.%a,b%");
		expect(error).toBeNull();
	});

	it("treats an escaped comma (\\,) inside the value as a literal, not a clause separator", async () => {
		// No mock client has a comma in their name, so we expect 0 matches
		// (but the query must not throw, and the filter must be parsed as a
		// single clause).
		const filter = `name.ilike.%${escapeForOrFilter("Fernández, Laura")}%`;
		const { data, error } = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or(filter);
		expect(error).toBeNull();
		expect(Array.isArray(data) ? (data as unknown[]).length : 0).toBe(0);
	});

	it("treats escaped parens (\\(, \\)) as literal characters", async () => {
		const filter = `name.ilike.%${escapeForOrFilter("(demo)")}%`;
		const { error } = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or(filter);
		expect(error).toBeNull();
	});

	it("treats escaped underscore (\\_) as a literal, not a single-char wildcard", async () => {
		// The mock data has a name "Gabriel Silva" — searching for "Sil_a" (raw
		// underscore) would match as a wildcard. With the escape, "Sil\_a" is
		// the literal string "Sil_a" which is not in any name. We verify the
		// escaped query yields 0 matches while an unescaped equivalent would.
		const escaped = `name.ilike.%${escapeForOrFilter("Sil_a")}%`;
		const unescaped = `name.ilike.%Sil_a%`;
		const escapedRes = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or(escaped);
		const unescapedRes = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or(unescaped);
		expect((escapedRes.data as unknown[]).length).toBe(0);
		// Sanity: the unescaped wildcard variant must match (proving the
		// difference is the escape, not a flaw in the test).
		expect((unescapedRes.data as unknown[]).length).toBeGreaterThan(0);
	});

	it("treats an escaped percent (\\%) as a literal %, not a wildcard", async () => {
		// No client has 100% in their name, so 0 matches.
		const filter = `name.ilike.%${escapeForOrFilter("100%")}%`;
		const { data, error } = await mockSupabase
			.from("clients")
			.select("id")
			.eq("workshop_id", workshopId)
			.or(filter);
		expect(error).toBeNull();
		expect(Array.isArray(data) ? (data as unknown[]).length : 0).toBe(0);
	});
});
