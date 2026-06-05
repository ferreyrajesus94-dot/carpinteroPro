import { useAuth } from "@/shared/providers/AuthProvider";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { getSupportMailtoHref } from "@/shared/lib/supportContact";
import { BillingSettingsCard } from "@/features/billing/components/BillingSettingsCard";
import { formatBillingStatus } from "@/features/billing/lib/access";
import type { SubscriptionRow } from "@/features/billing/types";

interface BillingBlockedScreenProps {
	subscription: SubscriptionRow | null;
	onStartPayment?: () => void | Promise<void>;
	isPaymentLoading?: boolean;
}

export function BillingBlockedScreen({
	subscription,
	onStartPayment,
	isPaymentLoading = false,
}: BillingBlockedScreenProps) {
	const { signOut } = useAuth();
	const supportHref = getSupportMailtoHref({
		subject: "Ayuda con mi suscripción de CarpinteroPro",
		body: "Necesito ayuda con un problema de facturación o suscripción.",
	});
	const whatsappHref =
		"https://wa.me/?text=Necesito%20ayuda%20con%20mi%20suscripci%C3%B3n%20de%20CarpinteroPro";

	const statusText = subscription
		? formatBillingStatus(subscription)
		: "Acceso suspendido";

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-xl">CarpinteroPro</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">{statusText}</p>
					<p className="text-sm">
						Tu acceso a la app está suspendido. Para seguir usando
						CarpinteroPro, necesitás una suscripción activa o completar el pago
						pendiente.
					</p>
					<BillingSettingsCard
						subscription={subscription}
						onStartPayment={onStartPayment}
						isPaymentLoading={isPaymentLoading}
					/>
					<div className="flex flex-col gap-2">
						<Button
							variant="outline"
							onClick={() => signOut()}
							className="w-full"
						>
							Cerrar sesión
						</Button>
					</div>
					<div className="text-center text-xs text-muted-foreground">
						<span>¿Necesitás ayuda? </span>
						<a
							data-testid="billing-whatsapp-link"
							href={whatsappHref}
							target="_blank"
							rel="noreferrer"
							className="underline hover:text-foreground"
						>
							WhatsApp
						</a>
						{supportHref ? (
							<>
								<span> o </span>
								<a
									data-testid="billing-support-link"
									href={supportHref}
									className="underline hover:text-foreground"
								>
									email
								</a>
							</>
						) : null}
						<span>.</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
