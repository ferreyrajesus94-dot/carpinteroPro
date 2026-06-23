import { useEffect, useState } from "react";

/**
 * Debounce a value by the given delay in milliseconds.
 * Returns the latest value once it has stayed stable for `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(id);
	}, [value, delayMs]);

	return debounced;
}
