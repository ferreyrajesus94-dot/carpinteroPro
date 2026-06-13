import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/providers/AuthProvider";
import {
	fetchAdminWorkshops,
	fetchAdminWorkshopDetail,
} from "../api/workshops";

export const ADMIN_WORKSHOPS_KEY = "admin-workshops" as const;

export function useAdminWorkshops(search?: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_WORKSHOPS_KEY, search ?? ""],
		queryFn: () => fetchAdminWorkshops(search),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}

export function useAdminWorkshopDetail(workshopId: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_WORKSHOPS_KEY, "detail", workshopId],
		queryFn: () => fetchAdminWorkshopDetail(workshopId),
		enabled: isPlatformAdmin && Boolean(workshopId),
		staleTime: 60_000,
	});
}
