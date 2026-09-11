import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingV2Page } from "./LandingV2Page";

describe("LandingV2Page", () => {
	function setup() {
		render(
			<MemoryRouter>
				<LandingV2Page />
			</MemoryRouter>,
		);
	}

	it("explains the core workshop problems", () => {
		setup();

		expect(
			screen.getByRole("heading", {
				name: "Presupuestá, fabricá y cobrá sin perder el hilo.",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("El cuaderno se pierde")).toBeInTheDocument();
		expect(screen.getByText("El precio lo cambiás mil veces")).toBeInTheDocument();
		expect(screen.getByText("No sabés qué tenés en stock")).toBeInTheDocument();
	});

	it("links the explanation to the pain section", () => {
		setup();
		const hero = screen.getByRole("region", {
			name: "Presupuestá, fabricá y cobrá sin perder el hilo.",
		});

		expect(within(hero).getByRole("link", { name: "Ver cómo funciona" })).toHaveAttribute(
			"href",
			"#pain",
		);
	});

	it("keeps the real account entry point", () => {
		setup();

		for (const link of screen.getAllByRole("link", { name: /gratis/i })) {
			expect(link).toHaveAttribute("href", "/login");
		}
	});
});
