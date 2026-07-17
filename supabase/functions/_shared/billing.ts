export type SubscriptionStatus =
	| "trialing"
	| "active"
	| "past_due"
	| "unpaid"
	| "cancelled";

export function mapMercadoPagoStatusToAppStatus(
	providerStatus: string,
): SubscriptionStatus | null {
	const s = providerStatus.toLowerCase();
	if (s === "authorized" || s === "active") return "active";
	if (s === "pending" || s === "paused") return "past_due";
	if (s === "rejected" || s === "failure") return "unpaid";
	if (s === "cancelled") return "cancelled";
	return null;
}

export type MercadoPagoWebhookResourceType =
	| "preapproval"
	| "payment"
	| "authorized_payment"
	| "unknown";

export function classifyMercadoPagoWebhookType(
	eventType: string,
): MercadoPagoWebhookResourceType {
	if (
		eventType === "subscription_preapproval" ||
		eventType.startsWith("subscription_preapproval.") ||
		eventType.startsWith("preapproval")
	) {
		return "preapproval";
	}
	if (
		eventType === "subscription_authorized_payment" ||
		eventType.startsWith("subscription_authorized_payment.")
	) {
		return "authorized_payment";
	}
	if (eventType.startsWith("payment")) return "payment";
	return "unknown";
}

export async function isValidSignature(
	dataId: string | null,
	requestId: string,
	timestamp: string,
	signatureHeader: string,
	secret: string,
): Promise<boolean> {
	if (!secret || !signatureHeader) return false;
	const match = signatureHeader.match(/v1=([a-f0-9]+)/i);
	if (!match) return false;
	const providedHash = match[1].toLowerCase();

	const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ""}request-id:${requestId};ts:${timestamp};`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
	const computedHash = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return computedHash === providedHash;
}

export function calculateNextPeriodDates(startDate: Date) {
	const starts = new Date(startDate);
	const ends = new Date(starts);
	ends.setUTCDate(ends.getUTCDate() + 30);
	return { starts, ends };
}
