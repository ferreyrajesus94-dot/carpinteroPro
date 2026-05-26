import { useQuery } from "@tanstack/react-query";
import { fetchSubscription } from "@/features/billing/api/subscriptions";

export function useSubscription(
	workshopId: string | null,
	onboardedAt: string | null,
) {
	return useQuery({
		queryKey: ["subscription", workshopId],
		queryFn: () => fetchSubscription(workshopId!),
		enabled: Boolean(workshopId && onboardedAt),
		staleTime: 5 * 60 * 1000,
	});
}
