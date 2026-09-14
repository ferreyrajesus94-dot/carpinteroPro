import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
	captureException,
	configureErrorReporterClient,
	createSentryClient,
	initErrorReporter,
	loadSentryClient,
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

describe("createSentryClient", () => {
	let initMock: Mock<(options: Record<string, unknown>) => void>;
	let captureMock: Mock<
		(
			error: unknown,
			context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
		) => void
	>;

	beforeEach(() => {
		initMock = vi.fn();
		captureMock = vi.fn();
	});

	it("calls Sentry.init with the configured DSN, environment, and zero sampling", () => {
		const wrapper = createSentryClient({
			init: initMock,
			captureException: captureMock,
		});

		wrapper.init("https://public@example.invalid/1");

		expect(initMock).toHaveBeenCalledTimes(1);
		const initArgs = initMock.mock.calls[0]?.[0] as {
			dsn: string;
			environment: string;
			tracesSampleRate: number;
			integrations: unknown[];
		};
		expect(initArgs.dsn).toBe("https://public@example.invalid/1");
		expect(initArgs.tracesSampleRate).toBe(0);
		expect(initArgs.integrations).toEqual([]);
		// environment is taken from `import.meta.env.MODE` and is
		// `"test"` when running under vitest.
		expect(initArgs.environment).toBe("test");
	});

	it("forwards source / boundary / route as Sentry tags", () => {
		const wrapper = createSentryClient({
			init: initMock,
			captureException: captureMock,
		});

		wrapper.captureException(new Error("boom"), {
			source: "boundary",
			boundary: "ErrorBoundary",
			route: "/quotes/123",
		});

		const captureArgs = captureMock.mock.calls[0]?.[1] as {
			tags: Record<string, string>;
			extra: Record<string, unknown>;
		};
		expect(captureArgs.tags).toEqual({
			source: "boundary",
			boundary: "ErrorBoundary",
			route: "/quotes/123",
		});
	});

	it("forwards workshopId / userId / appVersion as Sentry extras", () => {
		const wrapper = createSentryClient({
			init: initMock,
			captureException: captureMock,
		});

		wrapper.captureException(new Error("boom"), {
			source: "boundary",
			workshopId: "workshop-1",
			userId: "user-1",
			appVersion: "1.2.3",
		});

		const captureArgs = captureMock.mock.calls[0]?.[1] as {
			tags: Record<string, string>;
			extra: Record<string, unknown>;
		};
		expect(captureArgs.extra).toEqual({
			appVersion: "1.2.3",
			workshopId: "workshop-1",
			userId: "user-1",
		});
	});

	it("omits empty tags and extras when only a source is provided", () => {
		const wrapper = createSentryClient({
			init: initMock,
			captureException: captureMock,
		});

		wrapper.captureException("plain", { source: "boundary" });

		const captureArgs = captureMock.mock.calls[0]?.[1] as {
			tags: Record<string, string>;
			extra: Record<string, unknown>;
		};
		expect(captureArgs.tags).toEqual({ source: "boundary" });
		expect(captureArgs.extra).toEqual({});
	});
});

describe("loadSentryClient", () => {
	beforeEach(() => {
		resetErrorReporterForTests();
	});

	it("returns a callable client backed by the @sentry/react SDK", async () => {
		const wrapper = await loadSentryClient();
		expect(typeof wrapper.init).toBe("function");
		expect(typeof wrapper.captureException).toBe("function");
		// Calling both must not throw even though the SDK would
		// normally contact a remote DSN — we never set one and
		// `init` for a missing DSN is a no-op in @sentry/react v9.
		expect(() => wrapper.init("")).not.toThrow();
	});

	it("returns a fresh client per call", async () => {
		const a = await loadSentryClient();
		const b = await loadSentryClient();
		expect(a).not.toBe(b);
	});
});
