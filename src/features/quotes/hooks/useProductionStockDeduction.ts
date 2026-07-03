import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProductionDeductionPreviewRow } from "../api/productionStockDeduction";
import {
	fetchProductionDeductionPreview,
	startQuoteProduction,
	reverseProductionDeduction,
} from "../api/productionStockDeduction";

const PRODUCTION_DEDUCTION_KEY = "production_deduction";

// PR 9: one-time-per-session deprecation marker for the legacy
// `useStartQuoteProduction` hook. The legacy `start_quote_production` SQL
// RPC is now a thin wrapper around `start_production_order` (the new flow
// that owns production order creation and the deduction FK); the
// frontend hook that calls it is preserved for the migration window but
// emits a one-time console.warn instructing callers to migrate to
// `useStartProductionOrder` from `@/features/production`.
//
// The marker is stored on `globalThis` so it survives `vi.resetModules()`
// in test runs and React Fast Refresh in dev — both of which would
// reset a module-level `let` to its initial value. A `globalThis` flag
// is the standard "session-scoped" pattern in browser JavaScript and is
// safe to use here because the warning is purely informational (no
// behavioral side effect).
declare global {
	var __carpinteroProLegacyStartQuoteWarned: boolean | undefined;
}

function emitLegacyStartQuoteWarning(): void {
	if (globalThis.__carpinteroProLegacyStartQuoteWarned) return;
	globalThis.__carpinteroProLegacyStartQuoteWarned = true;
	console.warn(
		"[carpinteroPro] useStartQuoteProduction is deprecated. " +
			"Use useStartProductionOrder from @/features/production instead. " +
			"The legacy wrapper is preserved for one more release to give external integrations time to migrate.",
	);
}

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
 *
 * PR 9: this hook is deprecated. The legacy `start_quote_production` SQL
 * RPC is now a thin wrapper around `start_production_order` (the new
 * flow). The hook is preserved for the migration window so existing
 * callers (e.g. `ProductionStartReviewDialog`) keep working, but it
 * emits a one-time-per-session `console.warn` instructing callers to
 * migrate to `useStartProductionOrder` from `@/features/production`.
 */
export function useStartQuoteProduction() {
	emitLegacyStartQuoteWarning();
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

			// Differentiate idempotent return (batch already exists) vs fresh start
			if (_data.note?.includes("batch already exists")) {
				toast.success(
					"Producción ya iniciada — no se crearon nuevos movimientos",
				);
			} else if (_data.movements_created > 0) {
				toast.success(
					`Producción iniciada — ${_data.movements_created} movimiento(s) de stock creado(s)`,
				);
			} else {
				toast.success("Producción iniciada — sin descuento automático");
			}
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
