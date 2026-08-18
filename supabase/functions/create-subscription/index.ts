import { AuthError, getAuthContext, serviceClient } from "../_shared/auth.ts";
import { createPreapproval, getPreapproval } from "../_shared/mercadopago.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import {
	buildSubscriptionUpsertPayload,
	computeSubscriptionAmount,
	shouldComputeReferralDiscount,
	type ReferralInfo,
} from "./discount.ts";

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
		console.info("create-subscription request", { workshopId });
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

		// ── Discount computation from referral attribution ─────────────
		let transactionAmount = 4990;
		let firstPeriodDiscountPct: number | null = null;
		let referredByReferralCodeId: string | null = null;

		// Only compute discount for first preapproval (no prior preapproval)
		if (
			shouldComputeReferralDiscount(
				sub
					? {
							providerPreapprovalId: sub.provider_preapproval_id,
							status: sub.status,
						}
					: null,
			)
		) {
			const { data: workshopRef } = await supabase
				.from("workshop_referrals")
				.select("referral_code_id, referral_codes!inner(discount_pct, is_active)")
				.eq("workshop_id", workshopId)
				.maybeSingle();

			if (workshopRef) {
				const rc = workshopRef.referral_codes as {
					discount_pct: number;
					is_active: boolean;
				};
				const referral: ReferralInfo = {
					discountPct: rc.discount_pct,
					codeActive: rc.is_active,
				};
				const result = computeSubscriptionAmount(4990, referral);

				if (result.discountApplied) {
					transactionAmount = result.amount;
					firstPeriodDiscountPct = result.discountPct;
					referredByReferralCodeId = workshopRef.referral_code_id;
					console.info("discount applied", {
						workshopId,
						discountPct: result.discountPct,
						amount: result.amount,
					});
				} else {
					console.info("discount_skipped reason=code_inactive", {
						workshopId,
					});
				}
			}
		}

		console.info("creating MercadoPago preapproval", {
			workshopId,
			origin,
			transactionAmount,
		});
		const mp = await createPreapproval({
			reason: "CarpinteroPro Pro Mensual",
			auto_recurring: {
				frequency: 1,
				frequency_type: "months",
				transaction_amount: transactionAmount,
				currency_id: "ARS",
			},
			external_reference: sub?.id || workshopId,
			back_url: `${origin}/settings`,
			...(payerEmail ? { payer_email: payerEmail } : {}),
			status: "pending",
		});

		const nextStatus =
			mp.status === "authorized" ? "active" : sub?.status || "trialing";
		const payload = buildSubscriptionUpsertPayload({
			workshopId,
			status: nextStatus,
			plan: sub?.plan || "pro_monthly",
			providerPreapprovalId: mp.id,
			providerStatus: mp.status,
			firstPeriodDiscountPct,
			referredByReferralCodeId,
		});
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
