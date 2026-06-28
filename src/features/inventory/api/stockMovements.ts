import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type StockMovement =
	Database["public"]["Tables"]["stock_movements"]["Row"];
export type StockMovementReason =
	Database["public"]["Enums"]["stock_movement_reason"];

export interface ApplyStockMovementInput {
	materialId: string;
	delta: number;
	reason: StockMovementReason;
	note?: string | null;
	quoteId?: string | null;
}

export interface StockMovementLedgerFilters {
	reason?: StockMovementReason | null;
	materialId?: string | null;
	creatorId?: string | null;
	from?: string | null;
	to?: string | null;
	search?: string | null;
	limit?: number;
	offset?: number;
}

export type StockMovementLedgerRow =
	Database["public"]["Functions"]["get_stock_movement_ledger"]["Returns"][number];
export type StockMovementDetail =
	Database["public"]["Functions"]["get_stock_movement_detail"]["Returns"][number];

export interface ReverseStockMovementInput {
	movementId: string;
	reason: string;
	requestId?: string | null;
}

function normalizeExclusiveEndDate(
	value: string | null | undefined,
): string | null {
	if (!value) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

	const date = new Date(`${value}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString();
}

export async function fetchStockMovementLedger(
	filters: StockMovementLedgerFilters,
): Promise<StockMovementLedgerRow[]> {
	const { data, error } = await supabase.rpc("get_stock_movement_ledger", {
		p_reason: filters.reason ?? null,
		p_material_id: filters.materialId ?? null,
		p_creator_id: filters.creatorId ?? null,
		p_from: filters.from ?? null,
		p_to: normalizeExclusiveEndDate(filters.to),
		p_search: filters.search ?? null,
		p_limit: filters.limit ?? 50,
		p_offset: filters.offset ?? 0,
	});
	if (error) throw error;
	return (data as StockMovementLedgerRow[]) ?? [];
}

export async function fetchStockMovementDetail(
	movementId: string,
): Promise<StockMovementDetail | null> {
	const { data, error } = await supabase.rpc("get_stock_movement_detail", {
		p_movement_id: movementId,
	});
	if (error) throw error;
	return ((data as StockMovementDetail[] | null) ?? [])[0] ?? null;
}

export async function reverseStockMovement(
	input: ReverseStockMovementInput,
): Promise<string> {
	const { data, error } = await supabase.rpc("reverse_stock_movement", {
		p_movement_id: input.movementId,
		p_reversal_reason: input.reason,
		p_reversal_request_id: input.requestId ?? null,
	});
	if (error) throw error;
	return data as string;
}

export async function applyStockMovement(
	input: ApplyStockMovementInput,
): Promise<number> {
	const { data, error } = await supabase.rpc("apply_stock_movement", {
		p_material_id: input.materialId,
		p_delta: input.delta,
		p_reason: input.reason,
		p_note: input.note ?? null,
		p_quote_id: input.quoteId ?? null,
	});
	if (error) throw error;
	return data as number;
}

// Per-material history dialog cap. A high-usage material (e.g. MDF) can
// accumulate thousands of rows over months; without a cap the JSON
// payload and React render grow linearly and degrade p95 latency. The
// stock_movements_material_idx (material_id, created_at DESC) index
// supports this pagination key. Raise only after adding a 'see more'
// CTA in StockHistoryDialog.
const PER_MATERIAL_HISTORY_LIMIT = 200;

/**
 * Input for production deduction batch reversal.
 */
export interface ReverseProductionDeductionInput {
	deductionId: string;
	reversalReason: string;
	reversalRequestId?: string | null;
}

/**
 * Reverse an entire production deduction batch.
 *
 * @param deductionId - The production deduction batch id
 * @param reversalReason - Reason for the reversal
 * @param reversalRequestId - Optional idempotency token for safe retries
 */
export async function reverseProductionDeduction(
	input: ReverseProductionDeductionInput,
): Promise<{ id: string }> {
	const { data, error } = await supabase.rpc(
		"reverse_production_stock_deduction",
		{
			p_deduction_id: input.deductionId,
			p_reversal_reason: input.reversalReason,
			p_reversal_request_id: input.reversalRequestId ?? null,
		},
	);

	if (error) throw error;
	return { id: data as unknown as string };
}

export async function fetchStockMovements(
	materialId: string,
): Promise<StockMovement[]> {
	const { data, error } = await supabase
		.from("stock_movements")
		.select("*")
		.eq("material_id", materialId)
		.order("created_at", { ascending: false })
		.limit(PER_MATERIAL_HISTORY_LIMIT);
	if (error) throw error;
	return data ?? [];
}
