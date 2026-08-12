import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

describe("DialogContent", () => {
	function renderWithDialog() {
		return render(
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sample</DialogTitle>
					</DialogHeader>
					<div>body</div>
				</DialogContent>
			</Dialog>,
		);
	}

	it("constrains its height to 90vh so tall content scrolls internally", () => {
		renderWithDialog();
		const content = screen.getByRole("dialog");
		expect(content.className).toContain("max-h-[90vh]");
	});

	it("is vertically scrollable when content overflows", () => {
		renderWithDialog();
		const content = screen.getByRole("dialog");
		expect(content.className).toContain("overflow-y-auto");
	});

	it("preserves the centered position and base styling", () => {
		renderWithDialog();
		const content = screen.getByRole("dialog");
		expect(content.className).toContain("translate-x-[-50%]");
		expect(content.className).toContain("translate-y-[-50%]");
		expect(content.className).toContain("sm:rounded-lg");
	});
});

describe("DialogOverlay", () => {
	it("stops intercepting pointer events while the close animation plays", () => {
		const { baseElement } = render(
			<Dialog open>
				<DialogContent>
					<div>body</div>
				</DialogContent>
			</Dialog>,
		);
		// Look for any node with data-state attribute (Radix adds it to
		// both the overlay and the content). There should be at least 2 in
		// an open dialog. The overlay is the one styled with bg-black/80.
		const candidates = baseElement.querySelectorAll("[data-state]");
		const overlay = Array.from(candidates).find((n) =>
			n.className?.includes("bg-black/80"),
		);
		expect(overlay, "expected to find an overlay with bg-black/80").toBeDefined();
		expect(overlay!.className).toContain(
			"data-[state=closed]:pointer-events-none",
		);
	});
});
