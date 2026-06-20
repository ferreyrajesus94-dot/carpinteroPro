import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
	it("renders title as heading", () => {
		render(<PageHeader title="Dashboard" />);

		const heading = screen.getByRole("heading", { name: "Dashboard" });
		expect(heading).toBeInTheDocument();
	});

	it("renders subtitle when provided", () => {
		render(
			<PageHeader title="Dashboard" subtitle="Resumen de actividad del taller" />,
		);

		expect(screen.getByText("Resumen de actividad del taller")).toBeInTheDocument();
	});

	it("renders eyebrow text before title", () => {
		render(<PageHeader eyebrow="Presupuestos" title="Lista de presupuestos" />);

		expect(screen.getByText("Presupuestos")).toBeInTheDocument();
	});

	it("renders actions element when provided", () => {
		render(
			<PageHeader
				title="Configuración"
				actions={<button type="button">Guardar</button>}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /guardar/i }),
		).toBeInTheDocument();
	});

	it("renders title only without optional props", () => {
		render(<PageHeader title="Solo título" />);

		expect(
			screen.getByRole("heading", { name: "Solo título" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Presupuestos")).not.toBeInTheDocument();
	});

	it("renders everything together", () => {
		render(
			<PageHeader
				eyebrow="Clientes"
				title="Listado de clientes"
				subtitle="Gestioná tus clientes y sus pedidos"
				actions={
					<button type="button" className="rounded-md bg-cp-accent px-4 py-2 text-sm">
						+ Nuevo
					</button>
				}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Listado de clientes" })).toBeInTheDocument();
		expect(screen.getByText("Clientes")).toBeInTheDocument();
		expect(screen.getByText("Gestioná tus clientes y sus pedidos")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /nuevo/i })).toBeInTheDocument();
	});
});
