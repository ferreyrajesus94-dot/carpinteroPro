import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { SubscriptionRow } from "@/features/billing/types";

vi.mock("@/features/billing/api/subscriptions", () => ({
	fetchSubscription: vi.fn(),
}));

import * as subscriptionsApi from "@/features/billing/api/subscriptions";

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_SUB: SubscriptionRow = {
	id: "sub-1",
	workshop_id: WORKSHOP_ID,
	status: "trialing",
	plan: "pro_monthly",
	provider: "mercadopago",
	trial_starts_at: "2026-01-01T00:00:00Z",
	trial_ends_at: "2099-01-01T00:00:00Z",
	current_period_starts_at: null,
	current_period_ends_at: null,
	provider_subscription_id: null,
	provider_preapproval_id: null,
	provider_status: null,
	cancel_at_period_end: false,
	cancelled_at: null,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

describe("useSubscription", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns subscription data when API succeeds", async () => {
		vi.mocked(subscriptionsApi.fetchSubscription).mockResolvedValue(MOCK_SUB);

		const { useSubscription } = await import("./useSubscription");
		const { result } = renderHook(
			() => useSubscription(WORKSHOP_ID, "2026-01-01T00:00:00Z"),
			{ wrapper: makeWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_SUB);
		expect(subscriptionsApi.fetchSubscription).toHaveBeenCalledWith(
			WORKSHOP_ID,
		);
	});

	it("returns null when no subscription exists", async () => {
		vi.mocked(subscriptionsApi.fetchSubscription).mockResolvedValue(null);

		const { useSubscription } = await import("./useSubscription");
		const { result } = renderHook(
			() => useSubscription(WORKSHOP_ID, "2026-01-01T00:00:00Z"),
			{ wrapper: makeWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toBeNull();
	});

	it("returns error when API fails", async () => {
		vi.mocked(subscriptionsApi.fetchSubscription).mockRejectedValue(
			new Error("Network error"),
		);

		const { useSubscription } = await import("./useSubscription");
		const { result } = renderHook(
			() => useSubscription(WORKSHOP_ID, "2026-01-01T00:00:00Z"),
			{ wrapper: makeWrapper() },
		);

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("does not fetch when workshopId is null", async () => {
		const { useSubscription } = await import("./useSubscription");
		const { result } = renderHook(
			() => useSubscription(null, "2026-01-01T00:00:00Z"),
			{ wrapper: makeWrapper() },
		);

		expect(result.current.isPending).toBe(true);
		expect(subscriptionsApi.fetchSubscription).not.toHaveBeenCalled();
	});

	it("does not fetch when onboardedAt is null", async () => {
		const { useSubscription } = await import("./useSubscription");
		const { result } = renderHook(() => useSubscription(WORKSHOP_ID, null), {
			wrapper: makeWrapper(),
		});

		expect(result.current.isPending).toBe(true);
		expect(subscriptionsApi.fetchSubscription).not.toHaveBeenCalled();
	});
});
