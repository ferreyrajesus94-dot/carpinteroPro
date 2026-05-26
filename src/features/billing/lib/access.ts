import type { SubscriptionRow } from "@/features/billing/types";

export function getBillingAccess(
	subscription: SubscriptionRow | null | undefined,
	now: Date,
): "allowed" | "blocked" | "loading" {
	if (!subscription) return "loading";

	if (subscription.status === "active") {
		if (
			subscription.cancel_at_period_end &&
			subscription.current_period_ends_at
		) {
			return new Date(subscription.current_period_ends_at) > now
				? "allowed"
				: "blocked";
		}
		return "allowed";
	}

	if (subscription.status === "trialing") {
		if (!subscription.trial_ends_at) return "blocked";
		return new Date(subscription.trial_ends_at) > now ? "allowed" : "blocked";
	}

	return "blocked";
}

export function isTrialActive(
	subscription: SubscriptionRow,
	now: Date,
): boolean {
	return (
		subscription.status === "trialing" &&
		subscription.trial_ends_at !== null &&
		new Date(subscription.trial_ends_at) > now
	);
}

export function formatBillingStatus(subscription: SubscriptionRow): string {
	switch (subscription.status) {
		case "trialing":
			return "Período de prueba";
		case "active":
			return "Suscripción activa";
		case "past_due":
			return "Pago pendiente";
		case "unpaid":
			return "Suscripción suspendida por falta de pago";
		case "cancelled":
			return "Suscripción cancelada";
		default:
			return "Estado desconocido";
	}
}
