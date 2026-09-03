import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Eyebrow } from "@/shared/ui/eyebrow";
import {
	useCancelSubscription,
	useCreateSubscription,
} from "@/features/billing/hooks/useBillingActions";
import type { SubscriptionRow } from "@/features/billing/types";
import { BILLING_PRICE } from "@/shared/constants/billingPricing";

const CANCEL_CONFIRM_MESSAGE =
	"¿Querés cancelar la suscripción? Mantendrás el acceso hasta el fin del período si MercadoPago permite la cancelación diferida.";

// Covers the trial period, MercadoPago processing delays, and calendar month variance.
export const FIRST_PERIOD_BUFFER_DAYS = 45;

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

function isFirstPeriod(subscription: SubscriptionRow): boolean {
	if (!subscription.current_period_starts_at) return true;
	const periodStart = new Date(subscription.current_period_starts_at).getTime();
	const created = new Date(subscription.created_at).getTime();
	return periodStart - created < FIRST_PERIOD_BUFFER_DAYS * 24 * 60 * 60 * 1000;
}

function getDiscountLine(subscription: SubscriptionRow): string | null {
	if (
		subscription.first_period_discount_pct != null &&
		isFirstPeriod(subscription)
	) {
		return `Descuento aplicado: ${subscription.first_period_discount_pct}% durante el primer período.`;
	}
	return null;
}

function appendDiscount(
	details: string[],
	subscription: SubscriptionRow,
): string[] {
	const line = getDiscountLine(subscription);
	if (line) {
		return [...details, line];
	}
	return details;
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
		details: appendDiscount(
			[
				`Acceso disponible hasta el ${formatDate(subscription.current_period_ends_at)}`,
				`Plan actual: ${BILLING_PRICE.label}`,
			],
			subscription,
		),
			action: null,
		};
	if (subscription.status === "trialing")
		return {
			title: "Período de prueba",
			description:
				"Activá la suscripción antes del vencimiento para evitar el bloqueo automático.",
			details: appendDiscount(
				[
					`Finaliza el ${formatDate(subscription.trial_ends_at)}`,
					`Precio luego de la prueba: ${BILLING_PRICE.label}`,
				],
				subscription,
			),
			action: "pay" as const,
			label: "Empezar suscripción",
		};
	if (subscription.status === "active")
		return {
			title: "Suscripción activa",
			description: "Tu taller tiene acceso completo a CarpinteroPro.",
			details: appendDiscount(
				[
					`Período actual: ${formatDate(subscription.current_period_starts_at)} al ${formatDate(subscription.current_period_ends_at)}`,
					`Próximo cargo: ${BILLING_PRICE.label}`,
				],
				subscription,
			),
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
		details: appendDiscount(
			[`Importe mensual: ${BILLING_PRICE.label}`],
			subscription,
		),
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
				<Eyebrow as="div" variant="mono" className="tracking-[0.1em]">
					Facturación
				</Eyebrow>
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
