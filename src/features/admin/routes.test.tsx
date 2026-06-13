import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthStatus, ProfileIssue } from "@/shared/providers/AuthProvider";
import { AdminRoutes } from "./routes";

const authMock = vi.hoisted(() => ({
	state: {
		session: { user: { id: "u1", email: "admin@carpinteropro.app" } } as {
			user: { id: string; email: string };
		} | null,
		loading: false,
		status: "ready" as AuthStatus,
		profileIssue: null as ProfileIssue | null,
		onboardedAt: "2026-01-01T00:00:00Z" as string | null,
		workshopId: "ws-1" as string | null,
		isPlatformAdmin: true,
		signOut: vi.fn<() => Promise<void>>(),
		refreshProfile: vi.fn<() => Promise<void>>(),
	},
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => authMock.state,
}));

vi.mock("./api/overview", () => ({
	fetchAdminOverview: vi.fn(),
}));

vi.mock("./api/workshops", () => ({
	fetchAdminWorkshops: vi.fn(),
	fetchAdminWorkshopDetail: vi.fn(),
}));

vi.mock("./api/subscriptions", () => ({
	fetchAdminSubscriptions: vi.fn(),
}));

vi.mock("./api/support", () => ({
	fetchAdminSupportDiagnostics: vi.fn(),
}));

import * as overviewApi from "./api/overview";

const MOCK_OVERVIEW = {
	workshops: { total: 12, createdLast30Days: 3 },
	subscriptions: { total: 8, byStatus: { active: 5, cancelled: 2, paused: 1 } },
	support: { recentWebhookFailures: 1 },
};

function setAuthState(overrides: Partial<typeof authMock.state>) {
	Object.assign(authMock.state, overrides);
}

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

function renderAdminRoute(initialPath = "/admin") {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route path="/admin/*" element={<AdminRoutes />} />
				<Route path="/login" element={<div>Página de login</div>} />
			</Routes>
		</MemoryRouter>,
		{ wrapper: makeQueryWrapper() },
	);
}

describe("AdminRoutes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setAuthState({
			session: { user: { id: "u1", email: "admin@carpinteropro.app" } },
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			isPlatformAdmin: true,
			signOut: vi.fn<() => Promise<void>>(),
			refreshProfile: vi.fn<() => Promise<void>>(),
		});
	});

	it("renders a loading state while admin status resolves", () => {
		setAuthState({ loading: true, status: "profile_loading" });

		renderAdminRoute();

		expect(
			screen.getByRole("status", { name: "Cargando acceso de administrador" }),
		).toBeInTheDocument();
	});

	it("redirects unauthenticated users to login", () => {
		setAuthState({
			session: null,
			status: "unauthenticated",
			isPlatformAdmin: false,
		});

		renderAdminRoute();

		expect(screen.getByText("Página de login")).toBeInTheDocument();
	});

	it("renders forbidden state for authenticated non-admin users", () => {
		setAuthState({ isPlatformAdmin: false });

		renderAdminRoute();

		expect(
			screen.getByRole("heading", {
				name: "Acceso de administrador requerido",
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Panel de administrador"),
		).not.toBeInTheDocument();
	});

	it("renders dedicated admin layout for platform admins", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue(MOCK_OVERVIEW);

		renderAdminRoute();

		await screen.findByText("Talleres totales");

		expect(screen.getAllByText("Admin CarpinteroPro").length).toBeGreaterThan(
			0,
		);
		expect(
			screen.getByRole("navigation", { name: "Navegación de administración" }),
		).toBeInTheDocument();
	});
});
