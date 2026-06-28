import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProductionDeductionPreviewRow } from "../api/productionStockDeduction";
import {
	fetchProductionDeductionPreview,
	startQuoteProduction,
	reverseProductionDeduction,
} from "../api/productionStockDeduction";

const PRODUCTION_DEDUCTION_KEY = "production_deduction";

/**
 * Fetch a read-only preview of material consumption for a production start.
 */
export function useProductionDeductionPreview(quoteId: string | null): {
	data: ProductionDeductionPreviewRow[] | undefined;
	isLoading: boolean;
	isError: boolean;
} {
	return useQuery({
		queryKey: [PRODUCTION_DEDUCTION_KEY, "preview", quoteId],
		queryFn: () => fetchProductionDeductionPreview(quoteId!),
		enabled: Boolean(quoteId),
	});
}

/**
 * Start production for an approved quote.
 * Generates a request_id internally for idempotent retry.
 */
export function useStartQuoteProduction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			quoteId,
			confirmDeduction,
			requestId,
		}: {
			quoteId: string;
			confirmDeduction: boolean;
			requestId?: string;
		}) =>
			startQuoteProduction(
				quoteId,
				confirmDeduction,
				requestId ?? crypto.randomUUID(),
			),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: [PRODUCTION_DEDUCTION_KEY, "preview", variables.quoteId],
			});
			queryClient.invalidateQueries({ queryKey: ["quotes"] });
			toast.success(
				`Producción iniciada${_data.movements_created > 0 ? ` — ${_data.movements_created} movimiento(s) de stock creado(s)` : " — sin descuento automático"}`,
			);
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

/**
 * Reverse a production deduction batch.
 * Generates a reversal_request_id internally for idempotency.
 */
export function useReverseProductionDeduction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			deductionId,
			reversalReason,
			reversalRequestId,
		}: {
			deductionId: string;
			reversalReason: string;
			reversalRequestId?: string;
		}) =>
			reverseProductionDeduction(
				deductionId,
				reversalReason,
				reversalRequestId ?? crypto.randomUUID(),
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [PRODUCTION_DEDUCTION_KEY] });
			queryClient.invalidateQueries({ queryKey: ["quotes"] });
			toast.success("Descuento de producción revertido");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
