import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkshopDetailPage } from "./WorkshopDetailPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("../api/workshops", () => ({
	fetchAdminWorkshopDetail: vi.fn(),
}));

import * as workshopsApi from "../api/workshops";

function renderWithQuery(ui: React.ReactElement) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(createElement(QueryClientProvider, { client }, ui));
}

function renderAtRoute(workshopId: string) {
	return renderWithQuery(
		createElement(
			MemoryRouter,
			{ initialEntries: [`/admin/workshops/${workshopId}`] },
			createElement(
				Routes,
				null,
				createElement(Route, {
					path: "/admin/workshops/:workshopId",
					element: createElement(WorkshopDetailPage),
				}),
			),
		),
	);
}

const MOCK_DETAIL = {
	workshop: {
		id: "ws-1",
		name: "Carpintería del Sur",
		createdAt: "2026-01-15T00:00:00Z",
		ownerEmail: null,
		profileCount: 4,
		onboardedProfileCount: 3,
		subscriptionStatus: "active",
	},
};

describe("WorkshopDetailPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockImplementation(
			() => new Promise(() => {}),
		);

		renderAtRoute("ws-1");

		expect(
			screen.getByRole("status", {
				name: "Cargando detalle del taller",
			}),
		).toBeInTheDocument();
	});

	it("renders workshop detail data", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(
			screen.getByRole("heading", { name: "Carpintería del Sur" }),
		).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
		expect(screen.getByText("activa")).toBeInTheDocument();
	});

	it("renders not-found state for unknown workshop", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockRejectedValue(
			new Error("Taller no encontrado"),
		);

		renderAtRoute("unknown-id");

		await screen.findByText("Taller no encontrado");

		expect(
			screen.getByRole("link", { name: /Volver a talleres/ }),
		).toHaveAttribute("href", "/admin/workshops");
	});

	it("renders error state for server errors", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockRejectedValue(
			new Error("Internal server error"),
		);

		renderAtRoute("ws-1");

		await screen.findByRole("alert", {
			name: "Error al cargar el detalle",
		});
		expect(
			screen.getByText(/No se pudo cargar el detalle/),
		).toBeInTheDocument();
	});

	it("shows support context section with profile counts", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(
			screen.getByRole("region", { name: "Contexto de soporte" }),
		).toBeInTheDocument();
		expect(screen.getByText(/Perfiles totales/)).toBeInTheDocument();
		expect(screen.getByText(/Perfiles onboardeados/)).toBeInTheDocument();
	});

	it("has a back link to workshops list", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(
			screen.getByRole("link", { name: "Volver a talleres" }),
		).toHaveAttribute("href", "/admin/workshops");
	});
});
