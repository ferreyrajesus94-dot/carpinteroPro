import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

const state = vi.hoisted(() => ({ theme: "dark", toggle: vi.fn() }));
vi.mock("@/shared/hooks/useTheme", () => ({ useTheme: () => state }));

describe("ThemeToggle bundled SVG", () => {
	it.each(["icon", "label"] as const)("preserves %s names, theme choices and click behavior", (variant) => {
		state.theme = "dark";
		const { rerender } = render(<ThemeToggle variant={variant} />);
		const button = screen.getByRole("button", { name: "Activar modo claro" });
		const svg = button.querySelector("svg");
		expect(svg).toHaveClass("lucide-sun");
		expect(svg).toHaveAttribute("width", "16");
		expect(svg).toHaveAttribute("height", "16");
		expect(svg).toHaveAttribute("aria-hidden", "true");
		fireEvent.click(button);
		expect(state.toggle).toHaveBeenCalled();
		state.theme = "light";
		rerender(<ThemeToggle variant={variant} />);
		expect(screen.getByRole("button", { name: "Activar modo oscuro" }).querySelector("svg")).toHaveClass("lucide-moon");
	});
});
