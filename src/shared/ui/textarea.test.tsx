import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./textarea";

describe("Textarea", () => {
	it("renders a textarea element", () => {
		render(<Textarea placeholder="Notas" />);
		const ta = screen.getByPlaceholderText("Notas");
		expect(ta.tagName).toBe("TEXTAREA");
	});

	it("forwards className alongside the base styles", () => {
		render(<Textarea placeholder="x" className="custom-area" />);
		const ta = screen.getByPlaceholderText("x");
		expect(ta.className).toContain("custom-area");
		expect(ta.className).toContain("rounded-md");
	});

	it("calls onChange as the user types", async () => {
		const user = userEvent.setup();
		function Harness() {
			const [value, setValue] = useState("");
			return (
				<Textarea
					placeholder="x"
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
					}}
				/>
			);
		}
		render(<Harness />);
		const ta = screen.getByPlaceholderText("x") as HTMLTextAreaElement;
		await user.type(ta, "línea 1");
		expect(ta.value).toBe("línea 1");
	});

	it("respects the disabled prop", async () => {
		const user = userEvent.setup();
		render(<Textarea placeholder="x" disabled defaultValue="inicial" />);
		const ta = screen.getByPlaceholderText("x") as HTMLTextAreaElement;
		const initial = ta.value;
		await user.type(ta, "no entra");
		expect(ta.value).toBe(initial);
	});

	it("accepts rows and other textarea attributes", () => {
		render(<Textarea placeholder="x" rows={5} aria-label="detalle" />);
		const ta = screen.getByLabelText("detalle");
		expect(ta).toHaveAttribute("rows", "5");
	});
});