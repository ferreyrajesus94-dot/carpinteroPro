import { queryClient } from "./queryClient";

export const PRESERVED_LOCAL_STORAGE_KEYS = [
	"theme",
	"cp.palette",
	"cp.density",
	"carpinteroPro.rememberedEmail",
] as const;

const LEGACY_QUERY_CACHE_KEYS = ["REACT_QUERY_OFFLINE_CACHE"] as const;
const LEGACY_CACHE_STORAGE_KEYS = ["supabase-api"] as const;
const CARPINTERO_LOCAL_STORAGE_PREFIX = "carpinteroPro.";

export type CachePrivacyPurgeReason =
	| "logout"
	| "session-removed"
	| "user-switch"
	| "startup-legacy";

export function isPreservedLocalStorageKey(key: string): boolean {
	return (
		PRESERVED_LOCAL_STORAGE_KEYS.includes(
			key as (typeof PRESERVED_LOCAL_STORAGE_KEYS)[number],
		) || key.startsWith("cp.howto.")
	);
}

export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean {
	void queryKey;
	return false;
}

function safeLocalStorageRemove(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// best effort
	}
}

function shouldRemoveSensitiveLocalStorageKey(key: string): boolean {
	if (isPreservedLocalStorageKey(key)) {
		return false;
	}
	if (
		LEGACY_QUERY_CACHE_KEYS.includes(
			key as (typeof LEGACY_QUERY_CACHE_KEYS)[number],
		)
	) {
		return true;
	}
	return key.startsWith(CARPINTERO_LOCAL_STORAGE_PREFIX);
}

function clearSensitiveLocalStorage(): void {
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i += 1) {
		const key = localStorage.key(i);
		if (!key) continue;
		keys.push(key);
	}

	keys.forEach((key) => {
		if (shouldRemoveSensitiveLocalStorageKey(key)) {
			safeLocalStorageRemove(key);
		}
	});

	LEGACY_QUERY_CACHE_KEYS.forEach((key) => safeLocalStorageRemove(key));
}

async function clearLegacyCacheStorage(): Promise<void> {
	const cacheStorage = globalThis.caches;
	if (!cacheStorage) return;

	await Promise.all(
		LEGACY_CACHE_STORAGE_KEYS.map(async (cacheKey) => {
			try {
				await cacheStorage.delete(cacheKey);
			} catch {
				// best effort
			}
		}),
	);
}

export async function purgeSensitiveBrowserState(
	reason: CachePrivacyPurgeReason,
): Promise<void> {
	void reason;
	try {
		queryClient.clear();
	} catch {
		// best effort
	}

	try {
		clearSensitiveLocalStorage();
	} catch {
		// best effort
	}

	await clearLegacyCacheStorage();
}

export async function purgeLegacyCachePrivacyState(): Promise<void> {
	await purgeSensitiveBrowserState("startup-legacy");
}
