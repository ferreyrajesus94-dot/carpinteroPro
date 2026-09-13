import { BillingSettingsCard } from "@/features/billing";
import { WorkshopSettings } from "@/features/settings/components/WorkshopSettings";
import { useResetOnboarding } from "@/features/onboarding/hooks/useOnboarding";

/**
 * Settings page. CarpinteroPro is free, so the only billing-shaped
 * surface is the read-only `BillingSettingsCard`, which renders the
 * "Sin suscripción activa" copy. The app never reads subscription
 * state from the user-facing UI; historical subscription data is only
 * surfaced via the admin tools (`/admin/*`).
 */
export function SettingsPage() {
	const resetOnboarding = useResetOnboarding();

	return (
		<WorkshopSettings
			billingSlot={<BillingSettingsCard subscription={null} />}
			onResetOnboarding={() => resetOnboarding.mutate()}
			isResetOnboardingPending={resetOnboarding.isPending}
		/>
	);
}
