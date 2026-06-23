import { useQuery } from "@tanstack/react-query";
import { globalSearch, type SearchScope } from "../api";
import { EMPTY_SEARCH_RESULTS, type SearchResults } from "../types";

export function useGlobalSearch(
	workshopId: string | null,
	query: string,
	scope: SearchScope = "dropdown",
) {
	const trimmed = query.trim();

	return useQuery<SearchResults>({
		queryKey: ["global-search", workshopId, trimmed.toLowerCase(), scope],
		queryFn: () => globalSearch(workshopId as string, trimmed, scope),
		enabled: !!workshopId && trimmed.length >= 2,
		staleTime: 30_000,
		placeholderData: (prev) => prev ?? EMPTY_SEARCH_RESULTS,
	});
}
