import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface AdminSupportRequest {
	workshopId?: string;
}

interface BillingWebhookEventRow {
	id: string;
	provider: string;
	provider_event_id: string;
	event_type: string;
	provider_resource_id: string | null;
	workshop_id: string;
	processed_at: string;
	updated_at: string;
}

async function readBody(req: Request): Promise<AdminSupportRequest> {
	if (!req.body) return {};
	const body: unknown = await req.json().catch(() => ({}));
	if (!body || typeof body !== "object") return {};
	const record = body as Record<string, unknown>;
	return {
		workshopId:
			typeof record.workshopId === "string" ? record.workshopId : undefined,
	};
}

function loadDiagnostics(workshopId?: string) {
	let query = serviceClient()
		.from("billing_webhook_events")
		.select(
			"id, provider, provider_event_id, event_type, provider_resource_id, workshop_id, processed_at, updated_at",
		)
		.order("processed_at", { ascending: false })
		.limit(50);
	if (workshopId) query = query.eq("workshop_id", workshopId);
	return query.returns<BillingWebhookEventRow[]>();
}

function mapDiagnostics(events: BillingWebhookEventRow[]) {
	return events.map((event: BillingWebhookEventRow) => ({
		id: event.id,
		provider: event.provider,
		providerEventId: event.provider_event_id,
		eventType: event.event_type,
		providerResourceId: event.provider_resource_id,
		workshopId: event.workshop_id,
		processedAt: event.processed_at,
		updatedAt: event.updated_at,
	}));
}

async function handleAuthorizedRequest(workshopId?: string): Promise<Response> {
	const { data: events, error } = await loadDiagnostics(workshopId);
	if (error) {
		console.error("admin-support-diagnostics: event lookup failed", error);
		return structuredErr(
			"admin_support_diagnostics_lookup_failed",
			"No se pudieron cargar los diagnósticos",
			500,
		);
	}
	return json({ diagnostics: mapDiagnostics(events ?? []) });
}

async function handleRequest(req: Request): Promise<Response> {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		await requirePlatformAdmin(req);
		const { workshopId } = await readBody(req);
		return await handleAuthorizedRequest(workshopId);
	} catch (e: unknown) {
		if (e instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", e.message, e.status);
		}
		return structuredErr(
			"admin_support_diagnostics_failed",
			"No se pudieron cargar los diagnósticos",
			500,
		);
	}
}

Deno.serve(handleRequest);
