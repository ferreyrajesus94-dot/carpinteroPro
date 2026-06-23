export type SearchEntity = "clients" | "quotes" | "materials" | "furniture";

export interface SearchHitClient {
	entity: "clients";
	id: string;
	title: string;
	subtitle: string | null;
	href: string;
}

export interface SearchHitQuote {
	entity: "quotes";
	id: string;
	title: string;
	subtitle: string | null;
	href: string;
}

export interface SearchHitMaterial {
	entity: "materials";
	id: string;
	title: string;
	subtitle: string | null;
	href: string;
}

export interface SearchHitFurniture {
	entity: "furniture";
	id: string;
	title: string;
	subtitle: string | null;
	href: string;
}

export type SearchHit =
	| SearchHitClient
	| SearchHitQuote
	| SearchHitMaterial
	| SearchHitFurniture;

export interface SearchResults {
	clients: SearchHitClient[];
	quotes: SearchHitQuote[];
	materials: SearchHitMaterial[];
	furniture: SearchHitFurniture[];
	total: number;
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
	clients: [],
	quotes: [],
	materials: [],
	furniture: [],
	total: 0,
};
