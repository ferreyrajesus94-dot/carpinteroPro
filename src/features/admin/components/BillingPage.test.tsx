import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillingPage } from "./BillingPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("../api/subscriptions", () => ({
	fetchAdminSubscriptions: vi.fn(),
}));

vi.mock("../hooks/useAdminActions", () => ({
	useCancelSubscription: () => ({ mutate: vi.fn(), isPending: false }),
	useToggleSubscription: () => ({ mutate: vi.fn(), isPending: false }),
}));

import * as subscriptionsApi from "../api/subscriptions";

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(MemoryRouter, null, createElement(BillingPage)),
		),
	);
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
		{
			id: "sub-2",
			workshopId: "ws-2",
			workshopName: "Muebles Norte",
			status: "cancelled",
			plan: "annual",
			provider: "mercadopago",
			providerPreapprovalId: null,
			providerStatus: "cancelled",
			currentPeriodEnd: null,
			updatedAt: "2026-05-15T00:00:00Z",
		},
	],
};

describe("BillingPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockImplementation(
			() => new Promise(() => {}),
		);

		renderPage();

		expect(
			screen.getByRole("status", { name: "Cargando suscripciones" }),
		).toBeInTheDocument();
	});

	it("renders subscription table with data", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		renderPage();

		await screen.findByText("Carpintería del Sur");

		const table = screen.getByRole("table", { name: "Suscripciones" });
		expect(within(table).getByText("Carpintería del Sur")).toBeInTheDocument();
		expect(within(table).getByText("Muebles Norte")).toBeInTheDocument();
	});

	it("shows status badges with proper styling", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		renderPage();

		await screen.findByText("Carpintería del Sur");

		expect(screen.getByText("activa")).toBeInTheDocument();
		expect(screen.getByText("cancelada")).toBeInTheDocument();
	});

	it("has a status filter dropdown", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		renderPage();

		await screen.findByText("Carpintería del Sur");

		expect(
			screen.getByRole("combobox", { name: "Filtrar por estado" }),
		).toBeInTheDocument();
	});

	it("shows cancel and pause buttons but not retry or refund", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		renderPage();

		await screen.findByText("Carpintería del Sur");

		// Cancel button is now exposed (SDD-10)
		expect(
			screen.getByRole("button", { name: /cancelar/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /pausar/i })).toBeInTheDocument();
		// Retry and refund are still not exposed
		expect(
			screen.queryByRole("button", { name: /reintentar/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /reembolsar/i }),
		).not.toBeInTheDocument();
	});

	it("renders empty state when no subscriptions exist", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue({
			subscriptions: [],
		});

		renderPage();

		await screen.findByText("No se encontraron suscripciones");
	});

	it("renders error state when API fails", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockRejectedValue(
			new Error("Service unavailable"),
		);

		renderPage();

		await screen.findByRole("alert", {
			name: "Error al cargar suscripciones",
		});
		expect(
			screen.getByText(/No se pudieron cargar las suscripciones/),
		).toBeInTheDocument();
	});

	it("links each subscription to its workshop detail", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		renderPage();

		await screen.findByText("Carpintería del Sur");

		const wsLink = screen.getByRole("link", {
			name: "Ver taller Carpintería del Sur",
		});
		expect(wsLink).toHaveAttribute("href", "/admin/workshops/ws-1");
	});

	it("expands a subscription row to show provider details on click", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		const { fireEvent } = await import("@testing-library/react");
		renderPage();

		await screen.findByText("Carpintería del Sur");

		// Provider details should not be visible by default
		expect(screen.queryByText("pre-123")).not.toBeInTheDocument();

		// Click the first row to expand
		const firstRow = screen.getByText("Carpintería del Sur").closest("tr")!;
		fireEvent.click(firstRow);

		// Provider details should now be visible
		await screen.findByText("pre-123");
		expect(screen.getByText("authorized")).toBeInTheDocument();
	});

	it("collapses an expanded subscription row on second click", async () => {
		vi.mocked(subscriptionsApi.fetchAdminSubscriptions).mockResolvedValue(
			MOCK_SUBSCRIPTIONS,
		);

		const { fireEvent } = await import("@testing-library/react");
		renderPage();

		await screen.findByText("Carpintería del Sur");

		const firstRow = screen.getByText("Carpintería del Sur").closest("tr")!;

		// Expand
		fireEvent.click(firstRow);
		await screen.findByText("pre-123");

		// Collapse
		fireEvent.click(firstRow);
		await vi.waitFor(() => {
			expect(screen.queryByText("pre-123")).not.toBeInTheDocument();
		});
	});
});
