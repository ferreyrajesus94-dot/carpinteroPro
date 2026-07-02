import { useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface StartProductionOrderInput {
	quoteId: string;
	productionNumber: string;
}

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
	 * path is intentionally NOT triggered here.
	 */
	onSuccess?: () => void;
	/** Injected production start action from the app seam. */
	startProductionOrder: (input: StartProductionOrderInput) => Promise<unknown>;
}

export function QuoteActions({
	quoteId,
	productionNumber: initialProductionNumber,
	onSuccess,
	startProductionOrder,
}: QuoteActionsProps) {
	const [typedProductionNumber, setTypedProductionNumber] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	const inputId = useId();

	// The sent value is the prop when provided, else the typed value.
	const productionNumberToSend =
		initialProductionNumber ?? typedProductionNumber.trim();
	const isProductionNumberReady = productionNumberToSend.length > 0;

	async function handleStart() {
		if (!isProductionNumberReady || isPending) return;
		setSubmitError(null);
		setIsPending(true);
		try {
			await startProductionOrder({
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
		} finally {
			setIsPending(false);
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
