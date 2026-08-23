import "@testing-library/jest-dom";

// jsdom does not provide window.matchMedia; add a basic mock so
// hooks like useTheme() can initialize without crashing.
if (!window.matchMedia) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

// Node 22+ no longer exposes localStorage by default in jsdom (see
// `ExperimentalWarning: localStorage is not available because
// --localstorage-file was not provided`). Components like useTheme()
// and cachePrivacy.ts read directly from `window.localStorage`, so we
// polyfill it here with an in-memory implementation of the Storage
// interface. Each test gets a fresh instance via `beforeEach` clears.
class InMemoryLocalStorage implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	key(index: number): string | null {
		if (index < 0 || index >= this.store.size) return null;
		return Array.from(this.store.keys())[index] ?? null;
	}

	getItem(key: string): string | null {
		return this.store.has(key) ? (this.store.get(key) ?? null) : null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

if (typeof window !== "undefined" && !window.localStorage) {
	Object.defineProperty(window, "localStorage", {
		writable: true,
		configurable: true,
		value: new InMemoryLocalStorage(),
	});
}
