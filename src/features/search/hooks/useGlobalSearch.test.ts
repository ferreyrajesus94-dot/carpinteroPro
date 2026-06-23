import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useGlobalSearch } from "./useGlobalSearch"

const fromMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const orMock = vi.fn()
const limitMock = vi.fn()
const thenableMock = vi.fn()

const queryChain = {
	select: selectMock,
	eq: eqMock,
	or: orMock,
	limit: limitMock,
	then: thenableMock,
}

vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		from: (...args: unknown[]) => {
			fromMock(...args)
			return queryChain
		},
	},
}))

vi.mock("@tanstack/react-query", async () => {
	const actual =
		await vi.importActual<typeof import("@tanstack/react-query")>(
			"@tanstack/react-query",
		)
	return actual
})

function setupChainedResult() {
	limitMock.mockReturnValue(queryChain)
	orMock.mockReturnValue(queryChain)
	eqMock.mockReturnValue(queryChain)
	selectMock.mockReturnValue(queryChain)
	thenableMock.mockImplementation((onFulfilled?: (v: unknown) => unknown) => {
		return Promise.resolve(
			onFulfilled
				? onFulfilled({ data: [], error: null })
				: { data: [], error: null },
		)
	})
}

function makeWrapper(queryClient: QueryClient) {
	return ({ children }: { children: React.ReactNode }) =>
		QueryClientProvider({ client: queryClient, children })
}

describe("useGlobalSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setupChainedResult()
	})

	it("disables the query when workshopId is null", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const wrapper = makeWrapper(queryClient)
		const { result } = renderHook(
			() => useGlobalSearch(null, "mesa", "dropdown"),
			{ wrapper },
		)
		await waitFor(() => {
			expect(result.current.fetchStatus).toBe("idle")
		})
		expect(fromMock).not.toHaveBeenCalled()
	})

	it("disables the query when the trimmed term has fewer than 2 chars", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const wrapper = makeWrapper(queryClient)
		const { result } = renderHook(
			() => useGlobalSearch("ws-1", "m", "dropdown"),
			{ wrapper },
		)
		await waitFor(() => {
			expect(result.current.fetchStatus).toBe("idle")
		})
		expect(fromMock).not.toHaveBeenCalled()
	})

	it("fires the query once the term reaches the minimum length", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const wrapper = makeWrapper(queryClient)
		renderHook(() => useGlobalSearch("ws-1", "mesa", "dropdown"), {
			wrapper,
		})
		await waitFor(() => {
			expect(fromMock).toHaveBeenCalled()
		})
	})

	it("uses the same cache key for queries that differ only in case", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const wrapper = makeWrapper(queryClient)
		const { rerender } = renderHook(
			({ q }: { q: string }) =>
				useGlobalSearch("ws-1", q, "dropdown"),
			{ wrapper, initialProps: { q: "mesa" } },
		)
		await waitFor(() => {
			expect(fromMock).toHaveBeenCalled()
		})
		const firstCallCount = fromMock.mock.calls.length
		// Rerender with a different case — should hit the cache, not refetch.
		rerender({ q: "MESA" })
		await new Promise((r) => setTimeout(r, 50))
		expect(fromMock.mock.calls.length).toBe(firstCallCount)
	})
})
