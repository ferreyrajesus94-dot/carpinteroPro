import { supabase } from "@/shared/lib/supabase";

/**
 * Preview type returned by get_quote_production_deduction_preview RPC.
 */
export interface ProductionDeductionPreviewRow {
	line_number: number;
	material_id: string | null;
	material_name: string;
	material_unit: string;
	material_category: string;
	deduction_quantity: number | null;
	current_stock: number | null;
	projected_stock: number | null;
	shortage_amount: number | null;
	is_complete: boolean;
	warning_code: string | null;
	existing_batch_id: string | null;
	existing_batch_status: string | null;
}

/**
 * Result type returned by start_quote_production RPC.
 */
export interface StartProductionResult {
	batch_id: string | null;
	status: string;
	movements_created: number;
	lines_skipped: number;
	shortage_detected: boolean;
	snapshot_incomplete: boolean;
	warning_summary: unknown[];
	note?: string;
}

/**
 * Fetch a read-only preview of material consumption for a production start.
 * Creates no movements and updates no status.
 */
export async function fetchProductionDeductionPreview(
	quoteId: string,
): Promise<ProductionDeductionPreviewRow[]> {
	const { data, error } = await supabase.rpc(
		"get_quote_production_deduction_preview",
		{ p_quote_id: quoteId },
	);

	if (error) throw error;
	return (data ?? []) as ProductionDeductionPreviewRow[];
}

/**
 * Start production for an approved quote.
 *
 * @param quoteId - The quote to start production for
 * @param confirmDeduction - Whether to confirm automatic stock deduction (required when auto_discount is on)
 * @param requestId - Optional idempotency token for safe retries
 */
export async function startQuoteProduction(
	quoteId: string,
	confirmDeduction: boolean,
	requestId?: string,
): Promise<StartProductionResult> {
	const { data, error } = await supabase.rpc("start_quote_production", {
		p_quote_id: quoteId,
		p_confirm_deduction: confirmDeduction,
		p_request_id: requestId,
	});

	if (error) throw error;
	return data as unknown as StartProductionResult;
}

/**
 * Reverse an entire production deduction batch.
 *
 * @param deductionId - The production deduction batch id
 * @param reversalReason - Reason for the reversal
 * @param reversalRequestId - Optional idempotency token for safe retries
 */
export async function reverseProductionDeduction(
	deductionId: string,
	reversalReason: string,
	reversalRequestId?: string,
): Promise<{ id: string }> {
	const { data, error } = await supabase.rpc(
		"reverse_production_stock_deduction",
		{
			p_deduction_id: deductionId,
			p_reversal_reason: reversalReason,
			p_reversal_request_id: reversalRequestId,
		},
	);

	if (error) throw error;
	return { id: data as unknown as string };
}
