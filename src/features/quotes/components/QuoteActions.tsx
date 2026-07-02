import { useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useStartProductionOrder } from "@/features/production";

export interface QuoteActionsProps {
	/** The quote id the production order is being started for. */
	quoteId: string;
	/**
	 * Optional pre-assigned production number (e.g. the dashboard's
	 * `QuoteWithProductionStatus` row carries the assigned number after
	 * a future start-from-board flow). When provided, the input is
	 * hidden and this value is sent verbatim. When omitted, the user
	 * types the production number into a visible input before clicking
	 * the action.
	 */
	productionNumber?: string;
	/**
	 * Invoked after a successful start. The legacy stock-deduction
	 * path is intentionally NOT triggered here; that flow lives in
	 * `ProductionStartReviewDialog` and is scheduled for deprecation
	 * in PR 9.
	 */
	onSuccess?: () => void;
}

/**
 * QuoteActions — the canonical "Iniciar producción" entry point that
 * flows through the production-order state machine (PR 5+).
 *
 * The component delegates to `useStartProductionOrder` from the
 * production feature barrel. The legacy `useUpdateQuote` /
 * `useUpdateQuoteStatus` quote-status hooks (which guard against direct
 * `en_produccion` writes at the application layer, see PR 6) are
 * intentionally NOT imported here — the four-layer guard stays in
 * place, and the only sanctioned way to enter `en_produccion` on a
 * quote is via the production feature's start flow.
 *
 * Usage:
 * - `QuoteActions` is mounted wherever a quote row needs a quick
 *   "Iniciar producción" button (e.g. the active-quotes panel,
 *   the production board, or any future quote table). The dashboard
 *   widget is the first consumer in PR 8.
 * - The component renders either:
 *   1. A pre-assigned production number (button-only, no input) when
 *      `productionNumber` is provided at construction time, OR
 *   2. A small text input + button when the user must type the
 *      production number themselves.
 */
export function QuoteActions({
	quoteId,
	productionNumber: initialProductionNumber,
	onSuccess,
}: QuoteActionsProps) {
	const startMutation = useStartProductionOrder();
	const [typedProductionNumber, setTypedProductionNumber] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);

	// PR 8 review-blocker fix #5: the input's id and the
	// associated <label htmlFor> use React 19's `useId()` so
	// multiple QuoteActions on the same page (a future quote
	// table, e.g.) have stable, per-instance, collision-free
	// ids. The previous hard-coded
	// `id="quote-actions-production-number"` would collide on
	// the second instance (invalid HTML; breaks the implicit
	// <label htmlFor> association for screen readers).
	const inputId = useId();

	// The sent value is the prop when provided, else the typed value.
	const productionNumberToSend =
		initialProductionNumber ?? typedProductionNumber.trim();
	const isProductionNumberReady = productionNumberToSend.length > 0;
	const isPending = startMutation.isPending;

	async function handleStart() {
		if (!isProductionNumberReady) return;
		setSubmitError(null);
		try {
			await startMutation.mutateAsync({
				quoteId,
				productionNumber: productionNumberToSend,
			});
			onSuccess?.();
		} catch (err) {
			setSubmitError(
				err instanceof Error
					? err.message
					: "No se pudo iniciar la producción. Reintentá.",
			);
		}
	}

	return (
		<div
			data-testid="quote-actions"
			className="flex flex-col gap-2 sm:flex-row sm:items-end"
		>
			{initialProductionNumber === undefined && (
				<div className="flex-1 min-w-0">
					<Label htmlFor={inputId} className="sr-only">
						Número de orden de producción
					</Label>
					<Input
						id={inputId}
						name="productionNumber"
						value={typedProductionNumber}
						onChange={(e) => setTypedProductionNumber(e.target.value)}
						placeholder="OP-2026-0042"
						disabled={isPending}
					/>
				</div>
			)}
			<Button
				type="button"
				onClick={() => {
					void handleStart();
				}}
				disabled={!isProductionNumberReady || isPending}
				data-testid="quote-actions-start"
			>
				{isPending ? "Iniciando..." : "Iniciar producción"}
			</Button>
			{submitError && (
				<p
					role="alert"
					data-testid="quote-actions-error"
					className="text-xs text-destructive sm:basis-full"
				>
					{submitError}
				</p>
			)}
		</div>
	);
}
