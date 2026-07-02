import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// PR 8: the production pipeline widget is mounted on the home dashboard.
// We mock the barrel export so the test focuses on the dashboard's
// integration contract (the widget renders, is mounted exactly once, and
// is also mounted in the loading skeleton state) and does not need to
// re-test the widget's own render/loading/error branches (those are
// exercised by `ProductionPipelineWidget.test.tsx`).
vi.mock("@/features/production", () => ({
	ProductionPipelineWidget: () => (
		<div data-testid="dashboard-pipeline-widget">Pipeline mock</div>
	),
}));

import { Dashboard } from "./Dashboard";
import type { DashboardMaterial, DashboardQuote } from "../types";

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
	// production pipeline widget is also mounted in the loading
	// state (its own loading affordance is exercised in
	// `ProductionPipelineWidget.test.tsx`); the widget is mocked to
	// a static testid div in this test file, so the 4-pulse count
	// here is the outer dashboard skeleton only.
	it("renders the loading skeleton from the injected loading state", () => {
		const { container } = render(
			<MemoryRouter>
				<Dashboard quotes={[]} materials={[]} isLoading />
			</MemoryRouter>,
		);

		expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
	});
});

describe("Dashboard — production pipeline widget integration (PR 8)", () => {
	it("mounts the production pipeline widget from the production barrel on the home dashboard", () => {
		render(
			<MemoryRouter>
				<Dashboard
					quotes={[makeQuote()]}
					materials={[makeMaterial()]}
					isLoading={false}
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
				/>
			</MemoryRouter>,
		);

		expect(screen.getAllByTestId("dashboard-pipeline-widget")).toHaveLength(1);
	});

	it("the production pipeline widget is still mounted in the loading skeleton state", () => {
		// The dashboard keeps the 4-pulse outer loading skeleton
		// when the outer quotes query is loading. The pipeline
		// widget lives in the production feature and reads its own
		// data through `useProductionPipelineStats`; the widget is
		// shown to keep the dashboard layout stable while the outer
		// quotes query fetches (the widget handles its own loading
		// state inline).
		render(
			<MemoryRouter>
				<Dashboard quotes={[]} materials={[]} isLoading />
			</MemoryRouter>,
		);

		expect(screen.getByTestId("dashboard-pipeline-widget")).toBeInTheDocument();
	});
});
