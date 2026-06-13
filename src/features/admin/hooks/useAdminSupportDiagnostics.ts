import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/providers/AuthProvider";
import { fetchAdminSupportDiagnostics } from "../api/support";

export const ADMIN_SUPPORT_DIAGNOSTICS_KEY = "admin-support-diagnostics" as const;

export function useAdminSupportDiagnostics(workshopId?: string) {
	const { isPlatformAdmin } = useAuth();

	return useQuery({
		queryKey: [ADMIN_SUPPORT_DIAGNOSTICS_KEY, workshopId ?? ""],
		queryFn: () => fetchAdminSupportDiagnostics(workshopId),
		enabled: isPlatformAdmin,
		staleTime: 60_000,
	});
}
