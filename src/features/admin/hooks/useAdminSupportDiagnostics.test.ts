import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/features/admin/api/support", () => ({
	fetchAdminSupportDiagnostics: vi.fn(),
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

import * as supportApi from "@/features/admin/api/support";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

const MOCK_DIAGNOSTICS = {
	diagnostics: [
		{
			id: "evt-1",
			provider: "mercadopago",
			providerEventId: "mp-123",
			eventType: "payment.succeeded",
			providerResourceId: "pre-123",
			workshopId: "ws-1",
			processedAt: "2026-06-01T12:00:00Z",
			updatedAt: "2026-06-01T12:00:01Z",
		},
	],
};

describe("useAdminSupportDiagnostics", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns diagnostics from the Edge Function", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		const { useAdminSupportDiagnostics } = await import(
			"./useAdminSupportDiagnostics"
		);
		const { result } = renderHook(() => useAdminSupportDiagnostics(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(MOCK_DIAGNOSTICS);
		expect(
			supportApi.fetchAdminSupportDiagnostics,
		).toHaveBeenCalledWith(undefined);
	});

	it("passes workshopId filter to the API", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		const { useAdminSupportDiagnostics } = await import(
			"./useAdminSupportDiagnostics"
		);
		const { result } = renderHook(
			() => useAdminSupportDiagnostics("ws-1"),
			{ wrapper: makeWrapper() },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(
			supportApi.fetchAdminSupportDiagnostics,
		).toHaveBeenCalledWith("ws-1");
	});

	it("returns error when API fails", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockRejectedValue(
			new Error("Service unavailable"),
		);

		const { useAdminSupportDiagnostics } = await import(
			"./useAdminSupportDiagnostics"
		);
		const { result } = renderHook(() => useAdminSupportDiagnostics(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBeInstanceOf(Error);
	});

	it("returns empty diagnostics array when no events exist", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue({
			diagnostics: [],
		});

		const { useAdminSupportDiagnostics } = await import(
			"./useAdminSupportDiagnostics"
		);
		const { result } = renderHook(() => useAdminSupportDiagnostics(), {
			wrapper: makeWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.diagnostics).toEqual([]);
	});
});
