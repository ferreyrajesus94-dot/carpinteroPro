import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from "@/shared/ui/feedback-state";
import {
	useProductionOrder,
	useProductionOrderEvents,
} from "../hooks/useProductionOrders";
import {
	PRODUCTION_ORDER_STATE,
	PRODUCTION_ORDER_STATE_LABELS,
	type ProductionOrderState,
} from "../api/types";
import type { ProductionOrderDetailRow } from "../api/productionOrders";
import { EventTimeline } from "./EventTimeline";
import { ProductionOrderActions } from "./ProductionOrderActions";

/**
 * Production order detail page — read-only view of a single
 * `production_orders` row plus its append-only event timeline.
 *
 * The page consumes the PR 5 hooks (`useProductionOrder` and
 * `useProductionOrderEvents`) and the PR 5 typed RPC wrappers
 * indirectly. It does NOT call the write RPCs; PR 7 is strictly
 * read-only. Transition actions live on the production board and
 * arrive in PR 8 alongside the dashboard integration.
 */

function formatDate(iso: string | null): string {
	if (!iso) return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDateTime(iso: string | null): string {
	if (!iso) return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	const hours = String(date.getUTCHours()).padStart(2, "0");
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function NotFoundState() {
	return (
		<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
			<PageHeader title="Orden no encontrada" />
			<EmptyState
				variant="empty-feature"
				title="No se encontró la orden"
				description="La orden de producción no existe o pertenece a otro taller."
			/>
			<Button asChild variant="outline" size="sm">
				<Link to="/production">
					<ArrowLeft className="mr-1 h-4 w-4" />
					Volver al tablero
				</Link>
			</Button>
		</div>
	);
}

function DetailHeader({ order }: { order: ProductionOrderDetailRow }) {
	return (
		<PageHeader
			eyebrow="Orden de producción"
			title={`${order.production_number} — ${order.quote_furniture_name}`}
			subtitle={order.quote_client_name}
			actions={
				<Button asChild variant="ghost" size="sm">
					<Link to="/production">
						<ArrowLeft className="mr-1 h-4 w-4" />
						Volver al tablero
					</Link>
				</Button>
			}
		/>
	);
}

function DetailGrid({ order }: { order: ProductionOrderDetailRow }) {
	const stateLabel = PRODUCTION_ORDER_STATE_LABELS[order.state];
	return (
		<section
			data-testid="order-detail-grid"
			className="grid gap-3 rounded-xl border border-line bg-cp-bg2 p-4 md:grid-cols-2"
		>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">Estado</p>
				<p className="text-sm font-medium text-ink">{stateLabel}</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">Asignado a</p>
				<p className="text-sm text-ink2">
					{order.assigned_to_name?.trim() ? order.assigned_to_name : "—"}
				</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">
					Presupuesto
				</p>
				<p className="text-sm text-ink2">
					{order.quote_number} · {order.quote_furniture_name}
				</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">Cliente</p>
				<p className="text-sm text-ink2">
					{order.quote_client_name?.trim() ? order.quote_client_name : "—"}
				</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">
					Inicio planificado
				</p>
				<p className="text-sm text-ink2">{formatDate(order.planned_start_date)}</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">
					Fin planificado
				</p>
				<p className="text-sm text-ink2">{formatDate(order.planned_end_date)}</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">
					Inicio real
				</p>
				<p className="text-sm text-ink2">{formatDateTime(order.actual_start_date)}</p>
			</div>
			<div>
				<p className="text-xs uppercase tracking-wide text-ink3">Fin real</p>
				<p className="text-sm text-ink2">{formatDateTime(order.actual_end_date)}</p>
			</div>
			{order.notes ? (
				<div className="md:col-span-2">
					<p className="text-xs uppercase tracking-wide text-ink3">Notas</p>
					<p className="text-sm text-ink2">{order.notes}</p>
				</div>
			) : null}
		</section>
	);
}

function TimelineSection() {
	const { id: orderId } = useParams<{ id: string }>();
	const {
		data: events,
		isLoading: eventsLoading,
		isError: eventsError,
		error: eventsErrorValue,
	} = useProductionOrderEvents(orderId ?? null);

	return (
		<section
			data-testid="order-timeline-section"
			className="rounded-xl border border-line bg-cp-bg2 p-4"
		>
			<h2 className="text-sm font-semibold text-ink">Cronología</h2>
			<div className="mt-3">
				{eventsLoading ? (
					<LoadingState label="Cargando cronología..." />
				) : eventsError ? (
					<p className="text-sm text-ink3" role="status">
						No se pudo cargar la cronología
						{eventsErrorValue?.message ? `: ${eventsErrorValue.message}` : ""}
					</p>
				) : (
					<EventTimeline events={events ?? []} />
				)}
			</div>
		</section>
	);
}

export function ProductionOrderDetailPage() {
	const { id: orderId } = useParams<{ id: string }>();
	const {
		data: order,
		isLoading,
		isError,
		error,
	} = useProductionOrder(orderId ?? null);

	if (isLoading) {
		return (
			<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
				<PageHeader title="Cargando orden..." />
				<LoadingState label="Cargando detalle de la orden..." />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
				<PageHeader title="Error al cargar la orden" />
				<ErrorState
					title="No se pudo cargar la orden"
					description={
						error?.message
							? error.message
							: "Revisá tu conexión e intentá de nuevo."
					}
				/>
				<Button asChild variant="outline" size="sm">
					<Link to="/production">
						<ArrowLeft className="mr-1 h-4 w-4" />
						Volver al tablero
					</Link>
				</Button>
			</div>
		);
	}

	if (!order) {
		return <NotFoundState />;
	}

	return (
		<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
			<DetailHeader order={order} />
			<DetailGrid order={order} />
			<ProductionOrderActions
				orderId={order.id}
				currentState={order.state}
			/>
			<TimelineSection />
		</div>
	);
}
