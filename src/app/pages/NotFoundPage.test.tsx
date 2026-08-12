import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
	it("renders the Spanish 'Página no encontrada' heading", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		expect(
			screen.getByRole("heading", { name: "Página no encontrada" }),
		).toBeInTheDocument();
	});

	it("shows the 404 error label", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("Error 404")).toBeInTheDocument();
	});

	it("exposes a 'Volver al inicio' link to /dashboard", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		const link = screen.getByRole("link", { name: "Volver al inicio" });
		expect(link).toBeInTheDocument();
		expect(link.getAttribute("href")).toBe("/dashboard");
	});

	it("exposes a secondary 'Ir a la landing' link to /", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		const link = screen.getByRole("link", { name: "Ir a la landing" });
		expect(link.getAttribute("href")).toBe("/");
	});

	it("does not leak any React Router dev affordances", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		expect(screen.queryByText(/Hey developer/i)).toBeNull();
		expect(screen.queryByText(/ErrorBoundary/i)).toBeNull();
		expect(screen.queryByText(/errorElement/i)).toBeNull();
	});

	it("sets document.title to a 404 indicator", () => {
		render(
			<MemoryRouter>
				<NotFoundPage />
			</MemoryRouter>,
		);
		expect(document.title).toMatch(/404/);
	});
});
