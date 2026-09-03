import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card";

describe("Card", () => {
	it("renders the Card root as a div with surface styling", () => {
		const { container } = render(<Card>contenido</Card>);
		const root = container.firstChild as HTMLElement;
		expect(root.tagName).toBe("DIV");
		expect(root.className).toContain("bg-cp-surface");
		expect(screen.getByText("contenido")).toBeInTheDocument();
	});

	it("forwards className onto the Card root", () => {
		const { container } = render(<Card className="extra">x</Card>);
		const root = container.firstChild as HTMLElement;
		expect(root.className).toContain("extra");
	});

	it("renders header, content and footer as separate sections", () => {
		render(
			<Card>
				<CardHeader>
					<CardTitle>Título</CardTitle>
					<CardDescription>Descripción</CardDescription>
				</CardHeader>
				<CardContent>Cuerpo</CardContent>
				<CardFooter>Footer</CardFooter>
			</Card>,
		);

		expect(screen.getByText("Título")).toBeInTheDocument();
		expect(screen.getByText("Descripción")).toBeInTheDocument();
		expect(screen.getByText("Cuerpo")).toBeInTheDocument();
		expect(screen.getByText("Footer")).toBeInTheDocument();
	});

	it("CardTitle renders a styled heading-like div", () => {
		const { container } = render(<CardTitle>Mi título</CardTitle>);
		const title = screen.getByText("Mi título");
		expect(title.tagName).toBe("DIV");
		expect(title.className).toContain("font-semibold");
		// container query kept for sanity (RHF smoke).
		expect(container).toBeInTheDocument();
	});

	it("CardContent forwards className", () => {
		const { container } = render(
			<CardContent className="custom-pad">x</CardContent>,
		);
		const node = container.firstChild as HTMLElement;
		expect(node.className).toContain("custom-pad");
	});
});