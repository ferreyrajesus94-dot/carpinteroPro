import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
	it("renders a switch with unchecked state by default", () => {
		render(<Switch aria-label="Sólo stock bajo" />);
		const sw = screen.getByRole("switch", { name: "Sólo stock bajo" });
		expect(sw).toBeInTheDocument();
		expect(sw).toHaveAttribute("aria-checked", "false");
		expect(sw).toHaveAttribute("data-state", "unchecked");
	});

	it("reflects the checked prop", () => {
		render(<Switch aria-label="Activo" checked />);
		const sw = screen.getByRole("switch", { name: "Activo" });
		expect(sw).toHaveAttribute("aria-checked", "true");
		expect(sw).toHaveAttribute("data-state", "checked");
	});

	it("toggles on click and fires onCheckedChange", async () => {
		const user = userEvent.setup();
		let nextChecked: boolean | undefined;
		render(
			<Switch
				aria-label="Toggle"
				onCheckedChange={(v) => {
					nextChecked = v;
				}}
			/>,
		);
		const sw = screen.getByRole("switch", { name: "Toggle" });
		await user.click(sw);
		expect(nextChecked).toBe(true);
		expect(sw).toHaveAttribute("aria-checked", "true");
	});

	it("forwards className onto the root", () => {
		render(<Switch aria-label="x" className="custom-switch" />);
		expect(screen.getByRole("switch", { name: "x" }).className).toContain(
			"custom-switch",
		);
	});

	it("respects the disabled prop", async () => {
		const user = userEvent.setup();
		let toggled = 0;
		render(
			<Switch
				aria-label="x"
				disabled
				onCheckedChange={() => {
					toggled += 1;
				}}
			/>,
		);
		await user.click(screen.getByRole("switch", { name: "x" }));
		expect(toggled).toBe(0);
	});
});