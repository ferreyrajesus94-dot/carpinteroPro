import { supabase } from "@/shared/lib/supabase";
import {
	EMPTY_SEARCH_RESULTS,
	type SearchHitClient,
	type SearchHitFurniture,
	type SearchHitMaterial,
	type SearchHitQuote,
	type SearchResults,
} from "../types";

const DROPDOWN_LIMIT = 5;
const PAGE_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;

/**
 * Escape a user-supplied term for safe use inside a PostgREST `.or()` filter
 * string. A single regex pass avoids double-escape ordering bugs.
 *
 * Escaped characters (per PostgREST .or() / ilike grammar):
 *   `\`  backslash
 *   `%`  ilike wildcard
 *   `_`  ilike single-char wildcard
 *   `,`  or-clause separator
 *   `(`  or-group open
 *   `)`  or-group close
 */
export function escapeForOrFilter(input: string): string {
	return input.replace(/[\\%_(),]/g, "\\$&");
}

function ilikeClause(column: string, term: string): string {
	return `${column}.ilike.%${escapeForOrFilter(term)}%`;
}

async function searchClients(
	workshopId: string,
	term: string,
	limit: number,
): Promise<SearchHitClient[]> {
	const { data, error } = await supabase
		.from("clients")
		.select("id, name, phone, email")
		.eq("workshop_id", workshopId)
		.or(
			[
				ilikeClause("name", term),
				ilikeClause("phone", term),
				ilikeClause("email", term),
			].join(","),
		)
		.limit(limit);

	if (error) throw error;
	if (!data) return [];

	return data.map((c) => ({
		entity: "clients" as const,
		id: c.id,
		title: c.name,
		subtitle: c.phone ?? c.email ?? null,
		href: `/crm/clientes/${c.id}`,
	}));
}

async function searchQuotes(
	workshopId: string,
	term: string,
	limit: number,
): Promise<SearchHitQuote[]> {
	const { data, error } = await supabase
		.from("quotes")
		.select("id, quote_number, furniture_name")
		.eq("workshop_id", workshopId)
		.or(
			[
				ilikeClause("quote_number", term),
				ilikeClause("furniture_name", term),
			].join(","),
		)
		.limit(limit);

	if (error) throw error;
	if (!data) return [];

	return data.map((q) => ({
		entity: "quotes" as const,
		id: q.id,
		title: `${q.quote_number} — ${q.furniture_name}`,
		subtitle: null,
		href: `/quotes/${q.id}`,
	}));
}

async function searchMaterials(
	workshopId: string,
	term: string,
	limit: number,
): Promise<SearchHitMaterial[]> {
	const { data, error } = await supabase
		.from("materials")
		.select("id, name, category")
		.eq("workshop_id", workshopId)
		.or(ilikeClause("name", term))
		.limit(limit);

	if (error) throw error;
	if (!data) return [];

	return data.map((m) => ({
		entity: "materials" as const,
		id: m.id,
		title: m.name,
		subtitle: m.category ?? null,
		href: "/inventory",
	}));
}

async function searchFurniture(
	workshopId: string,
	term: string,
	limit: number,
): Promise<SearchHitFurniture[]> {
	const { data, error } = await supabase
		.from("furniture_templates")
		.select("id, name, category")
		.eq("workshop_id", workshopId)
		.or([ilikeClause("name", term), ilikeClause("category", term)].join(","))
		.limit(limit);

	if (error) {
		// 42P01 = undefined_table. The furniture_templates table may not exist in
		// every environment (e.g. older deployments); degrade gracefully for that
		// specific case and surface anything else so RLS / network issues are
		// visible in the UI error state.
		if (error.code === "42P01") return [];
		throw error;
	}
	if (!data) return [];

	return data.map((r) => ({
		entity: "furniture" as const,
		id: r.id,
		title: r.name,
		subtitle: r.category ?? null,
		href: "/recipes",
	}));
}

export type SearchScope = "dropdown" | "page";

export async function globalSearch(
	workshopId: string,
	rawQuery: string,
	scope: SearchScope = "dropdown",
): Promise<SearchResults> {
	const term = rawQuery.trim();
	if (term.length < 2) return EMPTY_SEARCH_RESULTS;
	// Cap query length to avoid blowing up PostgREST URL limits and to
	// prevent expensive btree-like scans on a single 50 kB term.
	if (term.length > MAX_QUERY_LENGTH) return EMPTY_SEARCH_RESULTS;

	const limit = scope === "page" ? PAGE_LIMIT : DROPDOWN_LIMIT;

	const [clients, quotes, materials, furniture] = await Promise.all([
		searchClients(workshopId, term, limit),
		searchQuotes(workshopId, term, limit),
		searchMaterials(workshopId, term, limit),
		searchFurniture(workshopId, term, limit),
	]);

	return {
		clients,
		quotes,
		materials,
		furniture,
		total: clients.length + quotes.length + materials.length + furniture.length,
	};
}
