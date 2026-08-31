import { useState } from "react";
import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/feedback-state";
import { useProductionOrders, useQuotesWithProductionStatus } from "../hooks/useProductionOrders";
import {
	PRODUCTION_ORDER_ACTIVE_STATES,
	PRODUCTION_ORDER_STATE_LABELS,
	type ProductionOrderState,
} from "../api/types";
import type {
	ProductionOrderListRow,
	QuoteWithProductionStatus,
} from "../api/productionOrders";

export interface ProductionBoardProps {
	/**
	 * Called when the user picks an approved quote and clicks
	 * "Nueva orden". The host (`routes.tsx`) is expected to open the
	 * `StartProductionDialog` with the quote as input. The board never
	 * owns dialog state — that is a router/page concern.
	 */
	onStartProduction: (quote: QuoteWithProductionStatus) => void;
}

interface ColumnProps {
	state: ProductionOrderState;
	orders: ProductionOrderListRow[];
}

function Column({ state, orders }: ColumnProps) {
	return (
		<section
			aria-label={PRODUCTION_ORDER_STATE_LABELS[state]}
			className="flex w-[260px] shrink-0 flex-col gap-2 rounded-lg border border-line bg-cp-bg2 p-3"
		>
			<header className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-ink">
					{PRODUCTION_ORDER_STATE_LABELS[state]}
				</h2>
				<span className="rounded-full bg-cp-accent-soft px-2 py-0.5 text-xs font-medium text-cp-accent">
					{orders.length}
				</span>
			</header>
			<div className="flex flex-col gap-2" data-testid="column-body">
				{orders.length === 0 ? (
					<p className="py-4 text-center text-xs text-ink3">Sin órdenes</p>
				) : (
					orders.map((o) => <OrderCard key={o.id} order={o} />)
				)}
			</div>
		</section>
	);
}

function OrderCard({ order }: { order: ProductionOrderListRow }) {
	return (
		<article
			data-testid="production-order-card"
			className="rounded-md border border-line bg-background p-3 shadow-sm"
		>
			<p className="font-mono text-xs text-ink3">{order.production_number}</p>
			<p className="mt-1 text-sm font-medium text-ink">{order.quote_furniture_name}</p>
			{order.planned_start_date && (
				<p className="mt-1 text-xs text-ink2">
					Inicio plan: {order.planned_start_date}
				</p>
			)}
			{order.assigned_to_name && (
				<p className="mt-1 text-xs text-ink2">Asignado a: {order.assigned_to_name}</p>
			)}
		</article>
	);
}

/**
 * Production board — Kanban-style overview of every active production
 * order in the caller's workshop. One column per active state, one card
 * per order. Terminal states (delivered, cancelled) are intentionally
 * NOT rendered on the board; they are reserved for the future detail /
 * history view.
 *
 * The board also hosts the "Nueva orden" trigger. Picking an approved
 * quote (one that is NOT currently in any active production) and
 * clicking the button calls `onStartProduction(quote)`, which the host
 * route uses to open the `StartProductionDialog`.
 */
export function ProductionBoard({ onStartProduction }: ProductionBoardProps) {
	const {
		data: orders,
		isLoading,
		isError,
	} = useProductionOrders({
		states: [...PRODUCTION_ORDER_ACTIVE_STATES],
	});
	// Surface quote-projection loading and error states alongside the
	// order list so an unavailable projection does not look like an
	// empty board.
	const {
		data: quotes,
		isLoading: isQuotesLoading,
		isError: isQuotesError,
	} = useQuotesWithProductionStatus();
	const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");

	const startableQuotes = (quotes ?? []).filter(
		(q) => q.stored_status === "aprobado" && q.has_active_production === false,
	);

	const grouped: Record<ProductionOrderState, ProductionOrderListRow[]> = {
		planned: [],
		in_progress: [],
		paused: [],
		quality_check: [],
		ready: [],
		delivered: [],
		cancelled: [],
	};
	for (const o of orders ?? []) {
		grouped[o.state].push(o);
	}

	if (isLoading) {
		return (
			<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
				<PageHeader title="Producción" />
				<LoadingState label="Cargando órdenes de producción..." />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
				<PageHeader title="Producción" />
				<ErrorState
					title="Error al cargar las órdenes"
					description="Revisá tu conexión e intentá de nuevo."
				/>
			</div>
		);
	}

	const hasNoOrders = (orders ?? []).length === 0;
	const selectedQuote = startableQuotes.find((q) => q.id === selectedQuoteId) ?? null;

	function handleStart() {
		if (selectedQuote) onStartProduction(selectedQuote);
	}

	return (
		<div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6 min-w-0">
			<PageHeader
				title="Producción"
				subtitle="Tablero de órdenes de producción activas"
				actions={
					<div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
						<label className="sr-only" htmlFor="production-start-quote">
							Presupuesto aprobado
						</label>
						<select
							id="production-start-quote"
							value={selectedQuoteId}
							onChange={(e) => setSelectedQuoteId(e.target.value)}
							className="h-10 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
							disabled={isQuotesLoading || isQuotesError || startableQuotes.length === 0}
						>
							<option value="">
								{isQuotesLoading
									? "Cargando presupuestos..."
									: isQuotesError
										? "No se pudo cargar la lista de presupuestos"
										: startableQuotes.length === 0
											? "Sin presupuestos aprobados"
											: "Elegí un presupuesto"}
							</option>
							{!isQuotesLoading && !isQuotesError && startableQuotes.map((q) => (
								<option key={q.id} value={q.id}>
									{q.quote_number} — {q.furniture_name}
								</option>
							))}
						</select>
						<Button
							onClick={handleStart}
							disabled={!selectedQuote || isQuotesLoading || isQuotesError}
						>
							Nueva orden
						</Button>
					</div>
				}
			/>

			{isQuotesLoading && (
				<LoadingState label="Cargando lista de presupuestos para iniciar producción..." />
			)}

			{isQuotesError && (
				<ErrorState
					title="No se pudo cargar la lista de presupuestos"
					description="El tablero muestra las órdenes de producción existentes, pero la lista de presupuestos aprobados no se pudo cargar. Reintentá desde esta pantalla o recargá la página."
				/>
			)}

			{hasNoOrders && startableQuotes.length === 0 && !isQuotesLoading && !isQuotesError ? (
				<EmptyState
					variant="empty-feature"
					title="Sin órdenes de producción"
					description="Cuando inicies producción desde un presupuesto aprobado aparecerá acá."
				/>
			) : (
				<div
					data-testid="production-board-kanban"
					className="flex flex-row gap-3 overflow-x-auto pb-2 min-w-0"
				>
					{PRODUCTION_ORDER_ACTIVE_STATES.map((state) => (
						<Column key={state} state={state} orders={grouped[state]} />
					))}
				</div>
			)}
		</div>
	);
}
