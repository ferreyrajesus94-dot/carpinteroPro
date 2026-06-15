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
		const body: { workshopId?: string; active?: boolean } = await req
			.json()
			.catch(() => ({}));
		if (!body.workshopId || typeof body.active !== "boolean") {
			return structuredErr(
				"invalid_request",
				"workshopId and active (boolean) required",
				400,
			);
		}

		const { data, error } = await serviceClient()
			.from("workshops")
			.update({ is_active: body.active })
			.eq("id", body.workshopId)
			.select("id")
			.returns<{ id: string }[]>();

		if (error) {
			console.error("admin-toggle-workshop: update failed", error);
			return structuredErr(
				"update_failed",
				"No se pudo actualizar el taller",
				500,
			);
		}
		if (!data || data.length === 0) {
			return structuredErr("workshop_not_found", "Taller no encontrado", 404);
		}

		return json({ workshopId: body.workshopId, isActive: body.active });
	} catch (e: unknown) {
		if (e instanceof AdminAuthError)
			return structuredErr("admin_auth_failed", e.message, e.status);
		console.error("admin-toggle-workshop failed", e);
		return structuredErr("toggle_failed", "Error al modificar taller", 500);
	}
});
