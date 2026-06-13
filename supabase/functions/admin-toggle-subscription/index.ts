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
		const body: { workshopId?: string; action?: string } = await req
			.json()
			.catch(() => ({}));
		if (
			!body.workshopId ||
			!body.action ||
			!["pause", "resume"].includes(body.action)
		) {
			return structuredErr(
				"invalid_request",
				"workshopId and action (pause|resume) required",
				400,
			);
		}

		const newStatus = body.action === "pause" ? "paused" : "active";
		const { error } = await serviceClient()
			.from("subscriptions")
			.update({ status: newStatus, updated_at: new Date().toISOString() })
			.eq("workshop_id", body.workshopId);

		if (error) {
			console.error("admin-toggle-subscription: update failed", error);
			return structuredErr(
				"update_failed",
				"No se pudo actualizar la suscripción",
				500,
			);
		}

		return json({ status: newStatus, updatedAt: new Date().toISOString() });
	} catch (e: unknown) {
		if (e instanceof AdminAuthError)
			return structuredErr("admin_auth_failed", e.message, e.status);
		console.error("admin-toggle-subscription failed", e);
		return structuredErr(
			"toggle_failed",
			"Error al modificar suscripción",
			500,
		);
	}
});
