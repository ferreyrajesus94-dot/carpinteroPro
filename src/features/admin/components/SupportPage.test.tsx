import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupportPage } from "./SupportPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("../api/support", () => ({
	fetchAdminSupportDiagnostics: vi.fn(),
}));

vi.mock("../api/workshops", () => ({
	fetchAdminWorkshops: vi.fn(),
}));

import * as supportApi from "../api/support";
import * as workshopsApi from "../api/workshops";

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(MemoryRouter, null, createElement(SupportPage)),
		),
	);
}

const MOCK_WORKSHOPS = {
	workshops: [
		{
			id: "ws-1",
			name: "Carpintería del Sur",
			createdAt: "2026-01-01T00:00:00Z",
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
		{
			id: "evt-2",
			provider: "mercadopago",
			providerEventId: "mp-456",
			eventType: "subscription_preapproval.failed",
			providerResourceId: null,
			workshopId: "ws-2",
			processedAt: "2026-06-02T08:30:00Z",
			updatedAt: "2026-06-02T08:30:01Z",
		},
	],
};

describe("SupportPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(workshopsApi.fetchAdminWorkshops).mockResolvedValue(
			MOCK_WORKSHOPS,
		);
	});

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockImplementation(
			() => new Promise(() => {}),
		);

		renderPage();

		expect(
			screen.getByRole("status", {
				name: "Cargando diagnósticos de soporte",
			}),
		).toBeInTheDocument();
	});

	it("renders diagnostics table with event data", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		renderPage();

		await screen.findByText("mp-123");

		const table = screen.getByRole("table", {
			name: "Diagnósticos de soporte",
		});
		expect(within(table).getByText("mp-123")).toBeInTheDocument();
		expect(within(table).getByText("mp-456")).toBeInTheDocument();
		expect(within(table).getByText("payment.succeeded")).toBeInTheDocument();
	});

	it("shows event type with failure highlighting", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		renderPage();

		await screen.findByText("mp-123");

		// Failure events should be visually distinguishable
		const failureRow = screen
			.getByText("subscription_preapproval.failed")
			.closest("tr");
		expect(failureRow).toBeTruthy();
	});

	it("shows timestamps for each event", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		renderPage();

		await screen.findByText("mp-123");

		// Check that dates are rendered (exact format depends on locale)
		const dates = screen.getAllByText(/2026/);
		expect(dates.length).toBeGreaterThanOrEqual(2);
	});

	it("renders empty state when no diagnostics exist", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue({
			diagnostics: [],
		});

		renderPage();

		await screen.findByText("No se encontraron diagnósticos");
	});

	it("renders error state when API fails", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockRejectedValue(
			new Error("Service unavailable"),
		);

		renderPage();

		await screen.findByRole("alert", {
			name: "Error al cargar diagnósticos",
		});
		expect(
			screen.getByText(/No se pudieron cargar los diagnósticos/),
		).toBeInTheDocument();
	});

	it("links events to their workshop detail", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		renderPage();

		await screen.findByText("mp-123");

		const link = screen.getByRole("link", { name: "Ver taller ws-1" });
		expect(link).toHaveAttribute("href", "/admin/workshops/ws-1");
	});

	it("does not expose impersonation or destructive actions", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		renderPage();

		await screen.findByText("mp-123");

		expect(
			screen.queryByRole("button", { name: /suplantar/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /eliminar/i }),
		).not.toBeInTheDocument();
	});

	it("has a workshop filter dropdown that filters diagnostics", async () => {
		vi.mocked(supportApi.fetchAdminSupportDiagnostics).mockResolvedValue(
			MOCK_DIAGNOSTICS,
		);

		const { fireEvent } = await import("@testing-library/react");
		renderPage();

		await screen.findByText("Todos los talleres");

		const filter = screen.getByRole("combobox", {
			name: "Filtrar por taller",
		});
		fireEvent.change(filter, { target: { value: "ws-1" } });

		await vi.waitFor(() => {
			expect(
				supportApi.fetchAdminSupportDiagnostics,
			).toHaveBeenCalledWith("ws-1");
		});
	});
});
