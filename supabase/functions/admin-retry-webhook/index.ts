import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
};

Deno.serve(async (req: Request) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST")
		return structuredErr("method_not_allowed", "Method not allowed", 405);

	try {
		await requirePlatformAdmin(req);
		const body: { eventId?: string } = await req.json().catch(() => ({}));
		if (!body.eventId)
			return structuredErr("invalid_request", "eventId required", 400);

		// Look up the webhook event to get context
		const { data: event, error: lookupErr } = await serviceClient()
			.from("billing_webhook_events")
			.select("provider, provider_event_id, workshop_id")
			.eq("id", body.eventId)
			.single();

		if (lookupErr || !event) {
			return structuredErr("event_not_found", "Evento no encontrado", 404);
		}

		// Log the retry as a new diagnostic entry
		const { error: insertErr } = await serviceClient()
			.from("billing_webhook_events")
			.insert({
				provider: event.provider,
				provider_event_id: `${event.provider_event_id}_retry_${Date.now()}`,
				event_type: "admin.retry",
				workshop_id: event.workshop_id,
				processed_at: new Date().toISOString(),
			});

		if (insertErr) {
			console.error("admin-retry-webhook: insert failed", insertErr);
			return structuredErr(
				"retry_failed",
				"No se pudo registrar el reintento",
				500,
			);
		}

		return json({ status: "sent" });
	} catch (e: unknown) {
		if (e instanceof AdminAuthError)
			return structuredErr("admin_auth_failed", e.message, e.status);
		console.error("admin-retry-webhook failed", e);
		return structuredErr("retry_failed", "Error al reintentar webhook", 500);
	}
});
