import { useState } from "react";
import { CheckCircle2, CircleAlert, Play, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { useTransitionProductionOrder } from "../hooks/useProductionOrders";
import {
	PRODUCTION_ORDER_STATE,
	type ProductionOrderState,
} from "../api/types";

/**
 * Production-order state machine. The key is the current state; the
 * value is the list of legal next states per the
 * `transition_production_order_state` RPC contract. Terminal states
 * (delivered, cancelled) map to an empty array so this component
 * renders no actions at all.
 */
const ALLOWED_TRANSITIONS: Record<ProductionOrderState, readonly ProductionOrderState[]> =
	{
		[PRODUCTION_ORDER_STATE.PLANNED]: [
			PRODUCTION_ORDER_STATE.IN_PROGRESS,
			PRODUCTION_ORDER_STATE.CANCELLED,
		],
		[PRODUCTION_ORDER_STATE.IN_PROGRESS]: [
			PRODUCTION_ORDER_STATE.PAUSED,
			PRODUCTION_ORDER_STATE.QUALITY_CHECK,
			PRODUCTION_ORDER_STATE.CANCELLED,
		],
		[PRODUCTION_ORDER_STATE.PAUSED]: [
			PRODUCTION_ORDER_STATE.IN_PROGRESS,
			PRODUCTION_ORDER_STATE.CANCELLED,
		],
		[PRODUCTION_ORDER_STATE.QUALITY_CHECK]: [
			PRODUCTION_ORDER_STATE.READY,
			PRODUCTION_ORDER_STATE.IN_PROGRESS,
			PRODUCTION_ORDER_STATE.CANCELLED,
		],
		[PRODUCTION_ORDER_STATE.READY]: [
			PRODUCTION_ORDER_STATE.DELIVERED,
			PRODUCTION_ORDER_STATE.CANCELLED,
		],
		[PRODUCTION_ORDER_STATE.DELIVERED]: [],
		[PRODUCTION_ORDER_STATE.CANCELLED]: [],
	};

/**
 * Friendly Spanish label + icon for every legal transition. Anything
 * not in this map falls back to a generic "Avanzar a <state>" label
 * with a neutral icon so a future enum value does not silently render
 * as a button without context.
 */
const TRANSITION_META: Record<
	ProductionOrderState,
	Partial<Record<ProductionOrderState, { label: string; icon: React.ComponentType<{ className?: string }> }>>
> = {
	[PRODUCTION_ORDER_STATE.PLANNED]: {
		[PRODUCTION_ORDER_STATE.IN_PROGRESS]: { label: "Iniciar producción", icon: Play },
		[PRODUCTION_ORDER_STATE.CANCELLED]: { label: "Cancelar orden", icon: CircleAlert },
	},
	[PRODUCTION_ORDER_STATE.IN_PROGRESS]: {
		[PRODUCTION_ORDER_STATE.PAUSED]: { label: "Pausar", icon: CircleAlert },
		[PRODUCTION_ORDER_STATE.QUALITY_CHECK]: {
			label: "Enviar a control de calidad",
			icon: CheckCircle2,
		},
		[PRODUCTION_ORDER_STATE.CANCELLED]: { label: "Cancelar orden", icon: CircleAlert },
	},
	[PRODUCTION_ORDER_STATE.PAUSED]: {
		[PRODUCTION_ORDER_STATE.IN_PROGRESS]: { label: "Reanudar producción", icon: Play },
		[PRODUCTION_ORDER_STATE.CANCELLED]: { label: "Cancelar orden", icon: CircleAlert },
	},
	[PRODUCTION_ORDER_STATE.QUALITY_CHECK]: {
		[PRODUCTION_ORDER_STATE.READY]: { label: "Marcar como listo", icon: PackageCheck },
		[PRODUCTION_ORDER_STATE.IN_PROGRESS]: { label: "Devolver a producción", icon: Play },
		[PRODUCTION_ORDER_STATE.CANCELLED]: { label: "Cancelar orden", icon: CircleAlert },
	},
	[PRODUCTION_ORDER_STATE.READY]: {
		[PRODUCTION_ORDER_STATE.DELIVERED]: { label: "Marcar como entregado", icon: Truck },
		[PRODUCTION_ORDER_STATE.CANCELLED]: { label: "Cancelar orden", icon: CircleAlert },
	},
	[PRODUCTION_ORDER_STATE.DELIVERED]: {},
	[PRODUCTION_ORDER_STATE.CANCELLED]: {},
};

const STATE_LABEL: Record<ProductionOrderState, string> = {
	[PRODUCTION_ORDER_STATE.PLANNED]: "planificado",
	[PRODUCTION_ORDER_STATE.IN_PROGRESS]: "en producción",
	[PRODUCTION_ORDER_STATE.PAUSED]: "pausado",
	[PRODUCTION_ORDER_STATE.QUALITY_CHECK]: "control de calidad",
	[PRODUCTION_ORDER_STATE.READY]: "listo",
	[PRODUCTION_ORDER_STATE.DELIVERED]: "entregado",
	[PRODUCTION_ORDER_STATE.CANCELLED]: "cancelado",
};

/**
 * State transitions that ask the user for confirmation before
 * firing. Cancellation and final delivery are both non-reversible
 * (cancelled/delivered are terminal), so a confirm dialog prevents
 * accidental clicks. Pausing is also non-destructive but the user
 * intent matters; we ask for confirmation too.
 */
const CONFIRM_REQUIRED = new Set<ProductionOrderState>([
	PRODUCTION_ORDER_STATE.CANCELLED,
	PRODUCTION_ORDER_STATE.PAUSED,
	PRODUCTION_ORDER_STATE.DELIVERED,
]);

export interface ProductionOrderActionsProps {
	orderId: string;
	currentState: ProductionOrderState;
}

export function ProductionOrderActions({
	orderId,
	currentState,
}: ProductionOrderActionsProps) {
	const transition = useTransitionProductionOrder();
	const [pendingTarget, setPendingTarget] =
		useState<ProductionOrderState | null>(null);

	const legalNext = ALLOWED_TRANSITIONS[currentState];

	function handleConfirm() {
		if (!pendingTarget) return;
		const target = pendingTarget;
		setPendingTarget(null);
		transition.mutate(
			{ orderId, toState: target },
			{
				onSuccess: () =>
					toast.success(
						`Orden actualizada a ${STATE_LABEL[target]}`,
					),
			},
		);
	}

	if (legalNext.length === 0) {
		return (
			<section
				data-testid="order-actions-section"
				className="rounded-xl border border-line bg-cp-bg2 p-4"
			>
				<h2 className="text-sm font-semibold text-ink">Acciones</h2>
				<p className="mt-2 text-sm text-ink3">
					Esta orden está en estado terminal y no admite más
					cambios.
				</p>
			</section>
		);
	}

	return (
		<>
			<section
				data-testid="order-actions-section"
				className="rounded-xl border border-line bg-cp-bg2 p-4"
			>
				<h2 className="text-sm font-semibold text-ink">Acciones</h2>
				<div className="mt-3 flex flex-wrap gap-2">
					{legalNext.map((target) => {
						const meta = TRANSITION_META[currentState]?.[target] ?? {
							label: `Avanzar a ${STATE_LABEL[target]}`,
							icon: Play,
						};
						const Icon = meta.icon;
						const isConfirming = CONFIRM_REQUIRED.has(target);
						return (
							<Button
								key={target}
								variant={target === PRODUCTION_ORDER_STATE.CANCELLED ? "outline" : "default"}
								onClick={() => {
									if (isConfirming) {
										setPendingTarget(target);
									} else {
										transition.mutate(
											{ orderId, toState: target },
											{
												onSuccess: () =>
													toast.success(
														`Orden actualizada a ${STATE_LABEL[target]}`,
													),
											},
										);
									}
								}}
								disabled={transition.isPending}
								data-testid={`order-action-${target}`}
							>
								<Icon className="mr-2 h-4 w-4" />
								{meta.label}
							</Button>
						);
					})}
				</div>
			</section>

			<ConfirmDialog
				open={pendingTarget !== null}
				onOpenChange={(open) => {
					if (!open) setPendingTarget(null);
				}}
				title={
					pendingTarget
						? `Confirmar cambio a ${STATE_LABEL[pendingTarget]}`
						: "Confirmar cambio"
				}
				description={
					pendingTarget
						? `¿Seguro que querés pasar la orden a ${STATE_LABEL[pendingTarget]}? Esta acción ${
								pendingTarget === PRODUCTION_ORDER_STATE.CANCELLED ||
								pendingTarget === PRODUCTION_ORDER_STATE.DELIVERED
									? "es definitiva"
									: "puede revertirse después"
							}.`
						: ""
				}
				onConfirm={handleConfirm}
				isPending={transition.isPending}
			/>
		</>
	);
}