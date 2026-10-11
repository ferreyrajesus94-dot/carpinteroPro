import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Hammer } from "lucide-react";
import { SidebarNavLink } from "./sidebar-nav-link";

describe("SidebarNavLink bundled SVG", () => {
	it.each(["row-icon", "icon-square", "bottom-tab", "chip"] as const)("renders a decorative SVG in %s", (variant) => {
		render(<MemoryRouter initialEntries={["/production"]}><SidebarNavLink to="/production" label="Producción" icon={Hammer} variant={variant} /></MemoryRouter>);
		const link = screen.getByRole("link", { name: "Producción" });
		expect(link).toHaveAttribute("aria-current", "page");
		const svg = link.querySelector("svg");
		expect(svg).toHaveAttribute("width", "16");
		expect(svg).toHaveAttribute("height", "16");
		expect(svg).toHaveAttribute("aria-hidden", "true");
	});
	it("preserves button behavior and badge without requiring an icon", () => {
		const onClick = vi.fn();
		render(<SidebarNavLink to="/tasks" label="Tareas" variant="row-icon" as="button" onClick={onClick} badge={{ count: 2, tone: "danger" }} />);
		fireEvent.click(screen.getByRole("button", { name: "Tareas2" }));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
