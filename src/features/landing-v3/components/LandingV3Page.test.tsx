import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingV3Page } from "./LandingV3Page";

describe("LandingV3Page", () => {
	function setup() {
		render(
			<MemoryRouter>
				<LandingV3Page />
			</MemoryRouter>,
		);
	}

	it("explains one job from quote through production", () => {
		setup();

		expect(
			screen.getByRole("heading", { name: "Seguí el trabajo, no los papeles" }),
		).toBeInTheDocument();
		expect(screen.getByText("El cliente aprueba")).toBeInTheDocument();
		expect(screen.getByText("Stock descontado")).toBeInTheDocument();
		expect(screen.getByText("Coordinar entrega")).toBeInTheDocument();
	});

	it("provides navigable workshop stages", () => {
		setup();
		const navigation = screen.getByRole("navigation", { name: "Recorrido del trabajo" });

		expect(within(navigation).getByRole("link", { name: "01 Materiales" })).toHaveAttribute(
			"href",
			"#stage-01",
		);
		expect(within(navigation).getByRole("link", { name: "02 Presupuesto" })).toHaveAttribute(
			"href",
			"#stage-02",
		);
		expect(within(navigation).getByRole("link", { name: "03 Producción" })).toHaveAttribute(
			"href",
			"#stage-03",
		);
	});

	it("labels the sample data and links to the real entry point", () => {
		setup();

		expect(screen.getAllByText("Ejemplo ilustrativo")).toHaveLength(2);
		expect(screen.getByRole("link", { name: "Entrar a CarpinteroPro" })).toHaveAttribute(
			"href",
			"/login",
		);
	});
});
