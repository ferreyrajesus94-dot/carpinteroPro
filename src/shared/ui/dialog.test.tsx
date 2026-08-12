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
