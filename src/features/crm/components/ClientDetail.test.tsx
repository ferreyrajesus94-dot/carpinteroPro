import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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
	useClients: () => ({
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
	}),
	useDeleteClient: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
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

import { ClientDetail } from "./ClientDetail";

describe("ClientDetail with quotes and status badge props", () => {
	const quotesWithSalePrice = [
		{
			id: "q-1",
			quote_number: "Q-001",
			furniture_name: "Mesa de centro",
			status: "aprobado" as const,
			salePrice: 25000,
			created_at: "2026-06-01T00:00:00Z",
		},
		{
			id: "q-2",
			quote_number: "Q-002",
			furniture_name: "Silla",
			status: "entregado" as const,
			salePrice: 15000,
			created_at: "2026-05-01T00:00:00Z",
		},
	];

	const statsByClient = {
		c1: { count: 2, total: 40000 },
	};

	it("renders client info and stats from props", () => {
		render(
			<MemoryRouter initialEntries={["/crm/clientes/c1"]}>
				<Routes>
					<Route
						path="/crm/clientes/:id"
						element={
							<ClientDetail
								quotesWithSalePrice={quotesWithSalePrice}
								statsByClient={statsByClient}
								isQuotesLoading={false}
								QuoteStatusBadgeSlot={({ status }: { status: string }) => (
									<span data-testid="status-badge">{status}</span>
								)}
								clientProductionOrders={[]} isProductionLoading={false}
							/>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getAllByText("Test Client").length).toBeGreaterThanOrEqual(1);
		// "2" appears in sidebar and detail KPI card
		expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText(/40\.000/)).toBeTruthy();
	});

	it("renders quote history with sale prices and status badges", () => {
		render(
			<MemoryRouter initialEntries={["/crm/clientes/c1"]}>
				<Routes>
					<Route
						path="/crm/clientes/:id"
						element={
							<ClientDetail
								quotesWithSalePrice={quotesWithSalePrice}
								statsByClient={statsByClient}
								isQuotesLoading={false}
								QuoteStatusBadgeSlot={({ status }: { status: string }) => (
									<span data-testid="status-badge">{status}</span>
								)}
								clientProductionOrders={[]} isProductionLoading={false}
							/>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText("Mesa de centro")).toBeTruthy();
		expect(screen.getByText("Q-001")).toBeTruthy();
		expect(screen.getByText(/25\.000/)).toBeTruthy();
		expect(screen.getByText("Silla")).toBeTruthy();
		expect(screen.getByText("Q-002")).toBeTruthy();
		expect(screen.getByText(/15\.000/)).toBeTruthy();
	});

	it("shows empty state when no quotes", () => {
		render(
			<MemoryRouter initialEntries={["/crm/clientes/c1"]}>
				<Routes>
					<Route
						path="/crm/clientes/:id"
						element={
							<ClientDetail
								quotesWithSalePrice={[]}
								statsByClient={{ c1: { count: 0, total: 0 } }}
								isQuotesLoading={false}
								QuoteStatusBadgeSlot={({ status }: { status: string }) => (
									<span data-testid="status-badge">{status}</span>
								)}
								clientProductionOrders={[]} isProductionLoading={false}
							/>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText("Sin presupuestos aún.")).toBeTruthy();
	});
});
