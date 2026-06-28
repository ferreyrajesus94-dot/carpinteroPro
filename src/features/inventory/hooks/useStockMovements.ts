import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	applyStockMovement,
	fetchStockMovements,
	fetchStockMovementLedger,
	fetchStockMovementDetail,
	reverseProductionDeduction,
	reverseStockMovement,
	type ApplyStockMovementInput,
	type ReverseProductionDeductionInput,
	type ReverseStockMovementInput,
	type StockMovementLedgerFilters,
} from "../api/stockMovements";

const STOCK_MOVEMENTS_KEY = "stock_movements";
const STOCK_MOVEMENT_LEDGER_KEY = [STOCK_MOVEMENTS_KEY, "ledger"] as const;
const STOCK_MOVEMENT_DETAIL_KEY = [STOCK_MOVEMENTS_KEY, "detail"] as const;

function generateRequestId(): string {
	// Browser crypto is the standard source; the global is typed loosely.
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	// Fallback for jsdom + older test envs: 32 hex chars from Math.random.
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function useStockMovements(materialId: string | null) {
	return useQuery({
		queryKey: [STOCK_MOVEMENTS_KEY, materialId],
		queryFn: () => fetchStockMovements(materialId!),
		enabled: Boolean(materialId),
	});
}

export function useStockMovementLedger(
	filters: StockMovementLedgerFilters,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: [...STOCK_MOVEMENT_LEDGER_KEY, filters],
		queryFn: () => fetchStockMovementLedger(filters),
		enabled: options?.enabled ?? true,
		staleTime: 30_000,
	});
}

export function useStockMovementDetail(movementId: string | null) {
	return useQuery({
		queryKey: [...STOCK_MOVEMENT_DETAIL_KEY, movementId],
		queryFn: () => fetchStockMovementDetail(movementId!),
		enabled: Boolean(movementId),
		staleTime: 30_000,
	});
}

export interface ReverseStockMovementMutationInput
	extends Omit<ReverseStockMovementInput, "requestId"> {
	materialId: string;
	// Optional caller-supplied request id for cross-process idempotency.
	// If omitted, the hook generates a fresh UUID per mutate() call.
	requestId?: string;
}

export function useReverseStockMovement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ReverseStockMovementMutationInput) =>
			reverseStockMovement({
				movementId: input.movementId,
				reason: input.reason,
				requestId: input.requestId ?? generateRequestId(),
			}),
		onSuccess: (_reversalMovementId, input) => {
			// Invalidate the per-material history and the ledger; the caller
			// is responsible for invalidating any ['materials', workshopId]
			// query if it cares about updated stock.
			queryClient.invalidateQueries({
				queryKey: [STOCK_MOVEMENTS_KEY, input.materialId],
			});
			queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENT_LEDGER_KEY });
			queryClient.invalidateQueries({
				queryKey: [...STOCK_MOVEMENT_DETAIL_KEY, input.movementId],
			});
			toast.success("Movimiento revertido");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

/**
 * Reverse an entire production deduction batch.
 * Generates a reversal_request_id internally for idempotency.
 */
export function useReverseProductionDeduction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ReverseProductionDeductionInput) =>
			reverseProductionDeduction({
				deductionId: input.deductionId,
				reversalReason: input.reversalReason,
				reversalRequestId: input.reversalRequestId ?? generateRequestId(),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [STOCK_MOVEMENTS_KEY, "ledger"],
			});
			queryClient.invalidateQueries({
				queryKey: [STOCK_MOVEMENTS_KEY, "detail"],
			});
			toast.success("Lote de producción revertido");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

export function useApplyStockMovement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ApplyStockMovementInput) => applyStockMovement(input),
		onSuccess: (_newStock, input) => {
			queryClient.invalidateQueries({
				queryKey: [STOCK_MOVEMENTS_KEY, input.materialId],
			});
			queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENT_LEDGER_KEY });
			toast.success("Stock ajustado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
