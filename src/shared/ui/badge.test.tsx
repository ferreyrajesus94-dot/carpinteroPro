import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
	it("renders as a div with the default variant", () => {
		render(<Badge>Activo</Badge>);
		const badge = screen.getByText("Activo");
		expect(badge.tagName).toBe("DIV");
		expect(badge.className).toContain("bg-cp-accent");
	});

	it("applies the destructive variant classes", () => {
		render(<Badge variant="destructive">Error</Badge>);
		const badge = screen.getByText("Error");
		expect(badge.className).toContain("bg-cp-danger");
	});

	it("applies the outline variant without a fill", () => {
		render(<Badge variant="outline">Tag</Badge>);
		const badge = screen.getByText("Tag");
		expect(badge.className).not.toContain("bg-cp-accent");
		expect(badge.className).not.toContain("bg-cp-danger");
	});

	it("forwards className", () => {
		render(<Badge className="custom-badge">x</Badge>);
		expect(screen.getByText("x").className).toContain("custom-badge");
	});

	it("renders children inside the badge", () => {
		render(
			<Badge>
				<span data-testid="child-icon">★</span>
				<span>Favorito</span>
			</Badge>,
		);
		expect(screen.getByTestId("child-icon")).toBeInTheDocument();
		expect(screen.getByText("Favorito")).toBeInTheDocument();
	});
});