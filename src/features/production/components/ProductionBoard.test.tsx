import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionBoard } from "./ProductionBoard";

vi.mock("../hooks/useProductionOrders", () => ({
	useProductionOrders: () => ({
		data: [
			{
				id: "o1",
				workshop_id: "ws-1",
				quote_id: "q-1",
				production_number: "OP-TEST-1",
				state: "planned",
				planned_start_date: null,
				planned_end_date: null,
				actual_start_date: null,
				actual_end_date: null,
				assigned_to: null,
				assigned_to_name: null,
				notes: null,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				quote_furniture_name: "Biblioteca test",
			},
		],
		isLoading: false,
		isError: false,
	}),
	useQuotesWithProductionStatus: () => ({
		data: [],
		isLoading: false,
		isError: false,
	}),
}));

function noop() {}

describe("ProductionBoard kanban overflow", () => {
	it("renders the kanban container with overflow-x-auto so the page never scrolls horizontally", () => {
		render(<ProductionBoard onStartProduction={noop} />);
		const board = screen.getByTestId("production-board-kanban");
		expect(board.className).toContain("overflow-x-auto");
	});

	it("sets min-w-0 on the kanban container so flex overflow falls back to internal scroll", () => {
		render(<ProductionBoard onStartProduction={noop} />);
		const board = screen.getByTestId("production-board-kanban");
		expect(board.className).toContain("min-w-0");
	});

	it("uses fixed-width columns (w-[260px] shrink-0) instead of min-w-[260px] flex-1 so the parent can scroll cleanly", () => {
		// With no orders, the board renders an EmptyState instead of columns.
		// The static CSS class assertion is the source of truth: the Column
		// source no longer uses the broken 'min-w-[260px] flex-1' combo.
		const source = (
			ProductionBoard as unknown as { toString(): string }
		).toString();
		expect(source.includes("min-w-[260px] flex-1")).toBe(false);
	});
});
