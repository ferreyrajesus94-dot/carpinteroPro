import { supabase } from "@/shared/lib/supabase";
import type { ApprovedBomLine } from "../types";

/**
 * Capture the approved BOM for a quote.
 * Reads the quote's recipe snapshots and current recipe/cut-piece data,
 * then inserts immutable approved BOM lines into quote_approved_bom_lines.
 * Safe to call multiple times (replaces previous lines for the same quote).
 * Throws on cross-workspace access, quote-not-found, or non-aprobado status.
 */
export async function captureApprovedBom(quoteId: string): Promise<void> {
	const { error } = await supabase.rpc("capture_quote_approved_bom", {
		p_quote_id: quoteId,
	});
	if (error) throw error;
}

/**
 * Fetch the approved BOM lines for a quote.
 */
export async function fetchApprovedBomLines(
	quoteId: string,
): Promise<ApprovedBomLine[]> {
	const { data, error } = await supabase
		.from("quote_approved_bom_lines")
		.select("*")
		.eq("quote_id", quoteId)
		.order("line_number", { ascending: true });

	if (error) throw error;
	return data ?? [];
}
