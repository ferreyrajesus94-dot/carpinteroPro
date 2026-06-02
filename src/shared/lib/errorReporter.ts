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

const defaultClient: ErrorReporterClient = {
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
