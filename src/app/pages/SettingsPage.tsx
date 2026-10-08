import { WorkshopSettings } from "@/features/settings/components/WorkshopSettings";
import { useResetOnboarding } from "@/features/onboarding/hooks/useOnboarding";

/**
 * Settings page for workshop preferences and onboarding.
 * Billing history is managed separately and is not part of these settings.
 */
export function SettingsPage() {
	const resetOnboarding = useResetOnboarding();

	return (
		<WorkshopSettings
			onResetOnboarding={() => resetOnboarding.mutate()}
			isResetOnboardingPending={resetOnboarding.isPending}
		/>
	);
}
