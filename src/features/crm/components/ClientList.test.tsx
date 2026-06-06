import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock supabase module to prevent env-var check during module loading
vi.mock("@/shared/lib/supabase", () => ({
	supabase: {
		auth: {
			getSession: vi
				.fn()
				.mockResolvedValue({ data: { session: null }, error: null }),
			onAuthStateChange: vi
				.fn()
				.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
			signOut: vi.fn().mockResolvedValue({ error: null }),
		},
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
		}),
	},
}));

vi.mock("@/shared/hooks/useWorkshopId", () => ({
	useWorkshopId: () => "test-workshop-id",
}));

vi.mock("@/features/crm/hooks/useClients", () => ({
	useClientsPaginated: () => ({
		data: {
			data: [
				{
					id: "c1",
					name: "Test Client",
					phone: "555-1234",
					email: "test@example.com",
					source: "referral",
					created_at: "2026-01-01T00:00:00Z",
					updated_at: "2026-01-01T00:00:00Z",
					workshop_id: "w-1",
				},
			],
			count: 1,
		},
		isLoading: false,
		isError: false,
	}),
	useCreateClient: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useUpdateClient: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("@/shared/lib/fab", () => ({
	useFabAction: vi.fn(),
}));

vi.mock("@/shared/hooks/useOnlineStatus", () => ({
	useOnlineStatus: () => true,
}));

import { ClientList } from "./ClientList";

describe("ClientList with statsByClient prop", () => {
	const statsByClient = {
		c1: { count: 3, total: 150000, lastDate: "2026-06-01T00:00:00Z" },
	};

	it("renders client names and quote totals from statsByClient prop", () => {
		render(
			<MemoryRouter>
				<ClientList statsByClient={statsByClient} />
			</MemoryRouter>,
		);

		expect(screen.getByText("Test Client")).toBeTruthy();
		// formatCurrency uses es-AR locale: "$ 150.000" (dot separator)
		expect(screen.getByText(/150\.000/)).toBeTruthy();
		// 3 trabajos — use a more specific query to avoid matching phone "555-1234"
		expect(screen.getByText(/3 trabajo/)).toBeTruthy();
	});

	it("shows dash for clients without stats", () => {
		render(
			<MemoryRouter>
				<ClientList statsByClient={{}} />
			</MemoryRouter>,
		);

		expect(screen.getByText("Test Client")).toBeTruthy();
		expect(screen.getByText("—")).toBeTruthy();
	});
});
