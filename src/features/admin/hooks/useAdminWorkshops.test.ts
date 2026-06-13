import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/features/admin/api/workshops", () => ({
	fetchAdminWorkshops: vi.fn(),
	fetchAdminWorkshopDetail: vi.fn(),
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

import * as workshopsApi from "@/features/admin/api/workshops";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_WORKSHOPS = {
	workshops: [
		{
			id: "ws-1",
			name: "Carpintería del Sur",
			createdAt: "2026-01-15T00:00:00Z",
			isActive: true,
			ownerEmail: null,
			profileCount: 4,
			onboardedProfileCount: 3,
			subscriptionStatus: "active",
		},
		{
			id: "ws-2",
			name: "Muebles Norte",
			createdAt: "2026-03-01T00:00:00Z",
			isActive: true,
			ownerEmail: null,
			profileCount: 2,
			onboardedProfileCount: 2,
			subscriptionStatus: null,
		},
	],
};

describe("useAdminWorkshops", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns workshop summaries from the Edge Function", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		const { useAdminWorkshops } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshops(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_WORKSHOPS);
		expect(workshopsApi.fetchAdminWorkshops).toHaveBeenCalledWith(undefined);
	});

	it("passes search param to the API", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		const { useAdminWorkshops } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshops("Carpintería"), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(workshopsApi.fetchAdminWorkshops).toHaveBeenCalledWith(
			"Carpintería",
		);
	});

	it("returns error when API fails", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockRejectedValue(
			new Error("Forbidden"),
		);

		const { useAdminWorkshops } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshops(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("returns empty workshops array when no workshops exist", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue({
			workshops: [],
		});

		const { useAdminWorkshops } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshops(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.workshops).toEqual([]);
	});
});

describe("useAdminWorkshopDetail", () => {
	beforeEach(() => vi.clearAllMocks());

	const MOCK_DETAIL = {
		workshop: {
			id: "ws-1",
			name: "Carpintería del Sur",
			createdAt: "2026-01-15T00:00:00Z",
			isActive: true,
			ownerEmail: null,
			profileCount: 4,
			onboardedProfileCount: 3,
			subscriptionStatus: "active",
		},
	};

	it("returns workshop detail from the Edge Function", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		const { useAdminWorkshopDetail } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshopDetail("ws-1"), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_DETAIL);
		expect(workshopsApi.fetchAdminWorkshopDetail).toHaveBeenCalledWith("ws-1");
	});

	it("returns error when API fails", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockRejectedValue(
			new Error("Not found"),
		);

		const { useAdminWorkshopDetail } = await import("./useAdminWorkshops");
		const { result } = renderHook(() => useAdminWorkshopDetail("ws-1"), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("does not fetch when workshopId is empty", async () => {
		const { useAdminWorkshopDetail } = await import("./useAdminWorkshops");
		renderHook(() => useAdminWorkshopDetail(""), {
			wrapper: makeWrapper(),
		});

		expect(workshopsApi.fetchAdminWorkshopDetail).not.toHaveBeenCalled();
	});
});
