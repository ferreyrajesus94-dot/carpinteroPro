import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client with a controllable stub so we can drive the
// `globalSearch` API through specific scenarios (success, 42P01, etc.).
const fromMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const orMock = vi.fn();
const limitMock = vi.fn();
const thenableMock = vi.fn();

const queryChain = {
	select: selectMock,
	eq: eqMock,
	or: orMock,
	limit: limitMock,
	then: thenableMock,
};

vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		from: (...args: unknown[]) => {
			fromMock(...args);
			return queryChain;
		},
	},
}));

import { globalSearch } from "./index";

function setupChainedResult(data: unknown, error: unknown = null) {
	// Every chained method returns the chain and the chain is thenable.
	limitMock.mockReturnValue(queryChain);
	orMock.mockReturnValue(queryChain);
	eqMock.mockReturnValue(queryChain);
	selectMock.mockReturnValue(queryChain);
	thenableMock.mockImplementation((onFulfilled?: (v: unknown) => unknown) => {
		return Promise.resolve(
			onFulfilled ? onFulfilled({ data, error }) : { data, error },
		);
	});
}

describe("globalSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns EMPTY_SEARCH_RESULTS for queries shorter than 2 chars", async () => {
		const result = await globalSearch("ws-1", "m");
		expect(result).toEqual({
			clients: [],
			quotes: [],
			materials: [],
			furniture: [],
			total: 0,
		});
		expect(fromMock).not.toHaveBeenCalled();
	});

	it("returns EMPTY_SEARCH_RESULTS for empty queries", async () => {
		const result = await globalSearch("ws-1", "   ");
		expect(result.total).toBe(0);
		expect(fromMock).not.toHaveBeenCalled();
	});

	it("returns EMPTY_SEARCH_RESULTS for whitespace-only queries", async () => {
		const result = await globalSearch("ws-1", "\t\n ");
		expect(result.total).toBe(0);
	});

	it("returns results from all 4 tables in parallel", async () => {
		setupChainedResult([]);
		const result = await globalSearch("ws-1", "mesa");
		expect(result.total).toBe(0);
		// 4 tables queried
		expect(fromMock).toHaveBeenCalledTimes(4);
		expect(fromMock).toHaveBeenCalledWith("clients");
		expect(fromMock).toHaveBeenCalledWith("quotes");
		expect(fromMock).toHaveBeenCalledWith("materials");
		expect(fromMock).toHaveBeenCalledWith("furniture_templates");
	});

	it("aggregates the total across categories", async () => {
		// First call (clients): 2 rows
		// Second call (quotes): 1 row
		// Third call (materials): 3 rows
		// Fourth call (furniture): 0 rows
		let call = 0;
		thenableMock.mockImplementation((onFulfilled?: (v: unknown) => unknown) => {
			const counts = [2, 1, 3, 0];
			const data = Array.from({ length: counts[call] }, (_, i) => ({
				id: `${call}-${i}`,
			}));
			call += 1;
			return Promise.resolve(
				onFulfilled
					? onFulfilled({ data, error: null })
					: { data, error: null },
			);
		});
		limitMock.mockReturnValue(queryChain);
		orMock.mockReturnValue(queryChain);
		eqMock.mockReturnValue(queryChain);
		selectMock.mockReturnValue(queryChain);

		const result = await globalSearch("ws-1", "mesa");
		expect(result.total).toBe(6);
	});

	it("degrades gracefully when furniture_templates is missing (42P01)", async () => {
		let call = 0;
		thenableMock.mockImplementation((onFulfilled?: (v: unknown) => unknown) => {
			call += 1;
			if (call === 4) {
				// furniture_templates: 42P01 (undefined_table) — swallow
				return Promise.resolve(
					onFulfilled
						? onFulfilled({
								data: null,
								error: {
									code: "42P01",
									message:
										'relation "public.furniture_templates" does not exist',
								},
							})
						: { data: null, error: { code: "42P01" } },
				);
			}
			// other tables: success
			return Promise.resolve(
				onFulfilled
					? onFulfilled({ data: [], error: null })
					: { data: [], error: null },
			);
		});
		limitMock.mockReturnValue(queryChain);
		orMock.mockReturnValue(queryChain);
		eqMock.mockReturnValue(queryChain);
		selectMock.mockReturnValue(queryChain);

		const result = await globalSearch("ws-1", "mesa");
		expect(result.furniture).toEqual([]);
		expect(result.total).toBe(0);
	});

	it("propagates RLS / network errors from furniture_templates", async () => {
		let call = 0;
		thenableMock.mockImplementation((onFulfilled?: (v: unknown) => unknown) => {
			call += 1;
			if (call === 4) {
				return Promise.resolve(
					onFulfilled
						? onFulfilled({
								data: null,
								error: {
									code: "42501",
									message: "permission denied for table furniture_templates",
								},
							})
						: { data: null, error: { code: "42501" } },
				);
			}
			return Promise.resolve(
				onFulfilled
					? onFulfilled({ data: [], error: null })
					: { data: [], error: null },
			);
		});
		limitMock.mockReturnValue(queryChain);
		orMock.mockReturnValue(queryChain);
		eqMock.mockReturnValue(queryChain);
		selectMock.mockReturnValue(queryChain);

		await expect(globalSearch("ws-1", "mesa")).rejects.toMatchObject({
			code: "42501",
		});
	});
});
