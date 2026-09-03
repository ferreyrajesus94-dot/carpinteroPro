import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
	it("renders an input element with the default 'text' semantics", () => {
		render(<Input placeholder="Escribí algo" />);
		const input = screen.getByPlaceholderText("Escribí algo");
		expect(input.tagName).toBe("INPUT");
		// When type is omitted, HTML defaults to "text". jsdom reflects this
		// as the attribute being absent or as "text" depending on the version;
		// either way the property is "text".
		expect((input as HTMLInputElement).type).toBe("text");
	});

	it("honors the type prop", () => {
		render(<Input type="email" placeholder="email" />);
		expect(screen.getByPlaceholderText("email")).toHaveAttribute("type", "email");
	});

	it("forwards className alongside the base input styles", () => {
		render(<Input className="custom-input" placeholder="x" />);
		const input = screen.getByPlaceholderText("x");
		expect(input.className).toContain("custom-input");
		expect(input.className).toContain("rounded-md");
	});

	it("calls onChange as the user types", async () => {
		const user = userEvent.setup();
		function Harness() {
			const [value, setValue] = useState("");
			return (
				<Input
					placeholder="x"
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
					}}
				/>
			);
		}
		render(<Harness />);
		const input = screen.getByPlaceholderText("x");
		await user.type(input, "hola");
		expect((input as HTMLInputElement).value).toBe("hola");
	});

	it("respects the disabled prop and skips user interaction", async () => {
		const user = userEvent.setup();
		render(<Input placeholder="x" disabled defaultValue="inicial" />);
		const input = screen.getByPlaceholderText("x") as HTMLInputElement;
		const initial = input.value;
		await user.type(input, "no entra");
		expect(input.value).toBe(initial);
	});
});