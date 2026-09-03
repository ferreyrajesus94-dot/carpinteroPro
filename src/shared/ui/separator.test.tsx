import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "./separator";

describe("Separator", () => {
	it("renders as a horizontal separator by default", () => {
		const { container } = render(<Separator data-testid="sep" />);
		const sep = container.querySelector(
			"[data-testid='sep']",
		) as HTMLElement;
		expect(sep).toBeInTheDocument();
		expect(sep.getAttribute("data-orientation")).toBe("horizontal");
	});

	it("renders a vertical separator when orientation='vertical'", () => {
		const { container } = render(
			<Separator orientation="vertical" data-testid="sep-v" />,
		);
		const sep = container.querySelector(
			"[data-testid='sep-v']",
		) as HTMLElement;
		expect(sep.getAttribute("data-orientation")).toBe("vertical");
		expect(sep.className).toContain("w-[1px]");
	});

	it("is decorative by default (no accessible role='separator')", () => {
		const { container } = render(<Separator data-testid="sep-d" />);
		const sep = container.querySelector(
			"[data-testid='sep-d']",
		) as HTMLElement;
		// Radix renders decorative separators with role="none" so they are
		// hidden from assistive tech while keeping a presentational hook.
		// Either a missing role or role="none" satisfies the accessibility
		// contract — both remove the node from the accessibility tree.
		const role = sep.getAttribute("role");
		expect(role === null || role === "none").toBe(true);
	});

	it("exposes role='separator' when decorative=false", () => {
		const { container } = render(
			<Separator decorative={false} data-testid="sep-sr" />,
		);
		const sep = container.querySelector(
			"[data-testid='sep-sr']",
		) as HTMLElement;
		expect(sep.getAttribute("role")).toBe("separator");
	});

	it("forwards className", () => {
		const { container } = render(
			<Separator data-testid="sep-c" className="custom-sep" />,
		);
		const sep = container.querySelector(
			"[data-testid='sep-c']",
		) as HTMLElement;
		expect(sep.className).toContain("custom-sep");
	});
});