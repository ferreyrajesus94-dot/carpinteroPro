import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorFallback } from "./RouteErrorFallback";
import { captureException } from "@/shared/lib/errorReporter";
import { useRouteError } from "react-router-dom";

vi.mock("react-router-dom", async () => {
	const actual =
		await vi.importActual<typeof import("react-router-dom")>(
			"react-router-dom",
		);
	return {
		...actual,
		useRouteError: vi.fn(),
	};
});

vi.mock("@/shared/lib/errorReporter", () => ({
	captureException: vi.fn(),
}));

vi.mock("./ErrorBoundary", () => ({
	ErrorBoundaryFallback: ({ onRetry }: { onRetry: () => void }) => (
		<button type="button" onClick={onRetry}>
			Reintentar ruta
		</button>
	),
}));

describe("RouteErrorFallback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("reports the route error with router context", () => {
		const routeError = new Error("route failed");
		vi.mocked(useRouteError).mockReturnValue(routeError);

		render(<RouteErrorFallback />);

		expect(captureException).toHaveBeenCalledWith(routeError, {
			source: "react-router.error-element",
		});
	});

	it("reloads the page when retry is requested", () => {
		vi.mocked(useRouteError).mockReturnValue(new Error("route failed"));
		const reload = vi.fn();
		vi.stubGlobal("location", { ...window.location, reload });

		render(<RouteErrorFallback />);
		fireEvent.click(screen.getByRole("button", { name: /reintentar ruta/i }));

		expect(reload).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});
});
