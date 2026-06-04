import type { MarginMode, QuoteStatus } from "@/shared/types/quotes";

export interface DashboardQuoteExtra {
	amount: number;
	show_in_quote: boolean;
}

export interface DashboardQuoteClient {
	name: string;
}

export interface DashboardQuote {
	id: string;
	quote_number: string;
	furniture_name: string;
	recipe_cost: number;
	margin_mode: MarginMode;
	margin_pct: number;
	status: QuoteStatus;
	created_at: string;
	extras: DashboardQuoteExtra[];
	client: DashboardQuoteClient | null;
}

export interface DashboardMaterial {
	id: string;
	name: string;
	stock: number;
	min_stock: number;
}
