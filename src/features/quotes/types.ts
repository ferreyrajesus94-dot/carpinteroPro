import type { Database } from "@/shared/types/database";
import type { Client } from "@/shared/types/client";

export type {
	Client,
	ClientInsert,
	ClientUpdate,
	ClientSource,
} from "@/shared/types/client";
export { CLIENT_SOURCE_LABELS } from "@/shared/types/client";
export type { QuoteStatus, MarginMode } from "@/shared/types/quotes";
export {
	QUOTE_STATUS_LABELS,
	QUOTE_STATUS_COLORS,
	QUOTE_STATUS_HEX_COLORS,
} from "@/shared/types/quotes";

export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
export type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];
export type QuoteExtra = Database["public"]["Tables"]["quote_extras"]["Row"];
export type QuoteExtraInsert =
	Database["public"]["Tables"]["quote_extras"]["Insert"];

export type ContractTemplate =
	Database["public"]["Tables"]["contract_templates"]["Row"];
export type ContractTemplateInsert =
	Database["public"]["Tables"]["contract_templates"]["Insert"];
export type ContractTemplateUpdate =
	Database["public"]["Tables"]["contract_templates"]["Update"];

export type QuoteRecipeSnapshot =
	Database["public"]["Tables"]["quote_recipe_snapshots"]["Row"];
export type QuoteRecipeSnapshotInsert =
	Database["public"]["Tables"]["quote_recipe_snapshots"]["Insert"];
export type QuoteLaborSnapshot =
	Database["public"]["Tables"]["quote_labor_snapshots"]["Row"];
export type QuoteLaborSnapshotInsert =
	Database["public"]["Tables"]["quote_labor_snapshots"]["Insert"];

export type ApprovedBomLine =
	Database["public"]["Tables"]["quote_approved_bom_lines"]["Row"];

// Quote completo con cliente y extras (viene del JOIN en la API)
export type QuoteWithExtras = Quote & {
	extras: QuoteExtra[];
	client: Client | null;
	recipe_snapshots?: QuoteRecipeSnapshot[];
	labor_snapshots?: QuoteLaborSnapshot[];
};

// Form shape for QuoteForm — used by QuoteExtrasFieldArray and QuoteLivePreview
export interface QuoteFormValues {
	client_id?: string;
	furniture_template_id?: string;
	furniture_name: string;
	recipe_cost: number;
	extras: { description: string; amount: number; show_in_quote: boolean }[];
	margin_mode: "on_cost" | "on_price";
	margin_pct: number;
	status:
		| "presupuesto"
		| "enviado"
		| "aprobado"
		| "en_produccion"
		| "entregado"
		| "cancelado";
	notes?: string;
}
