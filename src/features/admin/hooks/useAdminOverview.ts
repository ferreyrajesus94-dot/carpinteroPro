import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/providers/AuthProvider";
import { fetchAdminOverview } from "../api/overview";

export const ADMIN_OVERVIEW_KEY = "admin-overview" as const;

export function useAdminOverview() {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_OVERVIEW_KEY],
		queryFn: fetchAdminOverview,
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}
