import type { SearchHit } from "../types";

export function hitKey(hit: SearchHit): string {
	return `${hit.entity}:${hit.id}`;
}

export function flattenResults(results: {
	clients: SearchHit[];
	quotes: SearchHit[];
	materials: SearchHit[];
	furniture: SearchHit[];
}): SearchHit[] {
	return [
		...results.clients,
		...results.quotes,
		...results.materials,
		...results.furniture,
	];
}
