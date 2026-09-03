import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
	it("renders a div with animate-pulse styling", () => {
		const { container } = render(<Skeleton data-testid="sk" />);
		const el = container.querySelector("[data-testid='sk']") as HTMLElement;
		expect(el).toBeInTheDocument();
		expect(el.tagName).toBe("DIV");
		expect(el.className).toContain("animate-pulse");
		expect(el.className).toContain("rounded-md");
	});

	it("applies a sensible default size when no className is provided", () => {
		const { container } = render(<Skeleton data-testid="sk-default" />);
		const el = container.querySelector(
			"[data-testid='sk-default']",
		) as HTMLElement;
		// base class only, no explicit width/height
		expect(el.className).toContain("bg-muted");
	});

	it("forwards className so consumers can size the skeleton", () => {
		const { container } = render(
			<Skeleton data-testid="sk-sized" className="h-4 w-1/2" />,
		);
		const el = container.querySelector(
			"[data-testid='sk-sized']",
		) as HTMLElement;
		expect(el.className).toContain("h-4");
		expect(el.className).toContain("w-1/2");
	});

	it("forwards arbitrary div props like aria-hidden and id", () => {
		const { container } = render(
			<Skeleton
				data-testid="sk-a11y"
				id="main-skeleton"
				aria-hidden="true"
			/>,
		);
		const el = container.querySelector(
			"[data-testid='sk-a11y']",
		) as HTMLElement;
		expect(el.getAttribute("id")).toBe("main-skeleton");
		expect(el.getAttribute("aria-hidden")).toBe("true");
	});
});