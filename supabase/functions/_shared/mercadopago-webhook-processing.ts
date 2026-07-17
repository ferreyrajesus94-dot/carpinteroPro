const RESOURCE_KINDS = {
	PREAPPROVAL: "preapproval",
	PAYMENT: "payment",
	AUTHORIZED_PAYMENT: "authorized_payment",
} as const;
const PROVIDER = "mercadopago" as const;
const DIAGNOSTIC_CODES = {
	PROVIDER_REJECTED: "provider_rejected",
	PROVIDER_NOT_FOUND: "provider_not_found",
	PROVIDER_RATE_LIMITED: "provider_rate_limited",
	PROVIDER_CLIENT_ERROR: "provider_client_error",
	PROVIDER_UNAVAILABLE: "provider_unavailable",
	INVALID_PROVIDER_RESOURCE: "invalid_provider_resource",
	MISSING_SUBSCRIPTION: "missing_subscription",
} as const;

type ResourceKind = (typeof RESOURCE_KINDS)[keyof typeof RESOURCE_KINDS];
type BillingPlatformDiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];
type DiagnosticStage = "provider_fetch" | "provider_decode" | "subscription_resolution" | "rpc";

interface BillingPlatformDiagnostic {
	schemaVersion: 1;
	component: "mercadopago_webhook";
	correlationId: string;
	code: BillingPlatformDiagnosticCode;
	stage: DiagnosticStage;
	retryable: boolean;
	httpStatus: number;
	provider: "mercadopago";
	providerHttpStatus?: number;
	resourceKind?: ResourceKind;
}

