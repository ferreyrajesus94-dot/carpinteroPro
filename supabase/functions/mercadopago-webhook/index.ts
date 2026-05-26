import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103";
import {
	calculateNextPeriodDates,
	mapMercadoPagoStatusToAppStatus,
	isValidSignature,
} from "../_shared/billing.ts";
import { getPayment, getPreapproval } from "../_shared/mercadopago.ts";
import { err, json, preflight } from "../_shared/response.ts";

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
		return err("Method not allowed", 405);
	}

	const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
	if (!secret) {
		console.error("MERCADOPAGO_WEBHOOK_SECRET is not configured");
		return err("Webhook not configured", 401);
	}

	const signatureHeader = req.headers.get("x-signature") || "";
	const requestId = req.headers.get("x-request-id") || "";
	const tsMatch = signatureHeader.match(/ts=(\d+)/);
	const timestamp = tsMatch ? tsMatch[1] : "";

	if (!signatureHeader || !requestId || !timestamp) {
		return err("Missing signature headers", 401);
	}

	let payload: WebhookPayload;
	try {
		payload = await req.json();
	} catch {
		return err("Invalid JSON", 400);
	}

	const dataId = payload.data?.id;
	if (!dataId) {
		return err("Missing data.id", 400);
	}

	const valid = await isValidSignature(
		dataId,
		requestId,
		timestamp,
		signatureHeader,
		secret,
	);
	if (!valid) {
		return err("Invalid signature", 403);
	}

	const isPreapproval = payload.type.startsWith("preapproval");
	const isPayment = payload.type.startsWith("payment");

	if (!isPreapproval && !isPayment) {
		console.warn(`Unknown event type: ${payload.type}`);
		return json({ message: "Unknown event type" });
	}

	let providerResource: Record<string, unknown> | null = null;
	let preapprovalId: string | null = null;

	try {
		if (isPreapproval) {
			providerResource = await getPreapproval(dataId);
			preapprovalId = dataId;
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
		return err("Provider fetch failed", 502);
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
		return err("Database error", 500);
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
		return err("Failed to record event", 500);
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
		return err("Failed to update subscription", 500);
	}

	return json({ message: "OK" });
});
