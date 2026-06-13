import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OverviewPage } from "./OverviewPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({ isPlatformAdmin: true }),
}));

vi.mock("../api/overview", () => ({
	fetchAdminOverview: vi.fn(),
}));

import * as overviewApi from "../api/overview";

function renderWithQuery(ui: React.ReactElement) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(createElement(QueryClientProvider, { client }, ui));
}

const MOCK_OVERVIEW = {
	workshops: { total: 12, createdLast30Days: 3 },
	subscriptions: {
		total: 8,
		byStatus: { active: 5, cancelled: 2, paused: 1 },
	},
	support: { recentWebhookFailures: 1 },
};

describe("OverviewPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders a loading skeleton while data loads", () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockImplementation(
			() => new Promise(() => {}),
		);

		renderWithQuery(<OverviewPage />);

		expect(
			screen.getByRole("status", {
				name: "Cargando resumen de plataforma",
			}),
		).toBeInTheDocument();
	});

	it("renders KPI cards with overview data", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue(MOCK_OVERVIEW);

		renderWithQuery(<OverviewPage />);

		await screen.findByText("Talleres totales");

		const kpiSection = screen.getByRole("region", {
			name: "Indicadores de plataforma",
		});
		expect(within(kpiSection).getByText("12")).toBeInTheDocument();
		expect(within(kpiSection).getByText("3")).toBeInTheDocument();
		expect(within(kpiSection).getByText("8")).toBeInTheDocument();
		expect(within(kpiSection).getByText("1")).toBeInTheDocument();
	});

	it("shows subscription status breakdown", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue(MOCK_OVERVIEW);

		renderWithQuery(<OverviewPage />);

		await screen.findByText("Talleres totales");

		expect(
			screen.getByRole("region", { name: "Suscripciones por estado" }),
		).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("activas")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("canceladas")).toBeInTheDocument();
	});

	it("shows zeroes gracefully when platform has no data", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue({
			workshops: { total: 0, createdLast30Days: 0 },
			subscriptions: { total: 0, byStatus: {} },
			support: { recentWebhookFailures: 0 },
		});

		renderWithQuery(<OverviewPage />);

		await screen.findByText("Talleres totales");
		expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);
	});

	it("renders error state when API fails", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockRejectedValue(
			new Error("Service unavailable"),
		);

		renderWithQuery(<OverviewPage />);

		await screen.findByRole("alert", {
			name: "Error al cargar el resumen",
		});
		expect(
			screen.getByText(/No se pudo cargar el resumen/),
		).toBeInTheDocument();
	});

	it("shows the webhook failure alert when failures exist", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue({
			...MOCK_OVERVIEW,
			support: { recentWebhookFailures: 5 },
		});

		renderWithQuery(<OverviewPage />);

		await screen.findByText("Talleres totales");
		expect(screen.getByRole("status", { name: /webhook/ })).toBeInTheDocument();
	});

	it("does not show webhook alert when there are no failures", async () => {
		vi.mocked(overviewApi.fetchAdminOverview).mockResolvedValue({
			...MOCK_OVERVIEW,
			support: { recentWebhookFailures: 0 },
		});

		renderWithQuery(<OverviewPage />);

		await screen.findByText("Talleres totales");
		expect(
			screen.queryByRole("status", { name: /webhook/ }),
		).not.toBeInTheDocument();
	});
});
