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

const mockToggleMutate = vi.fn();
const mockForceMutate = vi.fn();
vi.mock("../hooks/useAdminActions", () => ({
	useToggleWorkshop: () => ({ mutate: mockToggleMutate, isPending: false }),
	useForceOnboarding: () => ({ mutate: mockForceMutate, isPending: false }),
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
		isActive: true,
		ownerEmail: null,
		profileCount: 4,
		onboardedProfileCount: 3,
		subscriptionStatus: "active",
		profiles: [
			{ id: "p-1", onboardedAt: "2026-01-16T00:00:00Z", email: "owner@test.com" },
			{ id: "p-2", onboardedAt: "2026-01-17T00:00:00Z", email: "user2@test.com" },
			{ id: "p-3", onboardedAt: null, email: "user3@test.com" },
		],
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

	it("shows deactivate button for active workshop", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(screen.getByText("Activo")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
	});

	it("shows activate button for inactive workshop", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue({
			workshop: { ...MOCK_DETAIL.workshop, isActive: false },
		});

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(screen.getByText("Inactivo")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument();
	});

	it("calls toggleWorkshop mutation on button click", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		screen.getByRole("button", { name: "Desactivar" }).click();

		expect(mockToggleMutate).toHaveBeenCalledWith({
			workshopId: "ws-1",
			active: false,
		});
	});

	it("shows profiles list with onboarded status", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		expect(screen.getByText("Perfiles")).toBeInTheDocument();
		expect(screen.getByText("owner@test.com")).toBeInTheDocument();
		expect(screen.getByText("user3@test.com")).toBeInTheDocument();
		expect(screen.getAllByText("Onboardeado")).toHaveLength(2);
	});

	it("shows force onboarding button for non-onboarded profiles", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		const forceButtons = screen.getAllByText("Forzar onboarding");
		expect(forceButtons).toHaveLength(1);
	});

	it("calls forceOnboarding mutation on button click", async () => {
		vi.mocked(workshopsApi.fetchAdminWorkshopDetail).mockResolvedValue(
			MOCK_DETAIL,
		);

		renderAtRoute("ws-1");

		await screen.findByText("Carpintería del Sur");

		screen.getByText("Forzar onboarding").click();

		expect(mockForceMutate).toHaveBeenCalledWith("p-3");
	});
});
