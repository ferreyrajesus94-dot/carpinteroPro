import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { SearchResults } from "../types";

const emptyResults: SearchResults = {
	clients: [],
	quotes: [],
	materials: [],
	furniture: [],
	total: 0,
};

const populatedResults: SearchResults = {
	clients: [
		{
			entity: "clients",
			id: "c1",
			title: "Ana García",
			subtitle: "+54 9 11 5555-0000",
			href: "/crm/clientes/c1",
		},
	],
	quotes: [
		{
			entity: "quotes",
			id: "q1",
			title: "PR-2026001 — Mesa",
			subtitle: null,
			href: "/quotes/q1",
		},
	],
	materials: [],
	furniture: [],
	total: 2,
};

const baseProps = {
	query: "mesa",
	activeIndex: 0,
	onHoverIndex: vi.fn(),
	onSelect: vi.fn(),
	onNavigateAll: vi.fn(),
	containerId: "global-search-panel",
};

describe("SearchResultsPanel states", () => {
	it("renders the loading state with role=listbox and aria-busy", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				results={emptyResults}
				isLoading
				isRefreshing={false}
				isError={false}
			/>,
		);
		const panel = screen.getByRole("listbox");
		expect(panel).toHaveAttribute("id", "global-search-panel");
		expect(panel).toHaveAttribute("aria-busy", "true");
		expect(screen.getByText(/Buscando/)).toBeInTheDocument();
	});

	it("renders the error state with role=listbox", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				results={emptyResults}
				isLoading={false}
				isRefreshing={false}
				isError
			/>,
		);
		const panel = screen.getByRole("listbox");
		expect(panel).toBeInTheDocument();
		expect(screen.getByText(/No pudimos buscar/)).toBeInTheDocument();
	});

	it("renders the empty state with role=listbox and the query", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				query="xyz"
				results={emptyResults}
				isLoading={false}
				isRefreshing={false}
				isError={false}
			/>,
		);
		const panel = screen.getByRole("listbox");
		expect(panel).toBeInTheDocument();
		expect(screen.getByText(/Sin resultados para/)).toBeInTheDocument();
	});

	it("renders the populated state with sections and options", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				results={populatedResults}
				isLoading={false}
				isRefreshing={false}
				isError={false}
			/>,
		);
		const panel = screen.getByRole("listbox");
		expect(panel).toBeInTheDocument();
		expect(screen.getByText("Clientes")).toBeInTheDocument();
		expect(screen.getByText("Presupuestos")).toBeInTheDocument();
		// Options are role=option (one per hit)
		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(2);
	});

	it("shows the refreshing banner when isRefreshing is true and results exist", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				results={populatedResults}
				isLoading={false}
				isRefreshing
				isError={false}
			/>,
		);
		expect(screen.getByText(/Actualizando/)).toBeInTheDocument();
	});

	it("renders the 'Ver todos los resultados' button outside the listbox", () => {
		render(
			<SearchResultsPanel
				{...baseProps}
				results={populatedResults}
				isLoading={false}
				isRefreshing={false}
				isError={false}
			/>,
		);
		const panel = screen.getByRole("listbox");
		const navigateButton = screen.getByText("Ver todos los resultados");
		expect(panel.contains(navigateButton)).toBe(false);
	});
});
