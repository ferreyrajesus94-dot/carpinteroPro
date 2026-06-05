import { AuthError, getAuthContext, serviceClient } from "../_shared/auth.ts";
import { cancelPreapproval } from "../_shared/mercadopago.ts";
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
		const { workshopId } = await getAuthContext(req);
		const supabase = serviceClient();
		const { data: sub, error: selectError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("workshop_id", workshopId)
			.single();
		if (selectError) {
			console.error(
				"cancel-subscription: failed to load subscription",
				selectError,
			);
			return structuredErr(
				"subscription_lookup_failed",
				"No se pudo leer la suscripción del taller",
				500,
			);
		}
		if (!sub?.provider_preapproval_id)
			return structuredErr(
				"no_provider_subscription",
				"Este taller no tiene una suscripción activa en el proveedor",
				400,
			);

		await cancelPreapproval(sub.provider_preapproval_id);
		const { error: updateError } = await supabase
			.from("subscriptions")
			.update({ status: "cancelled", cancelled_at: new Date().toISOString() })
			.eq("workshop_id", workshopId);
		if (updateError) {
			console.error(
				"cancel-subscription: failed to update subscription",
				updateError,
			);
			return structuredErr(
				"subscription_update_failed",
				"No se pudo cancelar la suscripción",
				500,
			);
		}

		return json({ status: "cancelled", cancelAtPeriodEnd: false });
	} catch (e: unknown) {
		if (e instanceof AuthError) {
			return structuredErr("auth_failed", e.message, e.status);
		}
		const msg = e instanceof Error ? e.message : "Unknown error";
		console.error("cancel-subscription failed", msg);
		return structuredErr(
			"cancel_failed",
			"No se pudo cancelar la suscripción, intentá de nuevo",
			500,
		);
	}
});
