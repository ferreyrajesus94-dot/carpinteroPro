import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("../hooks/useProductionOrders", () => ({
	useProductionPipelineStats: vi.fn(),
}));

import { useProductionPipelineStats } from "../hooks/useProductionOrders";
import { ProductionPipelineWidget } from "./ProductionPipelineWidget";

const mockUseProductionPipelineStats = vi.mocked(useProductionPipelineStats);

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

// PR 8 review-blocker fix #2: the SQL contract now returns
// exactly 5 rows (one per ACTIVE state). Terminal states
// (delivered, cancelled) are EXCLUDED at the SQL layer per
// the production-orders spec. The widget's `SAMPLE_STATS`
// fixture mirrors the new contract: 5 active-state rows,
// no terminal rows. The widget-level triangulation for
// terminal-state exclusion (defense in depth) lives in the
// dedicated `describe` block at the bottom of the file.
const SAMPLE_STATS: Array<{
	state:
		| "planned"
		| "in_progress"
		| "paused"
		| "quality_check"
		| "ready";
	count: number;
}> = [
	{ state: "planned", count: 3 },
	{ state: "in_progress", count: 5 },
	{ state: "paused", count: 1 },
	{ state: "quality_check", count: 2 },
	{ state: "ready", count: 4 },
];

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ProductionPipelineWidget — render contract", () => {
	it("renders one swatch per active state and a total count of all active orders", () => {
		mockUseProductionPipelineStats.mockReturnValue({
			data: SAMPLE_STATS,
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// The widget title is "Pipeline de producción" (Spanish UI).
		expect(
			screen.getByRole("heading", { name: /pipeline/i }),
		).toBeInTheDocument();

		// Total count = 3 + 5 + 1 + 2 + 4 = 15. Terminal states (delivered,
		// cancelled) are EXCLUDED at the SQL layer per the spec — the
		// hook never returns them.
		const total = screen.getByTestId("pipeline-total");
		expect(total).toHaveTextContent("15");

		// The five active states each render a swatch.
		const list = screen.getByTestId("pipeline-swatches");
		const swatchStates = within(list)
			.getAllByTestId("pipeline-swatch")
			.map((el) => el.getAttribute("data-state"));
		expect(swatchStates).toEqual([
			"planned",
			"in_progress",
			"paused",
			"quality_check",
			"ready",
		]);

		// Each swatch renders its own count.
		for (const stat of SAMPLE_STATS) {
			const swatch = screen.getByTestId(
				`pipeline-swatch-count-${stat.state}`,
			);
			expect(swatch).toHaveTextContent(String(stat.count));
		}
	});

	it("renders a total of 0 when the workshop has no active production orders", () => {
		mockUseProductionPipelineStats.mockReturnValue({
			data: SAMPLE_STATS.map((s) => ({ ...s, count: 0 })),
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		const total = screen.getByTestId("pipeline-total");
		expect(total).toHaveTextContent("0");
		// Each active state swatch renders a "0" count.
		for (const state of [
			"planned",
			"in_progress",
			"paused",
			"quality_check",
			"ready",
		] as const) {
			expect(
				screen.getByTestId(`pipeline-swatch-count-${state}`),
			).toHaveTextContent("0");
		}
	});

	// TRIANGULATE: even when only one state has orders, the widget shows
	// the other four active states with a "0" count (the canonical
	// `get_production_pipeline_stats` always returns 5 active-state rows).
	it("renders every active state (with a 0 count) even when only one state has orders", () => {
		mockUseProductionPipelineStats.mockReturnValue({
			data: SAMPLE_STATS.map((s) =>
				s.state === "in_progress" ? { state: s.state, count: 7 } : { state: s.state, count: 0 },
			),
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// All 5 active swatches render.
		const swatches = screen.getAllByTestId("pipeline-swatch");
		expect(swatches).toHaveLength(5);

		// The total reflects only the in_progress count (the SQL contract
		// never returns terminal states).
		expect(screen.getByTestId("pipeline-total")).toHaveTextContent("7");
	});
});

describe("ProductionPipelineWidget — loading and error states", () => {
	it("renders a loading placeholder when the stats are fetching", () => {
		mockUseProductionPipelineStats.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// The widget stays mounted and surfaces a loading affordance
		// (status role per the shared `feedback-state` pattern).
		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("renders an error message when the stats request fails", () => {
		mockUseProductionPipelineStats.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// The widget surfaces the error inline so the dashboard can keep
		// rendering the rest of the page.
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});
});

describe("ProductionPipelineWidget — terminal-state exclusion (defense in depth)", () => {
	// PR 8 review-blocker fix #2: the SQL contract now returns
	// exactly 5 rows (one per active state) and NEVER includes
	// terminal states. The widget's `PRODUCTION_ORDER_ACTIVE_STATES`
	// loop is the second line of defense: even if a regression
	// re-introduced terminal states in the SQL payload, the widget
	// would not render them and would not include them in the
	// total. These two tests pin the widget-level defense-in-depth
	// contract by INJECTING tampered data that includes terminal
	// states and asserting the widget still excludes them.

	it("does NOT render a swatch for delivered or cancelled (defense in depth)", () => {
		// Inject the pre-fix 7-row payload (active + terminal). The
		// widget must render only the 5 active swatches.
		const tamperedStats: Array<{
			state:
				| "planned"
				| "in_progress"
				| "paused"
				| "quality_check"
				| "ready"
				| "delivered"
				| "cancelled";
			count: number;
		}> = [
			...SAMPLE_STATS,
			{ state: "delivered", count: 0 },
			{ state: "cancelled", count: 0 },
		];
		mockUseProductionPipelineStats.mockReturnValue({
			data: tamperedStats,
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// Active states render 5 swatches; terminal states never render
		// (the widget iterates over PRODUCTION_ORDER_ACTIVE_STATES,
		// not over the data).
		const swatches = screen.getAllByTestId("pipeline-swatch");
		expect(swatches).toHaveLength(5);

		// Explicitly assert the terminal states do NOT render.
		expect(
			screen.queryByTestId("pipeline-swatch-count-delivered"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId("pipeline-swatch-count-cancelled"),
		).not.toBeInTheDocument();
	});

	it("does NOT include delivered/cancelled counts in the total (defense in depth)", () => {
		// Pretend terminal states have non-zero counts — they should
		// still be excluded from the widget total. The SQL contract
		// already excludes terminal states, but a regression that
		// re-broadens the CTE would still be caught at the widget
		// layer.
		const tamperedStats: Array<{
			state:
				| "planned"
				| "in_progress"
				| "paused"
				| "quality_check"
				| "ready"
				| "delivered"
				| "cancelled";
			count: number;
		}> = [
			...SAMPLE_STATS,
			{ state: "delivered", count: 99 },
			{ state: "cancelled", count: 99 },
		];
		mockUseProductionPipelineStats.mockReturnValue({
			data: tamperedStats,
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionPipelineStats>);

		render(<ProductionPipelineWidget />, { wrapper: makeQueryWrapper() });

		// Total is still 15 (3 + 5 + 1 + 2 + 4). 99 and 99 from terminal
		// states are excluded by the widget's PRODUCTION_ORDER_ACTIVE_STATES
		// loop.
		expect(screen.getByTestId("pipeline-total")).toHaveTextContent("15");
	});
});
