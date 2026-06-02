import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	configureErrorReporterClient,
	initErrorReporter,
	resetErrorReporterForTests,
} from "./errorReporter";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";

const client = {
	init: vi.fn(),
	captureException: vi.fn(),
};

describe("registerGlobalErrorHandlers", () => {
	beforeEach(() => {
		resetErrorReporterForTests();
		configureErrorReporterClient(client);
		client.init.mockClear();
		client.captureException.mockClear();
		initErrorReporter({ dsn: "https://public@example.invalid/1" });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reports browser error events", () => {
		const cleanup = registerGlobalErrorHandlers(window);
		const error = new Error("window boom");

		window.dispatchEvent(
			new ErrorEvent("error", { error, message: error.message }),
		);

		expect(client.captureException).toHaveBeenCalledWith(error, {
			source: "window.error",
			route: "/",
		});
		cleanup();
	});

	it("reports unhandled promise rejections", () => {
		const cleanup = registerGlobalErrorHandlers(window);
		const reason = new Error("promise boom");
		const event = new Event("unhandledrejection") as PromiseRejectionEvent;
		Object.defineProperty(event, "reason", { value: reason });

		window.dispatchEvent(event);

		expect(client.captureException).toHaveBeenCalledWith(reason, {
			source: "window.unhandledrejection",
			route: "/",
		});
		cleanup();
	});

	it("cleanup removes handlers", () => {
		const cleanup = registerGlobalErrorHandlers(window);
		cleanup();

		window.dispatchEvent(new ErrorEvent("error", { message: "after cleanup" }));

		expect(client.captureException).not.toHaveBeenCalled();
	});
});
