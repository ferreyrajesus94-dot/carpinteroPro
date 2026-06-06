import { supabase } from "@/shared/lib/supabase";
import type { PriceHistoryRow } from "@/shared/types/priceHistory";

export type { PriceHistoryRow } from "@/shared/types/priceHistory";

export async function fetchAllPriceHistory(
	workshopId: string,
	days = 90,
): Promise<PriceHistoryRow[]> {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
	const { data, error } = await supabase
		.from("price_history")
		.select("*")
		.eq("workshop_id", workshopId)
		.gte("changed_at", since)
		.order("changed_at", { ascending: true });
	if (error) throw error;
	return data ?? [];
}
