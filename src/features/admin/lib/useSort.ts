import { useState, useMemo } from "react";

export type SortDir = "asc" | "desc";

export function useSort<T>(
	items: T[],
	defaultKey: keyof T,
	defaultDir: SortDir = "asc",
) {
	const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
	const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

	function toggleSort(key: keyof T) {
		if (key === sortKey) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	}

	const sorted = useMemo(() => {
		return [...items].sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];
			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return 1;
			if (bVal == null) return -1;
			const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			return sortDir === "asc" ? cmp : -cmp;
		});
	}, [items, sortKey, sortDir]);

	return { sorted, sortKey, sortDir, toggleSort };
}
