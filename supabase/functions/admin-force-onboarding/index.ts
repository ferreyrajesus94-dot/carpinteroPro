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
		const body: { profileId?: string } = await req.json().catch(() => ({}));
		if (!body.profileId)
			return structuredErr("invalid_request", "profileId required", 400);

		// Check current state
		const { data: profile, error: lookupErr } = await serviceClient()
			.from("profiles")
			.select("onboarded_at")
			.eq("id", body.profileId)
			.single();

		if (lookupErr || !profile)
			return structuredErr("profile_not_found", "Perfil no encontrado", 404);
		if (profile.onboarded_at !== null)
			return structuredErr(
				"already_onboarded",
				"Perfil ya está onboardeado",
				400,
			);

		const now = new Date().toISOString();
		const { error: updateErr } = await serviceClient()
			.from("profiles")
			.update({ onboarded_at: now })
			.eq("id", body.profileId);

		if (updateErr) {
			console.error("admin-force-onboarding: update failed", updateErr);
			return structuredErr(
				"update_failed",
				"No se pudo actualizar el perfil",
				500,
			);
		}

		return json({ onboardedAt: now });
	} catch (e: unknown) {
		if (e instanceof AdminAuthError)
			return structuredErr("admin_auth_failed", e.message, e.status);
		console.error("admin-force-onboarding failed", e);
		return structuredErr("force_failed", "Error al forzar onboarding", 500);
	}
});
