export type SubscriptionStatus =
	| "trialing"
	| "active"
	| "past_due"
	| "unpaid"
	| "cancelled";

export function mapMercadoPagoStatusToAppStatus(
	providerStatus: string,
): SubscriptionStatus {
	const s = providerStatus.toLowerCase();
	if (s === "authorized" || s === "active") return "active";
	if (s === "pending" || s === "paused") return "past_due";
	if (s === "rejected" || s === "failure") return "unpaid";
	if (s === "cancelled") return "cancelled";
	return "past_due";
}

export async function isValidSignature(
	dataId: string,
	requestId: string,
	timestamp: string,
	signatureHeader: string,
	secret: string,
): Promise<boolean> {
	const match = signatureHeader.match(/v1=([a-f0-9]+)/i);
	if (!match) return false;
	const providedHash = match[1].toLowerCase();

	const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
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
