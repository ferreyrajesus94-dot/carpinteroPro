import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the page components to isolate route wiring from the page logic.
// Each test asserts that the right page is mounted at the right path.
vi.mock("./components/StockMovementLedgerPage", () => ({
	StockMovementLedgerPage: () => <div>LEDGER_PAGE</div>,
}));
vi.mock("./components/StockMovementDetailPage", () => ({
	StockMovementDetailPage: () => <div>DETAIL_PAGE</div>,
}));
vi.mock("./components/MaterialList", () => ({
	MaterialList: () => <div>MATERIAL_LIST</div>,
}));

import { InventoryRoutes } from "./routes";

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
				<Route path="/inventory/*" element={<InventoryRoutes />} />
			</Routes>
		</MemoryRouter>,
		{ wrapper: makeWrapper() },
	);
}

describe("InventoryRoutes", () => {
	it("renders the ledger page at /inventory/movements", () => {
		renderAt("/inventory/movements");
		expect(screen.getByText("LEDGER_PAGE")).toBeInTheDocument();
	});

	it("renders the detail page at /inventory/movements/:movementId", () => {
		renderAt("/inventory/movements/abc-123");
		expect(screen.getByText("DETAIL_PAGE")).toBeInTheDocument();
	});

	it("renders the material list at /inventory", () => {
		renderAt("/inventory");
		expect(screen.getByText("MATERIAL_LIST")).toBeInTheDocument();
	});

	it("renders the material list at /inventory/ (trailing slash)", () => {
		renderAt("/inventory/");
		expect(screen.getByText("MATERIAL_LIST")).toBeInTheDocument();
	});
});
