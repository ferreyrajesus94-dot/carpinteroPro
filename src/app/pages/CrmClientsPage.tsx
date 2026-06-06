import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useQuotes } from "@/features/quotes";
import { calculateQuote } from "@/shared/lib/quotesCalculator";
import { ClientList } from "@/features/crm";

export function CrmClientsPage() {
	const workshopId = useWorkshopId();
	const { data: quotes = [] } = useQuotes(workshopId);

	// Pre-compute per-client quote stats: count, total, lastDate
	const statsByClient = quotes.reduce<
		Record<string, { count: number; total: number; lastDate: string }>
	>((acc, q) => {
		if (!q.client_id) return acc;
		if (!acc[q.client_id])
			acc[q.client_id] = { count: 0, total: 0, lastDate: "" };
		const { salePrice } = calculateQuote({
			recipeCost: q.recipe_cost,
			extras: q.extras.map((e) => ({
				amount: e.amount,
				show_in_quote: e.show_in_quote,
			})),
			marginMode: q.margin_mode,
			marginPct: q.margin_pct,
		});
		acc[q.client_id].count += 1;
		acc[q.client_id].total += salePrice;
		if (
			!acc[q.client_id].lastDate ||
			q.created_at > acc[q.client_id].lastDate
		) {
			acc[q.client_id].lastDate = q.created_at;
		}
		return acc;
	}, {});

	return <ClientList statsByClient={statsByClient} />;
}
