import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the page-level components so the routes test is isolated to
// wiring only. Each test asserts that the right component is mounted
// at the right path; behavioural assertions for the components
// themselves live in their dedicated test files.
vi.mock("./components/ProductionBoard", () => ({
	ProductionBoard: () => <div>PRODUCTION_BOARD</div>,
}));

vi.mock("./components/ProductionOrderDetailPage", () => ({
	ProductionOrderDetailPage: () => <div>PRODUCTION_DETAIL_PAGE</div>,
}));

import { ProductionRoutes } from "./routes";

function makeWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/production/*" element={<ProductionRoutes />} />
			</Routes>
		</MemoryRouter>,
		{ wrapper: makeWrapper() },
	);
}

describe("ProductionRoutes", () => {
	it("renders the production board at /production", () => {
		renderAt("/production");
		expect(screen.getByText("PRODUCTION_BOARD")).toBeInTheDocument();
	});

	it("renders the production board at /production/ (trailing slash)", () => {
		renderAt("/production/");
		expect(screen.getByText("PRODUCTION_BOARD")).toBeInTheDocument();
	});

	it("renders the production order detail page at /production/:id", () => {
		renderAt("/production/abc-123");
		expect(screen.getByText("PRODUCTION_DETAIL_PAGE")).toBeInTheDocument();
	});

	it("does NOT render the board when the detail page is mounted", () => {
		renderAt("/production/abc-123");
		expect(screen.queryByText("PRODUCTION_BOARD")).not.toBeInTheDocument();
	});
});
