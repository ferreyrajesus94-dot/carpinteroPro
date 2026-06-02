import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import {
	configureErrorReporterClient,
	initErrorReporter,
	resetErrorReporterForTests,
} from "@/shared/lib/errorReporter";

const client = {
	init: vi.fn(),
	captureException: vi.fn(),
};

function BrokenComponent(): ReactElement {
	throw new Error("render failed");
}

function HealthyComponent() {
	return <p>Contenido disponible</p>;
}

describe("ErrorBoundary", () => {
	beforeEach(() => {
		resetErrorReporterForTests();
		configureErrorReporterClient(client);
		client.init.mockClear();
		client.captureException.mockClear();
		initErrorReporter({ dsn: "https://public@example.invalid/1" });
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("catches render crashes and reports them", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(
			<ErrorBoundary name="test-boundary" supportEmail="soporte@example.com">
				<BrokenComponent />
			</ErrorBoundary>,
		);

		expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
		expect(client.captureException).toHaveBeenCalledWith(expect.any(Error), {
			source: "react-error-boundary",
			boundary: "test-boundary",
		});
		consoleError.mockRestore();
	});

	it("renders an actionable support link when support email is configured", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		render(
			<ErrorBoundary supportEmail="soporte@example.com">
				<BrokenComponent />
			</ErrorBoundary>,
		);

		expect(
			screen.getByRole("link", { name: /contactar soporte/i }),
		).toHaveAttribute(
			"href",
			expect.stringContaining("mailto:soporte@example.com"),
		);
	});

	it("does not render a broken support link when support email is absent", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.stubEnv("VITE_SUPPORT_EMAIL", "soporte@example.com");

		render(
			<ErrorBoundary supportEmail={null}>
				<BrokenComponent />
			</ErrorBoundary>,
		);

		expect(
			screen.queryByRole("link", { name: /contactar soporte/i }),
		).not.toBeInTheDocument();
	});

	it("recovers when the retry action is pressed", () => {
		function ToggleComponent({ broken }: { broken: boolean }) {
			if (broken) {
				throw new Error("broken");
			}
			return <HealthyComponent />;
		}

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { rerender } = render(
			<ErrorBoundary>
				<ToggleComponent broken />
			</ErrorBoundary>,
		);

		rerender(
			<ErrorBoundary>
				<ToggleComponent broken={false} />
			</ErrorBoundary>,
		);
		fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

		expect(screen.getByText("Contenido disponible")).toBeInTheDocument();
		consoleError.mockRestore();
	});
});
