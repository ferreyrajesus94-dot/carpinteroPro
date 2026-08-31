import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useQuotes } from "@/features/quotes";
import { QuoteStatusBadge } from "@/features/quotes";
import { useProductionOrders } from "@/features/production/hooks/useProductionOrders";
import {
	PRODUCTION_ORDER_STATE,
	PRODUCTION_ORDER_STATE_LABELS,
	type ProductionOrderState,
} from "@/features/production/api/types";
import { calculateQuote } from "@/shared/lib/quotesCalculator";
import { ClientDetail } from "@/features/crm";
import type { ClientProductionOrderItem } from "@/features/crm/components/ClientProductionSection";
import type { QuoteStatus } from "@/shared/types/quotes";

/**
 * App-owned page for the per-client detail view. This is the seam
 * where data from the CRM, quotes, and production features is
 * composed into a single view; the per-feature components stay
 * inside their own zones.
 */
export function CrmClientDetailPage() {
	const { id } = useParams<{ id: string }>();
	const workshopId = useWorkshopId();
	const { data: quotes = [], isLoading: isQuotesLoading } =
		useQuotes(workshopId);
	const { data: productionOrders = [], isLoading: isProductionLoading } =
		useProductionOrders({});

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

	// Filter the workshop-wide production orders down to the ones
	// whose quote belongs to the current client and pre-compute the
	// minimal shape the CRM section needs. The app layer is the only
	// place that may compose data from multiple features; the CRM
	// section then stays free of cross-feature imports.
	const clientProductionOrders = useMemo<ClientProductionOrderItem[]>(
		() => {
			if (quotesWithSalePrice.length === 0) return [];
			const quoteIdSet = new Set(quotesWithSalePrice.map((q) => q.id));
			return productionOrders
				.filter((o) => quoteIdSet.has(o.quote_id))
				.toSorted((a, b) =>
					(b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
				)
				.map((o) => {
					const state = o.state as ProductionOrderState;
					return {
						id: o.id,
						productionNumber: o.production_number,
						quoteFurnitureName: o.quote_furniture_name,
						state: o.state,
						stateLabel:
							PRODUCTION_ORDER_STATE_LABELS[state] ?? String(o.state),
						isTerminal:
							state === PRODUCTION_ORDER_STATE.DELIVERED ||
							state === PRODUCTION_ORDER_STATE.CANCELLED,
					};
				});
		},
		[productionOrders, quotesWithSalePrice],
	);

	return (
		<ClientDetail
			quotesWithSalePrice={quotesWithSalePrice}
			statsByClient={statsByClient}
			isQuotesLoading={isQuotesLoading}
			QuoteStatusBadgeSlot={QuoteStatusBadge}
			clientProductionOrders={clientProductionOrders}
			isProductionLoading={isProductionLoading}
		/>
	);
}