import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

describe("Tooltip", () => {
	it("renders the trigger button", () => {
		render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button">Hover me</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Tip content</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
		// Content is not rendered until the tooltip is open.
		expect(screen.queryByText("Tip content")).not.toBeInTheDocument();
	});

	it("shows the content when the tooltip is forced open", () => {
		render(
			<TooltipProvider>
				<Tooltip open>
					<TooltipTrigger asChild>
						<button type="button">Hover</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Always shown</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		// Radix duplicates the content into a visually-hidden span for AT
		// (role="tooltip"). Use getAllByText and assert at least one match.
		expect(screen.getAllByText("Always shown").length).toBeGreaterThanOrEqual(1);
	});

	it("forwards className onto the TooltipContent when open", () => {
		const { container } = render(
			<TooltipProvider>
				<Tooltip open>
					<TooltipTrigger asChild>
						<button type="button">Hover</button>
					</TooltipTrigger>
					<TooltipContent className="custom-tooltip">Styled</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		// Radix renders the content node and a visually-hidden duplicate
		// for screen readers. The className we forward ends up on the
		// outer content node (the one without role="tooltip").
		const nodes = container.querySelectorAll(".custom-tooltip");
		expect(nodes.length).toBeGreaterThanOrEqual(1);
		expect(nodes[0]?.className).toContain("custom-tooltip");
	});
});