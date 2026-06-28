import { useState } from "react";
import { Link } from "react-router-dom";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { LoadingState, ErrorState } from "@/shared/ui/feedback-state";
import {
	useProductionDeductionPreview,
	useStartQuoteProduction,
} from "../hooks/useProductionStockDeduction";
import { useCaptureApprovedBom } from "../hooks/useApprovedBom";
import { useQueryClient } from "@tanstack/react-query";
import type { StartProductionResult } from "../api/productionStockDeduction";

export interface ProductionStartReviewDialogProps {
	quoteId: string;
	quoteNumber: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	autoStockDiscount?: boolean;
	onSuccess?: () => void;
}

/**
 * Review/confirmation dialog for starting production on an approved quote.
 *
 * Shows a preview of materials to be deducted, shortage/incomplete warnings,
 * provides confirm/cancel actions, and handles recovery paths:
 * - Reversed batch: shows state and allows re-starting production
 * - Missing approved BOM: offers "Recapturar BOM" action
 */
export function ProductionStartReviewDialog({
	quoteId,
	quoteNumber,
	open,
	onOpenChange,
	autoStockDiscount = true,
	onSuccess,
}: ProductionStartReviewDialogProps) {
	const queryClient = useQueryClient();
	const {
		data: previewRows,
		isLoading,
		isError,
	} = useProductionDeductionPreview(open ? quoteId : null);
	const startMutation = useStartQuoteProduction();
	const recaptureMutation = useCaptureApprovedBom();
	const [requestId] = useState(() => crypto.randomUUID());
	const [result, setResult] = useState<StartProductionResult | null>(null);

	// Derived state
	const existingBatch = previewRows?.[0] ?? null;
	const existingBatchId = existingBatch?.existing_batch_id ?? null;
	const existingBatchStatus = existingBatch?.existing_batch_status ?? null;
	const isExistingActive =
		existingBatchId != null && existingBatchStatus !== "reversed";
	const isExistingReversed =
		existingBatchId != null && existingBatchStatus === "reversed";

	const hasShortage =
		previewRows?.some((r) => (r.shortage_amount ?? 0) > 0) ?? false;
	const hasIncomplete = previewRows?.some((r) => !r.is_complete) ?? false;
	const hasNoBom =
		previewRows?.some((r) => r.warning_code === "no_approved_bom") ?? false;
	const shortageCount =
		previewRows?.filter((r) => (r.shortage_amount ?? 0) > 0).length ?? 0;
	const incompleteCount =
		previewRows?.filter((r) => !r.is_complete).length ?? 0;

	const isRecapturing = recaptureMutation.isPending;

	const handleConfirm = async () => {
		try {
			const res = await startMutation.mutateAsync({
				quoteId,
				confirmDeduction: autoStockDiscount,
				requestId,
			});
			setResult(res);
			onSuccess?.();
		} catch {
			// Error toast is handled by the mutation's onError
		}
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	const handleRecaptureBom = async () => {
		try {
			await recaptureMutation.mutateAsync(quoteId);
			// Refetch preview after recapture
			queryClient.invalidateQueries({
				queryKey: ["production_deduction", "preview", quoteId],
			});
		} catch {
			// Error toast handled by mutation's onError
		}
	};

	// Determine if the confirm button should be shown
	const canConfirm = !result && !isExistingActive;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Iniciar producción — {quoteNumber}</DialogTitle>
					<DialogDescription>
						Revisá los materiales a consumir antes de confirmar.
					</DialogDescription>
				</DialogHeader>

				{isLoading && <LoadingState label="Cargando vista previa..." />}

				{isError && (
					<ErrorState
						title="Error al cargar"
						description="No se pudo obtener la información del presupuesto."
					/>
				)}

				{result && (
					<div className="space-y-3 py-2">
						<div className="rounded-lg bg-cp-accent/10 border border-cp-accent/30 p-4">
							<p className="font-semibold text-sm">
								{result.note && result.note.includes("batch already exists")
									? "Producción ya iniciada"
									: "Producción iniciada"}
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								{result.note && result.note.includes("batch already exists")
									? "Ya existe un lote de descuento activo para este presupuesto. No se crearon nuevos movimientos."
									: result.movements_created > 0
										? `${result.movements_created} movimiento(s) de stock creado(s).`
										: "Sin descuento automático de stock."}
							</p>
							{result.lines_skipped > 0 && (
								<p className="text-xs text-amber-600 mt-1">
									{result.lines_skipped} línea(s) omitidas por datos
									incompletos.
								</p>
							)}
						</div>

						{result.shortage_detected && (
							<p className="text-xs text-destructive font-medium">
								Hay materiales con stock insuficiente. Revisá el movimiento de
								stock para más detalles.
							</p>
						)}

						<DialogFooter>
							<Button variant="outline" asChild>
								<Link to="/inventory/movements">Ver movimientos</Link>
							</Button>
							<Button onClick={() => onOpenChange(false)}>Cerrar</Button>
						</DialogFooter>
					</div>
				)}

				{!isLoading && !isError && !result && previewRows && (
					<>
						{/* Warnings */}
						{hasShortage && (
							<div className="rounded-lg bg-red-50 border border-red-200 p-3">
								<p className="text-sm font-semibold text-destructive">
									⚠ Stock insuficiente
								</p>
								<p className="text-xs text-destructive/80 mt-1">
									{shortageCount} material(es) con stock insuficiente. Se
									descontará igual si confirmás.
								</p>
							</div>
						)}

						{hasIncomplete && (
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
								<p className="text-sm font-semibold text-amber-700">
									⚠ Materiales incompletos
								</p>
								<p className="text-xs text-amber-600/80 mt-1">
									{incompleteCount} línea(s) de la lista de materiales tienen
									datos insuficientes y serán omitidas del descuento.
								</p>
							</div>
						)}

						{isExistingActive && (
							<div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
								<p className="text-sm font-semibold text-blue-700">
									ℹ Producción ya fue iniciada
								</p>
								<p className="text-xs text-blue-600/80 mt-1">
									Este presupuesto ya tiene un descuento de stock activo. No se
									crearán nuevos movimientos.
								</p>
							</div>
						)}

						{isExistingReversed && (
							<div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
								<p className="text-sm font-semibold text-violet-700">
									ℹ Lote anterior revertido
								</p>
								<p className="text-xs text-violet-600/80 mt-1">
									Este presupuesto tuvo un descuento de producción que fue
									revertido. Podés iniciar producción nuevamente.
								</p>
							</div>
						)}

						{/* BOM recapture recovery */}
						{hasNoBom && !isRecapturing && (
							<div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
								<p className="text-sm font-semibold text-amber-700">
									⚠ Sin lista de materiales aprobada
								</p>
								<p className="text-xs text-amber-600/80 mt-1">
									No se encontró una lista de materiales aprobada. Intentá
									capturarla nuevamente.
								</p>
								<Button
									variant="outline"
									size="sm"
									className="mt-2"
									onClick={handleRecaptureBom}
								>
									Recapturar BOM aprobado
								</Button>
							</div>
						)}

						{/* Recapture loading */}
						{isRecapturing && (
							<LoadingState label="Recapturando lista de materiales..." />
						)}

						{/* Setting info */}
						<p className="text-xs text-muted-foreground">
							{autoStockDiscount
								? "Modo automático: se descontará stock al iniciar producción."
								: "Modo manual: se iniciará producción sin descontar stock."}
						</p>

						{/* Materials table */}
						<div className="rounded-md border border-line overflow-hidden">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Material</TableHead>
										<TableHead className="text-right">Cant.</TableHead>
										<TableHead className="text-right">Stock actual</TableHead>
										<TableHead className="text-right">Stock proy.</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{previewRows.map((row) => (
										<TableRow
											key={row.line_number}
											className={
												!row.is_complete
													? "opacity-50"
													: (row.shortage_amount ?? 0) > 0
														? "bg-red-50/50"
														: ""
											}
										>
											<TableCell className="font-medium">
												{row.material_name}
												{!row.is_complete && (
													<span className="ml-1 text-xs text-amber-600">
														(incompleto)
													</span>
												)}
											</TableCell>
											<TableCell className="text-right">
												{row.deduction_quantity ?? "—"}
											</TableCell>
											<TableCell className="text-right">
												{row.current_stock ?? "—"}
											</TableCell>
											<TableCell
												className={`text-right font-medium ${
													(row.shortage_amount ?? 0) > 0
														? "text-destructive"
														: ""
												}`}
											>
												{row.projected_stock ?? "—"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={handleCancel}
								disabled={startMutation.isPending}
							>
								Cancelar
							</Button>
							{canConfirm && (
								<Button
									onClick={handleConfirm}
									disabled={startMutation.isPending || isRecapturing}
								>
									{startMutation.isPending
										? "Iniciando..."
										: autoStockDiscount
											? "Iniciar producción y descontar stock"
											: "Iniciar producción sin descontar stock"}
								</Button>
							)}
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
