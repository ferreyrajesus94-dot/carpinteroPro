import { supabase } from "@/shared/lib/supabase";
import type { AdminOverviewResponse } from "../types";

export async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
	const { data, error } = await supabase.functions.invoke("admin-overview", {
		body: {},
	});
	if (error) throw error;
	return data as AdminOverviewResponse;
}
