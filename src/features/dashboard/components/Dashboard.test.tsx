import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { Dashboard } from "./Dashboard";
import type { DashboardMaterial, DashboardQuote } from "../types";

const dashboardPipelineWidget = (
	<div data-testid="dashboard-pipeline-widget">Pipeline mock</div>
);

function makeQuote(overrides: Partial<DashboardQuote> = {}): DashboardQuote {
	return {
		id: "q1",
		quote_number: "P-001",
		furniture_name: "Mesa ratona",
		recipe_cost: 1000,
		margin_mode: "on_cost",
		margin_pct: 0,
		status: "aprobado",
		created_at: new Date().toISOString(),
		extras: [],
		client: { name: "Cliente Demo" },
		...overrides,
	};
}

function makeMaterial(overrides: Partial<DashboardMaterial> = {}): DashboardMaterial {
	return {
		id: "m1",
		name: "Melamina blanca",
		stock: 1,
		min_stock: 2,
		...overrides,
	};
}

describe("Dashboard prop contracts", () => {
	it("renders KPI and attention data from injected quotes and materials", () => {
		render(
			<MemoryRouter>
				<Dashboard
					quotes={[makeQuote()]}
					materials={[makeMaterial()]}
					isLoading={false}
					productionPipelineWidget={dashboardPipelineWidget}
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText(/Facturado — Mes actual/)).toBeInTheDocument();
		expect(screen.getAllByText("$ 1.000").length).toBeGreaterThan(0);
		expect(screen.getByText("1 material en stock bajo")).toBeInTheDocument();
		expect(screen.getByText("Melamina blanca")).toBeInTheDocument();
	});

	// The loading skeleton renders 4 outer dashboard pulses. The
	// injected pipeline widget is exercised separately by its own
	// feature tests, so the 4-pulse count here is the outer dashboard
	// skeleton only.
	it("renders the loading skeleton from the injected loading state", () => {
		const { container } = render(
			<MemoryRouter>
				<Dashboard
					quotes={[]}
					materials={[]}
					isLoading
					productionPipelineWidget={dashboardPipelineWidget}
				/>
			</MemoryRouter>,
		);

		expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
	});
});

describe("Dashboard — production pipeline widget integration", () => {
	it("mounts the injected production pipeline widget on the home dashboard", () => {
		render(
			<MemoryRouter>
				<Dashboard
					quotes={[makeQuote()]}
					materials={[makeMaterial()]}
					isLoading={false}
					productionPipelineWidget={dashboardPipelineWidget}
				/>
			</MemoryRouter>,
		);

		// The widget renders inside the dashboard. We use the testid
		// (a stable, semantic handle) so a future DOM-structure
		// refactor does not break this test.
		expect(screen.getByTestId("dashboard-pipeline-widget")).toBeInTheDocument();
	});

	it("the production pipeline widget is mounted exactly once", () => {
		render(
			<MemoryRouter>
				<Dashboard
					quotes={[makeQuote()]}
					materials={[makeMaterial()]}
					isLoading={false}
					productionPipelineWidget={dashboardPipelineWidget}
				/>
			</MemoryRouter>,
		);

		expect(screen.getAllByTestId("dashboard-pipeline-widget")).toHaveLength(1);
	});

	it("the production pipeline widget is still mounted in the loading skeleton state", () => {
		render(
			<MemoryRouter>
				<Dashboard
					quotes={[]}
					materials={[]}
					isLoading
					productionPipelineWidget={dashboardPipelineWidget}
				/>
			</MemoryRouter>,
		);

		expect(screen.getByTestId("dashboard-pipeline-widget")).toBeInTheDocument();
	});
});
