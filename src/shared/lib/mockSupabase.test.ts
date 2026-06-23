import { describe, it, expect, beforeAll } from "vitest";
import { mockSupabase } from "./mockSupabase";
import { MOCK_CLIENTS, MOCK_WORKSHOP } from "./mockData";

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
			"mockSupabase test setup is broken: MOCK_CLIENTS is empty. The .or() parser cannot be exercised without seed data.",
		);
	}
});

describe("mockSupabase .or() parser (against real MOCK_CLIENTS)", () => {
	it("matches clients whose name contains the term", async () => {
		const hits = await findByName("name.ilike.%Ricardo%");
		expect(hits.some((c) => c.name.toLowerCase().includes("ricardo"))).toBe(
			true,
		);
	});

	it("returns nothing when no name matches", async () => {
		const hits = await findByName("name.ilike.%zzzzznever%");
		expect(hits).toEqual([]);
	});

	it("joins multiple ilike clauses separated by unescaped comma", async () => {
		const hits = await findByName("name.ilike.%Ricardo%,name.ilike.%Gabriel%");
		const names = hits.map((h) => h.name);
		expect(names.some((n) => n.toLowerCase().includes("ricardo"))).toBe(true);
		expect(names.some((n) => n.toLowerCase().includes("gabriel"))).toBe(true);
	});
});
