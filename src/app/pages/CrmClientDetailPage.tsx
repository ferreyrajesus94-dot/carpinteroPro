import { useParams } from "react-router-dom";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useQuotes } from "@/features/quotes";
import { QuoteStatusBadge } from "@/features/quotes";
import { calculateQuote } from "@/shared/lib/quotesCalculator";
import { ClientDetail } from "@/features/crm";
import type { QuoteStatus } from "@/shared/types/quotes";

export function CrmClientDetailPage() {
	const { id } = useParams<{ id: string }>();
	const workshopId = useWorkshopId();
	const { data: quotes = [], isLoading: isQuotesLoading } =
		useQuotes(workshopId);

	// Pre-compute per-client stats (total, count)
	const statsByClient = quotes.reduce<
		Record<string, { count: number; total: number }>
	>((acc, q) => {
		if (!q.client_id) return acc;
		if (!acc[q.client_id]) acc[q.client_id] = { count: 0, total: 0 };
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
		return acc;
	}, {});

	// Pre-compute quote display data with sale prices
	const quotesWithSalePrice = quotes
		.filter((q) => q.client_id === id)
		.toSorted((a, b) => (a.created_at < b.created_at ? 1 : -1))
		.map((q) => {
			const { salePrice } = calculateQuote({
				recipeCost: q.recipe_cost,
				extras: q.extras.map((e) => ({
					amount: e.amount,
					show_in_quote: e.show_in_quote,
				})),
				marginMode: q.margin_mode,
				marginPct: q.margin_pct,
			});
			return {
				id: q.id,
				quote_number: q.quote_number,
				furniture_name: q.furniture_name,
				status: q.status as QuoteStatus,
				salePrice,
				created_at: q.created_at,
			};
		});

	return (
		<ClientDetail
			quotesWithSalePrice={quotesWithSalePrice}
			statsByClient={statsByClient}
			isQuotesLoading={isQuotesLoading}
			QuoteStatusBadgeSlot={QuoteStatusBadge}
		/>
	);
}
