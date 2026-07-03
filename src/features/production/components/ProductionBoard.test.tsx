import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../hooks/useProductionOrders", () => ({
	useProductionOrders: vi.fn(),
	useQuotesWithProductionStatus: vi.fn(),
}));

vi.mock("../api/productionOrders", () => ({
	PRODUCTION_ORDER_ACTIVE_STATES: [
		"planned",
		"in_progress",
		"paused",
		"quality_check",
		"ready",
	],
}));

import { useProductionOrders, useQuotesWithProductionStatus } from "../hooks/useProductionOrders";
import { ProductionBoard } from "./ProductionBoard";

const mockUseProductionOrders = vi.mocked(useProductionOrders);
const mockUseQuotesWithProductionStatus = vi.mocked(useQuotesWithProductionStatus);

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const QUOTE_ID = "22222222-2222-4222-8222-222222222222";

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(
			MemoryRouter,
			null,
			createElement(QueryClientProvider, { client }, children),
		);
}

const baseOrder = {
	id: "order-1",
	workshop_id: WORKSHOP_ID,
	quote_id: QUOTE_ID,
	production_number: "OP-2026-0001",
	planned_start_date: "2026-07-01",
	planned_end_date: "2026-07-10",
	actual_start_date: null,
	actual_end_date: null,
	assigned_to: null,
	notes: null,
	created_at: "2026-06-30T10:00:00Z",
	updated_at: "2026-06-30T10:00:00Z",
	quote_number: "Q-2026-0001",
	quote_furniture_name: "Mesa de roble",
	assigned_to_name: "",
};

const approvedQuote = {
	id: QUOTE_ID,
	workshop_id: WORKSHOP_ID,
	quote_number: "Q-2026-0001",
	furniture_name: "Mesa de roble",
	client_id: null,
	client_name: "Acme SRL",
	stored_status: "aprobado" as const,
	production_status: "aprobado" as const,
	has_active_production: false,
	last_event_at: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	mockUseQuotesWithProductionStatus.mockReturnValue({
		data: [approvedQuote],
		isLoading: false,
		isError: false,
	} as unknown as ReturnType<typeof useQuotesWithProductionStatus>);
});

describe("ProductionBoard — column rendering", () => {
	it("renders one column per active state (5 columns)", () => {
		mockUseProductionOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		// Each active state appears as a column heading
		expect(screen.getByRole("heading", { name: /planificado/i })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /en producci[oó]n/i })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /pausado/i })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /control de calidad/i })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /listo/i })).toBeInTheDocument();
	});
});

describe("ProductionBoard — order rendering", () => {
	it("groups orders by state and renders production number + furniture name in the correct column", () => {
		const plannedOrder = { ...baseOrder, id: "order-1", state: "planned" as const, production_number: "OP-2026-0001" };
		const inProgressOrder = { ...baseOrder, id: "order-2", state: "in_progress" as const, production_number: "OP-2026-0002" };
		const readyOrder = { ...baseOrder, id: "order-3", state: "ready" as const, production_number: "OP-2026-0003" };

		mockUseProductionOrders.mockReturnValue({
			data: [plannedOrder, inProgressOrder, readyOrder],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		// All three production numbers are visible
		expect(screen.getByText("OP-2026-0001")).toBeInTheDocument();
		expect(screen.getByText("OP-2026-0002")).toBeInTheDocument();
		expect(screen.getByText("OP-2026-0003")).toBeInTheDocument();

		// Furniture name surfaces (denormalized by the list RPC)
		expect(screen.getAllByText("Mesa de roble").length).toBeGreaterThanOrEqual(1);

		// Each card sits in the right column. The column is a `<section>`
		// with `aria-label={PRODUCTION_ORDER_STATE_LABELS[state]}` (e.g.
		// "Planificado"), so we query it by its accessible landmark
		// role "region" + name. This replaces the previous
		// `heading.closest("section")` DOM-structure query which coupled
		// the test to the implementation detail that the column wraps the
		// heading in a section.
		const plannedColumn = screen.getByRole("region", { name: /planificado/i });
		expect(within(plannedColumn).getByText("OP-2026-0001")).toBeInTheDocument();
	});

	it("does not render terminal-state orders in any column (delivered/cancelled go to history, not the board)", () => {
		const deliveredOrder = { ...baseOrder, id: "order-9", state: "delivered" as const, production_number: "OP-2026-0009" };
		mockUseProductionOrders.mockReturnValue({
			data: [deliveredOrder],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		expect(screen.queryByText("OP-2026-0009")).not.toBeInTheDocument();
	});
});

describe("ProductionBoard — loading and error states", () => {
	it("renders a loading state when the list is fetching", () => {
		mockUseProductionOrders.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("renders an error state when the list fails", () => {
		mockUseProductionOrders.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	// PR 6 blocker-fix (WARNING): the board used to ignore the
	// quote-projection loading/error, so a failed
	// `useQuotesWithProductionStatus` would silently look like an
	// empty state (no startable quotes shown, no error surfaced).
	// The board now surfaces the projection's loading and error
	// states alongside the order list, so the user can distinguish
	// "no startable quotes" from "we couldn't load the quote list".
	it("renders a loading state when the quote projection is fetching and the order list is ready", () => {
		mockUseProductionOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);
		mockUseQuotesWithProductionStatus.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		} as unknown as ReturnType<typeof useQuotesWithProductionStatus>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		// The board surfaces a loading state for the quote projection
		// (the order list itself is ready, so the columns render).
		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("renders an error state when the quote projection fails and the order list is ready", () => {
		mockUseProductionOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);
		mockUseQuotesWithProductionStatus.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
		} as unknown as ReturnType<typeof useQuotesWithProductionStatus>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		// The board surfaces a specific error for the quote projection
		// failure so the user knows which data is missing.
		const alert = screen.getByRole("alert");
		expect(alert).toBeInTheDocument();
		// The error mentions the quote list specifically.
		expect(alert.textContent).toMatch(/presupuestos|proyecci[oó]n/i);
	});
});

describe("ProductionBoard — start flow trigger", () => {
	it("calls onStartProduction with the selected approved quote when the start button is clicked", () => {
		mockUseProductionOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		const onStart = vi.fn();
		render(<ProductionBoard onStartProduction={onStart} />, {
			wrapper: makeQueryWrapper(),
		});

		// The select shows the approved quote. Pick it and click "Nueva orden".
		const select = screen.getByRole("combobox");
		fireEvent.change(select, { target: { value: QUOTE_ID } });

		fireEvent.click(screen.getByRole("button", { name: /nueva orden/i }));

		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onStart).toHaveBeenCalledWith(
			expect.objectContaining({ id: QUOTE_ID, has_active_production: false }),
		);
	});

	it("disables the start button when no approved quote is selected", () => {
		mockUseProductionOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useProductionOrders>);

		render(<ProductionBoard onStartProduction={vi.fn()} />, {
			wrapper: makeQueryWrapper(),
		});

		expect(screen.getByRole("button", { name: /nueva orden/i })).toBeDisabled();
	});
});
