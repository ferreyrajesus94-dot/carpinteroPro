import { describe, it, expect } from "vitest";
import { hitKey, flattenResults } from "./hitKey";
import type { SearchResults } from "../types";

const results: SearchResults = {
	clients: [
		{
			entity: "clients",
			id: "c1",
			title: "Ana",
			subtitle: null,
			href: "/crm/clientes/c1",
		},
	],
	quotes: [
		{
			entity: "quotes",
			id: "q1",
			title: "PR-1",
			subtitle: null,
			href: "/quotes/q1",
		},
	],
	materials: [],
	furniture: [
		{
			entity: "furniture",
			id: "f1",
			title: "Mesa",
			subtitle: null,
			href: "/recipes",
		},
	],
	total: 3,
};

describe("hitKey", () => {
	it("composes entity and id with a colon separator", () => {
		expect(hitKey(results.clients[0])).toBe("clients:c1");
	});
});

describe("flattenResults", () => {
	it("returns hits in the canonical order: clients, quotes, materials, furniture", () => {
		const flat = flattenResults(results);
		expect(flat.map((h) => h.entity)).toEqual([
			"clients",
			"quotes",
			"furniture",
		]);
		expect(flat).toHaveLength(3);
	});
});
