import { AuthError, getAuthContext, serviceClient } from "../_shared/auth.ts";
import { cancelPreapproval } from "../_shared/mercadopago.ts";
import { err, json, preflight } from "../_shared/response.ts";

Deno.serve(async (req) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") return err("Method not allowed", 405);

	try {
		const { workshopId } = await getAuthContext(req);
		const supabase = serviceClient();
		const { data: sub, error: selectError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("workshop_id", workshopId)
			.single();
		if (selectError) throw selectError;
		if (!sub?.provider_preapproval_id)
			return err("No provider subscription", 400);

		await cancelPreapproval(sub.provider_preapproval_id);
		const { error: updateError } = await supabase
			.from("subscriptions")
			.update({ status: "cancelled", cancelled_at: new Date().toISOString() })
			.eq("workshop_id", workshopId);
		if (updateError) throw updateError;

		return json({ status: "cancelled", cancelAtPeriodEnd: false });
	} catch (e: unknown) {
		const status = e instanceof AuthError ? e.status : 500;
		const msg = e instanceof Error ? e.message : "Unknown error";
		return err(msg, status);
	}
});
