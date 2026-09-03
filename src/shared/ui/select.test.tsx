import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

// Local polyfill for Radix Select's pointer-capture / scrollIntoView
// usage under jsdom. Mirrors the workaround used in
// `QuoteForm.test.tsx` so this test file stays self-contained.
if (
	typeof HTMLElement !== "undefined" &&
	typeof (HTMLElement.prototype as { hasPointerCapture?: unknown })
		.hasPointerCapture !== "function"
) {
	HTMLElement.prototype.hasPointerCapture = function hasPointerCapture() {
		return false;
	};
	HTMLElement.prototype.setPointerCapture = function setPointerCapture() {
		// no-op
	};
	HTMLElement.prototype.releasePointerCapture =
		function releasePointerCapture() {
			// no-op
		};
}
if (
	typeof HTMLElement !== "undefined" &&
	typeof (HTMLElement.prototype as { scrollIntoView?: unknown })
		.scrollIntoView !== "function"
) {
	HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
		// no-op
	};
}
if (typeof globalThis.ResizeObserver === "undefined") {
	class ResizeObserverPolyfill {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
	(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
		ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

function renderBasicSelect(onValueChange?: (v: string) => void) {
	return render(
		<Select onValueChange={onValueChange}>
			<SelectTrigger aria-label="estado">
				<SelectValue placeholder="Elegí un estado" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="presupuesto">Presupuesto</SelectItem>
				<SelectItem value="aprobado">Aprobado</SelectItem>
				<SelectItem value="entregado">Entregado</SelectItem>
			</SelectContent>
		</Select>,
	);
}

describe("Select", () => {
	it("renders the trigger with the placeholder", () => {
		renderBasicSelect();
		expect(screen.getByText("Elegí un estado")).toBeInTheDocument();
	});

	it("opens the menu and lists every item when the trigger is clicked", async () => {
		const user = userEvent.setup();
		renderBasicSelect();

		await user.click(screen.getByRole("combobox"));

		expect(
			screen.getByRole("option", { name: "Presupuesto" }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Aprobado" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Entregado" })).toBeInTheDocument();
	});

	it("calls onValueChange with the selected value", async () => {
		const user = userEvent.setup();
		let picked: string | undefined;
		renderBasicSelect((v) => {
			picked = v;
		});

		await user.click(screen.getByRole("combobox"));
		await user.click(screen.getByRole("option", { name: "Aprobado" }));

		expect(picked).toBe("aprobado");
	});

	it("forwards className onto the trigger", () => {
		render(
			<Select>
				<SelectTrigger aria-label="estado" className="custom-trigger">
					<SelectValue placeholder="Elegí" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="x">X</SelectItem>
				</SelectContent>
			</Select>,
		);
		expect(screen.getByRole("combobox").className).toContain("custom-trigger");
	});
});