import { supabase } from "@/shared/lib/supabase";
import type { AdminSubscriptionsResponse } from "../types";

export async function fetchAdminSubscriptions(
	status?: string,
): Promise<AdminSubscriptionsResponse> {
	const { data, error } = await supabase.functions.invoke(
		"admin-subscriptions",
		{
			body: status ? { status } : {},
		},
	);
	if (error) throw error;
	return data as AdminSubscriptionsResponse;
}
