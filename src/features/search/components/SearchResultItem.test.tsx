import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchHit } from "../types";

const baseHit: SearchHit = {
	entity: "clients",
	id: "abc-123",
	title: "Ana García",
	subtitle: "+54 9 11 5555-0000",
	href: "/crm/clientes/abc-123",
};

// Always wrap in MemoryRouter so the Link branch has Router context.
function renderItem(
	props: Partial<React.ComponentProps<typeof SearchResultItem>> = {},
) {
	return render(
		<MemoryRouter>
			<SearchResultItem hit={baseHit} active={false} {...props} />
		</MemoryRouter>,
	);
}

describe("SearchResultItem", () => {
	it("renders as a <button> when onSelect is provided", () => {
		const onSelect = vi.fn();
		renderItem({ onSelect });
		const button = screen.getByRole("option");
		expect(button.tagName).toBe("BUTTON");
	});

	it("renders as a <Link> when onSelect is omitted", () => {
		renderItem({}); // no onSelect
		const link = screen.getByRole("option");
		expect(link.tagName).toBe("A");
		expect(link).toHaveAttribute("href", "/crm/clientes/abc-123");
	});

	it("exposes the correct id, role, and aria-selected for the active option", () => {
		renderItem({ active: true });
		const option = screen.getByRole("option");
		expect(option).toHaveAttribute("id", "search-hit-clients-abc-123");
		expect(option).toHaveAttribute("role", "option");
		expect(option).toHaveAttribute("aria-selected", "true");
	});

	it("aria-selected=false when active is false", () => {
		renderItem({});
		expect(screen.getByRole("option")).toHaveAttribute(
			"aria-selected",
			"false",
		);
	});

	it("exposes data-entity and data-id for test selectors", () => {
		renderItem({});
		const option = screen.getByRole("option");
		expect(option).toHaveAttribute("data-entity", "clients");
		expect(option).toHaveAttribute("data-id", "abc-123");
	});

	it("calls onSelect with the hit when the button is clicked", () => {
		const onSelect = vi.fn();
		renderItem({ onSelect });
		fireEvent.click(screen.getByRole("option"));
		expect(onSelect).toHaveBeenCalledWith(baseHit);
	});

	it("calls onMouseEnter when the user hovers", () => {
		const onMouseEnter = vi.fn();
		renderItem({ onMouseEnter });
		fireEvent.mouseEnter(screen.getByRole("option"));
		expect(onMouseEnter).toHaveBeenCalledTimes(1);
	});

	it("hides the subtitle row when subtitle is null", () => {
		const hit: SearchHit = { ...baseHit, subtitle: null };
		renderItem({ hit });
		expect(screen.getByText("Ana García")).toBeInTheDocument();
		expect(screen.queryByText(/\+54/)).not.toBeInTheDocument();
	});

	it("renders the entity-specific singular label (Cliente for clients)", () => {
		renderItem({});
		expect(screen.getByText("Cliente")).toBeInTheDocument();
	});

	it("renders Presupuesto label for quotes entity", () => {
		const hit: SearchHit = { ...baseHit, entity: "quotes" };
		renderItem({ hit });
		expect(screen.getByText("Presupuesto")).toBeInTheDocument();
	});
});
