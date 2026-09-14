export interface ErrorReportContext {
	source?: string;
	boundary?: string;
	route?: string;
	appVersion?: string;
	workshopId?: string;
	userId?: string;
	metadata?: Record<string, unknown>;
}

export interface SafeErrorReportContext {
	source?: string;
	boundary?: string;
	route?: string;
	appVersion?: string;
	workshopId?: string;
	userId?: string;
}

export interface ErrorReporterClient {
	init(dsn: string): void;
	captureException(error: unknown, context: SafeErrorReportContext): void;
}

export interface ErrorReporterConfig {
	dsn?: string;
}

interface SentryLike {
	init(options: {
		dsn: string;
		environment?: string;
		tracesSampleRate?: number;
		integrations?: unknown[];
	}): void;
	captureException(
		error: unknown,
		context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
	): void;
}

/**
 * No-op fallback used when no `VITE_SENTRY_DSN` is configured. Keeps
 * the production bundle working in environments where Sentry is not
 * adopted (local dev, preview deploys, or operators that prefer a
 * different reporter) and during tests.
 */
export const defaultClient: ErrorReporterClient = {
	init: () => undefined,
	captureException: () => undefined,
};

let client: ErrorReporterClient = defaultClient;
let initializedDsn: string | null = null;
let enabled = false;

export function configureErrorReporterClient(nextClient: ErrorReporterClient) {
	client = nextClient;
}

export function initErrorReporter(config: ErrorReporterConfig = {}) {
	const dsn = normalizeDsn(config.dsn ?? import.meta.env.VITE_SENTRY_DSN);
	if (!dsn) {
		enabled = false;
		return;
	}

	enabled = true;
	if (initializedDsn === dsn) return;

	client.init(dsn);
	initializedDsn = dsn;
}

export function captureException(
	error: unknown,
	context: ErrorReportContext = {},
) {
	if (!enabled) return;

	client.captureException(error, sanitizeErrorReportContext(context));
}

export function sanitizeErrorReportContext(
	context: ErrorReportContext,
): SafeErrorReportContext {
	return removeUndefinedValues({
		source: context.source,
		boundary: context.boundary,
		route: stripQueryString(context.route),
		appVersion: context.appVersion,
		workshopId: context.workshopId,
		userId: context.userId,
	});
}

export function resetErrorReporterForTests() {
	client = defaultClient;
	initializedDsn = null;
	enabled = false;
}

/**
 * Build an `ErrorReporterClient` that wraps a Sentry-shaped SDK.
 *
 * Exported separately so the unit tests can construct the wrapper
 * with an in-memory fake and avoid relying on the dynamic-import
 * mocking path (which is unreliable for the lazy `import("@sentry/react")`
 * resolved from inside a non-test module).
 */
export function createSentryClient(Sentry: SentryLike): ErrorReporterClient {
	return {
		init(dsn) {
			Sentry.init({
				dsn,
				environment: import.meta.env.MODE,
				tracesSampleRate: 0,
				integrations: [],
			});
		},
		captureException(error, context) {
			const tags: Record<string, string> = {};
			if (context.source) tags.source = context.source;
			if (context.boundary) tags.boundary = context.boundary;
			if (context.route) tags.route = context.route;

			const extra: Record<string, unknown> = {};
			if (context.appVersion) extra.appVersion = context.appVersion;
			if (context.workshopId) extra.workshopId = context.workshopId;
			if (context.userId) extra.userId = context.userId;

			Sentry.captureException(error, { tags, extra });
		},
	};
}

/**
 * Lazily construct a real Sentry-backed reporter.
 *
 * The `@sentry/react` module is loaded via a dynamic `import()` so
 * production bundles that do not set `VITE_SENTRY_DSN` (and therefore
 * never need the SDK at runtime) tree-shake the dependency away.
 *
 * Returns the no-op `defaultClient` when the dynamic import is
 * unavailable (e.g. SSR, jsdom in vitest) so `initErrorReporter` is
 * safe to call from any environment.
 */
export async function loadSentryClient(): Promise<ErrorReporterClient> {
	try {
		const mod = await import("@sentry/react");
		const Sentry = ((mod as unknown as { default?: unknown }).default ??
			mod) as SentryLike;
		return createSentryClient(Sentry);
	} catch {
		// Sentry is intentionally optional; fall back to the no-op so the
		// rest of the app keeps working in environments where the SDK is
		// not available (test runners, restricted networks, etc.).
		return defaultClient;
	}
}

function normalizeDsn(dsn: string | undefined) {
	const trimmed = dsn?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

function stripQueryString(route: string | undefined) {
	if (!route) return undefined;
	return route.split("?", 1)[0];
}

function removeUndefinedValues(context: SafeErrorReportContext) {
	const entries = Object.entries(context).filter(
		([, value]) => value !== undefined,
	);
	return Object.fromEntries(entries) as SafeErrorReportContext;
}
