import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	captureException,
	configureErrorReporterClient,
	initErrorReporter,
	resetErrorReporterForTests,
} from "./errorReporter";

const client = {
	init: vi.fn(),
	captureException: vi.fn(),
};

describe("errorReporter", () => {
	beforeEach(() => {
		resetErrorReporterForTests();
		configureErrorReporterClient(client);
		client.init.mockClear();
		client.captureException.mockClear();
	});

	it("initializes the configured client once when a DSN is present", () => {
		initErrorReporter({ dsn: "https://public@example.invalid/1" });
		initErrorReporter({ dsn: "https://public@example.invalid/1" });

		expect(client.init).toHaveBeenCalledTimes(1);
		expect(client.init).toHaveBeenCalledWith(
			"https://public@example.invalid/1",
		);
	});

	it("is a no-op when the DSN is missing", () => {
		initErrorReporter({ dsn: "" });
		captureException(new Error("boom"), { source: "test" });

		expect(client.init).not.toHaveBeenCalled();
		expect(client.captureException).not.toHaveBeenCalled();
	});

	it("does not throw for unknown captured values", () => {
		initErrorReporter({ dsn: "https://public@example.invalid/1" });

		expect(() =>
			captureException("plain string", { source: "test" }),
		).not.toThrow();
		expect(client.captureException).toHaveBeenCalledWith("plain string", {
			source: "test",
		});
	});

	it("only forwards allowlisted context and strips query strings from routes", () => {
		initErrorReporter({ dsn: "https://public@example.invalid/1" });

		captureException(new Error("private"), {
			source: "query",
			route: "/quotes?email=client@example.com&token=secret",
			workshopId: "workshop-1",
			userId: "user-1",
			appVersion: "1.2.3",
			metadata: { email: "client@example.com", quoteTotal: 1000 },
		});

		expect(client.captureException).toHaveBeenCalledWith(expect.any(Error), {
			source: "query",
			route: "/quotes",
			workshopId: "workshop-1",
			userId: "user-1",
			appVersion: "1.2.3",
		});
	});
});
