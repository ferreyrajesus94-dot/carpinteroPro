import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { KanbanCard } from "./KanbanCard";

describe("KanbanCard with salePrice and statusColor props", () => {
	const baseQuote = {
		id: "q-1",
		quote_number: "Q-001",
		furniture_name: "Mesa de centro",
		status: "presupuesto" as const,
		client: { name: "Juan Perez" },
	};

	it("renders sale price from prop (AR format: $ with dot separator and non-breaking space)", () => {
		render(
			<MemoryRouter>
				<KanbanCard
					quote={baseQuote}
					salePrice={25000}
					statusColor="bg-gray-100 text-gray-700"
				/>
			</MemoryRouter>,
		);

		// formatCurrency uses es-AR locale: "$ 25.000" (dot separator, non-breaking space after $)
		expect(screen.getByText(/25\.000/)).toBeTruthy();
	});

	it("renders status label", () => {
		render(
			<MemoryRouter>
				<KanbanCard
					quote={baseQuote}
					salePrice={25000}
					statusColor="bg-gray-100 text-gray-700"
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("presupuesto")).toBeTruthy();
	});

	it("renders quote number and client name", () => {
		render(
			<MemoryRouter>
				<KanbanCard
					quote={baseQuote}
					salePrice={25000}
					statusColor="bg-gray-100 text-gray-700"
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("Q-001")).toBeTruthy();
		expect(screen.getByText("Juan Perez")).toBeTruthy();
	});
});
