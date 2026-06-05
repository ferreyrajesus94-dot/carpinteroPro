import { AuthError, getAuthContext, serviceClient } from "../_shared/auth.ts";
import { createPreapproval, getPreapproval } from "../_shared/mercadopago.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
	env: { get(key: string): string | undefined };
};

Deno.serve(async (req: Request) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST")
		return structuredErr("method_not_allowed", "Method not allowed", 405);

	try {
		const { workshopId, email } = await getAuthContext(req);
		console.info("create-subscription request", { workshopId, email });
		const supabase = serviceClient();
		const { data: sub, error: selectError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("workshop_id", workshopId)
			.maybeSingle();
		if (selectError) {
			console.error(
				"create-subscription: failed to load subscription",
				selectError,
			);
			return structuredErr(
				"subscription_lookup_failed",
				"No se pudo leer la suscripción del taller",
				500,
			);
		}

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
		if (upsertError) {
			console.error(
				"create-subscription: failed to upsert subscription",
				upsertError,
			);
			return structuredErr(
				"subscription_upsert_failed",
				"No se pudo guardar la suscripción",
				500,
			);
		}

		return json({
			initPoint: getCheckoutUrl(mp),
			preapprovalId: mp.id,
			status: mp.status,
		});
	} catch (e: unknown) {
		if (e instanceof AuthError) {
			return structuredErr("auth_failed", e.message, e.status);
		}
		const msg = e instanceof Error ? e.message : "Unknown error";
		console.error("create-subscription failed", msg);
		return structuredErr(
			"checkout_unavailable",
			"No se pudo iniciar el checkout, intentá de nuevo",
			500,
		);
	}
});
