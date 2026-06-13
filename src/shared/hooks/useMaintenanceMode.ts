import { supabase } from "@/shared/lib/supabase";
import { useQuery } from "@tanstack/react-query";

interface MaintenanceRow {
	key: string;
	value: { enabled: boolean; message: string };
}

export function useMaintenanceMode() {
	return useQuery({
		queryKey: ["maintenance-mode"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("platform_settings")
				.select("key, value")
				.eq("key", "maintenance")
				.single();
			if (error || !data) return { enabled: false, message: "" };
			const row = data as MaintenanceRow;
			return {
				enabled: row.value?.enabled ?? false,
				message: row.value?.message ?? "",
			};
		},
		staleTime: 30_000,
	});
}
