import { supabase } from "@/shared/lib/supabase";
import type { AdminSupportDiagnosticsResponse } from "../types";

export async function fetchAdminSupportDiagnostics(
	workshopId?: string,
): Promise<AdminSupportDiagnosticsResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-support-diagnostics",
		{
			body: workshopId ? { workshopId } : {},
		},
	);
	if (error) throw error;
	return data as AdminSupportDiagnosticsResponse;
}
