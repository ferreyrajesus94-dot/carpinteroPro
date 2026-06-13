import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkshopsPage } from "./WorkshopsPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("../api/workshops", () => ({
	fetchAdminWorkshops: vi.fn(),
}));

import * as workshopsApi from "../api/workshops";

function renderWithQuery(ui: React.ReactElement) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(MemoryRouter, null, ui),
		),
	);
}

const MOCK_WORKSHOPS = {
	workshops: [
		{
			id: "ws-1",
			name: "Carpintería del Sur",
			createdAt: "2026-01-15T00:00:00Z",
			ownerEmail: null,
			profileCount: 4,
			onboardedProfileCount: 3,
			subscriptionStatus: "active",
		},
		{
			id: "ws-2",
			name: "Muebles Norte",
			createdAt: "2026-03-01T00:00:00Z",
			ownerEmail: null,
			profileCount: 2,
			onboardedProfileCount: 2,
			subscriptionStatus: null,
		},
	],
};

describe("WorkshopsPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockImplementation(
			() => new Promise(() => {}),
		);

		renderWithQuery(<WorkshopsPage />);

		expect(
			screen.getByRole("status", {
				name: "Cargando talleres",
			}),
		).toBeInTheDocument();
	});

	it("renders the workshops table with data", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		renderWithQuery(<WorkshopsPage />);

		await screen.findByText("Carpintería del Sur");

		const table = screen.getByRole("table", { name: "Talleres" });
		expect(within(table).getByText("Carpintería del Sur")).toBeInTheDocument();
		expect(within(table).getByText("Muebles Norte")).toBeInTheDocument();
		// Profile and onboarded counts are rendered as monospaced numbers
		expect(within(table).getAllByText("4").length).toBeGreaterThanOrEqual(1);
		expect(within(table).getAllByText("2").length).toBeGreaterThanOrEqual(1);
	});

	it("shows subscription status badges", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		renderWithQuery(<WorkshopsPage />);

		await screen.findByText("Carpintería del Sur");

		expect(screen.getByText("activa")).toBeInTheDocument();
		expect(screen.getByText("sin suscripción")).toBeInTheDocument();
	});

	it("renders empty state when no workshops exist", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue({
			workshops: [],
		});

		renderWithQuery(<WorkshopsPage />);

		await screen.findByText("No se encontraron talleres");
	});

	it("renders error state when API fails", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockRejectedValue(
			new Error("Service unavailable"),
		);

		renderWithQuery(<WorkshopsPage />);

		await screen.findByRole("alert", {
			name: "Error al cargar talleres",
		});
		expect(
			screen.getByText(/No se pudieron cargar los talleres/),
		).toBeInTheDocument();
	});

	it("has a search input that triggers query with search param", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		const { fireEvent } = await import("@testing-library/react");
		renderWithQuery(<WorkshopsPage />);

		await screen.findByText("Carpintería del Sur");

		const searchInput = screen.getByRole("searchbox", {
			name: "Buscar talleres",
		});
		fireEvent.change(searchInput, { target: { value: "sur" } });

		// Wait for the debounced re-fetch
		await vi.waitFor(
			() => {
				expect(workshopsApi.fetchAdminWorkshops).toHaveBeenCalledWith("sur");
			},
			{ timeout: 1000 },
		);
	});

	it("links each workshop to its detail page", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);

		renderWithQuery(<WorkshopsPage />);

		await screen.findByText("Carpintería del Sur");

		const links = screen.getAllByRole("link", { name: /Ver detalle/ });
		expect(links[0]).toHaveAttribute("href", "/admin/workshops/ws-1");
		expect(links[1]).toHaveAttribute("href", "/admin/workshops/ws-2");
	});
});
