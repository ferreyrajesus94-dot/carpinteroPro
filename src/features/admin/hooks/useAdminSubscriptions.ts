import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/providers/AuthProvider";
import { fetchAdminSubscriptions } from "../api/subscriptions";

export const ADMIN_SUBSCRIPTIONS_KEY = "admin-subscriptions" as const;

export function useAdminSubscriptions(status?: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_SUBSCRIPTIONS_KEY, status ?? ""],
		queryFn: () => fetchAdminSubscriptions(status),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}
