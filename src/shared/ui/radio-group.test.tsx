import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroup", () => {
	it("renders all radio items and exposes them as radios", () => {
		render(
			<RadioGroup aria-label="estado">
				<RadioGroupItem value="presupuesto" aria-label="Presupuesto" />
				<RadioGroupItem value="aprobado" aria-label="Aprobado" />
				<RadioGroupItem value="entregado" aria-label="Entregado" />
			</RadioGroup>,
		);

		expect(screen.getByRole("radio", { name: "Presupuesto" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Aprobado" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Entregado" })).toBeInTheDocument();
	});

	it("selects an item when clicked and fires onValueChange", async () => {
		const user = userEvent.setup();
		let picked: string | undefined;
		render(
			<RadioGroup
				aria-label="estado"
				onValueChange={(v) => {
					picked = v;
				}}
			>
				<RadioGroupItem value="presupuesto" aria-label="Presupuesto" />
				<RadioGroupItem value="aprobado" aria-label="Aprobado" />
			</RadioGroup>,
		);

		await user.click(screen.getByRole("radio", { name: "Aprobado" }));

		expect(picked).toBe("aprobado");
		expect(screen.getByRole("radio", { name: "Aprobado" })).toBeChecked();
	});

	it("reflects the defaultValue on first render", () => {
		render(
			<RadioGroup aria-label="estado" defaultValue="entregado">
				<RadioGroupItem value="presupuesto" aria-label="Presupuesto" />
				<RadioGroupItem value="entregado" aria-label="Entregado" />
			</RadioGroup>,
		);

		expect(screen.getByRole("radio", { name: "Entregado" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Presupuesto" })).not.toBeChecked();
	});

	it("forwards className onto the RadioGroup root", () => {
		render(
			<RadioGroup aria-label="estado" className="custom-grid">
				<RadioGroupItem value="x" aria-label="x" />
			</RadioGroup>,
		);
		// RadioGroup renders as a div with role="radiogroup"
		expect(screen.getByRole("radiogroup").className).toContain("custom-grid");
	});

	it("respects the disabled prop on individual items", async () => {
		const user = userEvent.setup();
		let picked: string | undefined;
		render(
			<RadioGroup
				aria-label="estado"
				onValueChange={(v) => {
					picked = v;
				}}
			>
				<RadioGroupItem value="a" aria-label="A" disabled />
				<RadioGroupItem value="b" aria-label="B" />
			</RadioGroup>,
		);

		await user.click(screen.getByRole("radio", { name: "A" }));
		expect(picked).toBeUndefined();

		await user.click(screen.getByRole("radio", { name: "B" }));
		expect(picked).toBe("b");
	});
});