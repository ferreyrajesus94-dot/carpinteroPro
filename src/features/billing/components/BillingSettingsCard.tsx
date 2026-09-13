import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Eyebrow } from "@/shared/ui/eyebrow";
import type { SubscriptionRow } from "@/features/billing/types";

/**
 * Read-only billing card shown under /settings.
 *
 * The app is free. This card exists only to surface the historical
 * subscription status of a workshop that already had a row before the
 * free launch. It must NEVER render a subscribe / cancel / update-payment
 * CTA or call any Edge Function. It is also free of loading-state
 * mutations — there is nothing to mutate from the user journey.
 */

interface BillingSettingsCardProps {
	subscription: SubscriptionRow | null;
	isLoading?: boolean;
}

function formatStatusLabel(status: SubscriptionRow["status"]): string {
	switch (status) {
		case "active":
			return "Suscripción activa (histórica)";
		case "trialing":
			return "Período de prueba (histórico)";
		case "past_due":
			return "Pago pendiente (histórico)";
		case "unpaid":
			return "Suscripción suspendida por falta de pago (histórica)";
		case "cancelled":
			return "Suscripción cancelada";
		default:
			return "Estado histórico";
	}
}

export function BillingSettingsCard({
	subscription,
	isLoading = false,
}: BillingSettingsCardProps) {
	return (
		<Card data-testid="billing-settings-card">
			<CardHeader>
				<Eyebrow as="div" variant="mono" className="tracking-[0.1em]">
					Facturación
				</Eyebrow>
				<CardTitle className="text-base font-display">
					Historial de facturación
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{isLoading ? (
					<p className="text-sm text-ink2">Cargando historial…</p>
				) : subscription ? (
					<>
						<span
							data-testid="billing-status-badge"
							className="inline-flex items-center rounded-full bg-cp-bg2 px-2.5 py-0.5 text-xs font-medium text-ink2"
						>
							{formatStatusLabel(subscription.status)}
						</span>
						<p className="text-sm text-ink3">
							CarpinteroPro es gratuito. Esta sección refleja únicamente el
							estado histórico de tu taller y no realiza cobros.
						</p>
					</>
				) : (
					<p
						data-testid="billing-no-subscription"
						className="text-sm text-ink2"
					>
						Sin suscripción activa
					</p>
				)}
			</CardContent>
		</Card>
	);
}
