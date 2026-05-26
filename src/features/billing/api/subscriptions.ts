import { supabase } from "@/shared/lib/supabase";
import type { SubscriptionRow } from "@/features/billing/types";

export async function fetchSubscription(
	workshopId: string,
): Promise<SubscriptionRow | null> {
	const { data, error } = await supabase
		.from("subscriptions")
		.select("*")
		.eq("workshop_id", workshopId)
		.single();

	if (error) {
		if (error.code === "PGRST116") {
			// no rows returned
			return null;
		}
		throw error;
	}

	return data as SubscriptionRow;
}
