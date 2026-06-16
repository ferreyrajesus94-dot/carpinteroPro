// @ts-expect-error Deno remote import is resolved by the Supabase Edge runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103";
import {
	calculateNextPeriodDates,
	mapMercadoPagoStatusToAppStatus,
	isValidSignature,
	classifyMercadoPagoWebhookType,
} from "../_shared/billing.ts";
import {
	getAuthorizedPayment,
	getPayment,
	getPreapproval,
} from "../_shared/mercadopago.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import { recordCommissionIfReferred } from "./commissions.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
	env: { get(key: string): string | undefined };
};

interface WebhookPayload {
	data: {
		id: string;
	};
	type: string;
}

Deno.serve(async (req: Request) => {
	const preflightResponse = preflight(req);
	if (preflightResponse) return preflightResponse;

	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
	if (!secret) {
		console.error("MERCADOPAGO_WEBHOOK_SECRET is not configured");
		return structuredErr(
			"webhook_not_configured",
			"El webhook no está configurado en el servidor",
			401,
		);
	}

	const signatureHeader = req.headers.get("x-signature") || "";
	const requestId = req.headers.get("x-request-id") || "";
	const tsMatch = signatureHeader.match(/ts=(\d+)/);
	const timestamp = tsMatch ? tsMatch[1] : "";

	if (!signatureHeader || !requestId || !timestamp) {
		return structuredErr(
			"missing_signature_headers",
			"Faltan headers de firma del webhook",
			401,
		);
	}

	let payload: WebhookPayload;
	try {
		payload = await req.json();
	} catch {
		return structuredErr("invalid_json", "Cuerpo JSON inválido", 400);
	}

	const dataId = payload.data?.id;
	if (!dataId) {
		return structuredErr(
			"missing_data_id",
			"Falta el identificador del recurso",
			400,
		);
	}

	const signatureDataId = new URL(req.url).searchParams.get("data.id");
	const valid = await isValidSignature(
		signatureDataId,
		requestId,
		timestamp,
		signatureHeader,
		secret,
	);
	if (!valid) {
		return structuredErr(
			"invalid_signature",
			"La firma del webhook no es válida",
			403,
		);
	}

	const resourceType = classifyMercadoPagoWebhookType(payload.type);

	if (resourceType === "unknown") {
		console.warn(`Unknown event type: ${payload.type}`);
		return json({ message: "Unknown event type" });
	}

	let providerResource: Record<string, unknown> | null = null;
	let preapprovalId: string | null = null;

	try {
		if (resourceType === "preapproval") {
			providerResource = await getPreapproval(dataId);
			preapprovalId = dataId;
		} else if (resourceType === "authorized_payment") {
			const authorizedPayment = await getAuthorizedPayment(dataId);
			providerResource = authorizedPayment;
			preapprovalId =
				(authorizedPayment?.preapproval_id as string) ||
				(authorizedPayment?.preapproval?.id as string) ||
				null;
		} else {
			const payment = await getPayment(dataId);
			providerResource = payment;
			preapprovalId = (payment?.preapproval_id as string) || null;
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (message.includes("400") || message.includes("404")) {
			console.warn(`Provider resource not found: ${dataId}`);
			return json({ message: "Resource not found" });
		}
		console.error("Provider fetch failed", e);
		return structuredErr(
			"provider_fetch_failed",
			"No se pudo obtener el recurso del proveedor",
			502,
		);
	}

	if (!preapprovalId) {
		console.warn(`No preapproval ID for event ${payload.type} ${dataId}`);
		return json({ message: "No preapproval ID" });
	}

	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
	);

	const { data: subscription, error: selectError } = await supabase
		.from("subscriptions")
		.select("*")
		.eq("provider_preapproval_id", preapprovalId)
		.maybeSingle();

	if (selectError) {
		console.error("Failed to find subscription", selectError);
		return structuredErr(
			"subscription_lookup_failed",
			"No se pudo buscar la suscripción",
			500,
		);
	}

	if (!subscription) {
		console.warn(`No subscription for preapproval ${preapprovalId}`);
		return json({ message: "No subscription found" });
	}

	const providerEventId = requestId;
	const { error: insertError } = await supabase
		.from("billing_webhook_events")
		.insert({
			provider: "mercadopago",
			provider_event_id: providerEventId,
			event_type: payload.type,
			provider_resource_id: dataId,
			workshop_id: subscription.workshop_id,
			payload: payload as unknown as Record<string, unknown>,
			processed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

	if (insertError) {
		if (insertError.code === "23505") {
			return json({ message: "Already processed" });
		}
		console.error("Failed to insert webhook event", insertError);
		return structuredErr(
			"event_record_failed",
			"No se pudo registrar el evento del webhook",
			500,
		);
	}

	const providerStatus = (providerResource?.status as string) || "unknown";
	const appStatus = mapMercadoPagoStatusToAppStatus(providerStatus);

	const updateData: Record<string, unknown> = {
		provider_status: providerStatus,
		status: appStatus,
		updated_at: new Date().toISOString(),
	};

	if (appStatus === "active") {
		const now = new Date();
		const { starts, ends } = calculateNextPeriodDates(now);
		updateData.current_period_starts_at = starts.toISOString();
		updateData.current_period_ends_at = ends.toISOString();
	}

	const { error: updateError } = await supabase
		.from("subscriptions")
		.update(updateData)
		.eq("id", subscription.id);

	if (updateError) {
		console.error("Failed to update subscription", updateError);
		return structuredErr(
			"subscription_update_failed",
			"No se pudo actualizar la suscripción",
			500,
		);
	}

	// ── Commission recording for authorized payment ──────────────
	if (resourceType === "authorized_payment") {
		const paymentStatus = (providerResource?.status as string) || "";

		if (paymentStatus.toLowerCase() === "approved") {
			const paymentAmount =
				(providerResource?.transaction_amount as number) ||
				(providerResource?.charge as number) ||
				0;
			const occurredAt =
				(providerResource?.date_created as string) ||
				new Date().toISOString();

			const result = await recordCommissionIfReferred(supabase, {
				workshopId: subscription.workshop_id,
				subscriptionId: subscription.id,
				providerPaymentId: dataId,
				paymentAmount,
				occurredAt,
			});

			if (result.recorded) {
				console.info("commission_recorded", {
					workshopId: subscription.workshop_id,
					providerPaymentId: dataId,
				});
			} else if (result.duplicate) {
				console.log(
					"commission_already_recorded",
					{ providerPaymentId: dataId },
				);
				return json({ message: "Already processed" });
			} else if (result.skipped) {
				console.info(
					`commission_skipped reason=${result.reason}`,
					{ workshopId: subscription.workshop_id },
				);
			} else {
				console.error("Failed to record commission", { reason: result.reason });
				return structuredErr(
					"commission_record_failed",
					"No se pudo registrar la comisión",
					500,
				);
			}
		} else {
			console.info(
				"commission_skipped reason=payment_not_approved",
				{ status: paymentStatus },
			);
		}
	}

	return json({ message: "OK" });
});
