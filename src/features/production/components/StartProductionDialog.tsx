import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { useStartProductionOrder } from "../hooks/useProductionOrders";
import type { QuoteWithProductionStatus } from "../api/productionOrders";

/**
 * Form-state shape for the start-production dialog. The form fields
 * mirror the typed input of the `start_production_order` RPC: required
 * `productionNumber`, optional `plannedStartDate` / `plannedEndDate` /
 * `notes`. Optional fields are stored as the empty string in the form
 * and converted to `null` on submit, matching the RPC contract (the
 * SQL `start_production_order` accepts NULL for these columns).
 */
interface StartProductionFormState {
	productionNumber: string;
	plannedStartDate: string;
	plannedEndDate: string;
	notes: string;
}

const EMPTY_FORM: StartProductionFormState = {
	productionNumber: "",
	plannedStartDate: "",
	plannedEndDate: "",
	notes: "",
};

function toNullable(value: string): string | null {
	return value.trim() === "" ? null : value;
}

export interface StartProductionDialogProps {
	/** The approved quote that this production order is being started for. */
	quote: QuoteWithProductionStatus;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Dialog that drives the new `start_production_order` RPC. PR 6 ships
 * this dialog alongside the production board so that workshop users
 * can start a new production order from a board-mounted quote picker.
 *
 * Behaviour contract:
 * - On confirm: calls `useStartProductionOrder` with the form payload.
 *   On success: closes the dialog. On error: stays open and lets the
 *   mutation's `onError` handler toast the error (the dialog never
 *   swallows an error).
 * - On cancel: closes the dialog and never calls the mutation.
 * - The form resets every time the dialog is re-opened for a different
 *   quote: the host (`routes.tsx`) passes `key={quote.id}` to the
 *   dialog so React remounts the form with a clean state.
 */
export function StartProductionDialog({
	quote,
	open,
	onOpenChange,
}: StartProductionDialogProps) {
	const [form, setForm] = useState<StartProductionFormState>(EMPTY_FORM);
	const startMutation = useStartProductionOrder();

	const isProductionNumberEmpty = form.productionNumber.trim() === "";

	async function handleConfirm() {
		if (isProductionNumberEmpty) return;
		try {
			await startMutation.mutateAsync({
				quoteId: quote.id,
				productionNumber: form.productionNumber.trim(),
				plannedStartDate: toNullable(form.plannedStartDate),
				plannedEndDate: toNullable(form.plannedEndDate),
				notes: toNullable(form.notes),
			});
			onOpenChange(false);
		} catch {
			// Error is toasted by the mutation's onError handler. The
			// dialog stays open so the user can correct the input and
			// retry — never swallow a failure here.
		}
	}

	function handleCancel() {
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						Iniciar producción — {quote.quote_number} · {quote.furniture_name}
					</DialogTitle>
					<DialogDescription>
						Creá la orden de producción en estado "Planificado". Después
						podés iniciarla desde el tablero.
					</DialogDescription>
				</DialogHeader>

				<form
					className="grid gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						void handleConfirm();
					}}
				>
					<div className="grid gap-2">
						<Label htmlFor="production-number">Número de orden</Label>
						<Input
							id="production-number"
							name="productionNumber"
							value={form.productionNumber}
							onChange={(e) =>
								setForm((f) => ({ ...f, productionNumber: e.target.value }))
							}
							placeholder="OP-2026-0042"
							required
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="planned-start-date">Inicio planificado</Label>
							<Input
								id="planned-start-date"
								name="plannedStartDate"
								type="date"
								value={form.plannedStartDate}
								onChange={(e) =>
									setForm((f) => ({ ...f, plannedStartDate: e.target.value }))
								}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="planned-end-date">Fin planificado</Label>
							<Input
								id="planned-end-date"
								name="plannedEndDate"
								type="date"
								value={form.plannedEndDate}
								onChange={(e) =>
									setForm((f) => ({ ...f, plannedEndDate: e.target.value }))
								}
							/>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="production-notes">Notas</Label>
						<Textarea
							id="production-notes"
							name="notes"
							value={form.notes}
							onChange={(e) =>
								setForm((f) => ({ ...f, notes: e.target.value }))
							}
							placeholder="Indicaciones para el taller (opcional)"
							rows={3}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleCancel}
							disabled={startMutation.isPending}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={isProductionNumberEmpty || startMutation.isPending}
						>
							{startMutation.isPending ? "Iniciando..." : "Confirmar"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
