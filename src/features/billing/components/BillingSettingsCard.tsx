import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
	useCancelSubscription,
	useCreateSubscription,
} from "@/features/billing/hooks/useBillingActions";
import type { SubscriptionRow } from "@/features/billing/types";
import { BILLING_PRICE } from "@/shared/constants/billingPricing";

const CANCEL_CONFIRM_MESSAGE =
	"¿Querés cancelar la suscripción? Mantendrás el acceso hasta el fin del período si MercadoPago permite la cancelación diferida.";

interface BillingSettingsCardProps {
	subscription: SubscriptionRow | null;
	isLoading?: boolean;
	onStartPayment?: () => void | Promise<void>;
	isPaymentLoading?: boolean;
}

function formatDate(value: string | null): string {
	return value
		? new Intl.DateTimeFormat("es-AR", {
				day: "numeric",
				month: "numeric",
				year: "numeric",
				timeZone: "UTC",
			}).format(new Date(value))
		: "sin fecha disponible";
}

function getErrorMessage(error: unknown): string | null {
	if (!error) return null;
	return error instanceof Error
		? error.message
		: "No pudimos completar la acción. Intentá nuevamente.";
}

function getContent(subscription: SubscriptionRow | null, isLoading: boolean) {
	if (isLoading)
		return {
			title: "Facturación",
			description: "Cargando estado de facturación…",
			details: [],
			action: null,
		};
	if (!subscription)
		return {
			title: "Pago requerido",
			description: "No encontramos una suscripción activa para este taller.",
			details: ["Activá la suscripción para restaurar el acceso completo."],
			action: "pay" as const,
			label: "Suscribirse",
		};
	if (subscription.cancel_at_period_end)
		return {
			title: "Cancelación programada",
			description:
				"Tu suscripción seguirá activa hasta el final del período ya abonado.",
			details: [
				`Acceso disponible hasta el ${formatDate(subscription.current_period_ends_at)}`,
				`Plan actual: ${BILLING_PRICE.label}`,
			],
			action: null,
		};
	if (subscription.status === "trialing")
		return {
			title: "Período de prueba",
			description:
				"Activá la suscripción antes del vencimiento para evitar el bloqueo automático.",
			details: [
				`Finaliza el ${formatDate(subscription.trial_ends_at)}`,
				`Precio luego de la prueba: ${BILLING_PRICE.label}`,
			],
			action: "pay" as const,
			label: "Empezar suscripción",
		};
	if (subscription.status === "active")
		return {
			title: "Suscripción activa",
			description: "Tu taller tiene acceso completo a CarpinteroPro.",
			details: [
				`Período actual: ${formatDate(subscription.current_period_starts_at)} al ${formatDate(subscription.current_period_ends_at)}`,
				`Próximo cargo: ${BILLING_PRICE.label}`,
			],
			action: "cancel" as const,
			label: "Cancelar",
		};
	const needsUpdate =
		subscription.status === "past_due" || subscription.status === "unpaid";
	return {
		title: needsUpdate ? "Pago requerido" : "Suscripción cancelada",
		description: needsUpdate
			? "Actualizá el medio de pago para restaurar el acceso completo al taller."
			: "El acceso completo está suspendido hasta que actives una nueva suscripción.",
		details: [`Importe mensual: ${BILLING_PRICE.label}`],
		action: "pay" as const,
		label: needsUpdate ? "Actualizar pago" : "Suscribirse",
	};
}

export function BillingSettingsCard({
	subscription,
	isLoading = false,
	onStartPayment,
	isPaymentLoading = false,
}: BillingSettingsCardProps) {
	const createSubscription = useCreateSubscription();
	const cancelSubscription = useCancelSubscription();
	const [actionError, setActionError] = useState<string | null>(null);
	const content = getContent(subscription, isLoading);
	const isCreatePending = isPaymentLoading || createSubscription.isPending;
	const isCancelPending = cancelSubscription.isPending;
	const isAnyPending = isCreatePending || isCancelPending;

	async function handleStartPayment() {
		setActionError(null);
		try {
			if (onStartPayment) return await onStartPayment();
			const result = await createSubscription.mutateAsync();
			if (result.initPoint) window.location.assign(result.initPoint);
		} catch (error) {
			setActionError(getErrorMessage(error));
		}
	}

	async function handleCancel() {
		if (!window.confirm(CANCEL_CONFIRM_MESSAGE)) return;
		setActionError(null);
		try {
			await cancelSubscription.mutateAsync();
		} catch (error) {
			setActionError(getErrorMessage(error));
		}
	}

	const visibleError =
		actionError ??
		getErrorMessage(createSubscription.error ?? cancelSubscription.error);
	return (
		<Card>
			<CardHeader>
				<div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3">
					Facturación
				</div>
				<CardTitle className="text-base font-display">
					{content.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">{content.description}</p>
				{content.details.length > 0 && (
					<ul className="space-y-1 text-sm text-ink">
						{content.details.map((detail) => (
							<li key={detail}>{detail}</li>
						))}
					</ul>
				)}
				{visibleError && (
					<p role="alert" className="text-sm text-destructive">
						{visibleError}
					</p>
				)}
				{content.action === "pay" && (
					<Button
						type="button"
						onClick={handleStartPayment}
						disabled={isAnyPending}
					>
						{isCreatePending ? "Abriendo pago…" : content.label}
					</Button>
				)}
				{content.action === "cancel" && (
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={isAnyPending}
					>
						{isCancelPending ? "Cancelando…" : content.label}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