interface BillingPlatformLogger { emit(entry: BillingPlatformDiagnostic): void; }
interface MercadoPagoCommission { providerPaymentId: string; paymentAmount: number; currency: string; occurredAt?: string; }
interface MercadoPagoResource { kind: ResourceKind; id: string; status: string; preapprovalId: string; providerSnapshotAt: string | null; commission?: MercadoPagoCommission; }
interface FetchResult { status: number; resource?: unknown; }
interface RpcResult { data: Record<string, unknown> | null; error: unknown | null; }
interface ProcessingDependencies { fetchResource(input: ProcessingInput): Promise<FetchResult>; resolveSubscription(providerPreapprovalId: string): Promise<boolean>; rpc(input: Record<string, unknown>): Promise<RpcResult>; logger: BillingPlatformLogger; }
interface ProcessingInput { providerEventId: string; eventType: string; resourceKind: ResourceKind; resourceId: string; correlationId: string; }
interface ProcessingResult { httpStatus: number; code?: BillingPlatformDiagnosticCode; outcome: string; retryable: boolean; }

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function nonEmpty(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function iso(value: unknown): string | null {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
	return value;
}
function timestamp(value: Record<string, unknown>, fields: string[]): string | null | undefined {
	for (const field of fields) if (field in value) return iso(value[field]) ?? undefined;
	return null;
}
function linkage(value: Record<string, unknown>): string | null {
	return nonEmpty(value.preapproval_id) ?? nonEmpty(record(value.preapproval)?.id);
}

export function decodeMercadoPagoResource(kind: ResourceKind, value: unknown): MercadoPagoResource | null {
	const source = record(value);
	if (!source) return null;
	const id = nonEmpty(source.id), status = nonEmpty(source.status);
	if (!id || !status) return null;
	const providerSnapshotAt = timestamp(source, kind === RESOURCE_KINDS.PAYMENT ? ["date_last_updated", "date_created"] : ["last_modified", "date_created"]);
	if (providerSnapshotAt === undefined) return null;
	const preapprovalId = kind === RESOURCE_KINDS.PREAPPROVAL ? id : linkage(source);
	if (!preapprovalId) return null;
	if (kind !== RESOURCE_KINDS.AUTHORIZED_PAYMENT) return { kind, id, status, preapprovalId, providerSnapshotAt };
	const amount = source.transaction_amount ?? source.charge;
	if (amount !== undefined && (!Number.isFinite(amount) || typeof amount !== "number" || amount < 0)) return null;
	const currency = source.currency_id === undefined ? "ARS" : nonEmpty(source.currency_id);
	if (!currency) return null;
	return { kind, id, status, preapprovalId, providerSnapshotAt, commission: typeof amount === "number" ? { providerPaymentId: id, paymentAmount: amount, currency, occurredAt: providerSnapshotAt ?? undefined } : undefined };
}

function diagnostic(status: number, correlationId: string, resourceKind: ResourceKind): BillingPlatformDiagnostic {
	const mapping: Record<number, [BillingPlatformDiagnosticCode, number, boolean]> = {
		400: [DIAGNOSTIC_CODES.PROVIDER_REJECTED, 200, false], 404: [DIAGNOSTIC_CODES.PROVIDER_NOT_FOUND, 200, false], 429: [DIAGNOSTIC_CODES.PROVIDER_RATE_LIMITED, 503, true],
	};
	const [code, httpStatus, retryable] = mapping[status] ?? (status >= 400 && status < 500 ? [DIAGNOSTIC_CODES.PROVIDER_CLIENT_ERROR, 502, true] : [DIAGNOSTIC_CODES.PROVIDER_UNAVAILABLE, 502, true]);
	return { schemaVersion: 1, component: "mercadopago_webhook", correlationId, code, stage: "provider_fetch", retryable, httpStatus, provider: PROVIDER, providerHttpStatus: status, resourceKind };
}
function rejectedDependency(logger: BillingPlatformLogger, correlationId: string, resourceKind: ResourceKind, stage: DiagnosticStage): ProcessingResult {
	const entry: BillingPlatformDiagnostic = { schemaVersion: 1, component: "mercadopago_webhook", correlationId, code: DIAGNOSTIC_CODES.PROVIDER_UNAVAILABLE, stage, retryable: true, httpStatus: 502, provider: PROVIDER, resourceKind };
	emitBillingPlatformDiagnostic(logger, entry);
	return { httpStatus: 502, code: entry.code, outcome: "retryable", retryable: true };
}

export function evaluateProviderFreshness(incoming: string | null, stored: string | null, sameBoundPreapproval: boolean, resourceKind: ResourceKind): "apply" | "stale" | "noop" | "uncertain" {
	if (!incoming || !stored) return sameBoundPreapproval && resourceKind === RESOURCE_KINDS.PREAPPROVAL ? "apply" : "uncertain";
	if (incoming > stored) return "apply";
	if (incoming < stored) return "stale";
	return sameBoundPreapproval ? "noop" : "uncertain";
}

export function emitBillingPlatformDiagnostic(logger: BillingPlatformLogger, input: BillingPlatformDiagnostic): void {
	const providerHttpStatus = Number.isInteger(input.providerHttpStatus) && input.providerHttpStatus! >= 400 && input.providerHttpStatus! <= 599 ? input.providerHttpStatus : undefined;
	logger.emit({ schemaVersion: 1, component: "mercadopago_webhook", correlationId: input.correlationId, code: input.code, stage: input.stage, retryable: input.retryable, httpStatus: input.httpStatus, provider: PROVIDER, ...(providerHttpStatus === undefined ? {} : { providerHttpStatus }), ...(input.resourceKind ? { resourceKind: input.resourceKind } : {}) });
}

export async function processMercadoPagoWebhook(input: ProcessingInput, dependencies: ProcessingDependencies): Promise<ProcessingResult> {
	let fetched: FetchResult;
	try { fetched = await dependencies.fetchResource(input); }
	catch { return rejectedDependency(dependencies.logger, input.correlationId, input.resourceKind, "provider_fetch"); }
	if (fetched.status !== 200) {
		const entry = diagnostic(fetched.status, input.correlationId, input.resourceKind);
		emitBillingPlatformDiagnostic(dependencies.logger, entry);
		return { httpStatus: entry.httpStatus, code: entry.code, outcome: "pre_tenant", retryable: entry.retryable };
	}
	const resource = decodeMercadoPagoResource(input.resourceKind, fetched.resource);
	if (!resource) {
		const entry: BillingPlatformDiagnostic = { schemaVersion: 1, component: "mercadopago_webhook", correlationId: input.correlationId, code: DIAGNOSTIC_CODES.INVALID_PROVIDER_RESOURCE, stage: "provider_decode", retryable: true, httpStatus: 502, provider: PROVIDER, resourceKind: input.resourceKind };
		emitBillingPlatformDiagnostic(dependencies.logger, entry);
		return { httpStatus: 502, code: entry.code, outcome: "pre_tenant", retryable: true };
	}
	let subscribed: boolean;
	try { subscribed = await dependencies.resolveSubscription(resource.preapprovalId); }
	catch { return rejectedDependency(dependencies.logger, input.correlationId, input.resourceKind, "subscription_resolution"); }
	if (!subscribed) {
		const entry: BillingPlatformDiagnostic = { schemaVersion: 1, component: "mercadopago_webhook", correlationId: input.correlationId, code: DIAGNOSTIC_CODES.MISSING_SUBSCRIPTION, stage: "subscription_resolution", retryable: false, httpStatus: 200, provider: PROVIDER, resourceKind: input.resourceKind };
		emitBillingPlatformDiagnostic(dependencies.logger, entry);
		return { httpStatus: 200, code: entry.code, outcome: "not_applicable", retryable: false };
	}
	let rpc: RpcResult;
	try { rpc = await dependencies.rpc({ contractVersion: 2, provider: PROVIDER, providerEventId: input.providerEventId, eventType: input.eventType, resourceKind: resource.kind, providerResourceId: resource.id, providerPreapprovalId: resource.preapprovalId, providerStatus: resource.status, providerSnapshotAt: resource.providerSnapshotAt, providerFetchedAt: new Date().toISOString(), ...(resource.commission ? { commission: resource.commission } : {}) }); }
	catch { return rejectedDependency(dependencies.logger, input.correlationId, input.resourceKind, "rpc"); }
	if (rpc.error || !rpc.data) return { httpStatus: 500, outcome: "retryable", retryable: true };
	const outcome = typeof rpc.data.outcome === "string" ? rpc.data.outcome : "uncertain";
	const retryable = rpc.data.retryable === true;
	return { httpStatus: retryable ? 500 : outcome === "uncertain" ? 409 : 200, outcome, retryable };
}

export type { BillingPlatformDiagnostic, BillingPlatformLogger, MercadoPagoResource, ProcessingDependencies, ProcessingInput, ProcessingResult, ResourceKind };
