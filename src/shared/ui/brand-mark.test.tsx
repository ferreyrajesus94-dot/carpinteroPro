import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BrandMark } from "./brand-mark";

describe("BrandMark bundled SVG", () => {
	it.each([["xs", 11], ["sm", 14], ["md", 16], ["lg", 18]] as const)("preserves %s dimensions and the link name", (size, pixels) => {
		render(<MemoryRouter><BrandMark size={size} /></MemoryRouter>);
		const link = screen.getByRole("link", { name: "CarpinteroPro" });
		const svg = link.querySelector("svg");
		expect(svg).toHaveAttribute("width", String(pixels));
		expect(svg).toHaveAttribute("height", String(pixels));
		expect(svg).toHaveAttribute("aria-hidden", "true");
		expect(svg).toHaveAttribute("stroke-width", "3");
	});
	it("preserves a custom accessible name without a wordmark", () => {
		render(<MemoryRouter><BrandMark wordmark={false} aria-label="Inicio" /></MemoryRouter>);
		expect(screen.getByRole("link", { name: "Inicio" }).querySelector("svg")).not.toBeNull();
	});
});
