import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/features/admin/api/subscriptions", () => ({
	fetchAdminSubscriptions: vi.fn(),
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

import * as subscriptionsApi from "@/features/admin/api/subscriptions";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_SUBSCRIPTIONS = {
	subscriptions: [
		{
			id: "sub-1",
			workshopId: "ws-1",
			workshopName: "Carpintería del Sur",
			status: "active",
			plan: "monthly",
			provider: "mercadopago",
			providerPreapprovalId: "pre-123",
			providerStatus: "authorized",
			currentPeriodEnd: "2026-07-01T00:00:00Z",
			updatedAt: "2026-06-01T00:00:00Z",
		},
	],
};

describe("useAdminSubscriptions", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns subscriptions from the Edge Function", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		const { useAdminSubscriptions } = await import("./useAdminSubscriptions");
		const { result } = renderHook(() => useAdminSubscriptions(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_SUBSCRIPTIONS);
		expect(subscriptionsApi.fetchAdminSubscriptions).toHaveBeenCalledWith(undefined);
	});

	it("passes status filter to the API", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		const { useAdminSubscriptions } = await import("./useAdminSubscriptions");
		const { result } = renderHook(() => useAdminSubscriptions("cancelled"), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(subscriptionsApi.fetchAdminSubscriptions).toHaveBeenCalledWith(
			"cancelled",
		);
	});

	it("returns error when API fails", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockRejectedValue(
			new Error("Forbidden"),
		);

		const { useAdminSubscriptions } = await import("./useAdminSubscriptions");
		const { result } = renderHook(() => useAdminSubscriptions(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("returns empty subscriptions array when none exist", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue({
			subscriptions: [],
		});

		const { useAdminSubscriptions } = await import("./useAdminSubscriptions");
		const { result } = renderHook(() => useAdminSubscriptions(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.subscriptions).toEqual([]);
	});
});
