import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/features/admin/api/overview", () => ({
	fetchAdminOverview: vi.fn(),
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

import * as overviewApi from "@/features/admin/api/overview";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_OVERVIEW = {
	workshops: { total: 12, createdLast30Days: 3 },
	subscriptions: {
		total: 8,
		byStatus: { active: 5, cancelled: 2, paused: 1 },
	},
	support: { recentWebhookFailures: 1 },
};

describe("useAdminOverview", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns overview data from the Edge Function", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue(MOCK_OVERVIEW);

		const { useAdminOverview } = await import("./useAdminOverview");
		const { result } = renderHook(() => useAdminOverview(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_OVERVIEW);
		expect(overviewApi.fetchAdminOverview).toHaveBeenCalledOnce();
	});

	it("returns error when API fails", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockRejectedValue(
			new Error("Forbidden"),
		);

		const { useAdminOverview } = await import("./useAdminOverview");
		const { result } = renderHook(() => useAdminOverview(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("starts in loading state", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockImplementation(
			() => new Promise(() => {}),
		);

		const { useAdminOverview } = await import("./useAdminOverview");
		const { result } = renderHook(() => useAdminOverview(), {
			wrapper: makeWrapper(),
		});

		expect(result.current.isPending).toBe(true);
	});
});
