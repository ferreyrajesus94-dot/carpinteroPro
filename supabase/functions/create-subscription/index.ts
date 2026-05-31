import { AuthError, getAuthContext, serviceClient } from "../_shared/auth.ts";
import { createPreapproval, getPreapproval } from "../_shared/mercadopago.ts";
import { err, json, preflight } from "../_shared/response.ts";

Deno.serve(async (req) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") return err("Method not allowed", 405);

	try {
		const { workshopId, email } = await getAuthContext(req);
		console.info("create-subscription request", { workshopId, email });
		const supabase = serviceClient();
		const { data: sub, error: selectError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("workshop_id", workshopId)
			.maybeSingle();
		if (selectError) throw selectError;

		const origin = Deno.env.get("APP_ORIGIN") || "http://localhost:3000";
		const isSandboxCheckout = origin.includes("vercel.app");
		const payerEmail = isSandboxCheckout
			? Deno.env.get("MERCADOPAGO_SANDBOX_PAYER_EMAIL")
			: email;
		const getCheckoutUrl = (mp: Record<string, unknown>) => {
			const initPoint = mp.init_point as string | undefined;
			const sandboxInitPoint = mp.sandbox_init_point as string | undefined;
			return isSandboxCheckout
				? (sandboxInitPoint ?? initPoint)
				: (initPoint ?? sandboxInitPoint);
		};

		if (sub?.provider_preapproval_id && sub.status !== "cancelled") {
			const mp = await getPreapproval(sub.provider_preapproval_id);
			return json({
				initPoint: getCheckoutUrl(mp),
				status: sub.status,
				preapprovalId: sub.provider_preapproval_id,
			});
		}

		console.info("creating MercadoPago preapproval", { workshopId, origin });
		const mp = await createPreapproval({
			reason: "CarpinteroPro Pro Mensual",
			auto_recurring: {
				frequency: 1,
				frequency_type: "months",
				transaction_amount: 4990,
				currency_id: "ARS",
			},
			external_reference: sub?.id || workshopId,
			back_url: `${origin}/settings`,
			...(payerEmail ? { payer_email: payerEmail } : {}),
			status: "pending",
		});

		const nextStatus =
			mp.status === "authorized" ? "active" : sub?.status || "trialing";
		const payload = {
			workshop_id: workshopId,
			status: nextStatus,
			plan: sub?.plan || "pro_monthly",
			provider: "mercadopago",
			provider_preapproval_id: mp.id,
			provider_status: mp.status,
		};
		const { error: upsertError } = await supabase
			.from("subscriptions")
			.upsert(payload, { onConflict: "workshop_id" });
		if (upsertError) throw upsertError;

		return json({
			initPoint: getCheckoutUrl(mp),
			preapprovalId: mp.id,
			status: mp.status,
		});
	} catch (e: unknown) {
		const status = e instanceof AuthError ? e.status : 500;
		const msg = e instanceof Error ? e.message : "Unknown error";
		console.error("create-subscription failed", msg);
		return err(msg, status);
	}
});
