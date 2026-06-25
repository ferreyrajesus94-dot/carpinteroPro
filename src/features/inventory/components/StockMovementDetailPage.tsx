import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
	useReverseStockMovement,
	useStockMovementDetail,
} from "../hooks/useStockMovements";
import type { StockMovementReason } from "../api/stockMovements";

const REASON_LABELS: Record<StockMovementReason, string> = {
	compra: "Compra",
	consumo: "Consumo",
	merma: "Merma",
	ajuste: "Ajuste",
	descuento_presupuesto: "Descuento presupuesto",
	reversion: "Reversión",
};

function formatDelta(delta: number): string {
	const sign = delta > 0 ? "+" : "";
	return `${sign}${new Intl.NumberFormat("es-AR", {
		maximumFractionDigits: 2,
	}).format(delta)}`;
}

function getDetailText(movement: {
	is_reversal: boolean;
	reversal_reason: string | null;
	note: string | null;
}): { label: string; value: string } {
	if (movement.is_reversal) {
		return {
			label: "Motivo de reversión",
			value: movement.reversal_reason ?? movement.note ?? "—",
		};
	}

	return { label: "Nota", value: movement.note ?? "—" };
}

export function StockMovementDetailPage() {
	const { movementId } = useParams<{ movementId: string }>();
	const [reason, setReason] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const {
		data: movement,
		isLoading,
		error,
	} = useStockMovementDetail(movementId ?? null);
	const reverseMutation = useReverseStockMovement(movement?.workshop_id ?? "");

	const handleReverse = async () => {
		if (!movement) return;
		const trimmedReason = reason.trim();
		if (!trimmedReason) {
			setValidationError("Ingresá un motivo para revertir.");
			return;
		}

		setValidationError(null);
		await reverseMutation.mutateAsync({
			movementId: movement.id,
			materialId: movement.material_id,
			reason: trimmedReason,
		});
		setReason("");
	};

	if (isLoading) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<PageHeader title="Detalle de movimiento" />
				<p className="text-sm text-ink3">Cargando movimiento…</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<PageHeader title="Detalle de movimiento" />
				<div
					role="alert"
					className="rounded-xl border border-line bg-cp-bg2 p-4 text-sm text-ink2"
				>
					{error.message || "No se pudo cargar el movimiento."}
				</div>
			</div>
		);
	}

	if (!movement) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<PageHeader title="Detalle de movimiento" />
				<p className="text-sm text-ink3">Movimiento no encontrado.</p>
			</div>
		);
	}

	const detailText = getDetailText(movement);

	return (
		<div className="space-y-4 p-4 md:p-6">
			<PageHeader
				title="Detalle de movimiento"
				actions={
					<Button variant="ghost" size="sm" asChild>
						<Link to="/inventory/movements">
							<ArrowLeft className="mr-1 h-4 w-4" />
							Volver al ledger
						</Link>
					</Button>
				}
			/>

			<section className="rounded-xl border border-line bg-cp-bg2 p-4">
				<div className="grid gap-3 md:grid-cols-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-ink3">
							Material
						</p>
						<p className="font-medium text-ink">{movement.material_name}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-ink3">Delta</p>
						<p className="font-mono font-semibold text-ink">
							{formatDelta(movement.delta)}
						</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-ink3">Motivo</p>
						<p className="text-ink2">{REASON_LABELS[movement.reason]}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-ink3">
							Creado por
						</p>
						<p className="text-ink2">
							{movement.creator_name ?? "Sin registrar"}
						</p>
					</div>
				</div>
				<div className="mt-4">
					<p className="text-xs uppercase tracking-wide text-ink3">
						{detailText.label}
					</p>
					<p className="text-sm text-ink2">{detailText.value}</p>
				</div>
			</section>

			<section className="rounded-xl border border-line bg-cp-bg2 p-4">
				<h2 className="font-medium text-ink">Auditoría</h2>
				<p className="mt-1 text-sm text-ink3">
					El movimiento original no se modifica. Una reversión crea un nuevo
					movimiento compensatorio vinculado a este registro.
				</p>
				{movement.is_reversal && movement.reversal_of_movement_id ? (
					<p className="mt-3 text-sm text-ink2">
						Este movimiento revierte un movimiento original.
					</p>
				) : null}
				{movement.reversed_by_movement_id ? (
					<p className="mt-3 text-sm text-ink2">
						Ya fue revertido por un movimiento de reversión.
					</p>
				) : null}
			</section>

			<section className="rounded-xl border border-line bg-cp-bg2 p-4">
				<h2 className="font-medium text-ink">Reversión</h2>
				{movement.can_reverse ? (
					<div className="mt-3 space-y-3">
						<div className="space-y-2">
							<Label htmlFor="reversal-reason">Motivo de reversión</Label>
							<Textarea
								id="reversal-reason"
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Explicá por qué se revierte este movimiento"
							/>
							{validationError ? (
								<p className="text-sm text-cp-danger">{validationError}</p>
							) : null}
						</div>
						<Button
							onClick={handleReverse}
							disabled={reverseMutation.isPending}
						>
							<RotateCcw className="mr-2 h-4 w-4" />
							Revertir movimiento
						</Button>
					</div>
				) : (
					<p className="mt-2 text-sm text-ink3">
						Este movimiento no está disponible para reversión con tu rol o
						estado actual.
					</p>
				)}
			</section>
		</div>
	);
}
