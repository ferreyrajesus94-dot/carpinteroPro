import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createElement } from "react";
import type { ProductionOrderEvent } from "../api/productionOrders";
import type { ProductionOrderDetailRow } from "../api/productionOrders";
import type { ProductionOrderState } from "../api/types";

vi.mock("../hooks/useProductionOrders", () => ({
	useProductionOrder: vi.fn(),
	useProductionOrderEvents: vi.fn(),
}));

import {
	useProductionOrder,
	useProductionOrderEvents,
} from "../hooks/useProductionOrders";
import { ProductionOrderDetailPage } from "./ProductionOrderDetailPage";

const mockUseProductionOrder = vi.mocked(useProductionOrder);
const mockUseProductionOrderEvents = vi.mocked(useProductionOrderEvents);

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const CLIENT_ID = "55555555-5555-4555-8555-555555555555";

const SAMPLE_DETAIL: ProductionOrderDetailRow = {
	id: ORDER_ID,
	workshop_id: WORKSHOP_ID,
	quote_id: QUOTE_ID,
	production_number: "OP-2026-0042",
	state: "in_progress" as ProductionOrderState,
	planned_start_date: "2026-07-01",
	planned_end_date: "2026-07-10",
	actual_start_date: "2026-07-02T08:00:00Z",
	actual_end_date: null,
	assigned_to: ACTOR_ID,
	notes: "Cliente prioritario",
	created_at: "2026-06-30T10:00:00Z",
	updated_at: "2026-06-30T10:00:00Z",
	quote_number: "Q-2026-0001",
	quote_furniture_name: "Mesa de roble",
	quote_status: "en_produccion" as const,
	quote_client_id: CLIENT_ID,
	quote_client_name: "Acme SRL",
	assigned_to_name: "Jane Doe",
};

const SAMPLE_EVENT: ProductionOrderEvent = {
	id: "99999999-9999-4999-8999-999999999999",
	workshop_id: WORKSHOP_ID,
	production_order_id: ORDER_ID,
	event_type: "created",
	from_state: null,
	to_state: "planned" as ProductionOrderState,
	reason: "production order created",
	note: "production order created",
	actor_id: ACTOR_ID,
	metadata: { request_id: "req-1", operation: "start" },
	created_at: "2026-06-30T10:00:00Z",
	actor_name: "Jane Doe",
};

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(
			MemoryRouter,
			{ initialEntries: [`/production/${ORDER_ID}`] },
			createElement(
				Routes,
				null,
				createElement(Route, {
					path: "/production/:id",
					element: createElement(QueryClientProvider, { client }, children),
				}),
			),
		);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ProductionOrderDetailPage — loading and error states", () => {
	it("renders a loading state when the order detail is fetching", () => {
		mockUseProductionOrder.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrderEvents>);

		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("renders an error state when the order detail query fails", () => {
		mockUseProductionOrder.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error("Network down"),
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrderEvents>);

		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		expect(screen.getByRole("alert")).toHaveTextContent(/network down|error|conexi[oó]n/i);
	});

	it("renders a not-found state when the order is null (RLS invisible, or missing id)", () => {
		mockUseProductionOrder.mockReturnValue({
			data: null,
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrderEvents>);

		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		expect(
			screen.getAllByText(/no se encontr[oó]|no existe/i).length,
		).toBeGreaterThanOrEqual(1);
	});
});

describe("ProductionOrderDetailPage — denormalized data", () => {
	beforeEach(() => {
		mockUseProductionOrder.mockReturnValue({
			data: SAMPLE_DETAIL,
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: [SAMPLE_EVENT],
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrderEvents>);
	});

	it("renders the production number and the furniture name as the title", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		expect(
			screen.getByRole("heading", { name: /OP-2026-0042/i }),
		).toBeInTheDocument();
		expect(screen.getAllByText(/Mesa de roble/).length).toBeGreaterThanOrEqual(1);
	});

	it("renders the current state label inside the detail grid", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/En producci[oó]n/);
	});

	it("renders the assigned operator name when present", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/Jane Doe/);
	});

	it("renders the planned and actual dates", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/2026-07-01/);
		expect(grid.textContent).toMatch(/2026-07-10/);
		expect(grid.textContent).toMatch(/2026-07-02/);
	});

	it("renders the linked quote number", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/Q-2026-0001/);
	});

	it("renders the client name from the denormalized column", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/Acme SRL/);
	});

	it("renders the operator notes when present", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		const grid = screen.getByTestId("order-detail-grid");
		expect(grid.textContent).toMatch(/Cliente prioritario/);
	});

	it("renders the event timeline component with the events from the hook", () => {
		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		expect(screen.getByTestId("event-timeline")).toBeInTheDocument();
	});
});

describe("ProductionOrderDetailPage — events query state", () => {
	it("renders the detail data even when the events query is still loading", () => {
		mockUseProductionOrder.mockReturnValue({
			data: SAMPLE_DETAIL,
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrderEvents>);

		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		// The detail data is still rendered
		expect(screen.getByTestId("order-detail-grid")).toBeInTheDocument();
		// And a per-section loading state for the timeline is shown
		expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(1);
	});

	it("surfaces a non-fatal warning when the events query fails (the detail data still renders)", () => {
		mockUseProductionOrder.mockReturnValue({
			data: SAMPLE_DETAIL,
			isLoading: false,
			isError: false,
			error: null,
		} as unknown as ReturnType<typeof useProductionOrder>);
		mockUseProductionOrderEvents.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error("Timeline down"),
		} as unknown as ReturnType<typeof useProductionOrderEvents>);

		render(<ProductionOrderDetailPage />, { wrapper: makeQueryWrapper() });

		// The detail data is still rendered
		expect(screen.getByTestId("order-detail-grid")).toBeInTheDocument();
		// And a non-fatal warning for the timeline is shown
		const section = screen.getByTestId("order-timeline-section");
		expect(section.textContent).toMatch(/cronolog|timeline/i);
		expect(section.textContent).toMatch(/timeline down/i);
	});
});
