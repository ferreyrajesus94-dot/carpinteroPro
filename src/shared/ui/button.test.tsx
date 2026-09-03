import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
	it("renders with text and is reachable by role", () => {
		render(<Button>Aceptar</Button>);
		expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
	});

	it("applies the destructive variant class", () => {
		render(<Button variant="destructive">Eliminar</Button>);
		const button = screen.getByRole("button", { name: "Eliminar" });
		expect(button.className).toContain("bg-cp-danger");
	});

	it("applies the outline variant class", () => {
		render(<Button variant="outline">Cancelar</Button>);
		const button = screen.getByRole("button", { name: "Cancelar" });
		expect(button.className).toContain("border-line");
	});

	it("forwards className alongside the variant classes", () => {
		render(<Button className="custom-class">Click</Button>);
		expect(screen.getByRole("button").className).toContain("custom-class");
	});

	it("calls onClick when clicked", async () => {
		const user = userEvent.setup();
		let clicked = false;
		render(<Button onClick={() => { clicked = true; }}>Click</Button>);
		await user.click(screen.getByRole("button"));
		expect(clicked).toBe(true);
	});

	it("does not fire onClick when disabled", async () => {
		const user = userEvent.setup();
		let clicked = false;
		render(
			<Button disabled onClick={() => { clicked = true; }}>
				No clickeable
			</Button>,
		);
		await user.click(screen.getByRole("button"));
		expect(clicked).toBe(false);
	});
});