import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	applyStockMovement,
	fetchStockMovements,
	fetchStockMovementLedger,
	fetchStockMovementDetail,
	reverseStockMovement,
	type ApplyStockMovementInput,
	type ReverseStockMovementInput,
	type StockMovementLedgerFilters,
} from "../api/stockMovements";

const STOCK_MOVEMENTS_KEY = "stock_movements";
const STOCK_MOVEMENT_LEDGER_KEY = [STOCK_MOVEMENTS_KEY, "ledger"] as const;
const STOCK_MOVEMENT_DETAIL_KEY = [STOCK_MOVEMENTS_KEY, "detail"] as const;
const MATERIALS_KEY = "materials";

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
	});
}

export function useStockMovementDetail(movementId: string | null) {
	return useQuery({
		queryKey: [...STOCK_MOVEMENT_DETAIL_KEY, movementId],
		queryFn: () => fetchStockMovementDetail(movementId!),
		enabled: Boolean(movementId),
	});
}

export interface ReverseStockMovementMutationInput
	extends ReverseStockMovementInput {
	materialId: string;
}

export function useReverseStockMovement(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ReverseStockMovementMutationInput) =>
			reverseStockMovement({
				movementId: input.movementId,
				reason: input.reason,
				requestId: input.requestId,
			}),
		onSuccess: (_reversalMovementId, input) => {
			queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] });
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

export function useApplyStockMovement(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ApplyStockMovementInput) => applyStockMovement(input),
		onSuccess: (_newStock, input) => {
			queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] });
			queryClient.invalidateQueries({
				queryKey: [STOCK_MOVEMENTS_KEY, input.materialId],
			});
			queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENT_LEDGER_KEY });
			toast.success("Stock ajustado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
