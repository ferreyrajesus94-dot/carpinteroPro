import { BillingSettingsCard } from "@/features/billing/components/BillingSettingsCard";
import { useSubscription } from "@/features/billing/hooks/useSubscription";
import { WorkshopSettings } from "@/features/settings/components/WorkshopSettings";
import { useResetOnboarding } from "@/features/onboarding/hooks/useOnboarding";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useAuth } from "@/shared/providers/AuthProvider";

export function SettingsPage() {
	const workshopId = useWorkshopId();
	const { onboardedAt } = useAuth();
	const { data: subscription, isLoading: isSubscriptionLoading } =
		useSubscription(workshopId, onboardedAt);
	const resetOnboarding = useResetOnboarding();

	return (
		<WorkshopSettings
			billingSlot={
				<BillingSettingsCard
					subscription={subscription ?? null}
					isLoading={isSubscriptionLoading}
				/>
			}
			onResetOnboarding={() => resetOnboarding.mutate()}
			isResetOnboardingPending={resetOnboarding.isPending}
		/>
	);
}
